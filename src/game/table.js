export const WIDTH = 540;
export const HEIGHT = 960;
export const BALL_RADIUS = 9;
export const FIXED_DT = 1000 / 120;
export const MAX_SPEED = 22;
export const SHOOTER = { x: 504, y: 863 };
export const BUMPERS = [{ x: 250, y: 250 }, { x: 185, y: 335 }, { x: 315, y: 335 }];
export const SLINGS = [
  [{ x: 110, y: 604 }, { x: 178, y: 715 }, { x: 100, y: 687 }],
  [{ x: 390, y: 604 }, { x: 400, y: 687 }, { x: 322, y: 715 }],
];
export const POSTS = [
  [76, 638, 8], [424, 638, 8], [90, 710, 7], [410, 710, 7],
  [155, 790, 10], [345, 790, 10], [165, 457, 6], [205, 457, 6],
  [295, 457, 6], [335, 457, 6],
];
// Every point is both visible geometry and a solid collision rail.
export const RAILS = [
  { points: [[25, 918], [25, 165], [35, 103], [69, 57], [125, 31], [400, 31], [465, 53], [505, 93], [526, 151], [526, 921]], width: 14 },
  { points: [[478, 905], [478, 237], [484, 167]], width: 12 },
  { points: [[484, 167], [466, 124], [433, 91], [388, 77], [327, 77]], width: 10 },
  // The launch guide crosses this closed gate with collisions disabled. Physical
  // playfield balls must not roll over the top rail and back into the shooter.
  { points: [[327, 31], [327, 77]], width: 10 },
  // Preserve a full ball-width return corridor against the outer curve. The old
  // 45px lower endpoint converged to a 9px opening around the 18px steel ball.
  { points: [[60, 193], [60, 148], [96, 113], [139, 99]], width: 8 },
  // A continuous lead-in feeds the left return instead of catching its ball on
  // an exposed end in the next narrow gap farther down the outer wall.
  { points: [[25, 470], [45, 526], [50, 588], [65, 624]], width: 9 },
  // Join the return rail to the divider: an exposed end left a ball-sized trap
  // between the orbit return and shooter wall.
  { points: [[478, 470], [455, 526], [450, 588], [435, 624]], width: 9 },
  { points: [[78, 657], [78, 733], [110, 773], [143, 790]], width: 9, flipperFeed: 'left' },
  { points: [[422, 657], [422, 733], [390, 773], [357, 790]], width: 9, flipperFeed: 'right' },
  { points: [[34, 759], [58, 808], [151, 849], [194, 914]], width: 14 },
  { points: [[466, 759], [442, 808], [349, 849], [306, 914]], width: 14 },
  { points: [[491, 894], [517, 894]], width: 10 },
];
export const SHOTS = [
  { id: 'left-orbit', name: 'WESTERN CURRENT', kind: 'orbit', entry: { x: 59, y: 432, radius: 24 }, points: [[59, 432], [55, 320], [45, 184], [45, 151], [70, 112], [103, 85], [235, 57], [368, 66], [437, 142], [451, 312], [445, 501], [406, 718]], exitVelocity: { x: -1.5, y: 8 }, color: 0x72cde9, duration: 1550, score: 1000 },
  { id: 'right-orbit', name: 'EASTERN CURRENT', kind: 'orbit', entry: { x: 441, y: 432, radius: 24 }, points: [[441, 432], [448, 310], [438, 154], [361, 72], [235, 57], [108, 83], [70, 112], [45, 151], [45, 181], [53, 349], [57, 501], [94, 718]], exitVelocity: { x: 1.5, y: 8 }, color: 0x72cde9, duration: 1550, score: 1000 },
  { id: 'left-ramp', name: 'RLYEH ASCENT', kind: 'ramp', entry: { x: 185, y: 455, radius: 17 }, points: [[185, 455], [180, 406], [137, 339], [124, 236], [160, 159], [253, 137], [346, 175], [386, 288], [398, 494], [406, 718]], exitVelocity: { x: -1.5, y: 7 }, color: 0xe6b981, duration: 1950, score: 2500 },
  { id: 'right-ramp', name: 'ARKHAM ASCENT', kind: 'ramp', entry: { x: 315, y: 455, radius: 17 }, points: [[315, 455], [320, 406], [363, 339], [376, 236], [340, 159], [247, 137], [154, 175], [114, 288], [102, 494], [94, 718]], exitVelocity: { x: 1.5, y: 7 }, color: 0xb7edbd, duration: 1950, score: 2500 },
];
// Centripetal-like smooth path with a sampled arc-length lookup for constant travel speed.
export function samplePath(points, samplesPerSegment = 16) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < samplesPerSegment; j++) {
      const t = j / samplesPerSegment;
      const point = [0, 1].map(k => .5 * ((2 * b[k]) + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t * t * t));
      result.push({ x: point[0], y: point[1] });
    }
  }
  const last = points.at(-1);
  result.push({ x: last[0], y: last[1] });
  let length = 0;
  result.forEach((p, i) => { if (i) length += Math.hypot(p.x - result[i - 1].x, p.y - result[i - 1].y); p.distance = length; });
  return { points: result, length };
}
export function pointOnPath(path, progress) {
  const distance = Math.max(0, Math.min(1, progress)) * path.length;
  const index = path.points.findIndex(p => p.distance >= distance);
  if (index <= 0) return { ...path.points[0] };
  const a = path.points[index - 1], b = path.points[index];
  const t = (distance - a.distance) / (b.distance - a.distance || 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
