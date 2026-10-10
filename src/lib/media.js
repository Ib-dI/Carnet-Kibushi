import { supabase } from "./supabase.js";

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

// Les fichiers choisis (ex. .opus de WhatsApp) n'ont pas toujours de type MIME : on se rabat sur l'extension du nom.
const EXT_TYPES = { m4a: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/ogg", wav: "audio/wav", webm: "audio/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

function extFor(blob, fallback) {
  const t = blob.type || "";
  if (/webm/.test(t)) return "webm";
  if (/ogg|opus/.test(t)) return "ogg";
  if (/mp4|m4a|aac/.test(t)) return "m4a";
  if (/mpeg|mp3/.test(t)) return "mp3";
  if (/wav/.test(t)) return "wav";
  if (/png/.test(t)) return "png";
  if (/jpe?g/.test(t)) return "jpg";
  const fromName = (blob.name || "").split(".").pop().toLowerCase();
  if (EXT_TYPES[fromName]) return fromName === "opus" ? "ogg" : fromName === "jpeg" ? "jpg" : fromName;
  return fallback;
}

export async function uploadMedia(blob, kind /* "image" | "audio" */) {
  if (kind === "audio" && blob.size > 10 * 1024 * 1024) throw new Error("Vocal trop lourd (10 Mo max).");
  const ext = extFor(blob, kind === "image" ? "jpg" : "webm");
  const path = `${kind === "image" ? "images" : "audio"}/${crypto.randomUUID()}.${ext}`;
  const contentType = blob.type || EXT_TYPES[ext] || undefined;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
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

export async function removeMedia(...paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  list.forEach(p => cache.delete(p));
  try { await supabase.storage.from(BUCKET).remove(list); } catch (e) { console.warn("removeMedia", e); }
}
