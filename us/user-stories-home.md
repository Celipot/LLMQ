# User Stories — Page d'accueil & choix de mode

Périmètre : ajout d'une page d'accueil proposant deux modes d'entrée dans le jeu. Toujours pas de vraie bibliothèque de chansons (`data/songs.json` reste tel quel pour l'instant) — le mode Liste doit fonctionner quel que soit le nombre de titres disponibles (1 à N), sans qu'une extension du catalogue soit requise pour cette étape.

Légende priorité : **P0** = bloquant, **P1** = confort/robustesse, souhaitable mais non bloquant.

---

## 1. Page d'accueil

### US-H1.1 (P0) — Choisir un mode de jeu depuis l'accueil
En tant que **joueur**, je veux **arriver sur une page d'accueil proposant deux modes ("Aléatoire" et "Liste")**, afin de **choisir comment je veux démarrer une partie**.

**Critères d'acceptation :**
- La page d'accueil est le point d'entrée par défaut de l'application (avant toute partie en cours).
- Deux options clairement identifiées et cliquables : "Mode Aléatoire" et "Mode Liste".
- Sélectionner un mode navigue vers l'écran correspondant sans recharger l'état d'une partie précédente non liée à ce mode.
- Si une partie est déjà en cours (non terminée) dans un mode, la revisite de l'accueil ne la perd pas silencieusement (cf. US-H1.2).

### US-H1.2 (P1) — Revenir à l'accueil sans perdre une partie en cours
En tant que **joueur**, je veux **pouvoir revenir à l'accueil pendant une partie sans que ma progression soit perdue si je reviens ensuite au même mode/chanson**, afin de **explorer les deux modes sans crainte de perdre mes essais**.

**Critères d'acceptation :**
- Un lien/bouton "Accueil" est visible pendant une partie.
- Revenir à l'accueil puis rechoisir le même mode (et, en mode Liste, la même chanson) restaure l'état de la partie en cours (essais utilisés, palier, historique).
- Cette persistance reste limitée à la session serveur en mémoire (pas de nouvelle contrainte de stockage durable à ce stade).

---

## 2. Mode Aléatoire

### US-H2.1 (P0) — Lancer une partie sur une chanson aléatoire
En tant que **joueur**, je veux **démarrer une partie sur une chanson piochée aléatoirement parmi les titres jouables**, afin de **rejouer le fonctionnement actuel du jeu sans avoir à choisir moi-même le titre**.

**Critères d'acceptation :**
- Depuis l'accueil, choisir "Mode Aléatoire" démarre immédiatement une partie sur un titre tiré aléatoirement parmi `GET /api/titles`.
- Le comportement de jeu (paliers, essais, guess, skip, fin de partie) reste strictement identique à l'existant (US-1.x à US-5.x de `user-stories-mvp.md`).
- Avec un seul titre disponible dans le catalogue, ce mode reste fonctionnel : la "chanson aléatoire" est alors systématiquement l'unique titre.
- Relancer le Mode Aléatoire après une partie terminée démarre une nouvelle partie (nouveau tirage si plusieurs titres existent).

---

## 3. Mode Liste

### US-H3.1 (P0) — Voir la liste des chansons disponibles
En tant que **joueur**, je veux **voir, sur la gauche de l'écran, la liste de toutes les chansons jouables**, afin de **choisir moi-même sur quel titre faire le quizz**.

**Critères d'acceptation :**
- La liste affiche tous les titres renvoyés par `GET /api/titles` (aucune information sur la réponse correcte au-delà du titre lui-même, cf. US-2.1 de `user-stories-mvp.md`).
- La liste reste utilisable et lisible avec un seul titre comme avec plusieurs.
- L'état d'avancement d'une chanson déjà commencée ou terminée est visuellement distingué dans la liste (ex. badge "en cours" / "terminé"), sans révéler le titre correct avant la fin de la partie correspondante.

### US-H3.2 (P0) — Démarrer le quizz sur une chanson choisie
En tant que **joueur**, je veux **cliquer sur une chanson de la liste pour démarrer (ou reprendre) le quizz sur celle-ci**, afin de **jouer spécifiquement le titre qui m'intéresse**.

**Critères d'acceptation :**
- Cliquer sur un titre non commencé démarre une nouvelle partie sur ce titre précis (paliers, essais, historique initialisés comme en US-6.1).
- Cliquer sur un titre dont une partie est déjà en cours reprend cette partie à l'état où elle en était (pas de réinitialisation).
- Cliquer sur un titre dont la partie est terminée affiche le résultat final (victoire/défaite, réponse) comme en US-5.1, sans consommer de nouvel essai.
- Le serveur reste seul responsable de savoir quelle chanson est jouée pour la partie affichée ; le client ne peut pas déduire ou influencer le choix du titre correct autrement qu'en cliquant sur un élément de la liste.

### US-H3.3 (P1) — Distinguer visuellement la chanson active dans la liste
En tant que **joueur**, je veux **voir en surbrillance la chanson actuellement affichée dans le quizz**, afin de **savoir à tout moment sur quel titre je suis en train de jouer**.

**Critères d'acceptation :**
- L'élément de liste correspondant à la partie affichée est visuellement distinct des autres (ex. fond ou bordure différente).
- Ce marquage se met à jour immédiatement après avoir cliqué sur un autre titre de la liste.

---

## Résumé des priorités

| Story | Fonctionnalité | Priorité |
|---|---|---|
| US-H1.1 | Choix du mode depuis l'accueil | P0 |
| US-H1.2 | Retour à l'accueil sans perte de progression | P1 |
| US-H2.1 | Lancement d'une partie en mode Aléatoire | P0 |
| US-H3.1 | Affichage de la liste des chansons | P0 |
| US-H3.2 | Démarrage/reprise du quizz depuis la liste | P0 |
| US-H3.3 | Mise en surbrillance de la chanson active | P1 |
