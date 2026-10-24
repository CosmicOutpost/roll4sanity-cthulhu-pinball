import { pointOnPath } from './table.js';

export const EYE_CENTRES = [{ x: 230, y: 391 }, { x: 310, y: 391 }];
export const AWAKEN_DURATION = 2550;
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function awakeningStrength(age) {
  if (age < 0 || age >= AWAKEN_DURATION) return 0;
  return age < 250 ? smooth(age / 250) : age <= 1050 ? 1 : 1 - smooth((age - 1050) / 1500);
}

// Presentation only: every channel position comes from the existing sampled
// guided path. No physical bodies, artwork textures or gameplay clocks change.
export class SpellLights {
  constructor(sim, graphics, eyes) {
    this.sim = sim; this.g = graphics; this.eyes = eyes;
    this.routes = new Map(sim.shots.map(shot => [shot.id, { shot,
      runes: Array.from({ length: 13 }, (_, i) => {
        const p = pointOnPath(shot.path, i / 12), q = pointOnPath(shot.path, Math.min(1, (i + .04) / 12));
        const prev = pointOnPath(shot.path, Math.max(0, (i - .04) / 12));
        const dx = q.x - prev.x, dy = q.y - prev.y, length = Math.hypot(dx, dy) || 1;
        return { x: p.x - dy / length * 15, y: p.y + dx / length * 15, progress: i / 12 };
      }) } ]));
    this.reset();
  }
  reset() { this.active = null; this.completions = []; }
  begin(travel) { this.active = travel; }
  cancel() { this.active = null; }
  complete(shot) {
    this.active = null;
    this.completions.push({ shot, at: this.sim.elapsed });
    if (this.completions.length > 2) this.completions.shift();
  }
  line(points, width, colour, alpha) {
    if (points.length < 2) return;
    const g = this.g;
    g.lineStyle(width, colour, alpha).beginPath().moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.strokePath();
  }
  rune(x, y, size, colour, alpha, index = 0) {
    const g = this.g;
    g.lineStyle(1.8, colour, alpha).beginPath().moveTo(x, y - size).lineTo(x + size, y).lineTo(x, y + size).lineTo(x - size, y).closePath().strokePath();
    if (index % 2) this.line([{ x: x - size, y: y - size / 2 }, { x: x + size, y: y + size / 2 }], 1.3, colour, alpha);
    else this.line([{ x, y: y - size * 1.5 }, { x, y: y + size * 1.5 }], 1.3, colour, alpha);
  }
  current(shot, progress, length, intensity = 1, completion = false) {
    const head = pointOnPath(shot.path, progress), start = Math.max(0, progress - length);
    const points = [pointOnPath(shot.path, start)];
    for (const p of shot.path.points) if (p.distance / shot.path.length > start && p.distance / shot.path.length < progress) points.push(p);
    points.push(head);
    this.line(points, 24, 0x25d99c, .10 * intensity);
    this.line(points, 13, 0x48ffb6, .25 * intensity);
    this.line(points, 6, completion ? 0xffd165 : 0x65ffc5, .85 * intensity);
    this.line(points, 2.5, 0xffe098, .95 * intensity);
    const g = this.g;
    g.fillStyle(0xf5c967, .14 * intensity).fillCircle(head.x, head.y, 23);
    g.lineStyle(2, 0xffdb88, .9 * intensity).strokeCircle(head.x, head.y, 16);
    return head;
  }
  draw(reduced, eyeCue) {
    const g = this.g, now = this.sim.elapsed;
    this.completions = this.completions.filter(c => now - c.at < 1000);
    for (const { shot, at } of this.completions) {
      const age = now - at, exit = pointOnPath(shot.path, 1);
      if (reduced) {
        g.lineStyle(2, 0xbba770, .28).strokeCircle(exit.x, exit.y, 21);
      } else if (age < 400) {
        this.current(shot, .8 + .2 * smooth(age / 400), .15, 1 - age / 800, true);
      } else {
        const strength = Math.sin(Math.PI * (age - 400) / 600);
        g.fillStyle(0xc65359, strength * .15).fillCircle(exit.x, exit.y, 32);
        g.lineStyle(3, 0xe48870, strength * .75).strokeCircle(exit.x, exit.y, 24 + strength * 7);
        this.rune(exit.x, exit.y - 36, 8, 0xe4b174, strength, 1);
      }
    }
    if (eyeCue && !reduced) this.drawEyes(now - eyeCue.at);
    const travel = this.active;
    if (!travel || this.sim.travel !== travel) return null;
    const shot = travel.shot, route = this.routes.get(shot.id);
    if (!route) return null;
    const progress = clamp((now - travel.started) / shot.duration);
    if (reduced) {
      // Stationary entry and exit symbols only; audio remains independent.
      const end = pointOnPath(shot.path, 1);
      this.rune(shot.entry.x, shot.entry.y, 13, 0xb8c98e, .45);
      g.lineStyle(2, 0xbba770, .25).strokeCircle(end.x, end.y, 20);
      return null;
    }
    const activation = 1 - smooth((now - travel.started) / 400);
    g.fillStyle(0x57ffc0, .32 * activation).fillCircle(shot.entry.x, shot.entry.y, 34);
    g.lineStyle(3, 0xb2ffd8, activation).strokeCircle(shot.entry.x, shot.entry.y, 25 + 10 * (1 - activation));
    const buildup = smooth((progress - .7) / .3);
    const head = this.current(shot, progress, .27, .85 + buildup * .15);
    for (let i = 0; i < route.runes.length; i++) {
      const node = route.runes[i], behind = progress - node.progress;
      const awake = behind >= 0;
      const trailing = awake ? clamp(1 - behind / .25) : 0;
      if (trailing) g.fillStyle(0x54f7b4, .18 * trailing).fillCircle(node.x, node.y, 12);
      this.rune(node.x, node.y, 5.5 + trailing * 1.5, awake ? 0xffd77c : 0x57c6a1, awake ? .35 + trailing * .65 : .22, i);
    }
    if (buildup > 0) {
      const wave = Math.sin(progress * 16) * 4;
      this.line([{ x: head.x - 28, y: head.y - 4 }, { x: head.x - 16, y: head.y - 12 - wave }, { x: head.x - 9, y: head.y + 5 }, { x: head.x + 3, y: head.y - 20 }], 2, 0xd3ffe0, buildup * .9);
      this.rune(head.x, head.y, 24 + buildup * 6, 0xffd680, buildup * .8, 1);
    }
    return { id: shot.id, progress, phase: progress < .2 ? 'activation' : progress < .7 ? 'travel' : 'buildup', head };
  }
  drawEyes(age) {
    const strength = awakeningStrength(age), g = this.eyes;
    if (!strength) return;
    for (const { x, y } of EYE_CENTRES) {
      // Layered soft aureoles around bright amber irises and white-hot centres.
      g.fillStyle(0xdba441, .12 * strength).fillEllipse(x, y, 54, 34);
      g.fillStyle(0xffc653, .24 * strength).fillEllipse(x, y, 38, 24);
      g.fillStyle(0xffcc67, .48 * strength).fillEllipse(x, y, 25, 14);
      g.fillStyle(0xffbd48, .95 * strength).fillEllipse(x, y, 16, 8);
      g.fillStyle(0xffe99c, strength).fillEllipse(x, y, 10, 5);
      g.fillStyle(0xfffbe1, strength).fillEllipse(x, y, 5, 3);
    }
  }
}
