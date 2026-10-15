# 009 — Retournement des cartes de la Grille : 300 ms, et fondu en mode « moins d'animations »

- **Status**: DONE
- **Commit**: 2d032cf
- **Severity**: LOW
- **Category**: Cohesion / Easing & duration / Accessibility
- **Estimated scope**: 1 fichier (`src/styles/app.css`), 3 lignes

## Problem

1. Le tour complet d'une carte de la Grille dure 350 ms, au-dessus du plafond de 300 ms pour l'interface, alors que la Révision retourne sa carte en 260 ms :
   ```css
   /* src/styles/app.css:289 — current */
   .card-in{position:relative;height:100%;transition:transform 350ms var(--ease-in-out);transform-style:preserve-3d}
   ```
2. En mode « moins d'animations », la face change d'un coup, sans aucune transition :
   ```css
   /* src/styles/app.css:302 — current */
   @media (prefers-reduced-motion:reduce){ .card-in{transition:none} }
   ```
   La règle : moins de mouvement, pas zéro retour. Un fondu court garde la compréhension.

## Target

```css
.card-in{…;transition:transform 300ms var(--ease-in-out);…}
@media (prefers-reduced-motion:reduce){
  .card-in{transition:none}
  .card.flipped .card-in{transform:none}
  .face{transition:opacity 150ms ease}
  .face.back{transform:none;opacity:0}
  .card.flipped .face.front{opacity:0}
  .card.flipped .face.back{opacity:1}
}
```

(En mouvement réduit, plus de rotation : les deux faces sont superposées à plat et l'on fait un fondu entre elles. `inert` sur la face cachée, déjà géré par `src/ui/lessons.js`, empêche d'y toucher.)

## Repo conventions to follow

- Tokens dans `src/styles/tokens.css` (`--ease-in-out` existe).

## Steps

1. `src/styles/app.css:289` : dans `.card-in{…}`, remplacer `350ms` par `300ms`.
2. `src/styles/app.css:302` : remplacer la ligne `@media (prefers-reduced-motion:reduce){ .card-in{transition:none} }` par le bloc `@media` du Target.

## Boundaries

- Ne pas modifier `src/ui/lessons.js`.
- Ne pas toucher au mode normal autre que la durée.

## Verification

- **Mechanical** : `pnpm build` réussit.
- **Feel check** :
  - Grille, mode normal : la carte pivote un peu plus vite qu'avant, accélération et freinage symétriques ; deux touchers rapides : la rotation repart de sa position (pas de saut).
  - DevTools → Rendering → `prefers-reduced-motion: reduce` : toucher une carte → fondu de la réponse en ≈0,15 s, aucune rotation ; le verso est lisible (pas en miroir).
- **Done when** : 300 ms en normal, fondu sans miroir en mouvement réduit.
