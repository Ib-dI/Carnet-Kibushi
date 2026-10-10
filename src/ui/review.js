import { mediaUrl } from "../lib/media.js";
import { playPath, stopPlayback } from "../lib/player.js";
import { state, reviewable } from "../state.js";
import { $, $$, esc, colorVar, PLAY_ICON, lessonLabel } from "./dom.js";

let deck = [], total = 0, pos = 0, flipped = false, dir = "fr", revLesson = "", known = 0;

function buildDeck() {
  deck = state.entries.filter(e => reviewable(e) && (!revLesson || e.lesson_id === revLesson));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  total = deck.length; pos = 0; flipped = false; known = 0;
}

const flip = () => { flipped = true; draw(); };
const yes = () => { known++; pos++; flipped = false; draw(); };
const no = () => { deck.push(deck[pos]); pos++; flipped = false; draw(); };

function draw() {
  const r = $("#rev");
  const opts = `<select id="rL" class="inp" style="max-width:260px;justify-self:center" aria-label="Leçon à réviser"><option value="">Toutes les leçons</option>${state.lessons.map(l => `<option value="${esc(l.id)}" ${l.id === revLesson ? "selected" : ""}>${esc(lessonLabel(l))}</option>`).join("")}</select>`;
  const top = `<div class="label">Révision · devine avant de retourner</div>${opts}
    <div class="rev-bar"><button class="btn small ${dir === "fr" ? "solid" : "ghost"}" type="button" data-dir="fr" aria-pressed="${dir === "fr"}">Français → langue</button><button class="btn small ${dir === "lg" ? "solid" : "ghost"}" type="button" data-dir="lg" aria-pressed="${dir === "lg"}">Langue → français</button></div>`;
  let focus = "#rClose";
  stopPlayback();

  if (!deck.length) {
    r.innerHTML = top + `<p class="status">Aucune carte avec mot et traduction dans cette leçon.</p><div class="rev-bar"><button class="btn" type="button" id="rClose">Fermer</button></div>`;
  } else if (pos >= deck.length) {
    r.innerHTML = top + `<div class="card-face"><div class="big">${known} / ${total}</div><div class="q">cartes que tu savais déjà</div></div>
      <div class="rev-bar"><button class="btn solid" type="button" id="rAgain">Recommencer</button><button class="btn" type="button" id="rClose">Fermer</button></div>`;
    focus = "#rAgain";
  } else {
    const e = deck[pos];
    const col = colorVar(state.lessons.find(l => l.id === e.lesson_id)?.color);
    const pron = e.pron ? `<div class="pron">[ ${esc(e.pron)} ]</div>` : "";
    const front = dir === "fr"
      ? `<div class="q">Comment dit-on…</div><div class="big">${esc(e.translation)}</div>`
      : `<div class="q">Qu'est-ce que ça veut dire ?</div><div class="big" style="color:${col}">${esc(e.word)}</div>${pron}`;
    const back = dir === "fr"
      ? `<div class="big" style="color:${col}">${esc(e.word)}</div>${pron}<div class="q">${esc(e.translation)}</div>`
      : `<div class="big">${esc(e.translation)}</div><div class="q">${esc(e.word)}</div>`;
    const play = e.audio_path && (flipped || dir === "lg") ? `<button class="play" style="--c:${col}" type="button" id="rPlay" aria-label="Écouter">${PLAY_ICON}</button>` : "";
    r.innerHTML = top + `<div class="count" aria-live="polite">Carte ${pos + 1} sur ${deck.length}</div>
      <div class="card-face">${e.emoji ? `<div style="font-size:2rem" aria-hidden="true">${esc(e.emoji)}</div>` : ""}${e.image_path ? `<img id="rImg" alt="">` : ""}${flipped ? back : front}${play}${e.note && flipped ? `<div class="note">${esc(e.note)}</div>` : ""}</div>
      <div class="rev-bar">${flipped
        ? `<button class="btn" type="button" id="rNo">À revoir</button><button class="btn solid" type="button" id="rYes">Je savais</button>`
        : `<button class="btn solid" type="button" id="rFlip">Retourner la carte</button>`}<button class="btn ghost" type="button" id="rClose">Fermer</button></div>`;
    focus = flipped ? "#rYes" : "#rFlip";
    if (e.image_path) mediaUrl(e.image_path).then(u => { const i = $("#rImg"); if (i) { if (u) i.src = u; else i.remove(); } });
    const p = $("#rPlay"); if (p) p.onclick = () => playPath(e.audio_path, p, "rev");
    $("#rFlip")?.addEventListener("click", flip);
    $("#rYes")?.addEventListener("click", yes);
    $("#rNo")?.addEventListener("click", no);
  }

  $("#rL").onchange = ev => { revLesson = ev.target.value; buildDeck(); draw(); };
  $$("[data-dir]", r).forEach(b => b.onclick = () => { dir = b.dataset.dir; flipped = false; draw(); });
  $("#rClose").onclick = () => $("#dlgRev").close();
  $("#rAgain")?.addEventListener("click", () => { buildDeck(); draw(); });
  $(focus)?.focus();
}

// Raccourcis : Espace = retourner, → = je savais, ← = à revoir.
function onKey(ev) {
  if (ev.target.tagName === "SELECT" || pos >= deck.length || !deck.length) return;
  if (ev.key === " " && !flipped) { ev.preventDefault(); flip(); }
  else if (ev.key === "ArrowRight" && flipped) { ev.preventDefault(); yes(); }
  else if (ev.key === "ArrowLeft" && flipped) { ev.preventDefault(); no(); }
}

export function initReview() {
  const dlg = $("#dlgRev");
  dlg.addEventListener("keydown", onKey);
  dlg.addEventListener("close", stopPlayback);
}

export function openReview() {
  if (revLesson && !state.lessons.some(l => l.id === revLesson)) revLesson = "";
  buildDeck();
  $("#dlgRev").showModal();
  draw();
}
