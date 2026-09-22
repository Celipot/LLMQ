# Mode Carrière v7 : mode Infini, grade et leaderboard

## Principe

Un second mode de carrière, **Infini**, qui démarre comme une carrière classique puis boucle sur la 3e phase après chaque SIF, de plus en plus dure, jusqu'à l'échec. Le score final reçoit un **grade** (aussi en Classique) et les meilleurs scores du mode Infini vont dans un **leaderboard global**.

## Mode Infini

- `POST /api/career { mode: 'infinite', username }` (`mode` : `'classic'` par défaut, `INVALID_MODE` (400) sinon ; le pseudo est obligatoire en Infini : 1 à 20 caractères, `INVALID_USERNAME` (400)). Règles de la difficulté `hard`, pool = tous les titres de la génération Nijigasaki (et non d'une seule unité).
- Phases 1 et 2 et première phase 3 (tours 21 à 40) identiques au Classique.
- Après le SIF : si les objectifs et le score le permettent, `cycle` passe à 2 et la phase 3 recommence : 20 nouveaux tours (41 à 60, puis 61 à 80, etc.), objectifs de sorties remis à zéro, SIF au bout. `finalTurn` = 40 + 20 × (cycle − 1).
- Fin de carrière (Infini) : objectifs de sorties manqués (`FINALE_GOALS`), ou SIF sous la moyenne (moins de 50 % du maximum, soit 2500 sur 5000 : `FINALE_SCORE`). Ce SIF compte dans le score.
- Le SIF de chaque boucle est archivé dans `career.finales[]` (`{ score, maxScore, grade, turn, tracks }`), le score final les additionne tous.
- L'événement de série (id 10) reste unique par carrière.

## Difficulté progressive

n = numéro de la boucle (1 après le premier SIF). Toutes les valeurs sont regroupées dans une table de `career.js`.

| Élément | Valeur |
|---|---|
| Fréquence | 1 + n événements négatifs par cycle, tirés dans les fenêtres du cycle |
| Durée des malus | 5 + n tours |
| Importance | malus de stat 400 + 100 × n, carnet −(2 + n), malus du SIF augmentés |
| Gains de stats | multipliés par max(0,2 ; 1 − 0,15 × n) : études, singles, série |

## Grade du score final

`career.finalScore.grade` (S, A, B, C, D) est calculé à partir du total, avec des seuils propres à chaque mode (Classique et Infini n'ont pas la même échelle). Affiché dans `CareerScore` pour les deux modes.

## Leaderboard

- `GET /api/leaderboard` (public, sans `X-Solo-Session`) : les 10 meilleurs scores Infini `[{ username, turn, score, grade }]`.
- Le serveur garde le top 100 dans `data/leaderboard.json` (écriture atomique, fichier absent ou corrompu toléré).
- Le score n'est jamais fourni par le client : le serveur l'inscrit une seule fois par carrière (`state.submitted`), à la fin par échec ou à l'abandon (`DELETE /api/career`). `turn` est le tour atteint.
- Limite connue : l'identifiant de session n'est pas un secret et le pseudo n'est pas authentifié (voir `AGENTS.md`).

## Frontend

- Écran de démarrage : choix Classique / Infini (Infini désactivé sans pseudo dans le profil) et leaderboard (rang, pseudo, tour, score, grade).
- « Boucle n » dans l'en-tête et l'objectif, texte d'échec `FINALE_SCORE`, grade dans `CareerScore`.

## Tests

- `career.test.js`, `careerEvents.test.js` : bouclage, échecs, courbes de difficulté, score cumulé, grade.
- `leaderboard.test.js`, `index.test.js` : démarrage Infini, boucle, soumission unique, abandon, `GET /api/leaderboard`.
- Front : `Leaderboard`, `CareerHub`, `CareerObjective`, `CareerScore`.
