import { test, expect } from '@playwright/test';

const gameURL = process.env.PINBALL_BASE_URL
  ? `./?debug=1&deployment=${process.env.GITHUB_SHA || 'full-game'}` : './?debug=1';

// Two modest, fallible players, not a physics fixture or perfect controller.
// Each ball gets up to 20 seconds of reactive play, followed by an explicit
// hands-off period so all three natural drains and game over can be checked.
const players = [
  { name: 'keyboard reactive', launch: 'keyboard', interval: 60, threshold: 735, pulse: 160, pause: 260 },
  { name: 'Launch button and late keyboard taps', launch: 'pointer', interval: 140, threshold: 770, pulse: 110, pause: 420 },
];

async function readState(page) {
  return page.evaluate(() => {
    const p = window.pinball, b = p.ball;
    return {
      phase: p.state.phase, ball: p.state.ballNumber, score: p.state.score,
      paused: p.state.paused, charge: p.charge, shooter: p.shooter,
      guided: p.travel?.shot.id ?? null, elapsed: p.elapsed,
      body: b ? { id: b.id, x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y } : null,
      violations: window.fullGameObservation.violations,
    };
  });
}

async function startObservation(page) {
  // Only the observer's own records change. No writes to the simulation, calls
  // to its methods, timers driving physics, or synthetic in-page input events.
  await page.evaluate(() => {
    const observation = window.fullGameObservation = { samples: [], violations: [], sawFlipperRebound: false };
    let lastSample = -Infinity, pocket = null;
    const sample = () => {
      const p = window.pinball, b = p.ball;
      const s = {
        t: p.elapsed, ball: p.state.ballNumber, phase: p.state.phase,
        score: p.state.score, paused: p.state.paused, shooter: p.shooter,
        guided: p.travel?.shot.id ?? null, id: b?.id,
        x: b?.position.x, y: b?.position.y, vx: b?.velocity.x, vy: b?.velocity.y,
        left: p.controls.left, right: p.controls.right,
      };
      // Observe brief rebounds every rendered frame, not just the saved 75ms
      // samples: a short contact can fall entirely between recorded samples.
      if (s.y > 730 && s.vy < -5 && (s.left || s.right) && !s.guided) observation.sawFlipperRebound = true;
      const note = reason => {
        if (!observation.violations.some(v => v.reason === reason)) observation.violations.push({ reason, ...s });
      };
      const count = p.engine.world.bodies.filter(body => body.label === 'ball').length;
      if (count !== (p.state.phase === 'gameover' ? 0 : 1)) note('incorrect live ball count');
      if (b && ![s.x, s.y, s.vx, s.vy].every(Number.isFinite)) note('non-finite ball motion');
      if (b && p.state.phase === 'playing' && !p.travel) {
        if (b.isStatic || b.collisionFilter.mask === 0) note('physical ball remains frozen or non-colliding');
        if (Math.hypot(s.vx, s.vy) > 22.01) note('physical ball exceeds existing speed cap');
      }
      if (p.travel && (!b?.isStatic || b.collisionFilter.mask !== 0)) note('invalid guided collision mode');
      // A held catch is permitted, but our players release each bat within
      // 160ms. A ball confined to a 24px radius for 6 simulation seconds is a
      // diagnostic failure, not a cue to rescue it or inject an impulse.
      if (b && p.state.phase === 'playing' && !p.travel && !p.shooter && !p.state.paused) {
        if (!pocket || pocket.id !== b.id || Math.hypot(s.x - pocket.x, s.y - pocket.y) > 24) {
          pocket = { id: b.id, x: s.x, y: s.y, t: p.elapsed };
        } else if (p.elapsed - pocket.t > 6000) note('ball confined to a small pocket for over 6 seconds');
      } else pocket = null;
      if (p.elapsed - lastSample >= 75 || observation.samples.length === 0) {
        observation.samples.push(s);
        lastSample = p.elapsed;
      }
      observation.frame = requestAnimationFrame(sample);
    };
    sample();
  });
}

async function plunge(page, source, inputs = []) {
  if (source === 'keyboard') await page.keyboard.down('Space');
  else {
    await page.locator('#launch').scrollIntoViewIfNeeded();
    const button = await page.locator('#launch').boundingBox();
    await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
    await page.mouse.down();
  }
  inputs.push({ time: Date.now(), action: 'plunger down', source });
  await page.waitForFunction(() => window.pinball.charge === 1, null, { timeout: 5000 });
  if (source === 'keyboard') await page.keyboard.up('Space');
  else {
    await page.mouse.move(20, 110); // captured release outside the Launch button
    await page.mouse.up();
  }
  inputs.push({ time: Date.now(), action: 'plunger up', source });
  await page.waitForFunction(() => {
    const p = window.pinball;
    return p.state.phase === 'playing' && !p.shooter && !p.travel;
  }, null, { timeout: 12000 });
}

for (const player of players) {
  test(`full three-ball game with ${player.name}, natural drains and restart`, async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const errors = [], failures = [], inputs = [], balls = [];
    const held = { KeyZ: false, Slash: false };
    const nextRelease = { KeyZ: 0, Slash: 0 };
    const nextPress = { KeyZ: 0, Slash: 0 };
    const changeKey = async (key, down) => {
      if (held[key] === down) return;
      if (down) await page.keyboard.down(key); else await page.keyboard.up(key);
      held[key] = down;
      inputs.push({ time: Date.now(), key, down });
    };
    const releaseBats = async () => {
      for (const key of Object.keys(held)) await changeKey(key, false);
    };
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => failures.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    await page.goto(gameURL);
    await page.waitForFunction(() => !!window.pinball);
    await startObservation(page);
    try {
      let previousScore = 0;
      const identities = new Set();
      for (let number = 1; number <= 3; number++) {
        const ready = await readState(page);
        expect(ready.phase).toBe('ready');
        expect(ready.ball).toBe(number);
        expect(ready.score).toBe(previousScore);
        expect(ready.paused).toBe(false);
        expect(identities.has(ready.body.id)).toBe(false);
        identities.add(ready.body.id);
        const summary = { number, id: ready.body.id, start: ready.elapsed, scoreBefore: ready.score };
        balls.push(summary);
        if (number === 1) {
          // Check both ordinary controls before serving. A late player's live
          // trajectory may never approach one bat, so coverage must not depend
          // on chance. No ball/physics state is changed by the test.
          await changeKey('KeyZ', true);
          await changeKey('Slash', true);
          await page.waitForFunction(() => window.pinball.flippers.every(f => Math.abs(f.angle - f.raised) < .001));
          await releaseBats();
        }
        inputs.push({ time: Date.now(), action: 'full plunge', source: player.launch, ball: number });
        await plunge(page, player.launch, inputs);
        expect((await readState(page)).body.id).toBe(ready.body.id);

        if (number === 2) {
          await page.keyboard.press('p');
          const before = await readState(page);
          expect(before.paused).toBe(true);
          await page.waitForTimeout(200);
          const after = await readState(page);
          expect(after.body).toEqual(before.body);
          expect(after.elapsed).toBe(before.elapsed);
          expect(after.score).toBe(before.score);
          await page.keyboard.press('p');
          inputs.push({ time: Date.now(), action: 'pause/resume', ball: number });
        }

        const started = Date.now();
        while (Date.now() - started < 20000) {
          const s = await readState(page);
          expect(s.violations).toEqual([]);
          if (s.phase !== 'playing' || s.ball !== number) break;
          expect(s.body.id).toBe(ready.body.id);
          const now = Date.now();
          for (const [key, left] of [['KeyZ', true], ['Slash', false]]) {
            if (held[key] && now >= nextRelease[key]) {
              await changeKey(key, false);
              nextPress[key] = now + player.pause;
            } else if (!held[key] && now >= nextPress[key] && !s.guided && s.body.y > player.threshold && s.body.vy > 0 && (left ? s.body.x < 250 : s.body.x >= 250)) {
              await changeKey(key, true);
              nextRelease[key] = now + player.pulse;
            }
          }
          await page.waitForTimeout(player.interval);
        }
        await releaseBats();
        summary.handsOffAt = (await readState(page)).elapsed;
        // Let go and allow gravity to drain the ball. Never call drain(), move
        // it below the table, restart early, or rescue a stalled ball.
        const drainDeadline = Date.now() + 45000;
        let end = await readState(page);
        while (end.phase === 'playing' && end.ball === number && Date.now() < drainDeadline) {
          expect(end.violations).toEqual([]);
          await page.waitForTimeout(100);
          end = await readState(page);
        }
        expect(end.violations).toEqual([]);
        expect(end.phase, `ball ${number} failed to drain naturally: ${JSON.stringify(end)}`).toBe(number === 3 ? 'gameover' : 'ready');
        expect(end.ball).toBe(Math.min(number + 1, 3));
        expect(end.score).toBeGreaterThanOrEqual(previousScore);
        previousScore = end.score;
        Object.assign(summary, { end: end.elapsed, scoreAfter: end.score, phaseAfter: end.phase });
        console.log(`Ball ${number} completed: ${JSON.stringify(summary)}`);
        await expect(page.locator('#score')).toHaveText(String(end.score).padStart(6, '0'));
        await expect(page.locator('#ball')).toContainText(String(end.ball).padStart(2, '0'));
      }

      const samples = await page.evaluate(() => window.fullGameObservation.samples);
      for (const number of [1, 2, 3]) {
        const live = samples.filter(s => s.ball === number && s.phase === 'playing' && !s.shooter && !s.guided);
        expect(live.some(s => s.y > 740 && s.x < 470), `ball ${number} must reach physical flipper area`).toBe(true);
        expect(live.every(s => s.x < 486), `ball ${number} must stay out of dead shooter lane`).toBe(true);
        expect(new Set(live.map(s => s.id))).toEqual(new Set([balls[number - 1].id]));
      }
      expect(inputs.filter(i => i.down && i.key === 'KeyZ').length).toBeGreaterThan(0);
      expect(inputs.filter(i => i.down && i.key === 'Slash').length).toBeGreaterThan(0);
      // The reactive player must demonstrate a useful shot. The deliberately
      // late player may miss; its contract is a complete, controllable game,
      // not a guaranteed successful shot from poor timing. Both bats' contacts
      // remain independently covered by the actual Matter regression suite.
      if (player.name === 'keyboard reactive') {
        expect(await page.evaluate(() => window.fullGameObservation.sawFlipperRebound)).toBe(true);
      }
      expect(previousScore).toBeGreaterThan(0);
      expect(samples.every((s, i) => i === 0 || s.score >= samples[i - 1].score)).toBe(true);
      await expect(page.locator('#message-title')).toHaveText('CLAIMED BY THE DEEP');
      await expect(page.locator('#message-detail')).toContainText(`FINAL SCORE ${previousScore.toLocaleString('en-US')}`);

      // Ordinary launch input cannot create a fourth ball or change final score.
      await page.keyboard.down('Space');
      await page.waitForTimeout(150);
      await page.keyboard.up('Space');
      const over = await readState(page);
      expect({ phase: over.phase, ball: over.ball, score: over.score, body: over.body }).toEqual({ phase: 'gameover', ball: 3, score: previousScore, body: null });
      await page.evaluate(() => cancelAnimationFrame(window.fullGameObservation.frame));

      if (player.launch === 'pointer') await page.locator('#restart').click();
      else await page.keyboard.press('r');
      const restarted = await readState(page);
      expect({ phase: restarted.phase, ball: restarted.ball, score: restarted.score, paused: restarted.paused, charge: restarted.charge }).toEqual({ phase: 'ready', ball: 1, score: 0, paused: false, charge: 0 });
      await expect(page.locator('#score')).toHaveText('000000');
      await plunge(page, player.launch, inputs);
      await page.waitForFunction(() => {
        const p = window.pinball;
        return p.state.ballNumber === 1 && p.state.phase === 'playing' && !p.shooter && !p.travel && p.ball.position.y > 740;
      });
      expect(errors).toEqual([]);
      expect(failures).toEqual([]);
    } finally {
      await releaseBats();
      await page.keyboard.up('Space');
      await page.mouse.up();
      const observation = await page.evaluate(() => {
        cancelAnimationFrame(window.fullGameObservation.frame);
        return { samples: window.fullGameObservation.samples, violations: window.fullGameObservation.violations, sawFlipperRebound: window.fullGameObservation.sawFlipperRebound };
      });
      const summary = {
        player, balls, errors, failures, violations: observation.violations,
        sawFlipperRebound: observation.sawFlipperRebound,
        simulatedSeconds: observation.samples.at(-1)?.t / 1000,
        flipperPresses: Object.fromEntries(Object.keys(held).map(key => [key, inputs.filter(i => i.key === key && i.down).length])),
        guidedShots: [...new Set(observation.samples.map(s => s.guided).filter(Boolean))],
      };
      console.log(`Full-game baseline: ${JSON.stringify(summary)}`);
      await testInfo.attach('full-game-summary', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
      await testInfo.attach('full-game-input-and-trajectory', { body: JSON.stringify({ inputs, ...observation }), contentType: 'application/json' });
      await testInfo.attach('full-game-screen', { body: await page.screenshot(), contentType: 'image/png' });
    }
  });
}
