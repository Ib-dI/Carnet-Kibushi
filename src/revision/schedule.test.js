import { describe, it, expect } from "vitest";
import { addDays, daysBetween, nextProgress, dailyItems, nextReviews, hardEntryIds, INTERVALS, NEW_PER_DAY } from "./schedule.js";

const TODAY = "2026-10-11";
const e = (id, extra = {}) => ({ id, type: "mot", word: `w${id}`, translation: `t${id}`, lesson_id: "L", ...extra });
const p = (entry_id, direction, extra = {}) => ({ entry_id, direction, box: 1, due: TODAY, lapses: 0, introduced_on: "2026-10-01", ...extra });
const keep = () => 0.999999;

describe("addDays", () => {
  it("adds days across months", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("daysBetween", () => {
  it("counts calendar days", () => {
    expect(daysBetween("2026-10-11", "2026-10-14")).toBe(3);
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
  });
});

describe("nextProgress", () => {
  it("a new Carte known first time goes to Boîte 2", () => {
    expect(nextProgress(null, "knew", TODAY)).toEqual({ box: 2, due: addDays(TODAY, INTERVALS[2]), lapses: 0, introduced_on: TODAY });
  });

  it("« Je savais » climbs one Boîte, up to the last", () => {
    expect(nextProgress(p("a", "fr", { box: 3 }), "knew", TODAY)).toMatchObject({ box: 4, due: addDays(TODAY, INTERVALS[4]) });
    expect(nextProgress(p("a", "fr", { box: 5 }), "knew", TODAY)).toMatchObject({ box: 5, due: addDays(TODAY, INTERVALS[5]) });
  });

  it("« À revoir » goes back to Boîte 1, due tomorrow, and counts a lapse", () => {
    expect(nextProgress(p("a", "fr", { box: 4, lapses: 1 }), "again", TODAY)).toMatchObject({ box: 1, due: addDays(TODAY, 1), lapses: 2 });
    expect(nextProgress(null, "again", TODAY)).toMatchObject({ box: 1, lapses: 1, introduced_on: TODAY });
  });

  it("« Par cœur » jumps to the last Boîte", () => {
    expect(nextProgress(p("a", "fr", { box: 1, lapses: 2 }), "easy", TODAY)).toMatchObject({ box: 5, due: addDays(TODAY, INTERVALS[5]), lapses: 2 });
    expect(nextProgress(null, "easy", TODAY)).toMatchObject({ box: 5, introduced_on: TODAY });
  });

  it("keeps the day the Carte was introduced", () => {
    expect(nextProgress(p("a", "fr"), "knew", TODAY).introduced_on).toBe("2026-10-01");
  });
});

describe("dailyItems", () => {
  it("includes due items in both Sens, not future ones", () => {
    const items = dailyItems([e("a"), e("b")], [
      p("a", "fr", { due: TODAY }), p("a", "lg", { due: addDays(TODAY, 2) }),
      p("b", "fr", { due: "2026-10-01" }), p("b", "lg", { due: TODAY }),
    ], TODAY, { rng: keep });
    expect(items.map(i => `${i.entry.id}:${i.dir}`).sort()).toEqual(["a:fr", "b:fr", "b:lg"]);
  });

  it("adds new items up to the daily limit, minus those already introduced today", () => {
    const entries = Array.from({ length: 8 }, (_, i) => e(`n${i}`));
    expect(dailyItems(entries, [], TODAY, { rng: keep })).toHaveLength(NEW_PER_DAY);
    const introducedToday = [p("n0", "fr", { introduced_on: TODAY, due: addDays(TODAY, 3) }), p("n0", "lg", { introduced_on: TODAY, due: addDays(TODAY, 3) })];
    expect(dailyItems(entries, introducedToday, TODAY, { rng: keep })).toHaveLength(NEW_PER_DAY - 2);
  });

  it("introduces new Cartes in creation order, both Sens together", () => {
    const entries = [e("x", { created_at: "2026-02" }), e("y", { created_at: "2026-01" })];
    const items = dailyItems(entries, [], TODAY, { rng: keep, newPerDay: 2 });
    expect(items.map(i => `${i.entry.id}:${i.dir}`).sort()).toEqual(["y:fr", "y:lg"]);
  });

  it("ignores Entrées that are not Cartes, and progress of deleted Entrées", () => {
    const items = dailyItems([e("c", { type: "conseil" })], [p("gone", "fr")], TODAY, { rng: keep });
    expect(items).toEqual([]);
  });
});

describe("hardEntryIds", () => {
  it("a Carte difficile has at least 2 lapses in one Sens", () => {
    expect([...hardEntryIds([p("a", "fr", { lapses: 2 }), p("b", "fr", { lapses: 1 }), p("b", "lg", { lapses: 1 })])]).toEqual(["a"]);
  });
});

describe("nextReviews", () => {
  it("gives the next day with Cartes to review, and how many", () => {
    const entries = [e("a"), e("b"), e("gone", { type: "conseil" })];
    const progress = [
      p("a", "fr", { due: addDays(TODAY, 1) }), p("a", "lg", { due: addDays(TODAY, 3) }),
      p("b", "fr", { due: addDays(TODAY, 1) }), p("b", "lg", { due: addDays(TODAY, 1) }),
      p("gone", "fr", { due: addDays(TODAY, 1) }), p("x", "fr", { due: TODAY }),
    ];
    expect(nextReviews(entries, progress, TODAY)).toEqual({ day: addDays(TODAY, 1), count: 3 });
  });

  it("returns null when nothing is scheduled", () => {
    expect(nextReviews([e("a")], [], TODAY)).toBe(null);
  });
});
