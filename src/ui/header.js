import { supabase } from "../lib/supabase.js";
import { carnet } from "./carnet-ref.js";
import { $, esc, errorText } from "./dom.js";
import { askPassword } from "./login.js";
import { themeButtonHTML, bindTheme } from "./theme.js";
import { routeHash } from "./route.js";
import { openSheet } from "./sheet.js";

const langOf = () => (carnet.state.carnet.langue || "").trim();
const deLang = l => l ? (/^[aeiouyhéèêàâîôû]/i.test(l) ? "d’" : "de ") + l : "de langue";

export function renderHeader() {
  $("#who").textContent = carnet.myName();
  $("#title").innerHTML = `Mon carnet <em>${esc(deLang(langOf()))}</em>`;
}

// Barre du haut, sur toutes les vues : titre du Carnet (retour aux Leçons), thème, menu du compte.
export function topbarHTML() {
  return `
    <div class="topbar">
      <a class="brand" id="title" href="${routeHash({ view: "home" })}">Mon carnet <em>de langue</em></a>
      <div class="userbar">${themeButtonHTML()}
        <details class="account" id="account">
          <summary class="btn small ghost"><span id="who"></span><span aria-hidden="true">▾</span></summary>
          <div class="menu">
            <button type="button" class="menu-item" id="langMenu">Nom de la langue</button>
            <button type="button" class="menu-item" id="helpMenu">Aide</button>
            <button type="button" class="menu-item" id="password">Mot de passe</button>
            <button type="button" class="menu-item" id="logout">Se déconnecter</button>
          </div>
        </details>
      </div>
    </div>`;
}

function openLangName() {
  const dlg = openSheet({ id: "dlgLang", label: "Nom de la langue", closeOnBackdrop: false, html: `<form class="dlg" id="langForm" novalidate>
      <h3>Nom de la langue</h3>
      <label class="field"><span>La langue que tu apprends</span>
        <input id="langInp" class="inp big" maxlength="60" placeholder="Ex. Kibushi" value="${esc(langOf())}"></label>
      <div class="err" id="langErr" role="alert" hidden></div>
      <div class="actions"><span></span><div class="right">
        <button class="btn ghost" type="button" id="langCancel">Annuler</button><button class="btn solid">Enregistrer</button></div></div>
    </form>` });
  if (!dlg) return;
  $("#langInp").focus();
  $("#langCancel").onclick = () => dlg.close();
  $("#langForm").onsubmit = async ev => {
    ev.preventDefault();
    const r = await carnet.renameLangue($("#langInp").value);
    if (r.ok) { dlg.close(); return; }
    const e = $("#langErr"); e.hidden = false; e.textContent = errorText(r);
  };
}

export function howtoHTML() {
  return `<ol class="howto">
      <li><b>Une leçon = un thème</b> (salutations, famille, cuisine…). Ouvre-la pour y écrire librement et y ranger les mots.</li>
      <li><b>Chaque mot</b> a sa notation à l'oreille, sa traduction et, si possible, un vocal.</li>
      <li><b>Réviser</b> : devine d'abord, puis retourne la carte pour comparer. Le carnet te repropose chaque carte au bon moment.</li>
    </ol>
    <q>Prédire, se tromper, corriger : c'est là que la mémoire s'ancre.</q>`;
}

function openHelp() {
  const dlg = openSheet({ id: "dlgHelp", label: "Aide", html: `<div class="dlg"><h3>Comment on s'en sert</h3>${howtoHTML()}
      <div class="actions"><span></span><div class="right"><button class="btn solid" type="button" id="helpClose">Compris</button></div></div></div>` });
  if (dlg) $("#helpClose").onclick = () => dlg.close();
}

export function bindHeader() {
  const account = $("#account");
  const closeMenu = () => { account.open = false; };
  $("#logout").onclick = () => supabase.auth.signOut();
  $("#password").onclick = () => { closeMenu(); askPassword(); };
  $("#langMenu").onclick = () => { closeMenu(); openLangName(); };
  $("#helpMenu").onclick = () => { closeMenu(); openHelp(); };
  // Le menu du compte se ferme en cliquant ailleurs ou avec Échap.
  document.addEventListener("click", ev => { if (account.open && !account.contains(ev.target)) closeMenu(); });
  account.addEventListener("keydown", ev => { if (ev.key === "Escape" && account.open) { closeMenu(); account.querySelector("summary").focus(); } });
  bindTheme($(".userbar"));
}
