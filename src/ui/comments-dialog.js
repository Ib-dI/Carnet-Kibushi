// Fenêtre « Commentaires » d'une Entrée : la conversation et un champ pour écrire.
import { carnet } from "./carnet-ref.js";
import { MAX_COMMENT } from "../carnet/carnet.js";
import { $, esc, errorText } from "./dom.js";
import { openSheet } from "./sheet.js";

const when = t => new Date(t).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function openComments(entry) {
  let off = () => {};
  const dlg = openSheet({ id: "dlgCom", label: "Commentaires", closeOnBackdrop: false, onClose: () => off(),
    html: `<form class="dlg" id="comForm" novalidate>
      <h3 id="comTitle"></h3>
      <div class="com-list" id="comList" aria-live="polite"></div>
      <label class="field"><span>Ton commentaire</span>
        <textarea id="comBody" class="inp" maxlength="${MAX_COMMENT}" placeholder="Ex. attention, l'accent est sur la 2e syllabe"></textarea></label>
      <div class="err" id="comErr" role="alert" hidden></div>
      <div class="actions"><span></span><div class="right">
        <button class="btn ghost" type="button" id="comClose">Fermer</button>
        <button class="btn solid" id="comSend">Envoyer</button></div></div>
    </form>` });
  if (!dlg) return;
  const list = $("#comList"), err = $("#comErr");
  const showErr = text => { err.hidden = !text; err.textContent = text || ""; };

  // Seule la liste se redessine (temps réel) : le texte en cours de saisie reste intact.
  function drawList() {
    const e = carnet.state.entries.find(x => x.id === entry.id);
    if (!e) { dlg.close(); return; }   // supprimée entre-temps
    $("#comTitle").textContent = `Commentaires · ${e.word || "…"}`;
    const comments = carnet.commentsOf(e.id);
    list.innerHTML = comments.length
      ? comments.map(c => {
          const who = carnet.authorName(c.author_email);
          return `<div class="com"><div class="com-meta">${esc(who === "toi" ? "Toi" : who || "Quelqu'un")} · ${esc(when(c.created_at))}${
            who === "toi" ? ` · <button class="mini" type="button" data-cdel="${esc(c.id)}">Supprimer</button>` : ""}</div>
            <div class="com-body">${esc(c.body)}</div></div>`;
        }).join("")
      : `<p class="status">Pas encore de commentaire. Une question, une correction ? Écris-la ici.</p>`;
    list.querySelectorAll("[data-cdel]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      const c = carnet.state.comments.find(x => x.id === b.dataset.cdel);
      const r = c ? await carnet.deleteComment(c) : { ok: true };
      showErr(r.ok ? "" : errorText(r));
    });
    list.scrollTop = list.scrollHeight;
  }

  $("#comClose").onclick = () => dlg.close();
  $("#comForm").onsubmit = async ev => {
    ev.preventDefault();
    const body = $("#comBody"), btn = $("#comSend");
    btn.disabled = true;
    const r = await carnet.addComment(entry.id, body.value);
    btn.disabled = false;
    if (!r.ok) { showErr(r.reason === "empty" ? "Écris quelque chose avant d'envoyer." : r.reason === "too-long" ? `${MAX_COMMENT} caractères au maximum.` : errorText(r)); return; }
    showErr("");
    body.value = "";
    body.focus();
  };

  off = carnet.onChange(drawList);
  drawList();
  $("#comBody").focus();
}
