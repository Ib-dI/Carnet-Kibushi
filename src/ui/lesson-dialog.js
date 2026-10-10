import { supabase } from "../lib/supabase.js";
import { removeMedia } from "../lib/media.js";
import { state, applyLocal } from "../state.js";
import { $, $$, esc, COLORS, EMOJIS, SAVE_ERROR } from "./dom.js";

// Renvoie un message d'erreur, ou null si tout s'est bien passé.
export async function createLesson({ title, emoji = "", color = "canard" }) {
  const position = state.lessons.length ? Math.max(...state.lessons.map(x => x.position || 0)) + 1 : 1;
  const { data, error } = await supabase.from("lessons").insert({ title, emoji, color, position }).select().single();
  if (error) return SAVE_ERROR;
  applyLocal("lessons", data, "INSERT");
  return null;
}

export function openLesson(l) {
  const dlg = $("#dlgLesson"), f = $("#formLesson");
  let color = l ? l.color : COLORS[state.lessons.length % COLORS.length][0];
  let emoji = l ? l.emoji || "" : "";
  const lessonEntries = () => l ? state.entries.filter(e => e.lesson_id === l.id) : [];

  const draw = (title = l ? l.title : "") => {
    f.innerHTML = `<h3>${l ? "Modifier la leçon" : "Nouvelle leçon"}</h3>
      <label class="field"><span>Thème</span><input id="lTitle" class="inp big" required placeholder="Ex. Les salutations" value="${esc(title)}"></label>
      <div class="field"><span>Emoji</span><div class="emojis" id="lEmo">${EMOJIS.map(x => `<button type="button" aria-pressed="${x === emoji}">${x}</button>`).join("")}</div></div>
      <div class="field"><span>Couleur du bandeau</span><div class="swatches" id="lCol">${COLORS.map(c => `<button type="button" class="sw" style="--s:var(--${c[0]})" data-c="${c[0]}" aria-label="${c[1]}" aria-pressed="${c[0] === color}"></button>`).join("")}</div></div>
      <div class="err" id="lErr" role="alert" hidden></div>
      <div class="actions">${l ? `<span id="lDelZone"><button class="btn small danger" type="button" id="lDel">Supprimer</button></span>` : "<span></span>"}
        <div class="right"><button class="btn ghost" type="button" id="lCancel">Annuler</button><button class="btn solid" id="lSave">${l ? "Enregistrer" : "Créer la leçon"}</button></div></div>`;

    $$("#lEmo button", f).forEach(b => b.onclick = () => {
      emoji = emoji === b.textContent ? "" : b.textContent;
      $$("#lEmo button", f).forEach(x => x.setAttribute("aria-pressed", x.textContent === emoji));
    });
    $$("#lCol .sw", f).forEach(b => b.onclick = () => {
      color = b.dataset.c;
      $$("#lCol .sw", f).forEach(x => x.setAttribute("aria-pressed", x.dataset.c === color));
    });
    $("#lCancel").onclick = () => dlg.close();
    if (l) $("#lDel").onclick = confirmDelete;
  };

  const showErr = msg => { const e = $("#lErr"); e.hidden = false; e.textContent = msg; };

  const confirmDelete = () => {
    const count = lessonEntries().length;
    $("#lDelZone").innerHTML = `<span class="confirm">${count ? `Supprimer aussi ses ${count} entrée${count > 1 ? "s" : ""} ?` : "Supprimer ?"}
      <button class="btn small danger" type="button" id="lDelYes">Oui</button><button class="btn small ghost" type="button" id="lDelNo">Non</button></span>`;
    $("#lDelNo").onclick = () => { draw($("#lTitle").value); $("#lDel").focus(); };
    $("#lDelYes").focus();
    $("#lDelYes").onclick = async () => {
      $("#lDelYes").disabled = true;
      const paths = lessonEntries().flatMap(e => [e.image_path, e.audio_path]);
      // Les entrées partent avec la leçon (on delete cascade).
      const { error } = await supabase.from("lessons").delete().eq("id", l.id);
      if (error) { draw($("#lTitle").value); showErr(SAVE_ERROR); return; }
      applyLocal("lessons", l, "DELETE");
      dlg.close();
      removeMedia(...paths);
    };
  };

  f.onsubmit = async ev => {
    ev.preventDefault();
    const title = $("#lTitle").value.trim();
    if (!title) { showErr("Donne un nom au thème."); $("#lTitle").focus(); return; }
    const btn = $("#lSave"); btn.disabled = true;
    let err = null;
    if (l) {
      const { data, error } = await supabase.from("lessons").update({ title, emoji, color }).eq("id", l.id).select().single();
      if (error) err = SAVE_ERROR; else applyLocal("lessons", data);
    } else {
      err = await createLesson({ title, emoji, color });
    }
    btn.disabled = false;
    if (err) { showErr(err); return; }
    dlg.close();
  };

  draw();
  dlg.showModal();
  $("#lTitle").focus();
}
