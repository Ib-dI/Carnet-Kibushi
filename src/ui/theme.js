// Thème : Auto (suit l'appareil), Clair ou Sombre. Mémorisé sur l'appareil (simple confort).
// Le choix est appliqué avant l'affichage par un petit script dans index.html.

const KEY = "carnet.theme";
// Icônes dessinées sur la même grille (20 × 20) : le bouton garde exactement la même taille.
const svg = d => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const THEMES = {
  auto: { label: "Thème auto", short: "Auto", icon: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>') },
  light: { label: "Thème clair", short: "Clair", icon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>') },
  dark: { label: "Thème sombre", short: "Sombre", icon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>') },
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
  return `<button class="theme-btn" type="button" data-theme-toggle aria-label="${t.label} (changer)" title="${t.label}">${t.icon}</button>`;
};

export function bindTheme(root = document) {
  root.querySelectorAll("[data-theme-toggle]").forEach(b => b.onclick = () => {
    const t = nextTheme(currentTheme());
    applyTheme(t);
    const { label, icon } = THEMES[t];
    b.innerHTML = icon;
    b.setAttribute("aria-label", `${label} (changer)`);
    b.title = label;
  });
}
