import { supabase } from "../lib/supabase.js";
import { $, esc } from "./dom.js";

const BAD_EMAIL = "Écris une adresse e-mail complète, par exemple prenom@exemple.fr.";
const NOT_MEMBER = "Cette adresse n'a pas accès au carnet. Demande à la personne qui l'a créé de l'ajouter.";
const TOO_MANY = "Trop d'e-mails envoyés pour l'instant (2 par heure au maximum). Réessaie dans une heure, ou connecte-toi avec ton mot de passe si tu en as un.";
const NETWORK = "Ça n'a pas marché. Vérifie ta connexion, puis réessaie.";

// Après une connexion par code, on propose de choisir un mot de passe (voir askPassword).
let codeLogin = false;
export const loggedInWithCode = () => codeLogin;

// Adresses déjà utilisées sur cet appareil (simple confort : la liste peut manquer).
const KNOWN = "carnet.emails";
const knownEmails = () => { try { return JSON.parse(localStorage.getItem(KNOWN)) || []; } catch { return []; } };
const rememberEmail = email => {
  try { localStorage.setItem(KNOWN, JSON.stringify([email, ...knownEmails().filter(x => x !== email)].slice(0, 5))); } catch {}
};

const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

// Champ mot de passe avec un œil pour afficher / masquer.
const passwordInput = (id, autocomplete, extra = "") => `<span class="pass">
  <input id="${id}" class="inp" type="password" autocomplete="${autocomplete}" required ${extra}>
  <button type="button" class="eye" data-eye="${id}" aria-label="Afficher le mot de passe" aria-pressed="false">${EYE}</button></span>`;
function bindEyes(root) {
  root.querySelectorAll("[data-eye]").forEach(b => b.onclick = () => {
    const inp = $("#" + b.dataset.eye), show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.innerHTML = show ? EYE_OFF : EYE;
    b.setAttribute("aria-pressed", show);
    b.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
    inp.focus();
  });
}

const authError = e => e.status === 403 ? NOT_MEMBER : e.status === 429 ? TOO_MANY : NETWORK;
const validEmail = s => /^\S+@\S+\.\S+$/.test(s);

// Connexion : e-mail + mot de passe ; en secours (première fois, oubli), un code reçu par e-mail
// et tapé ici, sans quitter l'app.
export function renderLogin(app, email = knownEmails()[0] || "") {
  const frame = body => {
    app.innerHTML = `
      <div class="login">
        <div class="label eyebrow">Carnet partagé · Langue orale</div>
        <h1>Mon carnet <em>de langue</em></h1>
        <form class="welcome" id="loginForm" novalidate>${body}
          <p class="status" id="loginMsg" role="status"></p>
        </form>
      </div>`;
    bindEyes(app);
    return { form: $("#loginForm"), msg: $("#loginMsg") };
  };
  const say = (msg, text, isErr = true) => { msg.classList.toggle("err", isErr); msg.textContent = text; };
  const emailField = () => `<label class="field"><span>Ton adresse e-mail</span>
    <input id="loginEmail" class="inp" type="email" autocomplete="email" inputmode="email" required placeholder="prenom@exemple.fr" value="${esc(email)}" list="knownEmails"></label>
    <datalist id="knownEmails">${knownEmails().map(x => `<option value="${esc(x)}">`).join("")}</datalist>`;

  function passwordStep() {
    const { form, msg } = frame(`${emailField()}
      <label class="field"><span>Mot de passe</span>
        ${passwordInput("loginPass", "current-password")}</label>
      <button class="btn solid" id="loginBtn">Ouvrir le carnet</button>
      <button class="mini" type="button" id="toCode">Première fois ou mot de passe oublié ? Recevoir un code</button>`);
    ($("#loginEmail").value ? $("#loginPass") : $("#loginEmail")).focus();
    $("#toCode").onclick = () => { email = $("#loginEmail").value.trim(); codeRequestStep(); };
    form.onsubmit = async ev => {
      ev.preventDefault();
      email = $("#loginEmail").value.trim();
      if (!validEmail(email)) return say(msg, BAD_EMAIL);
      const btn = $("#loginBtn"); btn.disabled = true;
      const { error } = await supabase.auth.signInWithPassword({ email, password: $("#loginPass").value });
      btn.disabled = false;
      if (!error) rememberEmail(email);
      else say(msg, error.code === "invalid_credentials"
        ? "E-mail ou mot de passe incorrect. Pas encore de mot de passe ? Reçois un code ci-dessous."
        : authError(error));
    };
  }

  function codeRequestStep() {
    const { form, msg } = frame(`${emailField()}
      <button class="btn solid" id="loginBtn">Recevoir un code</button>
      <button class="mini" type="button" id="toPass">J'ai déjà un mot de passe</button>`);
    $("#loginEmail").focus();
    $("#toPass").onclick = () => { email = $("#loginEmail").value.trim(); passwordStep(); };
    form.onsubmit = async ev => {
      ev.preventDefault();
      email = $("#loginEmail").value.trim();
      if (!validEmail(email)) return say(msg, BAD_EMAIL);
      const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Envoi…";
      const { error } = await supabase.auth.signInWithOtp({ email });
      btn.disabled = false; btn.textContent = "Recevoir un code";
      if (error) return say(msg, authError(error));
      codeStep();
    };
  }

  function codeStep() {
    const { form, msg } = frame(`
      <p>Un code vient d'être envoyé à <strong>${esc(email)}</strong>. Tape-le ici (pas besoin de cliquer sur le lien).</p>
      <label class="field"><span>Code reçu par e-mail</span>
        <input id="loginCode" class="inp big" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required></label>
      <button class="btn solid" id="loginBtn">Ouvrir le carnet</button>
      <button class="mini" type="button" id="toCode">Renvoyer un code</button>`);
    $("#loginCode").focus();
    $("#toCode").onclick = codeRequestStep;
    form.onsubmit = async ev => {
      ev.preventDefault();
      const token = $("#loginCode").value.replace(/\D/g, "");
      if (token.length < 6) return say(msg, "Le code fait au moins 6 chiffres.");
      const btn = $("#loginBtn"); btn.disabled = true;
      codeLogin = true;
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      btn.disabled = false;
      if (!error) rememberEmail(email);
      else { codeLogin = false; say(msg, error.status === 403 ? NOT_MEMBER : "Code incorrect ou expiré. Vérifie-le, ou demande un nouveau code."); }
    };
  }

  passwordStep();
}

// Choisir ou changer son mot de passe : proposé après une connexion par code, et depuis l'en-tête.
export function askPassword() {
  codeLogin = false;
  const prev = $("#dlgPass");
  if (prev?.open) return;
  prev?.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="dlgPass" aria-label="Mot de passe"><form class="dlg" id="formPass" novalidate>
      <h3>Choisis un mot de passe</h3>
      <p class="status">La prochaine fois, tu ouvriras le carnet avec ton e-mail et ce mot de passe, sans passer par ta boîte mail.</p>
      <label class="field"><span>Nouveau mot de passe <small>(8 caractères au moins)</small></span>
        ${passwordInput("newPass", "new-password", 'minlength="8"')}</label>
      <div class="err" id="passErr" role="alert" hidden></div>
      <div class="actions"><span></span><div class="right">
        <button class="btn ghost" type="button" id="passLater">Plus tard</button>
        <button class="btn solid" id="passSave">Enregistrer</button></div></div>
    </form></dialog>`);
  const dlg = $("#dlgPass"), err = $("#passErr");
  bindEyes(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  $("#passLater").onclick = () => dlg.close();
  $("#formPass").onsubmit = async ev => {
    ev.preventDefault();
    const password = $("#newPass").value;
    if (password.length < 8) { err.hidden = false; err.textContent = "8 caractères au moins."; return; }
    const btn = $("#passSave"); btn.disabled = true;
    const { error } = await supabase.auth.updateUser({ password });
    btn.disabled = false;
    if (error) {
      err.hidden = false;
      err.textContent = error.code === "weak_password" ? "Ce mot de passe est trop facile à deviner. Choisis-en un autre."
        : error.code === "same_password" ? "C'est déjà ton mot de passe." : NETWORK;
      return;
    }
    dlg.close();
  };
  dlg.showModal();
  $("#newPass").focus();
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
