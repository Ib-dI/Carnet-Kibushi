import { carnet } from "./carnet-ref.js";
import { cachedUrl, mediaUrl } from "../lib/media.js";
import { playPath, rebindPlaying } from "../lib/player.js";
import { $, $$, esc, colorVar, pad, fmtDate, PLAY_ICON, SUGGESTIONS, TYPES, errorText } from "./dom.js";
import { entryFilter, isFiltering } from "./entry-filter.js";
import { hardEntryIds } from "../revision/schedule.js";
import { openEntry } from "./entry-dialog.js";
import { openLesson } from "./lesson-dialog.js";

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

function entryHTML(e) {
  const tc = e.text_color ? `--tc:${colorVar(e.text_color)};` : "";
  const who = carnet.authorName(e.author_email);
  const metaLine = `<div class="meta">${who ? `Ajouté par ${esc(who)} · ` : ""}${fmtDate(e.created_at)} · <button class="mini" data-edit="${esc(e.id)}" type="button">Modifier</button></div>`;
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

export function renderLessons() {
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

  const hard = hardEntryIds(state.progress);
  const byLesson = {};
  state.entries.forEach(e => (byLesson[e.lesson_id] ||= []).push(e));
  let html = '<div class="grid">', shown = 0;
  state.lessons.forEach((l, i) => {
    const all = (byLesson[l.id] || []).sort((a, b) => time(a) - time(b));
    const es = all.filter(entryFilter(filter, hard));
    if (isFiltering(filter) && !es.length) return;
    shown++;
    html += `<article class="lesson" style="--c:${colorVar(l.color)}">
      <div class="lesson-head">
        <div class="label">Leçon ${i + 1} · ${all.length} entrée${all.length > 1 ? "s" : ""}</div>
        <span class="lesson-num" aria-hidden="true">${pad(i + 1)}</span>
        <h2>${l.emoji ? esc(l.emoji) + " " : ""}${esc(l.title)}</h2>
        <button class="edit" type="button" data-ledit="${esc(l.id)}">Modifier la leçon</button>
      </div>
      <ul class="entries">${es.length ? es.map(entryHTML).join("") : `<li class="empty-l">Rien encore dans cette leçon.</li>`}</ul>
      <div class="lesson-foot"><button class="add" type="button" data-add="${esc(l.id)}">+ Ajouter un mot, une phrase ou un conseil</button></div>
    </article>`;
  });
  html += "</div>";
  if (isFiltering(filter) && !shown) html = `<p class="status">${filter.query ? `Aucun résultat pour « ${esc(filter.query)} ».` : "Aucune entrée ne correspond à ces filtres."}</p>`;

  // Garder le focus clavier sur le même bouton après un re-rendu (temps réel).
  const focusSel = focusSelector(document.activeElement, list);
  list.innerHTML = html;
  if (focusSel) list.querySelector(focusSel)?.focus();

  const entry = id => carnet.state.entries.find(e => e.id === id);
  $$("[data-add]", list).forEach(b => b.onclick = () => openEntry(null, b.dataset.add));
  $$("[data-edit]", list).forEach(b => b.onclick = () => openEntry(entry(b.dataset.edit)));
  $$("[data-ledit]", list).forEach(b => b.onclick = () => openLesson(carnet.state.lessons.find(l => l.id === b.dataset.ledit)));
  $$("[data-play]", list).forEach(b => b.onclick = () => { const e = entry(b.dataset.play); e && playPath(e.audio_path, b, e.id); });
  rebindPlaying(list);
  $$("[data-img]", list).forEach(img => {
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
  for (const k of ["edit", "play", "ledit", "add", "img"]) {
    const v = el.dataset?.[k];
    if (v) return `[data-${k}="${CSS.escape(v)}"]`;
  }
  return null;
}

function zoom(url) {
  $("#zoomImg").src = url;
  $("#dlgZoom").showModal();
}
