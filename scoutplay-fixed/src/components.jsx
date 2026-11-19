import { useState } from 'react';
import { useTheme } from './contexts/ThemeContext';

export function Logo() { return <div className="logo"><span>◈</span> Scout<span>Play</span></div>; }

const Svg = ({ children }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const SunIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);
const MoonIcon = () => (
  <Svg><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Svg>
);
const HideNavIcon = () => (
  <Svg><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path d="M16 10l-2 2 2 2" /></Svg>
);
const ShowNavIcon = () => (
  <Svg><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path d="M14 10l2 2-2 2" /></Svg>
);

export function getLinks(role) {
  return role === 'athlete'
    ? [['home', '⌂', 'Início'], ['explore', '⌕', 'Explorar'], ['profile', '◉', 'Perfil']]
    : [['dashboard', '▦', 'Dashboard'], ['feed', '▶', 'Feed'], ['discover', '⌕', 'Descobrir'], ['saved', '★', 'Salvos'], ['compare', '⇄', 'Comparar'], ['notes', '▤', 'Observações'], ['profile', '◉', 'Perfil']];
}

/* Botão de alternância claro/escuro. variant="full" mostra ícone + texto; "icon" só o ícone. */
export function ThemeToggle({ variant = 'icon', className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Modo claro' : 'Modo escuro';
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      title={`Ativar ${label.toLowerCase()}`}
      aria-label={`Ativar ${label.toLowerCase()}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      {variant === 'full' && <span>{label}</span>}
    </button>
  );
}

export function Nav({ role, page, setPage, logout }) {
  const { toggleNav } = useTheme();
  const links = getLinks(role);

  return (
    <aside className="nav">
      <Logo />
      <div className="role">{role === 'athlete' ? 'ÁREA DO ATLETA' : 'ÁREA DO OLHEIRO'}</div>
      <nav>
        {links.map(([id, icon, label]) => (
          <button className={page === id ? 'active' : ''} onClick={() => setPage(id)} key={id}>
            <b>{icon}</b>{label}
          </button>
        ))}
      </nav>
      <div className="nav-tools">
        <ThemeToggle variant="full" />
        <button type="button" onClick={toggleNav} title="Ocultar menu" aria-label="Ocultar menu">
          <HideNavIcon /><span>Ocultar menu</span>
        </button>
      </div>
      <button className="logout" onClick={logout}>↪ Sair</button>
    </aside>
  );
}

/* Barra flutuante (canto inferior, centralizada) exibida quando o menu lateral está oculto. */
export function NavDock({ role, page, setPage }) {
  const { toggleNav } = useTheme();
  const links = getLinks(role);

  return (
    <div className="nav-dock" role="navigation" aria-label="Menu rápido">
      {links.map(([id, icon, label]) => (
        <button
          type="button"
          key={id}
          className={`dock-btn ${page === id ? 'active' : ''}`.trim()}
          onClick={() => setPage(id)}
          title={label}
          aria-label={label}
          aria-current={page === id ? 'page' : undefined}
        >
          <b>{icon}</b>
        </button>
      ))}
      <span className="dock-sep" aria-hidden="true" />
      <ThemeToggle className="dock-btn" />
      <button type="button" className="dock-btn" onClick={toggleNav} title="Mostrar menu" aria-label="Mostrar menu">
        <ShowNavIcon />
      </button>
    </div>
  );
}

/* Mostra a foto de perfil quando existir; senão, o emoji do avatar. Aceita qualquer objeto com { avatar, photo, name }. */
export function Avatar({ user, className = 'mini-avatar' }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const photo = user?.photo && user.photo !== failedSrc ? user.photo : null;
  return (
    <div className={photo ? `${className} has-photo` : className}>
      {photo
        ? <img src={photo} alt={user.name ? `Foto de ${user.name}` : 'Foto de perfil'} loading="lazy" onError={() => setFailedSrc(photo)} />
        : user?.avatar}
    </div>
  );
}

export const athleteLine = (a) => [a.position || 'Posição não informada', a.age != null ? `${a.age} anos` : null].filter(Boolean).join(' · ');
export const athletePlace = (a) => [a.club, a.city && a.state ? `${a.city}/${a.state}` : a.city || a.state].filter(Boolean).join(' · ');

export function AthleteCard({ athlete, saved, onSave, onSelect, compareActive, onCompare, status, saveLabels = ['☆ Salvar', '★ Salvo'] }) {
  return (
    <article className="athlete-card">
      <Avatar user={athlete} className="avatar" />
      <div className="card-body">
        <div className="card-top">
          <div>
            <h3>{athlete.name}</h3>
            <p>{athleteLine(athlete)}</p>
          </div>
          <strong className="rating" title={athlete.evaluations ? `${athlete.evaluations} avaliação(ões)` : 'Sem avaliações'}>
            {athlete.rating ?? '—'}
          </strong>
        </div>
        {athletePlace(athlete) && <p className="muted">{athletePlace(athlete)}</p>}
        {athlete.traits && <p className="traits">{athlete.traits}</p>}
        {status && <span className={`status-pill ${status.cls}`}>● {status.label}</span>}
        <div className="card-actions">
          {onSelect ? (
            <button className="text-btn" onClick={() => onSelect(athlete.id)}>Ver perfil</button>
          ) : (
            <span />
          )}
          <div className="card-actions-right">
            {onCompare && (
              <button
                type="button"
                className={compareActive ? 'saved-btn' : 'outline-btn'}
                onClick={() => onCompare(athlete.id)}
              >
                {compareActive ? '✓ Comparando' : '⇄ Comparar'}
              </button>
            )}
            {onSave && (
              <button
                type="button"
                className={saved ? 'saved-btn' : 'outline-btn'}
                onClick={() => onSave(athlete.id)}
              >
                {saved ? saveLabels[1] : saveLabels[0]}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function Loading() {
  return <div className="empty"><span>◌</span><h3>Carregando...</h3></div>;
}
