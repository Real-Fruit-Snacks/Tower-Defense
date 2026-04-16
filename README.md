# Tower Defense

A browser-based tower defense game with a cyberpunk neon aesthetic, 6-element combat wheel, branching tower upgrades, procedural levels, and a roguelite unlock tree. Built with Phaser 3 + TypeScript + Vite.

**▶ [Play in your browser](https://Real-Fruit-Snacks.github.io/Tower-Defense/)**

---

## Features

- **Procedural campaign** — 3 worlds, 7–9 layered nodes each, with branching paths, elite/boss nodes, shops, and rest stops. Every run is a fresh map.
- **Endless mode** — truly infinite waves. Boss waves every 10, elite waves every 5, enemy pool unlocks progressively, HP and threat budget scale forever.
- **Challenges** — 10 hand-tuned rulesets (banned elements, 1 HP, no-sell, fortress gauntlet, etc.). Each attempt generates a fresh procedural map.
- **6-element combat wheel** — Fire > Wind > Earth > Lightning > Water > Void, each strong against the next.
- **14 towers** — branching upgrade trees with three specializations per tower. Tap an existing tower mid-game to inspect, upgrade, or sell.
- **Roguelite unlock tree** — spend shards earned per run on permanent unlocks: new towers, passive bonuses, modes. Endgame **Ascension** tier opens infinite mastery nodes for permanent scaling rewards.
- **Procedural layouts** — open field, island, corridors, split path, gauntlet, fortress. Layouts are seeded so each run is unique.
- **Visual polish** — neon glow rendering, multi-layer ADD-blend effects, camera juice (shake/flash/fade), animated pulsing HUD, particle bursts, wave preview, fully-polished main menu & world map.

---

## Tech stack

- **[Phaser 3.80](https://phaser.io/)** — 2D game framework
- **TypeScript 5.5** — strict mode with `noUncheckedIndexedAccess`
- **Vite 6** — bundler + dev server
- **ESLint 9** — flat config

No runtime dependencies beyond Phaser. All art is drawn via Phaser Graphics (vector shapes + gradients + blend modes).

---

## Project structure

```
src/
├── data/           # Static configs: towers, enemies, waves, worlds, challenges, unlock tree
├── entities/       # Tower / Enemy / Projectile classes + managers & factories
├── rendering/      # Graphics renderers, neon effects, shape helpers
├── roguelite/      # Persistent state, shard tracker, unlock tree manager
├── scenes/         # Phaser scenes (main menu, game, world map, etc.)
├── systems/        # Grid, pathfinding, economy, wave manager, level generator, save, audio
├── ui/             # HUD, tower bar, tower info panel, wave preview
├── utils/          # Event bus, math, priority queue, seeded RNG
├── constants.ts    # Colors, elements, scene IDs, grid/game constants
├── types.ts        # Shared TS types
└── main.ts         # Entry point
```

---

## Quick start

Requires **Node.js 18+**.

```bash
# install dependencies
npm install

# run dev server (hot reload)
npm run dev

# production build (tsc + vite build)
npm run build

# preview the production build
npm run preview

# lint
npm run lint
```

The dev server prints a local URL (usually `http://localhost:5173`).

---

## Deployment

The project auto-deploys to GitHub Pages on every push to `main` via [.github/workflows/deploy.yml](./.github/workflows/deploy.yml).

To host at your own username, update the `base` in `vite.config.ts` to match your repo name:

```ts
base: '/Your-Repo-Name/',
```

Then in your GitHub repo: **Settings → Pages → Source: GitHub Actions**.

---

## Controls

| Action | Input |
| --- | --- |
| Place a tower | Select tower from bottom bar, click an empty cell |
| Inspect / upgrade / sell | Click a placed tower |
| Pause | `Esc` |
| Start next wave | ▶ button in HUD |
| Change game speed | Click `1x / 2x / 3x` in HUD |
| Scroll world map / unlock tree | Drag or scroll wheel |

---

## Design notes

- **Grid** — 20 × 12 cells @ 48 px.
- **Path** — A* with heap-based priority queue; recomputed on every tower placement/sale.
- **Waves** — threat-budget system. `WaveManager` supports both finite arrays (campaign/challenges) and lazy providers (endless mode, generated on demand).
- **Persistence** — everything lives in `localStorage` under key `td_save_v1`. Save format is versioned with a migration path.
- **Seeded RNG** — `mulberry32` drives all procedural generation so a given seed produces the same map every time.

---

## License

[MIT](./LICENSE)
