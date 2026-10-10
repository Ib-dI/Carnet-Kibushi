import { supabase } from "./supabase.js";

// Affichage des Médias : redimensionnement avant envoi et URL signées (les écritures passent par le Carnet).
const BUCKET = "media";
const cache = new Map();

export function resizeImage(file, max = 1280, quality = 0.82) {
  return new Promise(res => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(u); res(b || file); }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(u); res(file); };
    img.src = u;
  });
}

// URL signée déjà connue (pour afficher sans clignotement au re-rendu).
export function cachedUrl(path) {
  const hit = path && cache.get(path);
  return hit && hit.exp > Date.now() ? hit.url : null;
}

export async function mediaUrl(path) {
  if (!path) return null;
  const hit = cachedUrl(path);
  if (hit) return hit;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}
