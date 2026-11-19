const KEY = 'scoutplay-token';

export const getToken = () => localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
export const setToken = (token, remember) => {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(KEY, token);
};
export const clearToken = () => { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); };

export async function api(path, { json, body, headers = {}, ...opts } = {}) {
  const token = getToken();
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  let res;
  try { res = await fetch(`/api${path}`, { ...opts, headers: h, body }); }
  catch { throw new Error('Não foi possível conectar ao servidor.'); }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (!data) throw new Error('Servidor indisponível. Confirme que o backend (npm start) e o MySQL estão em execução.');
    throw new Error(data.error || 'Erro inesperado.');
  }
  return data ?? {};
}
