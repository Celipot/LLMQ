# Illustrations du Mode Carrière

Liste des illustrations nécessaires à ce jour. Les covers de chansons sont complètes (827 titres, 408 covers distinctes, aucun fichier manquant) : seules les deux images provisoires du Mode Carrière restent à produire.

## 1. Illustration du hub et de l'écran de round

- **Fichier actuel** : `web/public/career-placeholder.svg`.
- **Où** : entre l'objectif et les actions dans le hub (`CareerHub.tsx`), et sous le titre du round (`App.tsx`).
- **Format** : 16/9, largeur maximale 560 px sur l'écran de round (`.career-illustration` dans `App.css`).
- **Minimum** : 1 image pour tout le Mode Carrière.
- **Version plus riche** : 1 image par type d'action, soit 5 illustrations :
  - Étude
  - Single
  - Album
  - Concert
  - SIF (finale)

  Le hub pourrait aussi avoir 1 image par phase (3 au total), soit 8 illustrations avec les précédentes.

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
| Bonus de stat au maximum | 6, 7, 8 (ou 3 images séparées : Oreille, Mémoire, Culture) |
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

- **2 images** pour être complet dans l'état actuel (SVG ou PNG).
- **8 à 13 images** selon le niveau de détail voulu pour un rendu plus riche (5 pour le hub et le round, jusqu'à 9 pour les événements).
