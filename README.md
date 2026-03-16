# Candidate Chess ♟️

A chess training app built around one question:

### What do I do here?

You're shown a position and asked to find the engine's top 5 moves, Family Feud style — no eval bar, no hints. Loosely inspired by the Kotov method. Built to develop middlegame intuition without leaning on the eval bar.

→ **[Live app](https://candidatechess.com)**

---

## Tech Stack

- React + Vite
- Tailwind CSS
- Stockfish 18 (WASM)

---

## Modes

| Mode   | Description                                        |
| ------ | -------------------------------------------------- |
| Daily  | A shared position for everyone, refreshed daily    |
| Random | A random position from the precomputed set         |
| Custom | Upload your own position via FEN or PGN            |
| Study  | Analysis board — engine evals hidden until you ask |

---

## Getting Started

```bash
npm install
npm run dev
```

> Stockfish 18 WASM is committed directly to the repo so no additional setup is needed. If you want to update Stockfish, you'll need to manually move the new package files into place — see [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a breakdown of app structure, Stockfish integration, and how the daily puzzle works.
