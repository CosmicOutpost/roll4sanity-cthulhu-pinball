# Eye visibility and chant repair

Baseline: game `3e24ad7`, deployed through workflow-only commit `5339348`.
Changes are confined to presentation, documentation, focused tests and evidence.

## What was reproduced

The completion observer in `guided-feedback.js` already works: a real captured
ramp clears `sim.travel` at the expected time, and the observer calls both
`lights.completeSpell` and `audio.endSpell` once. Initial-pose fixtures in the
actual running table confirmed the cue at completion, not at entry. No universal
failure of ramp completion was reproduced in FULL mode, so this observer and
the mechanics have not been changed.

There were two visibility problems. CALM had **two independent suppressions**:
`completeSpell` did not create an eye cue, and `SpellLights.draw` refused to draw
eyes in reduced mode. The OS reduced-motion preference can select CALM without
a player manually toggling it. Also, `setReduced` cleared the entire cue map,
permanently cancelling an in-progress awakening when changing modes. The FULL
effect's 5x3 table-pixel centre became roughly 3x2 CSS pixels on a phone and
resembled the already bright painted eyes. The user's saved local preference
cannot be inspected from this environment; CALM is a reproduced cause, not a
claim about their browser's setting.

The original 941x1672 image is drawn at 540x960 centred at (270,480), with no
crop or camera translation. Eye centres (230,391) and (310,391) correspond to
source-image positions approximately (401,681) and (540,681). Inspection of
the illustration and full-table screenshots confirmed alignment. Eye depth 4.5
already sits above art (-1), decks and labels (0/4), below moving mechanisms and
ball (5). Neither coordinates nor layering needed changing.

The chant default was OFF. Its enabled voice was four 150ms pulses through one
bandpass filter. An offline render of the actual original graph measured chant
RMS 0.000551 against growl RMS 0.005199 over the first 2.2 seconds: approximately
19.5 dB lower, explaining why the growl masked it even with CHANT enabled.

## Repair

- FULL: broader layered gold halos, larger amber irises/white-hot centres and
  short stationary light rays, accurately over both printed eyes. Timing stays
  250ms attack, 800ms peak and 1500ms fade. No new flashing or ball-sized changes.
- CALM: one stationary amber cue with soft attack/fade, no white flare or rays.
  Changing modes preserves the original cue timestamp and expiry rather than
  deleting or restarting it. Pause hides lighting and freezes its existing clock.
- New players get CHANT ON, including with blocked storage. Both saved ON and
  saved OFF remain authoritative. The same footer control was operated by real
  click and touch input; no gameplay keys or layout changes were added.
- Six formant-shaped syllables use three parallel vocal resonances, stepped
  pitch, light quantisation, filtered procedural consonant noise and a short echo.
  The rhythm is intended as a memorable robotic ritual chant. It is **not claimed
  to say intelligible "Cthulhu awakens"**. With chant enabled, its accompanying
  growl and ramp bell are ducked; ordinary rail/travel sounds are unchanged.
- Eyes and enabled chant are initiated by the same successful ramp completion.
  Muting still suppresses all audio, while lighting remains independent. Pause,
  blur, restart and terminal drain cues release audio; old syllables do not replay
  on resume/unmute. Nodes remain bounded and disconnect after their envelopes.
- Temporary console-only `window.previewCthulhuEyes()` is guarded by Vite's
  `import.meta.env.DEV`. It changes only eye lighting, not score/ball/shot state.
  Production builds contain no helper name, UI or extra key binding.

The new isolated chant RMS is 0.007349 versus ducked growl RMS 0.002166 (about
10.6 dB above it). The complete ritual bell/growl/chant mix peaks at 0.05892,
approximately -24.6 dBFS. This is measured electrical signal and clipping
headroom, not a human listening judgement or a speaker loudness guarantee.

## Focused validation

Passed **10 presentation unit checks**, **19 Chromium browser checks**, and build:

```sh
node --test tests/awakening.test.js tests/ritual-feedback.test.js
npm run build
npx playwright test tests/browser/awakening-repair.spec.js --reporter=line
npx playwright test tests/browser/ritual.spec.js tests/browser/static.spec.js tests/browser/feedback.spec.js --grep 'four real routes|CALM is stationary|mute, pause|production build runs|table and essential controls fit' --reporter=line
```

Checks cover both real ramps, all four preserved spell paths, onset synchrony
(audio groups within 25ms, visual cue observed within 100ms), full cue lifetime,
white centres and increased halo brightness over the actual artwork, mode
switching, mute/pause/blur/restart, preference persistence, trusted mobile touch,
eight viewport sizes, synth levels/resource cleanup, hosting subdirectories and
development-helper absence in production. Screenshots were inspected directly.
Mechanism fixtures set only an initial pose after an ordinary launch; real
Matter capture and the existing guide clock then run normally. They do not prove
ordinary human shot-making. Human listening and physical-device testing remain.

Two initial visual assertions were corrected: an arbitrary absolute halo RGB
threshold was replaced by a meaningful increase against the actual unlit artwork;
duration comparison now uses a tight numerical tolerance for floating-point
subtraction. No source changes were made to hide test failures. Final checks pass.

Full mechanics and three-ball suites were deliberately **not run**. The existing
large Phaser bundle warning remains. Physics, geometry, scoring, controls, artwork,
guided-feedback observer, game-state code, renderer and dependency lockfile are
unchanged. No deployment or workflow changes are included. Commit flags
`[skip ci] [skip pages]` prevent automatic full-suite runs and publication.

## Evidence

- [Original FULL peak, actual mobile table](../docs/previews/awakening-repair/before-full-peak.png)
- [Original CALM after completion, actual mobile table](../docs/previews/awakening-repair/before-calm-peak.png)
- [Repaired desktop FULL peak](../docs/previews/awakening-repair/after-full-1440-peak.png)
- [Repaired mobile FULL peak](../docs/previews/awakening-repair/after-full-390-peak.png)
- [Repaired mobile CALM cue](../docs/previews/awakening-repair/after-calm-390-peak.png)
- [Isolated procedural chant capture, Opus/WebM](../docs/previews/awakening-repair/ritual-chant.webm)
- [Real ramp/eye/chant event video, VP8/Opus](../docs/previews/awakening-repair/awakening-with-chant.webm)

The recordings are review evidence under `docs`, not game audio assets. The event
video uses the real ramp fixture and ordinary held flipper input; the isolated
audio capture plays the identical procedural chant without the other effects.
No downloaded images, audio samples, services or runtime dependencies were added.
