import { carnet } from "./carnet-ref.js";
import { cachedUrl, mediaUrl } from "../lib/media.js";
import { playPath, rebindPlaying } from "../lib/player.js";
import { $, $$, esc, colorVar, pad, fmtDate, PLAY_ICON, SUGGESTIONS, TYPES, errorText, lessonLabel } from "./dom.js";
import { entryFilter, isFiltering, blockFilter } from "./entry-filter.js";
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
import { openBlock } from "./block-dialog.js";
import { howtoHTML } from "./header.js";
import { onLongPress } from "./long-press.js";
import { blockHTML, BLOCK_TYPES } from "./rich.js";
import { positionAt, positionOf } from "../carnet/page.js";

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

// inLesson : en résultats de recherche, la Leçon où se trouve l'Entrée (lien vers sa page).
// num : rang du mot dans la page (affiché dans la pastille quand il n'a pas d'emoji).
function entryHTML(e, fresh, inLesson, num) {
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
    <div class="emo ${e.emoji ? "" : "num"}" aria-hidden="true">${e.emoji ? esc(e.emoji) : num ?? "·"}</div>
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
    <p class="err" id="suggErr" hidden></p>
    <div class="label">Comment on s'en sert</div>${howtoHTML()}</div>`;
}

// Les Entrées d'une Leçon, dans l'ordre d'ajout.
const entriesOf = lessonId => carnet.state.entries.filter(e => e.lesson_id === lessonId).sort((a, b) => time(a) - time(b));
// À réviser maintenant dans une Leçon : Cartes à revoir et nouvelles (comme « Réviser cette leçon »).
const toReview = lessonId => dailyItems(carnet.state.entries, carnet.state.progress, localToday(), { lessonId }).length;

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
    const words = entriesOf(l.id), due = toReview(l.id);
    const news = words.filter(e => fresh.entries.has(e.id)).length;
    const status = !words.some(reviewable) ? "" : due ? `<b>${due} à réviser</b>` : `<span class="ok">✓ à jour</span>`;
    return `<a class="tile" href="${routeHash({ view: "lesson", id: l.id })}" data-lesson="${esc(l.id)}" style="--c:${colorVar(l.color)}">
      <span class="tile-emo" aria-hidden="true">${esc(l.emoji || "📒")}</span>
      <span class="tile-title">${esc(l.title)}</span>
      <span class="tile-meta">${words.length ? `${words.length} mot${words.length > 1 ? "s" : ""}` : "Vide"}${status ? ` · ${status}` : ""}</span>
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
  $("#dlgLMenu")?.remove();
  const words = entriesOf(l.id).length, nb = carnet.state.blocks.filter(b => b.lesson_id === l.id).length;
  document.body.insertAdjacentHTML("beforeend", `<dialog id="dlgLMenu" aria-label="${esc(l.title)}"><div class="dlg lmenu" style="--c:${colorVar(l.color)}">
      <h3>${l.emoji ? esc(l.emoji) + " " : ""}${esc(l.title)}</h3>
      <div class="lmenu-actions" id="lmActions">
        <button type="button" class="menu-item" data-lm="open">📖 Ouvrir la leçon</button>
        <button type="button" class="menu-item" data-lm="edit">✎ Modifier (titre, emoji, couleur)</button>
        <button type="button" class="menu-item danger-text" data-lm="delete">🗑 Supprimer la leçon</button>
      </div>
      <div class="actions"><span></span><div class="right"><button class="btn ghost" type="button" data-lm="close">Annuler</button></div></div>
    </div></dialog>`);
  const dlg = $("#dlgLMenu");
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
  const act = {
    open: () => { dlg.close(); go({ view: "lesson", id: l.id }); },
    edit: () => { dlg.close(); openLesson(l); },
    close: () => dlg.close(),
    delete: () => {
      const what = (k, one, many) => k === 1 ? `son ${one}` : `ses ${k} ${many}`;
      const also = [words && what(words, "mot", "mots"), nb && what(nb, "bloc de texte", "blocs de texte")].filter(Boolean).join(" et ");
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
  dlg.showModal();
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

function renderLessonPage(l) {
  const page = $("#page"), fresh = currentNews();
  if (editing !== l.id) { editing = null; inserting = null; }
  const index = carnet.state.lessons.indexOf(l), es = entriesOf(l.id), due = toReview(l.id);
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
  // Numéro de chaque mot dans la page (les blocs de texte ne comptent pas).
  const nums = new Map(items.filter(it => it.kind === "entry").map((it, k) => [it.item.id, k + 1]));
  const row = (it, i) => it.kind === "block"
    ? `<li class="pg-block ${edit ? "editing" : ""}" data-bid="${esc(it.item.id)}">${blockHTML(it.item)}${tools(it, i)}</li>`
    : entryHTML(it.item, fresh, null, nums.get(it.item.id)).replace(/<\/li>\s*$/, `${tools(it, i)}</li>`);

  page.innerHTML = `<article class="lesson page ${edit ? "is-editing" : ""}" style="--c:${colorVar(l.color)}">
      <div class="lesson-head">
        <a class="back" href="${routeHash({ view: "home" })}">‹ Leçons</a>
        <div class="label">Leçon ${index + 1} · ${es.length} mot${es.length > 1 ? "s" : ""}</div>
        <span class="lesson-num" aria-hidden="true">${pad(index + 1)}</span>
        <h2 tabindex="-1">${l.emoji ? esc(l.emoji) + " " : ""}${esc(l.title)}</h2>
        <div class="page-actions">
          ${!edit && es.some(reviewable) ? `<button class="btn small page-review" type="button" data-review>${due ? `Réviser cette leçon (${due})` : "✓ À jour · réviser quand même"}</button>` : ""}
          <button class="edit" type="button" data-pedit>${edit ? "✓ Terminé" : "✎ Modifier la page"}</button>
          ${edit ? `<button class="edit" type="button" data-ledit="${esc(l.id)}">Titre, emoji, couleur…</button>` : ""}
        </div>
      </div>
      <ul class="entries page-blocks">${items.length || edit ? items.map((it, i) => insert(i) + row(it, i)).join("") + insert(items.length)
        : `<li class="empty-l">Rien encore dans cette leçon. Ajoute un mot, ou passe en « ✎ Modifier la page » pour écrire librement.</li>`}</ul>
      ${edit ? `<div class="lesson-foot danger-zone" id="lDelZone2"><button class="btn small danger" type="button" data-ldel>🗑 Supprimer cette leçon</button></div>`
        : `<div class="lesson-foot"><button class="add" type="button" data-add="${esc(l.id)}">+ Ajouter un mot, une phrase ou un conseil</button></div>`}
    </article>`;
  if (!sameLesson) { page.dataset.lesson = l.id; page.dataset.at = ""; window.scrollTo(0, 0); $("h2", page).focus({ preventScroll: true }); }
  else if (focusSel) page.querySelector(focusSel)?.focus();
  // Arrivée depuis une recherche : on montre le bloc trouvé, un court instant surligné.
  const at = currentRoute().at, target = at && page.querySelector(`[data-bid="${CSS.escape(at)}"]`);
  if (target && page.dataset.at !== at) {
    page.dataset.at = at;
    target.scrollIntoView({ block: "center" });
    target.classList.add("flash");
  }

  const rerender = () => renderLessonPage(l);
  $("[data-review]", page)?.addEventListener("click", () => openReview(l.id));
  $("[data-ledit]", page)?.addEventListener("click", () => openLesson(l));
  $("[data-add]", page)?.addEventListener("click", () => openEntry(null, l.id));
  $("[data-pedit]", page).onclick = () => { editing = edit ? null : l.id; inserting = null; rerender(); };
  // Supprimer la Leçon (mode « Modifier la page ») : confirmation sur place, qui dit ce qui part avec elle.
  $("[data-ldel]", page)?.addEventListener("click", () => {
    const zone = $("#lDelZone2"), nb = items.length - es.length;
    const what = (k, one, many) => k === 1 ? `son ${one}` : `ses ${k} ${many}`;
    const also = [es.length && what(es.length, "mot", "mots"), nb && what(nb, "bloc de texte", "blocs de texte")].filter(Boolean).join(" et ");
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
    const kind = b.dataset.new, position = positionAt(items.map(it => ({ position: positionOf(it) })), inserting);
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

function focusSelector(el, list) {
  if (!el || !list.contains(el)) return null;
  for (const k of ["edit", "try", "comments", "play", "ledit", "add", "img", "pedit", "insert", "up", "down", "bedit"]) {
    const v = el.dataset?.[k];
    if (v) return `[data-${k}="${CSS.escape(v)}"]`;
  }
  return null;
}

function zoom(url) {
  $("#zoomImg").src = url;
  $("#dlgZoom").showModal();
}
