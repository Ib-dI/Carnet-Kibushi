// Réducteur pur : toutes les règles d'application d'un changement, qu'il vienne
// d'une écriture locale ou du temps réel. Un changement = { table, type, row }.

export const emptyState = () => ({ carnet: {}, lessons: [], entries: [], members: [] });

const byPosition = (a, b) => a.position - b.position || String(a.created_at).localeCompare(String(b.created_at));

function upsert(list, row) {
  const i = list.findIndex(x => x.id === row.id);
  if (i === -1) return [...list, row];
  const copy = list.slice(); copy[i] = row; return copy;
}

const without = (list, id) => list.filter(x => x.id !== id);

export function reduce(state, { table, type, row }) {
  if (table === "lessons") {
    if (type === "DELETE") {
      // Les Entrées partent avec leur Leçon (on delete cascade côté base).
      return { ...state, lessons: without(state.lessons, row.id), entries: state.entries.filter(e => e.lesson_id !== row.id) };
    }
    return { ...state, lessons: upsert(state.lessons, row).sort(byPosition) };
  }
  if (table === "entries") {
    return { ...state, entries: type === "DELETE" ? without(state.entries, row.id) : upsert(state.entries, row) };
  }
  if (table === "carnet") {
    return type === "DELETE" ? state : { ...state, carnet: row };
  }
  return state;
}

// État complet à partir d'un chargement.
export const fromLoad = ({ carnet, lessons, entries, members }) =>
  ({ carnet: carnet || {}, lessons: (lessons || []).slice().sort(byPosition), entries: entries || [], members: members || [] });
