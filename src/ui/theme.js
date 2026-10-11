// Thème : Auto (suit l'appareil), Clair ou Sombre. Mémorisé sur l'appareil (simple confort).
// Le choix est appliqué avant l'affichage par un petit script dans index.html.

const KEY = "carnet.theme";
export const THEMES = {
  auto: { label: "Thème auto", short: "Auto", icon: "◐" },
  light: { label: "Thème clair", short: "Clair", icon: "☀︎" },
  dark: { label: "Thème sombre", short: "Sombre", icon: "☾" },
};
const ORDER = Object.keys(THEMES);
const BAR = { light: "#FAF6EE", dark: "#17181D" };   // couleur de la barre du navigateur (voir tokens.css)

export const nextTheme = t => ORDER[(Math.max(0, ORDER.indexOf(t)) + 1) % ORDER.length];

export function currentTheme() {
  try { return THEMES[localStorage.getItem(KEY)] ? localStorage.getItem(KEY) : "auto"; } catch { return "auto"; }
}

export function applyTheme(t) {
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme"); else root.dataset.theme = t;
  // Barre du navigateur (mobile) : forcée sur le thème choisi, ou selon l'appareil en Auto.
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    const media = m.getAttribute("media") || "";
    m.content = t === "auto" ? BAR[media.includes("dark") ? "dark" : "light"] : BAR[t];
  });
  try { if (t === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch {}
}

export const themeButtonHTML = () => {
  const t = THEMES[currentTheme()];
  return `<button class="btn small ghost theme-btn" type="button" data-theme-toggle aria-label="${t.label} (changer)" title="${t.label}">${t.icon}<span>${t.short}</span></button>`;
};

export function bindTheme(root = document) {
  root.querySelectorAll("[data-theme-toggle]").forEach(b => b.onclick = () => {
    const t = nextTheme(currentTheme());
    applyTheme(t);
    const { label, short, icon } = THEMES[t];
    b.innerHTML = `${icon}<span>${short}</span>`;
    b.setAttribute("aria-label", `${label} (changer)`);
    b.title = label;
  });
}
