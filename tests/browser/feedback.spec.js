import { test, expect } from '@playwright/test';

const gameURL = process.env.PINBALL_BASE_URL
  ? `./?debug=1&deployment=${process.env.GITHUB_SHA || 'stage1'}` : './?debug=1';

test('Stage 1 cabinet displays the emerald and brass design with playfield artwork', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(gameURL);
  await page.waitForFunction(() => !!window.pinball);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.edition')).toHaveText('THE SUNKEN TABLE R4S');
  expect(await page.evaluate(() => {
    const art = window.pinballPresentation.table.artwork;
    return { loaded: art.texture.key === 'playfield-art', width: art.displayWidth,
      height: art.displayHeight, behindMechanisms: art.depth < 0, physicsBody: !!art.body };
  })).toEqual({ loaded: true, width: 540, height: 960, behindMechanisms: true, physicsBody: false });
  await expect(page.locator('canvas')).toBeVisible();
  const appearance = await page.evaluate(() => {
    const style = selector => getComputedStyle(document.querySelector(selector));
    return {
      frame: style('.machine').borderTopColor,
      cabinet: style('.machine').backgroundImage,
      score: style('#score').color,
      title: style('h1').fontFamily,
      fontLoaded: document.fonts.check('350 48px "Josefin Sans"'),
    };
  });
  expect(appearance.frame).toBe('rgb(169, 139, 80)');
  expect(appearance.cabinet).toContain('rgb(38, 67, 56)');
  expect(appearance.cabinet).toContain('rgb(16, 39, 31)');
  expect(appearance.score).toBe('rgb(241, 234, 216)');
  expect(appearance.title).toContain('Josefin Sans');
  expect(appearance.fontLoaded).toBe(true);
  await testInfo.attach('published-cabinet-appearance', {
    body: JSON.stringify({ url: page.url(), ...appearance }, null, 2), contentType: 'application/json',
  });
  await page.keyboard.press('d'); // Hide the inspection overlay in the evidence image.
  await testInfo.attach('published-cabinet-screenshot', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
});

async function open(page) {
  await page.goto(gameURL);
  await page.waitForFunction(() => !!window.pinballPresentation);
}

for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080], [768, 1024], [390, 844], [360, 640], [320, 568], [844, 390]]) {
  test(`Stage 1 table and essential controls fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      items: ['game', 'launch', 'left-flipper', 'right-flipper', 'sound', 'pause', 'restart', 'score', 'ball'].map(id => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { id, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      }),
      canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height],
      radius: window.pinball.ball.circleRadius,
    }));
    expect(layout.width).toBeLessThanOrEqual(width);
    expect(layout.height).toBeLessThanOrEqual(height + 1);
    for (const item of layout.items) {
      expect(item.x, item.id).toBeGreaterThanOrEqual(0);
      expect(item.y, item.id).toBeGreaterThanOrEqual(0);
      expect(item.right, item.id).toBeLessThanOrEqual(width + 1);
      expect(item.bottom, item.id).toBeLessThanOrEqual(height + 1);
      expect(item.width, item.id).toBeGreaterThan(0);
      if (['launch', 'left-flipper', 'right-flipper'].includes(item.id)) expect(item.height).toBeGreaterThanOrEqual(44);
    }
    const table = layout.items.find(item => item.id === 'game');
    expect(table.width / table.height).toBeCloseTo(9 / 16, 2);
    expect(layout.canvas).toEqual([540, 960]);
    expect(layout.radius).toBe(9);
    await page.keyboard.press('d');
    await page.screenshot({ path: `/tmp/roll4sanity-stage1-${width}x${height}.png`, fullPage: true });
  });
}

test('Stage 1 audio unlocks on real input, produces signal, mutes immediately and remembers preference', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page);
  expect(await page.evaluate(() => window.pinballPresentation.sound.context)).toBe(null);
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => window.pinballPresentation.sound.context?.state === 'running');
  await page.keyboard.up('KeyZ');
  await page.waitForTimeout(100);
  // Measure the real Web Audio graph rather than stubbing play() or accepting
  // only a running AudioContext as evidence of generated sound.
  await page.evaluate(() => {
    const sound = window.pinballPresentation.sound;
    const analyser = sound.context.createAnalyser();
    analyser.fftSize = 256;
    sound.master.connect(analyser);
    window.audioProbe = { analyser, data: new Float32Array(256) };
  });
  const signal = await page.evaluate(async () => {
    const sound = window.pinballPresentation.sound, probe = window.audioProbe;
    const results = {};
    for (const kind of ['flipper', 'bumper', 'sling', 'ward', 'post', 'launch', 'orbit', 'ramp']) {
      let peak = 0;
      sound.play(kind);
      for (let frame = 0; frame < 8; frame++) {
        await new Promise(requestAnimationFrame);
        probe.analyser.getFloatTimeDomainData(probe.data);
        peak = Math.max(peak, ...probe.data.map(Math.abs));
      }
      results[kind] = peak;
    }
    return results;
  });
  for (const [kind, peak] of Object.entries(signal)) {
    expect(peak, `${kind} should generate audible signal`).toBeGreaterThan(.001);
    expect(peak, `${kind} should have conservative output level`).toBeLessThan(.2);
  }
  expect(await page.evaluate(() => {
    const sound = window.pinballPresentation.sound;
    for (let i = 0; i < 50; i++) sound.play(['flipper', 'bumper', 'sling', 'ward', 'post', 'launch', 'orbit', 'ramp'][i % 8]);
    return sound.voices.size;
  })).toBeLessThanOrEqual(10);
  await page.waitForFunction(() => window.pinballPresentation.sound.voices.size === 0);
  await page.evaluate(() => window.pinballPresentation.sound.play('launch'));
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  const muted = await page.evaluate(() => {
    const sound = window.pinballPresentation.sound;
    return { gain: sound.master.gain.value, voices: sound.voices.size, played: sound.played };
  });
  expect(muted.gain).toBe(0);
  expect(muted.voices).toBe(0);
  await page.keyboard.press('Slash');
  expect(await page.evaluate(() => window.pinballPresentation.sound.played)).toBe(muted.played);
  await page.reload();
  await page.waitForFunction(() => !!window.pinballPresentation);
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.pinballPresentation.sound.context)).toBe(null);
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await page.waitForFunction(() => window.pinballPresentation.sound.context?.state === 'running');
  // Pause cancels active effects; it must not leave delayed notes playing.
  await page.keyboard.down('KeyZ');
  await page.keyboard.press('p');
  await page.waitForFunction(() => window.pinballPresentation.sound.paused);
  expect(await page.evaluate(() => window.pinballPresentation.sound.voices.size)).toBe(0);
  await page.keyboard.up('KeyZ');
  await page.keyboard.press('p');
  await page.waitForFunction(() => !window.pinballPresentation.sound.paused);
  await page.evaluate(() => {
    window.pinballPresentation.sound.play('ramp');
    window.dispatchEvent(new Event('blur'));
  });
  expect(await page.evaluate(() => ({ voices: window.pinballPresentation.sound.voices.size, gain: window.pinballPresentation.sound.master.gain.value }))).toEqual({ voices: 0, gain: 0 });
  expect(errors).toEqual([]);
});

test('Stage 1 real bumper scoring has readable feedback and sound without changing points or ball size', async ({ page }) => {
  await open(page);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge === 1);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.pinball.state.score > 0 && document.getElementById('score-feedback').classList.contains('visible'));
  const award = await page.locator('#score-feedback').textContent();
  expect(award).toMatch(/^(BUMPER|SLING|WARD|ORBIT|RAMP|POINTS) \+[\d,]+$/);
  await page.waitForTimeout(350);
  await expect(page.locator('#score-feedback')).toHaveClass(/visible/);
  expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.has('launch'))).toBe(true);
  expect(await page.evaluate(() => window.pinballPresentation.sound.lastPlayed.has('bumper'))).toBe(true);
  const before = await page.evaluate(() => ({ score: window.pinball.state.score, radius: window.pinball.ball.circleRadius }));
  expect(before.score).toBeGreaterThanOrEqual(100);
  expect(before.radius).toBe(9);
  await page.keyboard.press('p');
  await expect(page.locator('#score-feedback')).not.toHaveClass(/visible/);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.pinball.state.score)).toBe(before.score);
  await page.keyboard.press('r');
  await expect(page.locator('#score-feedback')).not.toHaveClass(/visible/);
  await expect(page.locator('#score')).toHaveText('000000');
});

test('Stage 1 remains playable without browser audio support or accessible storage', async ({ page }) => {
  await page.addInitScript(() => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page);
  await expect(page.locator('#sound')).toBeDisabled();
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge === 1);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => !window.pinball.shooter && !window.pinball.travel);
  expect(await page.evaluate(() => window.pinball.state.phase)).toBe('playing');
  expect(errors).toEqual([]);
});

test('Stage 1 actual phone touch input launches and flips with sound unlocked', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await open(page);
    // Touchscreen.tap is a trusted gesture and checks the actual touch target.
    await page.locator('#left-flipper').tap();
    await page.waitForFunction(() => window.pinballPresentation.sound.context?.state === 'running');
    // A held touch is sent through Chromium's touch input, not dispatchEvent.
    const client = await context.newCDPSession(page);
    const button = await page.locator('#launch').boundingBox();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2 }] });
    await page.waitForFunction(() => window.pinball.charge === 1);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => !window.pinball.shooter && !window.pinball.travel);
    expect(await page.evaluate(() => window.pinball.state.phase)).toBe('playing');
    await page.locator('#right-flipper').tap();
    expect(await page.evaluate(() => window.pinball.controls.right)).toBe(false);
  } finally { await context.close(); }
});

test('Stage 1 Z and Slash replace Shift with independent, repeat-safe and focus-safe flippers', async ({ page }) => {
  await open(page);
  await expect(page.locator('#game')).toHaveAttribute('aria-label', /Z controls the left flipper\. Slash controls the right flipper/);
  await expect(page.locator('.control-row').first()).toContainText('Z left · / right');
  await page.evaluate(() => {
    window.keyDefaults = [];
    // Registered after the game's listener, so this sees its default prevention.
    for (const type of ['keydown', 'keyup']) window.addEventListener(type, e => {
      window.keyDefaults.push({ code: e.code, type, repeat: e.repeat, prevented: e.defaultPrevented });
    });
  });
  const controls = () => page.evaluate(() => ({ ...window.pinball.controls }));
  for (const key of ['ShiftLeft', 'ShiftRight']) {
    await page.keyboard.down(key);
    expect(await controls()).toEqual({ left: false, right: false, plunger: false });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.pinball.flippers.every(f => f.angle === f.rest))).toBe(true);
    await page.keyboard.up(key);
  }
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => {
    const [l, r] = window.pinball.flippers;
    return Math.abs(l.angle - l.raised) < .001 && r.angle === r.rest;
  });
  await page.keyboard.down('KeyZ'); // actual repeated keyboard event while held
  await page.keyboard.down('Slash');
  await page.waitForFunction(() => window.pinball.flippers.every(f => Math.abs(f.angle - f.raised) < .001));
  expect(await controls()).toEqual({ left: true, right: true, plunger: false });
  await page.keyboard.up('KeyZ');
  await page.waitForFunction(() => {
    const [l, r] = window.pinball.flippers;
    return l.angle === l.rest && Math.abs(r.angle - r.raised) < .001;
  });
  expect(await controls()).toEqual({ left: false, right: true, plunger: false });
  await page.keyboard.up('Slash');
  await page.waitForFunction(() => window.pinball.flippers.every(f => f.angle === f.rest));
  await page.keyboard.down('KeyZ');
  await page.keyboard.down('Slash');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge > .1);
  expect(await controls()).toEqual({ left: true, right: true, plunger: true });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await controls()).toEqual({ left: false, right: false, plunger: false });
  expect(await page.evaluate(() => ({ paused: window.pinball.state.paused, phase: window.pinball.state.phase, charge: window.pinball.charge }))).toEqual({ paused: true, phase: 'ready', charge: 0 });
  for (const key of ['KeyZ', 'Slash', 'Space']) await page.keyboard.up(key);
  const events = await page.evaluate(() => window.keyDefaults);
  expect(events.some(e => e.code === 'KeyZ' && e.repeat)).toBe(true);
  expect(events.filter(e => ['KeyZ', 'Slash', 'Space'].includes(e.code)).every(e => e.prevented)).toBe(true);
  expect(events.filter(e => e.code.startsWith('Shift')).every(e => !e.prevented)).toBe(true);
  await page.keyboard.press('p');
  await page.keyboard.down('Slash');
  await page.waitForFunction(() => window.pinball.controls.right);
  await page.keyboard.up('Slash');
  expect(await controls()).toEqual({ left: false, right: false, plunger: false });
});


// Controlled initial placement tests presentation after a REAL Matter contact.
// Ordinary-input whole-game coverage remains in full-game.spec.js; it does not
// require a first ball to happen to strike any particular small obstacle.
test('both wards show 75-point feedback and their own sound after actual contact', async ({ page }, testInfo) => {
  test.setTimeout(45000);
  await open(page);
  const evidence = [];
  for (const side of [0, 1]) {
    await page.keyboard.press('r');
    await page.keyboard.down('Space');
    await page.waitForFunction(() => window.pinball.charge === 1);
    await page.keyboard.up('Space');
    await page.waitForFunction(() => !window.pinball.travel && !window.pinball.shooter);
    await page.keyboard.press('p');
    const before = await page.evaluate(side => {
      const p = window.pinball, Body = window.Phaser.Physics.Matter.Matter.Body;
      const ward = p.engine.world.bodies.find(b => b.label === `ward:${side}`);
      // Fixture setup only. Thereafter the normal game loop resolves collision;
      // no collision callbacks, kicks, scores, physics steps or feedback are invoked.
      Body.setPosition(p.ball, { x: ward.position.x, y: ward.position.y + 22 });
      Body.setVelocity(p.ball, { x: 0, y: -3 });
      Body.setAngularVelocity(p.ball, 0);
      return { score: p.state.score, body: p.ball.id };
    }, side);
    await page.keyboard.press('p');
    const hit = await page.waitForFunction(side => {
      const p = window.pinball, feedback = window.pinballPresentation;
      if (!p.flashes.has(`ward:${side}`) || feedback.message !== 'WARD +75' || !feedback.visible) return false;
      return { score: p.state.score, caption: document.getElementById('score-feedback').textContent,
        sound: feedback.sound.lastPlayed.has('ward'), body: p.ball.id };
    }, side);
    const result = await hit.jsonValue();
    expect(result).toEqual({ score: before.score + 75, body: before.body, caption: 'WARD +75', sound: true });
    evidence.push({ side, before, result });
  }
  await testInfo.attach('actual-contact-ward-feedback', { body: JSON.stringify(evidence), contentType: 'application/json' });
});
