# Mode Carrière v2 — single, deuxième phase et concert

Suite de [`carriere-v1.md`](carriere-v1.md). Les règles de round (paliers croissants, suggestions, stats par paliers de 100) ne changent pas.

## Contexte
La v1 se termine à la sortie de l'album. La v2 ajoute une action de **sortie de single** (plus de stats, mais rien dans le carnet), une **deuxième phase de 10 tours** après l'album, puis un **concert de 15 titres** qui clôt la carrière.

## Boucle

```
Tours 1-10  : Étude / Repos / Single  →  Sortie d'album (6 titres)
Tours 11-20 : Étude / Repos / Single  →  Concert (15 titres)  →  fin de carrière
```

Stats, carnet et énergie sont conservés d'une phase à l'autre. La sortie de l'album ne remet pas l'énergie au maximum.

## Règles (valeurs de départ, à équilibrer)

**Énergie** : max **4** (3 en v1), pour qu'un Single (coût 2) reste compatible avec des Études. Le Repos remet toujours l'énergie au maximum.

| Action | Coût | Carnet | Gain : échec | Gain : palier 1 / 2 / 3 / 4+ |
|---|---|---|---|---|
| Étude (nerfée) | 1 | +1 titre trouvé | 15 | 40 / 30 / 25 / 20 |
| Single | 2 | aucun | 30 | 90 / 65 / 50 / 45 |
| Repos | 0 | — | — | énergie au maximum |

Le Single ne laisse pas le choix de la stat : le serveur en tire une au hasard (oreille, mémoire ou culture, à probabilité égale) et l'annonce dans le round. Il tire un titre de la discographie non encore trouvé, comme l'Étude, mais le titre trouvé n'entre pas dans le carnet : le joueur arbitre entre stats et préparation de l'album/concert. Chaque action consomme un tour.

**Concert** : 15 rounds enchaînés avec les paliers et suggestions du joueur. Mêmes points par essai que l'album (100/70/50/35/25/0), maximum **1500**, mêmes grades (S ≥ 90 %, A ≥ 70 %, B ≥ 50 %, C ≥ 30 %, D). Pool : la moitié des titres (arrondie au-dessus) vient du carnet, l'autre moitié de toute la discographie (repli sur la discographie si le carnet est trop petit) ; aucun doublon dans le concert (les titres de l'album sont autorisés en repli). La carrière se termine à la fin du concert.

## Objectifs et fans

Deux objectifs, affichés l'un après l'autre en haut du hub :
1. **Sortir l'album avec un grade B ou mieux** (au moins la moitié des points). En dessous, la carrière est **échouée** (`failure: 'ALBUM_GRADE'`) : plus aucune action, seul « Nouvelle carrière » reste.
2. **Atteindre 350 fans pour participer au concert**. Le compte est fait quand les 20 tours sont écoulés ; s'il manque des fans, la carrière est échouée (`failure: 'FANS'`).

Les fans ne se gagnent qu'en sortant de la musique :

| Source | Fans |
|---|---|
| Single, palier 1 / 2 / 3 / 4+ | 40 / 30 / 25 / 20 |
| Single raté | 10 |
| Album sorti | la moitié du score (jusqu'à 300) |
| Étude, repos, concert | 0 |

Un album parfait ne suffit pas (300 fans) : le seuil de 350 fans oblige à sortir au moins deux singles trouvés au premier essai (40 fans chacun) avant et après l'album.

Le hub affiche l'objectif en cours en grand, au milieu, avec l'illustration de la carrière (`web/public/career-illustration.png`) entre l'objectif et les commandes. L'objectif indique entre parenthèses, en plus petit, dans combien de tours il doit être accompli (le tour en cours compte : « dans 10 tours » au tour 1) ; rien n'est affiché quand l'album ou le concert est à jouer.

## Score de carrière

À la fin (concert joué **ou** carrière échouée), l'écran de fin affiche un **score de carrière**, somme de quatre parties calculée côté serveur (`career.finalScore`) :

| Partie | Valeur |
|---|---|
| Album | points de l'album (max 600) |
| Concert | points du concert (max 1500, 0 si non joué) |
| Stats | total des trois stats |
| Fans | nombre de fans |

Un album et un concert parfaits sans stats font 600 + 1500 + 0 + 300 = 2400. Le concert pèse beaucoup dans le total ; les poids sont à ajuster après un premier essai.

## Interface

- Hub sur trois colonnes, comme le multijoueur : stats (tour en cours, énergie, fans actuels, une ligne chacun, puis carnet) à gauche, objectif, image et actions au milieu, récaps album/concert à droite. Chaque récap n'affiche que son grade, avec un dépliant pour le score et la liste des titres.
- Le bouton « Recommencer la carrière » est dans l'en-tête, à gauche d'« Accueil », uniquement sur le hub d'une carrière en cours (pas pendant un round, ni une fois la carrière terminée).

## Approche technique

**Backend**
- `server/career.js` : `TOTAL_TURNS = 20`, `RELEASE_AFTER_TURN = 10`, `SINGLE_*`, `single()`, `pickStat()`, `assertCanConcert`, `finishConcertTrack` ; `finishAlbumTrack` et le calcul du grade sont généralisés (taille, score maximum).
- `server/careerRounds.js` : `startSingle`, `startConcert`, `settleRound` pour les kinds `single` et `concert` ; `publicCareer` expose `releaseAt`, `concertDue`, `concert { done, total }` et le résultat du concert.
- Abandon : `DELETE /api/career` (204) efface la carrière et son round ; le bouton « Recommencer la carrière » de l'en-tête ramène à l'écran « Commencer une carrière ».
- Routes : `POST /api/career/single` (sans corps, stat tirée côté serveur) et `POST /api/career/concert`.
- `publicCareer` expose aussi `fans { current, required }`, `failure` (`null`, `'ALBUM_GRADE'` ou `'FANS'`) et `albumGoalGrade`. Une carrière échouée répond `CAREER_FINISHED` à toute action.
- Erreurs stables : `RELEASE_DUE` (tour 11 atteint sans album), `CONCERT_DUE` (tour 21 atteint), `CONCERT_NOT_DUE`, `CAREER_FINISHED` (concert terminé), toutes 409.

**Frontend** : `types.ts`, `api.ts`, `useCareer.ts`, `CareerHub`, `CareerObjective`, `CareerResult`, `CareerScore` (bouton « Sortir un single », progression et résultat du concert, objectif, score de fin) et leurs tests.

**Tests (TDD)** : `career.test.js`, `index.test.js`, `useCareer.test.ts`, `CareerHub.test.tsx`, `AppCareer.test.tsx`.

## Risques
- `release` n'est plus l'état final de la carrière : le front et les tests qui supposent « release ⇒ terminé » doivent utiliser la fin du concert.
- Équilibrage Single/Étude et durée du concert : valeurs en constantes, à ajuster après un premier essai.

## Vérification
- `pnpm test` vert ; chaque nouveau test vu échouer avant l'implémentation.
- Carrière complète en jeu : Single coûte 2 et n'ajoute rien au carnet, l'album ouvre une 2e phase de 10 tours, le concert de 15 titres termine la carrière.
