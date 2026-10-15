# 002 — Ne plus rejouer l'animation d'entrée sur les résultats de recherche

- **Status**: DONE
- **Commit**: 9211687
- **Severity**: MEDIUM
- **Category**: Purpose & frequency
- **Estimated scope**: 1 fichier (`src/styles/app.css`), 3 lignes

## Problem

`.lesson` a une animation d'entrée :

```css
/* src/styles/app.css:151-154 — current */
@media (prefers-reduced-motion:no-preference){
  .lesson{animation:up .35s ease both}
  @keyframes up{from{transform:translateY(6px)}to{transform:none}}
}
```

La page d'une Leçon l'annule déjà (`src/styles/app.css:300` : `.lesson.page{animation:none}`). Le seul autre élément `.lesson` est le bloc des résultats de recherche, `src/ui/lessons.js:225` :

```js
${found.length ? `<div class="lesson results"><ul class="entries">…` : ""}
```

`renderResults` réécrit ce bloc à **chaque lettre tapée** dans la recherche et à chaque mise à jour en temps réel : la liste sursaute de 6 px en continu pendant la frappe. Une action répétée des dizaines de fois ne doit pas animer.

## Target

Plus aucune animation `up` dans l'app.

## Repo conventions to follow

- CSS unique dans `src/styles/app.css`, règles en une ligne.

## Steps

1. Dans `src/styles/app.css`, supprimer entièrement le bloc des lignes 151-154 (`@media (prefers-reduced-motion:no-preference){ .lesson{animation:up …} @keyframes up{…} }`).
2. Dans `src/styles/app.css`, supprimer la ligne `.lesson.page{animation:none}` (devenue inutile).
3. Vérifier par `grep -n "animation:up\|keyframes up" src/styles/app.css` : aucun résultat.

## Boundaries

- Ne toucher à aucune autre règle `.lesson`.
- Ne pas modifier `src/ui/lessons.js`.

## Verification

- **Mechanical** : `pnpm build` réussit.
- **Feel check** : sur l'accueil Leçons, taper « sa » lettre par lettre dans la recherche : la liste des résultats ne bouge plus verticalement à chaque frappe.
- **Done when** : la recherche affiche ses résultats sans aucun mouvement.
