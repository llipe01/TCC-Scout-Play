import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmt, timeAgo, useApi } from '../hooks';
import { useFeed } from '../contexts/FeedContext';
import { useAuth } from '../contexts/AuthContext';
import { Avatar, Stat } from '../components';
import { useToast } from '../contexts/ToastContext';

const MEDIA_OPTIONS = ['🧤', '⚡', '🎯', '🔥', '🏃', '⚽', '🏆'];
const NOTIF_TEXT = {
  like: 'curtiu sua publicação',
  comment: 'comentou na sua publicação',
  follow: 'começou a seguir você',
  view: 'visualizou seu perfil',
  shortlist: 'adicionou você à shortlist',
  evaluation: 'avaliou seu perfil',
};

const postLink = (id) => `${window.location.origin}/#post-${id}`;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}

const MAX_VIDEO_MB = 100;

function VideoPicker({ video, onChange }) {
  const [err, setErr] = useState('');

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setErr('Selecione um arquivo de vídeo (MP4, MOV, WebM...).');
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setErr(`O vídeo deve ter no máximo ${MAX_VIDEO_MB} MB.`);
      return;
    }
    setErr('');
    if (video) URL.revokeObjectURL(video.url);
    onChange({ url: URL.createObjectURL(file), name: file.name, file });
  };

  const remove = () => {
    if (video) URL.revokeObjectURL(video.url);
    onChange(null);
  };

  return (
    <div className="video-picker">
      {video ? (
        <div className="video-preview">
          <video src={video.url} controls playsInline />
          <div className="video-meta">
            <span>🎬 {video.name}</span>
            <button type="button" className="text-btn" onClick={remove}>Remover vídeo</button>
          </div>
        </div>
      ) : (
        <label className="video-drop">
          <input type="file" accept="video/*" onChange={handleFile} hidden />
          <span>🎬</span>
          <b>Adicionar vídeo</b>
          <small>MP4, MOV ou WebM · até {MAX_VIDEO_MB} MB</small>
        </label>
      )}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

function StoryUploadModal({ onClose, onSubmit }) {
  const [video, setVideo] = useState(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!video) {
      setError('Escolha um vídeo para o seu story.');
      return;
    }
    onSubmit({ video, caption: caption.trim() });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Novo story</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <VideoPicker video={video} onChange={setVideo} />
        <label>
          Legenda (opcional)
          <input className="story-caption" value={caption} maxLength={60} onChange={(e) => setCaption(e.target.value)} placeholder="Ex.: Golaço no treino" />
        </label>

        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="text-btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary" onClick={submit}>Publicar story</button>
        </div>
      </div>
    </div>
  );
}

function StoryViewer({ story, canDelete, onDelete, onClose }) {
  const [busy, setBusy] = useState(false);
  const remove = () => {
    if (!window.confirm('Excluir este story? Essa ação não pode ser desfeita.')) return;
    setBusy(true);
    onDelete(story.id);
  };

  return (
    <div className="modal-overlay story-viewer" onClick={onClose}>
      <div className="story-frame" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        <video src={story.video.url} autoPlay controls playsInline />
        {story.caption && <p>{story.caption}</p>}
        {canDelete && (
          <button type="button" className="story-delete" onClick={remove} disabled={busy}>
            {busy ? 'Excluindo...' : '🗑 Excluir story'}
          </button>
        )}
      </div>
    </div>
  );
}

function NewPostModal({ onClose, onSubmit }) {
  const [text, setText] = useState('');
  const [media, setMedia] = useState(MEDIA_OPTIONS[0]);
  const [video, setVideo] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed && !video) {
      setError('Escreva algo ou adicione um vídeo antes de publicar.');
      return;
    }
    onSubmit({ text: trimmed, media, video });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Nova publicação</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <label>
          O que você quer compartilhar?
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Conte como foi seu treino, jogo ou conquista..."
            autoFocus
          />
        </label>

        <VideoPicker video={video} onChange={setVideo} />

        {!video && (
        <label>
          Ícone da publicação
          <div className="media-pick">
            {MEDIA_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                className={media === option ? 'chosen' : ''}
                onClick={() => setMedia(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="text-btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="primary" onClick={handleSubmit}>
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentsModal({ post, comments, onAddComment, onClose }) {
  const [text, setText] = useState('');

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setText('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') handleAdd();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>Comentários</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <p className="muted">{post.text}</p>

        <div className="comment-list">
          {comments.length ? (
            comments.map((comment) => (
              <div className="comment-item" key={comment.id}>
                <Avatar user={{ avatar: comment.avatar, photo: comment.photo, name: comment.author }} className="mini-avatar sm" />
                <div>
                  <b>{comment.author}</b>
                  {comment.text}
                </div>
              </div>
            ))
          ) : (
            <p className="comment-empty">Seja o primeiro a comentar nesta publicação.</p>
          )}
        </div>

        <div className="comment-form">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva um comentário..."
          />
          <button type="button" className="primary" onClick={handleAdd}>
            Comentar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AthleteHome({ setPage, viewOnly = false }) {
  const { posts, setPosts, stories, setStories, deleteStory, commentsMap, setCommentsMap } = useFeed();
  const [showComposer, setShowComposer] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openCommentsId, setOpenCommentsId] = useState(null);
  const { showToast } = useToast();
  const { user } = useAuth();
  const [followed, setFollowed] = useState([]);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [viewStory, setViewStory] = useState(null);
  const notifs = useApi('/notifications');
  const stats = useApi(viewOnly ? null : '/me/stats');
  const athletesApi = useApi('/athletes');
  const featured = (athletesApi.data?.athletes || [])
    .filter((a) => a.id !== user.id)
    .sort((a, b) => b.followers - a.followers || (b.rating ?? -1) - (a.rating ?? -1))
    .slice(0, 3);

  useEffect(() => {
    const t = setInterval(() => notifs.reload(), 30000);
    return () => clearInterval(t);
  }, [notifs.reload]);

  useEffect(() => {
    const m = /^#post-(\d+)$/.exec(window.location.hash);
    if (!m || !posts.length) return;
    document.getElementById(`post-${m[1]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    history.replaceState(null, '', window.location.pathname);
  }, [posts.length]);

  const openNotifications = () => {
    setOpenMenuId(null);
    setShowNotifications((current) => !current);
    if (notifs.data?.unread) {
      api('/notifications/read', { method: 'POST' }).then(() => notifs.reload()).catch(() => {});
    }
  };

  const toggleFollow = async (athleteId) => {
    try {
      const r = await api(`/athletes/${athleteId}/follow`, { method: 'POST' });
      athletesApi.setData((d) => ({ athletes: d.athletes.map((a) => (a.id === athleteId ? { ...a, following: r.following, followers: a.followers + (r.following ? 1 : -1) } : a)) }));
      stats.reload();
    } catch (e) {
      showToast(e.message);
    }
  };

  const toggleLike = (postId) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) return post;
        const wasLiked = post.liked;
        return { ...post, liked: !wasLiked, likes: post.likes + (wasLiked ? -1 : 1) };
      })
    );
  };

  const toggleSavePost = (postId) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === postId ? { ...post, saved: !post.saved } : post))
    );
  };

  const createPost = ({ text, media, video }) => {
    setPosts((currentPosts) => {
      const nextId = currentPosts.reduce((max, post) => Math.max(max, post.id), 0) + 1;
      const newPost = {
        id: nextId,
        text,
        media,
        video: video ? video.url : null,
        videoBlob: video ? video.file : null,
        likes: 0,
        comments: 0,
        liked: false,
        saved: false,
      };
      return [newPost, ...currentPosts];
    });
    setShowComposer(false);
    setTimeout(() => stats.reload(), 1500);
  };

  const deletePost = (postId) => {
    setPosts((currentPosts) => currentPosts.filter((post) => post.id !== postId));
    setOpenMenuId(null);
    showToast('Publicação excluída.');
  };

  const reportPost = (postId) => {
    setOpenMenuId(null);
    api(`/posts/${postId}/report`, { method: 'POST' })
      .then(() => showToast('Denúncia registrada. Obrigado por avisar.'))
      .catch((e) => showToast(e.message));
  };

  const copyPostLink = (postId) => {
    setOpenMenuId(null);
    const link = postLink(postId);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(link)
        .then(() => showToast('Link da publicação copiado!'))
        .catch(() => showToast('Não foi possível copiar o link.'));
    } else {
      showToast('Não foi possível copiar o link.');
    }
  };

  const sharePost = (postId) => {
    const link = postLink(postId);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(link)
        .then(() => showToast('Link copiado! Cole onde quiser compartilhar.'))
        .catch(() => showToast('Não foi possível copiar o link.'));
    } else {
      showToast('Não foi possível copiar o link.');
    }
  };

  const addComment = (postId, text) => {
    setCommentsMap((current) => {
      const existing = current[postId] ?? [];
      const nextId = existing.reduce((max, comment) => Math.max(max, comment.id), 0) + 1;
      return { ...current, [postId]: [...existing, { id: nextId, author: 'Você', avatar: user.avatar, photo: user.photo, text }] };
    });
    setPosts((currentPosts) =>
      currentPosts.map((post) => (post.id === postId ? { ...post, comments: post.comments + 1 } : post))
    );
  };

  const openPost = openCommentsId != null ? posts.find((post) => post.id === openCommentsId) : null;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{todayLabel()}</p>
          <h1>{viewOnly ? 'Feed da comunidade' : `${greeting()}, ${user.name.split(' ')[0]}.`}</h1>
        </div>

        <div className="dropdown-wrap">
          <button
            type="button"
            className="icon-button"
            onClick={openNotifications}
            aria-label="Notificações"
          >
            ♡{notifs.data?.unread > 0 && <span className="badge" />}
          </button>

          {showNotifications && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                onClick={() => setShowNotifications(false)}
              />
              <div className="notif-panel">
                {notifs.data?.items?.length ? (
                  notifs.data.items.map((item) => (
                    <div className="notif-item" key={item.id}>
                      <Avatar user={{ avatar: item.actorAvatar, photo: item.actorPhoto, name: item.actor }} className="mini-avatar sm" />
                      <div>
                        <b>{item.actor} {item.actorRole === 'scout' && item.type === 'view' ? '(olheiro) ' : ''}{NOTIF_TEXT[item.type]}</b>
                        <span className="muted">{timeAgo(item.ago)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="notif-empty">Nenhuma notificação por enquanto.</div>
                )}
              </div>
            </>
          )}
        </div>

        <Avatar user={user} />
      </header>

      <div className="content-grid">
        <section>
          <div className="stories">
            {!viewOnly && (
              <button type="button" className="story" onClick={() => setShowStoryModal(true)}>
                <span className="ring add">＋</span>Seu story
              </button>
            )}
            {stories.map((s) => (
              <button type="button" className="story" key={s.id} onClick={() => setViewStory(s)}>
                <span className={s.authorPhoto ? 'ring has-photo' : 'ring'}>
                  {s.authorPhoto ? <img src={s.authorPhoto} alt="" /> : '🎬'}
                </span>{s.caption || s.author?.split(' ')[0] || 'Story'}
              </button>
            ))}
          </div>

          <div className="section-heading">
            <div>
              <p className="eyebrow">SUA COMUNIDADE</p>
              <h2>Feed de performance</h2>
            </div>
            {!viewOnly && (
              <button type="button" className="primary" onClick={() => setShowComposer(true)}>
                ＋ Nova publicação
              </button>
            )}
          </div>

          {posts.map((post) => {
            const a = post.author || {};
            const athlete = {
              name: a.name,
              avatar: a.avatar,
              photo: a.photo,
              position: a.role === 'scout' ? 'Olheiro' : a.position || 'Atleta',
              club: a.club,
            };
            const isOwnPost = a.id === user.id;

            return (
              <article className="post" key={post.id} id={`post-${post.id}`}>
                <div className="post-head">
                  <Avatar user={athlete} />
                  <div>
                    <b>{athlete.name}</b>
                    <span>
                      {[athlete.position, athlete.club, timeAgo(post.ago)].filter(Boolean).join(' · ')}
                    </span>
                  </div>

                  <div className="dropdown-wrap">
                    <button
                      type="button"
                      className="dots"
                      onClick={() => {
                        setShowNotifications(false);
                        setOpenMenuId((current) => (current === post.id ? null : post.id));
                      }}
                    >
                      •••
                    </button>

                    {openMenuId === post.id && (
                      <>
                        <div
                          style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="dropdown-menu">
                          <button type="button" onClick={() => copyPostLink(post.id)}>
                            Copiar link
                          </button>
                          {isOwnPost ? (
                            <button type="button" className="danger" onClick={() => deletePost(post.id)}>
                              Excluir publicação
                            </button>
                          ) : (
                            <button type="button" className="danger" onClick={() => reportPost(post.id)}>
                              Denunciar publicação
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <p>{post.text}</p>
                {post.video ? (
                  <div className="media has-video">
                    <video src={post.video} controls playsInline />
                  </div>
                ) : (
                  <div className="media">{post.media}</div>
                )}

                <div className="post-actions">
                  <button
                    type="button"
                    onClick={() => toggleLike(post.id)}
                    className={post.liked ? 'heart liked' : 'heart'}
                  >
                    ♥ {post.likes}
                  </button>
                  <button type="button" onClick={() => setOpenCommentsId(post.id)}>
                    ◯ {post.comments}
                  </button>
                  <button type="button" onClick={() => sharePost(post.id)}>
                    ♧ Compartilhar
                  </button>
                  <button
                    type="button"
                    className={post.saved ? 'saved-active' : ''}
                    onClick={() => toggleSavePost(post.id)}
                  >
                    {post.saved ? '✔🔖' : '🔖'}
                  </button>
                </div>
              </article>
            );
          })}

          {!posts.length && (
            <div className="empty">
              <span>◌</span>
              <h3>Nenhuma publicação ainda</h3>
              <p>Clique em "Nova publicação" para compartilhar sua primeira novidade.</p>
            </div>
          )}
        </section>

        <aside className="side-panel">
          {!viewOnly && (
            <>
              <div className="panel-heading">
                <h3>Seu desempenho</h3>
                <span>Últimos 30 dias</span>
              </div>

              <div className="stats">
                <Stat label="Visualizações" value={fmt(stats.data?.views30)} />
                <Stat label="Seguidores" value={fmt(stats.data?.followers)} />
                <Stat label="Publicações" value={fmt(stats.data?.posts)} />
              </div>

              {stats.data && stats.data.completeness < 100 && (
                <div className="progress">
                  <div className="panel-heading">
                    <b>Perfil completo</b>
                    <b>{stats.data.completeness}%</b>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${stats.data.completeness}%` }} />
                  </div>
                  <p className="muted">Olheiros encontram com mais facilidade perfis com posição, clube e dados físicos preenchidos.</p>
                  <button type="button" className="text-btn" onClick={() => setPage('profile')}>
                    Completar perfil →
                  </button>
                </div>
              )}
            </>
          )}

          <div className="widget">
            <div className="panel-heading">
              <h3>Atletas em destaque</h3>
            </div>
            {featured.length ? featured.map((a) => (
              <div className="feat-row" key={a.id}>
                <Avatar user={a} />
                <div>
                  <b>{a.name}</b>
                  <span>{[a.position, a.club].filter(Boolean).join(' · ') || `${a.followers} seguidor(es)`}</span>
                </div>
                <button
                  type="button"
                  className={a.following ? 'follow on' : 'follow'}
                  onClick={() => toggleFollow(a.id)}
                >
                  {a.following ? 'Seguindo' : 'Seguir'}
                </button>
              </div>
            )) : (
              <p className="muted">Quando outros atletas se cadastrarem, eles aparecem aqui.</p>
            )}
          </div>
        </aside>
      </div>

      {showComposer && (
        <NewPostModal onClose={() => setShowComposer(false)} onSubmit={createPost} />
      )}

      {showStoryModal && (
        <StoryUploadModal
          onClose={() => setShowStoryModal(false)}
          onSubmit={({ video, caption }) => {
            setStories((c) => [{ id: Date.now(), video, caption }, ...c]);
            setShowStoryModal(false);
          }}
        />
      )}

      {viewStory && (
        <StoryViewer
          story={viewStory}
          canDelete={viewStory.authorId === user.id}
          onDelete={(id) => { deleteStory(id); setViewStory(null); }}
          onClose={() => setViewStory(null)}
        />
      )}

      {openPost && (
        <CommentsModal
          post={openPost}
          comments={commentsMap[openPost.id] ?? []}
          onAddComment={(text) => addComment(openPost.id, text)}
          onClose={() => setOpenCommentsId(null)}
        />
      )}
    </>
  );
}
