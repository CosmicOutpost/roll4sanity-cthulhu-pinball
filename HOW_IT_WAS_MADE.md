# How The Sunken Table was made

Roll4Sanity Cthulhu Pinball began with a small brief: make a playable browser pinball table for the Roll4Sanity 500-subscriber celebration. The first challenge was to make the ball behave well enough that people would want to keep playing. The first version was a mechanical prototype, built with simple shapes and one ball. It had a plunger, two flippers, bumpers, slingshots, inlanes and outlanes, and four guided shots. The first playable source arrived in commit [`dd2684c`](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/commit/dd2684c).

The direction came from people making and playing the game. The owner chose the Call of Cthulhu theme, called for an arcade feel inspired by Windows 3D Pinball: Space Cadet, reviewed the art and gave playtest feedback. That feedback shaped the work: for example, repeated Shift presses brought up Windows Sticky Keys, so the flippers moved to Z and /.

## Building a table in a browser

Phaser draws the game; Matter.js calculates the ball's movement and physical contacts. The simulation advances in small, regular steps rather than depending on the screen's frame rate. That makes behaviour more consistent when a browser is busy or a device draws frames at a different speed.

The table is a 2D game with a top-down view. Its ramps and orbits use guided journeys: once a shot is accepted, the ball follows a defined path and returns to the physical playfield. That gives the raised ramps a clear entrance and exit without building a full three-dimensional pinball simulation.

## When the ball found the gaps

The first public playtest revealed an awkward problem: a launched ball could fall back into the shooter lane. The investigation traced the problem to the lane and return geometry as well as the ball's launch state. The repair closed the relevant gaps and allowed a returned ball to be relaunched; simply increasing the plunger force would not have addressed the cause. See [`2668b92`](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/commit/2668b92).

A later report showed a stationary ball caught near the back of a flipper. The team reproduced the contact with the actual physics, then adjusted the flipper and inlane collision arrangements so the moving bat could reach the ball. A separate upper-left rail pinch could trap an 18-pixel ball in a narrower opening; its repair also checked the downstream return. These fixes are recorded in [`0cc5b73`](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/commit/0cc5b73) and [`8450868`](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/commit/8450868).

The slingshots had a surprise of their own. A playtest found the ball repeatedly bouncing around the right sling. The active kick was restricted to the intended face, and a small clearance adjustment was approved after a neighbouring trap was found. The investigation is in [`tests/SLINGSHOT_REVIEW.md`](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/blob/956109b7dcc6ec773a2b4f594d4f8b803239ecd9/tests/SLINGSHOT_REVIEW.md).

## From prototype to occult cabinet

The early shapes gave way to an emerald, black and aged-brass Art Deco direction. The playfield uses original AI-generated artwork created for the project. The eventual layered approach keeps the background, static Cthulhu and Roll4Sanity logo independently configurable beneath the gameplay elements. This lets the artwork change without becoming part of the collision geometry; see [`docs/LAYERED_PLAYFIELD.md`](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/blob/956109b7dcc6ec773a2b4f594d4f8b803239ecd9/docs/LAYERED_PLAYFIELD.md).

Visual reviews did not always lead straight into the game. A proposed playfield title plaque was removed after review, while the darker bronze guides were retained. The team also investigated Cthulhu animation and multiball, but those experiments did not become part of the current single-ball release. Their review material remains in the repository history.

## Sound and supernatural feedback

The game uses browser-generated Web Audio rather than downloaded sound samples. Mechanical impacts sit alongside a procedural soundtrack, a roar, guided-shot sounds and a descending ball-loss cue. Sound requires a player gesture before it can start, and mute remains independent from the reduced-lighting setting.

Each completed ramp or orbit lights Cthulhu's eyes in the colour assigned to that shot. A shared completion handler was introduced after an audit found that eye and roar feedback could diverge. The audit and its tests are documented in [`tests/FOUR_RAIL_COMPLETION_AUDIT.md`](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/blob/956109b7dcc6ec773a2b4f594d4f8b803239ecd9/tests/FOUR_RAIL_COMPLETION_AUDIT.md).

## Giving players a goal

The Four Binds and Three Seals playtest gives the three-ball game a victory condition. Four different guided shots activate the Binds; after that, three Cover Stones must be struck. The final stone awards a 10,000-point bonus, shows a binding sequence and lets play continue.

The stones went through several position studies. Automated sessions measured contacts and guided shots, but their authors explicitly cautioned that positioned fixtures and simple automated players could not establish human aiming accuracy or enjoyment. The owner then played the candidate and asked for contact and hit counters, making it easier to see what the stones were actually registering. Later, the candidate changed from front-face-only qualification to counting a genuine hit on any face, while retaining the cooldown and physical stone body. See the [playability investigation](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/blob/956109b7dcc6ec773a2b4f594d4f8b803239ecd9/docs/previews/cover-stone-investigation/REPORT.md) and [placement refinement](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/blob/956109b7dcc6ec773a2b4f594d4f8b803239ecd9/docs/previews/cover-stone-refinement/REPORT.md) for the measurements and their limits.

## How ChatGPT and Codex were used

The project was developed through a collaboration between the Roll4Sanity owner and AI tools, including ChatGPT and Codex. The owner set the goals and constraints, chose the art direction, reviewed screenshots, played the game and approved or rejected changes. Codex inspected the repository, wrote and revised code, ran builds and tests, prepared previews and reported findings. ChatGPT helped explore ideas and supported the review process. The playfield artwork includes AI-generated imagery, and the project used human review to assess whether it suited the game.

AI output still needed checking. Earlier tests could show that a mechanism responded without proving it felt good during a complete game. Human playtesting found launch, flipper, slingshot, visibility and control issues that required more focused investigation. Some proposed animation and multiball work was kept separate while the project concentrated on a playable release.

## Testing what players experience

The repository has Node tests for scoring and actual Matter contacts, plus Playwright tests that open the game in Chromium and exercise browser controls. Some tests set up a ball at a precise location to reproduce a known fault. Longer tests launch and play three-ball games with ordinary input, then observe the drains and restart. Those automated players are repeatable, but they are not a substitute for a person judging whether a shot is satisfying.

A repository-level [pinball engineering skill](https://github.com/CosmicOutpost/roll4sanity-cthulhu-pinball/blob/956109b7dcc6ec773a2b4f594d4f8b803239ecd9/.agents/skills/roll4sanity-pinball-engineering/SKILL.md) records lessons from the launch lane, flipper and upper-left rail repairs. It asks future work to establish a baseline, preserve working behaviour and test complete games as well as individual mechanisms.

The playable candidate remains a work in progress. Its release history separates the current candidate from the earlier game at the site root and the earlier `/playtest/` prototype, so that new work can be reviewed without replacing those versions.
