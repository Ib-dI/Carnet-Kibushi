// Écran « Réviser » (#/reviser[/<leçon>]) : dessine la Révision en cours (revision/screen.js),
// branche boutons et clavier, joue les Vocaux. Aucune règle de séance ici.
import { mediaUrl } from "../lib/media.js";
import { playPath, stopPlayback } from "../lib/player.js";
import { carnet } from "./carnet-ref.js";
import { createRevisionScreen } from "../revision/screen.js";
import { dailyItems, localToday } from "../revision/schedule.js";
import { streak } from "../revision/stats.js";
import { $, $$, esc, colorVar, PLAY_ICON, lessonLabel } from "./dom.js";
import { openAttempt } from "./attempt-dialog.js";
import { go, routeHash } from "./route.js";

export { renderProgress } from "./progress.js";

let screen = null;
const SIZES = [10, 20, 0];

// Nombre de Cartes × Sens à revoir aujourd'hui (pastille de l'onglet « Réviser »).
export const dueCount = () => dailyItems(carnet.state.entries, carnet.state.progress, localToday()).length;

// Nom de la Langue choisi par les Membres (« Kibushi »), ou « langue » s'il n'est pas encore donné.
const langName = () => (carnet.state.carnet.langue || "").trim() || "langue";
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);
const sensLabel = d => d === "fr" ? `Français → ${langName()}` : d === "lg" ? `${capital(langName())} → français` : "Écoute";
const when = day => {
  const n = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${localToday()}T12:00:00Z`)) / 86400000);
  return n <= 1 ? "demain" : `dans ${n} jours`;
};

function topHTML(st) {
  const opts = `<select id="rL" class="inp" style="max-width:260px;justify-self:center" aria-label="Leçon à réviser"><option value="">Toutes les leçons</option>${carnet.state.lessons.map(l => `<option value="${esc(l.id)}" ${l.id === st.lessonId ? "selected" : ""}>${esc(lessonLabel(l))}</option>`).join("")}</select>`;
  if (st.mode === "jour") {
    const size = n => `<button class="chip" type="button" data-size="${n}" aria-pressed="${st.size === n}">${n || "Tout"}</button>`;
    return `<div class="label">Révision du jour · devine avant de retourner</div>${opts}
      <div class="chips rev-size" role="group" aria-label="Combien de cartes">${SIZES.map(size).join("")}</div>`;
  }
  const dirBtn = (d, label) => `<button class="btn small ${st.dir === d ? "solid" : "ghost"}" type="button" data-dir="${d}" aria-pressed="${st.dir === d}">${label}</button>`;
  return `<div class="label">Révision libre · sans planning, toutes les cartes</div>${opts}
    <div class="rev-bar">${dirBtn("fr", esc(sensLabel("fr")))}${dirBtn("lg", esc(sensLabel("lg")))}${dirBtn("ec", "🎧 Écoute")}</div>`;
}

function cardHTML(st) {
  const { entry: e, dir: d } = st.card, flipped = st.flipped;
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
  const sens = st.mode === "jour" ? ` · ${esc(sensLabel(d))}` : "";
  const emoji = show => show && e.emoji ? `<div style="font-size:2rem" aria-hidden="true">${esc(e.emoji)}</div>` : "";
  // Carte à deux faces : le recto reste dessous une fois retournée (pour le retournement), sans image ni ▶.
  const recto = flipped
    ? `<div class="card-face front" inert aria-hidden="true">${emoji(!listen)}${front}</div>`
    : `<div class="card-face front">${emoji(hint)}${hint && e.image_path ? `<img id="rImg" alt="">` : ""}${front}${play}</div>`;
  const verso = flipped
    ? `<div class="card-face back">${emoji(hint)}${hint && e.image_path ? `<img id="rImg" alt="">` : ""}${back}${play}${tryBtn}${e.note ? `<div class="note">${esc(e.note)}</div>` : ""}</div>`
    : "";
  return `<div class="count" aria-live="polite">Carte ${st.position + 1} sur ${st.count}${sens}</div>
    <div class="rev-card ${flipped ? "" : "can-flip"}"><div class="rev-tilt">
      <div class="rev-flip ${flipped ? "flipped" : ""}">${recto}${verso}</div>
      <div class="rev-glare" aria-hidden="true"><div class="rev-shine"></div></div>
    </div></div>`;
}

// Carte « Pokémon » : à la souris, elle s'incline vers le curseur et un reflet glisse dessus ;
// elle revient à plat en douceur quand le curseur s'en va. Ni au toucher, ni en mouvement réduit.
const TILT_MAX = 8;   // degrés
function bindTilt() {
  const card = $("#rev .rev-card"), tilt = card && $(".rev-tilt", card), shine = card && $(".rev-shine", card);
  if (!tilt || !matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let frame = 0;
  card.addEventListener("pointermove", ev => {
    if (ev.pointerType !== "mouse") return;
    const r = card.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      card.classList.add("tilting");
      tilt.style.transform = `rotateX(${((0.5 - y) * 2 * TILT_MAX).toFixed(2)}deg) rotateY(${((x - 0.5) * 2 * TILT_MAX).toFixed(2)}deg)`;
      shine.style.transform = `translate(${((x - 0.5) * 50).toFixed(1)}%, ${((y - 0.5) * 50).toFixed(1)}%)`;
    });
  });
  card.addEventListener("pointerleave", () => {
    cancelAnimationFrame(frame);
    card.classList.remove("tilting");
    tilt.style.transform = "";
    shine.style.transform = "";
  });
}

// Mouvement de la carte après un clic ou un toucher (jamais au clavier) : elle se retourne, ou la suivante arrive.
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)", EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
function animateCard(kind) {
  const card = $("#rev .rev-card");
  if (!card?.animate) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (kind === "flip") {
    // La carte est déjà dessinée retournée : on joue le demi-tour depuis le recto.
    if (reduce) $(".back", card)?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease" });
    else {
      // Le reflet est à plat sur la carte inclinée : on le cache le temps du demi-tour.
      card.classList.add("flipping");
      $(".rev-flip", card).animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], { duration: 300, easing: EASE_IN_OUT })
        .finished.then(() => card.classList.remove("flipping"), () => {});
    }
    return;
  }
  if (reduce) card.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150, easing: "ease" });
  else card.animate([{ transform: "translateX(16px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 200, easing: EASE_OUT });
}

// Fin de Révision : le score apparaît, puis la série (une seule fois par écran de fin).
let doneShown = false;
function celebrate() {
  const face = $("#rev .card-face"), line = $("#rev .rev-streak");
  if (!face?.animate) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    face.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease" });
    return;
  }
  face.animate([{ transform: "scale(0.9)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: EASE_OUT });
  line?.animate([{ transform: "translateY(6px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, delay: 120, easing: EASE_OUT, fill: "backwards" });
}

function draw() {
  const r = $("#rev"), st = screen.state;
  const warn = st.saveFailed ? `<p class="err" role="alert">Certaines réponses n'ont pas été enregistrées. Vérifie ta connexion.</p>` : "";
  const note = st.flash ? `<p class="status rev-flash" role="status">${esc(st.flash)}</p>` : "";
  // Passer de la Révision du jour à la Révision libre (et inversement) : un simple lien, en bas.
  const other = st.mode === "jour"
    ? `<button class="mini rev-switch" type="button" data-mode="libre">Réviser librement toutes les cartes</button>`
    : `<button class="mini rev-switch" type="button" data-mode="jour">← Révision du jour</button>`;
  let focus = null;
  stopPlayback();

  if (st.empty) {
    doneShown = false;
    const nextLine = st.next ? `Prochaines cartes : ${esc(when(st.next.day))} (${st.next.count})` : "Ajoute des mots avec leur traduction pour en réviser de nouveaux.";
    const empty = st.mode === "jour"
      ? `<div class="card-face"><div class="big">Tout est révisé ✓</div><div class="q">${nextLine}</div></div>`
      : `<p class="status">Aucune carte avec mot et traduction dans cette leçon.</p>`;
    r.innerHTML = topHTML(st) + empty + `<div class="rev-bar"><a class="btn" href="${routeHash({ view: "home" })}">Retour aux leçons</a></div>${other}`;
  } else if (st.done) {
    const again = st.mode === "libre" ? `<button class="btn solid" type="button" id="rAgain">Recommencer</button>` : "";
    const n = st.mode === "jour" ? streak(carnet.state.review_days.map(d => d.day), localToday()) : 0;
    const series = n ? `<div class="rev-streak">🔥 ${n > 1 ? `${n} jours d'affilée` : "Premier jour de ta série"}</div>` : "";
    r.innerHTML = topHTML(st) + note + `<div class="card-face"><div class="big">${st.score} / ${st.total}</div><div class="q">cartes que tu savais déjà${st.mode === "jour" ? " · à demain !" : ""}</div>${series}</div>${warn}
      <div class="rev-bar">${again}<a class="btn" href="${routeHash({ view: "progress" })}">Voir mes progrès</a></div>${other}`;
    if (again) focus = "#rAgain";
    if (!doneShown) { doneShown = true; celebrate(); }
  } else {
    doneShown = false;
    const e = st.card.entry, listen = st.card.dir === "ec";
    r.innerHTML = topHTML(st) + note + cardHTML(st) + warn + `<div class="rev-bar">${st.flipped
        ? `<button class="btn" type="button" id="rNo">À revoir</button><button class="btn solid" type="button" id="rYes">Je savais</button><button class="btn" type="button" id="rEasy" title="Ne la remontrer que dans 30 jours">Par cœur</button>`
        : `<button class="btn solid" type="button" id="rFlip">Retourner la carte</button>`}</div>${other}`;
    focus = st.flipped ? "#rYes" : "#rFlip";
    if (e.image_path) mediaUrl(e.image_path).then(u => { const i = $("#rImg"); if (i) { if (u) i.src = u; else i.remove(); } });
    const p = $("#rPlay"); if (p) p.onclick = () => playPath(e.audio_path, p, "rev");
    if (p && listen && !st.flipped) playPath(e.audio_path, p, "rev");   // l'écoute démarre seule
    $("#rTry")?.addEventListener("click", () => openAttempt(e));
    bindTilt();
  }

  const act = fn => () => { fn(); draw(); };
  const card = (fn, kind) => () => {
    // Au retournement, la carte redessinée garde l'inclinaison qu'elle avait sous la souris (pas de saut).
    const was = $("#rev .rev-card"), tilted = kind === "flip" && was?.classList.contains("tilting") ? $(".rev-tilt", was).style.transform : "";
    fn(); draw();
    if (tilted) { const now = $("#rev .rev-card"); now?.classList.add("tilting"); if (now) $(".rev-tilt", now).style.transform = tilted; }
    if (kind === "flip" || (screen.state.card && !screen.state.done)) animateCard(kind);
  };
  $("#rFlip")?.addEventListener("click", card(() => screen.flip(), "flip"));
  // Toucher la carte (ailleurs que sur ▶) la retourne aussi.
  $("#rev .rev-card.can-flip")?.addEventListener("click", ev => { if (!ev.target.closest("button, a, img")) card(() => screen.flip(), "flip")(); });
  $("#rYes")?.addEventListener("click", card(() => screen.answer("knew"), "next"));
  $("#rNo")?.addEventListener("click", card(() => screen.answer("again"), "next"));
  $("#rEasy")?.addEventListener("click", card(() => screen.answer("easy"), "next"));
  $("#rAgain")?.addEventListener("click", act(() => screen.restart()));
  $$("[data-mode]", r).forEach(b => b.onclick = act(() => screen.setMode(b.dataset.mode)));
  $$("[data-size]", r).forEach(b => b.onclick = act(() => screen.setSize(+b.dataset.size)));
  $$("[data-dir]", r).forEach(b => b.onclick = act(() => screen.setDir(b.dataset.dir)));
  // Changer de Leçon passe par l'adresse : le bouton retour et les liens restent justes.
  const sel = $("#rL"); if (sel) sel.onchange = ev => go({ view: "review", lesson: ev.target.value || undefined });
  if (focus) $(focus)?.focus({ preventScroll: true });
}

// Raccourcis : Espace = retourner, → = je savais, ← = à revoir, ↑ = par cœur (quand l'écran Réviser est affiché).
function onKey(ev) {
  if (!screen || $("#review")?.hidden || ev.target.closest?.("input, select, textarea, dialog") || !screen.state.card) return;
  const flipped = screen.state.flipped;
  const keys = { " ": !flipped && (() => screen.flip()), ArrowRight: flipped && (() => screen.answer("knew")),
    ArrowLeft: flipped && (() => screen.answer("again")), ArrowUp: flipped && (() => screen.answer("easy")) };
  const fn = keys[ev.key];
  if (fn) { ev.preventDefault(); fn(); draw(); }
}

export function initReview() {
  screen = createRevisionScreen({ carnet });
  screen.onChange(() => { if (!$("#review").hidden) draw(); });   // ex. un enregistrement qui échoue
  document.addEventListener("keydown", onKey);
}

// Arrivée sur l'écran (ou changement de Leçon dans l'adresse) : la séance est gardée ou refaite par le module.
export function renderReview(route) {
  screen.open({ lessonId: route.lesson || "" });
  draw();
}

export const leaveReview = () => stopPlayback();

// « Réviser cette leçon » (lessonId), ou toutes les Leçons.
export const openReview = lessonId => go({ view: "review", lesson: lessonId || undefined });
