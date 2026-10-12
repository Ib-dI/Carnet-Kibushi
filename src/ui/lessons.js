import { carnet } from "./carnet-ref.js";
import { cachedUrl, mediaUrl } from "../lib/media.js";
import { playPath, rebindPlaying } from "../lib/player.js";
import { $, $$, esc, colorVar, pad, fmtDate, PLAY_ICON, SUGGESTIONS, TYPES, errorText, lessonLabel } from "./dom.js";
import { entryFilter, isFiltering } from "./entry-filter.js";
import { hardEntryIds } from "../revision/schedule.js";
import { openEntry } from "./entry-dialog.js";
import { openLesson } from "./lesson-dialog.js";
import { openAttempt } from "./attempt-dialog.js";
import { openComments } from "./comments-dialog.js";
import { currentNews } from "./news-ref.js";
import { currentRoute, routeHash, go } from "./route.js";
import { dailyItems, localToday } from "../revision/schedule.js";
import { reviewable } from "../revision/session.js";
import { openReview } from "./review.js";

const time = e => Date.parse(e.created_at) || 0;

let filter = { query: "", type: "", noAudio: false, hard: false };
export function setFilter(patch) { filter = { ...filter, ...patch }; renderLessons(); }

// Ligne de filtres sous la recherche : Type d'entrée et « sans Vocal ».
export function filtersHTML() {
  const chip = (attr, label, on) => `<button type="button" class="chip" ${attr} aria-pressed="${on}">${label}</button>`;
  return `<div class="chips filters" role="group" aria-label="Filtrer">
    ${chip('data-ftype=""', "Tout", !filter.type)}${TYPES.map(t => chip(`data-ftype="${t[0]}"`, t[1] + "s", filter.type === t[0])).join("")}
    ${chip("data-fnoaudio", "Sans vocal", filter.noAudio)}${chip("data-fhard", "Difficiles", filter.hard)}</div>`;
}
export function bindFilters(root) {
  const sync = () => {
    $$("[data-ftype]", root).forEach(b => b.setAttribute("aria-pressed", b.dataset.ftype === filter.type));
    $("[data-fnoaudio]", root).setAttribute("aria-pressed", filter.noAudio);
    $("[data-fhard]", root).setAttribute("aria-pressed", filter.hard);
  };
  $$("[data-ftype]", root).forEach(b => b.onclick = () => { setFilter({ type: b.dataset.ftype }); sync(); });
  $("[data-fnoaudio]", root).onclick = () => { setFilter({ noAudio: !filter.noAudio }); sync(); };
  $("[data-fhard]", root).onclick = () => { setFilter({ hard: !filter.hard }); sync(); };
}

// inLesson : en résultats de recherche, la Leçon où se trouve l'Entrée (lien vers sa page).
function entryHTML(e, fresh, inLesson) {
  const tc = e.text_color ? `--tc:${colorVar(e.text_color)};` : "";
  const who = carnet.authorName(e.author_email);
  const tries = carnet.attemptsOf(e.id).length;
  const tryBtn = e.type === "conseil" ? "" : ` · <button class="mini" data-try="${esc(e.id)}" type="button">🎙 Essais${tries ? ` (${tries})` : ""}</button>`;
  const coms = carnet.commentsOf(e.id).length, newComs = fresh.comments.get(e.id) || 0;
  const comBtn = ` · <button class="mini" data-comments="${esc(e.id)}" type="button">💬 ${coms ? `Commentaires (${coms})` : "Commenter"}</button>${newComs ? `<span class="new-pill">${newComs} nouveau${newComs > 1 ? "x" : ""}</span>` : ""}`;
  const newPill = fresh.entries.has(e.id) ? `<span class="new-pill">nouveau</span>` : "";
  const where = inLesson ? `<a class="mini" href="${routeHash({ view: "lesson", id: inLesson.id })}">dans ${esc(lessonLabel(inLesson))}</a> · ` : "";
  const metaLine = `<div class="meta">${newPill}${where}${who ? `Ajouté par ${esc(who)} · ` : ""}${fmtDate(e.created_at)} · <button class="mini" data-edit="${esc(e.id)}" type="button">Modifier</button>${tryBtn}${comBtn}</div>`;
  const play = e.audio_path ? `<button class="play" type="button" data-play="${esc(e.id)}" aria-label="Écouter ${esc(e.word || "le vocal")}">${PLAY_ICON}</button>` : "";
  const thumb = e.image_path ? `<img class="thumb" data-img="${esc(e.id)}" alt="Image pour ${esc(e.word || "cette entrée")}" role="button" tabindex="0">` : "";
  if (e.type === "conseil") {
    return `<li class="entry" style="${tc}"><div class="tip">
      <div class="tip-row"><span class="label">${e.emoji ? esc(e.emoji) : "💡"} Conseil</span>${play}</div>
      ${e.word ? `<div class="word">${esc(e.word)}</div>` : ""}
      ${e.translation ? `<div class="note">${esc(e.translation)}</div>` : ""}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ""}
      ${thumb}${metaLine}</div></li>`;
  }
  return `<li class="entry ${e.type === "phrase" ? "phrase" : ""}" style="${tc}">
    <div class="emo" aria-hidden="true">${e.emoji ? esc(e.emoji) : "·"}</div>
    <div class="e-main">
      <div class="word">${esc(e.word || "…")}</div>
      ${e.pron ? `<div class="pron">[ ${esc(e.pron)} ]</div>` : ""}
      ${e.translation ? `<div class="tr">${esc(e.translation)}</div>` : ""}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ""}
      ${metaLine}
    </div>
    <div class="e-side">${play}${thumb}</div>
  </li>`;
}

function emptyHTML() {
  return `<div class="welcome"><div class="label eyebrow">Première page</div><h2>Le carnet est encore vide</h2>
    <p>Choisis un premier thème pour créer une leçon, puis ajoute dedans des mots, des phrases, une image ou un vocal.</p>
    <div class="chips">${SUGGESTIONS.map((s, i) => `<button class="chip" type="button" data-sugg="${i}">${s[1]} ${esc(s[0])}</button>`).join("")}
    <button class="chip" type="button" id="customLesson">+ Autre thème</button></div>
    <p class="err" id="suggErr" hidden></p></div>`;
}

// Les Entrées d'une Leçon, dans l'ordre d'ajout.
const entriesOf = lessonId => carnet.state.entries.filter(e => e.lesson_id === lessonId).sort((a, b) => time(a) - time(b));
// À réviser maintenant dans une Leçon : Cartes à revoir et nouvelles (comme « Réviser cette leçon »).
const toReview = lessonId => dailyItems(carnet.state.entries, carnet.state.progress, localToday(), { lessonId }).length;

// Vue courante, d'après l'adresse : sommaire des Leçons ou page d'une Leçon.
export function renderLessons() {
  const route = currentRoute();
  const lesson = route.view === "lesson" && carnet.state.lessons.find(l => l.id === route.id);
  if (route.view === "lesson" && !lesson) { go({ view: "home" }); return; }   // Leçon supprimée
  $("#home").hidden = Boolean(lesson);
  $("#page").hidden = !lesson;
  if (lesson) renderLessonPage(lesson); else renderHome();
}

function renderHome() {
  const list = $("#list"), state = carnet.state;
  if (!state.lessons.length) {
    list.innerHTML = emptyHTML();
    $$("[data-sugg]", list).forEach(b => b.onclick = async () => {
      const s = SUGGESTIONS[+b.dataset.sugg];
      b.disabled = true;
      const r = await carnet.saveLesson(null, { title: s[0], emoji: s[1], color: s[2] });
      if (!r.ok) { b.disabled = false; const p = $("#suggErr"); p.hidden = false; p.textContent = errorText(r); }
    });
    $("#customLesson").onclick = () => openLesson();
    return;
  }
  if (isFiltering(filter)) { renderResults(list); return; }

  const fresh = currentNews();
  list.innerHTML = `<div class="tiles">${state.lessons.map(l => {
    const words = entriesOf(l.id), due = toReview(l.id);
    const news = words.filter(e => fresh.entries.has(e.id)).length;
    const status = !words.some(reviewable) ? "" : due ? `<b>${due} à réviser</b>` : `<span class="ok">✓ à jour</span>`;
    return `<a class="tile" href="${routeHash({ view: "lesson", id: l.id })}" style="--c:${colorVar(l.color)}">
      <span class="tile-emo" aria-hidden="true">${esc(l.emoji || "📒")}</span>
      <span class="tile-title">${esc(l.title)}</span>
      <span class="tile-meta">${words.length ? `${words.length} mot${words.length > 1 ? "s" : ""}` : "Vide"}${status ? ` · ${status}` : ""}</span>
      ${news ? `<span class="new-pill tile-new">${news} nouveau${news > 1 ? "x" : ""}</span>` : ""}
    </a>`;
  }).join("")}</div>`;
}

// Recherche ou filtre actif : la liste des Entrées trouvées, toutes Leçons confondues.
function renderResults(list) {
  const hard = hardEntryIds(carnet.state.progress), fresh = currentNews();
  const found = carnet.state.entries.filter(entryFilter(filter, hard)).sort((a, b) => time(a) - time(b));
  if (!found.length) {
    list.innerHTML = `<p class="status">${filter.query ? `Aucun résultat pour « ${esc(filter.query)} ».` : "Aucune entrée ne correspond à ces filtres."}</p>`;
    return;
  }
  const lessonOf = id => carnet.state.lessons.find(l => l.id === id);
  list.innerHTML = `<p class="status">${found.length} résultat${found.length > 1 ? "s" : ""}</p>
    <div class="lesson results"><ul class="entries">${found.map(e => entryHTML(e, fresh, lessonOf(e.lesson_id))).join("")}</ul></div>`;
  bindEntries(list);
}

function renderLessonPage(l) {
  const page = $("#page"), fresh = currentNews();
  const index = carnet.state.lessons.indexOf(l), es = entriesOf(l.id), due = toReview(l.id);
  const sameLesson = page.dataset.lesson === l.id;
  const focusSel = sameLesson ? focusSelector(document.activeElement, page) : null;
  page.innerHTML = `<article class="lesson page" style="--c:${colorVar(l.color)}">
      <div class="lesson-head">
        <a class="back" href="${routeHash({ view: "home" })}">‹ Leçons</a>
        <div class="label">Leçon ${index + 1} · ${es.length} mot${es.length > 1 ? "s" : ""}</div>
        <span class="lesson-num" aria-hidden="true">${pad(index + 1)}</span>
        <h2 tabindex="-1">${l.emoji ? esc(l.emoji) + " " : ""}${esc(l.title)}</h2>
        <div class="page-actions">
          ${es.some(reviewable) ? `<button class="btn small page-review" type="button" data-review>${due ? `Réviser cette leçon (${due})` : "✓ À jour · réviser quand même"}</button>` : ""}
          <button class="edit" type="button" data-ledit="${esc(l.id)}">Modifier la leçon</button>
        </div>
      </div>
      <ul class="entries">${es.length ? es.map(e => entryHTML(e, fresh)).join("") : `<li class="empty-l">Rien encore dans cette leçon.</li>`}</ul>
      <div class="lesson-foot"><button class="add" type="button" data-add="${esc(l.id)}">+ Ajouter un mot, une phrase ou un conseil</button></div>
    </article>`;
  if (!sameLesson) { page.dataset.lesson = l.id; window.scrollTo(0, 0); $("h2", page).focus({ preventScroll: true }); }
  else if (focusSel) page.querySelector(focusSel)?.focus();
  $("[data-review]", page)?.addEventListener("click", () => openReview(l.id));
  $("[data-ledit]", page).onclick = () => openLesson(l);
  $("[data-add]", page).onclick = () => openEntry(null, l.id);
  bindEntries(page);
}

// Boutons des Entrées (écouter, modifier, essais, commentaires, image) dans une zone affichée.
function bindEntries(root) {
  const entry = id => carnet.state.entries.find(e => e.id === id);
  $$("[data-edit]", root).forEach(b => b.onclick = () => openEntry(entry(b.dataset.edit)));
  $$("[data-comments]", root).forEach(b => b.onclick = () => { const e = entry(b.dataset.comments); e && openComments(e); });
  $$("[data-try]", root).forEach(b => b.onclick = () => { const e = entry(b.dataset.try); e && openAttempt(e); });
  $$("[data-play]", root).forEach(b => b.onclick = () => { const e = entry(b.dataset.play); e && playPath(e.audio_path, b, e.id); });
  rebindPlaying(root);
  $$("[data-img]", root).forEach(img => {
    const e = entry(img.dataset.img);
    const show = u => {
      if (!u) { img.remove(); return; }
      img.src = u;
      img.onclick = () => zoom(u);
      img.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); zoom(u); } };
    };
    const hit = cachedUrl(e?.image_path);
    if (hit) show(hit); else mediaUrl(e?.image_path).then(show);
  });
}

function focusSelector(el, list) {
  if (!el || !list.contains(el)) return null;
  for (const k of ["edit", "try", "comments", "play", "ledit", "add", "img"]) {
    const v = el.dataset?.[k];
    if (v) return `[data-${k}="${CSS.escape(v)}"]`;
  }
  return null;
}

function zoom(url) {
  $("#zoomImg").src = url;
  $("#dlgZoom").showModal();
}
