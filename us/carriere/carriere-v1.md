# Mode Carrière — première boucle (études, repos, sortie d'album)

Suite de [`solo.md`](solo.md) : périmètre de la première version jouable.

## Contexte
`solo.md` décrit un Mode Carrière inspiré d'Uma Musume. On démarre par une boucle minimale : un nombre fixe de tours d'**Étude** ou de **Repos**, puis la **sortie d'un album de 6 musiques** (6 rounds notés). Le mode a ses propres règles de round : 3 paliers de 1 s, 1 seule suggestion de recherche, et trois stats qui font évoluer paliers, secondes et suggestions. Objectif : valider que la boucle étude → stats → sortie est agréable, avant Énergie/Moral avancés, objectifs de saison, finale, Discographie.

## Règles de la v1 (valeurs de départ, à équilibrer)

**Round de carrière (étude comme sortie)**
- Départ : 3 paliers (= 3 essais) **croissants : 1 s, 2 s, 3 s** (durée cumulée de l'extrait à chaque essai, comme dans le jeu classique) ; **1 suggestion** dans l'autocomplétion.
- Étude : mini-round dans ces conditions. Sortie : même règles, un seul round.

**Stats (0 à ~300), bonus par paliers de 100**

| Stat | Effet | 100 | 200 | 300 |
|---|---|---|---|---|
| Oreille | secondes | palier 1 : +0,5 s (1,5 s) | palier 2 : +0,5 s (2,5 s) | palier 3 : +0,5 s (3,5 s) |
| Culture | nombre de paliers | 4e palier (4 s) | 5e palier (5 s) | (max) |
| Mémoire | suggestions | 2 | 3 | 4 |

Les effets de chaque stat s'affichent au survol (ou au focus clavier) de la stat dans le hub, avec les paliers atteints marqués « ✓ ».

**Gain d'étude** (le joueur choisit la stat) : échec +30 ; trouvé au palier 1 +80, palier 2 +60, palier 3 +45, palier 4+ +40.

**Tours** : 10 tours fixes puis la sortie. Énergie max 3 ; Étude coûte 1 ; Repos redonne 3 (plafonné : un repos remet toujours l'énergie au maximum). L'énergie ne sert qu'à étudier. Sans énergie, seul le Repos est possible.

**Sortie de l'album** : 6 rounds enchaînés, avec les paliers et suggestions du joueur. Chaque titre rapporte des points selon l'essai où il est trouvé :

| Essai | 1 | 2 | 3 | 4 | 5 | Raté |
|---|---|---|---|---|---|---|
| Points | 100 | 70 | 50 | 35 | 25 | 0 |

Le **score de l'album** est la somme des 6 titres (sur 600). Le **grade** dépend de la part du maximum : S à 90 % et plus, A à 70 %, B à 50 %, C à 30 %, D en dessous. La carrière se termine à la sortie. Aucun objectif de saison ni échec de carrière dans cette v1.

## Pool de titres
Les études et la sortie tirent dans la **discographie du personnage** (Ayumu, 64 titres : solos, A・ZU・NA, groupe Nijigasaki, cf. `solo.md` §1). Il n'y a pas de champ « personnage » dans `songs.json` : la discographie se dérive du champ `artist` (solo : `Ayumu Uehara (CV: Aguri Onishi)` ; unité : `A・ZU・NA` ; groupe : la chaîne exacte du groupe Nijigasaki, à relever dans les données). Un filtre dans `career.js` suffit pour la v1. Le tirage des études évite les titres déjà trouvés dans la carrière. L'album, lui, est tiré des **titres trouvés en étude** (le carnet) : étudier prépare la sortie. S'il y en a moins de 6, il est complété par des titres tirés au hasard dans la discographie ; un titre n'apparaît jamais deux fois sur le même album.

## Approche technique

**Backend** (CommonJS, serveur = source de vérité)
- `server/gameState.js` : configuration du round paramétrable (`tiersSeconds` par round, `maxAttempts` = longueur des paliers). Défaut inchangé = `TIERS_SECONDS` actuel, pour ne pas toucher au solo/multijoueur.
- Nouveau `server/career.js` (logique pure) : état de carrière (tour, énergie, stats, carnet), gain d'étude, bonus par paliers, rang de sortie.
- Routes sous `/api/career/*` : nouvelle carrière, état, `rest`, `study {stat}`, `release`, puis réutilisation de guess/skip/`/audio/track` avec clé de round `<sessionId>:career:<songId>` (espace de noms séparé). Erreurs `{ error: 'CODE' }` stables (`NO_ENERGY`, `INVALID_STAT`, `CAREER_FINISHED`, `ROUND_IN_PROGRESS`). Le titre n'est jamais renvoyé avant la fin du round.
- `wavTruncate` gère déjà les secondes fractionnaires.
- Le nombre de suggestions est décidé par le serveur et exposé dans l'état ; `web/src/fuzzySearch.ts` (`MAX_RESULTS`) le reçoit en paramètre.

**Frontend**
- `useCareer.ts`, composants `CareerHub` et `StatBars`, réutilisation de `Player`, `Pips`, `SearchAutocomplete`, `Result`. Entrée par une carte sur la page d'accueil.

**Tests (TDD)** : `career.test.js`, `gameState.test.js` (paliers paramétrables, défaut inchangé), `index.test.js` (routes career), `useCareer.test.ts`, `CareerHub`/`StatBars`.

## Hypothèses à ajuster après un premier essai
- 10 tours, énergie 3, gains d'étude, seuils de stats.

## Vérification
- `pnpm test` vert ; chaque nouveau test vu échouer avant l'implémentation.
- Carrière complète en jeu : à 100 d'oreille le palier 1 dure 1,5 s, une 2e suggestion apparaît à 100 de mémoire, l'énergie bloque l'étude, le titre de la sortie n'apparaît qu'à la fin.
