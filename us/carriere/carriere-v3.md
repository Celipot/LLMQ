# Mode Carrière v3 — troisième phase, événements et SIF

Suite de [`carriere-v2.md`](carriere-v2.md). Les règles de round (paliers croissants, suggestions, stats par paliers de 100) ne changent pas.

## Contexte
La v2 se termine au concert du tour 20. La v3 ajoute une **troisième phase de 30 tours** où le joueur choisit quand sortir albums et concerts, un **finale de 50 titres (SIF)** qui clôt la carrière, et des **événements** qui font varier tous les éléments de la carrière, de plus en plus défavorablement au fil des tours.

## Boucle

```
Tours 1-10  : Étude / Repos / Single  →  Sortie d'album (6 titres)              (v2, inchangé)
Tours 11-20 : Étude / Repos / Single  →  Concert (15 titres)                    (v2, ne termine plus la carrière)
Tours 21-50 : Étude / Repos / Single / Album / Concert  →  SIF (50 titres)  →  fin de carrière
```

Stats, carnet et énergie sont conservés d'une phase à l'autre. L'album et le concert des phases 1 et 2 restent des rendez-vous imposés et ne coûtent pas d'énergie.

## Phase 3 (tours 21 à 50)

Album et concert sont **débloqués après le premier concert** (celui de la phase 2) et se sortent à la demande, plusieurs fois.

| Action | Énergie | Tours | Carnet | Fans |
|---|---|---|---|---|
| Étude | 1 | 1 | +1 titre trouvé | 0 |
| Single | 2 | 1 | aucun | selon le palier (v2) |
| Album (6 titres) | 3 | 1 (consommé à la fin) | aucun | la moitié du score |
| Concert (15 titres) | 4 | 1 (consommé à la fin) | aucun | 0 |
| Repos | 0 (+4 : énergie au maximum) | 1 | — | 0 |

L'énergie d'une sortie est prélevée dès le premier titre (un refus `NO_ENERGY` ne tire aucun titre). Le concert vide donc toute la jauge (max 4). Points par essai, grades et pools comme en v2 : carnet en priorité, puis discographie, aucun doublon dans une même sortie, doublons permis d'une sortie à l'autre. Les stats peuvent dépasser 300 (leurs bonus sont plafonnés, elles continuent de compter dans le score).

## SIF (finale)

- **50 titres**, mêmes points (100/70/50/35/25/0), maximum **5000**, mêmes grades. Aucun doublon.
- Se déclenche **uniquement en fin de carrière** : après le tour 50, si les conditions ci-dessous sont remplies. Il termine la carrière.
- **Conditions** (toutes) :
  - au moins **2 concerts** et **3 albums** sortis pendant la phase 3 ;
  - **2 concerts** et **2 albums** au-dessus de la moyenne, c'est-à-dire de grade **B ou mieux** (≥ 50 %, comme l'objectif de l'album).
- Sinon, la carrière est échouée au tour 50 : `failure: 'FINALE_GOALS'`. Les sorties en trop sont permises (on peut rejouer un album raté), l'énergie et les tours les limitent.

## Événements

Un événement applique un ou plusieurs **effets** et s'affiche dans le hub (carte + historique). Tous les éléments peuvent bouger, en positif comme en négatif :

| Effet | Détail |
|---|---|
| Stat | ± sur oreille, mémoire ou culture (plancher 0) |
| Malus temporaire de stat | −400 sur une stat au hasard pendant 5 tours ; la valeur effective peut devenir négative (plancher −100), ce qui retire une fonctionnalité (voir plus bas) |
| Énergie | ± (entre 0 et le maximum) |
| Fans | ± (plancher 0) |
| Carnet | + n titres non encore trouvés, ou − n titres du carnet (tirés au hasard ; tous s'il y en a moins) |
| Choix | le joueur choisit son gain (événement 10) |

### Déclencheurs

| Type | Règle | Peut ne pas se produire ? |
|---|---|---|
| **Tour fixe** | À un tour précis | Non |
| **Plage de tours** | Un tour tiré dans la plage à la création de la carrière (ex. entre les tours 32 et 34) | Non |
| **Stat au maximum** | Quand une stat atteint son maximum actuel (le dernier palier de bonus : oreille 300, mémoire 300, culture 200). Elle peut continuer de monter ensuite ; sa barre s'affiche alors pleine | Non : se produit dès que le maximum est atteint |
| **Seuil de fans** | Quand les FSI atteignent un seuil | Non |
| **Série de réponses** | 5 titres trouvés d'affilée en **étude ou single** (album, concert et SIF ne comptent pas et ne remettent pas la série à 0) ; un échec en étude ou single remet la série à 0 | Non |

Aucun tirage de probabilité : tous les événements se produisent. Le seul tirage est celui du tour d'un événement de plage (à la création de la carrière) et du titre retiré du carnet. Un événement de tour, de stat ou de fans ne se produit qu'**une fois** par carrière (au premier franchissement) ; l'événement de série se répète à chaque nouvelle série de 5. Les seuils de stat se jugent sur la valeur de base, pas sur la valeur avec malus temporaire. Un événement n'arrive jamais en plein round : il s'applique à la fin de l'action en cours (fin du tour, ou fin de la sortie d'album ou de concert). Un événement du tour 1 n'est pas possible (début de tour, à partir du tour 2).

### Efficacité d'une série
L'efficacité est la **somme** des points des 5 titres divisée par 100 (chaque titre vaut 1,0 à l'essai 1, 0,7 à l'essai 2, 0,5 à l'essai 3, 0,35, 0,25), **plafonnée à 4**. Cinq titres trouvés dès l'essai 1 (5,0) donnent donc 4 ; cinq titres à l'essai 3 donnent 2,5. La série repart ensuite à 0.

Effet de l'événement 10, **au choix du joueur** :
- **toutes les stats** (oreille, mémoire et culture, chacune) : +15 × efficacité (max 60 chacune), arrondi ;
- **l'énergie** : +1 × efficacité (max 4), arrondi, dans la limite de la jauge.

### Progression vers le négatif
Le signe et l'amplitude sont **fixés dans le catalogue** (pas de tirage) : les premiers événements sont favorables, ceux du tour 21 et après sont majoritairement défavorables.

### Malus temporaire (événement 4)
Une stat tirée au hasard parmi les trois (tirage injectable) perd 400 pendant 5 tours (du début du tour de l'événement jusqu'au début du tour 5 tours plus tard). La valeur effective peut devenir négative, avec un plancher de −100 ; la valeur de base n'est pas touchée et les gains d'étude pendant le malus s'y ajoutent. Elle ne devient négative que si sa valeur de base est inférieure à 400.

Une stat effective négative **déclenche la perte d'une fonctionnalité**, sous le niveau de départ :

| Stat | Effective < 0 |
|---|---|
| Oreille | le premier palier dure 0,5 s au lieu de 1 s |
| Culture | un seul essai (un seul palier) au lieu de 3 |
| Mémoire | plus aucune suggestion de recherche : le joueur doit saisir le titre exact |

**Titre saisi sans suggestion** : le serveur compare déjà le titre saisi sans casse ni accents (`songs.normalize` / `findByTitle` : « ete » = « Été »). Aucun changement de règle côté serveur, mais un test verrouille ce comportement (casse, accents) et le client, quand `suggestionCount` vaut 0, envoie le texte saisi tel quel à `/api/guess` au lieu d'exiger le choix d'une suggestion. Un titre inexact reste `UNKNOWN_TITLE` et ne consomme pas d'essai.

### Catalogue de départ
Chaque événement a un id technique (1, 2, 3…) et un texte bref provisoire. Les valeurs sont des constantes de `careerEvents.js`, à équilibrer après un premier essai.

| Id | Déclencheur | Effets | Texte provisoire |
|---|---|---|---|
| 1 | Plage tours 5-10 | Énergie +2 | « Énergie +2 » |
| 2 | Plage tours 15-20 | Carnet +1 titre | « Carnet +1 » |
| 3 | Plage tours 21-30 | Carnet −2 titres | « Carnet −2 » |
| 4 | Plage tours 31-40 | Une stat au hasard −400 pendant 5 tours (plancher effectif −100) | « <Stat> −400 pendant 5 tours » |
| 5 | Plage tours 45-50 | Carnet −5 titres | « Carnet −5 » |
| 6 | Oreille au maximum (300) | Culture +50 | « Culture +50 » |
| 7 | Mémoire au maximum (300) | Oreille +50 | « Oreille +50 » |
| 8 | Culture au maximum (200) | Mémoire +50 | « Mémoire +50 » |
| 9 | Fans ≥ 500 | Carnet +3 titres | « Carnet +3 » |
| 10 | Série de 5 titres trouvés (étude ou single) | Au choix : toutes les stats +15 × efficacité (max 60 chacune) ou énergie +1 × efficacité (max 4) | « Série ! » |
| 11 | Plage tours 30-50 | Une stat au hasard −400 pendant 5 tours (plancher effectif −100), comme l'événement 4 | « <Stat> −400 pendant 5 tours » |
| 12, 13, 14 | SIF : une piste tirée entre la 2e et la 25e | Une stat au hasard parmi celles qui ne sont pas déjà négatives −500 pendant 3 titres (plancher −100) ; sans effet s'il n'en reste aucune | « <Stat> −500 pendant 3 titres » |
| 15 | SIF : une piste tirée entre la 2e et la 25e | +15 s sur chaque essai (tous les paliers) pendant 3 titres | « Intro +15 s à chaque essai pendant 3 titres » |

Les stats forment un cycle : oreille → culture → mémoire → oreille (+100, soit un palier de bonus). Les plages des événements de tour sont tirées à la création de la carrière ; plusieurs événements peuvent tomber le même tour (par exemple les tours 45-50 avec un autre), ils s'affichent alors l'un après l'autre. Aucun événement de tour entre les tours 41 et 44 pour l'instant.

### Affichage
Quand une action déclenche un ou plusieurs événements, le hub affiche pour chacun une **image placeholder** (`web/public/career-event-placeholder.svg`), le **texte bref** dessous et un bouton **Continuer** ; une fois le dernier fermé, on revient au hub. Les effets sont déjà appliqués : l'affichage se fait côté client à partir de `career.newEvents` (renvoyé avec la réponse de l'action), l'historique complet reste dans `career.events`.

L'événement 10 fait exception : le joueur doit choisir son gain. Il reste **en attente côté serveur** (`career.pendingChoice { eventId, options }`) ; toute action répond `EVENT_PENDING` (409) tant que `POST /api/career/event/choice { option }` n'a pas été appelé. La carte affiche alors les boutons de choix à la place de « Continuer ».

### Barres de stats
La barre d'une stat s'affiche pleine dès qu'elle atteint son maximum actuel, même si la valeur continue de monter. Le serveur expose `career.statMax { oreille, memoire, culture }` (300, 300, 200). Une stat sous malus temporaire affiche sa valeur effective.

## Score de carrière
Somme, calculée côté serveur (`career.finalScore`) :

| Partie | Valeur |
|---|---|
| Album | points de l'album de la phase 1 (max 600) |
| Concert | points du concert de la phase 2 (max 1500) |
| Sorties | total des albums et concerts de la phase 3 |
| SIF | points du finale (max 5000, 0 si non joué) |
| Stats | total des trois stats |
| Fans | nombre de FSI |

Le SIF pèse beaucoup dans le total ; les poids sont à ajuster après un premier essai.

## Objectifs (hub)
Trois objectifs affichés l'un après l'autre, avec leur échéance en tours (v2) :
1. Album B+ (tour 10) ;
2. 750 FSI (tour 20) ;
3. Phase 3 : « Concert B+ x / 2 » puis, à la ligne, « Album B+ y / 2 » (tour 50).

## Approche technique

**Backend**
- `server/career.js` : phases (bornes et échéances en constantes), `state.sorties[]` (kind, score, grade : albums et concerts de la phase 3), `state.live` (sortie ou finale en cours, avec ses titres) et `state.finale`, `release` et `concert` restant l'album et le concert des phases 1 et 2, `isOver` et `careerScore` généralisés, actions à la demande de la phase 3, `finale` (50 titres), `failure: 'FINALE_GOALS'`.
- `server/careerEvents.js` (nouveau, logique pure) : catalogue déclaratif (ids 1 à 10), planification des tours de plage à la création, `applyDueEvents(state, random)` appelé à la fin d'une action, suivi de la série, `state.modifiers` (malus temporaires : `{ stat, delta, expiresAtTurn }`) lu par `roundTiers` / `suggestionCount` via une stat effective, `state.pendingChoice`. Tirage injectable (`random`) pour des tests déterministes.
- `server/careerRounds.js` : `startAlbum` / `startConcert` à la demande, `startFinale`, `publicCareer` expose `phase`, `objectives`, `releases`, `finale { done, total }`, `finaleResult`, `events`, `newEvents` (déclenchés par la dernière action).
- Routes : `POST /api/career/finale`, `POST /api/career/release` et `/concert` utilisables en phase 3. `POST /api/career/event/choice { option }`. Erreurs stables : `FINALE_DUE`, `FINALE_NOT_DUE`, `NO_ENERGY`, `EVENT_PENDING`, `INVALID_CHOICE`, `NO_PENDING_CHOICE`.

**Frontend** : `types.ts`, `api.ts`, `useCareer.ts`, `CareerObjective` (3 objectifs), `CareerHub` (actions de phase 3, récaps multiples), `CareerEvent` (nouveau : image placeholder, texte bref, bouton Continuer), `CareerScore`.

**Tests (TDD)** : `career.test.js`, `careerEvents.test.js`, `index.test.js`, `useCareer.test.ts`, `CareerHub.test.tsx`, `AppCareer.test.tsx`.

## Risques
- Le concert de la phase 2 n'est plus l'état final : le front et les tests v2 qui supposaient « concert ⇒ terminé » utilisent la fin du SIF (`finaleResult`) ou un échec.
- Un titre ajouté au carnet par un événement ne doit jamais être celui d'un round en cours : les événements s'appliquent hors round.
- Une stat effective négative doit être gérée explicitement par `roundTiers` et `suggestionCount` (règles du tableau du malus temporaire), pas par `Math.floor(valeur / 100)` : la mémoire passe à 0 suggestion, la culture à 1 seul palier, l'oreille réduit le premier palier à 0,5 s. Le client n'est plus limité aux suggestions quand il n'y en a plus.
- Retirer des titres du carnet réduit le pool préparé des albums, concerts et du SIF (50 titres uniques : la discographie de 64 titres complète le manque).
- Équilibrage : énergie des sorties, probabilité de négatif, poids du SIF ; tout est en constantes.

## Vérification
- `pnpm test` vert ; chaque nouveau test vu échouer avant l'implémentation.
- Carrière complète en jeu : album et concert débloqués au tour 21, un concert coûte 4 énergies, le SIF n'est proposé qu'après le tour 50 avec les conditions remplies, un événement de tour se produit toujours, une série de titres trouvés déclenche un événement positif.

## Ajustements de la v3 (après un premier essai)

- **Fans du premier concert** : 750 FSI au tour 20 (un album parfait en donne 300, il faut environ une douzaine de singles trouvés au premier essai, 40 chacun, avant et après l'album).
- **Événements de stat** : +50 au lieu de +100 (6 : culture, 7 : oreille, 8 : mémoire). Un deuxième malus de −400 sur 5 tours (événement 11) tombe entre les tours 30 et 50.
- **Événements du SIF** : les événements 12 à 15 se déclenchent avant une piste tirée au hasard entre la 2e et la 25e, et durent 3 titres (la piste de départ comprise). Le tirage est fait au démarrage du SIF ; la stat d'un malus est tirée parmi celles dont la valeur effective n'est pas déjà négative. Ils sont annoncés comme les autres événements.
- **Fenêtre d'événement** : elle liste aussi les titres gagnés par un gain de carnet (`career.newEvents[].gained`) et est plus grande.
- **Historique des sorties** : la colonne de gauche liste chaque album, concert et le SIF avec le tour où il a été joué (les sorties imposées des phases 1 et 2 sont datées 10 et 20).
- **Écran de devinage** : le carnet est affiché à gauche ; « Continuer » / « Titre suivant » passe sous « Valider » et la réponse s'affiche en plus petit, à droite.
