# Planning — Mode Carrière (personnage : Ayumu Uehara)

Statut : **réflexion / planning du mode complet.** Une première version simplifiée est développée et spécifiée dans [`carriere-v1.md`](carriere-v1.md) : 10 tours d'études et de repos, 3 stats, puis la sortie d'un album de 6 titres avec un score et un grade. Elle diffère de ce document (pas de saisons, de fans, d'objectifs, de Moral, de finale ni de Discographie) ; ces éléments restent à décider ci-dessous. Les chiffres (nombre de tours, gains de fans, seuils) sont des points de départ à équilibrer.

Inspiration : le mode « scénario » d'Uma Musume (suivre la carrière d'un personnage sur des tours, s'entraîner entre deux courses, atteindre des objectifs). Socle de gameplay : le round LLMQ (deviner une chanson à partir d'une intro qui s'allonge, 6 étapes).

Périmètre de cette première version : **un seul personnage, Ayumu Uehara** (CV Aguri Onishi, Nijigasaki, unité A・ZU・NA), pour valider la boucle avant tout élargissement.

---

## 1. Le matériau disponible (mesuré sur `data/songs.json`)

| Catégorie | Titres | Détail |
|---|---|---|
| Solos d'Ayumu (crédit nominatif) | 10 | Awakening Promise, Break The System, Dream with You, Kaika Sengen, Say Good-Bye Namida, Yume e no Ippo, Walking Dream, Stellar Stream, The Sweetest Time♡, secret |
| Unité A・ZU・NA | 13 | Cheer for you!!, Dream Land! Dream World!, Folklore ~Kanki no Uta~, Happy Nyan! Days, Kakushiaji!, Maze Town, Infinity! Our wings!!, Poker face & Onegai! Fairy, Romance no Naka de, Blue!, Dancing in the Light, Monochrome Labyrinth, Jungle Hunter♡ |
| Groupe Nijigasaki | 41 | Hurray Hurray, Just Believe!!!, Nijiiro Passions!, TOKIMEKI Runners, … |
| Crossovers touchant Nijigasaki | 6 | facultatifs, laissés de côté dans la première version |

Le **répertoire jouable** de la carrière compte donc **64 titres** (10 + 13 + 41).

Limites des données :
- **Pas de chronologie** : aucune date de sortie, et l'ordre des `id` n'est pas chronologique. Retracer une discographie demande une chronologie fournie à la main.
- **Pas de liste de membres par unité** : les membres de A・ZU・NA ne figurent pas dans la base (de mémoire : Ayumu, Shizuku, Setsuna, à confirmer).
- **Pas d'illustration de personnage** : le portrait sera la cover d'un de ses solos.

---

## 2. Principe

On suit la carrière d'Ayumu en 3 saisons. Entre les sorties, on **étudie** son répertoire pour apprendre à reconnaître ses titres. À chaque **sortie**, un round LLMQ complet met cette connaissance à l'épreuve. Les fans gagnés font avancer les objectifs, jusqu'à la finale et à la discographie complète.

Correspondance avec Uma Musume :

| Uma Musume | Mode Carrière |
|---|---|
| Course programmée | **Sortie** : round LLMQ complet sur un titre de sa discographie |
| Entraînement | **Étude** : mini-round qui fait apprendre un titre et monte une stat |
| Stats | **Oreille, Mémoire, Culture, Souffle** |
| Énergie / Motivation | **Énergie** et **Moral** |
| Objectifs avec échéance | **Objectifs de saison** (fans, rang minimum) |
| Fans | **Fans**, gagnés à chaque sortie selon le rang |
| Note finale | **Grade final** |

---

## 3. Déroulé d'une carrière (24 tours)

| Saison | Tours | Sorties (type visible, titre masqué) | Objectif de fin de saison |
|---|---|---|---|
| **1 · Débuts** | 1-8 | T3 groupe, T6 groupe, T8 premier solo | 100 fans, rang C minimum sur le solo |
| **2 · Ascension** | 9-16 | T11 A・ZU・NA, T14 A・ZU・NA, T16 solo | 500 fans, rang B minimum sur une sortie A・ZU・NA |
| **3 · Sommet** | 17-24 | T19 solo, T21 A・ZU・NA, T23 solo, **T24 finale : setlist de 3 titres de groupe** | 1 200 fans, finale jouée |

Soit 10 sorties et une finale (environ 13 rounds au total). Durée visée : 30 à 40 minutes.

### Un tour

L'écran montre le calendrier, l'objectif en cours, les jauges (Énergie, Moral), les stats et les fans. Le joueur choisit :

- **Étude** (coûte de l'énergie) : un titre du répertoire à venir est tiré. Mini-round de 3 essais dont le but est d'apprendre : le titre et la cover s'ajoutent au **Carnet** quand il est trouvé, et une stat monte. Le joueur ne sait pas quand ce titre sortira.
- **Repos** : récupère de l'énergie.
- **Sortie en ville** : remonte le Moral.
- Sur un tour de sortie, l'action est imposée : le round de sortie.

### La sortie (round complet)

- Round LLMQ habituel : 6 étapes, l'intro s'allonge, un seul titre correct.
- Le **type** de la sortie est visible (solo, A・ZU・NA, groupe), pas le titre (voir décision 1).
- **Rang** selon l'étape à laquelle le titre est trouvé : **S** à la 1re, puis A, B, C, échec si non trouvé.
- Gain de fans selon le rang, modulé par le Moral (bas ×0,8, normal ×1, haut ×1,2).
- Le titre trouvé rejoint le Carnet.

### Stats

Elles changent l'aide dont dispose le joueur, pas les règles du round.

| Stat | Effet aux paliers |
|---|---|
| **Oreille** | l'intro de départ est plus longue |
| **Mémoire** | nombre d'indices utilisables (génération, unité, initiale du titre) |
| **Culture** | l'autocomplétion se limite au type de la sortie : 10 titres pour un solo, 13 pour A・ZU・NA, 41 pour le groupe |
| **Souffle** | un essai de plus sur les sorties importantes |

### Objectifs, finale, récompense

- Un objectif de saison raté termine la carrière (voir décision 3).
- **Finale** : 3 sorties d'affilée sur des titres de groupe. Le **grade final** (S à D) dépend des fans et des rangs.
- **Récompense** : la page **Discographie** (64 emplacements, avec cover, titre et liens d'écoute déjà présents dans `listenOn`) se remplit au fil des carrières.

---

## 4. Volontairement hors de cette première version

Événements narratifs avec partenaire, héritage entre carrières, autres personnages, multijoueur.

---

## 5. À préparer avant tout développement

1. **Chronologie** : ordre de sortie (ou dates) des 10 solos et des 13 titres A・ZU・NA ; choix des titres de groupe (parmi les 41) retenus pour les sorties de groupe et la finale.
2. **Titres de départ** : lesquels sont déjà « connus » au tour 1 (proposition : 5 titres de groupe).
3. **Membres de A・ZU・NA** : à confirmer.
4. **Portrait** : quelle cover de solo sert de portrait.

---

## 6. Décisions ouvertes

- [ ] **1. Titres des sorties masqués, type visible.** Recommandé : afficher le titre à l'avance donnerait la réponse du round.
- [ ] **2. L'étude est un mini-round qui révèle un titre du répertoire.** C'est la mécanique centrale, qui donne du sens à la « discographie » comme progression : à valider.
- [ ] **3. Échec d'un objectif** : fin de carrière immédiate (comme Uma Musume) ou une seconde chance par carrière.
- [ ] **4. Durée visée** : 30 à 40 minutes convient-elle, ou faut-il une carrière plus courte ?

---

## 7. Découpage pressenti (pour plus tard)

1. Données d'Ayumu (chronologie validée, titres de départ, portrait).
2. Boucle de base : sorties, rang, fans, objectifs.
3. Études, Énergie, Moral et stats.
4. Finale, grade, Carnet et page Discographie.
5. Ensuite seulement : partenaire et événements, héritage, autres personnages.

Contraintes techniques déjà identifiées : l'état de carrière est côté serveur (le serveur reste la source de vérité et n'envoie jamais le titre d'une sortie avant la fin de son round), il réutilise le moteur de round existant (`server/gameState.js`), et les runs sont en mémoire comme les parties multijoueur (perdus au redémarrage du conteneur).
