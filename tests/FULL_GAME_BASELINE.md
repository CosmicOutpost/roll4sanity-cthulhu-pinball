# Full-game playtest baseline

This baseline observes the existing game; it does not tune or modify gameplay.
The engineering skill is at
`.agents/skills/roll4sanity-pinball-engineering/SKILL.md`.

## Reproduce

Use the locked dependencies and the Chromium setup described in the root README.

```sh
npm test
npm run test:browser
```

The browser command builds `dist/` and includes both full-game scenarios along
with the existing input and static-path checks. By default, interactive tests
use Vite's development server; the separate static tests serve `dist/` at both
deployment paths. To run only the longer scenarios after building:

```sh
npm run build
npx playwright test tests/browser/full-game.spec.js
```

For full games against the production build at the exact Pages path, start this
preview in a separate terminal, then run the second command in another terminal:

```sh
npm run preview -- --host 127.0.0.1 --port 5174 --strictPort --base=/roll4sanity-cthulhu-pinball/
PINBALL_BASE_URL=http://127.0.0.1:5174/roll4sanity-cthulhu-pinball/ npx playwright test
```

This runs all browser checks, including both full games, against built assets.
The two static-path tests still start their own server for WordPress/Pages checks.

To target an already hosted build without building or deploying it:

```sh
PINBALL_BASE_URL=https://example.com/roll4sanity-cthulhu-pinball/ npx playwright test tests/browser/full-game.spec.js
```

This variable selects a test destination; it does not publish anything. Do not
point tests at a shared server without permission. These checks only affect the
test browser's local game; there is no database or remote score submission.

## What is exercised

- Two fallible player policies: reactive Shift flippers and slower, late Shift
  taps. Space launches the first scenario; the on-screen Launch button, released
  outside its bounds using pointer capture, launches the second.
- Three full-charge launches per game, distinct served balls, physical travel
  beyond the launch guide into the flipper area, normal flipper rebounds and
  scoring. Both bats must receive real key presses.
- Up to 20 seconds of active play per ball, unless it drains sooner. Afterwards
  the player releases both bats and lets gravity drain it naturally. The explicit
  hands-off period makes game-over coverage bounded; it does not represent an
  attempt to maximise score or demonstrate expert play.
- Natural progression through balls 1, 2 and 3, final game over, no fourth ball on
  launch input, HUD/score agreement, pause/resume during the second ball, keyboard
  or button restart and a successful launch in the restarted game.
- One live ball until game over, preserved identity during each ball, finite
  motion, the existing speed cap, correct physical/guided collision modes and no
  return to a dead shooter lane. A physical ball confined within a 24px radius
  for more than six simulation seconds is reported as a suspected trap.

The only writes made inside the page are to the observer's own diagnostic data.
The player uses Playwright keyboard/mouse APIs. It does not set simulation state,
move the ball, inject velocity, invoke drain/restart methods, replace mechanisms,
accelerate clocks or manually advance physics. Restart uses R or the UI button.

Each test allows up to four minutes; a natural drain has a 45-second wall-clock
deadline. The six-second pocket detector uses simulation time, so a paused game
does not count as trapped. It is a diagnostic check, not an in-game rescue.

## Evidence and interpretation

Each scenario prints a summary and attaches:

- `full-game-summary`: per-ball lifetime and scoring, flipper press counts,
  observed guided shots, runtime/network errors and invariant violations.
- `full-game-input-and-trajectory`: player actions and ball samples, taken about
  every 75ms of simulation, including on assertion failure.
- `full-game-screen`: the final or failing browser screen.

Playwright stores attachments under ignored `test-results/`. For a persistent
machine-readable report, run with `--reporter=json` and redirect stdout to a file
outside the tracked source tree. Preserve exit status and inspect failed/skipped
counts. Results depend on browser scheduling; exact scores and trajectories are
observations, not golden assertions. Rerun unexplained failures before diagnosing
gameplay or changing expectations.

These scenarios do not guarantee every ramp/orbit will be hit during ordinary
play. Existing Matter fixture tests cover every shot entrance and return,
stationary contacts, the repaired trap locations, walls and outlanes. The full
games complement those fixtures rather than replacing them. They also do not
prove human enjoyment, mobile touch reliability, every refresh rate or indefinite
trap-free operation. Sustained human playtesting remains necessary.

## Recorded baseline

The pre-change game is commit `8450868b37998038fbd32a0167cb8b3a007c86e8`.
Before adding this skill/tests, the 24 physics/state tests and all nine existing
browser checks passed, and the Vite production build succeeded on Node 24.19.0
using local Chromium. Vite's existing Phaser chunk-size advisory remains.
The expanded production-path run also passed all 11 browser checks (zero failed
or skipped), including both full games and both static-hosting paths. Its Vite
build succeeded with the same game asset hashes. Environment: Node 24.19.0,
Chromium 154.0.8037.57 on Debian 13. No dependency or application files changed.

On 2026-10-17 the two new full-game scenarios passed against the unchanged
production build served locally at `/roll4sanity-cthulhu-pinball/`:

| Player | Simulated time through game over | Final score | Left/right presses | Observed shots beyond launch |
| --- | ---: | ---: | ---: | --- |
| Keyboard reactive | 81.0 s | 10,100 | 11 / 21 | Both orbits, left ramp |
| Launch button and late keyboard taps | 63.3 s | 4,500 | 4 / 7 | Left ramp |

Both completed all three natural drains, pause/resume on ball 2, game over,
rejection of a fourth ball, clean restart and a successful subsequent launch.
There were no observed pocket, ball-count, identity, motion, collision-mode,
score-order, runtime or network violations. Scores/times are recorded observations
and are deliberately not exact test expectations. An earlier development-server
keyboard run also completed a three-ball game (61.6 s, 7,200 points).

During test authoring, the first pointer attempt did not charge because the
harness aimed below the viewport. That run was interrupted; it was not a game
failure or a passing full-suite run. The corrected harness scrolls Launch into
view before pressing it and uses a five-second charge deadline. Both corrected
production scenarios passed without changing the game.

No blocking gameplay defect was found in these sessions. The right ramp was not
observed during these ordinary-input games; its entrance/return fixture tests
pass, but its accessibility during sustained ordinary play is still a coverage
gap. Human shot tuning and mobile touch testing remain outstanding. The existing
Phaser bundle-size advisory remains; no bundle or engine changes were made.

No gameplay repair is authorised by a baseline failure; preserve diagnostics and
report the problem before making further gameplay changes.
