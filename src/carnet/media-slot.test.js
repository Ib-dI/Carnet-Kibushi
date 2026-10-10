import { describe, it, expect } from "vitest";
import { createMediaSlot } from "./media-slot.js";
import { MAX_MEDIA_BYTES } from "./carnet.js";

const blob = (size = 4) => new Blob([new Uint8Array(size)]);

describe("createMediaSlot", () => {
  it("an empty slot shows nothing and keeps nothing", () => {
    const s = createMediaSlot(null);
    expect(s.shown).toBe(null);
    expect(s.change).toEqual({ keep: true });
  });

  it("an existing Média is shown and kept", () => {
    const s = createMediaSlot("audio/a.webm");
    expect(s.shown).toEqual({ path: "audio/a.webm" });
    expect(s.change).toEqual({ keep: true });
  });

  it("replacing shows the new file and asks to replace", () => {
    const s = createMediaSlot("audio/a.webm"), b = blob();
    expect(s.replace(b)).toEqual({ ok: true });
    expect(s.shown).toEqual({ blob: b });
    expect(s.change).toEqual({ replace: b });
  });

  it("clearing an existing Média asks to remove it", () => {
    const s = createMediaSlot("audio/a.webm");
    s.clear();
    expect(s.shown).toBe(null);
    expect(s.change).toEqual({ remove: true });
  });

  it("clearing a new file does not bring back the old one", () => {
    const s = createMediaSlot("audio/a.webm");
    s.replace(blob());
    s.clear();
    expect(s.shown).toBe(null);
    expect(s.change).toEqual({ remove: true });
  });

  it("clearing a new file on an empty slot keeps nothing", () => {
    const s = createMediaSlot(null);
    s.replace(blob());
    s.clear();
    expect(s.change).toEqual({ keep: true });
  });

  it("refuses a file over the slot's limit and keeps the current state", () => {
    const s = createMediaSlot("audio/a.webm", { maxBytes: MAX_MEDIA_BYTES });
    expect(s.replace(blob(MAX_MEDIA_BYTES + 1))).toEqual({ ok: false, reason: "too-large" });
    expect(s.shown).toEqual({ path: "audio/a.webm" });
  });

  it("has no limit by default (photos are resized before saving)", () => {
    const s = createMediaSlot(null);
    expect(s.replace(blob(MAX_MEDIA_BYTES + 1)).ok).toBe(true);
  });
});
