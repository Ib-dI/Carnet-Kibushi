// Fenêtre « Prononciation » d'une Entrée : le Vocal de référence, les Essais de chacun,
// et l'enregistrement de mon Essai. Ouverte depuis la grille ou depuis la Révision.
import { playPath, stopPlayback, rebindPlaying } from "../lib/player.js";
import { startRecording, canRecord, fmtTime, meterHTML, setMeter, MAX_SECONDS } from "../lib/recorder.js";
import { carnet } from "./carnet-ref.js";
import { $, esc, PLAY_ICON, errorText } from "./dom.js";
import { openSheet } from "./sheet.js";

const MIC_BLOCKED = "Le micro est bloqué. Autorise-le dans les réglages du navigateur.";
const MIC_FAILED = "Le micro ne répond pas.";
const MIC_SILENT = "Aucun son n'a été capté : le micro n'est sans doute pas autorisé pour ce navigateur. Sur Mac : Réglages Système → Confidentialité et sécurité → Micro. Ou essaie dans Chrome ou Safari.";

export function openAttempt(entry) {
  let off = () => {};
  const dlg = openSheet({ id: "dlgTry", label: "Prononciation", html: `<div class="dlg" id="tryBody"></div>`,
    onClose: () => { off(); rec?.cancel(); rec = null; stopPlayback(); } });
  if (!dlg) return;
  const body = $("#tryBody");
  let rec = null, secs = 0, status = "", isErr = false, busy = false;

  const playBtn = (key, label) => `<button class="play" style="--c:var(--canard)" type="button" data-play="${esc(key)}" aria-label="${esc(label)}">${PLAY_ICON}</button>`;

  function draw() {
    const e = carnet.state.entries.find(x => x.id === entry.id);
    if (!e) { dlg.close(); return; }   // supprimée entre-temps
    const attempts = carnet.attemptsOf(e.id);
    const mine = attempts.find(t => carnet.authorName(t.member_email) === "toi");
    const ref = e.audio_path
      ? `<div class="try-row">${playBtn("ref", "Écouter le vocal de référence")}<span>Vocal de référence</span></div>`
      : `<p class="status">Pas encore de vocal de référence pour cette entrée.</p>`;
    const rows = attempts.map(t => {
      const who = carnet.authorName(t.member_email);
      return `<div class="try-row">${playBtn(t.id, who === "toi" ? "Écouter mon essai" : `Écouter l'essai de ${who}`)}
        <span>${who === "toi" ? "Mon essai" : `Essai de ${esc(who || "quelqu'un")}`}</span>
        ${who === "toi" ? `<button class="mini" type="button" id="tryDel">Supprimer</button>` : ""}</div>`;
    }).join("");
    const recZone = !canRecord()
      ? `<p class="status">Ce navigateur ne permet pas d'enregistrer.</p>`
      : rec
        ? `<div class="try-row"><button type="button" class="rec-btn on" id="tryRec" aria-label="Arrêter l'enregistrement">■</button><span class="rec-time" id="tryTime">${fmtTime(secs)}</span>${meterHTML("tryLevel")}<span class="status">Clique pour arrêter</span></div>`
        : `<div class="try-row"><button type="button" class="rec-btn" id="tryRec" aria-label="${mine ? "Refaire mon essai" : "Enregistrer mon essai"}" ${busy ? "disabled" : ""}>🎙</button><span>${mine ? "Refaire mon essai" : "Enregistrer mon essai"}</span></div>`;
    body.innerHTML = `<h3>Prononciation · ${esc(e.word || "…")}</h3>
      ${ref}${rows}${recZone}
      <p class="${isErr ? "err" : "status"}" role="status">${esc(status)}</p>
      <div class="actions"><span></span><div class="right"><button class="btn" type="button" id="tryClose">Fermer</button></div></div>`;

    body.querySelectorAll("[data-play]").forEach(b => b.onclick = () => {
      const key = b.dataset.play;
      const path = key === "ref" ? e.audio_path : attempts.find(t => t.id === key)?.audio_path;
      if (path) playPath(path, b, `try:${key}`);
    });
    rebindPlaying(body);
    $("#tryClose").onclick = () => dlg.close();
    const del = $("#tryDel");
    if (del) del.onclick = async () => {
      del.disabled = true;
      const r = await carnet.deleteAttempt(mine);
      say(r.ok ? "Essai supprimé." : errorText(r), !r.ok);
    };
    const rb = $("#tryRec");
    if (rb) rb.onclick = rec ? stop : start;
  }

  const say = (text, err = false) => { status = text; isErr = err; draw(); };

  async function start() {
    stopPlayback();
    secs = 0;
    try {
      rec = await startRecording((s, level) => {
        secs = s;
        setMeter($("#tryLevel"), level);
        const t = $("#tryTime"); if (t) t.textContent = fmtTime(s);
        if (s >= MAX_SECONDS) stop();
      });
    } catch (x) {
      rec = null;
      return say(x && (x.name === "NotAllowedError" || x.name === "SecurityError") ? MIC_BLOCKED : MIC_FAILED, true);
    }
    if (!dlg.open) { rec.cancel(); rec = null; return; }
    say("");
    $("#tryRec")?.focus();
  }

  async function stop() {
    const r = rec; if (!r) return;
    rec = null; busy = true;
    say("Enregistrement…");
    const blob = await r.stop();
    if (!blob.size) { busy = false; return say(MIC_FAILED, true); }
    if (r.silent) { busy = false; return say(MIC_SILENT, true); }
    const res = await carnet.saveAttempt(entry.id, blob);
    busy = false;
    say(res.ok ? "Ton essai est enregistré. Écoute-le à côté du vocal de référence." : errorText(res), !res.ok);
  }

  off = carnet.onChange(() => { if (!rec) draw(); });
  draw();
  $("#tryRec")?.focus();
}
