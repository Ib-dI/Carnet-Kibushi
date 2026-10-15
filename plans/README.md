# Plans d'animation

Plans écrits par `improve-animations` au commit `9211687`. Chaque plan se suffit à lui-même : il peut être exécuté par n'importe quel agent.

| # | Plan | Gravité | Statut |
|---|---|---|---|
| 001 | [Retournement de la carte et carte suivante en Révision](001-revision-card-flip.md) | HIGH | DONE |
| 002 | [Plus d'animation rejouée sur les résultats de recherche](002-search-results-no-replay.md) | MEDIUM | DONE |
| 003 | [Retour d'appui sur les boutons](003-press-feedback.md) | MEDIUM | DONE |
| 004 | [Entrée des fenêtres (feuille du bas / léger zoom)](004-dialog-entrance.md) | MEDIUM | DONE |
| 005 | [Survol des tuiles, appui du « + », courbes en tokens](005-hover-gating-and-tokens.md) | LOW | DONE |

## Ordre recommandé

001 → 002 → 003 → 004 → 005.

## Dépendances

- 001, 003, 004 et 005 ajoutent chacun le token `--ease-out` dans `src/styles/tokens.css` **s'il n'existe pas** : le premier exécuté le crée, les suivants le réutilisent.
- 004 ajoute `--ease-drawer`, 005 ajoute `--ease-in-out`.
- 002 est indépendant.

## Hors plans

- Célébration de fin de Révision (« 8 / 10, à demain ! ») : idée « célébration » de `docs/idees.md`, à décider plus tard.
