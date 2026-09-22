# Mode Carrière v8 : unités µ's, Aqours et Hasunosora, Infini par génération, classement par génération

## Principe

Le Mode Carrière Classique et le Mode Infini sortent du seul groupe Nijigasaki. Dix nouvelles unités jouables couvrent µ's, Aqours et Hasunosora ; le Mode Infini se joue désormais sur la discographie complète de n'importe laquelle des quatre franchises, ou sur toute la base ; le classement se scinde en un tableau par franchise (plus un tableau « Toutes »).

## Nouvelles unités et pools

La composition ci-dessous est écrite dans les tables `GENERATIONS` et `UNITS` de `server/career.js`. Comme pour les unités Nijigasaki (`carriere-v5.md`), la base de titres ne dit pas qui appartient à quelle sous-unité : c'est une connaissance externe, à corriger dans le code si elle est fausse.

| Franchise | Unité | Identifiant | Membres (solos) | Pool |
|---|---|---|---|---|
| µ's | Printemps | `printemps` | Honoka Kosaka, Kotori Minami, Umi Sonoda | 71 |
| µ's | lily white | `lilywhite` | Rin Hoshizora, Hanayo Koizumi, Maki Nishikino | 66 |
| µ's | BiBi | `bibi` | Nico Yazawa, Eli Ayase, Nozomi Tojo | 66 |
| Aqours | CYaRon! | `cyaron` | Chika Takami, You Watanabe, Ruby Kurosawa | 109 |
| Aqours | AZALEA | `azalea` | Kanan Matsuura, Dia Kurosawa, Mari Ohara | 109 |
| Aqours | Guilty Kiss | `guiltykiss` | Riko Sakurauchi, Yoshiko Tsushima, Hanamaru Kunikida | 110 |
| Hasunosora | Cerise Bouquet | `cerisebouquet` | Kaho Hinoshita, Kozue Otomune | 70 |
| Hasunosora | DOLLCHESTRA | `dollchestra` | Sayaka Murano, Tsuzuri Yugiri | 71 |
| Hasunosora | Mira-Cra Park! | `miracrapark` | Rurino Osawa, Megumi Fujishima | 66 |
| Hasunosora | Edel Note | `edelnote` | *(aucun solo dans la base actuelle)* | 52 |

Le pool d'une unité reste : **les solos de ses membres, les titres de l'unité et les titres du groupe de sa franchise**. Le groupe Hasunosora existe sous deux libellés d'artiste dans les données (`Hasunosora Girls' High School Idol Club` et `Hasunosora High School Idol Club`) : les deux comptent. Chaque pool dépasse 50 titres (SIF réalisable). Un 3e membre de Cerise Bouquet, DOLLCHESTRA et Mira-Cra Park! existe dans la franchise mais n'a encore aucun titre solo dans la base : il n'apparaît donc pas dans `UNITS` tant qu'aucun titre ne lui est attribué.

`UNITS` change de forme : chaque unité porte désormais sa franchise (`{ generation, members }`), utilisée par `discographyIds` pour choisir le bon groupe. Les 4 unités Nijigasaki existantes (`azuna`, `diverdiva`, `qu4rtz`, `r3birth`) gardent leurs pools inchangés (82, 71, 89, 68).

## Mode Infini par génération

- `POST /api/career { mode: 'infinite', username, generation }`. `generation` : `'nijigasaki'` (défaut, comportement v7 inchangé), `'mus'`, `'aqours'`, `'hasunosora'`, ou `'all'` (toute la base jouable, toutes générations confondues, y compris Liella, Ikizulive, Musical, CrossGen). `INVALID_GENERATION` (400) sinon.
- Les règles restent celles de la difficulté `hard`, comme en v7 ; seul le pool tiré change.
- `career.generation` est ajouté à la réponse (affiché à côté de « Mode Infini » et de « Boucle n »).

## Classement par génération

- `GET /api/leaderboard` (toujours public, sans session) renvoie les 5 tableaux en un seul appel :
  `{ leaderboards: { nijigasaki: [...], mus: [...], aqours: [...], hasunosora: [...], all: [...] } }`, chacun `[{ username, turn, score, grade }]`, top 10.
- Une carrière Infini est inscrite dans le tableau de sa `generation` uniquement (jamais dans plusieurs à la fois, y compris une carrière `all` qui va dans `all`, pas dans les 4 autres).
- `data/leaderboard.json` reste un seul fichier ; chaque entrée gagne un champ `generation`. Les entrées déjà présentes (écrites avant v8, donc forcément une carrière Nijigasaki) sont lues avec `generation: 'nijigasaki'` par défaut, sans migration du fichier.
- Les seuils de grade (`career.js`, `RUN_GRADES.infinite`) restent partagés par toutes les générations : le score dépend de la franchise choisie (une franchise avec moins de titres n'a pas moins de tours), pas de barème séparé par génération.

## API (résumé des changements)

- `POST /api/career` : `unit` accepte désormais aussi les 10 nouveaux identifiants (`INVALID_UNIT` sinon, inchangé). En mode `infinite`, `generation` optionnelle comme décrit ci-dessus.
- `GET /api/leaderboard` : forme de la réponse change (`leaderboards` au pluriel, objet par génération) — à répercuter dans `web/src/api.ts` et `types.ts`.

## Frontend

- Écran de départ Classique : les 14 unités sont regroupées par franchise (Nijigasaki / µ's / Aqours / Hasunosora) plutôt qu'affichées à plat.
- Écran de départ Infini : sélecteur de franchise à 5 choix (Nijigasaki, µ's, Aqours, Hasunosora, Toutes) avant le bouton « Mode Infini ».
- `Leaderboard` : un onglet par génération (5 onglets), au lieu d'une liste unique.
- Illustrations : aucune image dédiée requise pour les 10 nouvelles unités — le placeholder existant (`web/public/unit-placeholder.svg`) s'applique déjà à toute unité sans image dans `careerIllustrations.ts`.

## Tests

- `career.test.js` : `discographyIds` et tailles réelles pour les 10 nouvelles unités et les 4 existantes (inchangées), `isValidUnit`, `isValidGeneration`, `createCareer(..., generation)` par défaut `'nijigasaki'`.
- `careerRounds.test.js` / `index.test.js` : pool tiré en mode infini selon `generation`, `INVALID_GENERATION`, au moins un round complet par nouvelle franchise.
- `leaderboard.test.js` : soumission par `generation`, lecture des entrées historiques sans ce champ, `top()` par tableau, `GET /api/leaderboard` renvoie les 5 tableaux.
- Web : regroupement des unités par franchise, sélecteur de franchise en Infini, `career.generation` affiché, `Leaderboard` à onglets, fallback placeholder pour les nouvelles unités.

## Questions ouvertes

- La composition des unités (au-delà des membres déjà confirmés) vient d'une recherche externe (wikis Love Live!), pas des données du jeu : à corriger dans `UNITS` si elle est fausse.
- Un 3e membre de Cerise Bouquet, DOLLCHESTRA et Mira-Cra Park! n'a pas de titre solo dans la base : à ajouter à `UNITS` le jour où un titre lui est attribué.
- Le score final n'est toujours pas comparé entre unités, difficultés ou générations.
