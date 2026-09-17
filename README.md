# LLMQ

Reproduction locale du mécanisme central d'un jeu type Heardle : le joueur écoute l'intro d'une chanson, coupée à une durée de plus en plus longue à chaque tentative ratée ou skip, et doit deviner le titre en 6 essais maximum (paliers : 1s, 2s, 4s, 7s, 11s, 16s).

Étape 1 (MVP) : une seule chanson fixe, backend Node.js/Express, pas de multijoueur, pas de bibliothèque réelle, pas de fonctionnalités sociales. Voir [`us/user-stories-mvp.md`](us/user-stories-mvp.md) pour le détail des user stories et [`prompt/user-stories-mvp.md`](prompt/user-stories-mvp.md) pour le contexte projet complet.

## Démarrer

Développement (backend Express + frontend React/Vite avec hot-reload, en parallèle) :

```bash
npm install
npm --prefix web install
npm run generate:placeholder-audio   # génère data/audio/placeholder.wav si absent
npm run dev
```

Puis ouvrir http://localhost:5173 (le serveur Vite proxie `/api` et `/audio` vers Express sur le port 3000).

Production (build React servi statiquement par Express) :

```bash
npm run build     # compile web/ vers public/
npm start
```

Puis ouvrir http://localhost:3000.

## Tests

```bash
npm test          # backend (node:test) + frontend (vitest)
npm run test:server
npm run test:web
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
  wavTruncate.js        # découpe la piste WAV au nombre de secondes autorisé
web/
  src/                 # frontend React + TypeScript (Vite)
    api.ts, types.ts    # client fetch typé pour le contrat API ci-dessous
    hooks/               # useGameState (état + actions), useAudioPlayer (lecture + progress)
    components/          # Player, Pips, SearchAutocomplete, History, Result, ShinyText
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

Le serveur est la seule source de vérité : le titre correct n'est jamais renvoyé avant la fin de partie, et la durée audio servie est réellement limitée côté back (pas seulement côté lecteur front).

## Audio placeholder

`scripts/generate-placeholder-audio.js` génère une tonalité de 30s en WAV PCM (mono, 16 bits, 22050 Hz). Le format PCM est nécessaire : la troncature audio se fait par découpe d'octets dans le chunk `data`, sans ré-encodage. Pour remplacer par une vraie piste, fournir un WAV PCM dans `data/audio/` et mettre à jour `audioFile` dans `data/songs.json`. Un format compressé (MP3, etc.) demanderait d'adapter `wavTruncate.js` avec une étape de décodage.

## Limitations connues (MVP)

- Une seule partie globale en mémoire, pas de session par joueur.
- `/api/reset` n'est pas protégé — à retirer ou authentifier avant tout déploiement multi-utilisateur.
- Pas de persistance : l'état repart de zéro au redémarrage du serveur.
