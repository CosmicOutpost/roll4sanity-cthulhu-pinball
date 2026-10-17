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
| Z | Left flipper |
| / | Right flipper |
| Space, hold then release | Compress and release the plunger; a full charge takes 1.2 seconds |
| P | Pause / resume |
| R | Restart the three-ball game |
| D | Toggle collision shapes, shot capture zones, and ball velocity |

The buttons below the table also operate the flippers and plunger, including simultaneous pointer controls. Losing focus automatically pauses and cancels held inputs so the plunger cannot accidentally fire. Resume with P or the pause button. `?debug=1` starts the overlay and exposes `window.pinball` for local inspection; ordinary sessions do not expose it.

The cabinet fits both the available screen height and width, keeping the full
portrait table and essential controls in view. Very short landscape screens use
compact surrounding UI; portrait remains preferable for a larger playfield.

**SFX** beside Pause mutes/unmutes the arcade sounds. The preference is remembered
locally when browser storage is available. Audio starts only after a real player
gesture (a game key, pointer or touch); the browser may require another gesture
after an interruption. Effects are original, generated locally with Web Audio:
flipper clicks, bumper/slings, quiet rubber-post ticks, launch and orbit/ramp
chimes. No audio downloads, third-party samples, music or runtime service is used.
Unsupported or blocked audio/storage does not stop the game. Pause/focus loss
silences active effects; there is no delayed sound replay on resume.

Scoring shows a short **+points** caption in the scoreboard and playfield for
about 0.95 seconds, with a restrained fade. Multiple awards within a rendered
frame are displayed together; the score itself updates immediately. Ramp/orbit
entrances, scoring bumpers and in/out lanes have clearer labels. The steel ball
has stronger contrast at its existing radius. These are presentation changes;
physics, geometry, shot timing and point values remain unchanged.

Hold Space or the Launch button until the message says **FULL CHARGE**, then
release. A short plunge can roll back; **PLUNGE TOO SOFT** means the same ball is
ready to charge again. Interrupted pointer gestures cancel rather than firing.

## Table rules

- **One ball at a time, three balls per game.** Center and side outlane drains consume a ball. A weak plunge rolls back to the plunger for another try without consuming one.
- The two triangular slingshots kick inward and award **50** points.
- Each of the three green pop bumpers has an active radial kick and awards **100** points.
- Shoot upward through either blue outer orbit entrance for **1,000** points. The shot wraps around the upper table and returns down the opposite inlane.
- Shoot upward between either pair of ramp entrance posts for **2,500** points. The amber and pale green ramp decks lead to opposite inlanes. The ball appears larger, with an elevated shadow, while on a ramp.
- Inlanes feed the flippers; lanes outside the dividing posts drain. No ball saver, extra balls, multiball, tilt, missions, or persistent high scores are implemented yet.

### Prototype physics

Matter runs at a fixed **120 Hz** independently of rendering, with eight position and velocity solver iterations. A render stall is limited to 100 ms of catch-up; the engine never takes an oversized physics step. Velocity is capped at 22 pixels per Matter base tick, giving roughly 11 pixels of travel per step against a 9-pixel-radius ball and thick rails.

Flippers are solid rotating capsules with fixed pivots and separate rise/return
speeds. Their previous/current poses supply the actual linear and angular contact
velocity to Matter's solver on both strokes; there is no separate proximity kick.
Held bats have zero surface velocity. This is a kinematic model, rather than a
full electromechanical coil simulation.

The collision capsules include the rounded heels visible in the artwork. Pivot
covers are decorative parts of the flipper assembly, rather than larger fixed
colliders that can shelter a ball from the bat. Inlane collision rails continue
under the rubber with their upper surfaces aligned, removing the old rail/pivot
cup without changing the drawn rails or pivots. The steel ball uses a 32-sided
collision outline instead of Matter's default small-circle decagon, so broad
facets cannot balance on shallow slopes. There is no flipper ball rescue,
teleport, timer, or stationary-ball boost.

The upper-left curve also keeps a full ball-width return gap. Its former lower
corner narrowed the opening to about 9px and wedged the 18px ball near `(41, 163)`.
The corner is offset inward, both orbit guides follow the available clearance,
and a connected lead-in on the next left return rail prevents a second catch
farther down the wall. These are local mechanical rail adjustments, with the
existing theme and table layout retained.

**Both orbits and ramps use guided travel in this prototype.** Capture requires an upward-moving ball inside a visible entrance zone. While guided, the ball follows a sampled curve at constant arc-length speed, temporarily leaves collision response, then returns to physical simulation with a defined inlane velocity and short capture lockout. Ramps have raised deck borders, colors, and an elevated ball presentation. The shooter uses physical launch travel up the right lane, followed by a short one-way guide over its upper exit. There is no true 3D elevation.

The shooter's upper rails form a closed return barrier: the guided plunge can
cross it, but a physical playfield ball cannot fall back down the shooter lane.
The right return rail joins the divider so there is no pocket at its exposed end.
As a recovery safeguard, any ball that does return to the plunger is rearmed
without changing its ball number or score. The launch velocity remains 12–22
pixels per Matter base tick, depending on charge.

## Build and static hosting

```sh
npm run build
npm run preview
```

Deploy the **contents of `dist/`** as a directory, for example `/games/roll4sanity/`. `base: './'` makes scripts, styles, and the favicon relative to that directory. Keep the generated `assets/` directory alongside `index.html`. Use an HTTP server, rather than opening the file directly.

For WordPress, upload the static build through your normal hosting process and embed its URL in an iframe. This task does not modify or deploy to WordPress. The entire cabinet is responsive; an iframe needs enough height for the table and controls (approximately 900–1,100 px on desktop, depending on width).

Vite reports a large-chunk advisory for the Phaser engine bundle. The engine is split from application and physics code for caching; the build succeeds. Bundle-size tuning is future work.

## GitHub Pages playtest deployment

The workflow in `.github/workflows/pages.yml` runs **only on pushes to
`pinball-playtest`**. It installs the lockfile with Node 24, runs the physics/state
tests, builds the game, runs Chromium tests, and uploads **only `dist/`** as a
Pages artifact. `main` is not used or changed.

Vite's existing `base: './'` supports the project-site path
`/roll4sanity-cthulhu-pinball/` as well as WordPress subdirectories. The browser
suite serves the built files at that exact Pages path, launches a ball, and checks
that every asset request stays under it without HTTP or JavaScript errors.

Deployment is **disabled by default**. The deploy job requires the repository
Actions variable `PAGES_DEPLOY_ENABLED` to equal `true`. A commit message containing
`[skip pages]` always skips deployment, even when that variable is enabled. The
initial configuration commit uses this marker. `actions/configure-pages` explicitly
has `enablement: false`, so the workflow cannot enable Pages on your behalf.

### Activate later, after approving publication

Private-repository Pages hosting requires an eligible GitHub Pro (personal),
Team, or Enterprise plan. **GitHub Free cannot host Pages from this private
repository.** These instructions do not change repository visibility or the plan.
If GitHub requests an upgrade or visibility change, stop; use an alternative such
as Cloudflare Pages if keeping free hosting and a private repository is required.

1. In the repository, open **Settings → Actions → General**. Ensure GitHub Actions
   is allowed, including the official `actions/*` actions. The workflow declares
   its own least-privilege permissions; there is no need to grant all workflows
   write permissions or add a personal access token.
2. Open **Settings → Pages → Build and deployment** and choose **Source: GitHub
   Actions**. Do not choose “Deploy from a branch” or generate another workflow.
3. In **Settings → Environments → github-pages**, check deployment branch rules.
   Allow the **branch** `pinball-playtest` (add it under **Selected branches and
   tags** if restrictions are enabled). Preserve any required reviewers you want.
   If the environment is not yet listed, create it with that name and branch rule.
4. Open **Settings → Secrets and variables → Actions → Variables**. Create the
   **repository variable** `PAGES_DEPLOY_ENABLED` with the value `true`. This is
   a non-secret switch; no deployment credential is required.
5. Trigger a new push to `pinball-playtest` after the settings are ready. The
   preparation commit deliberately cannot deploy, and this workflow does not
   depend on GitHub's manual “Run workflow” button (which would require a workflow
   on the default branch). An authorized empty commit is sufficient:

   ```sh
   git switch pinball-playtest
   git commit --allow-empty -m "Publish pinball playtest to GitHub Pages"
   git push origin pinball-playtest
   ```

   In this Codex workspace, ask the assistant to make that trigger commit after
   activation; do not run these commands until publication is approved.
6. In **Actions → Pinball Pages**, wait for **Test and build** and **Deploy to
   GitHub Pages** to succeed, followed by **Playtest deployed game**. The final
   job uses Chromium to launch with both input methods, follow the ball into the
   lower playfield, and operate the flippers on the actual published site. The
   deployment output provides the actual site URL.
   Without a custom domain, the expected URL is
   `https://cosmicoutpost.github.io/roll4sanity-cthulhu-pinball/`.

Future pushes to `pinball-playtest` deploy automatically while the variable is
`true`, unless marked `[skip pages]`. Set the variable to `false` to stop future
deployments; this does not remove an already published site. Publishing the game
makes its browser assets public even though the GitHub repository stays private.
The pre-deployment tests validate the URL path locally; the post-deployment job
tests the live Pages URL independently.

## Validation

```sh
npm test                # Node's test runner: actual Matter physics and game-state tests
npm run build          # Production bundle
npm run test:browser   # Build, then Playwright with Chromium
npm run check          # Unit/physics tests, then production build
```

Browser checks use `/usr/bin/chromium` locally and Playwright's installed browser when `CI` is set. Override with `CHROMIUM_PATH=/path/to/chromium npm run test:browser`. On another machine, install Chromium using your platform's package manager, or run `npx playwright install chromium` and set `CHROMIUM_PATH` to that executable. Playwright starts Vite itself, using port 5173. Test reports are ignored; screenshots are written under `/tmp/roll4sanity-*.png`.

The automated checks cover three-ball scoring and restart; full/weak plunges; all four shot entrances and live returns; downward-shot rejection; active bumpers/slings; both flippers' impulses and collision blocking; walls and shooter divider; center/outlane drains; pause; and frame-rate independence. Chromium checks render the table, exercise keyboard launch/flippers/pause/restart, verify a 390-pixel-wide layout and pointer controls, check focus-loss safety, and launch the actual production build from both a nested WordPress-style directory and the exact GitHub Pages repository path while verifying that every asset request stays local.

Heel-trap regressions use the equilibrium position recorded from an actual full
plunge, mirrored to both sides. They exercise stationary and nearly stationary
balls, repeated rise/return contacts at four points on each bat, and 40 slow-ball
cases around the heels, feeds, and tips. They also check that the central drain
stays open, normal shots still work, and a bat cannot kick a nearby ball before
physical contact.

Upper-left return regressions reproduce the screenshot-location equilibrium,
exercise 25 approach/velocity combinations through the full downstream return,
and check both sampled orbit curves against the actual ball and rail colliders.
The stationary ball clears the curve under gravity without a rescue impulse or
teleport.

Launch regressions follow the ball beyond the guide, reproduce a weak plunge
and retry, check pointer-capture cancellation and release outside the button, and
play with the actual Z and / controls. They check for flipper-area rebounds and a
ball stranded in the shooter, rather than accepting a page load or a transient
`playing` state as a successful launch. The two longer playtests can also target
an HTTP-hosted build or deployed site:

```sh
PINBALL_BASE_URL=https://example.com/roll4sanity-cthulhu-pinball/ npx playwright test tests/browser/play.spec.js --grep 'plays beyond the launch guide'
```

This is an initial mechanical prototype. Automated browser and simulation checks are not a substitute for sustained human playtesting, shot tuning, or testing every device. No claim of complete playtesting is made.

## Source map

- `src/game/table.js` — dimensions, rails, posts, shot definitions, path sampling.
- `src/game/physics.js` — fixed-step Matter simulation, flippers, plunger, kickers, guided travel.
- `src/game/state.js` — scoring, ball count, pause, restart.
- `src/game/render.js` — procedural table visuals and debug overlay.
- `src/game/audio.js` — original generated effects, gesture unlock, bounded voices and mute preference.
- `src/game/feedback.js` — observes existing inputs/scoring for sound and readable captions; never changes the simulation.
- `src/game/controls.js` — keyboard and pointer input, focus safety.
- `src/main.js` — Phaser scene and HTML scoreboard integration.
- `tests/` — physics/state checks and browser checks.

## Cabinet typography

The cabinet display title uses a locally bundled, unmodified Josefin Sans variable
font from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/josefinsans),
Copyright 2010 The Josefin Sans Project Authors. It is distributed under the SIL
Open Font License 1.1; the full notice is in `public/fonts/JosefinSans-OFL.txt`.
Scores and functional labels retain system-font fallbacks. `src/cabinet.css`
contains the cabinet/HUD treatment separately from the playfield renderer.
