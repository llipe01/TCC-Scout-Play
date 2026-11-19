import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    if (!path) return Promise.resolve();
    return api(path).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload, setData };
}

export function timeAgo(seconds) {
  const s = Number(seconds) || 0;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

export const POSITIONS = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante', 'Fixo', 'Ala', 'Pivô'];
export const AVATARS = ['⚽', '🧤', '🛡️', '⚡', '🎯', '🔥', '🏃', '🏆', '🔍', '📋'];
export const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n ?? 0));

/* Recorta a imagem no centro (quadrada), reduz para `size` px e devolve um JPEG leve. */
export function resizeImage(file, size = 512) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return reject(new Error('Selecione uma imagem (JPG, PNG, WebP ou GIF).'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('A imagem deve ter no máximo 15 MB.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const out = Math.min(size, side);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = out;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // PNG com transparência vira fundo branco no JPEG
      ctx.fillRect(0, 0, out, out);
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem.'))), 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler essa imagem. Tente JPG ou PNG.')); };
    img.src = url;
  });
}
