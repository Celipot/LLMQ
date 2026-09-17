# User Stories — LLMQ MVP (Étape 1)

Périmètre : une seule chanson fixe, backend Node.js/Express, pas de multijoueur, pas de bibliothèque réelle, pas de fonctionnalités sociales.

Légende priorité : **P0** = bloquant MVP (le jeu ne fonctionne pas sans), **P1** = confort/robustesse, souhaitable mais non bloquant.

---

## 1. Lecture audio progressive

### US-1.1 (P0) — Écouter l'intro selon le palier autorisé
En tant que **joueur**, je veux **écouter l'intro de la chanson du jour, coupée automatiquement à la durée autorisée pour ma tentative en cours**, afin de **deviner le titre sans jamais entendre plus que ce que le jeu autorise**.

**Critères d'acceptation :**
- Au premier essai, la lecture s'arrête automatiquement à 1 seconde.
- Après chaque essai raté ou skip, la durée autorisée passe au palier suivant (1s → 2s → 4s → 7s → 11s → 16s).
- Le client ne peut pas obtenir, via `GET /audio/track`, un flux audio dépassant la durée autorisée pour l'état courant de la partie (le serveur tronque/limite côté back, pas seulement côté lecteur front).
- Rejouer un essai déjà autorisé (ex. re-cliquer play) rejoue depuis le début, dans la limite du palier déjà atteint, sans consommer un nouvel essai.
- Si la partie est terminée (victoire ou 6 essais épuisés), la lecture complète de la piste devient disponible.

### US-1.2 (P0) — Voir le contrôle de lecture reflétant le palier actuel
En tant que **joueur**, je veux **voir clairement combien de secondes je peux écouter à l'essai courant**, afin de **comprendre l'état du jeu avant de lancer la lecture**.

**Critères d'acceptation :**
- L'interface affiche la durée du palier courant (ex. "0:04" pour le 3e essai) avant et pendant la lecture.
- La durée affichée correspond exactement à la valeur renvoyée par `GET /api/state`.

### US-1.3 (P1) — Visualiser la progression de lecture
En tant que **joueur**, je veux **voir une barre ou un indicateur de progression pendant la lecture de l'extrait**, afin de **savoir où j'en suis dans l'écoute**.

**Critères d'acceptation :**
- Un indicateur visuel progresse en temps réel entre 0 et la durée autorisée.
- L'indicateur se réinitialise à chaque nouvelle lecture.

---

## 2. Recherche et autocomplétion de titre

### US-2.1 (P0) — Rechercher un titre parmi les titres jouables
En tant que **joueur**, je veux **taper les premières lettres d'un titre dans une barre de recherche et voir des suggestions filtrées**, afin de **retrouver rapidement le titre exact sans dépendre de l'orthographe parfaite**.

**Critères d'acceptation :**
- `GET /api/titles` renvoie la liste des titres jouables (au MVP : liste à un seul élément, mais l'API doit être conçue pour en supporter plusieurs).
- La saisie d'une sous-chaîne filtre les suggestions de façon insensible à la casse et aux accents.
- Aucune suggestion n'apparaît pour une saisie vide.
- La liste de titres ne contient jamais d'information sur la chanson correcte au-delà du fait qu'elle est "jouable" (pas de flag ni d'ordre révélateur).

### US-2.2 (P0) — Sélectionner une suggestion
En tant que **joueur**, je veux **cliquer ou naviguer au clavier vers une suggestion pour la sélectionner**, afin de **pré-remplir mon guess sans faute de frappe**.

**Critères d'acceptation :**
- Sélectionner une suggestion remplit le champ de saisie avec le titre exact.
- La navigation au clavier (flèches haut/bas + Entrée) permet de sélectionner une suggestion.
- La sélection ne soumet pas automatiquement le guess (une action explicite reste nécessaire, cf. US-3.1).

---

## 3. Soumission d'un guess

### US-3.1 (P0) — Soumettre une tentative
En tant que **joueur**, je veux **soumettre le titre saisi comme tentative**, afin de **savoir si j'ai deviné la bonne chanson**.

**Critères d'acceptation :**
- `POST /api/guess` accepte un titre et renvoie si la tentative est correcte ou non, sans jamais renvoyer le titre correct en cas d'échec.
- Une tentative correcte termine la partie en victoire et incrémente le compteur d'essais utilisés.
- Une tentative incorrecte incrémente le compteur d'essais utilisés et débloque le palier de durée suivant.
- Soumettre un titre absent de la liste des titres jouables (`GET /api/titles`) est rejeté avec un message d'erreur clair, sans consommer d'essai.
- Une tentative ne peut pas être soumise si la partie est déjà terminée (victoire ou 6 essais épuisés) ; le serveur renvoie une erreur explicite.
- Le serveur est la seule source de vérité sur la validité du guess (aucune logique de comparaison de titre côté client).

### US-3.2 (P0) — Voir le résultat immédiat de sa tentative
En tant que **joueur**, je veux **voir immédiatement si ma tentative est correcte ou non**, afin de **savoir si je dois continuer à jouer**.

**Critères d'acceptation :**
- Un retour visuel distinct apparaît pour une tentative correcte vs incorrecte.
- L'historique des tentatives précédentes (titres essayés, corrects/incorrects) reste visible pendant la partie.

---

## 4. Skip

### US-4.1 (P0) — Passer un essai sans proposer de titre
En tant que **joueur**, je veux **skip un essai quand je n'ai pas d'idée**, afin de **débloquer plus de secondes d'écoute sans être obligé de deviner au hasard**.

**Critères d'acceptation :**
- `POST /api/skip` incrémente le compteur d'essais utilisés et débloque le palier de durée suivant, comme une tentative incorrecte.
- Un skip n'est pas comptabilisé comme une tentative de titre dans l'historique des guesses (il est distingué visuellement, ex. "Skip" au lieu d'un titre).
- Skip au 6e essai termine la partie en défaite et révèle la réponse (cf. section 5).
- Le skip est impossible si la partie est déjà terminée.

---

## 5. Fin de partie

### US-5.1 (P0) — Voir la réponse à la fin de la partie
En tant que **joueur**, je veux **voir le titre correct une fois la partie terminée (victoire ou 6 essais épuisés)**, afin de **savoir quelle était la chanson**.

**Critères d'acceptation :**
- `GET /api/state` inclut le titre correct uniquement quand la partie est terminée (victoire ou défaite).
- Avant la fin de partie, aucune réponse de l'API (état, guess, skip) ne contient le titre correct ni d'information permettant de le déduire directement (ex. nom de fichier audio explicite).
- L'interface affiche clairement le résultat final (victoire/défaite) et le titre correct.
- L'audio complet de la piste devient accessible via `GET /audio/track` une fois la partie terminée.

### US-5.2 (P1) — Voir un résumé de la partie terminée
En tant que **joueur**, je veux **voir un récapitulatif du nombre d'essais utilisés et des tentatives faites**, afin de **avoir une vision claire de ma performance sur cette partie**.

**Critères d'acceptation :**
- Le résumé affiche le nombre d'essais utilisés sur 6.
- Le résumé liste les tentatives faites dans l'ordre (y compris les skips).

---

## 6. Réinitialisation pour le développement

### US-6.1 (P0) — Réinitialiser l'état de la partie
En tant que **développeur**, je veux **réinitialiser l'état de la partie via une route dédiée**, afin de **retester le flux complet du jeu sans redémarrer le serveur**.

**Critères d'acceptation :**
- `POST /api/reset` remet le compteur d'essais à 0, vide l'historique des tentatives, et restaure le palier de durée initial (1s).
- Après reset, `GET /api/state` ne contient plus le titre correct ni d'indication de fin de partie.
- Après reset, `GET /audio/track` limite de nouveau la lecture au premier palier (1s).
- La route reset n'a pas besoin d'authentification pour cette étape (usage dev uniquement), mais devra être protégée/retirée avant tout déploiement multi-utilisateur (noté comme limitation connue).

---

## Résumé des priorités

| Story | Fonctionnalité | Priorité |
|---|---|---|
| US-1.1 | Lecture limitée au palier | P0 |
| US-1.2 | Affichage du palier courant | P0 |
| US-1.3 | Barre de progression | P1 |
| US-2.1 | Recherche/filtrage des titres | P0 |
| US-2.2 | Sélection d'une suggestion | P0 |
| US-3.1 | Soumission d'un guess | P0 |
| US-3.2 | Retour immédiat sur la tentative | P0 |
| US-4.1 | Skip d'un essai | P0 |
| US-5.1 | Révélation de la réponse en fin de partie | P0 |
| US-5.2 | Résumé de fin de partie | P1 |
| US-6.1 | Réinitialisation dev | P0 |
