import { mediaUrl } from "../lib/media.js";
import { playPath, stopPlayback } from "../lib/player.js";
import { carnet } from "./carnet-ref.js";
import { createSession, createDailySession } from "../revision/session.js";
import { dailyItems, localToday } from "../revision/schedule.js";
import { $, $$, esc, colorVar, PLAY_ICON, lessonLabel } from "./dom.js";
import { openAttempt } from "./attempt-dialog.js";

// mode : "jour" (Révision du jour, Boîtes de Leitner) ou "libre" (sans planning, par Leçon).
let session = null, mode = "jour", dir = "fr", revLesson = "", saveFailed = false;

// Nombre de Cartes × Sens à revoir aujourd'hui (pour le bouton « Réviser »).
export const dueCount = () => dailyItems(carnet.state.entries, carnet.state.progress, localToday()).length;

function buildDeck() {
  saveFailed = false;
  if (mode === "libre") { session = createSession(carnet.state.entries, { lessonId: revLesson }); return; }
  const today = localToday();
  session = createDailySession(dailyItems(carnet.state.entries, carnet.state.progress, today), {
    onFirstAnswer: async (it, knew) => {
      const r = await carnet.recordAnswer(it.entry.id, it.dir, knew, today);
      if (!r.ok && !saveFailed) { saveFailed = true; draw(); }
    },
  });
}

const flip = () => { session.flip(); draw(); };
const yes = () => { session.knew(); draw(); };
const no = () => { session.again(); draw(); };
const setMode = m => { mode = m; buildDeck(); draw(); };

// Nom de la Langue choisi dans l'en-tête (« Kibushi »), ou « langue » s'il n'est pas encore donné.
const langName = () => (carnet.state.carnet.langue || "").trim() || "langue";
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const sensLabel = d => d === "fr" ? `Français → ${langName()}` : `${capital(langName())} → français`;

function topHTML() {
  const tab = (m, label) => `<button class="btn small ${mode === m ? "solid" : "ghost"}" type="button" data-mode="${m}" aria-pressed="${mode === m}">${label}</button>`;
  const tabs = `<div class="rev-bar">${tab("jour", "Du jour")}${tab("libre", "Libre")}</div>`;
  if (mode === "jour") return `<div class="label">Révision du jour · devine avant de retourner</div>${tabs}`;
  const opts = `<select id="rL" class="inp" style="max-width:260px;justify-self:center" aria-label="Leçon à réviser"><option value="">Toutes les leçons</option>${carnet.state.lessons.map(l => `<option value="${esc(l.id)}" ${l.id === revLesson ? "selected" : ""}>${esc(lessonLabel(l))}</option>`).join("")}</select>`;
  const dirBtn = (d, label) => `<button class="btn small ${dir === d ? "solid" : "ghost"}" type="button" data-dir="${d}" aria-pressed="${dir === d}">${label}</button>`;
  return `<div class="label">Révision libre · devine avant de retourner</div>${tabs}${opts}
    <div class="rev-bar">${dirBtn("fr", esc(sensLabel("fr")))}${dirBtn("lg", esc(sensLabel("lg")))}</div>`;
}

function draw() {
  const r = $("#rev");
  const top = topHTML();
  const warn = saveFailed ? `<p class="err" role="alert">Certaines réponses n'ont pas été enregistrées. Vérifie ta connexion.</p>` : "";
  let focus = "#rClose";
  stopPlayback();

  const cur = session.current, flipped = session.flipped;
  if (!session.total) {
    const empty = mode === "jour"
      ? `<div class="card-face"><div class="big">Rien à revoir aujourd'hui</div><div class="q">Reviens demain, ou fais une révision libre.</div></div>`
      : `<p class="status">Aucune carte avec mot et traduction dans cette leçon.</p>`;
    r.innerHTML = top + empty + `<div class="rev-bar"><button class="btn" type="button" id="rClose">Fermer</button></div>`;
  } else if (!cur) {
    const again = mode === "libre" ? `<button class="btn solid" type="button" id="rAgain">Recommencer</button>` : "";
    r.innerHTML = top + `<div class="card-face"><div class="big">${session.score} / ${session.total}</div><div class="q">cartes que tu savais déjà${mode === "jour" ? " · à demain !" : ""}</div></div>${warn}
      <div class="rev-bar">${again}<button class="btn" type="button" id="rClose">Fermer</button></div>`;
    if (again) focus = "#rAgain";
  } else {
    const e = mode === "jour" ? cur.entry : cur, d = mode === "jour" ? cur.dir : dir;
    const col = colorVar(carnet.state.lessons.find(l => l.id === e.lesson_id)?.color);
    const pron = e.pron ? `<div class="pron">[ ${esc(e.pron)} ]</div>` : "";
    const front = d === "fr"
      ? `<div class="q">Comment dit-on…</div><div class="big">${esc(e.translation)}</div>`
      : `<div class="q">Qu'est-ce que ça veut dire ?</div><div class="big" style="color:${col}">${esc(e.word)}</div>${pron}`;
    const back = d === "fr"
      ? `<div class="big" style="color:${col}">${esc(e.word)}</div>${pron}<div class="q">${esc(e.translation)}</div>`
      : `<div class="big">${esc(e.translation)}</div><div class="q">${esc(e.word)}</div>`;
    const play = e.audio_path && (flipped || d === "lg") ? `<button class="play" style="--c:${col}" type="button" id="rPlay" aria-label="Écouter">${PLAY_ICON}</button>` : "";
    const tryBtn = flipped ? `<button class="mini" type="button" id="rTry">🎙 Mon essai</button>` : "";
    const sens = mode === "jour" ? ` · ${esc(sensLabel(d))}` : "";
    r.innerHTML = top + `<div class="count" aria-live="polite">Carte ${session.position + 1} sur ${session.count}${sens}</div>
      <div class="card-face">${e.emoji ? `<div style="font-size:2rem" aria-hidden="true">${esc(e.emoji)}</div>` : ""}${e.image_path ? `<img id="rImg" alt="">` : ""}${flipped ? back : front}${play}${tryBtn}${e.note && flipped ? `<div class="note">${esc(e.note)}</div>` : ""}</div>${warn}
      <div class="rev-bar">${flipped
        ? `<button class="btn" type="button" id="rNo">À revoir</button><button class="btn solid" type="button" id="rYes">Je savais</button>`
        : `<button class="btn solid" type="button" id="rFlip">Retourner la carte</button>`}<button class="btn ghost" type="button" id="rClose">Fermer</button></div>`;
    focus = flipped ? "#rYes" : "#rFlip";
    if (e.image_path) mediaUrl(e.image_path).then(u => { const i = $("#rImg"); if (i) { if (u) i.src = u; else i.remove(); } });
    const p = $("#rPlay"); if (p) p.onclick = () => playPath(e.audio_path, p, "rev");
    $("#rTry")?.addEventListener("click", () => openAttempt(e));
    $("#rFlip")?.addEventListener("click", flip);
    $("#rYes")?.addEventListener("click", yes);
    $("#rNo")?.addEventListener("click", no);
  }

  $$("[data-mode]", r).forEach(b => b.onclick = () => setMode(b.dataset.mode));
  const sel = $("#rL"); if (sel) sel.onchange = ev => { revLesson = ev.target.value; buildDeck(); draw(); };
  $$("[data-dir]", r).forEach(b => b.onclick = () => { dir = b.dataset.dir; draw(); });
  $("#rClose").onclick = () => $("#dlgRev").close();
  $("#rAgain")?.addEventListener("click", () => { buildDeck(); draw(); });
  $(focus)?.focus();
}

// Raccourcis : Espace = retourner, → = je savais, ← = à revoir.
function onKey(ev) {
  if (ev.target.tagName === "SELECT" || !session?.current) return;
  if (ev.key === " " && !session.flipped) { ev.preventDefault(); flip(); }
  else if (ev.key === "ArrowRight" && session.flipped) { ev.preventDefault(); yes(); }
  else if (ev.key === "ArrowLeft" && session.flipped) { ev.preventDefault(); no(); }
}

export function initReview() {
  const dlg = $("#dlgRev");
  dlg.addEventListener("keydown", onKey);
  dlg.addEventListener("close", stopPlayback);
}

export function openReview() {
  if (revLesson && !carnet.state.lessons.some(l => l.id === revLesson)) revLesson = "";
  mode = dueCount() ? "jour" : "libre";
  buildDeck();
  $("#dlgRev").showModal();
  draw();
}
