// Transitions d'écran (View Transitions du navigateur), en un seul endroit : la préférence « moins
// d'animations », le repli sans View Transitions, le type posé sur la page pour le CSS
// (<html data-motion="…">, voir app.css) et les noms de ce qui glisse d'un état à l'autre.

// doc / media : le navigateur, remplaçable par un faux dans les tests.
export function createMotion({ doc, media } = {}) {
  const page = () => doc ?? globalThis.document;
  const reduced = () => (media ?? (q => globalThis.matchMedia(q)))("(prefers-reduced-motion: reduce)").matches;

  return {
    reduced,
    // update : la mise à jour de l'écran. type : quelle animation (le CSS la choisit).
    // names(phase) : [[nom, élément]] à faire glisser, demandé avant (« before ») puis après (« after »)
    // la mise à jour ; un même nom relie l'ancien élément au nouveau. Renvoie une promesse de fin.
    transition(update, { type = "", names } = {}) {
      const d = page();
      if (reduced() || !d.startViewTransition) { update(); return Promise.resolve(); }
      const root = d.documentElement, named = [];
      const name = phase => (names?.(phase) || []).forEach(([n, el]) => {
        if (el) { el.style.viewTransitionName = n; named.push(el); }
      });
      const clear = () => named.splice(0).forEach(el => { el.style.viewTransitionName = ""; });
      name("before");
      if (type) root.dataset.motion = type;
      const t = d.startViewTransition(() => { clear(); update(); name("after"); });
      return t.finished.catch(() => {}).finally(() => { clear(); if (type) delete root.dataset.motion; });
    },
  };
}

export const motion = createMotion();
