// Révision du jour : les Boîtes de Leitner, par Membre, par Carte et par Sens de révision.
// Un progrès = { entry_id, direction: "fr" | "lg", box: 1..5, due: "AAAA-MM-JJ", lapses, introduced_on }.

import { reviewable } from "./session.js";

export const DIRECTIONS = ["fr", "lg"];
// Jours avant le retour d'une Carte, selon sa Boîte.
export const INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
const LAST_BOX = 5;
export const NEW_PER_DAY = 10;   // nouvelles Cartes × Sens par jour
const HARD_LAPSES = 2;

export function addDays(day, n) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Date du jour, locale (le jour change à minuit chez le Membre, pas à minuit UTC).
export const localToday = () => new Date().toLocaleDateString("sv-SE");

// Le progrès après une réponse. Seule la première réponse d'une séance compte.
export function nextProgress(progress, knew, today) {
  const introduced_on = progress?.introduced_on || today;
  const lapses = progress?.lapses || 0;
  if (!knew) return { box: 1, due: addDays(today, INTERVALS[1]), lapses: lapses + 1, introduced_on };
  const box = Math.min((progress?.box || 1) + 1, LAST_BOX);
  return { box, due: addDays(today, INTERVALS[box]), lapses, introduced_on };
}

const shuffle = (list, rng) => {
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// Les items de la Révision du jour : { id, entry, dir }.
export function dailyItems(entries, progress, today, { newPerDay = NEW_PER_DAY, rng = Math.random } = {}) {
  const cards = entries.filter(reviewable);
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
  const room = Math.max(0, newPerDay - introducedToday);
  return shuffle([...due, ...fresh.slice(0, room)], rng);
}

// Cartes difficiles : au moins HARD_LAPSES « À revoir » dans un Sens.
export const hardEntryIds = progress => new Set(progress.filter(p => p.lapses >= HARD_LAPSES).map(p => p.entry_id));
