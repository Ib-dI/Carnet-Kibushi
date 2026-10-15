# 001 — Animer le retournement de la carte et l'arrivée de la carte suivante en Révision

- **Status**: DONE
- **Commit**: 9211687
- **Severity**: HIGH (opportunité manquée sur le moment central de l'app)
- **Category**: Missed opportunities / Purpose & frequency
- **Estimated scope**: 2 fichiers (`src/ui/review.js`, `src/styles/tokens.css`), ~30 lignes

## Problem

En Révision, la réponse apparaît d'un coup : `draw()` réécrit tout `#rev` avec `innerHTML`, donc aucune transition CSS ne peut jouer. Le geste « Retourner la carte » — le moment ludique de l'app — téléporte.

```js
/* src/ui/review.js:86-89 — current */
r.innerHTML = topHTML(st) + note + cardHTML(st) + warn + `<div class="rev-bar">${st.flipped
    ? `<button class="btn" type="button" id="rNo">À revoir</button>…`
    : `<button class="btn solid" type="button" id="rFlip">Retourner la carte</button>`}</div>${other}`;
```

```js
/* src/ui/review.js:98-102 — current */
const act = fn => () => { fn(); draw(); };
$("#rFlip")?.addEventListener("click", act(() => screen.flip()));
$("#rYes")?.addEventListener("click", act(() => screen.answer("knew")));
$("#rNo")?.addEventListener("click", act(() => screen.answer("again")));
$("#rEasy")?.addEventListener("click", act(() => screen.answer("easy")));
```

Les raccourcis clavier (`src/ui/review.js:111-118`, Espace / ← / → / ↑) appellent aussi `draw()`. Ce sont des actions clavier très fréquentes : elles **ne doivent pas** animer.

## Target

Après `draw()`, animer le nouvel élément `.card-face` avec la Web Animations API (pas de keyframes CSS : `draw()` recrée le nœud, l'animation est jouée une fois sur le nœud neuf).

- **Retourner** (clic/toucher sur « Retourner la carte ») : la face réponse pivote depuis la tranche.
  `[{ transform: "perspective(900px) rotateY(-90deg)", opacity: 0.4 }, { transform: "none", opacity: 1 }]`, `duration: 260`, `easing: "cubic-bezier(0.23, 1, 0.32, 1)"`.
- **Carte suivante** (clic/toucher sur À revoir / Je savais / Par cœur, quand une nouvelle carte s'affiche, pas l'écran de fin) : glisse légèrement depuis la droite.
  `[{ transform: "translateX(16px)", opacity: 0 }, { transform: "none", opacity: 1 }]`, `duration: 200`, `easing: "cubic-bezier(0.23, 1, 0.32, 1)"`.
- **Clavier** : aucune animation.
- **prefers-reduced-motion: reduce** : pas de mouvement ; seulement `[{ opacity: 0.4 }, { opacity: 1 }]`, `duration: 150`, `easing: "ease"`.

## Repo conventions to follow

- Modules UI en JS vanilla, helpers `$`/`$$` de `src/ui/dom.js`.
- Exemple existant de respect de `prefers-reduced-motion` en JS : `src/ui/lessons.js` fonction `showAndFlash` (`matchMedia("(prefers-reduced-motion: reduce)").matches`).
- Ajouter la courbe en token dans `src/styles/tokens.css`, dans le bloc `:root{…}` du haut, si elle n'y est pas déjà (le plan 005 l'ajoute aussi) : `--ease-out:cubic-bezier(0.23,1,0.32,1);`. En JS, on écrit la valeur littérale (WAAPI ne lit pas les variables CSS).

## Steps

1. Dans `src/ui/review.js`, au-dessus de `function draw()`, ajouter :
   ```js
   // Mouvement de la carte après un clic ou un toucher (jamais au clavier) : elle se retourne, ou la suivante arrive.
   const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
   function animateCard(kind) {
     const face = $("#rev .card-face");
     if (!face || !face.animate) return;
     if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
       face.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150, easing: "ease" });
       return;
     }
     const frames = kind === "flip"
       ? [{ transform: "perspective(900px) rotateY(-90deg)", opacity: 0.4 }, { transform: "none", opacity: 1 }]
       : [{ transform: "translateX(16px)", opacity: 0 }, { transform: "none", opacity: 1 }];
     face.animate(frames, { duration: kind === "flip" ? 260 : 200, easing: EASE_OUT });
   }
   ```
2. Dans `draw()`, remplacer les quatre lignes `$("#rFlip")…`, `$("#rYes")…`, `$("#rNo")…`, `$("#rEasy")…` par :
   ```js
   const card = (fn, kind) => () => { fn(); draw(); if (kind === "flip" || (screen.state.card && !screen.state.done)) animateCard(kind); };
   $("#rFlip")?.addEventListener("click", card(() => screen.flip(), "flip"));
   $("#rYes")?.addEventListener("click", card(() => screen.answer("knew"), "next"));
   $("#rNo")?.addEventListener("click", card(() => screen.answer("again"), "next"));
   $("#rEasy")?.addEventListener("click", card(() => screen.answer("easy"), "next"));
   ```
   Laisser `act` tel quel pour les autres boutons (`rAgain`, `data-mode`, `data-size`, `data-dir`).
3. Ne pas toucher `onKey` : le clavier reste instantané.
4. Dans `src/styles/tokens.css`, ajouter `--ease-out:cubic-bezier(0.23,1,0.32,1);` dans le premier bloc `:root{…}` (après `--r:10px;`) s'il n'existe pas.

## Boundaries

- Ne pas modifier `src/revision/*` (logique de Révision) ni le HTML produit par `cardHTML`.
- Pas de keyframes CSS, pas de nouvelle dépendance.
- Si le code ne correspond pas aux extraits ci-dessus, STOP et signaler.

## Verification

- **Mechanical** : `pnpm vitest run` → 186 tests verts ; `pnpm build` réussit.
- **Feel check** (onglet Réviser, avec au moins 3 cartes) :
  - Toucher « Retourner la carte » : la réponse pivote depuis la tranche, rapide (≈¼ s), pas de flash blanc.
  - Toucher « Je savais » : la carte suivante glisse de 16 px depuis la droite ; l'écran de fin (score) n'anime pas.
  - Espace / ← / → : aucun mouvement.
  - DevTools → Animations à 10 % : la rotation finit sans rebond ; la mise au point (`focus`) sur « Je savais » ne fait pas défiler la page.
  - Rendering → `prefers-reduced-motion: reduce` : simple fondu, aucune rotation ni glissement.
- **Done when** : les trois cas (retourner, suivante, clavier) se comportent comme ci-dessus sur téléphone et ordinateur.
