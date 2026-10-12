import { describe, it, expect } from "vitest";
import { parseRoute, routeHash } from "./route.js";

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
