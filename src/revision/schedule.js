// Révision du jour : les Boîtes de Leitner, par Membre, par Carte et par Sens de révision.
// Un progrès = { entry_id, direction: "fr" | "lg", box: 1..5, due: "AAAA-MM-JJ", lapses, introduced_on }.

import { reviewable } from "./session.js";

export const DIRECTIONS = ["fr", "lg"];
// Jours avant le retour d'une Carte, selon sa Boîte.
export const INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
const LAST_BOX = 5;
export const NEW_PER_DAY = 10;   // nouvelles Cartes × Sens par jour
const HARD_LAPSES = 2;

export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

export function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Date du jour, locale (le jour change à minuit chez le Membre, pas à minuit UTC).
export const localToday = () => new Date().toLocaleDateString("sv-SE");

// Le progrès après une réponse : "again" (À revoir), "knew" (Je savais) ou "easy" (Par cœur).
// Seule la première réponse d'une séance compte.
export function nextProgress(progress, answer, today) {
  const introduced_on = progress?.introduced_on || today;
  const lapses = progress?.lapses || 0;
  if (answer === "again") return { box: 1, due: addDays(today, INTERVALS[1]), lapses: lapses + 1, introduced_on };
  const box = answer === "easy" ? LAST_BOX : Math.min((progress?.box || 1) + 1, LAST_BOX);
  return { box, due: addDays(today, INTERVALS[box]), lapses, introduced_on };
}

const shuffle = (list, rng) => {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// Les items de la Révision du jour : { id, entry, dir }.
// lessonId : une seule Leçon (toutes ses nouvelles Cartes, sans limite du jour).
// limit : nombre maximum d'items, les Cartes à revoir passant avant les nouvelles.
export function dailyItems(entries, progress, today, { newPerDay = NEW_PER_DAY, rng = Math.random, lessonId = "", limit = Infinity } = {}) {
  const cards = entries.filter(e => reviewable(e) && (!lessonId || e.lesson_id === lessonId));
  const known = new Map(progress.map(p => [`${p.entry_id}:${p.direction}`, p]));
  const item = (entry, dir) => ({ id: `${entry.id}:${dir}`, entry, dir });

  const due = [], fresh = [];
  const byAge = cards.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (const entry of byAge) {
    for (const dir of DIRECTIONS) {
      const p = known.get(`${entry.id}:${dir}`);
      if (!p) fresh.push(item(entry, dir));
      else if (p.due <= today) due.push(item(entry, dir));
    }
  }
  const introducedToday = progress.filter(p => p.introduced_on === today).length;
  const room = lessonId ? Infinity : Math.max(0, newPerDay - introducedToday);
  return [...shuffle(due, rng), ...shuffle(fresh.slice(0, room), rng)].slice(0, limit);
}

// Le prochain jour où des Cartes reviennent, et combien : { day, count }, ou null.
export function nextReviews(entries, progress, today) {
  const cards = new Set(entries.filter(reviewable).map(e => e.id));
  const later = progress.filter(p => cards.has(p.entry_id) && p.due > today);
  if (!later.length) return null;
  const day = later.reduce((min, p) => (p.due < min ? p.due : min), later[0].due);
  return { day, count: later.filter(p => p.due === day).length };
}

// Cartes difficiles : au moins HARD_LAPSES « À revoir » dans un Sens.
export const hardEntryIds = progress => new Set(progress.filter(p => p.lapses >= HARD_LAPSES).map(p => p.entry_id));
