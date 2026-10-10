// Chemin et type MIME d'un Média dans le stockage.

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

// kind : "image" | "audio"
export function mediaTarget(blob, kind, id = crypto.randomUUID()) {
  const ext = extFor(blob, kind === "image" ? "jpg" : "webm");
  return { path: `${kind === "image" ? "images" : "audio"}/${id}.${ext}`, contentType: blob.type || EXT_TYPES[ext] || undefined };
}
