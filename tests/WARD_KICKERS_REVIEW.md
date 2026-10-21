# Midfield arcane wards — review draft, 2026-10-21

Two small 12px-radius brass-and-emerald kickers at (135,550) and (365,550),
below the ramp entrances and above the sling tips. These add cross-table contact
opportunities to the open midfield. Existing artwork, rails, posts, slings,
flippers, launcher, shots, drains, controls and their point values are unchanged.
No lower-playfield extra rail: that area already has repaired narrow clearances.

Each genuine contact-start awards 75 points with a per-ward 240ms cooldown.
The post-solver kick has speed 9, below the existing pop bumper's 12 and sling's
13. A small mirrored inward cant (0.22) discourages exactly vertical crown
rebounds while preserving an outward component on all faces. It is part of
normal contact response, not a proximity boost or rescue. A round 32-sided
collider matches the visible 12px brass rim; the brief halo is decorative.
Both wards share an original, quiet synthesised tone, respect mute/pause and
use the existing WARD +75 caption. No combo bonus or progression was added.

## Baseline and validation

Baseline: `c1fa06903324554f4ea39044c42065a4654890c0`, clean `pinball-playtest`.
Node 24.19.0, npm 11.9.0, Matter 0.20.0, Phaser 3.90.0, Vite 7.3.1,
Playwright 1.58.2, system Chromium. Existing dependency lock unchanged.
Before physics changes: `npm run check` passed 37 Node tests and built;
`npx playwright test` passed all 26 browser checks, including two complete
ordinary-input three-ball games.

New tests first failed for absent ward contact, scoring and ordinary-game hits.
The final mechanism suite exercises:

- Both wards from 24 angles at near-rest, ordinary, fast and capped speeds
  (192 actual-contact cases). Every contact kicks outward at speed 9; initial
  hits award exactly 75. Later sling hits may legitimately add their own points.
- 192 stationary/slow/normal/fast approach runs, each allowing up to 45 simulated
  seconds for a natural drain, preserving the same ball until that drain.
  No small pocket, excessive speed or sustained ward-hit loop is permitted.
- Contact-only awards, independent cooldowns, passive early recontacts, valid
  repeat hits, pause, restart and 24 mirrored impulse comparisons.
- Measured collider gaps: minimum ward-to-existing-hardware gap about 47.5px
  versus the ball's 18px diameter; capture regions remain clear. Guided ball
  outlines have at least 12.6px separation from either ward's rim.
- Eight whole games (24 natural drains), using ordinary control flags and
  imperfect timing. No position, velocity, score, phase or drain injection.
- Browser checks retain ordinary real keyboard/pointer three-ball games.
  A separate explicit initial-placement fixture verifies real contact,
  both 75-point HUD captions and actual sound for each ward. This replaces an
  unsuitable assumption that the first ordinary ball must hit a small target;
  full-game tests still use no physics fixtures. Their observer now records
  scoring contacts as well as trajectories.

`npm run check`: **45 Node tests passed, 0 failed, 0 skipped**, production build
passed. Existing Phaser chunk-size warning remains.

Production browser checks use the exact repository URL prefix:

```sh
npm run preview -- --host 127.0.0.1 --port 5174 --strictPort --base=/roll4sanity-cthulhu-pinball/
PINBALL_BASE_URL=http://127.0.0.1:5174/roll4sanity-cthulhu-pinball/ npx playwright test
```

**Final browser result: 27 passed, 0 failed, 0 skipped (4.2 minutes).**

The final real-keyboard reactive three-ball game completed in 76.3 simulated
seconds, with 7 ward hits, 10 rapid different hits, both ramp shots and the right
orbit. The late-keyboard/pointer-launch game completed in 77.4 simulated seconds,
with 8 ward hits and 11 rapid different hits. Both games had natural drains,
useful flipper rebounds, clean restart, and zero runtime, request or physics
invariant failures. These games explicitly include a hands-off drain period;
they are not evidence that a human could not keep playing longer.

The browser suite also covers eight viewport sizes, real phone-touch launch and
flippers, audio signal/mute/focus safety, old launch/slingshot regressions, and
production loading under the repository and nested WordPress paths. The recorded current-run summaries are in `ward-browser-sessions.json`.
The tests attach input/trajectory data through Playwright; use a retaining
reporter such as `--reporter=json` to keep those attachments for passing runs.


## Paired longer-session observations

`tests/helpers/action-session.js` drives eight fallible players against actual
fixed-step Matter physics. Bat decisions are read every 60 or 140ms, raised for
160ms with a minimum 260ms release gap, at four lower-playfield thresholds.
After 22 simulated seconds per ball, bats are released to verify natural drains.
This is useful repeatable automation, not an expert human player or measured fun.

The same policies at the baseline and with wards produced:

| Threshold / read ms | Rapid different hits, before → after | Ward hits | Whole-game seconds, before → after |
| --- | --- | --- | --- |
| 720 / 60 | 5 → 11 | 5 | 76.7 → 73.7 |
| 720 / 140 | 1 → 1 | 0 | 76.3 → 76.3 |
| 735 / 60 | 11 → 13 | 5 | 66.7 → 80.0 |
| 735 / 140 | 2 → 3 | 4 | 78.2 → 79.1 |
| 750 / 60 | 5 → 8 | 4 | 79.3 → 72.1 |
| 750 / 140 | 0 → 5 | 4 | 77.0 → 76.6 |
| 765 / 60 | 11 → 14 | 6 | 78.2 → 51.9 |
| 765 / 140 | 6 → 11 | 3 | 82.9 → 77.7 |

Rapid different hits = successive **different** scoring mechanisms within one
second on the same ball, an observation only. Totals rose from 41 to 66, with
31 ward contacts. Both ramps and both orbits remained reachable in the ordinary
input sample. Eight games still reached game over, with no detected motion or
pocket violations. Total simulated duration was about 9.8 minutes after the
change. Full paired figures are in `ward-session-comparison.json`.

Some angled shots now strike a ward rather than continuing uninterrupted.
More rebounds do not guarantee easier or better play: one policy drained all
three balls sooner, and another never touched a ward. Underside contacts can
send a ball downwards; the kick is bounded and the existing flipper feeds remain
open, but human desktop/mobile playtesting should judge fairness, aiming and
readability before deployment. Automated testing cannot prove every trajectory
trap-free or establish enjoyment. The existing large Phaser bundle warning
remains; no dependency, new asset, particle system or per-hit allocation pool was
introduced for these two simple rendered bodies.

## Review images and release boundary

`docs/previews/ward-kickers/playfield.png`, `desktop.png` and `mobile.png` are
actual Chromium captures of the production build. A normally launched ball was
paused for capture; only the pause overlay was hidden in the capture page so the
whole table is visible. The game source was not changed for the screenshots.

This draft is saved only on `pinball-playtest`. Its commit carries `[skip pages]`
so the existing workflow can test/build but must skip deployment. The previous
working version remains recoverable at the baseline commit above. Wait for the
user's approval before publishing the wards; main and repository settings must
stay unchanged.
