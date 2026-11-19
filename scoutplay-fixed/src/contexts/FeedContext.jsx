import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const FeedContext = createContext(null);

export function FeedProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPostsState] = useState([]);
  const [stories, setStoriesState] = useState([]);
  const [commentsMap, setCommentsState] = useState({});
  const cur = useRef({});
  cur.current = { posts, commentsMap, stories };

  const load = useCallback(async () => {
    try {
      const d = await api('/feed');
      setPostsState(d.posts);
      setStoriesState(d.stories.map((s) => ({ id: s.id, caption: s.caption, author: s.author, authorId: s.authorId, authorPhoto: s.authorPhoto, video: { url: s.url, name: s.name } })));
      setCommentsState(d.comments);
    } catch { /* tenta de novo no próximo ciclo */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 8000); // atualiza o feed com o que outras contas postaram
    return () => clearInterval(t);
  }, [user, load]);

  const run = async (fn) => {
    try { await fn(); await load(); } catch (e) { showToast(e.message); load(); }
  };

  const form = (fields, file) => {
    const f = new FormData();
    Object.entries(fields).forEach(([k, v]) => f.append(k, v ?? ''));
    if (file) f.append('video', file);
    return f;
  };

  const setPosts = (u) => {
    const prev = cur.current.posts;
    const next = typeof u === 'function' ? u(prev) : u;
    setPostsState(next.filter((p) => prev.some((x) => x.id === p.id)));
    next.forEach((p) => {
      const old = prev.find((x) => x.id === p.id);
      if (!old) {
        if (p.videoBlob) showToast('Enviando vídeo...');
        run(async () => { await api('/posts', { method: 'POST', body: form({ text: p.text, media: p.media }, p.videoBlob) }); showToast('Publicado para todas as contas!'); });
      } else if (old.liked !== p.liked) run(() => api(`/posts/${p.id}/like`, { method: 'POST' }));
      else if (old.saved !== p.saved) run(() => api(`/posts/${p.id}/save`, { method: 'POST' }));
    });
    prev.filter((p) => !next.some((x) => x.id === p.id)).forEach((p) => run(() => api(`/posts/${p.id}`, { method: 'DELETE' })));
  };

  const setStories = (u) => {
    const prev = cur.current.stories;
    const next = typeof u === 'function' ? u(prev) : u;
    next.filter((s) => !prev.some((x) => x.id === s.id)).forEach((s) => {
      showToast('Enviando story...');
      run(async () => { await api('/stories', { method: 'POST', body: form({ caption: s.caption }, s.video.file) }); showToast('Story publicado!'); });
    });
  };

  const deleteStory = (id) => {
    setStoriesState((prev) => prev.filter((s) => s.id !== id));
    run(async () => { await api(`/stories/${id}`, { method: 'DELETE' }); showToast('Story excluído.'); });
  };

  const setCommentsMap = (u) => {
    const prev = cur.current.commentsMap;
    const next = typeof u === 'function' ? u(prev) : u;
    Object.keys(next).forEach((id) => {
      if (next[id] !== prev[id]) {
        const last = next[id][next[id].length - 1];
        run(() => api(`/posts/${id}/comments`, { method: 'POST', json: { text: last.text } }));
      }
    });
  };

  return (
    <FeedContext.Provider value={{ posts, setPosts, stories, setStories, deleteStory, commentsMap, setCommentsMap, reload: load }}>
      {children}
    </FeedContext.Provider>
  );
}

export const useFeed = () => useContext(FeedContext);
