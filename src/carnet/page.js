// La page d'une Leçon : ses blocs de texte libre et ses Entrées, mêlés dans un même ordre.
// Chaque élément a une `position` (nombre) ; on insère entre deux éléments en prenant la moyenne.
// Les Entrées créées avant les pages n'ont pas de position : elles suivent, par date d'ajout.

// Types de blocs de texte libre (voir ui/rich.js pour leur affichage).
export const BLOCK_KINDS = ["text", "title", "list", "numbered", "quote", "callout", "divider"];

const byDate = (a, b) => String(a.created_at).localeCompare(String(b.created_at));

// [{ kind: "block" | "entry", item, rank }] dans l'ordre de la page.
export function pageItems(state, lessonId) {
  const placed = [
    ...state.blocks.filter(b => b.lesson_id === lessonId).map(item => ({ kind: "block", item })),
    ...state.entries.filter(e => e.lesson_id === lessonId && e.position != null).map(item => ({ kind: "entry", item })),
  ].sort((a, b) => a.item.position - b.item.position || byDate(a.item, b.item));
  const loose = state.entries.filter(e => e.lesson_id === lessonId && e.position == null).sort(byDate)
    .map(item => ({ kind: "entry", item }));
  return [...placed, ...loose].map((it, rank) => ({ ...it, rank }));
}

// Position effective d'un élément de page (celle qu'on lui donnerait s'il n'en a pas encore).
export function positionOf(pageItem) {
  return pageItem.item.position ?? pageItem.rank + 1;
}

export function positionBetween(before, after) {
  if (before == null && after == null) return 1;
  if (before == null) return after - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}

// Position pour insérer avant le i-ème élément de `items` (objets { position }) ; i = longueur : à la fin.
export const positionAt = (items, i) => positionBetween(items[i - 1]?.position ?? null, items[i]?.position ?? null);
