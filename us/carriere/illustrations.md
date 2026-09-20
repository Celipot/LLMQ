# Illustrations du Mode Carrière

Liste des illustrations nécessaires à ce jour. Les covers de chansons sont complètes (827 titres, 408 covers distinctes, aucun fichier manquant) : seules les deux images provisoires du Mode Carrière restent à produire.

## 1. Illustration du hub et de l'écran de round

- **Fichier actuel** : `web/public/career-illustration.png` (fournie : les trois membres d'A・ZU・NA, 16/9). Elle sert de version minimale ; les variantes ci-dessous restent optionnelles.
- **Où** : entre l'objectif et les actions dans le hub (`CareerHub.tsx`), et sous le titre du round (`App.tsx`).
- **Format** : 16/9, largeur maximale 560 px sur l'écran de round (`.career-illustration` dans `App.css`).
- **Minimum** : 1 image pour tout le Mode Carrière (fait).
- **Album** : la cover `web/public/album-cover.png` (« AZUNALAND », fournie) remplace l'illustration de la carrière sur l'écran d'un round d'album, phases 1 et 3 comprises.
- **Concert** : l'illustration `web/public/concert-illustration.png` (fournie) remplace l'illustration de la carrière sur l'écran d'un round de concert, phases 2 et 3 comprises.
- **Se faire connaître** : l'illustration `web/public/single-illustration.png` (fournie, un carrefour couvert d'affiches AZUNA) remplace l'illustration de la carrière sur l'écran de ce round.
- **SIF** : l'illustration `web/public/sif-illustration.png` (fournie, un pont et des feux d'artifice autour du logo SIF) remplace l'illustration de la carrière sur l'écran du round de la finale.
- **Version plus riche** : 1 image par type d'action (5 en tout, dont l'album, le concert, « Se faire connaître » et le SIF, déjà fournis). Reste à produire :
  - Étude

  Le hub pourrait aussi avoir 1 image par phase (3 de plus).

## 2. Illustration des événements

- **Fichier actuel** : `web/public/career-event-placeholder.svg`.
- **Où** : la fenêtre d'événement (`CareerEvent.tsx`).
- **Minimum** : 1 image pour tous les événements.
- **Version riche** : 1 image par événement (15), regroupables en 9 selon le catalogue de `carriere-v3.md` :

| Illustration | Événements |
|---|---|
| Énergie +2 | 1 |
| Carnet gagné | 2, 9 |
| Carnet perdu | 3, 5 |
| Malus de stat temporaire | 4, 11 |
| Bonus de stat au maximum | 6, 7, 8 (ou 3 images séparées : Chant, Connaissances, Endurance) |
| Série de 5 titres et choix de récompense | 10 |
| SIF : malus de stat | 12, 13, 14 |
| SIF : bonus de temps | 15 |

## Sans illustration

- **Portrait de la carrière** : `solo.md` prévoit d'utiliser une cover (d'un solo, ou d'A・ZU・NA), pas un dessin. Le choix de cette cover reste une question ouverte.
- **Avatars des joueurs** : fournis par les joueurs, avec une pastille à initiale par défaut.
- **Covers** : rien à produire.

## Hors périmètre actuel

Il n'existe pas d'écran de fin (réussite ou échec de carrière), ni de page d'accueil illustrée, ni de favicon (`web/index.html` n'en déclare aucun). Ce seraient des besoins nouveaux.

## Total

- **1 image** pour être complet dans l'état actuel : celle des événements (SVG ou PNG), l'illustration du hub et du round étant fournie.
- **Jusqu'à 10 images de plus** pour un rendu plus riche : 1 pour les rounds (étude), jusqu'à 9 pour les événements.
