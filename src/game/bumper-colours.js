export const BUMPER_COLOUR_DURATION = 700;
const EMERALD = { ring: 0x437f67, outer: 0xb5edbb, inner: 0x70bd91 };
const GOLD = { ring: 0xffd166, outer: 0xffe4a3, inner: 0xf1ba4f };
const CRIMSON = { ring: 0xd85a58, outer: 0xf5a18e, inner: 0xb94951 };
const CALM_GOLD = { ring: 0xb09d65, outer: 0xd1d5ad, inner: 0xa9ae80 };
function blend(from, to, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = t * t * (3 - 2 * t);
  const channel = shift => Math.round(((from >> shift) & 255) + (((to >> shift) & 255) - ((from >> shift) & 255)) * ease);
  return channel(16) * 65536 + channel(8) * 256 + channel(0);
}
function palette(from, to, progress) {
  return { ring: blend(from.ring, to.ring, progress), outer: blend(from.outer, to.outer, progress), inner: blend(from.inner, to.inner, progress) };
}

// One non-looping hue sequence. Geometry and alpha never change. CALM uses a
// single muted brass tint, with no crimson phase or rapid colour cycling.
export function bumperRingColours(age, reduced = false) {
  if (age < 0 || age >= BUMPER_COLOUR_DURATION) return EMERALD;
  if (reduced) {
    if (age < 140) return palette(EMERALD, CALM_GOLD, age / 140);
    if (age < 400) return CALM_GOLD;
    return palette(CALM_GOLD, EMERALD, (age - 400) / 300);
  }
  if (age < 90) return palette(EMERALD, GOLD, age / 90);
  if (age < 150) return GOLD;
  if (age < 220) return palette(GOLD, CRIMSON, (age - 150) / 70);
  if (age < 270) return CRIMSON;
  return palette(CRIMSON, EMERALD, (age - 270) / 430);
}
