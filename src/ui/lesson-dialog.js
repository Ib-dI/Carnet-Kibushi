import { carnet } from "./carnet-ref.js";
import { go, currentRoute } from "./route.js";
import { $, $$, esc, COLORS, EMOJIS, errorText } from "./dom.js";

const EMPTY_TITLE = "Donne un nom au thème.";

export function openLesson(l) {
  const dlg = $("#dlgLesson"), f = $("#formLesson");
  let color = l ? l.color : COLORS[carnet.state.lessons.length % COLORS.length][0];
  let emoji = l ? l.emoji || "" : "";
  const lessonEntries = () => l ? carnet.state.entries.filter(e => e.lesson_id === l.id) : [];

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
      const r = await carnet.deleteLesson(l);
      if (r.ok && currentRoute().id === l.id) go({ view: "home" });
      if (!r.ok) { draw($("#lTitle").value); showErr(errorText(r)); return; }
      dlg.close();
    };
  };

  f.onsubmit = async ev => {
    ev.preventDefault();
    const btn = $("#lSave"); btn.disabled = true;
    const r = await carnet.saveLesson(l || null, { title: $("#lTitle").value, emoji, color });
    if (r.ok && !l) go({ view: "lesson", id: r.value.id });   // une nouvelle Leçon s'ouvre aussitôt
    btn.disabled = false;
    if (!r.ok) { showErr(errorText(r, EMPTY_TITLE)); if (r.reason === "empty") $("#lTitle").focus(); return; }
    dlg.close();
  };

  draw();
  dlg.showModal();
  $("#lTitle").focus();
}
