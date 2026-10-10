import { supabase } from "../lib/supabase.js";
import { carnet } from "./carnet-ref.js";
import { $, esc, errorText } from "./dom.js";
import { askPassword } from "./login.js";

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

export function headerHTML() {
  return `
    <div class="userbar"><span id="who"></span><button class="btn small ghost" type="button" id="password">Mot de passe</button><button class="btn small ghost" type="button" id="logout">Se déconnecter</button></div>
    <header>
      <div class="label eyebrow">Carnet partagé · Langue orale</div>
      <h1 id="title">Mon carnet <em>de langue</em></h1>
      <div id="langZone"></div>
      <p class="sub">Les mots, les phrases, les vocaux et les images qu'on ajoute ensemble, rangés par leçon. Tout ce que l'une écrit, l'autre le voit tout de suite.</p>
    </header>
    <section class="cadre" aria-label="Comment s'en servir">
      <div class="label">Comment on s'en sert</div>
      <ol>
        <li>Une leçon = un thème (salutations, famille, cuisine…).</li>
        <li>Chaque mot a sa notation à l'oreille, sa traduction et, si possible, un vocal.</li>
        <li>En révision, devine d'abord, puis retourne la carte pour comparer.</li>
      </ol>
      <q>Prédire, se tromper, corriger : c'est là que la mémoire s'ancre.</q>
    </section>`;
}

export function bindHeader() {
  $("#logout").onclick = () => supabase.auth.signOut();
  $("#password").onclick = askPassword;
}
