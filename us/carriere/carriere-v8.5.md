# Mode Carrière v8.5 : sous-unités Liella, franchise Ikizulive (Classique + Infini), SIF à 30 titres

## Principe

Deux nouvelles franchises rejoignent le Mode Carrière, suivant le pattern posé par `carriere-v8.md` : Liella (3 sous-unités) et Ikizulive (une unité couvrant toute la franchise), chacune jouable en Mode Classique et comme franchise du Mode Infini avec son propre classement. Le SIF passe de 50 à 30 titres pour tous les modes et toutes les unités, pour que la franchise Ikizulive (32 titres au total) reste jouable jusqu'au bout.

## Nouvelles unités et pools

Comme pour les unités précédentes, la base ne dit pas qui appartient à quelle sous-unité : composition externe (arc de sous-unités de *Love Live! Superstar!!* saison 3), à corriger dans le code si elle est fausse. Sur les 11 membres de Liella!, seuls 10 sont répartis sur les 3 sous-unités jouables ; les titres crédités à un éventuel 4e groupement n'entrent dans le pool d'aucune unité (comme un membre sans titre solo dans la base).

| Franchise | Unité | Identifiant | Membres (solos) | Pool (avec le groupe) |
|---|---|---|---|---|
| Liella | CatChu! | `catchu` | Chisato Arashi, Kinako Sakurakoji, Shiki Wakana | 101 |
| Liella | 5yncri5e! | `syncrise` | Kanon Shibuya, Keke Tang, Sumire Heanna, Ren Hazuki | 109 |
| Liella | KALEIDOSCORE | `kaleidoscore` | Wien Margarete, Mei Yoneme, Tomari Onitsuka, Natsumi Onitsuka | 101 |
| Ikizulive | Ikizurai-Bu! | `ikizuraibu` | Akira Goto, Aurora Konohana, Hanabi Komagata, Mai Azabu, Midori Yamada, Miracle Kanazawa, Noriko Chofu, Polka Takahashi, Shion Sasaki, Yukuri Harumiya | 32 |

Le pool d'une unité reste : **les solos de ses membres, les titres de l'unité et les titres du groupe de sa franchise** (`GENERATIONS[generation].groupArtists`). Pour Liella, `groupArtists: ['Liella!']` — c'est ce qui fait passer les sous-unités de 12/20/12 titres propres à 101/109/101 une fois le groupe inclus. Pour Ikizulive, `Ikizurai-Bu!` est à la fois le groupe et l'unité : son pool est toute la franchise (32 titres), il n'y a pas de sous-division.

`UNITS` gagne 4 entrées (`catchu`, `syncrise`, `kaleidoscore`, `ikizuraibu`), toutes `{ generation, members }`. Les 14 unités existantes gardent leurs pools inchangés.

## SIF à 30 titres (tous modes, toutes unités)

- `FINALE_SIZE` passe de 50 à 30 dans `server/career.js`. `MAX_FINALE_SCORE` (`FINALE_SIZE * TRACK_POINTS_BY_STAGE[1]`) passe donc de 5000 à 3000, pour toutes les franchises, pas seulement Ikizulive.
- Raison : le pool Ikizulive (32 titres, toute la franchise) ne peut pas remplir un SIF de 50 titres sans répétition (`pickPreparedSongId` exclut les titres déjà tirés dans la même sortie et viderait le pool avant la fin). 30 reste sous 32 avec une marge suffisante pour le tirage à moitié notes/moitié pool.
- Conséquence assumée, non compensée dans ce ticket : le score maximum atteignable (`RUN_GRADES`) baisse d'environ 2000 points (la part du SIF dans le total). Les seuils de grade (`career.js`) ne sont **pas** recalibrés ici — à revoir si le SIF plus court rend le rang S trop difficile ou trop facile en pratique.
- Les événements 12 à 15 (`careerEvents.js`, malus/bonus tirés entre la 2e et la 25e piste du SIF) restent inchangés : 25 reste une valeur valide sous un SIF de 30 titres.

## Mode Infini par génération (extension)

- `POST /api/career { mode: 'infinite', generation }` accepte désormais aussi `'liella'` et `'ikizulive'`, en plus de `'nijigasaki'`, `'mus'`, `'aqours'`, `'hasunosora'`, `'all'`.
- `GENERATIONS.liella = { songsGeneration: 'Liella', groupArtists: ['Liella!'] }`, `GENERATIONS.ikizulive = { songsGeneration: 'Ikizulive', groupArtists: ["Ikizurai-Bu!"] }` dans `server/career.js`. `INFINITE_GENERATIONS` en dérive automatiquement (`Object.keys(GENERATIONS)` + `'all'`).
- Règles toujours celles de la difficulté `hard`, comme les autres franchises infinies.

## Classement

- `server/leaderboard.js` : `GENERATIONS` passe à `['nijigasaki', 'mus', 'aqours', 'hasunosora', 'liella', 'ikizulive', 'all']`. Le comportement des entrées historiques sans `generation` (lues comme `'nijigasaki'`) est inchangé.
- `GET /api/leaderboard` renvoie donc 7 tableaux au lieu de 5.

## API (résumé des changements)

- `POST /api/career` : `unit` accepte aussi `catchu`, `syncrise`, `kaleidoscore`, `ikizuraibu`. En mode `infinite`, `generation` accepte aussi `liella` et `ikizulive`.
- `GET /api/leaderboard` : `leaderboards` gagne les clés `liella` et `ikizulive`.
- Aucun changement de route ou de forme de réponse au-delà des valeurs acceptées : `career.js`, `leaderboard.js` seuls concernés côté contrat.

## Frontend

- `web/src/careerGenerations.ts` : 2 entrées (`liella`, `ikizulive`) avant `'all'`.
- `web/src/careerUnits.ts` : 4 entrées, regroupées par leur franchise comme les unités existantes.
- `web/src/types.ts` : `Unit` gagne `catchu | syncrise | kaleidoscore | ikizuraibu`, `Generation` gagne `liella | ikizulive`.
- `CareerHub.tsx` et `Leaderboard.tsx` n'ont besoin d'aucun changement de logique : entièrement pilotés par `CAREER_UNITS`/`CAREER_GENERATIONS`.
- Aucun changement dans `GenerationFilter`/`useGenerationOptions` (Mode Solo) : déjà générique via `/api/generations`.

## Tests

- `career.test.js` : `discographyIds` et tailles réelles pour les 4 nouvelles unités ; `isValidUnit`, `isValidGeneration('liella'/'ikizulive')` ; `FINALE_SIZE === 30` et `MAX_FINALE_SCORE === 3000` (remplace les anciennes valeurs 50/5000) ; chaque pool (existant compris) reste `>= FINALE_SIZE`.
- `careerRounds.test.js` / `index.test.js` : au moins un round complet par nouvelle unité et par nouvelle franchise infinie ; un SIF de 30 titres qui se termine sans erreur sur `ikizuraibu` (pool le plus juste, 32 titres).
- `leaderboard.test.js` : soumission et lecture pour `liella` et `ikizulive`, jamais mélangées avec une autre franchise.
- Web : `careerUnits.test.ts` (4 nouvelles unités), `Leaderboard.test.tsx` (7 onglets), `CareerHub.test.tsx` (regroupement par franchise inchangé, nouvelles franchises listées).

## Questions ouvertes

- Composition exacte des sous-unités Liella : hypothèse externe, à corriger si fausse (comme les unités Hasunosora en v8).
- Seuils de grade (`RUN_GRADES`) non recalibrés après la baisse du SIF à 30 titres : à revoir si le retour terrain montre un déséquilibre.
- Titres crédités uniquement à un 4e groupement Liella non retenu comme unité (hors `catchu`/`syncrise`/`kaleidoscore`) : orphelins de toute unité, comme un membre sans titre solo.
