import { supabase } from "../lib/supabase.js";
import { $, esc } from "./dom.js";

export function renderLogin(app) {
  app.innerHTML = `
    <div class="login">
      <div class="label eyebrow">Carnet partagé · Langue orale</div>
      <h1>Mon carnet <em>de langue</em></h1>
      <form class="welcome" id="loginForm" novalidate>
        <label class="field"><span>Ton adresse e-mail</span>
          <input id="loginEmail" class="inp" type="email" autocomplete="email" inputmode="email" required placeholder="prenom@exemple.fr"></label>
        <button class="btn solid" id="loginBtn">Recevoir mon lien de connexion</button>
        <p class="status" id="loginMsg" role="status"></p>
      </form>
    </div>`;
  const form = $("#loginForm"), msg = $("#loginMsg"), btn = $("#loginBtn");
  $("#loginEmail").focus();
  form.onsubmit = async ev => {
    ev.preventDefault();
    const email = $("#loginEmail").value.trim();
    msg.classList.remove("err");
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.classList.add("err"); msg.textContent = "Écris une adresse e-mail complète, par exemple prenom@exemple.fr."; return; }
    btn.disabled = true; btn.textContent = "Envoi…";
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
    btn.disabled = false; btn.textContent = "Recevoir mon lien de connexion";
    if (error) { msg.classList.add("err"); msg.textContent = "L'envoi n'a pas marché. Vérifie l'adresse et ta connexion, puis réessaie."; return; }
    msg.textContent = "Regarde ta boîte mail : clique sur le lien pour ouvrir le carnet.";
  };
}

export function renderPrivate(app, email) {
  app.innerHTML = `
    <div class="login">
      <div class="label eyebrow">Carnet partagé · Langue orale</div>
      <div class="welcome">
        <h2>Ce carnet est privé</h2>
        <p>Demande à la personne qui l'a créé d'ajouter ton adresse${email ? ` (<strong>${esc(email)}</strong>)` : ""}.</p>
        <div><button class="btn" type="button" id="logout">Se déconnecter</button></div>
      </div>
    </div>`;
  $("#logout").onclick = () => supabase.auth.signOut();
}

export function renderSetup(app) {
  app.innerHTML = `
    <div class="login">
      <div class="label eyebrow">Configuration</div>
      <div class="welcome">
        <h2>Le carnet n'est pas encore relié à Supabase</h2>
        <p>Copie <code>.env.example</code> en <code>.env</code>, mets-y l'URL et la clé <code>anon</code> de ton projet Supabase, puis relance <code>npm run dev</code>. Tout est expliqué dans le README.</p>
      </div>
    </div>`;
}
