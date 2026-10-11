// Une séance de Révision : le paquet de Cartes, l'avancée et le score.
// Révision libre : createSession(entries) ; le Sens de révision reste à l'affichage.
// Révision du jour : createDailySession(items) avec items = [{ id, entry, dir }] (voir schedule.js).

// Une Entrée devient une Carte si elle a un mot et une Traduction, et n'est pas un Conseil.
export const reviewable = e => e.type !== "conseil" && e.word && e.translation;

const shuffle = (list, rng) => {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// Paquet générique : chaque élément a un `id`. onFirstAnswer(élément, réponse) n'est appelé
// qu'à la première réponse sur un élément (c'est elle qui compte pour le score et les Boîtes).
// Réponses : "again" (À revoir), "knew" (Je savais), "easy" (Par cœur).
function deck(items, { onFirstAnswer = () => {} } = {}) {
  const list = items.slice();
  const total = list.length;
  const answered = new Set(), missed = new Set();
  let pos = 0, flipped = false, score = 0;

  const answer = kind => {
    const it = list[pos];
    if (!answered.has(it.id)) { answered.add(it.id); onFirstAnswer(it, kind); }
    if (kind !== "again" && !missed.has(it.id)) score++;
    if (kind === "again") { missed.add(it.id); list.push(it); }
    pos++; flipped = false;
  };

  return {
    get current() { return list[pos] || null; },
    get flipped() { return flipped; },
    get position() { return pos; },
    get count() { return list.length; },
    get score() { return score; },
    total,
    flip() { if (list[pos]) flipped = true; },
    // « Je savais » : ne compte au score que si l'élément n'a jamais été à revoir.
    knew() { if (flipped) answer("knew"); },
    // « Par cœur » : comme « Je savais » pour la séance ; la Boîte, elle, saute à la dernière.
    easy() { if (flipped) answer("easy"); },
    // « À revoir » : l'élément repasse en fin de paquet.
    again() { if (flipped) answer("again"); },
  };
}

export function createSession(entries, { lessonId = "", rng = Math.random, onFirstAnswer } = {}) {
  return deck(shuffle(entries.filter(e => reviewable(e) && (!lessonId || e.lesson_id === lessonId)), rng), { onFirstAnswer });
}

export const createDailySession = (items, { onFirstAnswer } = {}) => deck(items, { onFirstAnswer });
