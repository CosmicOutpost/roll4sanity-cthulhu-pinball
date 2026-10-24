# Awaken Cthulhu presentation review

Baseline: `a6e0731364dfc9de7a21a5dc9887f22fc5d56deb`, `pinball-playtest`.
Reviewed in cloud Chromium, Node 24, existing locked dependencies.

## Changes and limits

All four existing guided paths now carry emerald/gold current, sequential runes,
short trailing glows and geometric arcs near the exit. Activation is local to the
entrance; completion sends a final gold packet along the last part of the path,
then a single crimson pulse at the exit. Physical rail contacts retain their
existing small local reaction. The same two reusable Graphics objects are used;
no particles, new physics bodies or per-event display objects are created.

The illustrated eyes are at table coordinates `(230,391)` and `(310,391)`.
Their graphics depth is 4.5, above artwork/decks/labels but below moving hardware
and ball (5). A completed ramp, rather than its entry score, triggers 250 ms
attack, 800 ms peak and 1500 ms fade. Orbits, bumpers, launch guides, interrupted
journeys, replacement balls and restarts cannot produce this reward.

Procedural Web Audio adds detuned rising drones, rumble, rune sparkles, a
dissonant completion bell with a short feedback delay, and a filtered/noisy
modulated growl on ramp completion. Optional robotic vowel chant defaults off;
it is not presented as intelligible speech. Its own toggle persists separately
from SFX mute. No audio files, services, new dependencies or downloaded assets
were added. The WebM below is review evidence, not a game audio asset.

Audio groups are capped at four; mechanical voices retain their cap of ten.
Sources have finite scheduled lifetimes, completion callbacks disconnect every
node including delay feedback loops, and pause/mute/focus loss/restart release
active groups. Resuming mid-guide starts a drone at current progress without
replaying activation, old rune notes or a missed completion. CALM uses stationary
entrance/exit symbols, no chasing current or eye animation, independently of
audio. The OS reduced-motion preference and saved manual override are preserved.

Physics, geometry, ball movement, flippers, scoring, controls, progression,
artwork, engine/dependencies, render geometry and deployment workflow are
byte-for-byte unchanged from baseline. `main` is unchanged.

## Focused validation

Passed **10 presentation unit tests**:

```sh
node --test tests/ritual-feedback.test.js
node --test --test-name-pattern 'score cues|repeated hits|reduced motion|bumper hit bursts' tests/feedback.test.js
```

Passed **30 focused Chromium tests** (4 new ritual checks, 25 existing
presentation/static checks, then 1 additional production render/muted-completion
check):

```sh
npx playwright test tests/browser/ritual.spec.js --grep-invert 'render budget' --reporter=line
npx playwright test tests/browser/feedback.spec.js tests/browser/bumper-colours.spec.js tests/browser/static.spec.js tests/browser/effects.spec.js --grep-invert 'natural fixture drains' --reporter=line
# Against the final production preview on port 5182:
PINBALL_BASE_URL=http://127.0.0.1:5182 npx playwright test tests/browser/ritual.spec.js --grep 'render budget' --reporter=line
```

The first command above reproduces the original four-check run; the render-budget
check was added afterwards. All four real routes were captured in desktop
1440x1000 and mobile 390x844 viewports. Mechanism fixtures set only an initial
ball pose after an ordinary launch and the existing recapture lockout; the normal
Matter engine and guide clock then handle capture/travel/return. These fixtures
are presentation checks, not evidence of human shot-making or game enjoyment.

Checks include current head matching the guided ball, rising oscillator pitch,
nonzero conservative analyser output, completion reward gating, bright pixels at
both illustrated eye centres, eventual darkness, pause/mute/focus/restart source
cleanup, mute through completion without replay, optional chant cleanup and
independence, reduced-motion preference, bounded nodes/display objects and no
browser exceptions. Existing checks cover eight screen sizes down to 320x568,
trusted touchscreen input, local mechanism feedback and bumper colours.

`npm run build` passes; the existing large Phaser chunk warning remains.
The built site also loads at the GitHub Pages repository prefix and a nested
WordPress prefix with local assets only. A separate 390x844 production animation
sample recorded 40 frame intervals: median **16.7 ms**, p95 **17.4 ms**, with
constant display-object count. This is a short cloud-browser sample, not a
benchmark across phones or a guarantee about older devices.

Per the requested presentation-only scope, the full mechanics and three-ball
suites were **not run**. The commit uses `[skip ci] [skip pages]`: the existing
push workflow otherwise runs those full suites and deploys automatically. No
workflow or repository settings were changed. Deployment awaits approval.

## Visual and motion evidence

- [Desktop spell at full travel intensity](../docs/previews/awaken-cthulhu/spell-1440.png)
- [Desktop eyes at peak brightness](../docs/previews/awaken-cthulhu/eyes-1440.png)
- [Mobile spell](../docs/previews/awaken-cthulhu/spell-390.png)
- [Mobile eyes](../docs/previews/awaken-cthulhu/eyes-390.png)
- [Actual canvas recording with generated audio](../docs/previews/awaken-cthulhu/ritual.webm)

Screenshots were inspected for alignment/readability. The recording uses the
same initial ramp-entry fixture, followed by live guided travel, completion and
eye fade, with ordinary held flipper input. VP8/Opus, 540x960, approximately five
seconds. Recorded output peaks at approximately -20 dBFS without clipping.
This does not establish perceived loudness or sound quality on human speakers.
Human listening, real-device mobile performance and preference for the optional
chant remain playtest items. No mechanical issues were investigated or changed.
