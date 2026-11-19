import { useEffect, useMemo, useRef, useState } from 'react';
import { AthleteCard, Avatar, Loading, Stat, athletePlace } from '../components';
import { api } from '../api';
import { timeAgo, useApi } from '../hooks';
import { useToast } from '../contexts/ToastContext';
import ProfilePage from './ProfilePage';
import AthleteHome from './AthleteHome';

const MAX_COMPARE = 3;
const dash = (v, suffix = '') => (v == null || v === '' ? '—' : `${v}${suffix}`);

function PageTitle({ eyebrow, title }) {
  return (
    <header className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
    </header>
  );
}

function Empty({ text, title = 'Nada por aqui ainda' }) {
  return (
    <div className="empty">
      <span>◌</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function EvaluationBox({ athleteId, initial, onSaved }) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(initial?.rating ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/athletes/${athleteId}/evaluation`, { method: 'PUT', json: { rating, note } });
      showToast('Avaliação salva.');
      onSaved();
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api(`/athletes/${athleteId}/evaluation`, { method: 'DELETE' });
      setRating('');
      setNote('');
      showToast('Avaliação removida.');
      onSaved();
    } catch (e) {
      showToast(e.message);
    }
  };

  return (
    <div className="detail-box eval-form">
      <h3>Sua avaliação</h3>
      <label>
        Nota (0 a 100)
        <input type="number" min="0" max="100" value={rating} onChange={(e) => setRating(e.target.value)} />
      </label>
      <label>
        Observações
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Pontos fortes, pontos a desenvolver, jogos observados..." />
      </label>
      <div className="eval-actions">
        {initial && <button type="button" className="text-btn" onClick={remove}>Remover</button>}
        <button type="button" className="primary" onClick={save} disabled={busy || rating === ''}>{busy ? 'Salvando...' : 'Salvar avaliação'}</button>
      </div>
    </div>
  );
}

function DetailView({ athleteId, onToggleSave, onBack }) {
  const { data, error, reload } = useApi(`/athletes/${athleteId}`);
  if (error) return <Empty title={error} text="" />;
  if (!data) return <Loading />;
  const { athlete, myEvaluation } = data;

  return (
    <>
      <header className="topbar">
        <button type="button" className="back" onClick={onBack}>
          ← Voltar
        </button>
        <Avatar user={athlete} />
      </header>

      <section className="profile-card">
        <Avatar user={athlete} className="profile-avatar" />
        <div>
          <p className="eyebrow">PERFIL DO ATLETA</p>
          <h1>{athlete.name}</h1>
          <p className="large-muted">{[athlete.position, athletePlace(athlete)].filter(Boolean).join(' · ') || 'Perfil ainda não preenchido'}</p>
          {athlete.bio && <p className="muted">{athlete.bio}</p>}
          <button type="button" className="primary" onClick={async () => { await onToggleSave(athlete.id); reload(); }}>
            {athlete.saved ? '★ Atleta salvo' : '☆ Salvar atleta'}
          </button>
        </div>

        <div className="profile-stats">
          <Stat label="Idade" value={dash(athlete.age)} />
          <Stat label="Altura" value={dash(athlete.height, 'cm')} />
          <Stat label={`Nota (${athlete.evaluations} aval.)`} value={dash(athlete.rating)} />
        </div>
      </section>

      <div className="detail-grid">
        <div className="detail-box">
          <h3>Informações esportivas</h3>
          <p><b>Posição</b> {dash(athlete.position)}</p>
          <p><b>Pé dominante</b> {dash(athlete.foot)}</p>
          <p><b>Categoria</b> {dash(athlete.category)}</p>
          <p><b>Peso</b> {dash(athlete.weight, ' kg')}</p>
          <p><b>Características</b> {dash(athlete.traits)}</p>
        </div>

        <div className="detail-box">
          <h3>Estatísticas da temporada</h3>
          <div className="stats">
            <Stat label="Jogos" value={athlete.stats.jogos} />
            <Stat label="Gols" value={athlete.stats.gols} />
            <Stat label="Assistências" value={athlete.stats.assistencias} />
          </div>
        </div>

        <EvaluationBox key={myEvaluation ? 'e' : 'n'} athleteId={athlete.id} initial={myEvaluation} onSaved={reload} />
      </div>
    </>
  );
}

const COMPARE_CRITERIA = [
  { label: 'Posição', value: (a) => dash(a.position) },
  { label: 'Idade', value: (a) => dash(a.age, ' anos') },
  { label: 'Altura', value: (a) => dash(a.height, ' cm') },
  { label: 'Clube', value: (a) => dash(a.club) },
  { label: 'Cidade', value: (a) => dash([a.city, a.state].filter(Boolean).join('/')) },
  { label: 'Pé dominante', value: (a) => dash(a.foot) },
  { label: 'Jogos / Gols / Assist.', value: (a) => `${a.stats.jogos} / ${a.stats.gols} / ${a.stats.assistencias}` },
  { label: 'Nota', value: (a) => dash(a.rating), highlightBest: true },
];

function CompareView({ compare, onRemove, onClear }) {
  if (!compare.length) {
    return (
      <>
        <PageTitle eyebrow="FERRAMENTA DE ANÁLISE" title="Comparar atletas" />
        <Empty text={`Vá até "Descobrir" e clique em "⇄ Comparar" em até ${MAX_COMPARE} atletas para vê-los lado a lado aqui.`} />
      </>
    );
  }

  const rated = compare.filter((a) => a.rating != null);
  const bestRating = rated.length ? Math.max(...rated.map((a) => a.rating)) : null;
  const columns = `minmax(160px, 200px) repeat(${compare.length}, minmax(160px, 1fr))`;

  return (
    <>
      <div className="section-heading">
        <PageTitle eyebrow="FERRAMENTA DE ANÁLISE" title="Comparar atletas" />
        <button type="button" className="text-btn" onClick={onClear}>✕ Limpar comparação</button>
      </div>

      <div className="compare-table-wrap">
        <div className="compare-table" style={{ gridTemplateColumns: columns }}>
          <div className="compare-cell compare-corner">Critério</div>
          {compare.map((athlete) => (
            <div className="compare-cell compare-head" key={athlete.id}>
              <button type="button" className="compare-remove" onClick={() => onRemove(athlete.id)} aria-label={`Remover ${athlete.name} da comparação`}>✕</button>
              <Avatar user={athlete} className="compare-avatar" />
              <b>{athlete.name}</b>
              <span className="compare-sub">{dash(athlete.club)}</span>
            </div>
          ))}

          {COMPARE_CRITERIA.map(({ label, value, highlightBest }) => (
            <div className="compare-row" key={label}>
              <div className="compare-cell compare-label">{label}</div>
              {compare.map((athlete) => {
                const isBest = highlightBest && rated.length > 1 && athlete.rating === bestRating;
                return (
                  <div className={isBest ? 'compare-cell compare-best' : 'compare-cell'} key={`${athlete.id}-${label}`}>
                    {value(athlete)}
                    {isBest && <span className="compare-best-tag">Melhor</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Dashboard() {
  const { data } = useApi('/me/stats');
  if (!data) return <Loading />;
  const max = Math.max(1, ...data.byPosition.map((p) => p.total));

  return (
    <div className="dashboard">
      <PageTitle eyebrow="VISÃO GERAL" title="Dashboard" />
      <div className="dashboard-cards">
        <div>
          <span>Atletas na shortlist</span>
          <strong>{data.saved}</strong>
          <small>{data.evaluations} avaliação(ões) feitas</small>
        </div>
        <div>
          <span>Perfis visualizados</span>
          <strong>{data.viewed30}</strong>
          <small>Últimos 30 dias</small>
        </div>
        <div>
          <span>Novos talentos</span>
          <strong>{data.newAthletes30}</strong>
          <small>{data.totalAthletes} atleta(s) na plataforma</small>
        </div>
      </div>

      <div className="chart-box">
        <div className="panel-heading">
          <h3>Atletas por posição</h3>
          <span>Base completa</span>
        </div>
        {data.byPosition.length ? data.byPosition.map((p) => (
          <div className="chart-row" key={p.position}>
            <span>{p.position}</span>
            <div className="bar"><i style={{ width: `${(p.total / max) * 100}%` }} /></div>
            <b>{p.total}</b>
          </div>
        )) : <p className="muted">Nenhum atleta cadastrado ainda.</p>}
      </div>
    </div>
  );
}

function NotesView({ onSelect }) {
  const { data, error } = useApi('/evaluations');
  return (
    <>
      <PageTitle eyebrow="SEU HISTÓRICO" title="Observações" />
      {error ? <Empty title={error} text="" /> : !data ? <Loading /> : data.evaluations.length ? (
        data.evaluations.map((e) => (
          <div className="note-item" key={e.athleteId}>
            <Avatar user={e} />
            <div>
              <b>{e.name}</b>
              <span className="muted"> · {[e.position, e.club, timeAgo(e.ago)].filter(Boolean).join(' · ')}</span>
              {e.note && <p>{e.note}</p>}
              <button type="button" className="text-btn" onClick={() => onSelect(e.athleteId)}>Ver perfil</button>
            </div>
            <strong className="rating">{e.rating}</strong>
          </div>
        ))
      ) : (
        <Empty text="Abra o perfil de um atleta em Descobrir e registre sua nota e observações." />
      )}
    </>
  );
}

export default function ScoutView({ page, setPage }) {
  const { showToast } = useToast();
  const { data, error, reload, setData } = useApi('/athletes');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [compareNotice, setCompareNotice] = useState('');
  const searchRef = useRef(null);
  const [position, setPosition] = useState('Todas');
  const athletes = data?.athletes || [];
  const positions = [...new Set(athletes.map((a) => a.position).filter(Boolean))].sort();

  useEffect(() => { setSelected(null); reload(); }, [page]);

  const filteredAthletes = useMemo(
    () =>
      athletes.filter(
        (a) =>
          (position === 'Todas' || a.position === position) &&
          `${a.name} ${a.position ?? ''} ${a.club ?? ''} ${a.city ?? ''}`.toLowerCase().includes(query.toLowerCase())
      ),
    [athletes, query, position]
  );

  const compareAthletes = compareIds.map((id) => athletes.find((a) => a.id === id)).filter(Boolean);

  const toggleSave = async (athleteId) => {
    try {
      const r = await api(`/athletes/${athleteId}/shortlist`, { method: 'POST' });
      setData((d) => ({ athletes: d.athletes.map((a) => (a.id === athleteId ? { ...a, saved: r.saved } : a)) }));
    } catch (e) {
      showToast(e.message);
    }
  };

  const toggleCompare = (athleteId) => {
    setCompareIds((current) => {
      if (current.includes(athleteId)) {
        setCompareNotice('');
        return current.filter((id) => id !== athleteId);
      }
      if (current.length >= MAX_COMPARE) {
        setCompareNotice(`Você pode comparar até ${MAX_COMPARE} atletas por vez.`);
        return current;
      }
      setCompareNotice('');
      return [...current, athleteId];
    });
  };

  const statusOf = (a) =>
    a.saved ? { label: 'Na shortlist', cls: 'st-gold' } : compareIds.includes(a.id) ? { label: 'Em observação', cls: 'st-green' } : null;

  const card = (athlete) => (
    <AthleteCard
      key={athlete.id}
      athlete={athlete}
      saved={athlete.saved}
      onSave={toggleSave}
      onSelect={setSelected}
      compareActive={compareIds.includes(athlete.id)}
      status={statusOf(athlete)}
      onCompare={toggleCompare}
    />
  );

  if (selected) {
    return <DetailView athleteId={selected} onToggleSave={toggleSave} onBack={() => { setSelected(null); reload(); }} />;
  }
  if (page === 'profile') return <ProfilePage role="scout" />;
  if (page === 'feed') return <AthleteHome viewOnly setPage={setPage} />;
  if (page === 'dashboard') return <Dashboard />;
  if (page === 'notes') return <NotesView onSelect={setSelected} />;
  if (error) return <Empty title={error} text="" />;
  if (!data) return <Loading />;

  if (page === 'compare') {
    return <CompareView compare={compareAthletes} onRemove={(id) => setCompareIds((c) => c.filter((x) => x !== id))} onClear={() => { setCompareIds([]); setCompareNotice(''); }} />;
  }

  if (page === 'saved') {
    const savedAthletes = athletes.filter((a) => a.saved);
    return (
      <>
        <PageTitle eyebrow="SUA LISTA" title="Atletas salvos" />
        <div className="cards-grid">
          {savedAthletes.length ? savedAthletes.map(card) : <Empty text="Salve atletas para montar sua shortlist e acompanhar perfis relevantes." />}
        </div>
      </>
    );
  }

  const rated = athletes.filter((a) => a.rating != null);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">DESCUBRA TALENTOS</p>
          <h1>Descobrir atletas</h1>
        </div>
        <div className="search">
          <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, posição ou clube" />
          <button type="button" onClick={() => (query ? setQuery('') : searchRef.current?.focus())} aria-label={query ? 'Limpar busca' : 'Focar busca'}>
            {query ? '✕' : '⌕'}
          </button>
        </div>
      </header>

      <div className="stat-cards">
        {[
          ['👥', 'Jogadores cadastrados', athletes.length],
          ['👁', 'Em comparação', compareIds.length],
          ['★', 'Na shortlist', athletes.filter((a) => a.saved).length],
          ['📊', 'Média de nota', rated.length ? Math.round(rated.reduce((s, a) => s + a.rating, 0) / rated.length) : '—'],
        ].map(([icon, label, value]) => (
          <div className="stat-card" key={label}>
            <i>{icon}</i>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <label>
          Posição
          <select value={position} onChange={(event) => setPosition(event.target.value)}>
            <option>Todas</option>
            {positions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        {(position !== 'Todas' || query) && (
          <button type="button" className="text-btn" onClick={() => { setPosition('Todas'); setQuery(''); }}>Limpar filtros</button>
        )}
        <span className="result-count">{filteredAthletes.length} jogador(es)</span>
      </div>

      {compareNotice && <p className="form-error">{compareNotice}</p>}

      <div className="cards-grid">
        {filteredAthletes.length ? filteredAthletes.map(card) : (
          <Empty text={athletes.length ? 'Nenhum atleta encontrado para sua busca atual.' : 'Ainda não há atletas cadastrados na plataforma.'} />
        )}
      </div>
    </>
  );
}
