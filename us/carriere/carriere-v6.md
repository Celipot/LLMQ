# Mode Carrière v6 : correctifs et rééquilibrage

## Principe

Un correctif d'affichage de l'objectif de la 3e phase, un nerf de l'événement de série, un carnet qui se renouvelle, et une 3e phase raccourcie à 20 tours.

## Objectif de la 3e phase

Le serveur exige, pour le SIF, un nombre de concerts et d'albums **joués** (`required`) dont un nombre au grade de l'objectif (`requiredGood`). L'écran n'affichait que `good / requiredGood` : l'objectif semblait rempli alors que la carrière échouait en `FINALE_GOALS`.

- L'objectif affiche les deux compteurs : joués `done / required` et réussis `good / requiredGood`, pour les concerts et les albums. Les chiffres viennent de `career.finaleGoals`, jamais recalculés côté client.

## Événement de série (id 10)

- Il ne se déclenche qu'**une fois** par carrière (`firedEvents` contient 10 dès que le choix est proposé) ; ensuite la série n'est plus comptée.
- Récompenses réduites : 10 stats par point d'efficacité (max 40), efficacité plafonnée à 3 (énergie max 3).

## Carnet

- Les études et les singles tirent dans tout le pool, carnet compris.
- Une étude où l'on retrouve un titre du carnet le **sort du carnet** : il redevient un titre comme les autres du pool. Une étude ratée ne change pas le carnet. Un single ne touche jamais au carnet.
- Albums, concerts et SIF tirent toujours la moitié de leurs titres dans le carnet. Les événements « Carnet +N » tirent toujours hors carnet.

## 3e phase : tours 21 à 40

- `FINAL_TURN = 40` : la phase dure 20 tours, le SIF est dû après le tour 40 (`career.finalTurn` = 40).
- Fenêtres des événements de la phase (tous dans 21 à 40) :

| Événement | Fenêtre |
|---|---|
| 3 (carnet −2) | 21 à 28 |
| 4 (malus de stat) | 26 à 34 |
| 5 (carnet −5) | 35 à 40 |
| 11 (2e malus de stat) | 30 à 40 |

## Tests

- `career.test.js` : carnet (sortie, ratée, single), tirage uniforme, `FINAL_TURN`.
- `careerEvents.test.js` : fenêtres, série unique et plafonds.
- Front : objectif avec les compteurs joués / réussis.
