// Affichage des blocs de texte libre d'une page de Leçon.
// Le texte est échappé d'abord, puis **gras** et *italique* sont mis en forme.
import { esc, colorVar } from "./dom.js";

export const BLOCK_TYPES = [
  ["text", "Texte"], ["title", "Titre"], ["list", "Liste"], ["numbered", "Liste numérotée"],
  ["quote", "Citation"], ["callout", "Encadré"], ["divider", "Séparateur"],
];

export const inline = s => esc(s)
  .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(\S(?:.*?\S)?)\*/g, "<em>$1</em>");

const lines = s => String(s || "").split("\n").map(l => l.trim()).filter(Boolean);
const items = s => lines(s).map(l => `<li><span>${inline(l)}</span></li>`).join("");   // <span> : une ligne = un seul bloc, même avec du gras

export function blockHTML(b) {
  switch (b.type) {
    case "title": return `<h3 class="b-title">${inline(b.body)}</h3>`;
    case "list": return `<ul class="b-list">${items(b.body)}</ul>`;
    case "numbered": return `<ol class="b-numbered">${items(b.body)}</ol>`;
    case "quote": return `<blockquote class="b-quote">${inline(b.body).replace(/\n/g, "<br>")}</blockquote>`;
    case "divider": return `<hr class="b-divider">`;
    case "callout":
      return `<div class="b-callout" style="--c:${colorVar(b.color)}">${b.title ? `<div class="b-callout-title">${inline(b.title)}</div>` : ""}<p>${inline(b.body).replace(/\n/g, "<br>")}</p></div>`;
    default: return `<p class="b-text">${inline(b.body).replace(/\n/g, "<br>")}</p>`;
  }
}
