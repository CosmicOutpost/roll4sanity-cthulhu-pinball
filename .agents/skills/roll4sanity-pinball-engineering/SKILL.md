---
name: roll4sanity-pinball-engineering
description: Engineer and playtest Roll4Sanity browser pinball. Use for ball movement, flippers, table geometry, guided shots, controls, scoring rules, or gameplay regressions. Establish a baseline, preserve successful behaviour, and verify complete three-ball games.
---

# Roll4Sanity Pinball Engineering

## Purpose and scope

Build an enjoyable, responsive arcade pinball game for Roll4Sanity, proportionate
to a small, free browser game and the 500 YouTube subscriber celebration.
Prioritise understandable controls, satisfying shots, fair drains and a clear
reason to play again over perfect physical simulation.

Take inspiration from Windows 3D Pinball: Space Cadet's accessible controls,
shot feedback and clear objectives. Use original Roll4Sanity rules, names and
assets; inspiration does not grant permission to copy Microsoft's game assets.

Preserve existing artwork, scoring, controls and game features unless the user
explicitly approves a change. Treat mechanical repairs as scoped work: do not
silently redesign the table, change point values or add rules while fixing a bug.
Never make major physics, engine or architecture changes without first proposing
the problem, alternatives, migration cost, expected benefit and validation plan
and obtaining approval. This includes replacing Matter.js, converting the table
to physical 3D ramps or rewriting the flipper model.

Do only the authorised work. Research is not implementation approval. Creating
this skill does not authorise missions, multiball, ball saves, new artwork or other
features. Prefer small changes that improve the current game; defer elaborate
simulation, editors, ROM emulation and services until justified by a real need.

## Current architecture and successful behaviours

Read the actual code before relying on these descriptions or changing constants.

- Phaser 3 renders the table; a separate Matter.js engine owns the simulation.
  Vite builds static files. No external runtime services or CDN assets are needed.
- `src/game/table.js`: dimensions, shared rail geometry, posts and guided shots.
- `src/game/physics.js`: ball lifecycle, fixed steps, contacts and guided travel.
- `src/game/state.js`: three-ball game, score, pause and restart.
- `src/game/controls.js`: keyboard/pointer events, capture and focus safety.
- `src/game/render.js`, `src/main.js`: presentation, HUD and optional debug state.
- The portrait table is 540 x 960. Physics uses fixed 120 Hz updates, eight
  position/velocity iterations, capped catch-up and a speed limit. Matter velocity
  units are pixels per base tick, not pixels per second. Do not copy constants
  from another engine without converting units and testing the result.
- Flippers are solid kinematic capsules with fixed pivots and separate rise and
  return speeds. Actual previous/current poses supply contact surface velocity.
  They are an arcade model, not a full simulation of coils and mechanical recoil.
- Both orbits and ramps use guided travel. Ramps are visibly elevated but are
  not physical 3D surfaces. A short guide also carries the launch over its exit.
- Z and / operate the left/right bats; hold/release Space or Launch to plunge;
  P pauses, R restarts, D toggles debug. Pointer controls and focus safety work.
- Three balls, 50-point slings, 100-point bumpers, 1,000-point orbits and
  2,500-point ramps are established behaviour. Check source for later revisions.

## Before changing physics: establish a reproducible baseline

1. Inspect branch, HEAD, working tree, instructions and the user's authorised
   scope. Preserve user changes; use the existing isolated checkout.
2. Run `npm test` and `npm run test:browser` before editing physics. The latter
   builds production assets and runs real Chromium tests. Use the existing
   dependencies and lockfile; do not upgrade tools merely to investigate a bug.
3. Record the exact commit, environment, commands, outcomes and known warnings.
   Distinguish existing failures, new regressions and untested behaviour.
4. Reproduce with the actual game physics. Capture ball position, velocity,
   identity, game phase, ball number, input sequence, nearby colliders and shot
   mode. Use `?debug=1` for collision/velocity inspection and `window.pinball`.
5. Reproduce the precise failure in an automated fixture where possible. A fixture
   may place a ball initially; after setup, let Matter resolve the mechanism.
   Also retain a browser reproduction using ordinary player inputs.
6. Identify successful behaviours that must survive: normal shots, both strokes
   of each flipper, safe returns, weak plunge retry, real drains, scoring, pause,
   restart, pointer cancellation and static hosting under a subdirectory.

Do not claim a bug is reproduced because the page loads or a `playing` flag is
set. A full plunge must leave the shooter, enter physical play, reach the flippers
and remain controllable. Preserve the successful baseline alongside the repair.

## Collision and mechanism practices

- Keep fixed simulation steps independent of rendering. Bound catch-up after
  stalls; never substitute one oversized step. Check behaviour at different
  render cadences. Profile before increasing solver iterations or substeps.
- Inspect the real collision outline, not just artwork. Keep presentation and
  collision geometry aligned. Rounded moving heels and tips must match the bat.
- Measure free space against the full ball diameter plus a practical clearance
  margin, including rail thickness, corner joints and the sampled curve between
  control points. Avoid narrowing wedges, exposed endpoints and immovable cups.
- Inspect the whole downstream route when opening a gap. A repair that moves the
  trap to the next rail is incomplete. Slow approaches matter as much as fast ones.
- A moving flipper must transfer its actual linear/angular surface velocity at
  contact, including to a stationary ball and on return. A held bat must not add
  phantom energy. Do not add a proximity kick or arbitrary low-speed boost.
  Check that early, middle and late presses produce useful shot directions;
  also check holding a catch, releasing it and making the next shot on both sides.
- Separate decorative pivot covers and mechanical stops from ball colliders
  where appropriate. Fixed hardware must not shelter a ball from the moving bat.
- Check ball shape resolution and friction on shallow slopes. An approximate
  circle can balance on a polygon facet. Do not conceal that with extra force.
- Use thick, continuous rails and bounded speeds. Normal-speed wall/flipper
  tests must remain. More solver iterations are not continuous collision
  detection and do not fix incorrect geometry.
- Bumpers/slings should respond to actual contact, kick in a defined direction
  and award points once per valid hit, with appropriate cooldown. Check repeated
  contacts for score farming and unstable energy growth.
- Give every guided shot explicit entrance direction/speed, capture region,
  collision mode, travel duration, exit position/velocity and recapture lockout.
  Restore a dynamic ball and its collision mask reliably on exit. Keep paths
  visibly consistent with rails and ramp decks. Pause must freeze guided travel.
- Keep plunger charge/release state separate from ambiguous launch flags. Test
  weak returns and a second launch of the same ball. Check lane gates and returns
  before changing force. Validate both Space and captured pointer release.
- Handle key repeat, release outside a button, pointer cancellation/capture loss,
  focus loss and pause. Cancelled gestures must not launch the ball accidentally.
- Do not use teleportation, ball replacement, hidden timers or automatic rescue
  to hide a mechanical trap. An explicitly approved gameplay ball-save rule is
  separate from repairing broken geometry.

## Test complete gameplay as well as mechanisms

Use complementary levels; none replaces the others:

1. Actual Matter fixtures: stationary/nearly stationary contacts, both flippers,
   rise/hold/return, repeated activation of the same ball, normal shots, clearance
   sweeps, high-speed contacts, drains and fixed-step consistency.
2. Rules/state tests: exactly three balls, monotonic scoring, one award per
   completion, pause, game over and clean restart. Test future objective state
   separately from physics, using gameplay events rather than renderer state.
3. Real-browser full games: charge and release normally, play with ordinary
   keyboard or pointer input, follow all three balls through physical play and
   natural drains, then check game over and restart. Do not inject positions,
   velocities, scores, phases, drain calls or manual physics steps to pass them.
   Observation of debug state is allowed. Include imperfect timing and releases,
   not only a perfect controller. Any deliberate no-flip drain period must be
   documented; it is not evidence of expert human play.
4. Longer sessions: monitor ball identity/count, finite motion, stalled pockets,
   shooter returns, collision restoration, score/HUD consistency and serving.
   Save input/trajectory summaries and failure diagnostics. Use bounded deadlines
   so a stuck game fails clearly. Never weaken an assertion just to get green CI.
5. Static delivery: build and exercise the exact Pages repository path and a
   nested WordPress path; all production assets must remain local and relative.
6. Human playtesting: assess responsiveness, useful shot timing, readability,
   fairness and fun on relevant desktop/mobile browsers. Automated input and
   headless Chromium do not prove human enjoyment or every-device reliability.

Run `npx playwright test tests/browser/full-game.spec.js` for the longer baseline.
It writes trajectory, input and per-ball summaries into Playwright attachments,
including on failure. See `tests/FULL_GAME_BASELINE.md` for policy, limits and
recorded results. `npm run test:browser` includes these checks automatically.

## Worked example 1: launch lane and apparently broken controls

**Symptom:** the ball launched, then fell back into the shooter; Space and Launch
appeared unresponsive. Reaching `playing` or finishing the launch guide had made
the earlier checks pass too soon.

**Cause:** gaps in the upper shooter return geometry admitted a physical ball
back into the lane. The launch flag had already cleared, leaving a ball at the
plunger in a phase that rejected another launch. An exposed right-return rail
end also created a pocket.

**Repair:** close the upper return barrier, join the divider/return rail and
smooth the return. Rearm the same ball if it reaches the plunger, retaining score
and ball number. Keep launch velocity at the existing charge-dependent 12-22;
do not solve a return-path defect by increasing force. Preserve pointer capture,
release outside the button and cancellation behaviour.

**Regression evidence:** actual full plunge beyond the guide into lower physical
play, normal flipper rebounds, weak plunge and retry, unexpected shooter return,
both Space and Launch, capture loss and focus loss. See repair commit `2668b92`
and `tests/physics.test.js`, `tests/browser/play.spec.js`.

## Worked example 2: stationary ball behind a flipper

**Symptom:** a slow ball rested at the heel; the bat moved without dislodging it.
An observed equilibrium was approximately `(356.5564, 775.5288)`, mirrored to
`(143.4436, 775.5288)` for the other flipper.

**Cause:** fixed pivot colliders and the inlane endpoint sheltered the ball from
the moving surface. Contact motion also needed to be communicated correctly to
Matter. The default small-circle decagon could balance on shallow surfaces.

**Repair:** match the drawn rounded capsule, remove oversized fixed pivot
colliders, continue the inlane feed under the bat with aligned upper surfaces,
and supply previous/current poses at each fixed step. Use a 32-sided ball outline
to reduce flat-facet equilibria. Retain actual collision response for both strokes;
do not add a special stationary-ball kick or ball rescue.

**Regression evidence:** stationary and near-stationary balls on both sides,
repeated rise/return at 5/22/55/75 px lever positions, the recorded heel equilibrium,
40 slow approaches around feeds/heels/tips, normal shots, an open central drain
and no kick before contact. See repair commit `0cc5b73` and the physics tests.

## Worked example 3: upper-left curved rail trap

**Symptom:** a screenshot showed the ball stuck against the upper-left curve.
Actual physics reproduced equilibrium near `(41.4230, 163.0060)`.

**Cause:** the rail corner narrowed the opening to approximately 9 px around an
18 px ball. Opening only that corner exposed another catch farther downstream.

**Repair:** move the inner lower corner from x=45 to x=60 at y=193, preserving
ball clearance. Add a continuous downstream lead-in from `(25,470)` to `(45,526)`
and align both orbit guide curves with the open corridor. These are local
mechanical rail changes, not a table redesign or automatic rescue.

**Regression evidence:** a stationary ball leaves the original location under
gravity on the same dynamic body; 25 approach/velocity cases traverse the full
return past y=650; sampled paths for both orbits clear the real colliders. See
repair commit `8450868` and the physics tests. Always check the next rail too.

## Research and reuse reference

Research snapshots, not installed dependencies or guarantees of quality:

- [Pinball Schminball](https://github.com/igorski/pinball-schminball/tree/9dbf8a6):
  Matter.js, separate actors/renderers, target groups and completion rewards.
  Inspected physics/target-group source has MIT notices: retain them for any
  copied code. Check each file and asset; no blanket asset permission is assumed.
  Its mocked rule tests do not establish complete-table physics reliability.
- [Amanda Fager's Pinball](https://github.com/amandafager/pinball/tree/078b6e2):
  Phaser/Matter, constraint-driven bats, launcher gate, audio/hit feedback and
  documented human testers. MIT repository licence; retain notices and verify
  third-party assets. Its documented upper-left trap and relocation workaround
  are cautions, not patterns to copy. The npm test command is a placeholder.
- [Pinball 5.5](https://github.com/marcoakes/pinball-5.5/tree/29ffe58):
  Planck bullet ball, substeps, thick rails and motorised limited hinges.
  Completing a target bank starts a short double-scoring mode. No licence or
  reuse grant was found at that snapshot: learn concepts; do not copy code
  without permission. Its CDN loading does not satisfy our local-asset contract.
- [VPX-JS](https://github.com/vpdb/vpx-js/tree/e8a6d6f): specialised moving/resting
  contacts, collision-time stepping, physical 3D ramps and trajectory fixtures.
  Repository GPLv2; inspected physics headers permit version 2 or later. Do not
  import code without considering resulting GPL and source-distribution duties.
  Prefer independently implemented principles for this small game. It is a
  larger library, not a drop-in ready game or a justified migration for this task.

Before reuse, verify the exact revision, file licence, attribution and asset
provenance. Public GitHub visibility is not permission. Do not import unfamiliar
dependencies or execute third-party setup scripts merely to read an example.

## Future rules and release discipline

When objectives are approved, favour one small, readable progression using
existing shots: a lit target group, completion reward and a clear next objective.
For example, three bumpers, either orbit, then either ramp could celebrate 500
subscribers, retaining progress across three balls and awarding a 5,000-point
celebration bonus once per game. Start without a countdown for accessibility.
This is an idea, not an implemented or authorised rule. Keep progress,
reset/expiry behaviour and repeat awards explicit. Illuminate the next useful
shot, show completion and consider short optional sounds with mute control and
browser gesture requirements, using locally served original/licensed assets.
Consider this feedback before more mechanisms. Defer multiball, complicated
ladders and 3D simulation.

Use the authorised branch, normally `pinball-playtest`; keep `main` unchanged
unless specifically authorised. Inspect the deployment workflow before pushing:
this branch may deploy automatically. For skill/test-only work that must not
publish, the existing workflow supports `[skip pages]` in the commit message.
Do not alter settings or bypass approval gates. Keep source, dependencies and
artwork unchanged when the task only authorises documentation/tests.

Report the exact changes, checks executed, passing/failing/skipped counts, known
problems and limits. Distinguish automated browser play from human playtesting.
If a longer baseline exposes a gameplay defect outside the authorised scope,
keep the evidence and report it before making further gameplay changes.
