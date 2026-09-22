# Mode Carrière v5 : carrières DiverDiva, QU4RTZ et R3BIRTH

Statut : **implémenté** (voir `carriere-v3.md` et `carriere-v4.md` pour les règles). La carrière d'A・ZU・NA reste la première ; trois autres unités du groupe Nijigasaki deviennent jouables. **Les règles sont identiques** (Normal et Difficile) : seul le pool de musique change.

## Principe

Le joueur choisit une **unité**, puis une **difficulté**, qui lance la carrière. L'unité est fixée pour toute la carrière. Elle détermine le pool de titres tirés par les études, les singles, les albums, les concerts, le SIF et les gains de carnet des événements.

## Unités et pools

La base de titres ne dit pas qui est dans quelle unité : la composition ci-dessous est écrite dans la table `UNITS` de `server/career.js`.

| Unité | Identifiant | Membres | Solos | Titres d'unité | Groupe Nijigasaki | Pool |
|---|---|---|---|---|---|---|
| A・ZU・NA | `azuna` | Ayumu Uehara, Shizuku Osaka, Setsuna Yuki (2 voix) | 28 | 13 | 41 | 82 |
| DiverDiva | `diverdiva` | Karin Asaka, Ai Miyashita | 17 | 13 | 41 | 71 |
| QU4RTZ | `qu4rtz` | Kasumi Nakasu, Kanata Konoe, Emma Verde, Rina Tennoji | 37 | 11 | 41 | 89 |
| R3BIRTH | `r3birth` | Shioriko Mifune, Mia Taylor, Lanzhu Zhong | 22 | 5 | 41 | 68 |

Le pool d'une unité est : **les solos de ses membres, les titres de l'unité et les titres du groupe Nijigasaki** (`Nijigasaki High School Idol Club`). Les titres de Mai Azabu et les crossovers (`Aqours / Nijigasaki High School Idol Club / Liella!`) sont exclus. Chaque pool dépasse 50 titres, donc le SIF (50 titres uniques) reste réalisable.

## API

- `POST /api/career` accepte un corps optionnel `{ unit, difficulty }`. Sans `unit`, l'unité est `azuna`, ce qui garde le contrat existant. Une unité inconnue donne `INVALID_UNIT` (400).
- `career.unit` est ajouté à la réponse.
- Les rounds et les gains de carnet des événements tirent dans le pool de l'unité de la carrière.

## Frontend

- L'écran de départ propose d'abord l'unité (quatre boutons, A・ZU・NA sélectionnée par défaut), puis la difficulté (Normal ou Difficile) qui lance la carrière. Il annonce « Suivre la carrière de … » selon l'unité sélectionnée. « Nouvelle carrière » ramène à cet écran.
- Le hub affiche l'unité à côté de la difficulté.
- Les libellés d'unité côté client forment une liste statique, miroir de la table du serveur (l'écran de départ précède toute création de carrière).
- **Illustrations** : chaque unité a les siennes sous `web/public/units/<unité>/` (`career.png`, `album.png`, `concert.png`, `single.png`). **L'illustration du SIF est partagée** (`web/public/sif-illustration.png`), ainsi que celle des événements. Une image absente est remplacée par un placeholder neutre (`web/public/unit-placeholder.svg`), sans réutiliser celles d'une autre unité. La table des images par unité est `web/src/careerIllustrations.ts` : ajouter une image d'une nouvelle unité se fait en ajoutant son chemin à cette table.

## Illustrations à produire

12 images, 4 par nouvelle unité :

| Unité | Illustration de la carrière | Cover d'album | Concert | Se faire connaître |
|---|---|---|---|---|
| DiverDiva | à produire | à produire | à produire | à produire |
| QU4RTZ | à produire | à produire | à produire | à produire |
| R3BIRTH | à produire | à produire | à produire | à produire |

Format 16/9, comme celles d'A・ZU・NA.

## Tests

- `career.test.js` : `discographyIds` par unité (membres et exclusions), tailles réelles 82, 71, 89 et 68, `isValidUnit`.
- `index.test.js` : création sans `unit` = `azuna`, avec `unit` = celle demandée, `INVALID_UNIT`, `career.unit` exposé, aucun titre de round hors du pool de l'unité.
- Web : choix de l'unité puis de la difficulté, `begin({ unit, difficulty })`, unité affichée, image de l'unité, placeholder si absente, SIF partagé.

## Questions ouvertes

- La composition des unités vient de la connaissance du groupe, pas des données : à corriger dans `UNITS` si elle est fausse.
- Le score final n'est pas comparé entre unités ni entre difficultés.
