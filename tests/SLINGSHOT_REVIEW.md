# Right slingshot review — controls-only follow-up

Baseline: `40275956c1b50a499216850a5ca5d05141cda2a4` on
`pinball-playtest`. No physics, geometry, scoring, artwork or shot paths changed
in this review. The desktop control change only remaps existing actions.

## Reproduction in the actual physics

Use the existing `PinballPhysics` class with locked Matter.js 0.20.0, the
unmodified table and its 120 Hz `step()`. Starting from a fresh simulation:

```js
const sim = new PinballPhysics();
sim.controls.plunger = true;
for (let i = 0; i < 150; i++) sim.step();
sim.controls.plunger = false;
sim.launch();
while (sim.state.phase === 'playing') sim.step();
sim.destroy();
```

Imports are `src/game/physics.js` and, for passive contact observation,
`matter-js`. Observe `collisionStart`, ball position/velocity, `sim.elapsed`,
and changes to `sim.flashes.get('sling:1')`. Do not move the ball or alter forces,
controls, collision handlers or timers during the trace. Times below include
1,250 ms of initial charging. The same ball remains physical throughout the
rebound sequence; no guided shot or rescue intervenes.

| Time (ms) | Event | Ball position (table pixels) |
| --- | --- | --- |
| 6,692 | Right sling, outer face, active kick | 400.36, 615.10 |
| 7,117 | Shooter-side wall | 463.42, 466.36 |
| 8,008 | Right sling, outer face, active kick | 405.21, 655.28 |
| 8,033 | Rubber post at 424, 638 | 407.94, 642.30 |
| 8,058 | Right sling contact, cooldown suppresses coil | 402.19, 631.79 |
| 9,050 | Right return rail | 424.59, 617.39 |
| 9,067 | Same rubber post | 419.90, 622.11 |
| 9,133 | Right sling, outer face, active kick | 401.33, 623.13 |
| 10,475 | Right sling, main-playfield face | 336.56, 674.12 |
| 14,083 | Natural central drain; ball 2 ready | — |

A real Chromium reproduction using only a normal Space hold/release also
observed four right-sling flashes at 6.76, 8.07, 9.19 and 10.44 seconds,
followed by a natural drain at 14.51 seconds. A passive requestAnimationFrame
observer recorded the same ball ID (54), playing phase and no guided travel at
each flash. Browser timing changes the exact trajectory, but reproduces the
rebound sequence without injecting physics state or synthetic in-page input.

A second fixture, initially at (415, 570), velocity (0, 4), with no flipper input,
reproduces three outer-face kicks at 225, 1,508 and 3,033 ms, then an escape past
the tip at 4,283 ms and natural drain at 7,933 ms. Placement happens only once,
before stepping. An exploratory sweep of 30 initially non-overlapping right-side
positions/velocities also completed without a permanent trap. This is bounded
coverage, not proof that every trajectory escapes.

## Finding

This is a collision-response/ball-flow issue, beyond ordinary sling exchanges.
All three triangle faces trigger the same 50-point active kick after the solver,
regardless of contact face or incoming direction. On the right the assigned
velocity is (-10.66, -7.41), including on the *outer* face where leftward motion
points into the solid triangle. The next solver step must reject that motion.
For example, at 6,700 ms velocity is already (+2.57, -8.85): the ball goes up
along the outside into the return corridor, drops back and triggers again.
The 160 ms cooldown prevents rapid repeated coil firing but cannot prevent the
roughly 1.1–1.5 second circulation seen here. The nearby post adds extra contacts.
The left sling uses the mirrored rule, so any future repair needs both sides.

These runs show a temporary loop, not a permanent stuck ball, tunnelling,
sleeping-body failure or failed flipper input. Reproducing it without any flipper
input rules out the keyboard mapping as its cause.

## Proposed mechanical work — requires approval

First add mirrored fixtures for outer-face arrivals, tip/underside contacts,
normal inner-face sling shots and full-game routes. Then assess which face
represents the active sling rubber: ordinary passive restitution on other faces,
and an outward, contact-appropriate coil response on that intended face. Compare
shot variety, repeat contacts, inlane feeds and natural drains before choosing a
small change. Do not increase launch/flipper force, add rescue impulses or move
rails as a substitute for diagnosing the response. No such repair is included.

## Why ordinary play can feel less exciting

- Intentional shots compete with autonomous rebound sequences. A player gets
  less useful time at the bats when the ball keeps recirculating outside a sling.
- Uniform sling kicks erase differences in incoming speed and contact location;
  repeated similar trajectories can feel busy without offering much control.
- Ramps and orbits have narrow upward-entry conditions and simplified guided
  travel. Their route reliability is tested, but that does not establish how
  easily a human can aim at them or distinguish a well-timed shot from luck.
- The new sound and point captions improve clarity, but many identical +50
  events provide less satisfaction than a deliberate, readable shot and return.

For this small celebration game, prioritise reducing unintended rebound loops
and assessing repeatable aimed shots/returns with human playtests. Keep the
current audiovisual feedback; postpone missions, engine replacement and major
layout changes. Automated game completion alone is not a measure of enjoyment.

## Approved face correction and clearance repair

Baseline `dc17bed` passed 24 Matter/state and 24 browser tests before physics
edits. Mirrored regressions were added first: main-face hits passed; outer,
underside and tip contacts incorrectly fired, and the corridor tests failed.

The scoped correction checks the actual Matter contact normal against the long
playfield-facing edge and checks that contact lies between its endpoints. Only
that face activates the existing coil. Kick vector, speed, cooldown and the
50-point valid-hit award are unchanged. Other faces keep existing passive
restitution, without coil lighting, sound or points. No rule values changed.

### Clearance blocker discovered by regression testing

Contact fixtures pass, but making back contacts passive exposes an existing
physical wedge. The right lower outer triangle vertex is `(400,687)`; the
inlane rail is centred at x=422 with width 9, leaving only 17.5 px before its
inner surface at x=417.5. The ball is 18 px across. The left side is mirrored.

A ball initially at `(405,600)` with velocity `(2,4)` settles at
`(408.6797485546,685.2424188865)`. The mirrored fixture settles at
`(91.3202514454,685.2424188865)`. After 20 simulation seconds, both remain in
playing phase with zero velocity, touching the sling and the vertical inlane
rail. `tests/slingshot.test.js` retains these failures and the stationary cases.
The incorrect back-face kicks had been dislodging balls from this wedge.

A proposed clearance-only change is to move the two lower outer vertices from
`(100,687)` / `(400,687)` to `(105,687)` / `(395,687)`, giving 22.5 px clearance.
This would keep both active faces, rail paths, controls, launcher, ramps and
point values unchanged. Geometry changes require the user's specific approval;
the user subsequently approved these exact two changes, which are now applied.
The matching outer triangle outlines follow the same vertices; no artwork
styles or other table geometry changed.

Validation of the face-only draft: 33/37 Node tests pass; four mirrored corridor
and stationary-wedge regressions fail as intended. Build succeeds. Chromium
reports 24/25 tests passing: the reactive three-ball game fails its existing
six-second pocket detector near `(91.31,685.27)`, while the slower three-ball
game completes. The new ordinary-Space launch contact trace passes (back-face
contacts stay passive, a main-face hit remains active, and the ball reaches the
flippers and drains naturally). No assertion was removed to hide the wedge.
Those failures describe the intermediate face-only draft, which was not
committed, pushed or deployed. The approved clearance repair is validated below.

### Final repair and gameplay observations

With both approved vertices changed, `npm run check` passes all 37 Node tests
and builds successfully. The 13 new sling checks cover 18 main-face approaches,
36 outer/underside approaches, 18 tip approaches, two stationary wedge positions,
48 corridor approaches and mirrored response comparisons. Every corridor case
drains naturally without rescue; both sides include returns into the physical
flipper area. Main-face kick velocity and 50-point awards are unchanged.

An exploratory actual-Matter comparison ran eight complete three-ball games per
version (baseline `dc17bed` versus repaired physics). Each uses ordinary control
booleans, full-charge plunges, reactive pulses checked every 60 or 140 simulation
ms at y thresholds 720/735/750/765, 160 ms pulse targets with 260 ms release gaps,
and releases after 22 seconds per ball. Only fixed steps advance play; no ball
placement, forced drains or rescue. All eight games complete in each version.

| Observation across eight games | Before | Repaired |
| --- | ---: | ---: |
| Outer-face coil activations | 81 | 0 |
| Completed ramps/orbits | 34 | 22 |
| Distinct ramp/orbit routes across all games | 4 | 4 |

The incorrect circulation is removed, and all routes remain available. These
automated players do not demonstrate increased shot variety: completed shots
actually decrease in this sample. This is a narrowly scoped mechanical repair,
not evidence that the table is now more exciting. Human assessment of deliberate
shot timing and satisfying returns remains necessary before further tuning.

The deterministic normal-launch trace now contacts the right back at 6,692 ms,
then its corner at 6,850 and 6,942 ms, all passively, and drains naturally at
9,183 ms. The earlier repeated right-side coil kicks are absent. The left
main-face coil still fires at 5,067 ms. This trace uses the same full-charge
launch and no flipper inputs as the original reproduction; faster drainage is
not itself a measure of better gameplay.

Final production-browser run: all 25 tests pass at
`/roll4sanity-cthulhu-pinball/`, including both complete three-ball games, real
keyboard/touch controls, scoring/audio feedback, both static hosting paths and
the new passive-back contact trace. Reactive game: 75.1 simulation seconds,
7,800 points, both orbits and right ramp; slower game: 77.9 seconds, 5,950 points.
Both finish with natural drains, restart and no runtime/request/physics-invariant
violations. Scores are observations, not fixed assertions. The existing Vite
large-bundle advisory remains; no dependencies or artwork styles changed.
