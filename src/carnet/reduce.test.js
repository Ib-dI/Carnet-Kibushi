import { describe, it, expect } from "vitest";
import { reduce, emptyState } from "./reduce.js";

const lesson = (id, position, created_at = "2026-01-01") => ({ id, title: id, position, created_at });
const entry = (id, lesson_id) => ({ id, lesson_id, word: id });

describe("reduce", () => {
  it("keeps Leçons sorted by position, then creation date", () => {
    let s = emptyState();
    s = reduce(s, { table: "lessons", type: "INSERT", row: lesson("b", 2) });
    s = reduce(s, { table: "lessons", type: "INSERT", row: lesson("a", 1) });
    s = reduce(s, { table: "lessons", type: "INSERT", row: lesson("c", 2, "2025-12-31") });
    expect(s.lessons.map(l => l.id)).toEqual(["a", "c", "b"]);
  });

  it("deleting a Leçon drops its Entrées", () => {
    let s = { ...emptyState(), lessons: [lesson("a", 1), lesson("b", 2)], entries: [entry("x", "a"), entry("y", "b")] };
    s = reduce(s, { table: "lessons", type: "DELETE", row: { id: "a" } });
    expect(s.lessons.map(l => l.id)).toEqual(["b"]);
    expect(s.entries.map(e => e.id)).toEqual(["y"]);
  });

  it("an INSERT for a row already present replaces it (local write, then realtime echo)", () => {
    let s = emptyState();
    s = reduce(s, { table: "entries", type: "INSERT", row: entry("x", "a") });
    s = reduce(s, { table: "entries", type: "INSERT", row: { ...entry("x", "a"), word: "mbote" } });
    expect(s.entries).toEqual([{ id: "x", lesson_id: "a", word: "mbote" }]);
  });

  it("an UPDATE for an unknown row adds it", () => {
    const s = reduce(emptyState(), { table: "entries", type: "UPDATE", row: entry("x", "a") });
    expect(s.entries).toHaveLength(1);
  });

  it("a DELETE for an unknown row changes nothing", () => {
    const s0 = { ...emptyState(), entries: [entry("x", "a")] };
    expect(reduce(s0, { table: "entries", type: "DELETE", row: { id: "zz" } }).entries).toEqual(s0.entries);
  });

  it("replaces the Carnet row, and ignores a Carnet DELETE", () => {
    let s = reduce(emptyState(), { table: "carnet", type: "UPDATE", row: { id: 1, langue: "kibushi" } });
    expect(s.carnet.langue).toBe("kibushi");
    s = reduce(s, { table: "carnet", type: "DELETE", row: { id: 1 } });
    expect(s.carnet.langue).toBe("kibushi");
  });

  it("does not mutate the previous state", () => {
    const s0 = { ...emptyState(), entries: [entry("x", "a")] };
    const frozen = JSON.stringify(s0);
    reduce(s0, { table: "entries", type: "UPDATE", row: { ...entry("x", "a"), word: "autre" } });
    expect(JSON.stringify(s0)).toBe(frozen);
  });

  it("ignores unknown tables", () => {
    const s0 = emptyState();
    expect(reduce(s0, { table: "members", type: "INSERT", row: { email: "a" } })).toBe(s0);
  });
});
