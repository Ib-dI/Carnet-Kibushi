import { mediaUrl } from "../lib/media.js";
import { playPath, stopPlayback } from "../lib/player.js";
import { carnet } from "./carnet-ref.js";
import { createSession, createDailySession } from "../revision/session.js";
import { dailyItems, localToday, nextProgress, nextReviews, daysBetween } from "../revision/schedule.js";
import { $, $$, esc, colorVar, PLAY_ICON, lessonLabel } from "./dom.js";
import { openAttempt } from "./attempt-dialog.js";

// mode : "jour" (Révision du jour, Boîtes de Leitner) ou "libre" (sans planning, par Leçon).
// flash : où va la Carte qu'on vient de noter (« revient dans 3 jours »), affiché sur la suivante.
// revSize : nombre de Cartes de la Révision du jour (0 = tout ce qui est à revoir).
let session = null, mode = "jour", dir = "fr", revLesson = "", revSize = 0, saveFailed = false, flash = "";
const SIZES = [10, 20, 0];

// Nombre de Cartes × Sens à revoir aujourd'hui (pour le bouton « Réviser »).
export const dueCount = () => dailyItems(carnet.state.entries, carnet.state.progress, localToday()).length;

const when = days => days <= 1 ? "demain" : `dans ${days} jours`;

// Première réponse sur une Carte dans un Sens : on l'enregistre (Révision du jour comme libre)
// et on annonce quand elle reviendra.
function record(entryId, d, answer) {
  const today = localToday();
  const current = carnet.state.progress.find(p => p.entry_id === entryId && p.direction === d) || null;
  const next = nextProgress(current, answer, today);
  flash = answer === "again" ? "↺ À revoir : elle repasse tout à l'heure, puis demain"
    : `✓ Revient ${when(daysBetween(today, next.due))}`;
  carnet.recordAnswer(entryId, d, answer, today).then(r => {
    if (!r.ok && !saveFailed) { saveFailed = true; draw(); }
  });
}

function buildDeck() {
  saveFailed = false; flash = "";
  if (mode === "libre") {
    // En écoute, seules les Cartes qui ont un Vocal.
    const pool = dir === "ec" ? carnet.state.entries.filter(e => e.audio_path) : carnet.state.entries;
    session = createSession(pool, { lessonId: revLesson, onFirstAnswer: (e, a) => record(e.id, dir, a) });
    return;
  }
  const scope = { lessonId: revLesson, limit: revSize || Infinity };
  session = createDailySession(dailyItems(carnet.state.entries, carnet.state.progress, localToday(), scope), {
    onFirstAnswer: (it, a) => record(it.entry.id, it.dir, a),
  });
}

const flip = () => { flash = ""; session.flip(); draw(); };
const answer = kind => { flash = ""; session[kind](); draw(); };
const yes = () => answer("knew");
const no = () => answer("again");
const easy = () => answer("easy");
const setMode = m => { mode = m; buildDeck(); draw(); };

// Nom de la Langue choisi dans l'en-tête (« Kibushi »), ou « langue » s'il n'est pas encore donné.
const langName = () => (carnet.state.carnet.langue || "").trim() || "langue";
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const sensLabel = d => d === "fr" ? `Français → ${langName()}` : d === "lg" ? `${capital(langName())} → français` : "Écoute";

function topHTML() {
  const tab = (m, label) => `<button class="btn small ${mode === m ? "solid" : "ghost"}" type="button" data-mode="${m}" aria-pressed="${mode === m}">${label}</button>`;
  const tabs = `<div class="rev-bar">${tab("jour", "Du jour")}${tab("libre", "Libre")}</div>`;
  const opts = `<select id="rL" class="inp" style="max-width:260px;justify-self:center" aria-label="Leçon à réviser"><option value="">Toutes les leçons</option>${carnet.state.lessons.map(l => `<option value="${esc(l.id)}" ${l.id === revLesson ? "selected" : ""}>${esc(lessonLabel(l))}</option>`).join("")}</select>`;
  if (mode === "jour") {
    const size = n => `<button class="chip" type="button" data-size="${n}" aria-pressed="${revSize === n}">${n || "Tout"}</button>`;
    return `<div class="label">Révision du jour · devine avant de retourner</div>${tabs}${opts}
      <div class="chips rev-size" role="group" aria-label="Combien de cartes">${SIZES.map(size).join("")}</div>`;
  }
  const dirBtn = (d, label) => `<button class="btn small ${dir === d ? "solid" : "ghost"}" type="button" data-dir="${d}" aria-pressed="${dir === d}">${label}</button>`;
  return `<div class="label">Révision libre · devine avant de retourner</div>${tabs}${opts}
    <div class="rev-bar">${dirBtn("fr", esc(sensLabel("fr")))}${dirBtn("lg", esc(sensLabel("lg")))}${dirBtn("ec", "🎧 Écoute")}</div>`;
}

function draw() {
  const r = $("#rev");
  const top = topHTML();
  const warn = saveFailed ? `<p class="err" role="alert">Certaines réponses n'ont pas été enregistrées. Vérifie ta connexion.</p>` : "";
  let focus = "#rClose";
  stopPlayback();

  const cur = session.current, flipped = session.flipped;
  const note = flash ? `<p class="status rev-flash" role="status">${esc(flash)}</p>` : "";
  if (!session.total) {
    const next = nextReviews(carnet.state.entries, carnet.state.progress, localToday());
    const nextLine = next ? `Prochaines cartes : ${esc(when(daysBetween(localToday(), next.day)))} (${next.count})` : "Ajoute des mots avec leur traduction pour en réviser de nouveaux.";
    const empty = mode === "jour"
      ? `<div class="card-face"><div class="big">Tout est révisé ✓</div><div class="q">${nextLine}</div></div>`
      : `<p class="status">Aucune carte avec mot et traduction dans cette leçon.</p>`;
    const libre = mode === "jour" ? `<button class="btn" type="button" data-mode="libre">Révision libre</button>` : "";
    r.innerHTML = top + empty + `<div class="rev-bar">${libre}<button class="btn" type="button" id="rClose">Fermer</button></div>`;
  } else if (!cur) {
    const again = mode === "libre" ? `<button class="btn solid" type="button" id="rAgain">Recommencer</button>` : "";
    r.innerHTML = top + note + `<div class="card-face"><div class="big">${session.score} / ${session.total}</div><div class="q">cartes que tu savais déjà${mode === "jour" ? " · à demain !" : ""}</div></div>${warn}
      <div class="rev-bar">${again}<button class="btn" type="button" id="rClose">Fermer</button></div>`;
    if (again) focus = "#rAgain";
  } else {
    const e = mode === "jour" ? cur.entry : cur, d = mode === "jour" ? cur.dir : dir;
    const col = colorVar(carnet.state.lessons.find(l => l.id === e.lesson_id)?.color);
    const pron = e.pron ? `<div class="pron">[ ${esc(e.pron)} ]</div>` : "";
    const listen = d === "ec";
    const front = d === "fr"
      ? `<div class="q">Comment dit-on…</div><div class="big">${esc(e.translation)}</div>`
      : listen ? `<div class="q">Écoute, puis devine le mot et son sens</div>`
      : `<div class="q">Qu'est-ce que ça veut dire ?</div><div class="big" style="color:${col}">${esc(e.word)}</div>${pron}`;
    const back = d === "lg"
      ? `<div class="big">${esc(e.translation)}</div><div class="q">${esc(e.word)}</div>`
      : `<div class="big" style="color:${col}">${esc(e.word)}</div>${pron}<div class="q">${esc(e.translation)}</div>`;
    const play = e.audio_path && (flipped || d !== "fr") ? `<button class="play ${listen && !flipped ? "big-play" : ""}" style="--c:${col}" type="button" id="rPlay" aria-label="Écouter">${PLAY_ICON}</button>` : "";
    // En écoute, ni emoji ni image avant de retourner : ils souffleraient la réponse.
    const hint = !(listen && !flipped);
    const tryBtn = flipped ? `<button class="mini" type="button" id="rTry">🎙 Mon essai</button>` : "";
    const sens = mode === "jour" ? ` · ${esc(sensLabel(d))}` : "";
    r.innerHTML = top + note + `<div class="count" aria-live="polite">Carte ${session.position + 1} sur ${session.count}${sens}</div>
      <div class="card-face">${hint && e.emoji ? `<div style="font-size:2rem" aria-hidden="true">${esc(e.emoji)}</div>` : ""}${hint && e.image_path ? `<img id="rImg" alt="">` : ""}${flipped ? back : front}${play}${tryBtn}${e.note && flipped ? `<div class="note">${esc(e.note)}</div>` : ""}</div>${warn}
      <div class="rev-bar">${flipped
        ? `<button class="btn" type="button" id="rNo">À revoir</button><button class="btn solid" type="button" id="rYes">Je savais</button><button class="btn" type="button" id="rEasy" title="Ne la remontrer que dans 30 jours">Par cœur</button>`
        : `<button class="btn solid" type="button" id="rFlip">Retourner la carte</button>`}<button class="btn ghost" type="button" id="rClose">Fermer</button></div>`;
    focus = flipped ? "#rYes" : "#rFlip";
    if (e.image_path) mediaUrl(e.image_path).then(u => { const i = $("#rImg"); if (i) { if (u) i.src = u; else i.remove(); } });
    const p = $("#rPlay"); if (p) p.onclick = () => playPath(e.audio_path, p, "rev");
    if (p && listen && !flipped) playPath(e.audio_path, p, "rev");   // l'écoute démarre seule
    $("#rTry")?.addEventListener("click", () => openAttempt(e));
    $("#rFlip")?.addEventListener("click", flip);
    $("#rYes")?.addEventListener("click", yes);
    $("#rNo")?.addEventListener("click", no);
    $("#rEasy")?.addEventListener("click", easy);
  }

  $$("[data-mode]", r).forEach(b => b.onclick = () => setMode(b.dataset.mode));
  const sel = $("#rL"); if (sel) sel.onchange = ev => { revLesson = ev.target.value; buildDeck(); draw(); };
  $$("[data-dir]", r).forEach(b => b.onclick = () => {
    const rebuild = (dir === "ec") !== (b.dataset.dir === "ec");   // le paquet change avec l'écoute
    dir = b.dataset.dir;
    if (rebuild) buildDeck();
    draw();
  });
  $$("[data-size]", r).forEach(b => b.onclick = () => { revSize = +b.dataset.size; buildDeck(); draw(); });
  $("#rClose").onclick = () => $("#dlgRev").close();
  $("#rAgain")?.addEventListener("click", () => { buildDeck(); draw(); });
  $(focus)?.focus();
}

// Raccourcis : Espace = retourner, → = je savais, ← = à revoir, ↑ = par cœur.
function onKey(ev) {
  if (ev.target.tagName === "SELECT" || !session?.current) return;
  if (ev.key === " " && !session.flipped) { ev.preventDefault(); flip(); }
  else if (ev.key === "ArrowRight" && session.flipped) { ev.preventDefault(); yes(); }
  else if (ev.key === "ArrowLeft" && session.flipped) { ev.preventDefault(); no(); }
  else if (ev.key === "ArrowUp" && session.flipped) { ev.preventDefault(); easy(); }
}

export function initReview() {
  const dlg = $("#dlgRev");
  dlg.addEventListener("keydown", onKey);
  dlg.addEventListener("close", stopPlayback);
}

export function openReview() {
  if (revLesson && !carnet.state.lessons.some(l => l.id === revLesson)) revLesson = "";
  mode = "jour";   // même s'il n'y a rien à revoir : on l'affiche, sans basculer seul en libre
  buildDeck();
  $("#dlgRev").showModal();
  draw();
}
