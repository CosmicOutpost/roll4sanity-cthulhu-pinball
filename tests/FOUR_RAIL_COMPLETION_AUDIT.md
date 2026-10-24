# Four-rail completion consistency audit

Baseline: live deployment `35ab1fb`, identical game content to `5149671`. No deployment for this repair.

## Actual identities and findings

| Simulation ID | Kind | Both eyes | Completion roar before repair | After repair |
| --- | --- | --- | --- | --- |
| `left-ramp` | ramp | Emerald `0x21e58d` | Yes | One request |
| `right-ramp` | ramp | Crimson `0xf23c55` | Yes | One request |
| `left-orbit` | orbit | Electric blue `0x329dff` | **Missing** | One request |
| `right-orbit` | orbit | Eldritch violet `0xaf58ff` | **Missing** | One request |

Reproduced before editing: a real Matter-captured left orbit completed, produced one eye event with the correct palette, and produced **zero roar requests**. The observer already delivered all four completions to lighting; `RitualAudio.endSpell` explicitly called the roar only for `kind === 'ramp'`. Existing browser assertions also encoded that previous requirement. There was no separate roar cooldown to adjust.

## Actual event path

1. `PinballSimulation.step` checks the real shot entrance, movement direction/speed and existing capture lock. `beginTravel` creates the `{ shot, started }` identity, temporarily guides the ball and awards the existing entry score/flash. Entry scoring is **not** the awakening event.
2. `updateTravel` follows the unchanged path. At progress 1 it clears `sim.travel`, restores dynamic collisions and the existing exit velocity, and sets the existing 900 ms capture lock.
3. `GuidedFeedback.update` remembers the journey and ball identity. A disappeared journey confirms success only with no replacement guide, the same ball, playing phase, and simulation time at or beyond the original deadline. Restart/reset cancels observation; early disappearance, a replacement ball or non-playing phase does not reward it. Paused simulation time cannot complete a journey.
4. New shared `completeShot` validates the real ID/kind using the existing eye-palette mapping, then routes **that one event** to `lights.completeSpell`, the unchanged completion bell/drone release, and exactly one `audio.roar()` request. The pending journey is consumed before callbacks, so repeated or re-entrant updates cannot replay it.
5. `lights.completeSpell` retains the existing route completion animation and eye cue. `roar()` retains the exact locked synthesiser, gain, 2.3-second envelope and existing 60 ms release of a previous roar. No generic impact cooldown or active-roar check can swallow the new request.

No new physics event API or simulation writes were needed. The renderer observes at most 100 ms of physics catch-up, far shorter than either guided duration (1,550/1,950 ms). The existing 900 ms exit lock also prevents a complete next guide being captured between presentation observations. No normal completion loss or duplicate was found in focused actual-browser checks.

## Intentional exceptions and overlap

- Muted, unavailable or gesture-blocked audio still receives the completion request but does not emit sound. The eyes are independent. Unmuting does not replay an old completion.
- Pause stops active audio and freezes the simulation clock. Resuming an unfinished guide leads to one completion; it does not replay its activation or an already completed roar.
- CALM retains stationary, restrained coloured eyes; it does not mute the roar. Its geometry, colour, strength and lifetime are untouched.
- The pre-existing DEV-only console eye-preview helper remains deliberately visual-only. It is neither a gameplay completion nor production UI and is unchanged.
- Natural successful completions are normally separated by guided duration plus the capture lock; eyes may still overlap. A dedicated stress fixture bypasses **only the test's capture lock** and places the same ball at the next real entrance, then uses actual Matter capture and full guide timing. A left ramp followed by a right orbit completes while the first roar is still alive. Both events and requests are counted; the previous roar releases, the new roar starts, and both eyes atomically switch to violet with a fresh 2,550 ms cue. No mixed palette, stuck eye effect or lost roar. Measured master peak in the stress test stays below 0.3; a separate busy mix includes unchanged music and impacts.

## Focused validation

20 unit/event checks passed:

```sh
node --test tests/ritual-feedback.test.js tests/awakening.test.js tests/music.test.js
```

14 distinct Chromium browser checks passed, including six new end-to-end cases:

```sh
npx playwright test tests/browser/completion-consistency.spec.js
npx playwright test tests/browser/ritual.spec.js tests/browser/audio2.spec.js tests/browser/audio-refinement.spec.js tests/browser/awakening-repair.spec.js --grep 'four real routes|mute, pause|CALM stays|music and DSP|roar uses|real ramp completes'
```

The new cases instrument the actual shared handler, eye event, completion audio and roar request. For each of all four IDs they verify one event/request, matching simulation timestamps, both rendered eye pixels in the correct colour, unchanged 2.55-second lifetime, no duplicate after repeated observation, and no completion/eye/roar from a restarted in-progress run after waiting beyond its original duration. Other cases cover muted CALM orbit completion, pause/resume, no unmute replay, consecutive guides, overlapping colour/audio, headroom and eventual cleanup. Existing checks cover all four routes at desktop and mobile sizes, actual eye alignment, focus loss, interrupted sources and the locked roar graph. Mobile is Chromium emulation; these are not human listening or physical-device playtests.

Validation notes: the new overlap test uses a microsecond-level tolerance for the duration subtraction (floating-point arithmetic can return `2550.000000000001`). An existing offline roar test could render past the source end before JS `onended` disconnected its echo, leaving a roughly -100 dB test-only residual. It now yields at the source-end suspension before rendering the silence tail, retaining strict zero-tail and cleanup assertions without changing synthesis. A concurrent runner shut down a shared Vite server during one repeat; final checks ran against the persistent server using `PINBALL_BASE_URL=http://127.0.0.1:5178/`. The initial compatibility run passed seven cases; the corrected offline case and all six new cases passed in the final run.

Production `npm run build` passed with the existing Phaser chunk-size advisory. No full mechanics or three-ball suite ran.

## Locked content and delivery

Only production changes: shared completion routing in `guided-feedback.js`, and removal of the ramp-only dispatch line from `ritual-audio.js`. Verified byte-identical: the entire `roar()`/ball-loss/cleanup section, all other synthesis, music sources/lifecycle, palettes, lights, spell graphics, main scene, artwork, physics, table geometry, scoring/state, controls, UI, package manifests and Pages workflow. README and old test expectations now describe the approved all-four-shot roar policy. Historical reviews remain historical.

Commit/push only to `pinball-playtest`, with `[skip ci] [skip pages]` to prevent the existing push workflow deploying or running full mechanics suites. `main` and the live Pages version remain unchanged pending approval.
