import { supabase, configured } from "./lib/supabase.js";
import { createCarnet } from "./carnet/carnet.js";
import { createSupabaseAdapter } from "./carnet/supabase-adapter.js";
import { createGate } from "./session/gate.js";
import { $ } from "./ui/dom.js";
import { renderLogin, renderPrivate, renderSetup } from "./ui/login.js";
import { showCarnet } from "./ui/app-shell.js";

const app = $("#app");

const VIEWS = {
  login: () => renderLogin(app),
  loading: () => { app.innerHTML = `<p class="status">Ouverture du carnet…</p>`; },
  private: email => renderPrivate(app, email),
  offline: () => { app.innerHTML = `<p class="status">Le carnet ne répond pas. Vérifie ta connexion et recharge la page.</p>`; },
  carnet: c => showCarnet(app, c),
  reload: () => location.reload(),
};

if (!configured) {
  renderSetup(app);
} else {
  const gate = createGate({
    openCarnet: me => createCarnet({ ...createSupabaseAdapter(supabase), me }),
    show: (view, data) => VIEWS[view](data),
  });
  // Ne pas appeler Supabase directement dans ce rappel (verrou interne) : on diffère.
  supabase.auth.onAuthStateChange((event, session) => setTimeout(() => gate.onAuth(event, session), 0));
}
