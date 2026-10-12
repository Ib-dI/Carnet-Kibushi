import { describe, it, expect } from "vitest";
import { inline, blockHTML } from "./rich.js";

describe("inline", () => {
  it("bold and italic", () => {
    expect(inline("**Pause.** Ne lis *pas* tout")).toBe("<strong>Pause.</strong> Ne lis <em>pas</em> tout");
  });

  it("escapes HTML before formatting", () => {
    expect(inline("<img src=x onerror=alert(1)> **a<b**")).toBe("&lt;img src=x onerror=alert(1)&gt; <strong>a&lt;b</strong>");
  });

  it("leaves lone stars alone", () => {
    expect(inline("2 * 3 = 6")).toBe("2 * 3 = 6");
  });
});

describe("blockHTML", () => {
  it("text keeps line breaks", () => {
    expect(blockHTML({ type: "text", body: "un\ndeux" })).toBe('<p class="b-text">un<br>deux</p>');
  });

  it("title", () => {
    expect(blockHTML({ type: "title", body: "Le *soir*" })).toBe('<h3 class="b-title">Le <em>soir</em></h3>');
  });

  it("lists: one item per non-empty line", () => {
    expect(blockHTML({ type: "list", body: "a\n\nb" })).toBe('<ul class="b-list"><li><span>a</span></li><li><span>b</span></li></ul>');
    expect(blockHTML({ type: "numbered", body: "**Pause.** Ne lis pas\nPrédis" })).toBe('<ol class="b-numbered"><li><span><strong>Pause.</strong> Ne lis pas</span></li><li><span>Prédis</span></li></ol>');
  });

  it("quote, divider", () => {
    expect(blockHTML({ type: "quote", body: "Prédire" })).toBe('<blockquote class="b-quote">Prédire</blockquote>');
    expect(blockHTML({ type: "divider" })).toBe('<hr class="b-divider">');
  });

  it("callout with title and a known color", () => {
    expect(blockHTML({ type: "callout", title: "À 100 %", body: "Prédis avec **logique**", color: "brique" }))
      .toBe('<div class="b-callout" style="--c:var(--brique)"><div class="b-callout-title">À 100 %</div><p>Prédis avec <strong>logique</strong></p></div>');
  });

  it("unknown colors fall back, unknown types render as text", () => {
    expect(blockHTML({ type: "callout", body: "x", color: "red;}" })).toContain("--c:var(--canard)");
    expect(blockHTML({ type: "???", body: "x" })).toBe('<p class="b-text">x</p>');
  });
});
