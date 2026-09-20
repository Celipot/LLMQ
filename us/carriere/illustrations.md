# Illustrations du Mode Carrière

Les images sont propres à chaque unité, sauf celle du SIF et celle des événements, partagées. Une image absente est remplacée par un placeholder neutre (`web/public/unit-placeholder.svg`) ; la table des images est `web/src/careerIllustrations.ts`. Les covers de chansons sont complètes (827 titres, 408 covers distinctes, aucun fichier manquant).

## Images par unité (`web/public/units/<unité>/`)

Format 16/9, largeur maximale 560 px sur l'écran de round (`.career-illustration` dans `App.css`).

| Image | Fichier | Où | A・ZU・NA | DiverDiva | QU4RTZ | R3BIRTH |
|---|---|---|---|---|---|---|
| Illustration de la carrière | `career.png` | Hub, et rounds d'étude | fournie | à produire | à produire | à produire |
| Se faire connaître | `single.png` | Écran du round | fournie | à produire | à produire | à produire |
| Cover d'album (« AZUNALAND » pour A・ZU・NA) | `album.png` | Écran d'un round d'album, phases 1 et 3 | fournie | à produire | à produire | à produire |
| Concert | `concert.png` | Écran d'un round de concert, phases 2 et 3 | fournie | à produire | à produire | à produire |

**12 images à produire**, 4 par nouvelle unité. Ajouter une image se fait en déposant le fichier et en l'ajoutant à la table de `careerIllustrations.ts`.

## Images partagées

- **SIF** : `web/public/sif-illustration.png` (fournie, un pont et des feux d'artifice autour du logo SIF), pour toutes les unités.
- **Événements** : `web/public/career-event-placeholder.svg`, une image unique aujourd'hui. Version plus riche possible : 1 image par événement (15), regroupables en 9 selon le catalogue de `carriere-v3.md`.

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

- **Avatars des joueurs** : fournis par les joueurs, avec une pastille à initiale par défaut.
- **Covers de chansons** : rien à produire.

## Hors périmètre actuel

Il n'existe pas d'écran de fin (réussite ou échec de carrière), ni de page d'accueil illustrée, ni de favicon (`web/index.html` n'en déclare aucun). Ce seraient des besoins nouveaux.

## Total

- **12 images** pour compléter les trois nouvelles unités (4 chacune).
- **Jusqu'à 10 images de plus** pour des événements illustrés un par un.
