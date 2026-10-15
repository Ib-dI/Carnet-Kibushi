# Plans d'animation

Plans écrits par `improve-animations` au commit `9211687`. Chaque plan se suffit à lui-même : il peut être exécuté par n'importe quel agent.

| # | Plan | Gravité | Statut |
|---|---|---|---|
| 001 | [Retournement de la carte et carte suivante en Révision](001-revision-card-flip.md) | HIGH | DONE |
| 002 | [Plus d'animation rejouée sur les résultats de recherche](002-search-results-no-replay.md) | MEDIUM | DONE |
| 003 | [Retour d'appui sur les boutons](003-press-feedback.md) | MEDIUM | DONE |
| 004 | [Entrée des fenêtres (feuille du bas / léger zoom)](004-dialog-entrance.md) | MEDIUM | DONE |
| 005 | [Survol des tuiles, appui du « + », courbes en tokens](005-hover-gating-and-tokens.md) | LOW | DONE |
| 006 | [Plus de flash gris au toucher (iPhone/Android)](006-no-tap-highlight.md) | MEDIUM | DONE |
| 007 | [Appui sur les tuiles, cartes de la Grille et onglets](007-press-feedback-tiles-cards-tabs.md) | MEDIUM | DONE |
| 008 | [Célébrer la fin d'une Révision (score + série 🔥)](008-revision-done-celebration.md) | MEDIUM | DONE |
| 009 | [Grille : retournement à 300 ms, fondu en mouvement réduit](009-grid-flip-cohesion.md) | LOW | DONE |

## Ordre recommandé

001 → 002 → 003 → 004 → 005 (faits), puis 006 → 007 → 008 → 009.

## Dépendances

- 001, 003, 004 et 005 ajoutent chacun le token `--ease-out` dans `src/styles/tokens.css` **s'il n'existe pas** : le premier exécuté le crée, les suivants le réutilisent.
- 004 ajoute `--ease-drawer`, 005 ajoute `--ease-in-out`.
- 002 est indépendant.
- 006 à 009 (audit au commit `2d032cf`) sont indépendants entre eux ; tous les tokens dont ils ont besoin existent déjà.

## Hors plans (audit 2d032cf)

- Fermer une feuille en la glissant vers le bas (téléphone) : à reprendre plus tard, attention aux formulaires et au micro.
- Jauge du micro en `scaleX` au lieu de `width` : faible impact.
- Fondu au changement de vue (Essentiel · Complet · Grille) : bénéfice modeste.
- À vérifier sur iPhone : verso défilant d'une carte de Grille en rotation 3D.
