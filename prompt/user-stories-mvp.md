## Prompt pour l'agent

Tu es chargé de rédiger les user stories pour la première étape d'un projet appelé "LLMQ". Voici le contexte complet :

**Contexte du projet** : On reproduit en local, dans un projet minimal, le mécanisme central du site https://llheardle.suyo.be/ — un jeu quotidien type Heardle où le joueur écoute l'intro d'une chanson et doit en deviner le titre. À chaque tentative ratée ou skip, davantage de secondes de l'intro sont révélées (paliers : 1s, 2s, 4s, 7s, 11s, 16s, sur 6 essais maximum).

**Portée de cette première étape (MVP)** :
- Backend Node.js + Express (choisi car du multijoueur est prévu à terme — pas implémenté maintenant, mais l'architecture doit s'y prêter).
- Une seule chanson fixe, définie dans un fichier JSON (`data/songs.json`), avec un fichier audio placeholder (les vrais fichiers audio seront fournis plus tard par l'utilisateur).
- Le serveur détient le titre correct et ne le révèle jamais au client avant la fin de partie (victoire ou 6 essais épuisés).
- Le client peut : lancer la lecture (coupée automatiquement à la durée autorisée), saisir un titre dans une barre de recherche avec autocomplétion (basée sur la liste des titres jouables), soumettre un guess, skip un essai, voir sa progression (pastilles de tentatives), et voir la réponse à la fin de la partie.
- Routes API prévues : `GET /api/state`, `GET /api/titles`, `GET /audio/track`, `POST /api/guess`, `POST /api/skip`, `POST /api/reset`.
- Hors périmètre pour cette étape : vraie bibliothèque de chansons, multijoueur effectif, liens Spotify/YouTube, statistiques persistantes.

**Ta tâche** : Rédige un ensemble de user stories (format "En tant que [rôle], je veux [action], afin de [bénéfice]") couvrant cette première étape uniquement. Découpe-les par fonctionnalité (lecture audio progressive, recherche/autocomplétion, soumission de guess, skip, fin de partie, réinitialisation pour le dev). Pour chaque story, ajoute des critères d'acceptation clairs et testables. Priorise-les si pertinent (MVP bloquant vs. confort). Ne sors pas du périmètre défini ci-dessus — pas de multijoueur, pas de vraie bibliothèque de chansons, pas de fonctionnalités sociales.
