// Écran « Progrès » : série de jours de révision, Cartes à venir, maîtrise par Leçon.
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

const itemsOf = entries => entries.filter(reviewable).flatMap(e => directionsFor(e).map(d => `${e.id}:${d}`));

// Nombre d'items (Carte × Sens) à revoir chacun des `n` prochains jours ; les retards comptent aujourd'hui.
export function upcoming(entries, progress, today, n = 7) {
  const live = new Set(itemsOf(entries));
  const days = Array.from({ length: n }, (_, i) => ({ day: addDays(today, i), count: 0 }));
  for (const p of progress) {
    if (!live.has(`${p.entry_id}:${p.direction}`)) continue;
    const slot = p.due <= today ? days[0] : days.find(d => d.day === p.due);
    if (slot) slot.count++;
  }
  return days;
}

// Pour chaque Leçon : items (Carte × Sens), combien sont en Boîte ≥ MASTERED_BOX, et le pourcentage.
export function mastery(lessons, entries, progress) {
  const box = new Map(progress.map(p => [`${p.entry_id}:${p.direction}`, p.box]));
  return lessons.map(lesson => {
    const items = itemsOf(entries.filter(e => e.lesson_id === lesson.id));
    const mastered = items.filter(k => (box.get(k) || 0) >= MASTERED_BOX).length;
    return { lesson, items: items.length, mastered, percent: items.length ? Math.round((100 * mastered) / items.length) : 0 };
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
