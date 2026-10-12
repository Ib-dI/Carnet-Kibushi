// Écran « Progrès » (#/progres) : série de jours, Cartes à venir, maîtrise par Leçon (calculs : revision/stats.js).
import { carnet } from "./carnet-ref.js";
import { localToday } from "../revision/schedule.js";
import { streak, upcoming, mastery, MASTERED_BOX } from "../revision/stats.js";
import { $, esc, colorVar, lessonLabel } from "./dom.js";

const DAY_NAMES = ["auj.", "demain"];
const dayLabel = (d, i) => DAY_NAMES[i] || new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short" });

export function renderProgress() {
  $("#progress").innerHTML = `<div class="rev">${progressHTML()}</div>`;
}

function progressHTML() {
  const { entries, progress, lessons, review_days } = carnet.state;
  const today = localToday();
  const days = streak(review_days.map(d => d.day), today);
  const next = upcoming(entries, progress, today, 7);
  const most = Math.max(1, ...next.map(n => n.count));
  const bars = next.map((n, i) => `<div class="up-day"><div class="up-bar" style="height:${Math.round((60 * n.count) / most)}px"></div>
    <div class="up-n">${n.count}</div><div class="up-d">${esc(dayLabel(n.day, i))}</div></div>`).join("");
  const rows = mastery(lessons, entries, progress).filter(m => m.items).map(m => `<div class="m-row">
    <span class="m-name">${esc(lessonLabel(m.lesson))}</span>
    <span class="m-track" role="img" aria-label="${m.percent} % sues"><i style="width:${m.percent}%;--c:${colorVar(m.lesson.color)}"></i></span>
    <span class="m-pct">${m.percent} %</span></div>`).join("");
  return `<div class="label">Progrès</div><div class="card-face progress-view">
      <div class="big">${days ? `🔥 ${days} jour${days > 1 ? "s" : ""} d'affilée` : "Pas encore de série"}</div>
      <div class="q">${days ? "Révise chaque jour pour la prolonger." : "Fais ta Révision du jour pour commencer une série."}</div>
    </div>
    <div class="label">À revoir les 7 prochains jours</div>
    <div class="upcoming">${bars}</div>
    <div class="label">Maîtrise par leçon <small>(cartes en boîte ${MASTERED_BOX} ou plus)</small></div>
    <div class="mastery">${rows || `<p class="status">Pas encore de carte à réviser.</p>`}</div>`;
}
