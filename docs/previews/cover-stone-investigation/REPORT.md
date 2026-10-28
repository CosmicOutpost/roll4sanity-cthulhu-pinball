# Cover Stone playability investigation

The proposed arrangement is a **visual and measurement candidate**, not a validated physics change. No stone coordinates or mechanics were committed. The screenshots show a temporary local arrangement; dashed circles and numbers are annotations.

The deployed prototype uses `(135,395)`, `(250,430)`, `(365,395)`. The candidate uses `(155,500)`, `(250,540)`, `(345,500)`, with existing angles and passive face rules. Their closest existing solid geometry is approximately 23, 73 and 23 px from conservative 15 px stone envelopes; the ball is 18 px wide. The outer candidate stones also sit close to the printed ramp labels, reducing readability.

## Comparable simulations

`node tests/stone-playability-study.mjs` performs 24 complete-game attempts per layout, using six reactive flipper thresholds and four input polling intervals. Every attempt launches normally and controls flippers using the existing actionSession helper. No ball positioning or rescue occurs. The helper uses up to 22 seconds of reactive input per ball followed by a hands-off drain period; these are deterministic bots, not independent human players.

| Layout | Games completed | Approaches within 50px (L/C/R) | Physical contacts L/C/R | Qualifying front hits L/C/R | Guided captures L ramp/R ramp/L orbit/R orbit | flagged stalls |
|---|---:|---|---|---|---|---:|
| Original | 24/24 | 41/143/29 | 18/67/11 | 8/11/3 | 48/30/12/13 | 0 |
| Lower B `(190,540),(250,570),(310,540)` | 24/24 | 273/503/314 | 156/191/159 | 40/61/65 | 12/21/12/13 | 0 in this sample |
| Candidate | 23/24 | 161/420/164 | 70/199/67 | 17/37/20 | 42/31/14/26 | 1 |

A separate 24-game sweep of the lower B layout flagged two stalls at `(349.2,756.1)` and `(361.9,766.7)`; a different sample obtained zero. Its left-ramp captures fell sharply, so it was rejected. The candidate had a stall at `(145.7,768.8)` near the left flipper; a previous baseline simulation without the placement change also observed a pocket near `(145.7,766.4)`. This supports a pre-existing weakness but does not prove the new placement has no effect on reaching it.

The initial arrangement yielded just **one** qualifying hit after all Binds were empowered in these 24 games; the candidate yielded **1/1/2** across the stones. None of this establishes a victory rate. Qualifying contact in the 2.5s following flipper contact is not proof the player intended the shot. See `session-data.json` for the individual results and alternate configuration.

## Targeted checks

- Original geometry and candidate stone faces use the same rotated Matter vertices drawn on screen; the bright rubber strip follows local `(±8,+8)` and detection requires a collision normal aligned with that downward-facing edge and incoming velocity. Backs and sides are passive.
- The candidate's 86 unit/mechanism tests passed, including all four guided capture/return fixtures and 96 slow perimeter cases.
- Two ordinary-input three-ball browser games passed; these include explicit hands-off drain periods.
- 14 focused desktop/mobile/browser checks passed and one keyboard-driven aim fixture failed at the right stone. A revised timing fixture missed the right stone in all three repeated runs. The initial fixture sets the ball near the flipper, so even a pass would not prove ordinary play or human aiming.
- A programmatic sweep found 16, 505 and 10 direct flipper-to-face fixture cases for the candidate stones; these figures depend on the sampled starting positions and should not be compared as player success probabilities.
- No human could be physically playtested in this automated environment. No claims are made that the candidate has satisfying rebounds or avoids unfair drains for actual players.

The candidate is closer to the active ball flow but **is not ready to deploy or promote as a fix**. Its right shot, difficult ramp interactions, visibility and stall must be investigated and tested with actual human input. User approval is required before deploying any eventual change.
