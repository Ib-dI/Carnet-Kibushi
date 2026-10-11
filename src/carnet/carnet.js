// Le Carnet : chargement, temps réel, et toutes les écritures (lignes et Médias).
// Supabase passe par deux adaptateurs injectés : db et storage (voir supabase-adapter.js).

import { reduce, emptyState, fromLoad } from "./reduce.js";
import { mediaTarget } from "./media-path.js";
import { nextProgress } from "../revision/schedule.js";

export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const TABLES = ["carnet", "lessons", "entries", "members", "progress", "attempts"];

const ok = value => (value === undefined ? { ok: true } : { ok: true, value });
const fail = (reason, extra) => ({ ok: false, reason, ...extra });
const sameEmail = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();

export function createCarnet({ db, storage, me }) {
  let state = emptyState();
  const listeners = new Set();
  let unsubscribe = null;
  let pending = null;   // changements reçus pendant un chargement, rejoués ensuite
  let lostRealtime = false;

  const emit = () => listeners.forEach(fn => fn(state));
  const apply = change => {
    if (pending) { pending.push(change); return; }
    const next = reduce(state, change);
    if (next !== state) { state = next; emit(); }
  };

  async function load() {
    pending = [];
    try {
      const rows = await Promise.all(TABLES.map(t => db.list(t)));
      const loaded = Object.fromEntries(TABLES.map((t, i) => [t, rows[i]]));
      state = fromLoad({ ...loaded, carnet: loaded.carnet[0] });
    } finally {
      const queued = pending; pending = null;
      queued.forEach(c => { state = reduce(state, c); });
      emit();
    }
  }

  async function resync() {
    try { await load(); } catch (e) { console.warn("resync", e); }
  }

  function onStatus(status) {
    if (status === "SUBSCRIBED") {
      if (lostRealtime) { lostRealtime = false; resync(); }
    } else {
      lostRealtime = true;
    }
  }

  // Supprime des fichiers sans jamais faire échouer l'opération : au pire, un fichier orphelin.
  async function removeFiles(paths) {
    const list = paths.filter(Boolean);
    if (!list.length) return;
    try { await storage.remove(list); } catch (e) { console.warn("removeFiles", e); }
  }

  // Tous les fichiers d'Entrées : leurs Médias et les Essais de chacun.
  const filesOf = entries => entries.flatMap(e =>
    [e.image_path, e.audio_path, ...state.attempts.filter(t => t.entry_id === e.id).map(t => t.audio_path)]);

  return {
    get state() { return state; },

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async start() {
      if (unsubscribe) return { status: "ok" };
      try {
        const members = await db.list("members");
        if (!members.length) return { status: "not-member" };
      } catch { return { status: "offline" }; }
      // On s'abonne avant de charger : ce qui arrive pendant le chargement est rejoué.
      unsubscribe = db.subscribe(apply, onStatus);
      try { await load(); }
      catch (e) { console.warn(e); unsubscribe(); unsubscribe = null; return { status: "offline" }; }
      return { status: "ok" };
    },

    resync,

    authorName(email) {
      if (!email) return "";
      if (me && sameEmail(email, me)) return "toi";
      return state.members.find(m => sameEmail(m.email, email))?.display_name || "";
    },

    myName() {
      return state.members.find(m => sameEmail(m.email, me))?.display_name || me || "";
    },

    // draft : { type, word, pron, translation, note, emoji, text_color, lesson_id, image, audio }
    // image / audio : { keep: true } (par défaut), { replace: Blob } ou { remove: true }.
    async saveEntry(existing, draft) {
      const media = { image: draft.image || { keep: true }, audio: draft.audio || { keep: true } };
      const word = (draft.word || "").trim(), translation = (draft.translation || "").trim();
      const pathAfter = kind => {
        const m = media[kind], old = existing?.[`${kind}_path`] || null;
        return m.remove ? null : m.replace ? undefined : old;
      };
      const hasAudio = media.audio.replace || pathAfter("audio");
      if (!word && !translation && !hasAudio) return fail("empty");
      for (const kind of ["image", "audio"]) {
        if (media[kind].replace && media[kind].replace.size > MAX_MEDIA_BYTES) return fail("too-large", { media: kind });
      }

      const uploaded = [];
      try {
        const paths = {};
        for (const kind of ["image", "audio"]) {
          const blob = media[kind].replace;
          if (!blob) { paths[kind] = pathAfter(kind); continue; }
          const { path, contentType } = mediaTarget(blob, kind);
          await storage.upload(path, blob, contentType);
          uploaded.push(path);
          paths[kind] = path;
        }
        const body = {
          type: draft.type || "mot", word, translation,
          pron: draft.type === "conseil" ? "" : (draft.pron || "").trim(),
          note: (draft.note || "").trim(), emoji: draft.emoji || "", text_color: draft.text_color || "",
          lesson_id: draft.lesson_id, image_path: paths.image, audio_path: paths.audio,
        };
        const row = existing ? await db.update("entries", existing.id, body) : await db.insert("entries", body);
        apply({ table: "entries", type: existing ? "UPDATE" : "INSERT", row });
        // Les anciens fichiers ne partent qu'une fois la ligne à jour.
        if (existing) await removeFiles(["image", "audio"].map(k => existing[`${k}_path`] !== paths[k] && existing[`${k}_path`]));
        return ok(row);
      } catch (e) {
        console.warn("saveEntry", e);
        await removeFiles(uploaded);
        return fail("network");
      }
    },

    async deleteEntry(entry) {
      const paths = filesOf([entry]);
      // Progrès et Essais partent avec l'Entrée (on delete cascade) ; leurs fichiers, c'est à nous.
      try { await db.remove("entries", entry.id); }
      catch (e) { console.warn("deleteEntry", e); return fail("network"); }
      apply({ table: "entries", type: "DELETE", row: entry });
      await removeFiles(paths);
      return ok();
    },

    async saveLesson(existing, { title, emoji = "", color = "canard" }) {
      title = (title || "").trim();
      if (!title) return fail("empty");
      try {
        let row;
        if (existing) {
          row = await db.update("lessons", existing.id, { title, emoji, color });
        } else {
          const position = Math.max(0, ...state.lessons.map(l => l.position || 0)) + 1;
          row = await db.insert("lessons", { title, emoji, color, position });
        }
        apply({ table: "lessons", type: existing ? "UPDATE" : "INSERT", row });
        return ok(row);
      } catch (e) {
        console.warn("saveLesson", e);
        return fail("network");
      }
    },

    async deleteLesson(lesson) {
      const paths = filesOf(state.entries.filter(e => e.lesson_id === lesson.id));
      // Les Entrées partent avec la Leçon (on delete cascade).
      try { await db.remove("lessons", lesson.id); }
      catch (e) { console.warn("deleteLesson", e); return fail("network"); }
      apply({ table: "lessons", type: "DELETE", row: lesson });
      await removeFiles(paths);
      return ok();
    },

    // Révision du jour : enregistre la première réponse d'une séance sur une Carte, dans un Sens.
    async recordAnswer(entryId, direction, knew, today) {
      const current = state.progress.find(p => p.entry_id === entryId && p.direction === direction) || null;
      try {
        const row = await db.upsert("progress", { entry_id: entryId, direction, ...nextProgress(current, knew, today) },
          ["member_email", "entry_id", "direction"]);
        apply({ table: "progress", type: current ? "UPDATE" : "INSERT", row });
        return ok(row);
      } catch (e) {
        console.warn("recordAnswer", e);
        return fail("network");
      }
    },

    // Les Essais d'une Entrée, le mien d'abord.
    attemptsOf(entryId) {
      return state.attempts.filter(t => t.entry_id === entryId)
        .sort((x, y) => Number(!sameEmail(x.member_email, me)) - Number(!sameEmail(y.member_email, me)));
    },

    // Mon Essai sur une Entrée : remplace le précédent, dont le fichier part ensuite.
    async saveAttempt(entryId, blob) {
      if (blob.size > MAX_MEDIA_BYTES) return fail("too-large", { media: "audio" });
      const old = state.attempts.find(t => t.entry_id === entryId && sameEmail(t.member_email, me));
      const { path, contentType } = mediaTarget(blob, "audio");
      try {
        await storage.upload(path, blob, contentType);
      } catch (e) { console.warn("saveAttempt", e); return fail("network"); }
      try {
        const row = await db.upsert("attempts", { entry_id: entryId, audio_path: path }, ["entry_id", "member_email"]);
        apply({ table: "attempts", type: old ? "UPDATE" : "INSERT", row });
        if (old && old.audio_path !== path) await removeFiles([old.audio_path]);
        return ok(row);
      } catch (e) {
        console.warn("saveAttempt", e);
        await removeFiles([path]);
        return fail("network");
      }
    },

    async deleteAttempt(attempt) {
      if (!sameEmail(attempt.member_email, me)) return fail("forbidden");
      try { await db.remove("attempts", attempt.id); }
      catch (e) { console.warn("deleteAttempt", e); return fail("network"); }
      apply({ table: "attempts", type: "DELETE", row: attempt });
      await removeFiles([attempt.audio_path]);
      return ok();
    },

    async renameLangue(name) {
      try {
        const row = await db.update("carnet", 1, { langue: (name || "").trim() });
        apply({ table: "carnet", type: "UPDATE", row });
        return ok(row);
      } catch (e) {
        console.warn("renameLangue", e);
        return fail("network");
      }
    },
  };
}
