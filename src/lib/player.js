import { mediaUrl } from "./media.js";

// Un seul lecteur partagé pour toute l'application.
const player = new Audio();
let playingBtn = null;
let playingKey = null;

const reset = () => { playingBtn?.classList.remove("on"); playingBtn = null; playingKey = null; };
player.addEventListener("ended", reset);

export async function playPath(path, btn, key = path) {
  const again = playingKey === key;
  player.pause(); reset();
  if (again) return; // recliquer sur ▶ met en pause
  btn.classList.add("on"); playingBtn = btn; playingKey = key;
  const u = await mediaUrl(path);
  if (playingKey !== key) return;
  if (!u) { reset(); return; }
  player.src = u;
  player.play().catch(() => { if (playingKey === key) reset(); });
}

// Après un re-rendu, le bouton actif est un nouvel élément : on lui rend son état.
export function rebindPlaying(root) {
  if (!playingKey) return;
  const btn = root.querySelector(`[data-play="${CSS.escape(playingKey)}"]`);
  if (btn) { btn.classList.add("on"); playingBtn = btn; }
}

export const stopPlayback = () => { player.pause(); reset(); };
