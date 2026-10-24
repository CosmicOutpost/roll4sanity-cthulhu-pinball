import { test, expect } from '@playwright/test';
const gameURL = './?debug=1';
async function open(page) {
  await page.goto(gameURL);
  await page.waitForFunction(() => !!window.pinballPresentation);
  await page.keyboard.press('d');
}
async function serve(page) {
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge === 1);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => !window.pinball.shooter && !window.pinball.travel);
}
// Explicit mechanism fixtures, separate from whole-game/ordinary-input tests.
// Only the initial pose is set; the running game's actual Matter engine makes
// contacts, captures shots, awards points and resolves drains thereafter.
async function pose(page, { x, y, vx = 0, vy = 0 }) {
  // Honour the real recapture lockout after launch/guided travel.
  await page.waitForFunction(() => { const p = window.pinball; return p.state.phase === 'playing' && !p.travel && p.elapsed > p.shotLock; });
  await page.keyboard.press('p');
  const before = await page.evaluate(({ x, y, vx, vy }) => {
    const p = window.pinball, Body = window.Phaser.Physics.Matter.Matter.Body;
    Body.setPosition(p.ball, { x, y }); Body.setVelocity(p.ball, { x: vx, y: vy });
    Body.setAngularVelocity(p.ball, 0);
    return { score: p.state.score, id: p.ball.id, ball: p.state.ballNumber };
  }, { x, y, vx, vy });
  await page.keyboard.press('p');
  return before;
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`horror feedback: actual ramp/orbit captures coordinate sound, chase and eyes at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    for (const [id, kind, x, y, points] of [['left-ramp', 'ramp', 185, 470, 2500], ['right-orbit', 'orbit', 441, 451, 1000]]) {
      await page.keyboard.press('r'); await serve(page);
      const before = await pose(page, { x, y, vy: -7 });
      await page.waitForFunction(id => window.pinball.travel?.shot.id === id && window.pinballPresentation.table.lights.chase?.progress > .15, id);
      const first = await page.evaluate(id => {
        const p = window.pinball, f = window.pinballPresentation, l = f.table.lights;
        return { id: p.ball.id, score: p.state.score, cue: l.cues.get(id)?.kind,
          eyes: l.cues.has('eyes'), chase: { ...l.chase }, sound: !!f.sound.ritual.travel,
          layers: [l.eyes.depth, f.table.artwork.depth, l.graphics.depth, f.table.moving.depth] };
      }, id);
      expect(first.id).toBe(before.id); expect(first.score).toBe(before.score + points);
      expect(first.cue).toBe(kind); expect(first.sound).toBe(true);
      expect(first.eyes).toBe(false);
      expect(first.layers[0]).toBeGreaterThan(first.layers[1]);
      expect(first.layers[2]).toBeLessThan(first.layers[3]);
      await page.waitForTimeout(140);
      const later = await page.evaluate(() => {
        const p = window.pinball, chase = window.pinballPresentation.table.lights.chase;
        return { observed: chase.progress, actual: (p.elapsed - p.travel.started) / p.travel.shot.duration };
      });
      expect(later.observed).toBeGreaterThan(first.chase.progress);
      expect(later.observed).toBeCloseTo(later.actual, 4);
      await testInfo.attach(`${width}-${kind}-lights`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.keyboard.press('p');
      const frozen = await page.evaluate(() => window.pinball.elapsed);
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => window.pinball.elapsed)).toBe(frozen);
      expect(await page.evaluate(() => window.pinballPresentation.sound.voices.size)).toBe(0);
      await page.keyboard.press('p');
      await page.waitForFunction(() => !window.pinball.travel);
      await page.waitForTimeout(50);
      expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.has('eyes'))).toBe(true);
    }
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.pinballPresentation.table.lights.cues.size === 0);
    expect(errors).toEqual([]);
  });
}

test('horror feedback: real rail and ward contacts illuminate locally with distinct sound', async ({ page }) => {
  await open(page); await serve(page);
  const before = await pose(page, { x: 365, y: 572, vy: -3 });
  await page.waitForFunction(() => window.pinballPresentation.table.lights.cues.has('ward:1'));
  expect(await page.evaluate(() => window.pinball.state.score)).toBe(before.score + 75);
  expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.has('ward'))).toBe(true);
  const rail = await pose(page, { x: 40, y: 400, vx: -8 });
  await page.waitForFunction(() => window.pinballPresentation.table.lights.cues.has('rail'));
  expect(await page.evaluate(() => window.pinball.state.score)).toBe(rail.score);
  expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.has('rail'))).toBe(true);
});

test('horror feedback: natural fixture drains cue once per lost ball, with a separate final sound', async ({ page }) => {
  await open(page);
  const observed = [];
  for (let number = 1; number <= 3; number++) {
    await serve(page);
    const before = await pose(page, { x: 250, y: 920, vy: 5 });
    await page.waitForFunction(number => window.pinball.state.phase === (number === 3 ? 'gameover' : 'ready'), number);
    const kind = number === 3 ? 'gameover' : 'drain';
    await page.waitForFunction(kind => window.pinballPresentation.table.lights.cues.has(kind), kind);
    observed.push(await page.evaluate(kind => ({ score: window.pinball.state.score,
      effect: window.pinballPresentation.sound.lastEffect, ball: window.pinball.state.ballNumber,
      at: window.pinballPresentation.table.lights.cues.get(kind).at }), kind));
    expect(observed.at(-1).score).toBe(before.score);
    expect(observed.at(-1).effect).toBe(kind);
    await page.waitForTimeout(100);
    expect(await page.evaluate(kind => window.pinballPresentation.table.lights.cues.get(kind).at, kind)).toBe(observed.at(-1).at);
  }
  expect(observed.map(e => e.ball)).toEqual([2, 3, 3]);
});

test('horror feedback: reduced motion disables chase/eyes, persists and keeps the game functional', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
  await serve(page);
  const before = await pose(page, { x: 185, y: 470, vy: -7 });
  await page.waitForFunction(() => window.pinball.travel?.shot.id === 'left-ramp');
  expect(await page.evaluate(() => ({ chase: window.pinballPresentation.table.lights.chase,
    eyes: window.pinballPresentation.table.lights.cues.has('eyes'), score: window.pinball.state.score })))
    .toEqual({ chase: null, eyes: false, score: before.score + 2500 });
  await page.locator('#motion').click();
  await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'false');
  await page.reload(); await page.waitForFunction(() => !!window.pinballPresentation);
  await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#motion').click();
  await expect(page.locator('#motion')).toHaveAttribute('aria-pressed', 'true');
});

test('horror feedback: mute silences new effects without disabling scoring lights', async ({ page }) => {
  await open(page); await serve(page);
  await page.locator('#sound').click();
  const played = await page.evaluate(() => window.pinballPresentation.sound.played);
  const before = await pose(page, { x: 185, y: 470, vy: -7 });
  await page.waitForFunction(() => window.pinball.travel?.shot.id === 'left-ramp');
  expect(await page.evaluate(() => ({ score: window.pinball.state.score, voices: window.pinballPresentation.sound.voices.size,
    played: window.pinballPresentation.sound.played, glow: window.pinballPresentation.table.lights.cues.get('left-ramp')?.kind })))
    .toEqual({ score: before.score + 2500, voices: 0, played, glow: 'ramp' });
});
