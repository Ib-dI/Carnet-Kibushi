// Écran « Progrès » : série de jours de révision (et les derniers jours), Cartes à venir, maîtrise par Leçon.
import { reviewable } from "./session.js";
import { addDays, directionsFor, dailyItems } from "./schedule.js";

// Une Carte est « sue » dans un Sens à partir de cette Boîte.
export const MASTERED_BOX = 3;

// Jours de révision d'affilée jusqu'à aujourd'hui (ou hier, si la Révision du jour n'est pas encore faite).
export function streak(days, today) {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1), n = 0;
  while (set.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

// Les `n` derniers jours jusqu'à aujourd'hui, du plus ancien au plus récent : révisé ou non.
export function recentDays(days, today, n = 7) {
  const set = new Set(days);
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    return { day, done: set.has(day), today: day === today };
  });
}

const itemsOf = entries => entries.filter(reviewable).flatMap(e => directionsFor(e).map(d => `${e.id}:${d}`));

// Nombre d'items (Carte × Sens) à réviser chacun des `n` prochains jours.
// Aujourd'hui : exactement la Révision du jour (retards compris, et les nouvelles Cartes du jour : `fresh`),
// le même chiffre que la pastille de l'onglet « Réviser ». Les jours suivants : les Cartes déjà vues qui reviennent.
export function upcoming(entries, progress, today, n = 7) {
  const live = new Set(itemsOf(entries)), known = new Set(progress.map(p => `${p.entry_id}:${p.direction}`));
  const todays = dailyItems(entries, progress, today);
  const days = Array.from({ length: n }, (_, i) => ({ day: addDays(today, i), count: 0, fresh: 0 }));
  days[0].count = todays.length;
  days[0].fresh = todays.filter(it => !known.has(it.id)).length;
  for (const p of progress) {
    if (!live.has(`${p.entry_id}:${p.direction}`) || p.due <= today) continue;
    const slot = days.find(d => d.day === p.due);
    if (slot) slot.count++;
  }
  return days;
}

// Pour chaque Leçon, ses items (Carte × Sens) en trois états : sus (Boîte ≥ MASTERED_BOX),
// en cours (déjà vus, Boîte plus basse), à découvrir (jamais vus) ; et le pourcentage de sus.
export function mastery(lessons, entries, progress) {
  const box = new Map(progress.map(p => [`${p.entry_id}:${p.direction}`, p.box]));
  return lessons.map(lesson => {
    const items = itemsOf(entries.filter(e => e.lesson_id === lesson.id));
    const mastered = items.filter(k => (box.get(k) || 0) >= MASTERED_BOX).length;
    const fresh = items.filter(k => !box.has(k)).length;
    return { lesson, items: items.length, mastered, learning: items.length - mastered - fresh, fresh,
      percent: items.length ? Math.round((100 * mastered) / items.length) : 0 };
  });
}

// Pour la tuile d'une Leçon : ses mots, ses Cartes, et ce qui est à réviser maintenant
// (Cartes à revoir et nouvelles, comme « Réviser cette leçon »).
export function lessonStatus(entries, progress, lessonId, today) {
  const words = entries.filter(e => e.lesson_id === lessonId);
  return {
    words: words.length,
    cards: words.filter(reviewable).length,
    toReview: dailyItems(entries, progress, today, { lessonId }).length,
  };
}
