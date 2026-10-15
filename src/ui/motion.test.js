import { describe, it, expect } from "vitest";
import { createMotion } from "./motion.js";

// Un faux navigateur : View Transitions (ou pas), préférence « moins d'animations », journal des étapes.
function fakeBrowser({ viewTransitions = true, reduced = false, fails = false } = {}) {
  const log = [], root = { dataset: {} };
  const doc = { documentElement: root };
  if (viewTransitions) doc.startViewTransition = update => {
    log.push(`start motion=${root.dataset.motion ?? "-"}`);
    update();
    return { finished: fails ? Promise.reject(new Error("abandon")) : Promise.resolve() };
  };
  const media = q => ({ matches: q.includes("reduced-motion") && reduced });
  return { doc, media, log, root };
}
const el = id => ({ id, style: { viewTransitionName: "" } });

describe("motion.transition", () => {
  it("does the update directly, once, when the device asks for less motion or has no View Transitions", async () => {
    for (const opts of [{ reduced: true }, { viewTransitions: false }]) {
      const b = fakeBrowser(opts), tile = el("tile");
      let updates = 0;
      await createMotion(b).transition(() => updates++, { type: "lesson-open", names: () => [["hero", tile]] });
      expect(updates).toBe(1);
      expect(b.log).toEqual([]);
      expect(tile.style.viewTransitionName).toBe("");
      expect(b.root.dataset.motion).toBeUndefined();
    }
  });

  it("names the old element, hands the name over to the new one during the update, and clears everything at the end", async () => {
    const b = fakeBrowser(), tile = el("tile"), head = el("head");
    const seen = [];
    const done = createMotion(b).transition(
      () => seen.push(`update tile=${tile.style.viewTransitionName || "-"}`),
      { names: phase => [["hero", phase === "before" ? tile : head]] });
    expect(seen).toEqual(["update tile=-"]);          // le nom a quitté l'ancien élément avant la mise à jour
    expect(head.style.viewTransitionName).toBe("hero"); // et rejoint le nouveau pendant la transition
    await done;
    expect([tile.style.viewTransitionName, head.style.viewTransitionName]).toEqual(["", ""]);
  });

  it("puts the type on the page during the transition only, even when the transition fails", async () => {
    for (const fails of [false, true]) {
      const b = fakeBrowser({ fails }), item = el("mot");
      await createMotion(b).transition(() => {}, { type: "tab-next", names: () => [["e-1", item]] });
      expect(b.log).toEqual(["start motion=tab-next"]);
      expect(b.root.dataset.motion).toBeUndefined();
      expect(item.style.viewTransitionName).toBe("");
    }
  });

  it("skips missing elements", async () => {
    const b = fakeBrowser();
    let updated = false;
    await createMotion(b).transition(() => { updated = true; }, { names: () => [["hero", null]] });
    expect(updated).toBe(true);
  });
});
