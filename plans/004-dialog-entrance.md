# 004 — Faire entrer les fenêtres : feuille qui monte sur téléphone, léger zoom sur ordinateur

- **Status**: DONE
- **Commit**: 9211687
- **Severity**: MEDIUM (opportunité manquée)
- **Category**: Missed opportunities / Physicality & origin
- **Estimated scope**: 2 fichiers (`src/styles/app.css`, `src/styles/tokens.css`), ~12 lignes

## Problem

Toutes les fenêtres sont des `<dialog>` ouvertes par `showModal()` (`src/ui/sheet.js:25`, `src/ui/entry-dialog.js:191`, `src/ui/lesson-dialog.js:72`, zoom d'image `src/ui/lessons.js` fonction `zoom`). Elles apparaissent sans mouvement. Sur téléphone, elles sont présentées comme une feuille collée en bas, mais rien n'explique d'où elle vient :

```css
/* src/styles/app.css:93-94 — current */
dialog{border:0;padding:0;border-radius:14px;background:var(--card);color:var(--ink);width:min(640px,calc(100% - 24px));max-height:calc(100% - 24px)}
dialog::backdrop{background:rgba(20,20,26,.5)}
/* src/styles/app.css:149 — current, dans @media (max-width:640px) */
  dialog{width:100%;max-width:100%;margin:auto 0 0;border-radius:14px 14px 0 0}  /* fenêtre en feuille du bas */
```

## Target

**Entrée seulement.** Les fenêtres créées par `openSheet` sont retirées du DOM à la fermeture (`src/ui/sheet.js`, `dlg.remove()` dans `cleanup`) : une animation de sortie ne serait pas vue pour elles ; ne pas en ajouter.

```css
/* ordinateur : modale centrée, origin center (correct pour une modale) */
dialog[open]{transition:opacity 200ms var(--ease-out),transform 200ms var(--ease-out)}
@starting-style{ dialog[open]{opacity:0;transform:scale(.97)} }
dialog[open]::backdrop{transition:background-color 200ms var(--ease-out)}
@starting-style{ dialog[open]::backdrop{background-color:transparent} }

/* téléphone (dans @media (max-width:640px)) : la feuille monte du bas */
dialog[open]{transition:transform 300ms var(--ease-drawer)}
@starting-style{ dialog[open]{opacity:1;transform:translateY(100%)} }

/* mouvement réduit : fondu seul */
@media (prefers-reduced-motion:reduce){
  dialog[open]{transition:opacity 150ms ease}
  @starting-style{ dialog[open]{opacity:0;transform:none} }
}
```

Navigateurs sans `@starting-style` (Safari < 17.5) : la fenêtre apparaît comme aujourd'hui — acceptable.

## Repo conventions to follow

- Tokens dans `src/styles/tokens.css`, premier bloc `:root{…}`, après `--r:10px;` :
  `--ease-out:cubic-bezier(0.23,1,0.32,1);` (si absent) et `--ease-drawer:cubic-bezier(0.32,0.72,0,1);`.
- Le bloc téléphone existant est `@media (max-width:640px){ … dialog{…feuille du bas} }` vers `src/styles/app.css:146-150`.

## Steps

1. Ajouter les tokens `--ease-out` (si absent) et `--ease-drawer` dans `src/styles/tokens.css`.
2. Dans `src/styles/app.css`, juste après `dialog::backdrop{background:rgba(20,20,26,.5)}`, ajouter les 4 lignes « ordinateur » du Target.
3. Dans le bloc `@media (max-width:640px){…}` qui contient la règle « fenêtre en feuille du bas », ajouter après elle les 2 lignes « téléphone » du Target.
4. À la fin de `src/styles/app.css`, ajouter le bloc « mouvement réduit » du Target.
5. Ne pas toucher `dialog:not([open])` (pas de sortie animée).

## Boundaries

- Ne pas modifier `src/ui/sheet.js` ni aucun fichier JS.
- Pas de `transform-origin` (modale centrée : `center` est correct).
- Si `dialog` porte déjà une `transition` ou un `transform`, STOP et signaler.

## Verification

- **Mechanical** : `pnpm build` réussit.
- **Feel check** :
  - Téléphone (ou DevTools mode appareil, largeur 390 px) : toucher le « + » d'une Leçon → la feuille monte du bas en ≈0,3 s, départ rapide, arrivée douce ; le fond s'assombrit en même temps.
  - Ordinateur : la fenêtre apparaît avec un très léger zoom (97 % → 100 %) et un fondu, ≈0,2 s.
  - Ouvrir Commentaires, Essais, l'image en grand : même comportement.
  - Animations DevTools à 10 % : la feuille ne dépasse pas sa position finale (pas de rebond), aucun clignotement.
  - Rendering → `prefers-reduced-motion: reduce` : fondu seul, pas de glissement.
  - Fermer (Échap, bouton, clic à côté) : fermeture instantanée, comme avant.
- **Done when** : toutes les fenêtres entrent comme ci-dessus, la fermeture est inchangée.
