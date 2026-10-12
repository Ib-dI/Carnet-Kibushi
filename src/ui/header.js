import { supabase } from "../lib/supabase.js";
import { carnet } from "./carnet-ref.js";
import { $, esc, errorText } from "./dom.js";
import { askPassword } from "./login.js";
import { themeButtonHTML, bindTheme } from "./theme.js";

let editing = false;

export function renderHeader() {
  $("#who").textContent = carnet.myName();
  const l = (carnet.state.carnet.langue || "").trim();
  const de = l ? (/^[aeiouyhéèêàâîôû]/i.test(l) ? "d’" : "de ") : "de ";
  $("#title").innerHTML = `Mon carnet <em>${esc(de + (l || "langue"))}</em>`;
  if (!editing) drawLangButton();
}

function drawLangButton() {
  const l = (carnet.state.carnet.langue || "").trim();
  $("#langZone").innerHTML = `<button class="lang-edit" id="langBtn" type="button">✎ ${l ? "Changer le nom de la langue" : "Donner le nom de la langue"}</button>`;
  $("#langBtn").onclick = editLang;
}

function editLang() {
  editing = true;
  $("#langZone").innerHTML = `<form class="lang-form" id="langForm">
      <input id="langInp" class="inp" style="max-width:280px" placeholder="Nom de la langue" aria-label="Nom de la langue" value="${esc(carnet.state.carnet.langue || "")}">
      <button class="btn small solid">Enregistrer</button>
      <button class="btn small ghost" type="button" id="langCancel">Annuler</button>
      <span class="err" id="langErr" hidden></span>
    </form>`;
  const inp = $("#langInp");
  inp.focus();
  const close = () => { editing = false; drawLangButton(); $("#langBtn").focus(); };
  $("#langCancel").onclick = close;
  inp.onkeydown = ev => { if (ev.key === "Escape") close(); };
  $("#langForm").onsubmit = async ev => {
    ev.preventDefault();
    const r = await carnet.renameLangue(inp.value);
    if (!r.ok) { const e = $("#langErr"); e.hidden = false; e.textContent = errorText(r); return; }
    editing = false;
    renderHeader();
  };
}

// Barre du haut (thème, compte) : visible sur toutes les vues.
export function userbarHTML() {
  return `
    <div class="userbar">${themeButtonHTML()}
      <details class="account" id="account">
        <summary class="btn small ghost"><span id="who"></span><span aria-hidden="true">▾</span></summary>
        <div class="menu">
          <button type="button" class="menu-item" id="password">Mot de passe</button>
          <button type="button" class="menu-item" id="logout">Se déconnecter</button>
        </div>
      </details>
    </div>`;
}

// En-tête du sommaire : titre du Carnet, nom de la Langue, mode d'emploi.
export function headerHTML() {
  return `
    <header>
      <div class="label eyebrow">Carnet partagé</div>
      <h1 id="title">Mon carnet <em>de langue</em></h1>
      <div id="langZone"></div>
      <p class="sub">Les mots, les phrases, les vocaux et les images qu'on ajoute ensemble, rangés par leçon. Tout ce que l'une écrit, l'autre le voit tout de suite.</p>
    </header>
    <details class="cadre" id="howto">
      <summary class="label">Comment on s'en sert</summary>
      <ol>
        <li>Une leçon = un thème (salutations, famille, cuisine…).</li>
        <li>Chaque mot a sa notation à l'oreille, sa traduction et, si possible, un vocal.</li>
        <li>En révision, devine d'abord, puis retourne la carte pour comparer.</li>
      </ol>
      <q>Prédire, se tromper, corriger : c'est là que la mémoire s'ancre.</q>
    </details>`;
}

export function bindHeader() {
  const account = $("#account");
  const closeMenu = () => { account.open = false; };
  $("#logout").onclick = () => supabase.auth.signOut();
  $("#password").onclick = () => { closeMenu(); askPassword(); };
  // Le menu du compte se ferme en cliquant ailleurs ou avec Échap.
  document.addEventListener("click", ev => { if (account.open && !account.contains(ev.target)) closeMenu(); });
  account.addEventListener("keydown", ev => { if (ev.key === "Escape" && account.open) { closeMenu(); account.querySelector("summary").focus(); } });
  bindTheme($(".userbar"));
  // L'encadré « Comment on s'en sert » est ouvert sur grand écran, replié sur téléphone.
  $("#howto").open = window.matchMedia("(min-width: 521px)").matches;
}
