import { TableLights } from './lights.js';
import { WIDTH, HEIGHT, BUMPERS, WARDS, WARD_RULES, POSTS, RAILS, SLINGS } from './table.js';

export class TableRenderer {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    // Printed artwork sits behind every real mechanism. It has no physics body.
    this.artwork = scene.add.image(WIDTH / 2, HEIGHT / 2, 'playfield-art')
      .setDisplaySize(WIDTH, HEIGHT).setDepth(-1);
    this.base = scene.add.graphics();
    this.moving = scene.add.graphics().setDepth(5);
    this.overlay = scene.add.graphics().setDepth(10);
    this.drawTable();
    this.lights = new TableLights(scene, physics);
    // One reusable caption, below the ball's rendering depth. No particle pool
    // or animations that change collision positions, sizes or simulation time.
    this.eventText = this.text(250, 584, '', 17, '#dbfadd').setStroke('#071a24', 4).setDepth(4);
    this.debugText = this.text(250, 917, '', 10, '#f0e49b').setDepth(11);
  }
  text(x, y, value, size = 11, color = '#789e9d') {
    return this.scene.add.text(x, y, value, { fontFamily: 'monospace', fontSize: `${size}px`, color, align: 'center', letterSpacing: 1,
      stroke: '#04130e', strokeThickness: size >= 11 ? 3 : 0 }).setOrigin(.5);
  }
  stroke(points, width, color, alpha = 1, graphic = this.base) {
    graphic.lineStyle(width, color, alpha);
    graphic.beginPath();
    points.forEach((p, i) => { const x = p.x ?? p[0], y = p.y ?? p[1]; if (i) graphic.lineTo(x, y); else graphic.moveTo(x, y); });
    graphic.strokePath();
  }
  circle(x, y, r, fill, border, graphic = this.base, alpha = 1) {
    graphic.fillStyle(fill, alpha).fillCircle(x, y, r);
    if (border) graphic.lineStyle(1.5, border, alpha).strokeCircle(x, y, r);
  }
  drawTable() {
    const g = this.base;
    // Outer cabinet metalwork.
    g.lineStyle(2, 0x52716d, .5).strokeRoundedRect(12, 13, 516, 935, 38);
    for (const [x, y] of [[19, 28], [520, 28], [19, 932], [520, 932]]) {
      this.circle(x, y, 3.5, 0x506b6c, 0x8b9b8d);
      this.stroke([[x - 2, y], [x + 2, y]], 1, 0x132932);
    }
    // Guided orbits hug the outside; the raised ramps have thick deck edges and supports.
    for (const shot of this.physics.shots) {
      const ramp = shot.kind === 'ramp';
      this.stroke(shot.path.points, ramp ? 27 : 20, 0x020e1a, .65);
      this.stroke(shot.path.points, ramp ? 23 : 15, shot.color, ramp ? .32 : .2);
      this.stroke(shot.path.points, ramp ? 18 : 11, ramp ? 0x163841 : 0x102b3a, .95);
      this.stroke(shot.path.points, 1, shot.color, .35);
      if (ramp) {
        for (const i of [38, 62, 90, 119]) {
          const p = shot.path.points[i];
          this.circle(p.x, p.y, 3, 0x1f3f46, shot.color, g, .6);
        }
      }
    }
    this.text(250, 106, 'ARKHAM  /  MASSACHUSETTS', 8, '#6b9f9b');
    this.text(58, 486, 'ORBIT', 14, '#9de0f2').setAngle(-90);
    this.text(441, 486, 'ORBIT', 14, '#9de0f2').setAngle(90);
    this.text(185, 490, 'RAMP I', 15, '#f1d09a');
    this.text(315, 490, 'RAMP II', 15, '#c2f4cd');
    this.text(185, 510, '2,500', 12, '#c9b994');
    this.text(315, 510, '2,500', 12, '#a6c9b1');
    for (const [x, direction] of [[59, -1], [441, 1]]) {
      this.stroke([[x - 6, 420], [x, 413], [x + 6, 420]], 2, 0x9de0f2, .85);
      this.text(x - direction * 28, 547, '1,000', 11, '#8dc8d7');
    }
    // These are the existing three scoring bumpers, not a new target bank.
    for (const { x, y } of BUMPERS) this.text(x, y + 44, 'POP 100', 12, '#b6dfc3');
    for (const { x, y } of WARDS) this.text(x, y + 25, `WARD ${WARD_RULES.score}`, 11, '#dcc38c');
    // Ramp mouths: clear broad arrowheads and raised lips.
    for (const [x, color] of [[185, 0xe6b981], [315, 0xb7edbd]]) {
      g.fillStyle(color, .1).fillTriangle(x - 16, 466, x + 16, 466, x, 429);
      this.stroke([[x - 15, 458], [x - 15, 443]], 3, color);
      this.stroke([[x + 15, 458], [x + 15, 443]], 3, color);
      this.stroke([[x - 7, 439], [x, 431], [x + 7, 439]], 2, color, .9);
    }
    for (const rail of RAILS) {
      this.stroke(rail.points, rail.width + 5, 0x03111a, .8);
      this.stroke(rail.points, rail.width, 0x456069);
      this.stroke(rail.points, Math.max(2, rail.width - 5), 0x91aca3, .75);
      this.stroke(rail.points, 1, 0xd5e7ca, .45);
    }
    SLINGS.forEach((p, i) => {
      g.fillStyle(0x1c4d48).fillPoints(p, true);
      this.stroke([...p, p[0]], 5, 0x0a1a24);
      this.stroke([...p, p[0]], 2, 0x91d0ad, .9);
      this.text(i ? 374 : 126, 677, '50', 10, '#87bda6');
    });
    POSTS.forEach(([x, y, r]) => {
      this.circle(x, y, r + 3, 0x05202a, 0x4d8077);
      this.circle(x, y, r, 0xcee0ba, 0x74b7a0);
      this.circle(x, y, 2.5, 0x45695e);
    });
    this.text(48, 697, 'OUT', 12, '#d0baa0').setAngle(-90);
    this.text(451, 697, 'OUT', 12, '#d0baa0').setAngle(90);
    this.text(105, 748, 'IN', 12, '#c0e1ce').setAngle(46);
    this.text(395, 748, 'IN', 12, '#c0e1ce').setAngle(-46);
    // Lower apron leaves the central drain open in both geometry and drawing.
    g.fillStyle(0x102831).fillTriangle(30, 818, 194, 930, 30, 930);
    g.fillStyle(0x102831).fillTriangle(470, 818, 306, 930, 470, 930);
    this.text(250, 889, '▼  THE DEEP  ▼', 9, '#65847c');
    this.text(94, 901, 'R4S', 18, '#476c66');
    this.text(405, 901, 'EST. 1928', 8, '#476c66');
    this.text(504, 466, 'S\nH\nO\nO\nT\nE\nR', 8, '#729c98');
    this.text(504, 801, '↑', 23, '#9ac5ae');
  }
  draw() {
    const p = this.physics, g = this.moving;
    g.clear();
    this.lights.draw();
    BUMPERS.forEach(({ x, y }, i) => {
      const strength = this.lights.strength(`bumper:${i}`);
      this.circle(x, y, 38, 0x80e8b2, null, g, .055 + strength * .1);
      this.circle(x, y, 29, 0x0a252d, 0x658f7d, g);
      this.circle(x, y, 24, 0x437f67, 0xb5edbb, g);
      this.circle(x, y, 19, 0x193e3e, 0x70bd91, g);
      this.circle(x, y, 10, 0x9fe8b7, 0xc9efd0, g, .8);
      this.stroke([[x - 4, y], [x, y - 5], [x + 4, y], [x, y + 5], [x - 4, y]], 1, 0x1c4e40, 1, g);
    });
    WARDS.forEach(({ x, y, radius }, i) => {
      const strength = this.lights.strength(`ward:${i}`);
      if (strength) this.circle(x, y, radius + 9, 0xd6c48a, null, g, .1 * strength);
      this.circle(x + 1, y + 2, radius + 2, 0x030e12, null, g, .8);
      // The brass rim follows the collider; only the soft halo extends beyond it.
      this.circle(x, y, radius, 0x776036, 0xe0c589, g);
      this.circle(x, y, radius - 3, 0x174a3b, 0x987b44, g);
      this.stroke([[x - 4, y], [x, y - 6], [x + 4, y], [x, y + 6], [x - 4, y]], 1.5, 0xe6d198, 1, g);
      this.stroke([[x - 6, y + 7], [x + 6, y + 7]], 1, 0xba9b5b, .8, g);
    });
    SLINGS.forEach((points, i) => {
      const strength = this.lights.strength(`sling:${i}`);
      if (strength) g.fillStyle(0xaaf3b6, .2 * strength).fillPoints(points, true);
    });
    for (const f of p.flippers) {
      const tip = { x: f.pivot.x + Math.cos(f.angle) * 80, y: f.pivot.y + Math.sin(f.angle) * 80 };
      this.stroke([f.pivot, tip], 23, 0x03161e, 1, g);
      this.stroke([f.pivot, tip], 17, 0xcec5a0, 1, g);
      this.stroke([f.pivot, tip], 10, p.controls[f.side] ? 0xc4f4c1 : 0x779f87, 1, g);
      this.circle(f.pivot.x, f.pivot.y, 7, 0x324f4b, 0xe0ddbb, g);
      this.circle(tip.x, tip.y, 8, 0xcac9a4, 0xe1e3bf, g);
    }
    // Visible plunger spring compresses as Space is held.
    const springTop = 883 + p.charge * 28;
    this.stroke([[504, springTop - 4], [504, springTop + 5]], 13, 0xaabeb0, 1, g);
    const spring = Array.from({ length: 13 }, (_, i) => [504 + (i % 2 ? 6 : -6), springTop + 5 + (933 - springTop - 5) * i / 12]);
    this.stroke(spring, 2, 0x6d9690, 1, g);
    g.fillStyle(0x254441).fillRoundedRect(493, 936, 22, 10, 3);
    if (p.charge) { g.fillStyle(0x9ce6af, .9).fillRect(516, 929 - p.charge * 81, 3, p.charge * 81); }
    if (p.ball) {
      const { x, y } = p.ball.position;
      const raised = p.travel?.shot.kind === 'ramp';
      const r = raised ? 11 : 9;
      this.circle(x + (raised ? 7 : 3), y + (raised ? 12 : 4), r + 1, 0x020b13, null, g, .55);
      if (p.travel) this.circle(x, y, r + 7, raised ? 0xf4e1ad : 0x8ed9ed, null, g, .1);
      // Crisp dark separation and a brighter steel highlight, at the original
      // 9px physical / 11px guided-ramp presentation radii. No flashing/trail.
      this.circle(x, y, r + 1, 0x05101b, null, g, .9);
      this.circle(x, y, r, 0x91aebd, 0xf0ffff, g);
      this.circle(x - 1, y - 2, r - 2, 0xd9e9ec, null, g);
      this.circle(x - 3, y - 4, 3, 0xffffff, null, g);
      this.circle(x + 2, y + 4, 3, 0x526f81, null, g, .8);
    }
    this.drawDebug();
  }
  drawDebug() {
    const g = this.overlay;
    g.clear();
    this.debugText.setVisible(this.debug);
    if (!this.debug) return;
    g.lineStyle(1, 0xff5fb3, .8);
    for (const body of this.physics.engine.world.bodies) {
      if (body.label === 'ball') continue;
      g.strokePoints(body.vertices, true);
    }
    for (const s of this.physics.shots) g.lineStyle(1, s.color, .9).strokeCircle(s.entry.x, s.entry.y, s.entry.radius);
    const b = this.physics.ball;
    if (b) {
      g.lineStyle(1, 0xfff58a, 1).strokeCircle(b.position.x, b.position.y, 9);
      this.stroke([b.position, { x: b.position.x + b.velocity.x * 5, y: b.position.y + b.velocity.y * 5 }], 2, 0xfff58a, 1, g);
      this.debugText.setText(`V ${b.velocity.x.toFixed(1)}, ${b.velocity.y.toFixed(1)}  |  120 Hz  |  ${this.physics.travel?.shot.id ?? this.physics.state.phase}`);
    } else this.debugText.setText('GAME OVER  |  120 Hz');
  }
}
