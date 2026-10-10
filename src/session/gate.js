// L'entrée dans le Carnet : à partir des événements de connexion, décide quoi afficher.
// show(view, data) avec view : "login" | "loading" | "private" (email) | "offline" | "carnet" (carnet) | "reload".

export function createGate({ openCarnet, show }) {
  let email = null;   // Membre dont le Carnet est ouvert ou en cours d'ouverture
  let open = false;   // le Carnet est affiché

  async function enter(next) {
    email = next;
    show("loading");
    const carnet = openCarnet(next);
    const { status } = await carnet.start();
    if (email !== next) return;   // une déconnexion ou un autre compte est passé entre-temps
    if (status === "ok") { open = true; show("carnet", carnet); return; }
    email = null;                  // le prochain événement réessaiera
    if (status === "not-member") show("private", next);
    else show("offline");
  }

  return {
    async onAuth(event, session) {
      const next = session?.user?.email || null;
      if (event === "SIGNED_OUT" || !next) {
        email = null;
        show(open ? "reload" : "login");
        return;
      }
      if (next === email) return;
      // Changer de Membre avec un Carnet ouvert : on repart d'une page neuve.
      if (open) { show("reload"); return; }
      await enter(next);
    },
  };
}
