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

- Two fallible player policies: reactive Z and / flippers and slower, late Z and /
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

Rebound observation runs every rendered frame, while saved trajectory samples
remain about 75ms apart. The reactive player must demonstrate an upward flipper
shot; the deliberately late player is allowed to miss, while still completing
all lifecycle/control checks. Both bats' physical contacts and normal shots
remain covered independently by the Matter regressions. This distinction avoids
requiring a lucky successful shot from intentionally poor timing.
Both ordinary Z and / controls are explicitly checked before the first plunge,
including the bats reaching their raised positions. Live-play input counts can
otherwise be one-sided when the ball never approaches the other bat; counting
only opportunistic commands made this coverage assertion nondeterministic.

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

## Stage 1 visibility and feedback validation (2026-10-17)

The presentation pass preserves `physics.js`, `state.js`, `table.js` and
`controls.js` byte-for-byte. The built physics chunk remains `physics-D8iP4ekj.js`.
The standard 24 Matter/state checks pass. The production-browser scenarios
complete both three-ball games with ordinary input, natural drains, pause, game
over and restart; no runtime, network or physics-invariant violations were found.

| Player | Simulated time | Final score | Observed shots beyond launch |
| --- | ---: | ---: | --- |
| Reactive keyboard | 89.3 s | 10,650 | Right orbit, both ramps |
| Launch button / late taps | 57.4 s | 5,150 | Left ramp, right orbit |

These are observations, not golden expectations. An earlier reactive run also
reached both orbits and the right ramp. Full-game routes vary with input timing.

Before implementation, the deliberately late player's successful-shot assertion
failed on the unchanged game. During validation another run completed normally
without needing the left bat, failing an input-count assertion. The tests now
observe brief rebounds every frame, require a successful shot for the reactive
policy, and explicitly verify both bats with normal Shift input before serving.
The late player may miss. No ball placement, rescue, velocity, score or physics
change was used to address these test-controller assumptions.

`tests/browser/feedback.spec.js` adds eight screen-fitting checks (including New
Game), real Web Audio waveform/volume checks, voice bounds and cleanup, mute
persistence, focus/pause silence, real scoring captions, unsupported audio and
blocked-storage fallback, and Chromium touch input. The Pages workflow repeats
these Stage 1 checks on the published site alongside the launch playtests.
Original sounds are generated locally; no audio sample licence is required.

## Desktop control follow-up

The default flipper keys now use Z (left) and / (right), avoiding repeated Shift
presses and Windows Sticky Keys prompts. Historical results above used the
bindings recorded at that time. The same player policies and assertions now
exercise the new keys, with dedicated browser checks for independent presses,
repeat, release, focus loss and browser default prevention. Space and touchscreen
controls are retained. See `SLINGSHOT_REVIEW.md` for the separate mechanical
investigation; no mechanical repair is included in this control change.

Validation: the unchanged baseline at `4027595` passed 24 Matter/state tests and
23 browser tests. After remapping, `npm run check` passed all 24 Matter/state
tests and built successfully. All 24 browser tests passed against the production
build served at `/roll4sanity-cthulhu-pinball/`, including both complete games:
reactive input 55.2 simulation seconds / 4,450 points; slower input 61.7 seconds /
5,750 points. Both had no runtime, request or physics-invariant violations.
Scores and trajectories are observations, not fixed expectations. The built
physics chunk remains `physics-D8iP4ekj.js`. Native Windows accessibility dialogs
were not tested; Chromium verifies Shift no longer actuates either bat.
