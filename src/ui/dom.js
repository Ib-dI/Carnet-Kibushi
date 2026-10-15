export const COLORS = [["brique","Brique"],["canard","Canard"],["ocre","Ocre"],["prune","Prune"],["indigo","Indigo"],["olive","Olive"]];
export const EMOJIS = ["👋","🙏","❤️","😊","👪","👶","👵","🏠","🍲","🍚","🐟","🥭","☕","💧","🔥","🌙","☀️","🌧️","🌳","🐓","🛶","🧺","💰","🔢","❓","✅","⚠️","🎵","📌","💡"];
export const TYPES  = [["mot","Mot"],["phrase","Phrase"],["expression","Expression"],["conseil","Conseil"]];
export const SUGGESTIONS = [["Salutations","👋","brique"],["La famille","👪","canard"],["La cuisine","🍲","ocre"],["Les chiffres","🔢","indigo"],["Au marché","🧺","olive"],["Questions utiles","❓","prune"],
  ["La politesse","🙏","canard"],["La maison","🏠","prune"],["Le temps qu'il fait","🌧️","indigo"],["Les animaux","🐓","olive"],["Les sentiments","😊","brique"],["Le jour et la nuit","🌙","ocre"]];
export const colorVar = k => COLORS.some(c => c[0] === k) ? `var(--${k})` : "var(--canard)";
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// ▶ au repos, ⏸ pendant la lecture (classe « on » posée par lib/player.js).
export const PLAY_ICON = '<svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg><svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// Crée un élément à partir d'un fragment HTML (le contenu variable doit passer par esc()).
export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const pad = n => String(n).padStart(2, "0");
export const fmtDate = t => t ? new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
export const SAVE_ERROR = "L'enregistrement n'a pas marché. Vérifie ta connexion et réessaie.";
export const TOO_LARGE = { audio: "Vocal trop lourd (10 Mo max).", image: "Photo trop lourde (10 Mo max)." };

// Message à afficher pour un échec d'écriture du Carnet ({ ok: false, reason }).
export const errorText = (r, empty = SAVE_ERROR) =>
  r.reason === "too-large" ? TOO_LARGE[r.media] : r.reason === "empty" ? empty : SAVE_ERROR;

export const lessonLabel = l => (l.emoji ? l.emoji + " " : "") + l.title;

// Ce qui part avec une Leçon ou un mot, en français : « son mot et ses 2 blocs de texte ».
const PARTS = [["words", "mot", "mots"], ["blocks", "bloc de texte", "blocs de texte"], ["comments", "commentaire", "commentaires"], ["attempts", "essai", "essais"]];
export function alsoText(f) {
  const parts = PARTS.filter(([k]) => f[k]).map(([k, one, many]) => f[k] === 1 ? `son ${one}` : `ses ${f[k]} ${many}`);
  return parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}`;
}
