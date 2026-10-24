# Audio refinement — listening review

Baseline: `e943319` on `pinball-playtest`. No deployment.

## Investigation and changes

The previous 20-second preview demonstrated a **fixed 17.4545-second loop**, crossing into its next repetition. Its eight bars already contained two related musical phrases, but there was no later arrangement evolution.

The same theme now plays through a deterministic **209.4544-second (3:29) arrangement**, then repeats. It does not generate endless new music. All original notes, 110 BPM tempo, organ/triangle instrumentation, synthesis envelopes, pulse and delay sound remain. A/B phrases retain their existing order. Twenty-four four-bar windows vary only the levels of the original stems: bass weight, organ texture, melody prominence/rests and existing metallic accents. The rhythmic pulse remains constant. Layer balances change smoothly over 0.6 seconds; the end returns to the opening balance. No new composition, random notes or instrument replacement.

The first 17.45 seconds were compared with the actual baseline renderer in Chromium at 44.1 kHz: maximum sample error **0.000000298**, RMS error **0.0000000184**. This is floating-point rounding, rather than a changed opening theme. All four musical stems remain at or below their original gain, without per-section normalisation that would erase quieter passages.

Temporary five-channel offline stems are summed into one mono playback buffer. The previous stereo channels were identical. The retained 3:29 buffer uses **36,947,760 bytes at 44.1 kHz** (about 37 MB; about 40 MB at 48 kHz), larger than the earlier short loop. Temporary offline rendering uses additional memory. Assembly yields between windows to keep input responsive. Runtime still has the same one-source music lifecycle; no ongoing scheduling timer, live orchestra or extra music loop was added. Lower-memory physical mobile devices still need human testing.

The 2.3-second ramp-only roar now uses two low sine pressure tones with only slight movement (47→45 Hz and 69→67.5 Hz), low-pass geological noise, a rough band-passed breath layer and upper air texture. Each noise bed is full-length and non-looping. Removed the old sawtooth, periodic pitch LFO, large pitch falls and repeated half-second noise. There are no formants, syllables or deliberate speech. Existing gain/headroom and previous-roar release behaviour remain. The animalistic character is a synthesis intention, not a claimed listening result.

Only `roar()` changed in `ritual-audio.js`. The loss toll, its ducking, guided spell synthesis and ramp-only trigger are byte-identical. Eyes/lighting, artwork, ball-loss observation, audio controls, music preference/lifecycle, physics, scoring, controls, UI and deployment workflow are untouched.

## Previews

- [Revised isolated roar — 2.3 seconds](../docs/previews/audio-refinement/roar.mp3)
- [Evolving arrangement — approximately 90 seconds](../docs/previews/audio-refinement/music-90s.mp3)
- [Combined gameplay — 18.6 seconds, actual game mix](../docs/previews/audio-refinement/combined-gameplay.mp4)

Music preview guide: unchanged full opening at 0–17.45 s; organ/melody balance recedes around 17–35 s; lighter bass and different balance around 35–52 s; exposed melody/less organ around 52–70 s; melody recedes and rests around 70–87 s, then returns. Later windows continue the arrangement through 3:29. These are restrained changes to the liked theme.

Isolated samples are boosted only for audition to roughly -6 dBFS peak: roar +14.8 dB, music +32.5 dB. **Use the combined video for relative volume judgement**, not those separately boosted files. Combined video has no gain adjustment and uses ordinary launch/flipper input with initial position fixtures for a real Matter-guided ramp/roar and a real drain/toll/duck. It is a controlled short feedback demonstration, not a complete game or ordinary-player shot-success test. Captures had no browser errors. MP3/MP4 are review files, never runtime samples.

**No listening monitor is available here.** Recordings were captured and decoded successfully, and signal/trigger checks passed, but they have not been auditioned. A human must judge whether the roar is unsettling rather than comical, and whether the preserved music's restrained variation is enough. Procedural filtered noise and oscillators can still sound synthetic; no convincing sampled creature quality is claimed.

## Focused validation

20 unit/event checks passed:

```sh
node --test tests/music.test.js tests/awakening.test.js tests/ritual-feedback.test.js
node --test --test-name-pattern 'debug-only|real bottom crossing' tests/feedback.test.js
```

15 distinct Chromium browser checks passed:

```sh
npx playwright test tests/browser/audio2.spec.js tests/browser/audio-refinement.spec.js tests/browser/static.spec.js
npx playwright test tests/browser/ritual.spec.js --grep 'four real routes|CALM stays'
```

Coverage: all arrangement window seams plus full-cycle seam, real layer variation, finite roar sources and non-looping breath beds, desktop/mobile touch controls and persistence, global mute, pause/resume position, rapid toggles, genuine-loss-only toll/ducking, final-ball fixture cleanup/restart, interrupted asynchronous rendering, unsupported audio APIs, all four real guided routes and eyes, CALM independence, and production hosting at Pages and nested WordPress paths. The latter is local static path testing, not deployment to WordPress. Mobile is Chromium touch emulation, not physical iPhone/Safari listening.

An initial new roar test incorrectly read scheduled OfflineAudioContext pitch before rendering any samples (AudioParam still reported its default). The test now suspends after 0.1 seconds of actual rendering before checking frequencies; it then passes without changing the synthesis to satisfy it. The other four cases in that initial focused run passed; the final twelve-case audio/static run and corrected roar case passed. The five unit music cases were also rerun after removing an unused inspection helper.

Measured roar peak 0.0985, RMS 0.0149 in a three-second window; music RMS 0.00253 at master output. A busy music/ritual/mechanical mix peaked below 0.16, comfortably below clipping. Maximum phrase-boundary step was below 0.003 in the normalised score (less than 0.000054 after music/master gains); loop seam 0.00290. All roar groups ended and released. Measurements do not establish subjective quality.

Production build passed, with the existing large Phaser chunk advisory. No full mechanics or three-ball suites were run. Push uses `[skip ci] [skip pages]` so the existing workflow cannot deploy this revision or start those full suites. `main` and the published release remain unchanged.
