// Match simulation identity AND kind, never the order in sim.shots.
export const EYE_SHOTS = Object.freeze({
  'left-ramp': Object.freeze({ kind: 'ramp', name: 'emerald green', colour: 0x21e58d }),
  'right-ramp': Object.freeze({ kind: 'ramp', name: 'crimson red', colour: 0xf23c55 }),
  'left-orbit': Object.freeze({ kind: 'orbit', name: 'electric blue', colour: 0x329dff }),
  'right-orbit': Object.freeze({ kind: 'orbit', name: 'eldritch violet', colour: 0xaf58ff }),
});
const tint = (colour, white) => [16, 8, 0].reduce((result, shift) => {
  const channel = (colour >> shift) & 255;
  return result | Math.round(channel + (255 - channel) * white) << shift;
}, 0);
export const EYE_PALETTES = Object.freeze(Object.fromEntries(Object.entries(EYE_SHOTS).map(([id, shot]) => [id,
  Object.freeze({ ...shot, highlight: tint(shot.colour, .25), centre: tint(shot.colour, .95) }),
])));
export function eyePalette(shot) {
  const palette = Object.hasOwn(EYE_PALETTES, shot?.id) ? EYE_PALETTES[shot.id] : null;
  return palette && palette.kind === shot?.kind ? palette : null;
}
