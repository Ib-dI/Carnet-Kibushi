// Une seule façon d'ouvrir une fenêtre créée à la demande (Essais, Commentaires, Bloc, Aide…).
// openSheet crée la <dialog>, l'affiche et renvoie l'élément ; null si elle est déjà ouverte.
//   closeOnBackdrop : fermer au toucher à côté (non pour les formulaires : on ne perd rien).
//   onClose : nettoyage propre à la fenêtre (arrêter le micro, se désabonner…), appelé une seule fois.
// Échap ferme la fenêtre (comportement natif). Une ancienne fenêtre fermée dont l'événement
// « close » n'est pas encore passé (onglet en arrière-plan) est nettoyée avant d'en ouvrir une nouvelle.
import { esc } from "./dom.js";

export function openSheet({ id, label, html, closeOnBackdrop = true, onClose }) {
  const prev = document.getElementById(id);
  if (prev?.open) return null;
  prev?.cleanup?.();
  prev?.remove();
  document.body.insertAdjacentHTML("beforeend", `<dialog id="${id}" aria-label="${esc(label)}">${html}</dialog>`);
  const dlg = document.getElementById(id);
  let cleaned = false;
  dlg.cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    onClose?.();
    dlg.remove();
  };
  dlg.addEventListener("close", dlg.cleanup);
  if (closeOnBackdrop) dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
  dlg.showModal();
  return dlg;
}
