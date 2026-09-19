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
  avatars.js        Validation des photos de profil (PNG/JPEG/WebP, 64 Ko, signature vérifiée, pas de SVG)
  songPicker.js     Pondération du tirage solo adaptatif (réussite, étape, récence) et validation de l'historique client
  wavTruncate.js    Découpe la piste WAV au nombre de secondes autorisé

web/             Frontend (Vite + React + TypeScript)
  src/api.ts        Client fetch typé pour le contrat API
  src/types.ts      Types miroir des réponses serveur
  src/hooks/        Logique d'état et de lecture audio (useGameState, useAudioPlayer, useGenerationOptions, useSongHistory, useProfile)
  src/components/   Composants de présentation (Player, Pips, SearchAutocomplete, History, Result, ShinyText, GenerationFilter, RandomSetup, ProfileEditor, PlayerAvatar)
  vite.config.ts    Proxy dev vers Express, build vers ../public

data/            Données jouables
  songs.json        Bibliothèque de titres (champ `generation` : µ's, Aqours, Nijigasaki, Liella,
                    Hasunosora, Ikizulive, Musical, ou CrossGen si plusieurs séries)
  audio/            Fichiers audio (WAV PCM requis, voir contraintes ci-dessous)

scripts/         Utilitaires ponctuels (génération audio placeholder, scraper, `tag-generations.js`
                 qui remplit `generation` — à relancer après un scrape, qui régénère songs.json)
public/          Généré par `pnpm run build` — ne pas éditer à la main
us/, prompt/     Documentation produit (user stories, contexte projet)

pnpm-workspace.yaml   Déclare web/ comme package du workspace — un seul `pnpm install`
                      à la racine installe les deux (npm reste utilisable en parallèle,
                      mais nécessite deux `install` séparés : racine et web/).
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

```bash
pnpm test          # backend (node:test) puis frontend (vitest)
pnpm run test:server
pnpm run test:web
```

### Backend (`server/`)
- `node:test` (module natif, aucune dépendance ajoutée) + `node:assert/strict`.
- Un fichier de test par module, colocalisé avec le fichier testé : `gameState.test.js`, `songs.test.js`, `wavTruncate.test.js` (logique pure) et `index.test.js` (routes).
- `index.js` exporte l'app Express sans appeler `listen()` quand il est chargé via `require` (`require.main === module` guard) — c'est ce qui permet à `index.test.js` de démarrer une instance sur un port éphémère plutôt que de dépendre du port 3000.
- Les routes se testent via de vrais appels HTTP (`fetch`) sur cette instance, jamais de mock du framework Express, en appelant `POST /api/reset` avant chaque cas (`beforeEach`) pour repartir d'un état propre — cohérent avec le fait que le serveur est la seule source de vérité.
- Les cas couvrent le comportement décrit dans `us/user-stories-mvp.md` (paliers audio, rejet de titre inconnu sans consommer d'essai, fin de partie qui révèle la réponse, `/api/reset`) plutôt que des détails d'implémentation.

### Frontend (`web/`)
- Vitest (config dans `vite.config.ts`, bloc `test`, environnement `jsdom`) + React Testing Library + `@testing-library/user-event`. Setup global (`jest-dom` matchers) dans `src/test/setup.ts`.
- Un fichier de test à côté du composant/hook testé : `Pips.test.tsx`, `History.test.tsx`, `SearchAutocomplete.test.tsx`, `useGameState.test.ts`.
- Tester le comportement observable (rendu, interactions clavier/souris, appels à l'API mockée) plutôt que les détails d'implémentation internes des hooks.
- Mocker uniquement la couche `api.ts` (`vi.mock('../api', ...)`), jamais la logique métier elle-même — voir `useGameState.test.ts` pour le pattern (mock partiel qui garde `ApiError` réel).

### Général
- Un test doit échouer pour une seule raison identifiable ; éviter les tests qui vérifient plusieurs comportements indépendants à la fois.
- Ne pas écrire de test pour un cas qui ne peut pas se produire (cohérent avec "pas de validation pour des scénarios impossibles").

### TDD
- Pour toute nouvelle fonctionnalité ou correction de bug, écrire le test qui décrit le comportement attendu avant d'écrire le code qui le satisfait : test rouge → implémentation minimale → test vert → refactor si besoin.
- Le test doit échouer pour la bonne raison avant l'implémentation (vérifier qu'il échoue, pas juste supposer qu'il le ferait) ; un test qui passe déjà avant tout code n'a rien vérifié.
- S'appuyer sur les user stories (`us/*.md`) pour dériver les cas de test avant d'écrire l'implémentation, plutôt que d'écrire les tests après coup pour calquer le code existant.

## Contraintes techniques notables

- **Audio WAV PCM obligatoire** : la troncature par palier se fait par découpe d'octets dans le chunk `data` (`server/wavTruncate.js`), sans ré-encodage. Un format compressé (MP3, etc.) nécessiterait une étape de décodage avant de pouvoir réutiliser cette approche.
- **Contrat API stable** : `GET /api/state`, `GET /api/titles` (inclut désormais `id` et `status` par titre), `GET /audio/track`, `POST /api/guess`, `POST /api/skip`, `POST /api/reset` (corps optionnel `{ history }`), `POST /api/mode/random` (corps optionnel `{ generations, history }` ; `generations` est mémorisé côté serveur pour `/api/reset`, `history` non : le serveur ne garde rien par joueur, le client renvoie son historique `localStorage` `{ [songId]: { plays, wins, stageSum, lastPlayedAt } }` à chaque tirage, sans historique le tirage est uniforme, erreur `INVALID_HISTORY` si ce n'est pas un objet ; `GET /api/state` expose `correctSongId` une fois le round fini, jamais avant), `GET /api/generations` (liste + compteurs), `POST /games/:id/generations` (hôte, lobby uniquement, diffusé en `lobby:generations`, aussi présent dans `lobby:state`, `game:state` et `game:reset`), `POST /games/:id/join` (corps optionnel `avatar` : data URL PNG/JPEG/WebP ≤ 64 Ko, sinon `INVALID_AVATAR`), `GET /games/:id/players/:playerId/avatar` (sert l'image, jamais dans les diffusions : les joueurs ne portent que `avatarUrl`, présent aussi dans le classement final), `POST /api/songs/:id/select` — le frontend `web/` en dépend directement via `src/api.ts`. Toute modification de forme de réponse doit être répercutée des deux côtés.
- **État de partie par round, pas global** : `server/gameState.js` garde une `Map` par clé de round (`random:<songId>` ou `list:<songId>`, construites dans `server/index.js`), pas un seul état global. Les deux espaces de noms sont volontairement séparés : mélanger les états ferait fuiter en Bibliothèque quelle chanson est en train d'être jouée en Mode Solo (`en cours` révélerait la réponse).
- **`/api/reset` non authentifié** : usage dev uniquement, limitation connue à traiter avant tout déploiement multi-utilisateur.
