# Bumper ring colour review

Before: live release `d7bb524`. After: this review commit on `pinball-playtest`.
All images are actual Chromium screenshots at their original captured resolution.
A normal full Space-key plunge strikes the top bumper; the scene is paused for
capture without showing a pause overlay or moving the ball. No effect, score or
collision was injected. The before/after crimson views capture the same 250ms
phase after the hit, with score 100 and identical ball coordinates.

- [Before — previous emerald/opacity pulse, 250ms](before-detail.png)
- [After — bright gold, 125ms](after-gold-detail.png)
- [After — warm crimson peak, 250ms](after-crimson-detail.png)
- [After — recovered emerald, 733ms](after-recovery-detail.png)
- [CALM — one muted brass tint, mobile, 250ms](calm-detail.png)
- [Full table at the crimson phase](after-crimson.png)

The normal sequence reaches gold by 90ms, holds it through 150ms, transitions to
crimson by 220ms, holds through 270ms, then eases back to the exact idle colours
at 700ms. CALM uses a single muted brass tint (140–400ms) and returns by 700ms;
there is no crimson phase. Repeated hits complete the current cycle before a
new one can begin. Scores, impulses and sounds still respond to every valid hit.

Only opaque ring fill/border colours change. Circle radii, core, faint idle halo,
collision geometry, scoring and audio are unchanged. The previous bumper-only
opacity glow is removed; all other scoring effects are retained.

Focused checks cover the exact palette/timing, smooth boundaries, CALM, burst
coalescing, and actual Canvas pixels during ordinary launch on desktop/mobile.
Pixel checks verify gold/crimson/recovery, constant core and halo, full opacity
and retained impact sound. The long browser full-game tests are not repeated
locally for this visual-only change.

This commit is marked `[skip pages]`; no deployment is authorised by this review.

Validation: `npm run check` passed 55 Node tests and the production build.
Production Chromium ran the bumper-colour, existing feedback and static-hosting
specifications: 20 passed, 0 failed, 0 skipped (51.5 seconds). Physics, geometry,
scoring, controls, sounds and artwork were verified unchanged from `d7bb524`.
