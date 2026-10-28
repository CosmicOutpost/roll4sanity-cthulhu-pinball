# Cover Stone placement refinement

**Outcome: no placement approved or committed.** The proposed `(145,495)`, `(250,545)`, `(355,495)` arrangement is a review candidate, not a demonstrated set of deliberately hittable shots. The annotated screenshots are captures of an isolated temporary build, not the deployed game. The yellow circles and numbers are annotations.

## Ordinary-input comparisons

`node tests/stone-refinement-study.mjs` compares four layouts, each with 24 deterministic three-ball attempts using six reactive-flipper thresholds and four input polling intervals. The actionSession helper launches normally and uses ordinary flipper control flags for up to 22 seconds per ball, then leaves the ball hands-off to drain. No positions or velocities are injected in these sessions. These policies are not human players and are not a representative distribution of skill.

| Layout | Qualified front contacts L/C/R | Ramp/orbit captures LR/RR/LO/RO | Finished | Observed stalls |
|---|---|---|---|---|
| Original | 8/11/3 | 48/30/12/13 | 24/24 | 0 |
| Starting candidate `(155,500),(250,540),(345,500)` | 17/37/20 | 42/31/14/26 | 23/24 | left flipper near `(145.7,768.8)` |
| Lower `(185,535),(250,545),(315,535)` | 36/36/47 | 15/22/20/13 | 24/24 | 0 |
| Best current candidate `(145,495),(250,545),(355,495)` | 8/49/20 | 43/37/9/10 | 23/24 | left flipper near `(146.4,769.0)` |

Captures are existing shot-entry flash events, not confirmed completions. Counts do not prove causation; trajectories diverge after each collision. Qualified hits after all four Binds were empowered were original `0/1/0` and candidate `0/2/1`. These small numbers provide no meaningful estimate of human victory rate. Full per-run results are in `simulations.json`.

The lower layout raises contacts but cuts left-ramp captures from 48 to 15 and was rejected. An outward layout `(140,505),(250,545),(360,505)` gave more contacts with no stall in 24 attempts, but fails the unchanged ward clearance requirement: the gap is 22.6px against a required 28px. The upward candidate has ward gaps of approximately 32.7px and 32.6px and passes that test. A previous original-layout simulation observed a similar left-flipper pocket around `(145.7,766.4)` under a different timing policy, so the candidate sample cannot prove a new trap or rule out an increased likelihood. No flipper geometry was altered.

## Aiming evidence and limitations

Fixed-step geometry search used a positioned descending-ball fixture and sampled flipper press timings. Values are elapsed time after that fixture is released, not a human reaction-time measurement. Examples:

- Left stone: right flipper, offset 67px and start y=782; successful presses at steps 7–8 (approximately 58–67ms).
- Centre stone: right flipper, offset 60px and start y=778; steps 5–12 (approximately 42–100ms).
- Right stone: left flipper, offset 73px and start y=778; steps 5–9 (approximately 42–75ms).

These are particular sampled approaches; there may be other windows. They cannot establish whether a player can reliably create those approaches in ordinary play.

A real Chromium keyboard experiment repeated each fixture five times, using ordinary `Slash`/`Z` keyboard events after a one-time position/velocity setup. The target collision was observed from Matter, without injecting a shot velocity after the flipper stroke. Left hit **0/5** (presses arrived at simulation steps 11–16, after the sampled 7–8 window); centre hit **5/5** (steps 8–11); right hit **5/5** (step 8). Under concurrent test load, keyboard event timing varied. These results do not demonstrate human aim, and there was no human playtest. `keyboard-results.json` contains the data; `tests/stone-refinement-keyboard.mjs` is the observer, run against a separately started candidate server.

The proposed stones are immediately adjacent to the printed ramp labels, which still need a human readability review at phone size. The visible face is drawn from the same Matter vertices used for collision; the front strip follows the local face normal used by scoring.

## Candidate validation

- Production build and **86 unit/mechanism checks passed** in an isolated checkout with the candidate positions, including the unchanged ward-clearance check and 96 slow perimeter approaches. The specific flipper fixtures were updated to the sampled positions/timings above.
- **11 desktop/mobile browser checks passed**, including actual guided captures/stone fixtures, screen fitting and touch controls.
- **Two ordinary-input three-ball browser games passed**, with normal launches, natural drains and restart. These games include hands-off drain periods; neither demonstrates a player completing the objective deliberately.
- The earlier `(140,505),(250,545),(360,505)` trial had **84/86** unit checks pass: the 28px clearance guard failed, and a test saw an extra 75-point ward contact. It was rejected; the guards were not weakened.

The simulation experiment uses temporary body repositioning at setup to compare candidate layouts; the game itself does not move, attract or rescue balls. The branch retains the original stone geometry, rules and presentation. No implementation change has been deployed.
