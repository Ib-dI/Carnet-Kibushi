import { describe, it, expect, beforeEach } from "vitest";
import { createRevisionScreen } from "./screen.js";
import { createCarnet } from "../carnet/carnet.js";
import { createMemoryServer } from "../carnet/memory-adapter.js";

const ME = "moi@x.fr";
const TODAY = "2026-10-11", TOMORROW = "2026-10-12";
const tick = () => new Promise(r => setTimeout(r, 0));
const keep = () => 0.999999;   // pas de mélange : ordre de création
const vocal = () => new Blob([new Uint8Array(4)], { type: "audio/webm" });

let server, carnet, day, A, B;
const screen = () => createRevisionScreen({ carnet, today: () => day, rng: keep });
// Répond à toutes les Cartes restantes avec `kind`.
const finish = (s, kind = "knew") => { while (s.state.card) { s.flip(); s.answer(kind); } };

beforeEach(async () => {
  day = TODAY;
  server = createMemoryServer({ members: [{ email: ME, display_name: "Moi" }] });
  carnet = createCarnet({ ...server.connect(ME), me: ME });
  await carnet.start();
  A = (await carnet.saveLesson(null, { title: "Salutations" })).value;
  B = (await carnet.saveLesson(null, { title: "Famille" })).value;
  await carnet.saveEntry(null, { type: "mot", word: "mbote", translation: "bonjour", lesson_id: A.id, audio: { replace: vocal() } });
  await carnet.saveEntry(null, { type: "mot", word: "kwaheri", translation: "au revoir", lesson_id: A.id });
  await carnet.saveEntry(null, { type: "mot", word: "mama", translation: "maman", lesson_id: B.id });
});

describe("Révision du jour", () => {
  it("opens on today's Cartes, front side first", () => {
    const s = screen();
    s.open();
    expect(s.state).toMatchObject({ mode: "jour", flipped: false, position: 0, total: 7, done: false });
    expect(s.state.card.entry.word).toBe("mbote");
  });

  it("an answer is recorded once, marks the review day, and says when the Carte comes back", async () => {
    const s = screen();
    s.open();
    const first = s.state.card;
    s.flip();
    s.answer("knew");
    expect(s.state.flash).toBe("✓ Revient dans 3 jours");
    await tick();
    expect(carnet.state.progress).toMatchObject([{ entry_id: first.entry.id, direction: first.dir, box: 2, due: "2026-10-14" }]);
    expect(carnet.state.review_days.map(d => d.day)).toEqual([TODAY]);
  });

  it("« À revoir » comes back in the session, and tomorrow", async () => {
    const s = screen();
    s.open({ lessonId: B.id });
    s.flip();
    s.answer("again");
    expect(s.state.flash).toMatch(/tout à l'heure, puis demain/);
    expect(s.state.card.entry.word).toBe("mama");   // l'autre Sens
    s.flip(); s.answer("knew");
    expect(s.state.card.entry.word).toBe("mama");   // la Carte ratée repasse
    s.flip(); s.answer("knew");
    expect(s.state).toMatchObject({ done: true, score: 1, total: 2 });
    await tick();
    expect(carnet.state.progress.find(p => p.lapses === 1)).toMatchObject({ box: 1, due: TOMORROW });
  });

  it("the flash only describes the answer just given", () => {
    const s = screen();
    s.open();
    s.flip(); s.answer("easy");
    expect(s.state.flash).toBe("✓ Revient dans 30 jours");
    s.flip();
    expect(s.state.flash).toBe("");
  });

  it("when everything is done, says when the next Cartes come back", async () => {
    const s = screen();
    s.open({ lessonId: B.id });
    finish(s);
    await tick();
    const again = screen();
    again.open({ lessonId: B.id });
    expect(again.state).toMatchObject({ empty: true, next: { day: "2026-10-14", count: 2 } });
  });

  it("10 / 20 / Tout limits the session", () => {
    const s = screen();
    s.open();
    s.setSize(10);
    expect(s.state.total).toBe(7);
    s.setSize(0);
    expect(s.state.size).toBe(0);
    const few = screen();
    few.open();
    few.setSize(10);
    expect(few.state.total).toBeLessThanOrEqual(10);
  });
});

describe("garder ou refaire la séance", () => {
  it("keeps the session when coming back to the screen", () => {
    const s = screen();
    s.open();
    s.flip(); s.answer("knew");
    s.open();
    expect(s.state.position).toBe(1);
  });

  it("rebuilds when the Leçon changes, or when the session was finished", async () => {
    const s = screen();
    s.open({ lessonId: B.id });
    s.flip(); s.answer("knew");
    s.open({ lessonId: A.id });
    expect(s.state).toMatchObject({ lessonId: A.id, position: 0 });
    finish(s);
    await tick();
    s.open({ lessonId: A.id });
    expect(s.state.empty).toBe(true);
  });

  it("an unknown Leçon falls back to all Leçons", () => {
    const s = screen();
    s.open({ lessonId: "supprimée" });
    expect(s.state.lessonId).toBe("");
  });
});

describe("Révision libre", () => {
  it("shows every Carte of the scope and records answers too", async () => {
    const s = screen();
    s.open({ lessonId: A.id });
    s.setMode("libre");
    expect(s.state).toMatchObject({ mode: "libre", total: 2, dir: "fr" });
    s.flip(); s.answer("knew");
    await tick();
    expect(carnet.state.progress).toHaveLength(1);
  });

  it("Écoute keeps only Cartes with a Vocal; switching Sens rebuilds only around Écoute", () => {
    const s = screen();
    s.open({ lessonId: A.id });
    s.setMode("libre");
    s.flip(); s.answer("knew");
    s.setDir("lg");
    expect(s.state.position).toBe(1);   // même paquet
    s.setDir("ec");
    expect(s.state).toMatchObject({ dir: "ec", total: 1, position: 0 });
    expect(s.state.card.entry.word).toBe("mbote");
  });

  it("back to the Révision du jour", () => {
    const s = screen();
    s.open();
    s.setMode("libre");
    s.setMode("jour");
    expect(s.state).toMatchObject({ mode: "jour", total: 7 });
  });
});

describe("erreurs", () => {
  it("a failed save is shown, and listeners are told", async () => {
    const s = screen();
    const seen = [];
    s.onChange(st => seen.push(st.saveFailed));
    s.open();
    server.failNext("upsert", 2);
    s.flip(); s.answer("knew");
    await tick(); await tick();
    expect(s.state.saveFailed).toBe(true);
    expect(seen).toContain(true);
  });
});
