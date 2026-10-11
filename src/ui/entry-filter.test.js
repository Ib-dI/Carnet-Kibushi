import { describe, it, expect } from "vitest";
import { entryFilter, isFiltering } from "./entry-filter.js";

const e = (extra = {}) => ({ type: "mot", word: "mbote", pron: "m-bo-té", translation: "bonjour", note: "le matin", audio_path: "audio/a.webm", ...extra });

describe("entryFilter", () => {
  it("keeps everything with no filter", () => {
    expect(entryFilter({})(e())).toBe(true);
    expect(isFiltering({})).toBe(false);
  });

  it("searches word, Prononciation, Traduction and note, ignoring case", () => {
    expect(entryFilter({ query: "BONJ" })(e())).toBe(true);
    expect(entryFilter({ query: "bo-té" })(e())).toBe(true);
    expect(entryFilter({ query: "matin" })(e())).toBe(true);
    expect(entryFilter({ query: "soir" })(e())).toBe(false);
  });

  it("filters by Type d'entrée", () => {
    expect(entryFilter({ type: "phrase" })(e())).toBe(false);
    expect(entryFilter({ type: "mot" })(e())).toBe(true);
  });

  it("« sans Vocal » keeps only Entrées without a Vocal", () => {
    expect(entryFilter({ noAudio: true })(e())).toBe(false);
    expect(entryFilter({ noAudio: true })(e({ audio_path: null }))).toBe(true);
  });

  it("combines filters", () => {
    const f = entryFilter({ query: "bonjour", type: "mot", noAudio: true });
    expect(f(e({ audio_path: null }))).toBe(true);
    expect(f(e())).toBe(false);
    expect(isFiltering({ noAudio: true })).toBe(true);
  });
});
