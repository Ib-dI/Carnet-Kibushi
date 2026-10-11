import { describe, it, expect } from "vitest";
import { createSession, createDailySession, reviewable } from "./session.js";

const e = (id, extra = {}) => ({ id, type: "mot", word: `w${id}`, translation: `t${id}`, lesson_id: "L1", ...extra });
const noShuffle = () => 0.999999; // Fisher-Yates avec j = i : l'ordre reste celui d'origine
const ids = s => { const out = []; while (s.current) { out.push(s.current.id); s.flip(); s.knew(); } return out; };

describe("reviewable", () => {
  it("needs a word and a Traduction, and excludes Conseils", () => {
    expect(reviewable(e(1))).toBeTruthy();
    expect(reviewable(e(1, { word: "" }))).toBeFalsy();
    expect(reviewable(e(1, { translation: "" }))).toBeFalsy();
    expect(reviewable(e(1, { type: "conseil" }))).toBeFalsy();
  });
});

describe("createSession", () => {
  it("keeps only reviewable Cartes, optionally from one Leçon", () => {
    const entries = [e(1), e(2, { lesson_id: "L2" }), e(3, { type: "conseil" }), e(4, { translation: "" })];
    expect(ids(createSession(entries, { rng: noShuffle }))).toEqual([1, 2]);
    expect(ids(createSession(entries, { lessonId: "L2", rng: noShuffle }))).toEqual([2]);
  });

  it("shuffles with the given random source", () => {
    const s = createSession([e(1), e(2), e(3)], { rng: () => 0 });
    expect(ids(s)).toEqual([2, 3, 1]);
  });

  it("an empty session is done right away", () => {
    const s = createSession([], { rng: noShuffle });
    expect(s.current).toBe(null);
    expect(s.total).toBe(0);
  });

  it("knew/again only count once the Carte is flipped", () => {
    const s = createSession([e(1), e(2)], { rng: noShuffle });
    s.knew(); s.again();
    expect(s.current.id).toBe(1);
    expect(s.flipped).toBe(false);
    s.flip();
    expect(s.flipped).toBe(true);
    s.knew();
    expect(s.current.id).toBe(2);
    expect(s.flipped).toBe(false);
  });

  it("« À revoir » sends the Carte to the back and grows the count", () => {
    const s = createSession([e(1), e(2)], { rng: noShuffle });
    s.flip(); s.again();
    expect(s.position).toBe(1);
    expect(s.count).toBe(3);
    expect(ids(s)).toEqual([2, 1]);
  });

  it("the score counts only Cartes known on the first try", () => {
    const s = createSession([e(1), e(2), e(3)], { rng: noShuffle });
    s.flip(); s.again();  // 1 à revoir
    s.flip(); s.knew();   // 2 su
    s.flip(); s.knew();   // 3 su
    s.flip(); s.knew();   // 1 su au deuxième passage
    expect(s.current).toBe(null);
    expect([s.score, s.total]).toEqual([2, 3]);
  });

  it("reports first answers in Révision libre too", () => {
    const seen = [];
    const s = createSession([e(1)], { rng: noShuffle, onFirstAnswer: (it, a) => seen.push([it.id, a]) });
    s.flip(); s.again(); s.flip(); s.knew();
    expect(seen).toEqual([[1, "again"]]);
  });

  it("keeps its own copy of the Cartes", () => {
    const entries = [e(1)];
    const s = createSession(entries, { rng: noShuffle });
    entries.length = 0;
    expect(s.current.id).toBe(1);
  });
});

describe("createDailySession", () => {
  const item = (id, dir) => ({ id: `${id}:${dir}`, entry: e(id), dir });

  it("reports only the first answer on each item", () => {
    const seen = [];
    const s = createDailySession([item(1, "fr"), item(1, "lg")], { onFirstAnswer: (it, knew) => seen.push([it.id, knew]) });
    s.flip(); s.again();   // 1:fr à revoir
    s.flip(); s.knew();    // 1:lg su
    s.flip(); s.knew();    // 1:fr su au deuxième passage : pas rapporté
    expect(seen).toEqual([["1:fr", "again"], ["1:lg", "knew"]]);
    expect([s.score, s.total, s.current]).toEqual([1, 2, null]);
  });

  it("« Par cœur » counts as known and is reported as easy", () => {
    const seen = [];
    const s = createDailySession([item(1, "fr")], { onFirstAnswer: (it, a) => seen.push(a) });
    s.easy(); // pas encore retournée : ignoré
    s.flip(); s.easy();
    expect(seen).toEqual(["easy"]);
    expect([s.score, s.current]).toEqual([1, null]);
  });

  it("keeps the items' order (already shuffled by the planning)", () => {
    const s = createDailySession([item(2, "lg"), item(1, "fr")]);
    expect(s.current.id).toBe("2:lg");
  });
});
