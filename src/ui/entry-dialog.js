import { mediaUrl, resizeImage } from "../lib/media.js";
import { MAX_MEDIA_BYTES } from "../carnet/carnet.js";
import { startRecording, canRecord, fmtTime, MAX_SECONDS } from "../lib/recorder.js";
import { stopPlayback } from "../lib/player.js";
import { carnet } from "./carnet-ref.js";
import { $, $$, esc, COLORS, EMOJIS, TYPES, TOO_LARGE, errorText, lessonLabel } from "./dom.js";

const MIC_BLOCKED = "Le micro est bloqué. Autorise-le dans les réglages du navigateur, ou choisis un fichier.";
const MIC_FAILED = "Le micro ne répond pas. Choisis plutôt un fichier audio.";
const EMPTY_ENTRY = "Écris au moins le mot, la traduction, ou ajoute un vocal.";

// État d'un Média pour saveEntry : remplacé, retiré ou gardé.
const mediaChange = (blob, removed) => blob ? { replace: blob } : removed ? { remove: true } : { keep: true };

export function openEntry(e, lessonId) {
  const dlg = $("#dlgEntry"), f = $("#formEntry");
  const st = {
    type: e ? e.type : "mot", emoji: e ? e.emoji || "" : "", tc: e ? e.text_color || "" : "",
    lesson: e ? e.lesson_id : lessonId,
    image: e ? e.image_path || null : null, audio: e ? e.audio_path || null : null,
    newImage: null, newAudio: null, removeImage: false, removeAudio: false,
    rec: null, recSecs: 0, recError: "",
    values: { word: e?.word || "", pron: e?.pron || "", tr: e?.translation || "", note: e?.note || "" },
  };
  const urls = [];
  const objectUrl = blob => { const u = URL.createObjectURL(blob); urls.push(u); return u; };

  const keep = () => {
    st.values = { word: $("#eWord")?.value ?? st.values.word, pron: $("#ePron")?.value ?? st.values.pron,
      tr: $("#eTr")?.value ?? st.values.tr, note: $("#eNote")?.value ?? st.values.note };
    const sel = $("#eLesson"); if (sel) st.lesson = sel.value;
  };

  const draw = () => {
    const isTip = st.type === "conseil", v = st.values;
    f.innerHTML = `<h3>${e ? "Modifier" : "Ajouter"}</h3>
      <div class="field"><span id="eTypeLbl">Type</span><div class="chips" id="eType" role="group" aria-labelledby="eTypeLbl">${TYPES.map(t => `<button type="button" class="chip" data-t="${t[0]}" aria-pressed="${t[0] === st.type}">${t[1]}</button>`).join("")}</div></div>
      <label class="field"><span>${isTip ? "Le conseil" : "Dans la langue"} ${isTip ? "" : "<small>(écris-le comme ça se dit, à ta façon)</small>"}</span>
        <input id="eWord" class="inp big" value="${esc(v.word)}" placeholder="${isTip ? "Ex. On salue toujours les anciens en premier" : "Ex. mbote"}"></label>
      ${isTip ? "" : `<label class="field"><span>Prononciation <small>(ta notation, facultatif)</small></span><input id="ePron" class="inp" value="${esc(v.pron)}" placeholder="Ex. m-bo-té, accent sur bo"></label>`}
      <label class="field"><span>${isTip ? "En détail" : "Traduction en français"}</span><input id="eTr" class="inp" value="${esc(v.tr)}" placeholder="${isTip ? "" : "Ex. bonjour"}"></label>
      <label class="field"><span>Note, exemple ou contexte <small>(facultatif)</small></span><textarea id="eNote" class="inp" placeholder="Ex. se dit le matin, à une personne plus âgée">${esc(v.note)}</textarea></label>
      <div class="field"><span>Emoji</span><div class="emojis" id="eEmo">${EMOJIS.map(x => `<button type="button" aria-pressed="${x === st.emoji}">${x}</button>`).join("")}</div></div>
      <div class="field"><span>Couleur du texte</span><div class="swatches" id="eCol"><button type="button" class="sw none" data-c="" aria-label="Couleur normale" aria-pressed="${!st.tc}"></button>${COLORS.map(c => `<button type="button" class="sw" style="--s:var(--${c[0]})" data-c="${c[0]}" aria-label="${c[1]}" aria-pressed="${c[0] === st.tc}"></button>`).join("")}</div></div>
      <div class="row2">
        <div class="field"><span>Image</span><div class="media" id="eImg"></div></div>
        <div class="field"><span>Vocal</span><div class="media" id="eAud"></div></div>
      </div>
      <label class="field"><span>Leçon</span><select id="eLesson" class="inp">${carnet.state.lessons.map(l => `<option value="${esc(l.id)}" ${l.id === st.lesson ? "selected" : ""}>${esc(lessonLabel(l))}</option>`).join("")}</select></label>
      <div class="err" id="eErr" role="alert" hidden></div>
      <div class="actions">${e ? `<span id="eDelZone"><button class="btn small danger" type="button" id="eDel">Supprimer</button></span>` : "<span></span>"}
        <div class="right"><button class="btn ghost" type="button" id="eCancel">Annuler</button><button class="btn solid" id="eSave">Enregistrer</button></div></div>`;

    $$("#eType .chip", f).forEach(b => b.onclick = () => { keep(); st.type = b.dataset.t; draw(); $(`#eType [data-t="${st.type}"]`).focus(); });
    $$("#eEmo button", f).forEach(b => b.onclick = () => {
      st.emoji = st.emoji === b.textContent ? "" : b.textContent;
      $$("#eEmo button", f).forEach(x => x.setAttribute("aria-pressed", x.textContent === st.emoji));
    });
    $$("#eCol .sw", f).forEach(b => b.onclick = () => {
      st.tc = b.dataset.c;
      $$("#eCol .sw", f).forEach(x => x.setAttribute("aria-pressed", x.dataset.c === st.tc));
    });
    drawImage(); drawAudio();
    $("#eCancel").onclick = () => dlg.close();
    if (e) $("#eDel").onclick = confirmDelete;
  };

  /* ---------- Image ---------- */
  const drawImage = () => {
    const im = $("#eImg");
    if (st.newImage) {
      im.innerHTML = `<img src="${objectUrl(st.newImage)}" alt="Aperçu de la photo"><button type="button" class="btn small ghost" id="imgX">Retirer</button>`;
    } else if (st.image && !st.removeImage) {
      im.innerHTML = `<img id="imgOld" alt="Photo actuelle"><button type="button" class="btn small ghost" id="imgX">Retirer</button>`;
      mediaUrl(st.image).then(u => { const x = $("#imgOld"); if (x && u) x.src = u; });
    } else {
      im.innerHTML = `<label class="btn small filebtn">Ajouter une photo<input type="file" accept="image/*" id="imgIn"></label>`;
    }
    const ix = $("#imgX");
    if (ix) ix.onclick = () => { if (st.newImage) st.newImage = null; else st.removeImage = true; drawImage(); };
    const ii = $("#imgIn");
    if (ii) ii.onchange = () => { if (ii.files[0]) { st.newImage = ii.files[0]; st.removeImage = true; drawImage(); } };
  };

  /* ---------- Vocal ---------- */
  const drawAudio = () => {
    const au = $("#eAud");
    const err = st.recError ? `<p class="err" role="alert">${esc(st.recError)}</p>` : "";
    if (st.rec) {
      au.innerHTML = `<button type="button" class="rec-btn on" id="recBtn" aria-label="Arrêter l'enregistrement">■</button>
        <span class="rec-time" aria-live="off" id="recTime">${fmtTime(st.recSecs)}</span><span class="status">Clique pour arrêter</span>`;
      $("#recBtn").onclick = stopRec;
      return;
    }
    const current = st.newAudio || (st.audio && !st.removeAudio);
    if (current) {
      au.innerHTML = `<audio controls id="audPrev" ${st.newAudio ? `src="${objectUrl(st.newAudio)}"` : ""}></audio>
        ${canRecord() ? `<button type="button" class="btn small ghost" id="audRedo">Refaire</button>` : ""}
        <button type="button" class="btn small ghost" id="audX">Retirer</button>${err}`;
      if (!st.newAudio) mediaUrl(st.audio).then(u => { const x = $("#audPrev"); if (x && u) x.src = u; });
    } else {
      au.innerHTML = `${canRecord() ? `<button type="button" class="rec-btn" id="recBtn" aria-label="Enregistrer un vocal">🎙</button><span class="rec-time">0:00</span>` : ""}
        <label class="btn small ghost filebtn">Choisir un fichier<input type="file" accept="audio/*,.m4a,.mp3,.ogg,.opus,.wav,.aac" id="audIn"></label>${err}`;
    }
    const rb = $("#recBtn"); if (rb) rb.onclick = startRec;
    const redo = $("#audRedo"); if (redo) redo.onclick = startRec;
    const ax = $("#audX");
    if (ax) ax.onclick = () => { if (st.newAudio) st.newAudio = null; else st.removeAudio = true; st.recError = ""; drawAudio(); };
    const ai = $("#audIn");
    if (ai) ai.onchange = () => {
      const file = ai.files[0]; if (!file) return;
      if (file.size > MAX_MEDIA_BYTES) { st.recError = TOO_LARGE.audio; drawAudio(); return; }
      st.newAudio = file; st.removeAudio = true; st.recError = ""; drawAudio();
    };
  };

  const startRec = async () => {
    stopPlayback();
    $$("#eAud audio").forEach(a => a.pause());
    st.recError = ""; st.recSecs = 0;
    try {
      st.rec = await startRecording(s => {
        st.recSecs = s;
        const t = $("#recTime"); if (t) t.textContent = fmtTime(s);
        if (s >= MAX_SECONDS) stopRec();
      });
    } catch (x) {
      st.rec = null;
      st.recError = x && (x.name === "NotAllowedError" || x.name === "SecurityError") ? MIC_BLOCKED : MIC_FAILED;
      drawAudio(); return;
    }
    if (!dlg.open) { st.rec.cancel(); st.rec = null; return; }
    drawAudio();
    $("#recBtn")?.focus();
  };
  const stopRec = async () => {
    const r = st.rec; if (!r) return;
    st.rec = null;
    const blob = await r.stop();
    if (!blob.size) { st.recError = MIC_FAILED; drawAudio(); return; }
    st.newAudio = blob; st.removeAudio = true;
    drawAudio();
  };

  /* ---------- Suppression ---------- */
  const confirmDelete = () => {
    keep();
    $("#eDelZone").innerHTML = `<span class="confirm">Supprimer cette entrée ? <button class="btn small danger" type="button" id="eYes">Oui</button><button class="btn small ghost" type="button" id="eNo">Non</button></span>`;
    $("#eYes").focus();
    $("#eNo").onclick = () => { keep(); draw(); $("#eDel").focus(); };
    $("#eYes").onclick = async () => {
      $("#eYes").disabled = true;
      const r = await carnet.deleteEntry(e);
      if (!r.ok) { draw(); showErr(errorText(r)); return; }
      dlg.close();
    };
  };

  const showErr = msg => { const x = $("#eErr"); x.hidden = false; x.textContent = msg; };

  /* ---------- Enregistrer ---------- */
  f.onsubmit = async ev => {
    ev.preventDefault();
    if (st.rec) await stopRec();
    keep();
    const btn = $("#eSave"); btn.disabled = true; btn.textContent = "Enregistrement…"; $("#eErr").hidden = true;
    const r = await carnet.saveEntry(e || null, {
      type: st.type, word: st.values.word, pron: st.values.pron, translation: st.values.tr, note: st.values.note,
      emoji: st.emoji, text_color: st.tc, lesson_id: st.lesson,
      image: mediaChange(st.newImage && await resizeImage(st.newImage), st.removeImage),
      audio: mediaChange(st.newAudio, st.removeAudio),
    });
    if (r.ok) { dlg.close(); return; }
    btn.disabled = false; btn.textContent = "Enregistrer";
    showErr(errorText(r, EMPTY_ENTRY));
    if (r.reason === "empty") $("#eWord").focus();
  };

  dlg.addEventListener("close", () => {
    st.rec?.cancel(); st.rec = null;
    urls.forEach(u => URL.revokeObjectURL(u));
  }, { once: true });

  draw();
  dlg.showModal();
  setTimeout(() => $("#eWord")?.focus(), 30);
}
