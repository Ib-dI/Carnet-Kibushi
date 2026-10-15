# 005 — Survol des tuiles réservé à la souris, appui du « + » plus discret, courbes en tokens

- **Status**: DONE
- **Commit**: 9211687
- **Severity**: LOW
- **Category**: Accessibility / Cohesion & tokens / Easing & duration
- **Estimated scope**: 2 fichiers (`src/styles/app.css`, `src/styles/tokens.css`), ~8 lignes

## Problem

1. Le soulèvement des tuiles n'est pas limité aux appareils à survol ; sur téléphone, une tuile touchée reste soulevée (faux survol) :
   ```css
   /* src/styles/app.css:256-257 — current */
   .tile{…;transition:transform .15s ease,box-shadow .15s ease}
   .tile:hover,.tile:focus-visible{transform:translateY(-2px);box-shadow:0 8px 22px rgb(0 0 0 / .12)}
   ```
2. Le « + » flottant s'enfonce trop et avec une courbe faible :
   ```css
   /* src/styles/app.css:78-79 — current */
   .fab{…;transition:transform .15s ease}
   .fab:active{transform:scale(.92)}
   ```
3. Le retournement des cartes de la Grille utilise une courbe tapée à la main et dure 450 ms, long pour un geste répété :
   ```css
   /* src/styles/app.css:282 — current */
   .card-in{position:relative;height:100%;transition:transform .45s cubic-bezier(.3,.7,.3,1);transform-style:preserve-3d}
   ```
4. Aucune courbe partagée dans `src/styles/tokens.css`.

## Target

```css
/* tokens.css, premier :root, après --r:10px; */
--ease-out:cubic-bezier(0.23,1,0.32,1);
--ease-in-out:cubic-bezier(0.77,0,0.175,1);

/* app.css */
.tile:focus-visible{transform:translateY(-2px);box-shadow:0 8px 22px rgb(0 0 0 / .12)}
@media (hover:hover) and (pointer:fine){ .tile:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgb(0 0 0 / .12)} }
.fab{…;transition:transform 160ms var(--ease-out)}
.fab:active{transform:scale(.95)}
.card-in{…;transition:transform 350ms var(--ease-in-out);…}
```

(`.tile` garde `transition:transform .15s ease,box-shadow .15s ease` : survol = `ease`, correct.)

## Repo conventions to follow

- Règles CSS sur une ligne, commentaires en français.
- Si `--ease-out` existe déjà (plans 001/003/004 exécutés avant), ne pas le dupliquer.

## Steps

1. `src/styles/tokens.css` : ajouter `--ease-out` (si absent) et `--ease-in-out` après `--r:10px;`.
2. `src/styles/app.css:257` : remplacer `.tile:hover,.tile:focus-visible{…}` par les deux lignes `.tile:focus-visible{…}` et `@media (hover:hover) and (pointer:fine){ .tile:hover{…} }` du Target (mêmes valeurs).
3. `src/styles/app.css:78` : dans `.fab{…}`, remplacer `transition:transform .15s ease` par `transition:transform 160ms var(--ease-out)`.
4. `src/styles/app.css:79` : `.fab:active{transform:scale(.95)}`.
5. `src/styles/app.css:282` : dans `.card-in{…}`, remplacer `transition:transform .45s cubic-bezier(.3,.7,.3,1)` par `transition:transform 350ms var(--ease-in-out)`.
6. Laisser la ligne `@media (prefers-reduced-motion:reduce){ .tile{transition:none} .tile:hover{transform:none} }` telle quelle.

## Boundaries

- Ne rien changer d'autre dans `.tile`, `.fab`, `.card-in`.
- Pas de JS.

## Verification

- **Mechanical** : `pnpm build` réussit ; `grep -n "cubic-bezier(.3,.7" src/styles/app.css` ne renvoie rien.
- **Feel check** :
  - Ordinateur : survoler une tuile du sommaire → elle se soulève de 2 px. Tab au clavier → idem.
  - Téléphone : toucher une tuile puis revenir : aucune tuile ne reste soulevée.
  - Appui sur « + » : s'enfonce légèrement (95 %), revient net.
  - Grille : toucher une carte → elle pivote en ≈0,35 s, accélère puis ralentit symétriquement ; enchaîner deux touchers rapides : la rotation repart de sa position actuelle (transition, pas de saut).
- **Done when** : les quatre points du Problem sont corrigés.
