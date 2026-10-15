// Écran « Progrès » (#/progres) : série de jours, Cartes à venir, maîtrise par Leçon (calculs : revision/stats.js).
import { carnet } from "./carnet-ref.js";
import { localToday } from "../revision/schedule.js";
import { streak, recentDays, upcoming, mastery, MASTERED_BOX } from "../revision/stats.js";
import { $, esc, colorVar, lessonLabel } from "./dom.js";

const DAY_NAMES = ["auj.", "demain"];
const dateOf = d => new Date(`${d}T12:00:00`);
const dayLabel = (d, i) => DAY_NAMES[i] || dateOf(d).toLocaleDateString("fr-FR", { weekday: "short" });
const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

export function renderProgress() {
  $("#progress").innerHTML = `<div class="rev">${progressHTML()}</div>`;
}

function progressHTML() {
  const { entries, progress, lessons, review_days } = carnet.state;
  const today = localToday(), done = review_days.map(d => d.day);
  const days = streak(done, today);
  // Les 7 derniers jours : on voit pourquoi la série vaut ce qu'elle vaut.
  const week = recentDays(done, today, 7).map(d => {
    const mark = d.done ? "✓" : d.today ? "○" : "·";
    const state = d.done ? "révisé" : d.today ? "à faire aujourd'hui" : "pas de révision";
    const name = dateOf(d.day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return `<li class="wk-day ${d.done ? "done" : ""} ${d.today ? "today" : ""}" aria-label="${esc(`${name} : ${state}`)}">
      <span class="wk-d" aria-hidden="true">${esc(dateOf(d.day).toLocaleDateString("fr-FR", { weekday: "narrow" }))}</span>
      <span class="wk-m" aria-hidden="true">${mark}</span></li>`;
  }).join("");
  const next = upcoming(entries, progress, today, 7);
  const most = Math.max(1, ...next.map(n => n.count));
  const bars = next.map((n, i) => `<div class="up-day"><div class="up-bar" style="height:${Math.round((60 * n.count) / most)}px"></div>
    <div class="up-n">${n.count}</div><div class="up-d">${esc(dayLabel(n.day, i))}</div></div>`).join("");
  const fresh = next[0].fresh;
  // Maîtrise en trois états : sues, en cours (déjà vues), à découvrir.
  const pct = (n, m) => (100 * n) / m.items;
  const rows = mastery(lessons, entries, progress).filter(m => m.items).map(m => `<div class="m-row" style="--c:${colorVar(m.lesson.color)}">
    <span class="m-name">${esc(lessonLabel(m.lesson))}</span>
    <span class="m-track" role="img" aria-label="${esc(`${plural(m.mastered, "sue")}, ${m.learning} en cours, ${m.fresh} à découvrir`)}">
      <i class="m-sue" style="width:${pct(m.mastered, m)}%"></i><i class="m-cours" style="width:${pct(m.learning, m)}%"></i></span>
    <span class="m-legend">${plural(m.mastered, "sue")} · ${m.learning} en cours · ${m.fresh} à découvrir</span></div>`).join("");
  return `<div class="label">Progrès</div><div class="card-face progress-view">
      <div class="big">${days ? `🔥 ${plural(days, "jour")} d'affilée` : "Pas encore de série"}</div>
      <ol class="week" aria-label="Les 7 derniers jours">${week}</ol>
      <div class="q">${days ? "Révise chaque jour pour la prolonger." : "Fais ta Révision du jour pour commencer une série."}</div>
    </div>
    <div class="label">À réviser les 7 prochains jours</div>
    <div class="upcoming">${bars}</div>
    ${fresh ? `<p class="status">Aujourd'hui : ${plural(next[0].count, "carte")}, dont ${plural(fresh, "nouvelle")}.</p>` : ""}
    <div class="label">Maîtrise par leçon</div>
    <div class="mastery">${rows || `<p class="status">Pas encore de carte à réviser.</p>`}</div>
    ${rows ? `<p class="status m-key"><i class="m-sue"></i> sue : réussie plusieurs jours de suite (boîte ${MASTERED_BOX} ou plus) · <i class="m-cours"></i> en cours : déjà vue · gris : à découvrir</p>` : ""}`;
}
