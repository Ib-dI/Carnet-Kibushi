# 003 — Retour d'appui sur les boutons

- **Status**: DONE
- **Commit**: 9211687
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 2 fichiers (`src/styles/app.css`, `src/styles/tokens.css`), ~6 lignes

## Problem

Aucun bouton ne réagit à l'appui, sauf le « + » flottant. Sur téléphone, les boutons de Révision (« À revoir », « Je savais », « Par cœur », « Retourner la carte ») sont touchés des dizaines de fois par jour sans aucune sensation de pression.

```css
/* src/styles/app.css:33 — current */
.btn{border:1.5px solid var(--ink);background:transparent;border-radius:999px;padding:9px 18px;font-weight:700;display:inline-flex;align-items:center;gap:8px}
/* src/styles/app.css:88 — current */
.chip{border:1.5px solid var(--line);background:var(--paper);border-radius:999px;padding:7px 14px;font-weight:600}
/* .play (≈ ligne 65), .pg-btn (≈ ligne 321) : idem, pas de :active */
```

## Target

```css
.btn,.chip,.play,.pg-btn{transition:transform 160ms var(--ease-out)}
.btn:active:not(:disabled),.chip:active,.play:active,.pg-btn:active:not(:disabled){transform:scale(.97)}
@media (prefers-reduced-motion:reduce){ .btn,.chip,.play,.pg-btn{transition:none} }
```

Le `scale(.97)` reste même en mouvement réduit (c'est un retour d'appui, pas un déplacement) ; seule la transition est coupée.

## Repo conventions to follow

- Tokens dans `src/styles/tokens.css`, premier bloc `:root{…}`. Ajouter `--ease-out:cubic-bezier(0.23,1,0.32,1);` après `--r:10px;` s'il n'existe pas déjà (plans 001 / 005).
- Exemple existant : `.fab:active{transform:scale(.92)}` (`src/styles/app.css:79`).

## Steps

1. Ajouter le token `--ease-out` dans `src/styles/tokens.css` si absent.
2. Dans `src/styles/app.css`, juste après la ligne `.btn:disabled{opacity:.5;cursor:default}`, ajouter :
   ```css
   /* Appui : le bouton s'enfonce un peu */
   .btn,.chip,.play,.pg-btn{transition:transform 160ms var(--ease-out)}
   .btn:active:not(:disabled),.chip:active,.play:active,.pg-btn:active:not(:disabled){transform:scale(.97)}
   ```
3. Dans le bloc `@media (prefers-reduced-motion:reduce){ .rec-btn.on{animation:none} }`, ajouter `.btn,.chip,.play,.pg-btn{transition:none}`.
4. Vérifier qu'aucune règle existante ne pose déjà un `transform` sur `.btn`, `.chip`, `.play` ou `.pg-btn` (`grep -n "transform" src/styles/app.css`) ; si oui, STOP et signaler.

## Boundaries

- Ne pas toucher `.fab` (plan 005), ni `.tile`.
- Ne pas changer couleurs, tailles ni bordures.

## Verification

- **Mechanical** : `pnpm build` réussit.
- **Feel check** (sur téléphone de préférence) :
  - Maintenir le doigt sur « Je savais » : le bouton s'enfonce très légèrement ; il revient en relâchant.
  - Un bouton désactivé ne bouge pas.
  - Animations DevTools à 10 % : pas de rebond, retour net.
- **Done when** : tous les boutons arrondis, puces et ▶ réagissent à l'appui.
