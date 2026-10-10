import { supabase, configured } from "./lib/supabase.js";
import { createCarnet } from "./carnet/carnet.js";
import { createSupabaseAdapter } from "./carnet/supabase-adapter.js";
import { carnet, setCarnet } from "./ui/carnet-ref.js";
import { $ } from "./ui/dom.js";
import { renderLogin, renderPrivate, renderSetup } from "./ui/login.js";
import { headerHTML, bindHeader, renderHeader } from "./ui/header.js";
import { renderLessons, setQuery } from "./ui/lessons.js";
import { openLesson } from "./ui/lesson-dialog.js";
import { initReview, openReview } from "./ui/review.js";
import { reviewable } from "./revision/session.js";

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
  $("#search").addEventListener("input", ev => setQuery(ev.target.value.trim()));
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
  $("#revBtn").disabled = !carnet.state.entries.some(reviewable);
}

async function enter(session) {
  if (started) return;
  started = true;
  const me = session.user.email;
  app.innerHTML = `<p class="status">Ouverture du carnet…</p>`;
  const c = createCarnet({ ...createSupabaseAdapter(supabase), me });
  const { status } = await c.start();
  if (status !== "ok") {
    started = false;
    if (status === "not-member") renderPrivate(app, me);
    else app.innerHTML = `<p class="status">Le carnet ne répond pas. Vérifie ta connexion et recharge la page.</p>`;
    return;
  }
  setCarnet(c);
  shell();
  c.onChange(render);
  render();
  // Le temps réel ne rejoue pas ce qui a été manqué (téléphone en veille, onglet en arrière-plan).
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") c.resync(); });
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
