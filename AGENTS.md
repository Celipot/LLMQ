# AGENTS.md

Guide pour les agents/contributeurs travaillant sur LLMQ. Pour le setup et les commandes, voir [`README.md`](README.md). Pour le périmètre fonctionnel, voir [`us/user-stories-mvp.md`](us/user-stories-mvp.md).

## Aperçu

Jeu quotidien où le joueur écoute l'intro d'une chanson (coupée à une durée croissante à chaque essai) et doit deviner le titre en 6 essais maximum. Étape MVP : une seule chanson fixe, pas de multijoueur, pas de bibliothèque réelle.

## Structure du dépôt

```
server/          Backend Express (JS, CommonJS)
  index.js          Routes API, sert public/ en statique
  gameState.js      State machine de la partie en mémoire (paliers, essais, victoire/défaite)
  songs.js          Chargement/recherche des titres jouables
  wavTruncate.js    Découpe la piste WAV au nombre de secondes autorisé

web/             Frontend (Vite + React + TypeScript)
  src/api.ts        Client fetch typé pour le contrat API
  src/types.ts      Types miroir des réponses serveur
  src/hooks/        Logique d'état et de lecture audio (useGameState, useAudioPlayer)
  src/components/   Composants de présentation (Player, Pips, SearchAutocomplete, History, Result, ShinyText)
  vite.config.ts    Proxy dev vers Express, build vers ../public

data/            Données jouables
  songs.json        Bibliothèque de titres
  audio/            Fichiers audio (WAV PCM requis, voir contraintes ci-dessous)

scripts/         Utilitaires ponctuels (génération audio placeholder)
public/          Généré par `npm run build` — ne pas éditer à la main
us/, prompt/     Documentation produit (user stories, contexte projet)
```

## Standards de code

### Backend (`server/`)
- JavaScript CommonJS, pas de TypeScript, pas de framework de validation — validation manuelle explicite aux frontières des routes.
- Le serveur est la seule source de vérité : jamais de logique de comparaison/validation dupliquée côté client, jamais de titre correct renvoyé avant la fin de partie.
- Un fichier = une responsabilité (state machine, accès données, utilitaire audio, routes séparés).
- Erreurs renvoyées comme `{ error: 'CODE' }` avec des codes stables (`UNKNOWN_TITLE`, `GAME_FINISHED`, etc.), pas de messages libres à parser côté client.

### Frontend (`web/`)
- TypeScript, types partagés dans `types.ts` en miroir manuel des réponses serveur (pas de génération de schéma).
- Logique (fetch, state, effets) dans des hooks custom (`hooks/`), composants (`components/`) purement présentationnels.
- Pas de librairie de state management externe — `useState`/hooks custom suffisent à ce stade.
- Un composant = un fichier, nommage `PascalCase.tsx`.

### Général
- Pas de commentaires expliquant le "quoi" (le code doit être lisible seul) — uniquement le "pourquoi" quand une contrainte n'est pas évidente (ex. format audio, ordre d'opérations).
- Pas d'abstraction ou de configuration anticipée pour des besoins hypothétiques.
- Pas de renommage de compatibilité, pas de code mort laissé "au cas où".

## Standards de tests

Aucun framework de test n'est encore en place dans le dépôt (`package.json` et `web/package.json` n'ont pas de script `test`). Quand des tests sont ajoutés, suivre ces conventions :

### Backend (`server/`)
- `node:test` (module natif, aucune dépendance à ajouter) + `node:assert`.
- Un fichier de test par module (`server/gameState.test.js`, `server/wavTruncate.test.js`, etc.), colocalisé avec le fichier testé.
- Les routes s'testent via des appels HTTP réels sur une instance Express démarrée pour le test (pas de mock du framework), en appelant `POST /api/reset` avant chaque cas pour repartir d'un état propre — cohérent avec le fait que le serveur est la seule source de vérité (voir Standards de code).
- Prioriser les cas couverts par `us/user-stories-mvp.md` (paliers audio, rejet de titre inconnu, fin de partie, etc.) plutôt que des tests unitaires déconnectés du comportement observable.

### Frontend (`web/`)
- Vitest (intégration native avec Vite, pas de config séparée à maintenir) + React Testing Library pour les composants.
- Un fichier de test à côté du composant/hook testé (`Player.test.tsx`, `useGameState.test.ts`).
- Tester le comportement observable (rendu, interactions clavier/souris, appels à l'API mockée) plutôt que les détails d'implémentation internes des hooks.
- Mocker uniquement la couche `api.ts` (fetch), jamais la logique métier elle-même.

### Général
- Un test doit échouer pour une seule raison identifiable ; éviter les tests qui vérifient plusieurs comportements indépendants à la fois.
- Ne pas écrire de test pour un cas qui ne peut pas se produire (cohérent avec "pas de validation pour des scénarios impossibles").

## Contraintes techniques notables

- **Audio WAV PCM obligatoire** : la troncature par palier se fait par découpe d'octets dans le chunk `data` (`server/wavTruncate.js`), sans ré-encodage. Un format compressé (MP3, etc.) nécessiterait une étape de décodage avant de pouvoir réutiliser cette approche.
- **Contrat API stable** : `GET /api/state`, `GET /api/titles`, `GET /audio/track`, `POST /api/guess`, `POST /api/skip`, `POST /api/reset` — le frontend `web/` en dépend directement via `src/api.ts`. Toute modification de forme de réponse doit être répercutée des deux côtés.
- **`/api/reset` non authentifié** : usage dev uniquement, limitation connue à traiter avant tout déploiement multi-utilisateur.
