import { describe, it, expect } from "vitest";
import { streak, recentDays, upcoming, mastery, lessonStatus } from "./stats.js";

const TODAY = "2026-10-11";
const e = (id, lesson_id, extra = {}) => ({ id, type: "mot", word: `w${id}`, translation: `t${id}`, lesson_id, ...extra });
const p = (entry_id, direction, box, due = TODAY) => ({ entry_id, direction, box, due, lapses: 0 });

describe("streak", () => {
  it("counts consecutive days ending today", () => {
    expect(streak(["2026-10-09", "2026-10-10", "2026-10-11"], TODAY)).toBe(3);
  });

  it("still counts if today's Révision is not done yet", () => {
    expect(streak(["2026-10-09", "2026-10-10"], TODAY)).toBe(2);
  });

  it("breaks on a missed day", () => {
    expect(streak(["2026-10-07", "2026-10-09", "2026-10-11"], TODAY)).toBe(1);
    expect(streak(["2026-10-08"], TODAY)).toBe(0);
    expect(streak([], TODAY)).toBe(0);
  });
});

describe("recentDays", () => {
  it("the last days up to today, oldest first, with what was done", () => {
    expect(recentDays(["2026-10-09", "2026-10-11"], TODAY, 3)).toEqual([
      { day: "2026-10-09", done: true, today: false },
      { day: "2026-10-10", done: false, today: false },
      { day: "2026-10-11", done: true, today: true },
    ]);
  });
});

describe("upcoming", () => {
  it("counts items due each of the next days, overdue ones counted today", () => {
    const entries = [e("a", "L"), e("b", "L")];
    const progress = [p("a", "fr", 1, "2026-10-01"), p("a", "lg", 2, "2026-10-12"), p("b", "fr", 2, "2026-10-12"), p("b", "lg", 3, "2026-10-20")];
    expect(upcoming(entries, progress, TODAY, 3)).toEqual([
      { day: "2026-10-11", count: 1, fresh: 0 }, { day: "2026-10-12", count: 2, fresh: 0 }, { day: "2026-10-13", count: 0, fresh: 0 },
    ]);
  });

  it("today is the Révision du jour: new Cartes count too, like the Réviser badge", () => {
    const entries = [e("a", "L"), e("n", "L")];
    const progress = [p("a", "fr", 1, TODAY), p("a", "lg", 2, "2026-10-12")];
    expect(upcoming(entries, progress, TODAY, 2)).toEqual([
      { day: TODAY, count: 3, fresh: 2 }, { day: "2026-10-12", count: 1, fresh: 0 },
    ]);
  });
});

describe("mastery", () => {
  it("per Leçon: share of Carte × Sens items in Boîte 3 or more", () => {
    const lessons = [{ id: "L", title: "Salutations" }, { id: "M", title: "Vide" }];
    const entries = [e("a", "L", { audio_path: "x" }), e("b", "L"), e("c", "L", { type: "conseil" })];
    const progress = [p("a", "fr", 3), p("a", "lg", 5), p("a", "ec", 2), p("b", "fr", 4)];
    expect(mastery(lessons, entries, progress)).toEqual([
      { lesson: lessons[0], items: 5, mastered: 3, learning: 1, fresh: 1, percent: 60 },
      { lesson: lessons[1], items: 0, mastered: 0, learning: 0, fresh: 0, percent: 0 },
    ]);
  });
});

describe("lessonStatus", () => {
  it("words, Cartes and what is to review now in one Leçon", () => {
    const entries = [e("a", "L"), e("b", "L"), e("c", "L", { type: "conseil" }), e("x", "M")];
    const progress = [p("a", "fr", 2, "2026-10-20"), p("a", "lg", 2, "2026-10-20")];
    expect(lessonStatus(entries, progress, "L", TODAY)).toEqual({ words: 3, cards: 2, toReview: 2 });
    expect(lessonStatus(entries, progress, "vide", TODAY)).toEqual({ words: 0, cards: 0, toReview: 0 });
  });
});
