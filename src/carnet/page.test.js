import { describe, it, expect } from "vitest";
import { pageItems, positionBetween, positionAt, positionOf } from "./page.js";

const entry = (id, extra = {}) => ({ id, lesson_id: "L", created_at: `2026-10-0${id.length}T10:00:00Z`, ...extra });
const block = (id, position, extra = {}) => ({ id, lesson_id: "L", type: "text", body: id, position, ...extra });

describe("pageItems", () => {
  it("mixes blocks and Entrées of one Leçon by position", () => {
    const state = {
      entries: [entry("e1", { position: 2 }), entry("e2", { position: 4 }), entry("x", { lesson_id: "M", position: 3 })],
      blocks: [block("b1", 1), block("b2", 3), block("other", 0, { lesson_id: "M" })],
    };
    expect(pageItems(state, "L").map(i => `${i.kind}:${i.item.id}`)).toEqual(["block:b1", "entry:e1", "block:b2", "entry:e2"]);
  });

  it("Entrées without a position follow their creation date, after positioned items", () => {
    const state = {
      entries: [entry("late", { created_at: "2026-10-05T00:00:00Z" }), entry("early", { created_at: "2026-10-01T00:00:00Z" })],
      blocks: [block("b", 1)],
    };
    expect(pageItems(state, "L").map(i => i.item.id)).toEqual(["b", "early", "late"]);
  });
});

describe("positions", () => {
  it("between two items, before the first, after the last, or alone", () => {
    expect(positionBetween(2, 4)).toBe(3);
    expect(positionBetween(null, 4)).toBe(3);
    expect(positionBetween(2, null)).toBe(3);
    expect(positionBetween(null, null)).toBe(1);
  });

  it("positionAt(items, i) inserts before the i-th item (i = length appends)", () => {
    const items = [{ position: 10 }, { position: 20 }];
    expect(positionAt(items, 0)).toBe(9);
    expect(positionAt(items, 1)).toBe(15);
    expect(positionAt(items, 2)).toBe(21);
    expect(positionAt([], 0)).toBe(1);
  });

  it("an Entrée without position gets one from its rank", () => {
    const state = { entries: [entry("a"), entry("bb")], blocks: [] };
    const items = pageItems(state, "L");
    expect(items.map(positionOf)).toEqual([1, 2]);
  });
});
