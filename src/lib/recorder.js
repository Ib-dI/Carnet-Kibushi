// Enregistrement micro. Safari produit de l'audio/mp4, Chrome/Firefox du webm/opus.
export const MAX_SECONDS = 180;

export const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

export function pickMime() {
  const c = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
  return c.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

// Sous ce niveau (amplitude max, de 0 à 1), on considère que le micro n'a rien capté.
// Une app sans autorisation micro (macOS) reçoit souvent un flux de zéros, sans erreur.
export const SILENT_PEAK = 0.01;

// Mesure le niveau sonore du flux : level() = niveau actuel, peak = plus haut niveau entendu.
function levelMeter(stream) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  ctx.resume?.();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const meter = {
    peak: 0,
    level() {
      analyser.getFloatTimeDomainData(buf);
      let max = 0;
      for (const v of buf) max = Math.max(max, Math.abs(v));
      meter.peak = Math.max(meter.peak, max);
      return max;
    },
    close: () => ctx.close().catch(() => {}),
  };
  return meter;
}

// onTick(secondes, niveau de 0 à 1), appelé ~10 fois par seconde.
export async function startRecording(onTick) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mimeType = pickMime();
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const t0 = Date.now();
  const meter = levelMeter(stream);
  const timer = setInterval(() => onTick?.(Math.floor((Date.now() - t0) / 1000), meter ? meter.level() : 0), 100);
  const release = () => { clearInterval(timer); meter?.close(); stream.getTracks().forEach(t => t.stop()); };
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
    cancel: () => { rec.onstop = null; if (rec.state !== "inactive") rec.stop(); release(); },
    // Vrai si rien n'a été entendu (inconnu si le navigateur ne sait pas mesurer : on suppose que non).
    get silent() { return meter ? meter.peak < SILENT_PEAK : false; },
  };
}

// Barre de niveau : <span class="meter"><i></i></span> ; setMeter(el, niveau).
export const meterHTML = id => `<span class="meter" aria-hidden="true"><i id="${id}"></i></span>`;
export const setMeter = (el, level) => { if (el) el.style.width = `${Math.min(100, Math.round(Math.sqrt(level) * 140))}%`; };

export const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
