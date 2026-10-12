import { describe, it, expect } from "vitest";
import { parseRoute, routeHash, tabOf } from "./route.js";

describe("route", () => {
  it("reads the sommaire and a Leçon page", () => {
    expect(parseRoute("")).toEqual({ view: "home" });
    expect(parseRoute("#/")).toEqual({ view: "home" });
    expect(parseRoute("#/lecon/abc-123")).toEqual({ view: "lesson", id: "abc-123" });
  });

  it("can point at a block in the page", () => {
    expect(parseRoute("#/lecon/abc/b-1")).toEqual({ view: "lesson", id: "abc", at: "b-1" });
    expect(routeHash({ view: "lesson", id: "abc", at: "b 1" })).toBe("#/lecon/abc/b%201");
  });

  it("reads the Révision (all Leçons or one) and Progrès screens", () => {
    expect(parseRoute("#/reviser")).toEqual({ view: "review" });
    expect(parseRoute("#/reviser/abc")).toEqual({ view: "review", lesson: "abc" });
    expect(parseRoute("#/progres")).toEqual({ view: "progress" });
    expect(routeHash({ view: "review" })).toBe("#/reviser");
    expect(routeHash({ view: "review", lesson: "a b" })).toBe("#/reviser/a%20b");
    expect(routeHash({ view: "progress" })).toBe("#/progres");
  });

  it("names the tab each view belongs to", () => {
    expect(tabOf({ view: "home" })).toBe("lessons");
    expect(tabOf({ view: "lesson", id: "x" })).toBe("lessons");
    expect(tabOf({ view: "review" })).toBe("review");
    expect(tabOf({ view: "progress" })).toBe("progress");
  });

  it("falls back to the sommaire for anything else", () => {
    expect(parseRoute("#/nimporte")).toEqual({ view: "home" });
    expect(parseRoute("#/lecon/")).toEqual({ view: "home" });
  });

  it("builds hashes that read back the same", () => {
    expect(routeHash({ view: "lesson", id: "x y" })).toBe("#/lecon/x%20y");
    expect(parseRoute(routeHash({ view: "lesson", id: "x y" }))).toEqual({ view: "lesson", id: "x y" });
    expect(routeHash({ view: "home" })).toBe("#/");
  });
});
