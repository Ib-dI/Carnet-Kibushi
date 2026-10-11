// Filtre de la grille : recherche, Type d'entrée, « sans Vocal ».
// filter : { query, type, noAudio }

export const isFiltering = ({ query, type, noAudio } = {}) => Boolean(query || type || noAudio);

export function entryFilter({ query = "", type = "", noAudio = false } = {}) {
  const q = query.toLowerCase();
  return e => {
    if (type && e.type !== type) return false;
    if (noAudio && e.audio_path) return false;
    if (q && ![e.word, e.pron, e.translation, e.note].some(x => (x || "").toLowerCase().includes(q))) return false;
    return true;
  };
}
