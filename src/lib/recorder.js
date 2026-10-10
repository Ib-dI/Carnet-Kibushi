// Enregistrement micro. Safari produit de l'audio/mp4, Chrome/Firefox du webm/opus.
export const MAX_SECONDS = 180;

export const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export function pickMime() {
  const c = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
  return c.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

export async function startRecording(onTick) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mimeType = pickMime();
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const t0 = Date.now();
  const timer = setInterval(() => onTick?.(Math.floor((Date.now() - t0) / 1000)), 250);
  const release = () => { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); };
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () => new Promise(res => {
      rec.onstop = () => {
        release();
        res(new Blob(chunks, { type: (rec.mimeType || mimeType || "audio/webm").split(";")[0] }));
      };
      if (rec.state === "inactive") rec.onstop(); else rec.stop();
    }),
    cancel: () => { rec.onstop = null; if (rec.state !== "inactive") rec.stop(); release(); }
  };
}

export const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
