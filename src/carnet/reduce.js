// Réducteur pur : toutes les règles d'application d'un changement, qu'il vienne
// d'une écriture locale ou du temps réel. Un changement = { table, type, row }.

// Quelles tables, quelles cascades, quels tris : voir le registre (tables.js).
import { listTables, childrenOf, sortOf } from "./tables.js";

export const emptyState = () => ({ carnet: {}, members: [], ...Object.fromEntries(listTables.map(t => [t, []])) });

const SORTS = { position: (a, b) => a.position - b.position || String(a.created_at).localeCompare(String(b.created_at)) };
const sorter = table => SORTS[sortOf(table)];

function upsert(list, row) {
  const i = list.findIndex(x => x.id === row.id);
  if (i === -1) return [...list, row];
  const copy = list.slice(); copy[i] = row; return copy;
}

// Retire des lignes et, en cascade, celles qui en dépendent.
function drop(state, table, ids) {
  let next = { ...state, [table]: state[table].filter(x => !ids.has(x.id)) };
  for (const [child, key] of childrenOf(table)) {
    const gone = new Set(next[child].filter(x => ids.has(x[key])).map(x => x.id));
    if (gone.size) next = drop(next, child, gone);
  }
  return next;
}

export function reduce(state, { table, type, row }) {
  if (table === "carnet") return type === "DELETE" ? state : { ...state, carnet: row };
  if (!listTables.includes(table)) return state;
  if (type === "DELETE") return drop(state, table, new Set([row.id]));
  const list = upsert(state[table], row);
  return { ...state, [table]: sorter(table) ? list.sort(sorter(table)) : list };
}

// État complet à partir d'un chargement : { carnet, members, lessons, entries, progress… }.
export function fromLoad(loaded) {
  const state = { ...emptyState(), carnet: loaded.carnet || {}, members: loaded.members || [] };
  for (const t of listTables) state[t] = (loaded[t] || []).slice().sort(sorter(t) || (() => 0));
  return state;
}
