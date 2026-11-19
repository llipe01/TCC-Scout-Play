import { useEffect, useState } from 'react';
import { Avatar, Loading, Stat } from '../components';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useFeed } from '../contexts/FeedContext';
import { api } from '../api';
import { AVATARS, POSITIONS, fmt, resizeImage, useApi } from '../hooks';

const toDraft = (user, p = {}) => ({
  name: user.name || '', avatar: user.avatar || '', city: user.city || '', state: user.state || '',
  position: p.position || '', birthDate: p.birthDate || '', club: p.club || '', category: p.category || '', foot: p.foot || '',
  height: p.height ?? '', weight: p.weight ?? '', traits: p.traits || '', bio: p.bio || '',
  games: p.games ?? 0, goals: p.goals ?? 0, assists: p.assists ?? 0,
  organization: p.organization || '', experienceYears: p.experienceYears ?? '',
});

function Field({ label, children }) {
  return <label>{label}{children}</label>;
}

export default function ProfilePage({ role }) {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const feed = useFeed();
  const me = useApi('/me');
  const stats = useApi('/me/stats');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const isScout = role === 'scout';

  useEffect(() => { if (me.data) setDraft(toDraft(me.data.user, me.data.profile)); }, [me.data]);

  if (me.error) return <div className="empty"><span>◌</span><h3>{me.error}</h3></div>;
  if (!me.data || !draft) return <Loading />;

  const p = me.data.profile;
  const u = me.data.user;
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const place = [u.city, u.state].filter(Boolean).join(', ');
  const subtitle = isScout
    ? [p.organization, place].filter(Boolean).join(' · ')
    : [p.position, p.club, place].filter(Boolean).join(' · ');

  const save = async () => {
    if (!draft.name.trim()) return showToast('O nome não pode ficar em branco.');
    setBusy(true);
    try {
      const d = await api('/me', { method: 'PUT', json: draft });
      me.setData(d);
      setUser(d.user);
      stats.reload();
      setEditing(false);
      showToast('Perfil atualizado!');
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  // A foto é enviada na hora (independe do botão "Salvar alterações")
  const changePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const blob = await resizeImage(file);
      const body = new FormData();
      body.append('photo', blob, 'perfil.jpg');
      const d = await api('/me/photo', { method: 'POST', body });
      setUser(d.user);
      feed.reload();
      showToast('Foto de perfil atualizada!');
    } catch (e) {
      showToast(e.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      const d = await api('/me/photo', { method: 'DELETE' });
      setUser(d.user);
      feed.reload();
      showToast('Foto removida.');
    } catch (e) {
      showToast(e.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const s = stats.data || {};
  const statList = isScout
    ? [['Atletas salvos', s.saved], ['Avaliações feitas', s.evaluations], ['Anos de experiência', p.experienceYears ?? '—']]
    : [['Seguidores', fmt(s.followers)], ['Seguindo', fmt(s.following)], ['Publicações', fmt(s.posts)]];

  return (
    <>
      <header className="page-title">
        <p className="eyebrow">SUA IDENTIDADE ESPORTIVA</p>
        <h1>Meu perfil</h1>
      </header>

      <section className="profile-card">
        <div className="profile-photo">
          <Avatar user={{ avatar: u.avatar, photo: user.photo, name: u.name }} className="profile-avatar" />
          <label className={`photo-edit${photoBusy ? ' busy' : ''}`} title="Alterar foto de perfil">
            <span aria-hidden="true">📷</span>
            <span className="sr-only">Alterar foto de perfil</span>
            <input type="file" accept="image/*" onChange={changePhoto} disabled={photoBusy} hidden />
          </label>
          {user.photo && (
            <button type="button" className="text-btn photo-remove" onClick={removePhoto} disabled={photoBusy}>Remover foto</button>
          )}
        </div>

        {editing ? (
          <div>
            <p className="eyebrow">{isScout ? 'OLHEIRO' : 'ATLETA'}</p>
            <div className="profile-edit-form">
              <Field label="Avatar (usado quando não há foto)">
                <div className="media-pick">
                  {AVATARS.map((a) => (
                    <button type="button" key={a} className={draft.avatar === a ? 'chosen' : ''} onClick={() => setDraft((d) => ({ ...d, avatar: a }))}>{a}</button>
                  ))}
                </div>
              </Field>
              <div className="form-grid">
                <Field label="Nome"><input value={draft.name} onChange={set('name')} maxLength={120} /></Field>
                <Field label="Cidade"><input value={draft.city} onChange={set('city')} maxLength={80} /></Field>
                <Field label="UF"><input value={draft.state} onChange={set('state')} maxLength={2} placeholder="SP" /></Field>
                {isScout ? (
                  <>
                    <Field label="Clube / organização"><input value={draft.organization} onChange={set('organization')} maxLength={120} /></Field>
                    <Field label="Anos de experiência"><input type="number" min="0" max="80" value={draft.experienceYears} onChange={set('experienceYears')} /></Field>
                  </>
                ) : (
                  <>
                    <Field label="Posição">
                      <select value={draft.position} onChange={set('position')}>
                        <option value="">Selecione</option>
                        {POSITIONS.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </Field>
                    <Field label="Data de nascimento"><input type="date" value={draft.birthDate} onChange={set('birthDate')} /></Field>
                    <Field label="Clube"><input value={draft.club} onChange={set('club')} maxLength={120} /></Field>
                    <Field label="Categoria"><input value={draft.category} onChange={set('category')} maxLength={40} placeholder="Ex.: Sub-20" /></Field>
                    <Field label="Pé dominante">
                      <select value={draft.foot} onChange={set('foot')}>
                        <option value="">Selecione</option>
                        {['Direito', 'Esquerdo', 'Ambidestro'].map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </Field>
                    <Field label="Altura (cm)"><input type="number" min="100" max="230" value={draft.height} onChange={set('height')} /></Field>
                    <Field label="Peso (kg)"><input type="number" min="30" max="200" value={draft.weight} onChange={set('weight')} /></Field>
                    <Field label="Jogos na temporada"><input type="number" min="0" value={draft.games} onChange={set('games')} /></Field>
                    <Field label="Gols"><input type="number" min="0" value={draft.goals} onChange={set('goals')} /></Field>
                    <Field label="Assistências"><input type="number" min="0" value={draft.assists} onChange={set('assists')} /></Field>
                  </>
                )}
              </div>
              {!isScout && <Field label="Características"><input value={draft.traits} onChange={set('traits')} maxLength={255} placeholder="Ex.: Visão de jogo e passe vertical" /></Field>}
              <Field label="Sobre você"><textarea value={draft.bio} onChange={set('bio')} maxLength={2000} rows={3} /></Field>
            </div>
            <div className="profile-edit-actions">
              <button type="button" className="text-btn" onClick={() => { setDraft(toDraft(u, p)); setEditing(false); }}>Cancelar</button>
              <button type="button" className="primary" onClick={save} disabled={busy}>{busy ? 'Salvando...' : 'Salvar alterações'}</button>
            </div>
          </div>
        ) : (
          <div>
            <p className="eyebrow">{isScout ? 'OLHEIRO' : 'ATLETA'}</p>
            <h1>{u.name}</h1>
            <p className="large-muted">{subtitle || u.email}</p>
            {p.bio && <p className="muted">{p.bio}</p>}
            <button type="button" className="primary" onClick={() => setEditing(true)}>Editar perfil</button>
          </div>
        )}

        <div className="profile-stats">
          {statList.map(([label, value]) => <Stat key={label} label={label} value={value ?? 0} />)}
        </div>
      </section>
    </>
  );
}
