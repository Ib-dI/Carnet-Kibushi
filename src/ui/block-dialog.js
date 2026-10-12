// Fenêtre d'un bloc de texte libre : le texte, avec un aperçu en direct de la mise en forme.
import { carnet } from "./carnet-ref.js";
import { $, $$, esc, COLORS, errorText } from "./dom.js";
import { blockHTML, BLOCK_TYPES } from "./rich.js";

const HINTS = {
  list: "Une ligne = un élément.", numbered: "Une ligne = une étape.",
};
const PLACEHOLDERS = {
  text: "Une explication, une règle, une astuce…", title: "Ex. Le matin", list: "mbote\nkwaheri",
  numbered: "Survole les mots-clés\n**Pause.** Ne lis pas tout de suite", quote: "Prédire, se tromper, corriger…",
  callout: "Ex. Prédis avec **logique**, jamais au hasard.",
};

// existing : bloc à modifier ; sinon { lesson_id, type, position } pour en créer un.
export function openBlock(existing, fresh = {}) {
  const prev = $("#dlgBlock");
  if (prev?.open) return;
  prev?.cleanup?.();
  const type = existing?.type || fresh.type;
  const label = BLOCK_TYPES.find(t => t[0] === type)?.[1] || "Texte";
  let color = existing?.color || "ocre";
  document.body.insertAdjacentHTML("beforeend", `<dialog id="dlgBlock" aria-label="${esc(label)}"><form class="dlg" id="blockForm" novalidate>
      <h3>${existing ? "Modifier" : "Ajouter"} · ${esc(label)}</h3>
      ${type === "callout" ? `<label class="field"><span>Titre de l'encadré <small>(facultatif)</small></span><input id="bTitle" class="inp" maxlength="200" value="${esc(existing?.title || "")}" placeholder="Ex. Pour l'exploiter à 100 %"></label>
        <div class="field"><span>Couleur</span><div class="swatches" id="bCol">${COLORS.map(c => `<button type="button" class="sw" style="--s:var(--${c[0]})" data-c="${c[0]}" aria-label="${c[1]}" aria-pressed="${c[0] === color}"></button>`).join("")}</div></div>` : ""}
      <label class="field"><span>${type === "title" ? "Titre" : "Texte"} <small>${HINTS[type] ? esc(HINTS[type]) + " " : ""}**gras**, *italique*</small></span>
        ${type === "title" ? `<input id="bBody" class="inp big" maxlength="200" value="${esc(existing?.body || "")}" placeholder="${esc(PLACEHOLDERS.title)}">`
          : `<textarea id="bBody" class="inp" maxlength="5000" rows="5" placeholder="${esc(PLACEHOLDERS[type] || "")}">${esc(existing?.body || "")}</textarea>`}</label>
      <div class="field"><span>Aperçu</span><div class="block-preview page-blocks" id="bPreview"></div></div>
      <div class="err" id="bErr" role="alert" hidden></div>
      <div class="actions">${existing ? `<button class="btn small danger" type="button" id="bDel">Supprimer</button>` : "<span></span>"}
        <div class="right"><button class="btn ghost" type="button" id="bCancel">Annuler</button><button class="btn solid" id="bSave">${existing ? "Enregistrer" : "Ajouter"}</button></div></div>
    </form></dialog>`);
  const dlg = $("#dlgBlock"), body = $("#bBody"), title = $("#bTitle");
  const values = () => ({ type, body: body.value, ...(type === "callout" ? { title: title.value.trim(), color } : {}) });
  const preview = () => { $("#bPreview").innerHTML = values().body.trim() || values().title ? blockHTML(values()) : `<p class="status">L'aperçu apparaît ici.</p>`; };
  const showErr = t => { const x = $("#bErr"); x.hidden = !t; x.textContent = t || ""; };

  body.addEventListener("input", preview);
  title?.addEventListener("input", preview);
  $$("#bCol .sw", dlg).forEach(b => b.onclick = () => {
    color = b.dataset.c;
    $$("#bCol .sw", dlg).forEach(x => x.setAttribute("aria-pressed", x.dataset.c === color));
    preview();
  });
  $("#bCancel").onclick = () => dlg.close();
  $("#bDel")?.addEventListener("click", async () => {
    const r = await carnet.deleteBlock(existing);
    if (r.ok) dlg.close(); else showErr(errorText(r));
  });
  $("#blockForm").onsubmit = async ev => {
    ev.preventDefault();
    const v = values();
    if (!v.body.trim() && !v.title) { showErr("Écris quelque chose, ou annule."); body.focus(); return; }
    const btn = $("#bSave"); btn.disabled = true;
    const r = await carnet.saveBlock(existing || null, existing ? v : { ...v, lesson_id: fresh.lesson_id, position: fresh.position });
    btn.disabled = false;
    if (r.ok) dlg.close(); else showErr(errorText(r));
  };
  dlg.cleanup = () => dlg.remove();
  dlg.addEventListener("close", dlg.cleanup);
  preview();
  dlg.showModal();
  body.focus();
}
