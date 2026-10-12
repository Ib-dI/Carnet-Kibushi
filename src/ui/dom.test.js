import { describe, it, expect } from "vitest";
import { alsoText } from "./dom.js";

describe("alsoText (ce qui part avec, en français)", () => {
  it("singular and plural, joined with « et »", () => {
    expect(alsoText({ words: 1, blocks: 2 })).toBe("son mot et ses 2 blocs de texte");
    expect(alsoText({ comments: 3, attempts: 1 })).toBe("ses 3 commentaires et son essai");
    expect(alsoText({ words: 2, blocks: 1, comments: 1 })).toBe("ses 2 mots, son bloc de texte et son commentaire");
  });

  it("nothing goes with it", () => {
    expect(alsoText({ words: 0, blocks: 0 })).toBe("");
  });
});
