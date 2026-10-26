# Layered playfield working draft

Three independent artwork image objects are configured in
`src/game/art-layers.js`: background (depth -3), static transparent Cthulhu
(depth -2), and a reserved logo (depth -1). Each has its own asset URL, position,
scale and visibility. The logo has no approved asset and remains hidden.
Existing gameplay draws at depth 0 and above. Existing cabinet branding is
unchanged and is not used as the replacement logo.

Positions are in the original 941 × 1672 board coordinate space, mapped to the
existing 540 × 960 table. Supply a local logo URL and update its configuration
to replace it independently. No animation, physics, scoring or controls change.

The background is an unchanged copy of the existing corrected clean plate.
The Cthulhu PNG combines existing REST layers at their documented positions,
without retouching. `src/assets/layered/provenance.json` records source assets.
The bare background retains visible fill boundaries from prior artwork work;
this is a structural working draft, not final artwork approval. Two full-board
RGBA textures use approximately 12 MiB decoded memory.

Rollback: `rollback/pre-layered-playfield` points to
`2ffb3d168a5bb376d0dced5b7628fe336ede68e4`, the previous successful Pages release.
The original baked artwork remains in Git. Roll back by restoring that release
through the playtest deployment workflow, without rewriting main.

Validation: 76 unit tests, production build, desktop/mobile Canvas layer checks,
production subdirectory tests and two complete three-turn browser games passed.
Full-game tests use ordinary launch/flipper input and natural drains, including
explicit hands-off periods, then verify game-over and restart. These are
Chromium checks, not physical-device or human playtesting.
