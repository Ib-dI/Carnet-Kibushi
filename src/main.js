import { supabase, configured } from "./lib/supabase.js";
import { state, load, subscribe, onChange, reviewable } from "./state.js";
import { $ } from "./ui/dom.js";
import { renderLogin, renderPrivate, renderSetup } from "./ui/login.js";
import { headerHTML, bindHeader, renderHeader } from "./ui/header.js";
import { renderLessons } from "./ui/lessons.js";
import { openLesson } from "./ui/lesson-dialog.js";
import { initReview, openReview } from "./ui/review.js";

const app = $("#app");
let started = false;

function shell() {
  app.innerHTML = `${headerHTML()}
    <div class="tools">
      <input id="search" class="search" type="search" placeholder="Chercher un mot, une traduction…" aria-label="Chercher">
      <button id="revBtn" class="btn" type="button">Réviser</button>
      <button id="newLesson" class="btn solid" type="button">+ Nouvelle leçon</button>
    </div>
    <div id="banner"></div>
    <div id="list"><p class="status">Ouverture du carnet…</p></div>`;
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="dlgEntry" aria-label="Entrée"><form class="dlg" id="formEntry" novalidate></form></dialog>
    <dialog id="dlgLesson" aria-label="Leçon"><form class="dlg" id="formLesson" novalidate></form></dialog>
    <dialog id="dlgRev" aria-label="Révision"><div class="rev" id="rev"></div></dialog>
    <dialog id="dlgZoom" aria-label="Image en grand"><div class="zoom"><button class="btn small ghost" id="zoomClose" type="button">Fermer</button><img id="zoomImg" alt=""></div></dialog>`);

  bindHeader();
  $("#search").addEventListener("input", ev => { state.query = ev.target.value.trim(); renderLessons(); });
  $("#newLesson").onclick = () => openLesson();
  $("#revBtn").onclick = openReview;
  $("#zoomClose").onclick = () => $("#dlgZoom").close();
  // Clic sur le fond : ferme la photo et la révision (pas les formulaires, pour ne rien perdre).
  ["#dlgZoom", "#dlgRev"].forEach(s => { const d = $(s); d.addEventListener("click", ev => { if (ev.target === d) d.close(); }); });
  initReview();
}

function render() {
  renderHeader();
  renderLessons();
  $("#revBtn").disabled = !state.entries.some(reviewable);
}

async function enter(session) {
  state.me = session.user.email;
  const { data, error } = await supabase.from("members").select("email").limit(1);
  if (error) { app.innerHTML = `<p class="status">Le carnet ne répond pas. Vérifie ta connexion et recharge la page.</p>`; return; }
  if (!data.length) { renderPrivate(app, state.me); return; }
  if (started) return;
  started = true;
  shell();
  onChange(render);
  try {
    await load();
    subscribe();
  } catch (e) {
    console.warn(e);
    $("#list").innerHTML = `<p class="status">Impossible d'ouvrir le carnet. Vérifie ta connexion et recharge la page.</p>`;
  }
}

if (!configured) {
  renderSetup(app);
} else {
  let current = null;
  supabase.auth.onAuthStateChange((event, session) => {
    // Ne pas appeler Supabase directement dans ce rappel (verrou interne) : on diffère.
    setTimeout(() => {
      if (event === "SIGNED_OUT") { if (started) location.reload(); else renderLogin(app); current = null; return; }
      if (!session) { renderLogin(app); return; }
      if (current === session.user.email) return;
      current = session.user.email;
      enter(session);
    }, 0);
  });
}
