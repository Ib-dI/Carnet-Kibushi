// Une séance de Révision : le paquet de Cartes, l'avancée et le score.
// Le Sens de révision ne change que la face montrée : il reste à l'affichage.

// Une Entrée devient une Carte si elle a un mot et une Traduction, et n'est pas un Conseil.
export const reviewable = e => e.type !== "conseil" && e.word && e.translation;

export function createSession(entries, { lessonId = "", rng = Math.random } = {}) {
  const deck = entries.filter(e => reviewable(e) && (!lessonId || e.lesson_id === lessonId));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const total = deck.length;
  const missed = new Set();   // Cartes déjà marquées « À revoir » une fois
  let pos = 0, flipped = false, score = 0;

  const next = () => { pos++; flipped = false; };

  return {
    get current() { return deck[pos] || null; },
    get flipped() { return flipped; },
    get position() { return pos; },
    get count() { return deck.length; },
    get score() { return score; },
    total,
    flip() { if (deck[pos]) flipped = true; },
    // « Je savais » : ne compte au score que si la Carte n'a jamais été à revoir.
    knew() {
      if (!flipped) return;
      if (!missed.has(deck[pos].id)) score++;
      next();
    },
    // « À revoir » : la Carte repasse en fin de paquet.
    again() {
      if (!flipped) return;
      missed.add(deck[pos].id);
      deck.push(deck[pos]);
      next();
    },
  };
}
