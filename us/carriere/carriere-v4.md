# Mode Carrière v4 : difficultés Normal et Difficile

Statut : **implémenté** (voir `carriere-v3.md` pour les règles de base). Le mode actuel devient le mode **Difficile** sans changement de règle. Un mode **Normal**, plus accessible, est ajouté.

## Principe

Le joueur choisit une difficulté au début d'une carrière. Elle est fixée pour toute la carrière et ne peut plus changer. Toutes les règles qui varient viennent d'une table de configuration du serveur (`DIFFICULTIES` dans `server/career.js`), le serveur restant seul maître des règles.

## Réglages

| Levier | Difficile (mode actuel) | Normal |
|---|---|---|
| Fans requis au tour 20 | 350 | 200 |
| Grade exigé de l'album | B | C |
| Objectifs du SIF | 2 concerts et 3 albums, dont 2 et 2 en B ou mieux | 2 concerts et 3 albums, dont 1 et 1 en C ou mieux |
| Événements négatifs (3, 4, 5, 11 et les malus du SIF 12 à 14) | actifs | désactivés (les bonus restent) |
| Paliers de temps de départ | 1 s, 2 s, 3 s | 2 s, 3 s, 4 s, 5 s |
| Essais de départ | 3 | 4 |
| Suggestions de recherche de départ | 1 | 3 |
| Indice « groupe + chanteur » | non | oui |

Les autres règles (énergie, gains de stats, coûts, barème de points, part du carnet dans les sorties) sont communes aux deux difficultés.

### Stats de base et bonus

Les bonus de stats s'ajoutent aux valeurs de départ de la difficulté :

- **Chant** : +0,5 s sur les trois premiers paliers (un pas de 100 chacun).
- **Endurance** : jusqu'à 2 essais de plus. Le palier ajouté dure 1 s de plus que le dernier palier de départ (Difficile : 4 s puis 5 s ; Normal : 6 s puis 7 s). Une Endurance négative laisse un seul essai.
- **Connaissances** : jusqu'à 3 suggestions de plus. Une Connaissances négative supprime toutes les suggestions.

Un joueur de Normal peut donc atteindre 6 essais et 6 suggestions.

### Barème des points

Le barème gagne un 6e essai : **15 points** (rang C). Il ne s'applique en pratique qu'en Normal, puisque Difficile s'arrête à 5 essais.

## Indice « groupe + chanteur » (Normal)

Sur tous les rounds d'une carrière Normal, un indice s'affiche au-dessus du carnet, décrivant le titre à deviner. Il est dérivé du champ `artist` de `songs.json` :

| Type de titre | Indice |
|---|---|
| Solo (`Ayumu Uehara (CV: Aguri Onishi)`) | Solo : Ayumu Uehara (le « CV: … » est retiré) |
| Unité (`A・ZU・NA`) | A・ZU・NA |
| Groupe (`Nijigasaki High School Idol Club`) | Nijigasaki High School Idol Club |

La base ne contient pas la liste des membres qui chantent un titre d'unité ou de groupe : pour ceux-là, l'indice ne donne que le groupe. Le titre du round reste masqué jusqu'à la fin, seul le type de titre est révélé.

## API

- `POST /api/career` accepte un corps optionnel `{ difficulty: 'normal' | 'hard' }`. Sans corps, la difficulté est `hard`, ce qui garde le contrat existant. Une autre valeur donne `INVALID_DIFFICULTY` (400).
- `career.difficulty` (`'normal'` ou `'hard'`), `career.baseTiers` (secondes des paliers de départ) et `career.baseSuggestions` sont ajoutés à la réponse.
- `career.fans.required`, `career.albumGoalGrade` et `career.finaleGoals` reflètent déjà la difficulté choisie, ainsi que `roundTiers` et `suggestionCount` côté serveur.
- `round.hint { group, singer? }` n'est présent qu'en Normal.

## Frontend

- L'écran de départ propose deux boutons, **Normal** et **Difficile**, chacun avec une infobulle qui résume ses règles. Une fois la carrière terminée, « Nouvelle carrière » ramène à ce choix.
- La difficulté de la carrière en cours est affichée dans l'en-tête du hub.
- Les textes des paliers de stats (infobulle des barres) sont calculés à partir de `career.baseTiers` et `career.baseSuggestions`, et non plus écrits en dur.
- L'indice est affiché par `CareerNotebook`, au-dessus du carnet.

## Tests

- `career.test.js` : réglages par difficulté, seuil de fans, grade de l'album, objectifs du SIF, paliers et suggestions de départ, cumul des bonus, essai supplémentaire de 6 s ou plus, points du 6e essai, indice d'un artiste.
- `careerEvents.test.js` : en Normal, aucun événement négatif ne se déclenche (tours et SIF), les bonus oui ; en Difficile, comportement inchangé.
- `index.test.js` : création sans corps = Difficile, `{ difficulty: 'normal' }` = Normal, valeur invalide refusée, champs exposés, indice présent en Normal seulement et sans le titre.
- Web : choix de difficulté, `begin(difficulty)`, difficulté affichée, textes de paliers dépendants des valeurs de départ, indice rendu au-dessus du carnet.

## Questions ouvertes

- Le score final n'est pas pondéré par la difficulté : à afficher à côté du score seulement.
- Un joueur ne peut pas changer de difficulté en cours de carrière : il doit recommencer.
