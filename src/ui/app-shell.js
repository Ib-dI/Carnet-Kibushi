// L'app une fois le Carnet ouvert : ossature, onglets, écrans. main.js s'occupe seulement de la connexion.
import { carnet, setCarnet } from "./carnet-ref.js";
import { $ } from "./dom.js";
import { loggedInWithCode, askPassword } from "./login.js";
import { topbarHTML, bindHeader, renderHeader } from "./header.js";
import { renderLessons, setFilter, filtersHTML, bindFilters, showFilters, toggleFilters } from "./lessons.js";
import { initReview, renderReview, leaveReview, renderProgress, dueCount } from "./review.js";
import { setSince } from "./news-ref.js";
import { currentRoute, routeHash, tabOf } from "./route.js";


// Ossature : barre du haut, un écran par onglet, barre d'onglets (en bas sur téléphone, en haut sur ordinateur).
function shell(app) {
  app.innerHTML = `${topbarHTML()}
    <nav class="tabbar" aria-label="Navigation">
      <a href="${routeHash({ view: "home" })}" data-tab="lessons"><span aria-hidden="true">📒</span><span>Leçons</span></a>
      <a href="${routeHash({ view: "review" })}" data-tab="review"><span aria-hidden="true">🧠</span><span>Réviser</span><b class="badge" id="dueBadge" hidden></b></a>
      <a href="${routeHash({ view: "progress" })}" data-tab="progress"><span aria-hidden="true">📈</span><span>Progrès</span></a>
      <div class="tabbar-active" aria-hidden="true"></div>
    </nav>
    <main>
      <section id="home">
        <div class="tools">
          <input id="search" class="search" type="search" placeholder="Chercher un mot, une traduction…" aria-label="Chercher">
          <button id="filterBtn" class="btn small ghost" type="button" aria-expanded="false" aria-controls="filters">Filtres</button>
        </div>
        <div id="filters" hidden>${filtersHTML()}</div>
        <div id="list"><p class="status">Ouverture du carnet…</p></div>
      </section>
      <section id="page" hidden></section>
      <section id="review" hidden><div class="rev" id="rev"></div></section>
      <section id="progress" hidden></section>
    </main>`;
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="dlgEntry" aria-label="Entrée"><form class="dlg" id="formEntry" novalidate></form></dialog>
    <dialog id="dlgLesson" aria-label="Leçon"><form class="dlg" id="formLesson" novalidate></form></dialog>
    <dialog id="dlgZoom" aria-label="Image en grand"><div class="zoom"><button class="btn small ghost" id="zoomClose" type="button">Fermer</button><img id="zoomImg" alt=""></div></dialog>`);

  bindHeader();
  bindFilters($("#filters"));
  const syncFilters = () => {
    $("#filters").hidden = !showFilters();
    $("#filterBtn").setAttribute("aria-expanded", showFilters());
  };
  $("#search").addEventListener("input", ev => { setFilter({ query: ev.target.value.trim() }); syncFilters(); });
  $("#filterBtn").onclick = () => { toggleFilters(); syncFilters(); };
  $("#zoomClose").onclick = () => $("#dlgZoom").close();
  $("#dlgZoom").addEventListener("click", ev => { if (ev.target === $("#dlgZoom")) $("#dlgZoom").close(); });
  window.addEventListener("hashchange", changeScreen);
  window.addEventListener("resize", () => placeIndicator(false));
  initReview();
}

// Pastille de l'onglet actif : une copie des onglets aux couleurs « actif », découpée (clip-path) sur l'onglet
// courant ; le découpage glisse d'un onglet à l'autre, texte et fond ensemble.
function placeIndicator(animate = true) {
  const bar = $(".tabbar"), copy = $(".tabbar-active", bar), on = $("[data-tab][aria-current]", bar);
  if (!copy) return;
  copy.innerHTML = [...bar.querySelectorAll("[data-tab]")].map(a => `<span>${a.innerHTML}</span>`).join("");
  copy.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
  if (!on) { copy.style.clipPath = "inset(50%)"; return; }
  const w = copy.clientWidth, h = copy.clientHeight, r = getComputedStyle(on).borderRadius;
  const top = on.offsetTop, left = on.offsetLeft, right = w - left - on.offsetWidth, bottom = h - top - on.offsetHeight;
  copy.classList.toggle("still", !animate);
  copy.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${r})`;
  bar.classList.add("has-indicator");
}

// Changer d'onglet : l'écran glisse légèrement dans le sens de la barre (vers la droite = onglet suivant).
const TAB_ORDER = ["lessons", "review", "progress"];
let shownTab = null;
function changeScreen() {
  const to = tabOf(currentRoute()), from = shownTab;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!from || from === to || reduce || !document.startViewTransition) { render(true); return; }
  const root = document.documentElement;
  root.dataset.tabMove = TAB_ORDER.indexOf(to) > TAB_ORDER.indexOf(from) ? "next" : "prev";
  const t = document.startViewTransition(() => render(true));
  t.finished.finally(() => delete root.dataset.tabMove);
}

let shownView = null;
// navigated : on vient de changer d'écran (sinon, ce sont les données qui ont changé).
function render(navigated = false) {
  const route = currentRoute(), tab = tabOf(route);
  renderHeader();
  const sections = { home: "#home", lesson: "#page", review: "#review", progress: "#progress" };
  for (const [view, sel] of Object.entries(sections)) $(sel).hidden = view !== route.view;
  document.querySelectorAll("[data-tab]").forEach(a => { if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });

  const due = dueCount(), badge = $("#dueBadge");
  badge.hidden = !due; badge.textContent = due > 99 ? "99+" : due;
  placeIndicator(shownTab !== null && shownTab !== tab);
  shownTab = tab;

  if (shownView === "review" && route.view !== "review") leaveReview();
  if (route.view === "review") {
    // En pleine Révision, on ne redessine pas à chaque changement de données (la carte en cours resterait figée).
    if (navigated || shownView !== "review") renderReview(route);
  } else if (route.view === "progress") renderProgress();
  else renderLessons();
  if (navigated && shownView !== route.view) window.scrollTo(0, 0);
  shownView = route.view;
}

export function showCarnet(app, c) {
  setCarnet(c);
  // Badge « nouveau » : ce qui a été ajouté par les autres depuis la visite précédente.
  c.beginVisit().then(since => { setSince(since); render(); });
  shell(app);
  c.onChange(() => render());
  render(true);
  // Le temps réel ne rejoue pas ce qui a été manqué (téléphone en veille, onglet en arrière-plan).
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") c.resync(); });
  if (loggedInWithCode()) askPassword();
}
