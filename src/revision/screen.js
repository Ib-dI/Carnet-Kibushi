// La Révision en cours, à l'écran : l'état de la séance et toutes ses règles, sans HTML.
// L'affichage (ui/review.js) lit `state`, appelle les actions, et s'abonne avec onChange
// pour ce qui arrive après coup (un enregistrement qui échoue).
//
// Dépendances données au démarrage : le Carnet, la date du jour (fonction) et le hasard.

import { createSession, createDailySession } from "./session.js";
import { dailyItems, localToday, nextProgress, nextReviews, daysBetween } from "./schedule.js";

const when = days => days <= 1 ? "demain" : `dans ${days} jours`;

export function createRevisionScreen({ carnet, today = localToday, rng = Math.random }) {
  // mode : "jour" (Boîtes de Leitner) ou "libre" (toutes les Cartes) ; dir : Sens en libre ;
  // size : nombre de Cartes du jour (0 = tout) ; flash : où va la Carte qu'on vient de noter.
  let session = null, scope = null, mode = "jour", dir = "fr", lessonId = "", size = 0;
  let flash = "", saveFailed = false;
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => fn(api.state));

  // Première réponse sur une Carte dans un Sens : on l'enregistre (du jour comme libre) et on annonce son retour.
  function record(entryId, d, answer) {
    const day = today();
    const current = carnet.state.progress.find(p => p.entry_id === entryId && p.direction === d) || null;
    const next = nextProgress(current, answer, day);
    flash = answer === "again" ? "↺ À revoir : elle repasse tout à l'heure, puis demain"
      : `✓ Revient ${when(daysBetween(day, next.due))}`;
    carnet.markReviewDay(day);
    carnet.recordAnswer(entryId, d, answer, day).then(r => {
      if (!r.ok && !saveFailed) { saveFailed = true; emit(); }
    });
  }

  function build() {
    flash = ""; saveFailed = false;
    const { entries, progress } = carnet.state;
    if (mode === "libre") {
      // En écoute, seules les Cartes qui ont un Vocal.
      const pool = dir === "ec" ? entries.filter(e => e.audio_path) : entries;
      session = createSession(pool, { lessonId, rng, onFirstAnswer: (e, a) => record(e.id, dir, a) });
    } else {
      const items = dailyItems(entries, progress, today(), { lessonId, limit: size || Infinity, rng });
      session = createDailySession(items, { onFirstAnswer: (it, a) => record(it.entry.id, it.dir, a) });
    }
  }

  const api = {
    get state() {
      const cur = session?.current || null;
      const card = !cur ? null : mode === "jour" ? { entry: cur.entry, dir: cur.dir } : { entry: cur, dir };
      const empty = !session?.total;
      return {
        mode, dir, lessonId, size, flash, saveFailed, card,
        flipped: session?.flipped || false,
        position: session?.position || 0, count: session?.count || 0,
        total: session?.total || 0, score: session?.score || 0,
        empty, done: !empty && !cur,
        // Révision du jour sans rien à revoir : quand reviennent les prochaines Cartes.
        next: empty && mode === "jour" ? nextReviews(carnet.state.entries, carnet.state.progress, today()) : null,
      };
    },

    // Ouvrir l'écran sur une Leçon (ou toutes). La séance en cours est gardée si on revient
    // sur le même périmètre ; elle est refaite si on change de Leçon ou si elle était finie.
    open({ lessonId: id = "" } = {}) {
      const target = carnet.state.lessons.some(l => l.id === id) ? id : "";
      if (session && scope === target && session.current) return;
      scope = target; lessonId = target; mode = "jour";
      build();
    },

    flip() { flash = ""; session?.flip(); },
    answer(kind) { flash = ""; if (["again", "knew", "easy"].includes(kind)) session?.[kind](); },
    restart() { build(); },
    setMode(m) { mode = m === "libre" ? "libre" : "jour"; build(); },
    setSize(n) { size = [10, 20].includes(n) ? n : 0; build(); },
    // En libre : changer de Sens ne refait le paquet que si on entre en Écoute ou si on en sort.
    setDir(d) {
      const rebuild = (dir === "ec") !== (d === "ec");
      dir = d;
      if (rebuild) build();
    },

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return api;
}
