// Filtre de la grille : recherche, Type d'entrée, « sans Vocal », Cartes difficiles.
// filter : { query, type, noAudio, hard } ; hardIds : identifiants des Cartes difficiles du Membre.

export const isFiltering = ({ query, type, noAudio, hard } = {}) => Boolean(query || type || noAudio || hard);

export function entryFilter({ query = "", type = "", noAudio = false, hard = false } = {}, hardIds = new Set()) {
  const q = query.toLowerCase();
  return e => {
    if (type && e.type !== type) return false;
    if (noAudio && e.audio_path) return false;
    if (hard && !hardIds.has(e.id)) return false;
    if (q && ![e.word, e.pron, e.translation, e.note].some(x => (x || "").toLowerCase().includes(q))) return false;
    return true;
  };
}
