# 006 — Supprimer le flash gris des touchers sur iPhone

- **Status**: DONE
- **Commit**: 2d032cf
- **Severity**: MEDIUM
- **Category**: Accessibility / Physicality
- **Estimated scope**: 1 fichier (`src/styles/app.css`), 1 ligne

## Problem

Aucune règle `-webkit-tap-highlight-color` dans le projet (`grep -rn "tap-highlight" src index.html` → rien). Sur iOS/Safari et Chrome Android, chaque toucher sur un bouton ou un lien affiche un rectangle gris translucide, qui ignore les coins arrondis et s'ajoute au retour d'appui déjà en place :

```css
/* src/styles/app.css:40-41 — current (retour d'appui existant) */
.btn,.chip,.play,.pg-btn{transition:transform 160ms var(--ease-out)}
.btn:active:not(:disabled),.chip:active,.play:active,.pg-btn:active:not(:disabled){transform:scale(.97)}
```

## Target

```css
/* Pas de rectangle gris au toucher : le retour vient de l'enfoncement (et du focus clavier) */
a,button,summary,[role="button"],label{-webkit-tap-highlight-color:transparent}
```

## Repo conventions to follow

- Règles globales en tête de `src/styles/app.css` (lignes 1-5 : `*{box-sizing:border-box}`, `html,body{…}`, `img{…}`, `[hidden]{…}`).

## Steps

1. Dans `src/styles/app.css`, juste après la ligne `[hidden]{display:none!important}`, ajouter les 2 lignes du Target.

## Boundaries

- Ne pas toucher aux styles `:focus-visible` (le focus clavier doit rester visible).
- Ne rien changer d'autre.

## Verification

- **Mechanical** : `pnpm build` réussit.
- **Feel check** (sur un vrai iPhone ou Android) : toucher « Retourner la carte », une tuile de Leçon, un onglet → plus de rectangle gris ; seul l'enfoncement (là où il existe) est visible. Au clavier (Tab), l'anneau de focus apparaît toujours.
- **Done when** : aucun flash gris au toucher sur téléphone.
