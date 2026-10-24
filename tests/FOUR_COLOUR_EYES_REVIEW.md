# Four-colour Cthulhu eyes

Baseline `f0ea106`; work on `pinball-playtest` only. Presentation only; no deployment.

| Actual simulation ID | Required kind | Both eyes | Base colour |
| --- | --- | --- | --- |
| `left-ramp` | `ramp` | Emerald green | `#21e58d` |
| `right-ramp` | `ramp` | Crimson red | `#f23c55` |
| `left-orbit` | `orbit` | Electric blue | `#329dff` |
| `right-orbit` | `orbit` | Eldritch violet | `#af58ff` |

`eye-colours.js` resolves explicit IDs and validates the kind; it never relies on
the order of `SHOTS`. Unknown IDs, launch travel and mismatched kinds do not light
the eyes. The existing `GuidedFeedback` observer already observes both kinds and
passes the actual completed shot to `TableLights.completeSpell`. Removing the
ramp-only visual gate extends awakening to both orbits. Entry/bumper score cues
still cannot awaken the eyes.

The cue carries one palette for both eyes. Each new completion atomically
replaces that cue, carrying over its current envelope strength to avoid a dark
blink, and starting a new 2550ms lifetime. The renderer clears the eye graphics
each frame, so no old-colour layer, queue or timer survives the handover. Colour
switches together in both eyes; colours are not layered or left blended. Fresh
activations retain the 250ms attack, 800ms peak and 1500ms smooth fade. Existing
positions `(230,391)/(310,391)`, all ellipse sizes/alphas, bright centres, graphics
depth 4.5, stationary reduced-intensity CALM drawing, and pause behaviour remain.

All audio files/code, `guided-feedback.js`, feedback observer, physics, scoring,
controls, renderer, artwork, main scene, dependencies and workflow are unchanged.
Magic rail drawing is untouched apart from forwarding eye cue data to the eye
renderer. Orbit completion audio remains the existing gong; the growl and chant
remain **ramp-only**. No technical reason to change that trigger was found.

## Validation

Passed **13 focused unit checks**, **14 Chromium browser checks**, and build:

```sh
node --test tests/awakening.test.js tests/ritual-feedback.test.js
npx playwright test tests/browser/ritual.spec.js --grep 'four real routes' --reporter=line
npm run build
npx playwright test tests/browser/eye-colours.spec.js tests/browser/ritual.spec.js tests/browser/static.spec.js tests/browser/awakening-repair.spec.js --grep-invert 'four real routes' --reporter=line
```

Unit checks cover reversed real shot order, kind validation, all 16 old/new colour
pairs in both FULL and CALM (including repeated same-colour completions), brightness
continuity, one-cue replacement, expiry, matching geometry/colours in both eyes,
bright centres, mode changes and the existing envelope/guide observer checks.

The real-table browser fixtures cover all four successful Matter captures in
1440x1000 and 390x844 viewports. Only an initial pose is set after an ordinary
launch and the real recapture lockout; existing Matter capture and guided travel
then complete normally. At each peak, both iris RGB samples match independent
expected values (within two channel levels), both centres remain bright, and cue
identity/kind/colour match. These checks also confirm the preserved moving magic
current follows the ball and ramp-only growl/chant audio stays ramp-only.

Separate eye-receiver fixtures exercise rapid overlapping colour changes in the
actual canvas, FULL/CALM switching, pause and final return to the exact unlit
pixels. These are presentation fixtures, not claims of ordinary human shots.
Other focused checks cover mute/pause/focus cleanup, preference persistence,
trusted touch input, rendering bounds, local production assets under Pages and
WordPress subdirectories, and absence of the development eye helper in production.

Screenshots were inspected directly. All eight full-resolution table screenshots
were saved from the real-capture tests, not isolated drawings. Existing broad
test assertions were updated for orbit awakening and coloured halos; historical
preview images remain untouched. No full mechanics or three-ball suite was run.
The build retains the existing large Phaser chunk warning. Human playtesting
and physical-device coverage remain outside these focused automated checks.

Commit flags `[skip ci] [skip pages]` prevent automatic full suites/publication.

## Actual-table screenshots

| Shot | Desktop | Mobile |
| --- | --- | --- |
| Left ramp, emerald | [1440x1000](../docs/previews/four-colour-eyes/left-ramp-eyes-1440.png) | [390x844](../docs/previews/four-colour-eyes/left-ramp-eyes-390.png) |
| Right ramp, crimson | [1440x1000](../docs/previews/four-colour-eyes/right-ramp-eyes-1440.png) | [390x844](../docs/previews/four-colour-eyes/right-ramp-eyes-390.png) |
| Left orbit, blue | [1440x1000](../docs/previews/four-colour-eyes/left-orbit-eyes-1440.png) | [390x844](../docs/previews/four-colour-eyes/left-orbit-eyes-390.png) |
| Right orbit, violet | [1440x1000](../docs/previews/four-colour-eyes/right-orbit-eyes-1440.png) | [390x844](../docs/previews/four-colour-eyes/right-orbit-eyes-390.png) |
