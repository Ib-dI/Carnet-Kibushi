# 008 — Célébrer la fin d'une Révision

- **Status**: DONE
- **Commit**: 2d032cf
- **Severity**: MEDIUM (opportunité manquée, moment rare et gratifiant)
- **Category**: Missed opportunities
- **Estimated scope**: 2 fichiers (`src/ui/review.js`, `src/styles/app.css`), ~25 lignes

## Problem

La fin d'une Révision affiche le score sans aucun effet :

```js
/* src/ui/review.js:94-98 (environ) — current, branche `else if (st.done)` de draw() */
r.innerHTML = topHTML(st) + note + `<div class="card-face"><div class="big">${st.score} / ${st.total}</div><div class="q">cartes que tu savais déjà${st.mode === "jour" ? " · à demain !" : ""}</div></div>${warn}
  <div class="rev-bar">${again}<a class="btn" href="${routeHash({ view: "progress" })}">Voir mes progrès</a></div>${other}`;
```

C'est un moment rare (une ou deux fois par jour) : il a droit à un peu de plaisir. La série de jours (`streak`) est calculée seulement dans l'écran Progrès (`src/ui/progress.js:15-17`) :

```js
const { entries, progress, lessons, review_days } = carnet.state;
const days = streak(review_days.map(d => d.day), today);
```

## Target

1. **Série** : en Révision du jour, sous le score, une ligne `🔥 N jours d'affilée` (N ≥ 2) ou `🔥 Premier jour de ta série` (N = 1). Rien en Révision libre.
2. **Apparition** : la première fois que l'écran de fin s'affiche (et seulement cette fois, pas à chaque redessin), animer avec la Web Animations API :
   - le bloc `.card-face` : `[{ transform: "scale(0.9)", opacity: 0 }, { transform: "none", opacity: 1 }]`, `duration: 300`, `easing: "cubic-bezier(0.23, 1, 0.32, 1)"` ;
   - la ligne de série `.rev-streak` : mêmes images clés `[{ transform: "translateY(6px)", opacity: 0 }, { transform: "none", opacity: 1 }]`, `duration: 300`, `delay: 120`, `easing: "cubic-bezier(0.23, 1, 0.32, 1)"`, `fill: "backwards"`.
   - S'applique aussi quand la dernière réponse est donnée au clavier (moment rare, pas une action répétée).
3. **prefers-reduced-motion: reduce** : `[{ opacity: 0 }, { opacity: 1 }]`, `duration: 200`, `easing: "ease"` sur `.card-face`, pas de délai ni de mouvement.

```css
/* src/styles/app.css, après .count{…} */
.rev-streak{font-weight:800;color:var(--brique)}
```

## Repo conventions to follow

- Exemple d'animation WAAPI dans ce même fichier : fonction `animateCard(kind)` dans `src/ui/review.js` (constante `EASE_OUT`, test `matchMedia("(prefers-reduced-motion: reduce)")`). Réutiliser `EASE_OUT`.
- Date du jour : `localToday()` est déjà importé dans `src/ui/review.js` depuis `../revision/schedule.js`.
- `streak` s'importe depuis `../revision/stats.js`.

## Steps

1. `src/ui/review.js` : ajouter `import { streak } from "../revision/stats.js";` avec les autres imports.
2. Sous `animateCard`, ajouter :
   ```js
   // Fin de Révision : le score apparaît, puis la série (une seule fois par écran de fin).
   let doneShown = false;
   function celebrate() {
     const face = $("#rev .card-face"), line = $("#rev .rev-streak");
     if (!face?.animate) return;
     if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
       face.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease" });
       return;
     }
     face.animate([{ transform: "scale(0.9)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: EASE_OUT });
     line?.animate([{ transform: "translateY(6px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, delay: 120, easing: EASE_OUT, fill: "backwards" });
   }
   ```
3. Dans `draw()`, branche `else if (st.done)` : calculer la série et l'ajouter dans `.card-face`, après la ligne `.q` :
   ```js
   const n = st.mode === "jour" ? streak(carnet.state.review_days.map(d => d.day), localToday()) : 0;
   const series = n ? `<div class="rev-streak">🔥 ${n > 1 ? `${n} jours d'affilée` : "Premier jour de ta série"}</div>` : "";
   ```
   et insérer `${series}` juste avant le `</div>` qui ferme `.card-face`.
4. À la fin de cette même branche (après l'`innerHTML`), ajouter : `if (!doneShown) { doneShown = true; celebrate(); }`.
5. Dans les deux autres branches de `draw()` (`if (st.empty)` et le `else` final), ajouter au début : `doneShown = false;`.
6. `src/styles/app.css` : ajouter `.rev-streak{font-weight:800;color:var(--brique)}` après la ligne `.count{…}`.

## Boundaries

- Ne pas modifier `src/revision/*` ni `src/ui/progress.js`.
- Pas de confettis, pas de son, pas de nouvelle dépendance.
- Si `carnet.state.review_days` n'existe pas ou si le jour n'y est pas encore au moment de l'écran de fin (série affichée trop basse d'un jour), STOP et signaler plutôt que de modifier la logique.

## Verification

- **Mechanical** : `pnpm vitest run` → tous verts ; `pnpm build` réussit.
- **Feel check** :
  - Finir une Révision du jour : le score grossit légèrement (90 % → 100 %) en apparaissant, puis la ligne 🔥 monte de 6 px un court instant après. Total < ½ s.
  - Le nombre de jours est le même que celui de l'écran Progrès.
  - Révision libre : pas de ligne 🔥, le score apparaît quand même.
  - Une mise à jour en temps réel pendant l'écran de fin ne rejoue pas l'animation.
  - DevTools Animations à 10 % : pas de rebond ; mode « moins d'animations » : simple fondu.
- **Done when** : l'écran de fin apparaît avec son petit effet, une seule fois, avec la série correcte.
