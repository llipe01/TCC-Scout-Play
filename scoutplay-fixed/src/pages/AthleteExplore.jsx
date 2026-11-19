import { useMemo, useRef, useState } from 'react';
import { AthleteCard, Loading } from '../components';
import { api } from '../api';
import { useApi } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function AthleteExplore() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data, error, setData } = useApi('/athletes');
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  const filteredAthletes = useMemo(
    () =>
      (data?.athletes || []).filter(
        (a) =>
          a.id !== user.id &&
          `${a.name} ${a.position ?? ''} ${a.club ?? ''} ${a.city ?? ''}`.toLowerCase().includes(query.toLowerCase())
      ),
    [data, query, user.id]
  );

  const toggleFollow = async (athleteId) => {
    try {
      const r = await api(`/athletes/${athleteId}/follow`, { method: 'POST' });
      setData((d) => ({ athletes: d.athletes.map((a) => (a.id === athleteId ? { ...a, following: r.following, followers: a.followers + (r.following ? 1 : -1) } : a)) }));
    } catch (e) {
      showToast(e.message);
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">CONHEÇA OUTROS TALENTOS</p>
          <h1>Explorar atletas</h1>
        </div>
        <div className="search">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, posição ou clube"
          />
          <button
            type="button"
            onClick={() => (query ? setQuery('') : searchRef.current?.focus())}
            aria-label={query ? 'Limpar busca' : 'Focar busca'}
          >
            {query ? '✕' : '⌕'}
          </button>
        </div>
      </header>

      {error ? (
        <div className="empty"><span>◌</span><h3>{error}</h3></div>
      ) : !data ? (
        <Loading />
      ) : (
        <div className="cards-grid">
          {filteredAthletes.length ? (
            filteredAthletes.map((athlete) => (
              <AthleteCard
                key={athlete.id}
                athlete={athlete}
                saved={athlete.following}
                onSave={toggleFollow}
                saveLabels={['＋ Seguir', '✓ Seguindo']}
              />
            ))
          ) : (
            <div className="empty">
              <span>◌</span>
              <h3>Nenhum atleta encontrado</h3>
              <p>{query ? 'Tente buscar por outro nome, posição ou clube.' : 'Ainda não há outros atletas cadastrados.'}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
