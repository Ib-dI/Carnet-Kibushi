# 007 — Retour d'appui sur les tuiles, les cartes de la Grille et les onglets

- **Status**: DONE
- **Commit**: 2d032cf
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 fichier (`src/styles/app.css`), ~6 lignes

## Problem

Les boutons s'enfoncent à l'appui (`src/styles/app.css:40-41`), mais pas les trois éléments les plus touchés sur téléphone :

```css
/* src/styles/app.css:262 — current : tuile de Leçon (lien), aucune règle :active */
.tile{position:relative;display:grid;…;transition:transform .15s ease,box-shadow .15s ease}
/* src/styles/app.css:296 — current : zone qui retourne une carte de la Grille */
.card-flip{display:grid;gap:4px;text-align:left;border:0;background:none;padding:0;color:inherit;font:inherit;cursor:pointer}
/* src/styles/app.css:350 — current : onglet Leçons / Réviser / Progrès */
.tabbar a{position:relative;flex:1;display:flex;…}
```

## Target

```css
/* Appui sur les grandes surfaces : la tuile, l'onglet et le contenu d'une carte s'enfoncent */
.tile:active{transform:scale(.98);transition:transform 160ms var(--ease-out)}
.tabbar a{transition:transform 160ms var(--ease-out)}
.tabbar a:active{transform:scale(.97)}
.card-flip{transition:transform 160ms var(--ease-out)}
.card-flip:active{transform:scale(.97)}
@media (prefers-reduced-motion:reduce){ .tabbar a,.card-flip{transition:none} }
```

Remarques :
- Sur `.tile`, la `transition` existante (`transform .15s ease`) reste pour le survol ; `.tile:active` la remplace pendant l'appui. `scale(.98)` (et non .97) car la tuile est grande.
- On n'anime pas `.card-in` (il porte la rotation 3D) : l'enfoncement est sur `.card-flip`, le contenu touché.

## Repo conventions to follow

- Exemple existant : `.btn:active:not(:disabled){transform:scale(.97)}` avec `transition:transform 160ms var(--ease-out)` (`src/styles/app.css:40-41`).
- Token `--ease-out` déjà défini dans `src/styles/tokens.css`.

## Steps

1. Dans `src/styles/app.css`, juste après la ligne `@media (prefers-reduced-motion:reduce){ .tile{transition:none} .tile:hover{transform:none} }`, ajouter la ligne `.tile:active{…}` du Target.
2. Juste après la ligne `.tabbar a[aria-current="page"]{…}`, ajouter les lignes `.tabbar a{transition…}` et `.tabbar a:active{…}`.
3. Juste après la ligne `.card-flip:focus-visible{…}`, ajouter les lignes `.card-flip{transition…}` et `.card-flip:active{…}`.
4. À la suite, ajouter la ligne `@media (prefers-reduced-motion:reduce){ .tabbar a,.card-flip{transition:none} }`.
5. Vérifier qu'aucune règle existante ne pose `transform` sur `.tabbar a` ou `.card-flip` (`grep -n "transform" src/styles/app.css`) ; si oui, STOP.

## Boundaries

- Ne pas toucher `.card-in`, `.face`, `.fab`, `.btn`.
- Ne pas changer couleurs ni tailles.

## Verification

- **Mechanical** : `pnpm build` réussit.
- **Feel check** (téléphone) :
  - Appuyer sur une tuile du sommaire : elle s'enfonce à peine (98 %) puis la Leçon s'ouvre.
  - Appuyer sur un onglet : léger enfoncement.
  - Grille : appuyer sur le mot d'une carte → le contenu s'enfonce, puis la carte pivote ; aucun saut au relâchement.
  - Ordinateur : survol d'une tuile toujours soulevé de 2 px ; clic → enfoncement.
- **Done when** : tuiles, onglets et cartes réagissent à l'appui comme les boutons.
