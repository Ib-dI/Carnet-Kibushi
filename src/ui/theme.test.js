import { describe, it, expect } from "vitest";
import { nextTheme, THEMES } from "./theme.js";

describe("nextTheme", () => {
  it("cycles Auto → Clair → Sombre → Auto", () => {
    expect(nextTheme("auto")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("auto");
  });

  it("falls back to Auto's successor for an unknown value", () => {
    expect(nextTheme("bleu")).toBe("light");
  });

  it("labels every theme", () => {
    expect(Object.keys(THEMES)).toEqual(["auto", "light", "dark"]);
  });
});
