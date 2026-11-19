import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Le o arquivo .env da pasta do projeto, se existir
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const PORT = process.env.PORT || 3000;
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('[aviso] JWT_SECRET nao definido: usando um segredo temporario. Todos serao deslogados quando o servidor reiniciar.');
}

/* ---------- Banco de dados: MySQL ----------
   DATABASE_URL=mysql://usuario:senha@host:3306/scoutplay
   ou DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.  DB_SSL=true para bancos na nuvem. */
const base = {
  charset: 'utf8mb4_unicode_ci',
  dateStrings: true,
  connectionLimit: +(process.env.DB_POOL || 10),
  waitForConnections: true,
  ssl: /^(1|true|yes)$/i.test(process.env.DB_SSL || '') ? { rejectUnauthorized: false } : undefined,
};
const pool = process.env.DATABASE_URL
  ? mysql.createPool({ uri: process.env.DATABASE_URL, ...base })
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'scoutplay',
      ...base,
    });

const q = async (sql, p = []) => (await pool.query(sql, p))[0];
const one = async (sql, p) => (await q(sql, p))[0];

try {
  await q('SELECT 1 FROM users LIMIT 1');
  await q('SELECT 1 FROM notifications LIMIT 1');
} catch (e) {
  console.error(e.code === 'ER_NO_SUCH_TABLE'
    ? 'Tabelas nao encontradas. Rode database/scoutplay.sql no MySQL antes de iniciar.'
    : `Nao foi possivel conectar ao MySQL: ${e.message}`);
  process.exit(1);
}

/* Migracao automatica (bancos criados antes da foto de perfil): nao apaga nada */
try {
  await q(`CREATE TABLE IF NOT EXISTS user_photos (
    id CHAR(36) NOT NULL, user_id INT UNSIGNED NOT NULL, mime VARCHAR(40) NOT NULL, size INT UNSIGNED NOT NULL,
    data MEDIUMBLOB NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), KEY ix_user_photos_user (user_id),
    CONSTRAINT fk_photo_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const hasCol = await one(`SELECT 1 AS ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='photo_id'`);
  if (!hasCol) await q('ALTER TABLE users ADD COLUMN photo_id CHAR(36) NULL AFTER avatar');
} catch (e) {
  console.error(`Nao foi possivel preparar a tabela de fotos: ${e.message}`);
  process.exit(1);
}

/* ---------- utilitarios ---------- */
const CHUNK = 1024 * 1024;
const UUID = /^[0-9a-f-]{36}$/;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('video/')),
});
const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const fail = (res, status, error) => res.status(status).json({ error });
const str = (v, max) => { const s = String(v ?? '').trim().slice(0, max); return s || null; };
const num = (v, min, max) => { if (v === '' || v == null) return null; const n = Math.round(+v); return Number.isFinite(n) && n >= min && n <= max ? n : undefined; };
const defaultAvatar = (role) => (role === 'scout' ? '🔍' : '⚽');
const videoUrl = (id) => (id ? `/api/videos/${id}` : null);
const photoUrl = (id) => (id ? `/api/photos/${id}` : null);
const USER_COLS = 'id, name, email, role, avatar, photo_id, city, state';
const freshUser = (id) => one(`SELECT ${USER_COLS} FROM users WHERE id=?`, [id]);
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const imageType = (b) => {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (b.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';
  return null;
};
const notify = (userId, actorId, type, postId = null) =>
  userId === actorId ? null : q('INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?,?,?,?)', [userId, actorId, type, postId]);

const saveVideo = async (file, userId) => {
  const id = crypto.randomUUID();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT INTO videos (id, user_id, mime, size, chunk_size) VALUES (?,?,?,?,?)', [id, userId, file.mimetype, file.size, CHUNK]);
    for (let off = 0, i = 0; off < file.size; off += CHUNK, i++) {
      await conn.query('INSERT INTO video_chunks (video_id, idx, data) VALUES (?,?,?)', [id, i, file.buffer.subarray(off, off + CHUNK)]);
    }
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

const cleanupStories = () =>
  q(`DELETE v FROM videos v JOIN stories s ON s.video_id = v.id WHERE s.created_at < NOW() - INTERVAL 24 HOUR`)
    .catch((e) => console.error('Limpeza de stories falhou:', e.message));
cleanupStories();
setInterval(cleanupStories, 60 * 60 * 1000);

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit: '200kb' }));

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar || defaultAvatar(u.role), photo: photoUrl(u.photo_id), city: u.city, state: u.state });
const sign = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: '30d' });

const auth = h(async (req, res, next) => {
  try {
    const { id } = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET);
    req.user = await one(`SELECT ${USER_COLS} FROM users WHERE id=?`, [id]);
  } catch { req.user = null; }
  if (!req.user) return fail(res, 401, 'Sessão expirada. Entre novamente.');
  next();
});
const scoutOnly = (req, res, next) => (req.user.role === 'scout' ? next() : fail(res, 403, 'Disponível apenas para olheiros.'));

/* ---------- autenticacao ---------- */
app.post('/api/register', h(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return fail(res, 400, 'Preencha nome, e-mail e senha.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return fail(res, 400, 'Informe um e-mail válido.');
  if (String(password).length < 6) return fail(res, 400, 'A senha deve ter ao menos 6 caracteres.');
  if (!['athlete', 'scout'].includes(role)) return fail(res, 400, 'Perfil inválido.');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query('INSERT INTO users (name, email, role, password_hash) VALUES (?,?,?,?)',
      [name.trim().slice(0, 120), email.trim().toLowerCase().slice(0, 190), role, bcrypt.hashSync(String(password), 10)]);
    await conn.query(`INSERT INTO ${role === 'scout' ? 'scout_profiles' : 'athlete_profiles'} (user_id) VALUES (?)`, [r.insertId]);
    await conn.commit();
    const [[user]] = await conn.query(`SELECT ${USER_COLS} FROM users WHERE id=?`, [r.insertId]);
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Este e-mail já está cadastrado.');
    throw e;
  } finally {
    conn.release();
  }
}));

app.post('/api/login', h(async (req, res) => {
  const { email, password } = req.body || {};
  const user = await one('SELECT * FROM users WHERE email=?', [String(email || '').trim().toLowerCase()]);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return fail(res, 401, 'E-mail ou senha incorretos.');
  res.json({ token: sign(user), user: publicUser(user) });
}));

/* ---------- meu perfil ---------- */
const loadProfile = async (u) => {
  if (u.role === 'scout') {
    const p = (await one('SELECT organization, experience_years, bio FROM scout_profiles WHERE user_id=?', [u.id])) || {};
    return { organization: p.organization, experienceYears: p.experience_years, bio: p.bio };
  }
  const p = (await one('SELECT * FROM athlete_profiles WHERE user_id=?', [u.id])) || {};
  return {
    position: p.position, birthDate: p.birth_date, club: p.club, category: p.category, foot: p.dominant_foot,
    height: p.height_cm, weight: p.weight_kg, traits: p.traits, bio: p.bio, games: p.games ?? 0, goals: p.goals ?? 0, assists: p.assists ?? 0,
  };
};

app.get('/api/me', auth, h(async (req, res) => res.json({ user: publicUser(req.user), profile: await loadProfile(req.user) })));

app.put('/api/me', auth, h(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 120);
  if (!name) return fail(res, 400, 'O nome não pode ficar em branco.');
  const state = str(b.state, 2)?.toUpperCase() ?? null;
  if (state && !/^[A-Z]{2}$/.test(state)) return fail(res, 400, 'UF deve ter 2 letras (ex.: SP).');
  await q('UPDATE users SET name=?, avatar=?, city=?, state=? WHERE id=?', [name, str(b.avatar, 16), str(b.city, 80), state, req.user.id]);

  if (req.user.role === 'scout') {
    const exp = num(b.experienceYears, 0, 80);
    if (exp === undefined) return fail(res, 400, 'Anos de experiência inválido.');
    await q('UPDATE scout_profiles SET organization=?, experience_years=?, bio=? WHERE user_id=?', [str(b.organization, 120), exp, str(b.bio, 2000), req.user.id]);
  } else {
    const fields = { height: num(b.height, 100, 230), weight: num(b.weight, 30, 200), games: num(b.games, 0, 10000), goals: num(b.goals, 0, 10000), assists: num(b.assists, 0, 10000) };
    const bad = Object.entries(fields).find(([, v]) => v === undefined);
    if (bad) return fail(res, 400, { height: 'Altura inválida (cm).', weight: 'Peso inválido (kg).' }[bad[0]] || 'Estatísticas inválidas.');
    const birth = str(b.birthDate, 10);
    if (birth && (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || isNaN(Date.parse(birth)) || new Date(birth) > new Date())) return fail(res, 400, 'Data de nascimento inválida.');
    const foot = ['Direito', 'Esquerdo', 'Ambidestro'].includes(b.foot) ? b.foot : null;
    await q(`UPDATE athlete_profiles SET position=?, birth_date=?, club=?, category=?, dominant_foot=?, height_cm=?, weight_kg=?, traits=?, bio=?, games=?, goals=?, assists=? WHERE user_id=?`,
      [str(b.position, 40), birth, str(b.club, 120), str(b.category, 40), foot, fields.height, fields.weight, str(b.traits, 255), str(b.bio, 2000), fields.games ?? 0, fields.goals ?? 0, fields.assists ?? 0, req.user.id]);
  }
  const user = await one(`SELECT ${USER_COLS} FROM users WHERE id=?`, [req.user.id]);
  res.json({ user: publicUser(user), profile: await loadProfile(user) });
}));

/* ---------- foto de perfil ---------- */
app.post('/api/me/photo', auth, photoUpload.single('photo'), h(async (req, res) => {
  const f = req.file;
  if (!f) return fail(res, 400, 'Selecione uma imagem.');
  const mime = imageType(f.buffer);
  if (!mime) return fail(res, 400, 'Formato inválido. Use JPG, PNG, WebP ou GIF.');
  const id = crypto.randomUUID();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT INTO user_photos (id, user_id, mime, size, data) VALUES (?,?,?,?,?)', [id, req.user.id, mime, f.size, f.buffer]);
    await conn.query('UPDATE users SET photo_id=? WHERE id=?', [id, req.user.id]);
    await conn.query('DELETE FROM user_photos WHERE user_id=? AND id<>?', [req.user.id, id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ user: publicUser(await freshUser(req.user.id)) });
}));

app.delete('/api/me/photo', auth, h(async (req, res) => {
  await q('UPDATE users SET photo_id=NULL WHERE id=?', [req.user.id]);
  await q('DELETE FROM user_photos WHERE user_id=?', [req.user.id]);
  res.json({ user: publicUser(await freshUser(req.user.id)) });
}));

// O id da foto e um UUID novo a cada upload: o endereco e imprevisivel e pode ficar em cache para sempre
app.get('/api/photos/:id', h(async (req, res) => {
  if (!UUID.test(req.params.id)) return fail(res, 404, 'Foto não encontrada.');
  const p = await one('SELECT mime, data FROM user_photos WHERE id=?', [req.params.id]);
  if (!p) return fail(res, 404, 'Foto não encontrada.');
  res.set({ 'Content-Type': p.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }).send(p.data);
}));

app.get('/api/me/stats', auth, h(async (req, res) => {
  const id = req.user.id;
  if (req.user.role === 'scout') {
    const s = await one(`SELECT
      (SELECT COUNT(*) FROM shortlist WHERE scout_id=?) AS saved,
      (SELECT COUNT(*) FROM evaluations WHERE scout_id=?) AS evaluations,
      (SELECT COUNT(DISTINCT athlete_id) FROM profile_views WHERE viewer_id=? AND viewed_at > NOW() - INTERVAL 30 DAY) AS viewed30,
      (SELECT COUNT(*) FROM users WHERE role='athlete' AND created_at > NOW() - INTERVAL 30 DAY) AS newAthletes30,
      (SELECT COUNT(*) FROM users WHERE role='athlete') AS totalAthletes`, [id, id, id]);
    const byPosition = await q(`SELECT COALESCE(position,'Sem posição') AS position, COUNT(*) AS total
      FROM athlete_profiles GROUP BY COALESCE(position,'Sem posição') ORDER BY total DESC LIMIT 8`);
    return res.json({ ...s, byPosition });
  }
  const s = await one(`SELECT
    (SELECT COUNT(*) FROM profile_views WHERE athlete_id=? AND viewed_at > NOW() - INTERVAL 30 DAY) AS views30,
    (SELECT COUNT(*) FROM follows WHERE followed_id=?) AS followers,
    (SELECT COUNT(*) FROM follows WHERE follower_id=?) AS following,
    (SELECT COUNT(*) FROM posts WHERE user_id=?) AS posts`, [id, id, id, id]);
  const p = await one('SELECT * FROM athlete_profiles WHERE user_id=?', [id]);
  const checks = [req.user.avatar || req.user.photo_id, req.user.city, req.user.state, p?.position, p?.birth_date, p?.club, p?.category, p?.dominant_foot, p?.height_cm, p?.weight_kg, p?.traits, p?.bio];
  res.json({ ...s, completeness: Math.round((checks.filter((v) => v != null && v !== '').length / checks.length) * 100) });
}));

/* ---------- atletas ---------- */
const ATHLETE_SQL = `SELECT u.id, u.name, u.avatar, u.photo_id, u.city, u.state, u.created_at,
  ap.position, ap.birth_date, TIMESTAMPDIFF(YEAR, ap.birth_date, CURDATE()) AS age, ap.club, ap.category,
  ap.dominant_foot, ap.height_cm, ap.weight_kg, ap.traits, ap.bio, ap.games, ap.goals, ap.assists,
  (SELECT ROUND(AVG(rating)) FROM evaluations e WHERE e.athlete_id=u.id) AS rating,
  (SELECT COUNT(*) FROM evaluations e WHERE e.athlete_id=u.id) AS evals,
  (SELECT COUNT(*) FROM follows f WHERE f.followed_id=u.id) AS followers,
  EXISTS(SELECT 1 FROM follows f WHERE f.followed_id=u.id AND f.follower_id=?) AS is_following,
  EXISTS(SELECT 1 FROM shortlist s WHERE s.athlete_id=u.id AND s.scout_id=?) AS is_saved
  FROM users u JOIN athlete_profiles ap ON ap.user_id=u.id WHERE u.role='athlete'`;

const athleteOut = (a) => ({
  id: a.id, name: a.name, avatar: a.avatar || defaultAvatar('athlete'), photo: photoUrl(a.photo_id), city: a.city, state: a.state,
  position: a.position, birthDate: a.birth_date, age: a.age, club: a.club, category: a.category, foot: a.dominant_foot,
  height: a.height_cm, weight: a.weight_kg, traits: a.traits, bio: a.bio,
  stats: { jogos: a.games, gols: a.goals, assistencias: a.assists },
  rating: a.rating == null ? null : Number(a.rating), evaluations: Number(a.evals), followers: Number(a.followers),
  following: !!a.is_following, saved: !!a.is_saved,
});

app.get('/api/athletes', auth, h(async (req, res) => {
  const rows = await q(`${ATHLETE_SQL} ORDER BY u.created_at DESC LIMIT 1000`, [req.user.id, req.user.id]);
  res.json({ athletes: rows.map(athleteOut) });
}));

app.get('/api/athletes/:id', auth, h(async (req, res) => {
  const id = +req.params.id;
  const a = await one(`${ATHLETE_SQL} AND u.id=?`, [req.user.id, req.user.id, id]);
  if (!a) return fail(res, 404, 'Atleta não encontrado.');
  if (id !== req.user.id) {
    const r = await q('INSERT IGNORE INTO profile_views (viewer_id, athlete_id, viewed_on) VALUES (?,?,CURDATE())', [req.user.id, id]);
    if (r.affectedRows && req.user.role === 'scout') await notify(id, req.user.id, 'view');
  }
  const mine = req.user.role === 'scout' ? await one('SELECT rating, note FROM evaluations WHERE scout_id=? AND athlete_id=?', [req.user.id, id]) : null;
  res.json({ athlete: athleteOut(a), myEvaluation: mine || null });
}));

const athleteExists = (id) => one(`SELECT 1 FROM users WHERE id=? AND role='athlete'`, [id]);

app.post('/api/athletes/:id/follow', auth, h(async (req, res) => {
  const id = +req.params.id;
  if (id === req.user.id) return fail(res, 400, 'Você não pode seguir a si mesmo.');
  if (!(await athleteExists(id))) return fail(res, 404, 'Atleta não encontrado.');
  const del = await q('DELETE FROM follows WHERE follower_id=? AND followed_id=?', [req.user.id, id]);
  if (!del.affectedRows) {
    await q('INSERT IGNORE INTO follows (follower_id, followed_id) VALUES (?,?)', [req.user.id, id]);
    await notify(id, req.user.id, 'follow');
  }
  res.json({ following: !del.affectedRows });
}));

app.post('/api/athletes/:id/shortlist', auth, scoutOnly, h(async (req, res) => {
  const id = +req.params.id;
  if (!(await athleteExists(id))) return fail(res, 404, 'Atleta não encontrado.');
  const del = await q('DELETE FROM shortlist WHERE scout_id=? AND athlete_id=?', [req.user.id, id]);
  if (!del.affectedRows) {
    await q('INSERT IGNORE INTO shortlist (scout_id, athlete_id) VALUES (?,?)', [req.user.id, id]);
    await notify(id, req.user.id, 'shortlist');
  }
  res.json({ saved: !del.affectedRows });
}));

app.put('/api/athletes/:id/evaluation', auth, scoutOnly, h(async (req, res) => {
  const id = +req.params.id;
  const rating = num(req.body?.rating, 0, 100);
  if (rating == null) return fail(res, 400, 'Informe uma nota de 0 a 100.');
  if (!(await athleteExists(id))) return fail(res, 404, 'Atleta não encontrado.');
  const r = await q(`INSERT INTO evaluations (scout_id, athlete_id, rating, note) VALUES (?,?,?,?)
    ON DUPLICATE KEY UPDATE rating=VALUES(rating), note=VALUES(note)`, [req.user.id, id, rating, str(req.body?.note, 4000)]);
  if (r.affectedRows === 1) await notify(id, req.user.id, 'evaluation');
  res.json({ ok: true });
}));

app.delete('/api/athletes/:id/evaluation', auth, scoutOnly, h(async (req, res) => {
  await q('DELETE FROM evaluations WHERE scout_id=? AND athlete_id=?', [req.user.id, +req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/evaluations', auth, scoutOnly, h(async (req, res) => {
  const rows = await q(`SELECT e.athlete_id, e.rating, e.note, TIMESTAMPDIFF(SECOND, e.updated_at, NOW()) AS ago,
      u.name, u.avatar, u.photo_id, ap.position, ap.club
    FROM evaluations e JOIN users u ON u.id=e.athlete_id LEFT JOIN athlete_profiles ap ON ap.user_id=u.id
    WHERE e.scout_id=? ORDER BY e.updated_at DESC`, [req.user.id]);
  res.json({ evaluations: rows.map((r) => ({ athleteId: r.athlete_id, name: r.name, avatar: r.avatar || defaultAvatar('athlete'), photo: photoUrl(r.photo_id), position: r.position, club: r.club, rating: r.rating, note: r.note, ago: r.ago })) });
}));

/* ---------- notificacoes ---------- */
app.get('/api/notifications', auth, h(async (req, res) => {
  const rows = await q(`SELECT n.id, n.type, n.post_id, n.is_read, TIMESTAMPDIFF(SECOND, n.created_at, NOW()) AS ago, u.name, u.role, u.avatar, u.photo_id
    FROM notifications n JOIN users u ON u.id=n.actor_id WHERE n.user_id=? ORDER BY n.id DESC LIMIT 30`, [req.user.id]);
  const unread = (await one('SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0', [req.user.id])).c;
  res.json({ unread: Number(unread), items: rows.map((n) => ({ id: n.id, type: n.type, postId: n.post_id, read: !!n.is_read, ago: n.ago, actor: n.name, actorRole: n.role, actorAvatar: n.avatar || defaultAvatar(n.role), actorPhoto: photoUrl(n.photo_id) })) });
}));

app.post('/api/notifications/read', auth, h(async (req, res) => {
  await q('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0', [req.user.id]);
  res.json({ ok: true });
}));

/* ---------- feed (igual para todas as contas) ---------- */
app.get('/api/feed', auth, h(async (req, res) => {
  const me = req.user.id;
  const posts = (await q(`
    SELECT p.id, p.text, p.media, p.video_id, TIMESTAMPDIFF(SECOND, p.created_at, NOW()) AS ago,
      u.id AS uid, u.name, u.role, u.avatar, u.photo_id, ap.position, ap.club, sp.organization,
      (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) AS likes,
      EXISTS(SELECT 1 FROM post_likes WHERE post_id=p.id AND user_id=?) AS liked,
      EXISTS(SELECT 1 FROM post_saves WHERE post_id=p.id AND user_id=?) AS saved,
      (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS comments
    FROM posts p JOIN users u ON u.id=p.user_id
    LEFT JOIN athlete_profiles ap ON ap.user_id=u.id LEFT JOIN scout_profiles sp ON sp.user_id=u.id
    ORDER BY p.id DESC LIMIT 100`, [me, me]))
    .map((p) => ({
      id: p.id, text: p.text, media: p.media, video: videoUrl(p.video_id), ago: p.ago,
      author: { id: p.uid, name: p.name, role: p.role, avatar: p.avatar || defaultAvatar(p.role), photo: photoUrl(p.photo_id), position: p.position, club: p.role === 'scout' ? p.organization : p.club },
      likes: Number(p.likes), liked: !!p.liked, saved: !!p.saved, comments: Number(p.comments),
    }));
  const comments = {};
  if (posts.length) {
    (await q('SELECT c.id, c.post_id, c.text, u.name, u.role, u.avatar, u.photo_id FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id IN (?) ORDER BY c.id', [posts.map((p) => p.id)]))
      .forEach((c) => (comments[c.post_id] ||= []).push({ id: c.id, author: c.name, text: c.text, avatar: c.avatar || defaultAvatar(c.role), photo: photoUrl(c.photo_id) }));
  }
  const stories = (await q(`SELECT s.id, s.user_id, s.caption, s.file_name, s.video_id, u.name, u.role, u.avatar, u.photo_id FROM stories s JOIN users u ON u.id=s.user_id
    WHERE s.created_at > NOW() - INTERVAL 24 HOUR ORDER BY s.id DESC LIMIT 30`))
    .map((s) => ({ id: s.id, caption: s.caption, name: s.file_name, authorId: s.user_id, author: s.name, authorAvatar: s.avatar || defaultAvatar(s.role), authorPhoto: photoUrl(s.photo_id), url: videoUrl(s.video_id) }));
  res.json({ posts, stories, comments });
}));

app.post('/api/posts', auth, upload.single('video'), h(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 5000);
  if (!text && !req.file) return fail(res, 400, 'Escreva algo ou envie um vídeo.');
  const vid = req.file ? await saveVideo(req.file, req.user.id) : null;
  await q('INSERT INTO posts (user_id, text, media, video_id) VALUES (?,?,?,?)', [req.user.id, text, str(req.body.media, 16) || '⚽', vid]);
  res.json({ ok: true });
}));

app.delete('/api/posts/:id', auth, h(async (req, res) => {
  const post = await one('SELECT * FROM posts WHERE id=?', [+req.params.id]);
  if (!post) return fail(res, 404, 'Publicação não encontrada.');
  if (post.user_id !== req.user.id) return fail(res, 403, 'Você só pode excluir suas publicações.');
  await q('DELETE FROM posts WHERE id=?', [post.id]);
  if (post.video_id) await q('DELETE FROM videos WHERE id=?', [post.video_id]);
  res.json({ ok: true });
}));

const toggle = (table, type) => h(async (req, res) => {
  const post = await one('SELECT id, user_id FROM posts WHERE id=?', [+req.params.id]);
  if (!post) return fail(res, 404, 'Publicação não encontrada.');
  const del = await q(`DELETE FROM ${table} WHERE post_id=? AND user_id=?`, [post.id, req.user.id]);
  if (!del.affectedRows) {
    await q(`INSERT IGNORE INTO ${table} (post_id, user_id) VALUES (?,?)`, [post.id, req.user.id]);
    if (type) await notify(post.user_id, req.user.id, type, post.id);
  }
  res.json({ ok: true });
});
app.post('/api/posts/:id/like', auth, toggle('post_likes', 'like'));
app.post('/api/posts/:id/save', auth, toggle('post_saves'));

app.post('/api/posts/:id/comments', auth, h(async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 1000);
  const post = await one('SELECT id, user_id FROM posts WHERE id=?', [+req.params.id]);
  if (!text || !post) return fail(res, 400, 'Comentário inválido.');
  await q('INSERT INTO comments (post_id, user_id, text) VALUES (?,?,?)', [post.id, req.user.id, text]);
  await notify(post.user_id, req.user.id, 'comment', post.id);
  res.json({ ok: true });
}));

app.post('/api/posts/:id/report', auth, h(async (req, res) => {
  const post = await one('SELECT id, user_id FROM posts WHERE id=?', [+req.params.id]);
  if (!post) return fail(res, 404, 'Publicação não encontrada.');
  if (post.user_id === req.user.id) return fail(res, 400, 'Você não pode denunciar a própria publicação.');
  await q('INSERT IGNORE INTO post_reports (post_id, user_id) VALUES (?,?)', [post.id, req.user.id]);
  res.json({ ok: true });
}));

app.delete('/api/stories/:id', auth, h(async (req, res) => {
  const st = await one('SELECT id, user_id, video_id FROM stories WHERE id=?', [+req.params.id]);
  if (!st) return fail(res, 404, 'Story não encontrado.');
  if (st.user_id !== req.user.id) return fail(res, 403, 'Você só pode excluir seus próprios stories.');
  await q('DELETE FROM videos WHERE id=?', [st.video_id]); // apaga o vídeo (e o story, em cascata)
  await q('DELETE FROM stories WHERE id=?', [st.id]);
  res.json({ ok: true });
}));

app.post('/api/stories', auth, upload.single('video'), h(async (req, res) => {
  if (!req.file) return fail(res, 400, 'Envie um vídeo (MP4, MOV ou WebM).');
  const vid = await saveVideo(req.file, req.user.id);
  await q('INSERT INTO stories (user_id, caption, file_name, video_id) VALUES (?,?,?,?)', [req.user.id, str(req.body.caption, 60), str(req.file.originalname, 255), vid]);
  res.json({ ok: true });
}));

/* ---------- videos servidos do banco, com suporte a Range ---------- */
app.get('/api/videos/:id', h(async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return res.sendStatus(404);
  const v = await one('SELECT mime, size, chunk_size FROM videos WHERE id=?', [id]);
  if (!v) return res.sendStatus(404);
  const size = Number(v.size), cs = Number(v.chunk_size);
  let start = 0, end = size - 1, status = 200;
  const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (r) {
    start = r[1] === '' ? Math.max(size - +r[2], 0) : +r[1];
    end = Math.min(r[2] && r[1] !== '' ? +r[2] : start + 4 * 1024 * 1024 - 1, size - 1);
    if (start > end) return res.status(416).set('Content-Range', `bytes */${size}`).end();
    status = 206;
    res.set('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  res.status(status).set({ 'Content-Type': v.mime, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'private, max-age=86400' });
  const first = Math.floor(start / cs), last = Math.floor(end / cs);
  for (let i = first; i <= last && !res.destroyed; i += 4) {
    const rows = await q('SELECT idx, data FROM video_chunks WHERE video_id=? AND idx BETWEEN ? AND ? ORDER BY idx', [id, i, Math.min(i + 3, last)]);
    for (const row of rows) {
      const off = row.idx * cs;
      const part = row.data.subarray(Math.max(start - off, 0), Math.min(end - off + 1, row.data.length));
      if (!res.write(part)) await new Promise((ok) => { res.once('drain', ok); res.once('close', ok); });
      if (res.destroyed) return;
    }
  }
  res.end();
}));

/* ---------- front-end (apos `npm run build`) ---------- */
const dist = path.join(root, 'dist');
app.use(express.static(dist));
app.use((req, res) => (req.path.startsWith('/api') ? fail(res, 404, 'Rota não encontrada.') : res.sendFile(path.join(dist, 'index.html'))));
app.use((err, req, res, _next) => {
  if (res.headersSent) return res.destroy();
  if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 413, req.path === '/api/me/photo' ? 'Imagem acima de 2 MB.' : 'Vídeo acima de 100 MB.');
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Requisição inválida.');
  if (err.type === 'entity.too.large') return fail(res, 413, 'Conteúdo grande demais.');
  console.error(err);
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'].includes(err.code)) {
    return fail(res, 503, 'Banco de dados indisponível. Verifique se o MySQL está ligado, se o banco foi criado (database/scoutplay.sql) e se a senha no arquivo .env está correta.');
  }
  fail(res, 500, 'Erro no servidor.');
});

app.listen(PORT, () => console.log(`ScoutPlay rodando em http://localhost:${PORT}`));
