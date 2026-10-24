# Horror Arcade Audio Pass 2 — review

Baseline: `bc0660027ac4cc3755efd629a376bf067a9dd359` on `pinball-playtest`, including the verified four-colour eyes. Presentation/audio only. No deployment is authorised for this pass.

## What changed

- Removed the robotic syllables, CHANT control and separate old awakening growl. Successful ramps now play one 2.3-second roar: falling/modulated bass, a waveshaped midrange throat, detuned body and filtered noise/breath, with a closing low-pass filter and fading echo. Repeated requests release the previous roar rather than stacking bodies. No words or speech are claimed. Orbit synthesis and guided-shot observation are unchanged.
- Added an original eight-bar, 110 BPM D-minor instrumental loop. The D–F–E–D motif returns with chord and melody variations through B-flat, G minor and a dissonant dominant. Triangle bass ostinato, dark organ layers, a quiet filtered clock pulse and two sparse metallic accents provide movement without a dance beat. Three cycles are rendered offline once; the middle cycle includes neighbouring release/echo tails. One looping buffer source plays the 17.4545-second result without a scheduling timer.
- Replaced the drain cue with descending D–C–A hollow bells and inharmonic partials, a short echo and 1.85-second total envelope. A read-only Matter `afterUpdate` observer records an actual crossing of the existing y=942 drain boundary, then the existing loss transition must identify the same ball and ball number. Count-only changes, weak serves and debug teleports below the boundary do not sound it. The last genuine drain also retains the existing game-over effect.
- MUSIC ON/OFF replaces CHANT in the same footer position. Default ON, separately persisted; blocked storage defaults ON. SFX remains global mute for all audio. CALM and the four eye/lighting behaviours are unchanged.
- Music starts only after the existing trusted-gesture audio unlock, pauses/mutes at its current position, resumes without overlapping loops, and stops at game over. Restart begins at the start. Destruction releases sources/listeners and drops the rendered buffer, including when offline rendering finishes late. Rapid toggling retains at most one 30 ms retiring fade, disposed before starting another loop. No intervals or recurring JS audio timers.
- Genuine loss ducks music to 20% of its normal gain with a 35 ms attack, a short hold and restoration over 1.85 seconds. Offline synthesis unsupported or failing disables music gracefully, leaving available effects/gameplay intact.

No third-party library, downloaded sample, runtime media asset, package or workflow change was added. The four recordings below are review material in `docs`, not imported into the game or production build.

## Recordings and honest listening limits

- [Cthulhu roar — 2.3 seconds](../docs/previews/horror-audio-pass2/roar.mp3)
- [Background music — 20 seconds, crosses the loop seam](../docs/previews/horror-audio-pass2/music-20s.mp3)
- [Ball lost — 1.8 seconds](../docs/previews/horror-audio-pass2/ball-lost.mp3)
- [Combined gameplay — 18 seconds, actual in-game mix](../docs/previews/horror-audio-pass2/combined-gameplay.mp4)

The isolated MP3s are linearly boosted to approximately -6 dBFS peak for easier audition: roar +14 dB, music +32.6 dB, loss +22.2 dB. **Do not compare those files' relative volumes.** The combined H.264/AAC video preserves the game master levels without gain adjustment. It includes music, ordinary Space launch/flipper input, successful Matter-guided ramp completion/eyes/roar, a genuine drain/toll/music duck and another launch. Initial ball-position fixtures place the ball near a ramp and subsequently above the real drain so the short capture includes both events; this is a controlled feedback demonstration, not a complete-game or ordinary-player shot-success test. No browser errors were reported during recording.

These recordings have **not been listened to here**: this environment provides capture/signal inspection but no usable listening monitor. Human listening review is required for musical enjoyment, timbre, perceived volume on real speakers and whether the procedural roar feels monstrous. Oscillator/noise synthesis may still sound synthetic; it does not reproduce an actor or sampled creature. No claim of intelligible speech or convincing creature quality is made.

## Focused validation

Passed 19 unit/event checks:

```sh
node --test tests/music.test.js tests/awakening.test.js tests/ritual-feedback.test.js
node --test --test-name-pattern 'debug-only|real bottom crossing' tests/feedback.test.js
```

Passed 27 distinct Chromium browser checks (plus three targeted repeat checks after final lifecycle/test refinements):

```sh
npx playwright test tests/browser/audio2.spec.js
npx playwright test tests/browser/ritual.spec.js tests/browser/awakening-repair.spec.js tests/browser/feedback.spec.js tests/browser/static.spec.js --grep 'four real routes|CALM stays|real ramp completes|music preferences|audio unlocks|actual phone touch|without browser audio|table and essential controls fit|production build runs'
npx playwright test tests/browser/audio2.spec.js tests/browser/feedback.spec.js --grep 'final-ball fixture=true|destroy during|audio unlocks'
```

The initial audio2 run passed its seven then-existing cases; its eighth asynchronous-destroy case passed in the last targeted run. Coverage includes desktop 1440px and mobile 390px touch controls, eight viewport fitting cases, all four real guided eye mappings in FULL/CALM, ramp-only roar, unchanged orbit completion, gesture restrictions, saved/global mute and music settings, pause position, rapid toggles, loss gating/ducking, final-ball fixture/restart cleanup, pending-render destruction, unsupported APIs, blocked storage and both production hosting paths. Mobile is Chromium touch emulation, not a physical iPhone/Safari audition.

Production `npm run build` passed. Existing large Phaser chunk advisory remains. Full mechanics/three-ball suites were deliberately not run because gameplay did not change.

Measured in Chromium (linear sample amplitudes, before preview-file boosts):

| Signal | Peak | RMS / observation |
| --- | ---: | --- |
| Normal music at master output | bounded below 0.012 | RMS 0.00271 |
| Isolated roar | 0.0962 | RMS 0.0180 over 3-second analysis window |
| Isolated loss | 0.0396 | RMS 0.00606 over 3-second window |
| Bell + roar + loss overlap | 0.1245 | All finite groups cleaned up |
| Running music + ritual + representative coincident mechanical impacts | 0.1322 | About -17.6 dBFS peak; no clipping in measured mix |

Music RMS is about 16.5 dB below the roar and 7 dB below the loss cue before ducking. The normalised music buffer's seam step is 0.00290 versus a 0.03594 maximum adjacent step elsewhere, and only about 0.000052 after music/master gains. A 20-second real-time capture kept the same source across the loop boundary. Sources/groups were empty after destruction. These measurements establish headroom and continuity, not subjective sound quality.

## Preservation and delivery

Verified byte-identical to baseline: eye palettes, lighting, spell lights, guided feedback observer, physics, table geometry, rules/state, renderer, controls, main scene, artwork, package manifests and Pages workflow. `feedback.js` only adds read-only audio loss evidence and music lifecycle calls; the existing lighting pulse remains unchanged. No scoring or simulation writes were introduced.

The commit uses `[skip ci] [skip pages]` to prevent the existing push workflow from running full mechanics suites or deploying. Work is pushed only to `pinball-playtest`; `main` and the currently published release remain unchanged pending approval.
