# Horror sound and lighting pass — 23 October 2026

Baseline: `df8495bd1888f53c41269a599fd0a02cebb83323` on `pinball-playtest`.
The existing 45 mechanism/state tests passed before edits. No physics, geometry,
flipper, launcher, scoring/progression, controls, artwork or dependency changes.
The simulation and state modules are unchanged byte-for-byte.

## Effects

- Existing mechanical flipper, sling and launch sounds retained. Bumpers gain a
  short clack/bell/deep undertone; wards have a different metallic/occult impact.
- Actual metal-rail contacts get a quiet local brass glow and descending ring;
  soft contacts are filtered and rail feedback is limited to once per 350ms.
  Matter's collision callback uses per-step displacement, so feedback normalises
  its speed measurement without changing any physics value.
- Ramp and orbit scores trigger supernatural chimes and entrance symbols. A
  short trail of brass/emerald studs follows actual guided-travel progress,
  offset from the ball's centre line. Larger ramp awards have richer layering.
- Ramp scores briefly warm the existing illustrated eyes, with a six-second
  minimum between eye cues. Nothing in the original image was repainted.
- Lost-ball and final game-over transitions have separate short ominous sounds
  and a small crimson drain symbol. Weak plunge returns and restarts stay silent.
- Smooth event envelopes coalesce repeated impacts instead of rapid flashing.
  The device's reduced-motion preference is honoured by default. The footer
  LIGHTS toggle remembers a manual override when storage is available; CALM
  removes chase/eye animation and uses low, stationary scoring cues. Mute stays
  independent. Pause, focus loss and restart silence/clear the appropriate cues.

Everything is generated locally using existing Web Audio and Phaser Canvas.
No binary assets, samples, services or packages were added. Light rendering uses
only two graphics objects and at most 16 event envelopes; paths are sampled once,
with 33 possible studs per route. Audio remains bounded to ten oscillator voices,
with priority for ramp/orbit cues. Effects render below the ball and flippers;
eyes render below all mechanisms. There is no looping ambient track or timer.

## Proportionate validation

- `npm run check`: 51 Node tests passed, production build passed. This retains all
  previous physics/state tests, including the quick eight-policy Matter games.
- Six new observer/envelope tests cover event deduplication, eye restraint,
  drains versus weak returns/restart, bounded/coalesced glows, reduced motion and
  blocked storage, rail impact thresholds, and an exact 15-second actual-Matter
  trajectory comparison with and without the feedback observer.
- Production Chromium checks under `/roll4sanity-cthulhu-pinball/`:

  ```sh
  npm run preview -- --host 127.0.0.1 --port 5180 --strictPort --base=/roll4sanity-cthulhu-pinball/
  PINBALL_BASE_URL=http://127.0.0.1:5180/roll4sanity-cthulhu-pinball/ npx playwright test --grep-invert 'full three-ball'
  ```

  **31 passed, 0 failed, 0 skipped (2.1 minutes); the two full-game cases were
  intentionally excluded.**

  The two longer ordinary-input browser games were deliberately not repeated
  locally for this presentation-only change, as requested. They remain intact;
  the existing GitHub workflow will still run them once after push.
- Six focused browser cases use explicit initial-pose mechanism fixtures and the
  actual running Matter engine, rather than invoking scoring/effect callbacks.
  They cover desktop/mobile ramp/orbit sound, progress-aligned light trails,
  eye layers, pause, real ward/rail contacts, three fixture drains/game over,
  persisted reduced motion and muted scoring. They are not full-game playtests.
- Existing checks retain eight viewport fits (now including the LIGHTS control),
  real phone touch input, keyboard/focus safety, actual Web Audio signal and
  conservative levels for all eleven sounds, voice bounds, mute persistence,
  unavailable audio/storage, launch regressions and static local-only assets
  under both repository and nested WordPress paths.

The existing Phaser large-chunk build warning remains. Desktop/mobile are
headless Chromium plus phone emulation, not a physical-device or human listening
session. Final sound balance and subjective atmosphere need human review.

## Publication boundary

Commit and push this draft only to `pinball-playtest`, with `[skip pages]` in the
commit message. Do not deploy until the user approves. Keep main unchanged;
`df8495b` remains the previous working release in Git history.
