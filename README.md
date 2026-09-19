# LLMQ

Reproduction locale du mécanisme central d'un jeu type Heardle : le joueur écoute l'intro d'une chanson, coupée à une durée de plus en plus longue à chaque tentative ratée ou skip, et doit deviner le titre en 6 essais maximum (paliers : 1s, 2s, 4s, 7s, 11s, 16s).

Étape 1 (MVP) : une seule chanson fixe, backend Node.js/Express, pas de multijoueur, pas de bibliothèque réelle, pas de fonctionnalités sociales. Voir [`us/user-stories-mvp.md`](us/user-stories-mvp.md) pour le détail des user stories et [`prompt/user-stories-mvp.md`](prompt/user-stories-mvp.md) pour le contexte projet complet.

## Démarrer

Le dépôt est un workspace pnpm (`pnpm-workspace.yaml` inclut `web/`) : `pnpm install` à la racine installe les dépendances du serveur **et** du frontend en une seule commande, avec un seul lockfile (`pnpm-lock.yaml`). npm reste utilisable (`npm install` + `npm --prefix web install`, deux installations séparées, `package-lock.json` dans chaque dossier) si pnpm n'est pas disponible.

Développement (backend Express + frontend React/Vite avec hot-reload, en parallèle) :

```bash
pnpm install
pnpm run generate:placeholder-audio   # génère data/audio/placeholder.wav si absent
pnpm run dev
```

Puis ouvrir http://localhost:5173 (le serveur Vite proxie `/api` et `/audio` vers Express sur le port 3000).

Production (build React servi statiquement par Express) :

```bash
pnpm run build     # compile web/ vers public/
pnpm start
```

Puis ouvrir http://localhost:3000.

## Tests

```bash
pnpm test          # backend (node:test) + frontend (vitest)
pnpm run test:server
pnpm run test:web
```

## Structure

```
data/
  songs.json          # bibliothèque jouable (1 chanson au MVP)
  audio/               # fichiers audio (WAV PCM requis, voir plus bas)
server/
  index.js             # routes Express, sert public/ en statique
  gameState.js         # état de partie en mémoire (paliers, essais, victoire/défaite)
  songs.js             # chargement/recherche des titres jouables
  soloSessions.js      # session solo par joueur (en-tête X-Solo-Session, expiration après 2 h)
  career.js            # règles pures du Mode Carrière (stats, énergie, tours, single, album de 6 titres, concert de 15, score)
  careerRounds.js      # lien session ↔ gameState ↔ career (rounds d'étude, de single, d'album et de concert)
  wavTruncate.js        # découpe la piste WAV au nombre de secondes autorisé
web/
  src/                 # frontend React + TypeScript (Vite)
    api.ts, types.ts    # client fetch typé pour le contrat API ci-dessous
    hooks/               # useGameState, useCareer (état + actions), useAudioPlayer (lecture + progress)
    components/          # Player, Pips, SearchAutocomplete, History, Result, ShinyText, CareerHub, StatBars
  vite.config.ts        # dev proxy vers Express, build vers ../public
public/
  (généré par `npm run build`, ne pas éditer à la main)
```

Le frontend utilise [React Bits](https://reactbits.dev) pour l'habillage animé (`ShinyText` sur le titre) ; le reste des composants suit des patterns React/TS classiques.

## Routes API

| Route | Méthode | Description |
|---|---|---|
| `/api/state` | GET | État courant de la partie (essais, palier, statut, historique, titre correct si terminé) |
| `/api/titles` | GET | Liste des titres jouables, pour l'autocomplétion |
| `/audio/track` | GET | Piste audio tronquée au palier autorisé (complète si la partie est terminée) |
| `/api/guess` | POST | `{ "title": "..." }` — soumet une tentative |
| `/api/skip` | POST | Passe l'essai courant |
| `/api/reset` | POST | Réinitialise la partie (dev uniquement, non authentifié) |
| `/api/career` | POST / GET / DELETE | Démarre une carrière / la relit (`{ career, round }`) / l'abandonne (204, la suivante repart de l'écran de départ) |
| `/api/career/rest` | POST | Se reposer (énergie au maximum), consomme un tour |
| `/api/career/study` | POST | `{ "stat": "oreille" \| "memoire" \| "culture" }` — démarre un round d'étude (coûte 1 énergie, le titre trouvé entre dans le carnet) |
| `/api/career/single` | POST | Démarre un round de single sur une stat tirée au hasard par le serveur (coûte 2 énergies, plus de stats qu'une étude, le titre n'entre pas dans le carnet) |
| `/api/career/release` | POST | Après les 10 premiers tours : démarre le titre suivant de l'album de 6 (score et grade après le 6e), puis 10 nouveaux tours |
| `/api/career/concert` | POST | Après les tours 11 à 20 : démarre le titre suivant du concert de 15 (score sur 1500 et grade après le 15e), qui termine la carrière |

Les routes solo (dont `/api/career*`) exigent l'en-tête `X-Solo-Session` (id opaque de 16 à 64 caractères généré par le client). Un round de carrière se joue avec `/api/guess`, `/api/skip` et `/audio/track` ; sa spécification est dans [`us/carriere-v1.md`](us/carriere-v1.md) et [`us/carriere-v2.md`](us/carriere-v2.md) (single, deuxième phase, concert).

Le serveur est la seule source de vérité : le titre correct n'est jamais renvoyé avant la fin de partie, et la durée audio servie est réellement limitée côté back (pas seulement côté lecteur front).

## Audio placeholder

`scripts/generate-placeholder-audio.js` génère une tonalité de 30s en WAV PCM (mono, 16 bits, 22050 Hz). Le format PCM est nécessaire : la troncature audio se fait par découpe d'octets dans le chunk `data`, sans ré-encodage. Pour remplacer par une vraie piste, fournir un WAV PCM dans `data/audio/` et mettre à jour `audioFile` dans `data/songs.json`. Un format compressé (MP3, etc.) demanderait d'adapter `wavTruncate.js` avec une étape de décodage.

## Limitations connues (MVP)

- Les parties solo et les carrières vivent en mémoire, par session (`X-Solo-Session`) ; l'id de session n'est pas un secret d'authentification.
- `/api/reset` n'est pas protégé — à retirer ou authentifier avant tout déploiement multi-utilisateur.
- Pas de persistance : l'état repart de zéro au redémarrage du serveur.
