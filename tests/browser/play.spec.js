import { test, expect } from '@playwright/test';

// Relative navigation preserves a deployed repository subdirectory. The SHA
// avoids reusing an old cached HTML response during a post-deployment playtest.
const gameURL = process.env.PINBALL_BASE_URL
  ? `./?debug=1&deployment=${process.env.GITHUB_SHA || 'playtest'}` : './?debug=1';

test('renders, charges, launches, flips, pauses, and restarts without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(gameURL);
  await page.waitForFunction(() => !!window.pinball);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#message')).toHaveClass(/visible/);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge > .95);
  await page.keyboard.up('Space');
  await expect(page.locator('#message')).not.toHaveClass(/visible/);
  await page.waitForFunction(() => !window.pinball.shooter && !window.pinball.travel);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('ShiftRight');
  await page.waitForFunction(() => window.pinball.flippers.every(f => Math.abs(f.angle - f.raised) < .001));
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('ShiftRight');
  await page.keyboard.press('p');
  const before = await page.evaluate(() => ({ ...window.pinball.ball.position }));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => ({ ...window.pinball.ball.position }))).toEqual(before);
  await expect(page.locator('#message-title')).toHaveText('HOLD YOUR BREATH');
  await page.keyboard.press('p');
  await page.keyboard.press('r');
  expect(await page.evaluate(() => ({ phase: window.pinball.state.phase, ball: window.pinball.state.ballNumber, score: window.pinball.state.score }))).toEqual({ phase: 'ready', ball: 1, score: 0 });
  await page.screenshot({ path: '/tmp/roll4sanity-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('phone layout fits screen and pointer controls charge and flip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(gameURL);
  await page.waitForFunction(() => !!window.pinball);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const left = await page.locator('#left-flipper').boundingBox();
  await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.pinball.controls.left);
  await page.mouse.up();
  await page.waitForFunction(() => !window.pinball.controls.left);
  const launch = await page.locator('#launch').boundingBox();
  await page.mouse.move(launch.x + launch.width / 2, launch.y + launch.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.pinball.charge > .4);
  await page.mouse.up();
  await page.waitForFunction(() => window.pinball.state.phase === 'playing');
  await page.screenshot({ path: '/tmp/roll4sanity-mobile.png', fullPage: true });
});

test('focus loss pauses safely without releasing a charged plunger', async ({ page }) => {
  await page.goto(gameURL);
  await page.waitForFunction(() => !!window.pinball);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge > .1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => ({ phase: window.pinball.state.phase, paused: window.pinball.state.paused, charge: window.pinball.charge, plunger: window.pinball.controls.plunger }))).toEqual({ phase: 'ready', paused: true, charge: 0, plunger: false });
  await page.keyboard.up('Space');
  await page.keyboard.press('p');
  expect(await page.evaluate(() => window.pinball.state.phase)).toBe('ready');
});

test('losing pointer capture cancels a charge instead of firing the plunger', async ({ page }) => {
  await page.goto(gameURL);
  await page.waitForFunction(() => !!window.pinball);
  await page.locator('#launch').scrollIntoViewIfNeeded();
  await page.locator('#launch').evaluate(button => {
    button.addEventListener('gotpointercapture', event => {
      button.dataset.capturedPointer = String(event.pointerId);
    }, { once: true });
  });
  const box = await page.locator('#launch').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
  await page.waitForFunction(() => window.pinball.charge > .2);
  await page.evaluate(() => {
    const button = document.getElementById('launch');
    button.releasePointerCapture(Number(button.dataset.capturedPointer));
  });
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2);
  await page.mouse.up();
  expect(await page.evaluate(() => ({
    phase: window.pinball.state.phase,
    charge: window.pinball.charge,
    plunger: window.pinball.controls.plunger,
    parked: window.pinball.ball.isStatic,
  }))).toEqual({ phase: 'ready', charge: 0, plunger: false, parked: true });
});

test('a weak Space plunge rearms and a full retry reaches the flippers', async ({ page }) => {
  await page.goto(gameURL);
  await page.waitForFunction(() => !!window.pinball);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge > .1);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.pinball.state.phase === 'ready');
  await expect(page.locator('#message-title')).toHaveText('PLUNGE TOO SOFT');
  expect(await page.evaluate(() => window.pinball.state.ballNumber)).toBe(1);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge === 1);
  await expect(page.locator('#message-detail')).toHaveText('FULL CHARGE · RELEASE TO LAUNCH');
  await page.keyboard.up('Space');
  await page.waitForFunction(() => {
    const p = window.pinball;
    return p.state.ballNumber === 1 && !p.shooter && !p.travel && p.ball.position.x < 470 && p.ball.position.y > 740;
  });
});

for (const source of ['Space', 'Launch button']) {
  test(`${source} plays beyond the launch guide without returning to a dead shooter lane`, async ({ page }) => {
    const errors = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(gameURL);
    await page.waitForFunction(() => !!window.pinball);
    await page.evaluate(() => {
      window.plungeTrace = [];
      const sample = () => {
        const p = window.pinball, b = p.ball;
        window.plungeTrace.push({ t: p.elapsed, x: b?.position.x, y: b?.position.y,
          vy: b?.velocity.y, phase: p.state.phase, ball: p.state.ballNumber,
          shooter: p.shooter, guided: !!p.travel, score: p.state.score });
        window.plungeFrame = requestAnimationFrame(sample);
      };
      sample();
    });
    if (source === 'Space') await page.keyboard.down('Space');
    else {
      await page.locator('#launch').scrollIntoViewIfNeeded();
      const r = await page.locator('#launch').boundingBox();
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await page.mouse.down();
    }
    await page.waitForFunction(() => window.pinball.charge === 1);
    if (source === 'Space') await page.keyboard.up('Space');
    else {
      // A captured release outside the button must still fire exactly once.
      await page.mouse.move(20, 110);
      await page.mouse.up();
    }
    await page.waitForFunction(() => window.plungeTrace.some(s => s.ball === 1 && !s.shooter && !s.guided && s.y > 740));
    // Play with the actual keyboard, watching the live simulation instead of
    // injecting velocity/position or advancing the physics manually.
    const held = { ShiftLeft: false, ShiftRight: false };
    const end = Date.now() + 4000;
    while (Date.now() < end) {
      const b = await page.evaluate(() => {
        const p = window.pinball;
        return p.state.phase === 'playing' && !p.travel && p.ball
          ? { x: p.ball.position.x, y: p.ball.position.y, vy: p.ball.velocity.y } : null;
      });
      for (const [key, side] of [['ShiftLeft', 'left'], ['ShiftRight', 'right']]) {
        const press = !!b && b.y > 735 && b.vy > 0 && (side === 'left' ? b.x < 250 : b.x >= 250);
        if (press !== held[key]) {
          if (press) await page.keyboard.down(key); else await page.keyboard.up(key);
          held[key] = press;
        }
      }
      await page.waitForTimeout(30);
    }
    for (const key of Object.keys(held)) await page.keyboard.up(key);
    const trace = await page.evaluate(() => {
      cancelAnimationFrame(window.plungeFrame);
      return window.plungeTrace;
    });
    const live = trace.filter(s => s.ball === 1 && s.phase === 'playing' && !s.guided && !s.shooter);
    expect(live.length).toBeGreaterThan(50);
    expect(live.some(s => s.y > 740 && s.x < 470)).toBe(true);
    expect(live.some(s => s.y > 740 && s.vy < -5)).toBe(true);
    expect(live.every(s => s.x < 486)).toBe(true);
    expect(Math.max(...live.map(s => s.score))).toBeGreaterThan(100);
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
    await page.screenshot({ path: `/tmp/roll4sanity-launch-${source === 'Space' ? 'keyboard' : 'pointer'}.png`, fullPage: true });
  });
}
