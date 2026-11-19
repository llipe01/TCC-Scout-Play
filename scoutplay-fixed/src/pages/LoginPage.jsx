import { useState } from 'react';
import { Logo, ThemeToggle } from '../components';
import { useAuth } from '../contexts/AuthContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('athlete');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  async function handleSubmit() {
    const trimmedEmail = email.trim();

    if (mode === 'register' && !name.trim()) {
      setError('Informe seu nome.');
      return;
    }

    if (!trimmedEmail || !password) {
      setError('Preencha e-mail e senha para continuar.');
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Informe um e-mail válido.');
      return;
    }

    setError('');
    setBusy(true);
    try {
      if (mode === 'register') await register(name.trim(), trimmedEmail, password, role, remember);
      else await login(trimmedEmail, password, remember);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  }

  return (
    <main className="lg">
      <ThemeToggle className="floating-theme" />
      <section className="lg-left">
        <Logo />
        <div>
          <h1>Encontre o próximo <em>talento</em></h1>
          <p>Atletas mostram seu jogo. Olheiros encontram, avaliam e acompanham os talentos que importam.</p>
        </div>
      </section>

      <section className="lg-right">
        <div className="lg-card">
          <h2>{mode === 'register' ? 'Crie sua conta' : 'Bem-vindo de volta!'}</h2>
          <p className="muted">{mode === 'register' ? 'Escolha seu perfil e comece agora.' : 'Entre na sua conta para continuar.'}</p>

          {mode === 'register' && (
            <label>
              Nome completo
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Seu nome" type="text" />
            </label>
          )}
          <label>
            E-mail
            <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="seu.email@clube.com" type="email" />
          </label>
          <label>
            Senha
            <span className="lg-pass">
              <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" type={showPass ? 'text' : 'password'} />
              <button type="button" onClick={() => setShowPass((v) => !v)} aria-label="Mostrar senha">{showPass ? '🙈' : '👁'}</button>
            </span>
          </label>

          <div className="lg-row">
            <label className="lg-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Lembrar de mim</label>
          </div>

          {mode === 'register' && (
          <div className="lg-roles">
            <button type="button" className={role === 'athlete' ? 'on' : ''} onClick={() => setRole('athlete')}>⚽ Sou Atleta</button>
            <button type="button" className={role === 'scout' ? 'on' : ''} onClick={() => setRole('scout')}>⌕ Sou Olheiro</button>
          </div>
          )}

          {error && <p className="lg-error">{error}</p>}

          <button type="button" className="lg-submit" onClick={handleSubmit} disabled={busy}>{busy ? 'Aguarde...' : mode === 'register' ? 'Criar conta' : 'Entrar na Plataforma'}</button>

          <p className="lg-foot">
            {mode === 'register' ? 'Já possui uma conta?' : 'Ainda não possui uma conta?'}{' '}
            <button type="button" className="lg-link" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Entrar' : 'Criar conta'}</button>
          </p>
        </div>
      </section>
    </main>
  );
}
