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
