import { carnet } from "./carnet-ref.js";
import { cachedUrl, mediaUrl } from "../lib/media.js";
import { playPath, rebindPlaying } from "../lib/player.js";
import { $, $$, esc, colorVar, pad, fmtDate, PLAY_ICON, SUGGESTIONS, TYPES, errorText, lessonLabel, alsoText } from "./dom.js";
import { entryFilter, isFiltering, blockFilter } from "./entry-filter.js";
import { hardEntryIds } from "../revision/schedule.js";
import { openEntry } from "./entry-dialog.js";
import { openLesson } from "./lesson-dialog.js";
import { openAttempt } from "./attempt-dialog.js";
import { openComments } from "./comments-dialog.js";
import { currentNews } from "./news-ref.js";
import { currentRoute, routeHash, go } from "./route.js";
import { localToday } from "../revision/schedule.js";
import { openReview } from "./review.js";
import { openBlock } from "./block-dialog.js";
import { howtoHTML } from "./header.js";
import { onLongPress } from "./long-press.js";
import { openSheet } from "./sheet.js";
import { blockHTML, BLOCK_TYPES } from "./rich.js";
import { insertPositions } from "../carnet/page.js";
import { motion } from "./motion.js";
import { lessonStatus } from "../revision/stats.js";

const time = e => Date.parse(e.created_at) || 0;

let filter = { query: "", type: "", noAudio: false, hard: false };
export function setFilter(patch) { filter = { ...filter, ...patch }; renderLessons(); }

// Les filtres n'apparaissent que si on cherche ou qu'on les demande (bouton « Filtres »).
let filtersOpen = false;
export const showFilters = () => filtersOpen || isFiltering(filter);
export function toggleFilters() { filtersOpen = !filtersOpen; }

// Ligne de filtres sous la recherche : Type d'entrée, « sans Vocal », « Difficiles ».
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

// Ce qui compose une Entrée affichée, en liste comme en carte.
function entryParts(e, fresh, inLesson) {
  const tc = e.text_color ? `--tc:${colorVar(e.text_color)};` : "";
  const who = carnet.authorName(e.author_email);
  const tries = carnet.attemptsOf(e.id).length;
  const tryBtn = e.type === "conseil" ? "" : ` · <button class="mini" data-try="${esc(e.id)}" type="button">🎙 Essais${tries ? ` (${tries})` : ""}</button>`;
  const coms = carnet.commentsOf(e.id).length, newComs = fresh.comments.get(e.id) || 0;
  const comBtn = ` · <button class="mini" data-comments="${esc(e.id)}" type="button">💬 ${coms ? `Commentaires (${coms})` : "Commenter"}</button>${newComs ? `<span class="new-pill">${newComs} nouveau${newComs > 1 ? "x" : ""}</span>` : ""}`;
  const newPill = fresh.entries.has(e.id) ? `<span class="new-pill">nouveau</span>` : "";
  const newDot = newPill || newComs ? `<span class="new-dot" title="Du nouveau"></span>` : "";
  const where = inLesson ? `<a class="mini" href="${routeHash({ view: "lesson", id: inLesson.id })}">dans ${esc(lessonLabel(inLesson))}</a> · ` : "";
  const metaLine = `<div class="meta">${newPill}${where}${who ? `Ajouté par ${esc(who)} · ` : ""}${fmtDate(e.created_at)} · <button class="mini" data-edit="${esc(e.id)}" type="button">Modifier</button>${tryBtn}${comBtn}</div>`;
  const play = e.audio_path ? `<button class="play" type="button" data-play="${esc(e.id)}" aria-label="Écouter ${esc(e.word || "le vocal")}">${PLAY_ICON}</button>` : "";
  const thumb = e.image_path ? `<img class="thumb" data-img="${esc(e.id)}" alt="Image pour ${esc(e.word || "cette entrée")}" role="button" tabindex="0">` : "";
  return { tc, newDot, metaLine, play, thumb };
}

// Petite carte de la vue Grille : le mot et sa traduction devant ; au dos, le détail et les actions.
function cardHTML(e, fresh, num) {
  const { tc, newDot, play, thumb } = entryParts(e, fresh, null);
  const back = flipped.has(e.id), label = `Retourner la carte ${esc(e.word || "")}`;
  const tries = carnet.attemptsOf(e.id).length, coms = carnet.commentsOf(e.id).length;
  const count = n => n ? ` ${n}` : "";
  return `<li class="card ${back ? "flipped" : ""}" data-eid="${esc(e.id)}" style="${tc}"><div class="card-in">
    <div class="face front" ${back ? "inert" : ""}>
      <div class="card-top"><div class="emo ${e.emoji ? "" : "num"}" aria-hidden="true">${e.emoji ? esc(e.emoji) : num ?? "·"}</div>${play}</div>
      ${thumb}
      <button type="button" class="card-flip" data-flip="${esc(e.id)}" aria-label="${label}">
        <span class="word">${esc(e.word || "…")}${newDot}</span>
        ${e.translation ? `<span class="tr">${esc(e.translation)}</span>` : ""}</button>
    </div>
    <div class="face back" ${back ? "" : "inert"}>
      <button type="button" class="card-flip" data-flip="${esc(e.id)}" aria-label="${label}">
        <span class="word">${esc(e.word || "…")}</span>
        ${e.pron ? `<span class="pron">[ ${esc(e.pron)} ]</span>` : ""}
        ${e.note ? `<span class="note">${esc(e.note)}</span>` : ""}</button>
      <div class="card-acts">
        <button type="button" class="pg-btn" data-edit="${esc(e.id)}" aria-label="Modifier" title="Modifier">✎</button>
        <button type="button" class="pg-btn" data-try="${esc(e.id)}" aria-label="Essais${count(tries)}" title="Essais">🎙${count(tries)}</button>
        <button type="button" class="pg-btn" data-comments="${esc(e.id)}" aria-label="Commentaires${count(coms)}" title="Commentaires">💬${count(coms)}</button>
      </div>
    </div></div></li>`;
}

// inLesson : en résultats de recherche, la Leçon où se trouve l'Entrée (lien vers sa page).
// num : rang du mot dans la page (affiché dans la pastille quand il n'a pas d'emoji).
function entryHTML(e, fresh, inLesson, num) {
  const { tc, newDot, metaLine, play, thumb } = entryParts(e, fresh, inLesson);
  if (e.type === "conseil") {
    return `<li class="entry" data-eid="${esc(e.id)}" style="${tc}"><div class="tip">
      <div class="tip-row"><span class="label">${e.emoji ? esc(e.emoji) : "💡"} Conseil</span>${play}</div>
      ${e.word ? `<div class="word">${esc(e.word)}${newDot}</div>` : ""}
      ${e.translation ? `<div class="note">${esc(e.translation)}</div>` : ""}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ""}
      ${thumb}${metaLine}</div></li>`;
  }
  return `<li class="entry ${e.type === "phrase" ? "phrase" : ""}" data-eid="${esc(e.id)}" style="${tc}">
    <div class="emo ${e.emoji ? "" : "num"}" aria-hidden="true">${e.emoji ? esc(e.emoji) : num ?? "·"}</div>
    <div class="e-main">
      <div class="word">${esc(e.word || "…")}${newDot}</div>
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
    <p class="err" id="suggErr" hidden></p>
    <div class="label">Comment on s'en sert</div>${howtoHTML()}</div>`;
}

// État d'une Leçon (mots, Cartes, à réviser maintenant) : voir revision/stats.js.
const statusOf = lessonId => lessonStatus(carnet.state.entries, carnet.state.progress, lessonId, localToday());

// Onglet « Leçons » : le sommaire (#/) ou la page d'une Leçon (#/lecon/<id>).
export function renderLessons() {
  const route = currentRoute();
  const lesson = route.view === "lesson" && carnet.state.lessons.find(l => l.id === route.id);
  if (route.view === "lesson" && !lesson) { go({ view: "home" }); return; }   // Leçon supprimée
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
    const { words, cards, toReview: due } = statusOf(l.id);
    const news = state.entries.filter(e => e.lesson_id === l.id && fresh.entries.has(e.id)).length;
    const status = !cards ? "" : due ? `<b>${due} à réviser</b>` : `<span class="ok">✓ à jour</span>`;
    return `<a class="tile" href="${routeHash({ view: "lesson", id: l.id })}" data-lesson="${esc(l.id)}" style="--c:${colorVar(l.color)}">
      <span class="tile-emo" aria-hidden="true">${esc(l.emoji || "📒")}</span>
      <span class="tile-title">${esc(l.title)}</span>
      <span class="tile-meta">${words ? `${words} mot${words > 1 ? "s" : ""}` : "Vide"}${status ? ` · ${status}` : ""}</span>
      ${news ? `<span class="new-pill tile-new">${news} nouveau${news > 1 ? "x" : ""}</span>` : ""}
    </a>`;
  }).join("")}
    <button class="tile tile-add" type="button" data-newlesson><span class="tile-emo" aria-hidden="true">＋</span><span class="tile-title">Nouvelle leçon</span></button>
  </div>`;
  $("[data-newlesson]", list).onclick = () => openLesson();
  $$("[data-lesson]", list).forEach(t => onLongPress(t, () => {
    const l = carnet.state.lessons.find(x => x.id === t.dataset.lesson);
    if (l) openLessonMenu(l);
  }));
}

// Menu d'une Leçon (appui long sur sa tuile) : modifier, ou supprimer avec confirmation.
function openLessonMenu(l) {
  const dlg = openSheet({ id: "dlgLMenu", label: l.title, html: `<div class="dlg lmenu" style="--c:${colorVar(l.color)}">
      <h3>${l.emoji ? esc(l.emoji) + " " : ""}${esc(l.title)}</h3>
      <div class="lmenu-actions" id="lmActions">
        <button type="button" class="menu-item" data-lm="open">📖 Ouvrir la leçon</button>
        <button type="button" class="menu-item" data-lm="edit">✎ Modifier (titre, emoji, couleur)</button>
        <button type="button" class="menu-item danger-text" data-lm="delete">🗑 Supprimer la leçon</button>
      </div>
      <div class="actions"><span></span><div class="right"><button class="btn ghost" type="button" data-lm="close">Annuler</button></div></div>
    </div>` });
  if (!dlg) return;
  const act = {
    open: () => { dlg.close(); go({ view: "lesson", id: l.id }); },
    edit: () => { dlg.close(); openLesson(l); },
    close: () => dlg.close(),
    delete: () => {
      const also = alsoText(carnet.footprintOf({ lesson: l }));
      $("#lmActions").innerHTML = `<p class="confirm">Supprimer « ${esc(l.title)} »${also ? `, avec ${also}` : ""} ? C'est définitif.</p>
        <button type="button" class="btn danger" id="lmYes">Oui, supprimer</button>`;
      $("#lmYes").focus();
      $("#lmYes").onclick = async () => {
        $("#lmYes").disabled = true;
        const r = await carnet.deleteLesson(l);
        if (r.ok) { dlg.close(); return; }
        $("#lmActions").insertAdjacentHTML("beforeend", `<p class="err" role="alert">${esc(errorText(r))}</p>`);
      };
    },
  };
  dlg.addEventListener("click", ev => { const k = ev.target.closest("[data-lm]")?.dataset.lm; if (k) act[k](); });
  $("[data-lm=open]", dlg).focus();
}

// Recherche ou filtre actif : la liste des Entrées trouvées, toutes Leçons confondues.
function renderResults(list) {
  const hard = hardEntryIds(carnet.state.progress), fresh = currentNews();
  const found = carnet.state.entries.filter(entryFilter(filter, hard)).sort((a, b) => time(a) - time(b));
  const blocks = carnet.state.blocks.filter(blockFilter(filter));
  if (!found.length && !blocks.length) {
    list.innerHTML = `<p class="status">${filter.query ? `Aucun résultat pour « ${esc(filter.query)} ».` : "Aucune entrée ne correspond à ces filtres."}</p>`;
    return;
  }
  const lessonOf = id => carnet.state.lessons.find(l => l.id === id);
  const n = found.length + blocks.length;
  const notes = blocks.map(b => {
    const l = lessonOf(b.lesson_id);
    return `<a class="note-hit" href="${routeHash({ view: "lesson", id: b.lesson_id, at: b.id })}" style="--c:${colorVar(l?.color)}">
      <span class="note-hit-where">📝 dans ${esc(l ? lessonLabel(l) : "une leçon")}</span>${blockHTML(b)}</a>`;
  }).join("");
  list.innerHTML = `<p class="status">${n} résultat${n > 1 ? "s" : ""}</p>${notes}
    ${found.length ? `<div class="lesson results"><ul class="entries">${found.map(e => entryHTML(e, fresh, lessonOf(e.lesson_id))).join("")}</ul></div>` : ""}`;
  bindEntries(list);
}

// Leçon dont la page est en mode « Modifier la page » (poignées visibles), et point d'insertion ouvert.
let editing = null, inserting = null;

// Affichage de la page, mémorisé sur l'appareil : « Essentiel » (mot, prononciation, traduction, écoute ;
// par défaut), « Complet », ou « Grille » de petites cartes qui se retournent.
const VIEWS = [["essential", "Essentiel"], ["full", "Complet"], ["grid", "Grille"]];
const VIEW_KEY = "carnet.page.view";
let pageView = (() => {
  try {
    const v = localStorage.getItem(VIEW_KEY) || (localStorage.getItem("carnet.page.full") === "1" ? "full" : "");
    return VIEWS.some(([k]) => k === v) ? v : "essential";
  } catch { return "essential"; }
})();
function setPageView(v) {
  pageView = v;
  try { localStorage.setItem(VIEW_KEY, v); localStorage.removeItem("carnet.page.full"); } catch {}
}
// Cartes retournées (vue Grille), gardées d'un rafraîchissement à l'autre.
const flipped = new Set();

function renderLessonPage(l) {
  const page = $("#page"), fresh = currentNews();
  if (editing !== l.id) { editing = null; inserting = null; }
  const index = carnet.state.lessons.indexOf(l), { words, cards, toReview: due } = statusOf(l.id);
  const items = carnet.pageOf(l.id), edit = editing === l.id;
  const sameLesson = page.dataset.lesson === l.id;
  const focusSel = sameLesson ? focusSelector(document.activeElement, page) : null;

  const tools = (it, i) => !edit ? "" : `<div class="pg-tools">
      ${it.kind === "block" && it.item.type !== "divider" ? `<button type="button" class="pg-btn" data-bedit="${i}" aria-label="Modifier ce bloc">✎</button>` : ""}
      ${it.kind === "block" && it.item.type === "divider" ? `<button type="button" class="pg-btn" data-bdel="${i}" aria-label="Supprimer ce séparateur">🗑</button>` : ""}
      <button type="button" class="pg-btn" data-up="${i}" aria-label="Monter" ${i === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="pg-btn" data-down="${i}" aria-label="Descendre" ${i === items.length - 1 ? "disabled" : ""}>↓</button></div>`;
  const insert = i => !edit ? "" : inserting === i
    ? `<li class="pg-insert open"><div class="chips">
        <button type="button" class="chip" data-new="entry">Mot, phrase…</button>
        ${BLOCK_TYPES.map(([t, label]) => `<button type="button" class="chip" data-new="${t}">${esc(label)}</button>`).join("")}
        <button type="button" class="chip ghost" data-new="" aria-label="Annuler">✕</button></div></li>`
    : `<li class="pg-insert"><button type="button" class="pg-plus" data-insert="${i}" aria-label="Ajouter ici">+</button></li>`;
  const row = (it, i) => it.kind === "block"
    ? `<li class="pg-block ${edit ? "editing" : ""}" data-bid="${esc(it.item.id)}">${blockHTML(it.item)}${tools(it, i)}</li>`
    : entryHTML(it.item, fresh, null, it.num).replace(/<\/li>\s*$/, `${tools(it, i)}</li>`);

  const view = edit ? "full" : pageView;
  // Grille : les mots se suivent en cartes ; blocs et Conseils restent en pleine largeur entre elles.
  const gridBody = () => {
    let html = "", run = [];
    const flush = () => { if (run.length) html += `<li class="pg-grid"><ul class="cards">${run.join("")}</ul></li>`; run = []; };
    items.forEach((it, i) => {
      if (it.kind === "entry" && it.item.type !== "conseil") run.push(cardHTML(it.item, fresh, it.num));
      else { flush(); html += row(it, i); }
    });
    flush();
    return html;
  };
  page.innerHTML = `<article class="lesson page ${edit ? "is-editing" : ""} is-${view}" style="--c:${colorVar(l.color)}">
      <div class="lesson-head">
        <a class="back" href="${routeHash({ view: "home" })}">‹ Leçons</a>
        <div class="label">Leçon ${index + 1} · ${words} mot${words > 1 ? "s" : ""}</div>
        <span class="lesson-num" aria-hidden="true">${pad(index + 1)}</span>
        <h2 tabindex="-1">${l.emoji ? esc(l.emoji) + " " : ""}${esc(l.title)}</h2>
        <div class="page-actions">
          ${!edit && cards ? `<button class="btn small page-review" type="button" data-review>${due ? `Réviser cette leçon (${due})` : "✓ À jour · réviser quand même"}</button>` : ""}
          ${!edit && items.length ? `<div class="view-seg" role="group" aria-label="Affichage">${VIEWS.map(([k, label]) =>
            `<button type="button" data-view="${k}" aria-pressed="${view === k}">${label}</button>`).join("")}</div>` : ""}
          <button class="edit" type="button" data-pedit>${edit ? "✓ Terminé" : "✎ Modifier la page"}</button>
          ${edit ? `<button class="edit" type="button" data-ledit="${esc(l.id)}">Titre, emoji, couleur…</button>` : ""}
        </div>
      </div>
      <ul class="entries page-blocks">${view === "grid" && items.length ? gridBody()
        : items.length || edit ? items.map((it, i) => insert(i) + row(it, i)).join("") + insert(items.length)
        : `<li class="empty-l">Rien encore dans cette leçon. Ajoute un mot, ou passe en « ✎ Modifier la page » pour écrire librement.</li>`}</ul>
      ${edit ? `<div class="lesson-foot danger-zone" id="lDelZone2"><button class="btn small danger" type="button" data-ldel>🗑 Supprimer cette leçon</button></div>`
        : `<button class="fab" type="button" data-add="${esc(l.id)}" aria-label="Ajouter un mot, une phrase ou un conseil" title="Ajouter un mot, une phrase ou un conseil">+</button>`}
    </article>`;
  if (!sameLesson) { page.dataset.lesson = l.id; page.dataset.at = ""; window.scrollTo(0, 0); $("h2", page).focus({ preventScroll: true }); }
  else if (focusSel) page.querySelector(focusSel)?.focus();
  // Arrivée depuis une recherche : on montre le bloc trouvé, un court instant surligné.
  const at = currentRoute().at, target = at && page.querySelector(`[data-bid="${CSS.escape(at)}"]`);
  if (target && page.dataset.at !== at) {
    page.dataset.at = at;
    showAndFlash(target);
  }

  const rerender = () => renderLessonPage(l);
  $("[data-review]", page)?.addEventListener("click", () => openReview(l.id));
  $("[data-ledit]", page)?.addEventListener("click", () => openLesson(l));
  // Le mot ajouté arrive en fin de page : on y descend et on le surligne.
  $("[data-add]", page)?.addEventListener("click", () => openEntry(null, l.id, {
    onSaved: row => { const li = page.querySelector(`[data-eid="${CSS.escape(row.id)}"]`); li && showAndFlash(li); },
  }));
  $$("[data-view]", page).forEach(b => b.onclick = () => switchView(page, b.dataset.view, rerender));
  $$("[data-flip]", page).forEach(b => b.onclick = () => {
    const id = b.dataset.flip;
    if (!flipped.delete(id)) flipped.add(id);
    const card = b.closest(".card"), back = flipped.has(id);
    card.classList.toggle("flipped", back);
    $(".front", card).inert = back; $(".back", card).inert = !back;
    $(`.${back ? "back" : "front"} [data-flip]`, card).focus({ preventScroll: true });
  });
  $("[data-pedit]", page).onclick = () => { editing = edit ? null : l.id; inserting = null; rerender(); };
  // Supprimer la Leçon (mode « Modifier la page ») : confirmation sur place, qui dit ce qui part avec elle.
  $("[data-ldel]", page)?.addEventListener("click", () => {
    const zone = $("#lDelZone2"), also = alsoText(carnet.footprintOf({ lesson: l }));
    zone.innerHTML = `<span class="confirm">Supprimer « ${esc(l.title)} »${also ? `, avec ${also}` : ""} ?
      <button class="btn small danger" type="button" id="lDelYes2">Oui, supprimer</button>
      <button class="btn small ghost" type="button" id="lDelNo2">Non</button></span>`;
    $("#lDelYes2").focus();
    $("#lDelNo2").onclick = rerender;
    $("#lDelYes2").onclick = async () => {
      $("#lDelYes2").disabled = true;
      const r = await carnet.deleteLesson(l);
      if (r.ok) { editing = null; go({ view: "home" }); return; }
      zone.innerHTML = `<p class="err" role="alert">${esc(errorText(r))}</p>`;
    };
  });
  $$("[data-insert]", page).forEach(b => b.onclick = () => { inserting = +b.dataset.insert; rerender(); $("[data-new]", page)?.focus(); });
  $$("[data-new]", page).forEach(b => b.onclick = async () => {
    const kind = b.dataset.new, position = insertPositions(items)[inserting];
    inserting = null;
    if (kind === "entry") openEntry(null, l.id, { position });
    else if (kind === "divider") await carnet.saveBlock(null, { lesson_id: l.id, type: "divider", position });
    else if (kind) openBlock(null, { lesson_id: l.id, type: kind, position });
    rerender();
  });
  $$("[data-bedit]", page).forEach(b => b.onclick = () => openBlock(items[+b.dataset.bedit].item));
  $$("[data-bdel]", page).forEach(b => b.onclick = () => carnet.deleteBlock(items[+b.dataset.bdel].item));
  $$("[data-up]", page).forEach(b => b.onclick = () => carnet.move(items[+b.dataset.up], "up"));
  $$("[data-down]", page).forEach(b => b.onclick = () => carnet.move(items[+b.dataset.down], "down"));
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

// Changer d'affichage : chaque mot et chaque bloc glisse de sa place à la nouvelle (une ligne devient une carte).
function switchView(page, view, rerender) {
  if (view === pageView) return;
  const names = () => $$("[data-eid], [data-bid]", page).map(el => [el.dataset.eid ? `e-${el.dataset.eid}` : `b-${el.dataset.bid}`, el]);
  motion.transition(() => { setPageView(view); rerender(); }, { type: "view", names });
}

// Pour l'effet tuile ↔ en-tête (app-shell.js) : la tuile d'une Leçon au sommaire, l'en-tête de la Page ouverte.
export const lessonTile = id => document.querySelector(`#home .tile[data-lesson="${CSS.escape(id || "")}"]`);
export const lessonHead = () => $("#page .lesson-head");
export const openLessonId = () => $("#page").dataset.lesson;

function showAndFlash(el) {
  el.scrollIntoView({ block: "center", behavior: motion.reduced() ? "auto" : "smooth" });
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}

function focusSelector(el, list) {
  if (!el || !list.contains(el)) return null;
  for (const k of ["edit", "try", "comments", "play", "ledit", "add", "img", "view", "flip", "pedit", "insert", "up", "down", "bedit"]) {
    const v = el.dataset?.[k];
    if (v) return `[data-${k}="${CSS.escape(v)}"]`;
  }
  return null;
}

function zoom(url) {
  $("#zoomImg").src = url;
  $("#dlgZoom").showModal();
}
