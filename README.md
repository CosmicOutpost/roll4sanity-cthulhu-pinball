# Roll4Sanity — The Sunken Table

A playable Call of Cthulhu themed **mechanical pinball prototype**. Phaser 3 uses its Canvas renderer (no GPU required) for a responsive 540 × 960 portrait table; Matter.js runs the ball and collisions. Everything is bundled locally by Vite. No account, API, database, remote font, or runtime CDN is required.

## Develop

Requires Node.js **22.12+** (or 20.19+); verified with Node 24.19 and npm 11.9.

```sh
npm ci
npm run dev
```

Open the address printed by Vite (default port 5173). Click the page to give it keyboard focus. In the cloud workspace, if npm's default cache is not writable, use `npm ci --cache /tmp/roll4sanity-npm-cache`.

## Controls

| Key | Action |
| --- | --- |
| Left Shift | Left flipper |
| Right Shift | Right flipper |
| Space, hold then release | Compress and release the plunger; a full charge takes 1.2 seconds |
| P | Pause / resume |
| R | Restart the three-ball game |
| D | Toggle collision shapes, shot capture zones, and ball velocity |

The buttons below the table also operate the flippers and plunger, including simultaneous pointer controls. Losing focus automatically pauses and cancels held inputs so the plunger cannot accidentally fire. Resume with P or the pause button. `?debug=1` starts the overlay and exposes `window.pinball` for local inspection; ordinary sessions do not expose it.

## Table rules

- **One ball at a time, three balls per game.** Center and side outlane drains consume a ball. A weak plunge rolls back to the plunger for another try without consuming one.
- The two triangular slingshots kick inward and award **50** points.
- Each of the three green pop bumpers has an active radial kick and awards **100** points.
- Shoot upward through either blue outer orbit entrance for **1,000** points. The shot wraps around the upper table and returns down the opposite inlane.
- Shoot upward between either pair of ramp entrance posts for **2,500** points. The amber and pale green ramp decks lead to opposite inlanes. The ball appears larger, with an elevated shadow, while on a ramp.
- Inlanes feed the flippers; lanes outside the dividing posts drain. No ball saver, extra balls, multiball, tilt, missions, audio, or persistent high scores are implemented yet.

### Prototype physics

Matter runs at a fixed **120 Hz** independently of rendering, with eight position and velocity solver iterations. A render stall is limited to 100 ms of catch-up; the engine never takes an oversized physics step. Velocity is capped at 22 pixels per Matter base tick, giving roughly 11 pixels of travel per step against a 9-pixel-radius ball and thick rails.

Flippers are solid rotating bats with fixed pivots and separate rise/return speeds. Matter resolves contact against their current geometry; a contact impulse adds the bat's angular surface velocity during a strike. Held flippers remain solid. This is a tuned kinematic model, rather than a full electromechanical coil simulation.

**Both orbits and ramps use guided travel in this prototype.** Capture requires an upward-moving ball inside a visible entrance zone. While guided, the ball follows a sampled curve at constant arc-length speed, temporarily leaves collision response, then returns to physical simulation with a defined inlane velocity and short capture lockout. Ramps have raised deck borders, colors, and an elevated ball presentation. The shooter uses physical launch travel up the right lane, followed by a short one-way guide over its upper exit. There is no true 3D elevation.

## Build and static hosting

```sh
npm run build
npm run preview
```

Deploy the **contents of `dist/`** as a directory, for example `/games/roll4sanity/`. `base: './'` makes scripts, styles, and the favicon relative to that directory. Keep the generated `assets/` directory alongside `index.html`. Use an HTTP server, rather than opening the file directly.

For WordPress, upload the static build through your normal hosting process and embed its URL in an iframe. This task does not modify or deploy to WordPress. The entire cabinet is responsive; an iframe needs enough height for the table and controls (approximately 900–1,100 px on desktop, depending on width).

Vite reports a large-chunk advisory for the Phaser engine bundle. The engine is split from application and physics code for caching; the build succeeds. Bundle-size tuning is future work.

## Validation

```sh
npm test                # Node's test runner: actual Matter physics and game-state tests
npm run build          # Production bundle
npm run test:browser   # Build, then Playwright with Chromium
npm run check          # Unit/physics tests, then production build
```

Browser checks use `/usr/bin/chromium` by default. Override with `CHROMIUM_PATH=/path/to/chromium npm run test:browser`. On another machine, install Chromium using your platform's package manager, or run `npx playwright install chromium` and set `CHROMIUM_PATH` to that executable. Playwright starts Vite itself, using port 5173. Test reports are ignored; screenshots are written under `/tmp/roll4sanity-*.png`.

The automated checks cover three-ball scoring and restart; full/weak plunges; all four shot entrances and live returns; downward-shot rejection; active bumpers/slings; both flippers' impulses and collision blocking; walls and shooter divider; center/outlane drains; pause; and frame-rate independence. Chromium checks render the table, exercise keyboard launch/flippers/pause/restart, verify a 390-pixel-wide layout and pointer controls, check focus-loss safety, and launch the actual production build from a nested WordPress-style directory while verifying that every asset request stays local.

This is an initial mechanical prototype. Automated browser and simulation checks are not a substitute for sustained human playtesting, shot tuning, or testing every device. No claim of complete playtesting is made.

## Source map

- `src/game/table.js` — dimensions, rails, posts, shot definitions, path sampling.
- `src/game/physics.js` — fixed-step Matter simulation, flippers, plunger, kickers, guided travel.
- `src/game/state.js` — scoring, ball count, pause, restart.
- `src/game/render.js` — procedural table visuals and debug overlay.
- `src/game/controls.js` — keyboard and pointer input, focus safety.
- `src/main.js` — Phaser scene and HTML scoreboard integration.
- `tests/` — physics/state checks and browser checks.
