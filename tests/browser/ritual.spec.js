import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function open(page) {
  await page.goto('./?debug=1');
  await page.waitForFunction(() => !!window.pinballPresentation);
  await page.keyboard.press('d');
}
async function enter(page, id, x, y) {
  await page.keyboard.press('r');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.pinball.charge === 1);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => {
    const p = window.pinball;
    return !p.travel && !p.shooter && p.elapsed > p.shotLock;
  });
  await page.keyboard.press('p');
  await page.evaluate(({ x, y }) => {
    const p = window.pinball, Body = window.Phaser.Physics.Matter.Matter.Body;
    // Only fixture pose; normal Matter contact/capture and guide clock follow.
    Body.setPosition(p.ball, { x, y }); Body.setVelocity(p.ball, { x: 0, y: -7 }); Body.setAngularVelocity(p.ball, 0);
  }, { x, y });
  await page.keyboard.press('p');
  await page.waitForFunction(id => window.pinball.travel?.shot.id === id && window.pinballPresentation.table.lights.spells.active === window.pinball.travel, id);
}
async function groups(page) { return page.evaluate(() => [...window.pinballPresentation.sound.ritual.groups].map(g => g.name)); }

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`ritual: four real routes, audible progress, completion and eye alignment at ${viewport.width}`, async ({ page }, info) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await open(page);
    const metrics = [];
    const expectedEyes = {
      'left-ramp': { kind: 'ramp', colour: 0x21e58d, iris: [89, 236, 170] },
      'right-ramp': { kind: 'ramp', colour: 0xf23c55, iris: [245, 109, 128] },
      'left-orbit': { kind: 'orbit', colour: 0x329dff, iris: [101, 182, 255] },
      'right-orbit': { kind: 'orbit', colour: 0xaf58ff, iris: [195, 130, 255] },
    };
    for (const [id, x, y] of [['left-orbit', 59, 451], ['right-orbit', 441, 451], ['right-ramp', 315, 470], ['left-ramp', 185, 470]]) {
      await enter(page, id, x, y);
      await page.waitForFunction(() => window.pinballPresentation.table.lights.chase?.progress > .1);
      const first = await page.evaluate(() => {
        const f = window.pinballPresentation, a = f.sound, g = a.ritual.travel;
        const analyser = a.context.createAnalyser(); analyser.fftSize = 512; a.master.connect(analyser);
        window.ritualProbe = analyser;
        window.ritualFrames = []; window.ritualFrameAt = performance.now();
        window.ritualFrame = () => { const now = performance.now(); window.ritualFrames.push(now - window.ritualFrameAt); window.ritualFrameAt = now; if (window.pinball.travel) requestAnimationFrame(window.ritualFrame); };
        requestAnimationFrame(window.ritualFrame);
        return { kind: window.pinball.travel.shot.kind, eyes: f.table.lights.cues.has('eyes'), frequency: g.tones[1].frequency.value, progress: g.progress };
      });
      expect(first.eyes).toBe(false); expect(first.kind).toBe(expectedEyes[id].kind);
      await page.waitForFunction(() => window.pinballPresentation.table.lights.chase?.progress > .82);
      const peak = await page.evaluate(() => {
        const p = window.pinball, f = window.pinballPresentation, c = f.table.lights.chase, a = f.sound;
        const data = new Float32Array(512); window.ritualProbe.getFloatTimeDomainData(data);
        return { head: c.head, ball: { ...p.ball.position }, phase: c.phase,
          frequency: a.ritual.travel.tones[1].frequency.value, progress: a.ritual.travel.progress,
          peak: Math.max(...data.map(Math.abs)), rune: a.lastPlayed.has('rune'), groups: a.ritual.groups.size };
      });
      expect(peak.phase).toBe('buildup');
      expect(Math.hypot(peak.head.x - peak.ball.x, peak.head.y - peak.ball.y)).toBeLessThan(.01);
      expect(peak.frequency).toBeGreaterThan(first.frequency + 400);
      expect(peak.peak).toBeGreaterThan(.002); expect(peak.peak).toBeLessThan(.25);
      expect(peak.rune).toBe(true); expect(peak.groups).toBeLessThanOrEqual(4);
      if (id === 'left-ramp') {
        await mkdir(info.outputDir, { recursive: true });
        await page.screenshot({ path: info.outputPath(`spell-${viewport.width}.png`) });
      }
      await page.waitForFunction(() => !window.pinball.travel);
      await page.waitForFunction(() => window.pinballPresentation.table.lights.spells.completions.length > 0);
      const completion = await groups(page);
      expect(completion).toContain('completion');
      expect(completion.includes('awakening')).toBe(expectedEyes[id].kind === 'ramp');
      expect(completion.includes('chant')).toBe(expectedEyes[id].kind === 'ramp');
      expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.has('eyes'))).toBe(true);
      {
        await page.waitForFunction(() => {
          const f = window.pinballPresentation, c = f.table.lights.cues.get('eyes');
          return c && window.pinball.elapsed - c.at >= 500;
        });
        const eyes = await page.evaluate(() => {
          const f = window.pinballPresentation, canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
          return { colours: [230, 310].map(x => [...ctx.getImageData(x, 391, 1, 1).data]),
            irises: [230, 310].map(x => [...ctx.getImageData(x + 8, 391, 1, 1).data].slice(0, 3)),
            cueId: f.table.lights.cues.get('eyes').shotId, colour: f.table.lights.cues.get('eyes').palette.colour,
            depth: f.table.lights.eyes.depth, moving: f.table.moving.depth, artwork: f.table.artwork.depth,
            groups: [...f.sound.ritual.groups].map(g => ({ name: g.name, nodes: g.nodes.length })) };
        });
        for (const [r, g, b] of eyes.colours) { expect(r).toBeGreaterThan(235); expect(g).toBeGreaterThan(215); expect(b).toBeGreaterThan(160); }
        expect(eyes.cueId).toBe(id); expect(eyes.colour).toBe(expectedEyes[id].colour);
        for (const iris of eyes.irises) iris.forEach((value, channel) => expect(Math.abs(value - expectedEyes[id].iris[channel])).toBeLessThanOrEqual(2));
        expect(eyes.depth).toBeGreaterThan(4); expect(eyes.depth).toBeLessThan(eyes.moving);
        await page.screenshot({ path: info.outputPath(`${id}-eyes-${viewport.width}.png`) });
        expect(eyes.groups.find(g => g.name === 'completion').nodes).toBeGreaterThan(10); // Includes the bounded echo graph.
        await page.waitForFunction(() => !window.pinballPresentation.table.lights.cues.has('eyes'));
        await page.waitForFunction(() => window.pinballPresentation.sound.ritual.groups.size === 0);
      }
      metrics.push({ id, peak, frames: await page.evaluate(() => {
        const samples = window.ritualFrames.slice(2).sort((a, b) => a - b);
        return { count: samples.length, median: samples[Math.floor(samples.length / 2)], p95: samples[Math.floor(samples.length * .95)] };
      }) });
      await page.evaluate(() => { window.pinballPresentation.sound.master.disconnect(window.ritualProbe); window.ritualProbe.disconnect(); });
    }
    await info.attach('ritual-signal-and-render-timing', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
    expect(errors).toEqual([]);
  });
}

test('ritual: mute, pause, focus loss and interruption release sources without completion replay', async ({ page }) => {
  await open(page); await enter(page, 'left-ramp', 185, 470);
  await page.keyboard.press('p');
  await page.waitForFunction(() => window.pinballPresentation.sound.ritual.groups.size === 0);
  const frozen = await page.evaluate(() => window.pinball.elapsed);
  expect(await page.evaluate(() => window.pinballPresentation.table.lights.chase)).toBe(null);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.pinball.elapsed)).toBe(frozen);
  await page.keyboard.press('p');
  await page.waitForFunction(() => !!window.pinballPresentation.sound.ritual.travel);
  await page.locator('#sound').click();
  await page.waitForFunction(() => window.pinballPresentation.sound.ritual.groups.size === 0);
  expect(await page.evaluate(() => window.pinballPresentation.sound.master.gain.value)).toBe(0);
  await page.locator('#sound').click();
  await page.waitForFunction(() => !!window.pinballPresentation.sound.ritual.travel);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.pinballPresentation.sound.ritual.groups.size === 0);
  await page.keyboard.press('r');
  expect(await groups(page)).toEqual([]);
  expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.has('eyes'))).toBe(false);
});

test('ritual: CALM is stationary, audio independent, saved chant OFF is respected and cleans up', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator('#chant')).toHaveText('CHANT: ON');
  await page.locator('#chant').click();
  await enter(page, 'left-ramp', 185, 470);
  expect(await page.evaluate(() => window.pinballPresentation.table.lights.chase)).toBe(null);
  expect(await groups(page)).toContain('travel');
  await page.waitForFunction(() => !window.pinball.travel);
  await page.waitForTimeout(80);
  expect(await groups(page)).toContain('awakening');
  expect(await groups(page)).not.toContain('chant');
  expect(await page.evaluate(() => window.pinballPresentation.table.lights.cues.has('eyes'))).toBe(true);
  await page.locator('#chant').click();
  await expect(page.locator('#motion')).toHaveText('LIGHTS: CALM');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await enter(page, 'left-ramp', 185, 470);
  await page.waitForFunction(() => [...window.pinballPresentation.sound.ritual.groups].some(g => g.name === 'chant'));
  expect((await groups(page)).length).toBeLessThanOrEqual(4);
  await page.locator('#chant').click();
  await page.waitForFunction(() => ![...window.pinballPresentation.sound.ritual.groups].some(g => g.name === 'chant'));
  await page.reload(); await page.waitForFunction(() => !!window.pinballPresentation);
  await expect(page.locator('#chant')).toHaveText('CHANT: OFF');
  // Destroy during an active release must immediately disconnect every group.
  const remaining = await page.evaluate(async () => {
    const a = window.pinballPresentation.sound; a.unlock(); await a.context.resume();
    a.ritual.startSpell(.5); a.ritual.stopAll(); a.destroy();
    return a.ritual.groups.size;
  });
  expect(remaining).toBe(0);
});

test('ritual: render budget stays bounded and a muted completion never replays on unmute', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const objects = await page.evaluate(() => window.pinballPresentation.table.scene.children.length);
  expect(objects).toBeGreaterThan(0);
  await enter(page, 'left-ramp', 185, 470);
  const timings = await page.evaluate(async () => {
    const intervals = []; let previous = performance.now();
    for (let i = 0; i < 42; i++) {
      await new Promise(requestAnimationFrame); const now = performance.now();
      intervals.push(now - previous); previous = now;
    }
    intervals.splice(0, 2); intervals.sort((a, b) => a - b);
    return { samples: intervals.length, median: intervals[Math.floor(intervals.length / 2)], p95: intervals[Math.floor(intervals.length * .95)] };
  });
  expect(timings.samples).toBe(40);
  expect(await page.evaluate(() => window.pinballPresentation.table.scene.children.length)).toBe(objects);
  await page.locator('#sound').click();
  await page.waitForFunction(() => window.pinballPresentation.sound.ritual.groups.size === 0);
  await page.waitForFunction(() => !window.pinball.travel);
  await page.waitForFunction(() => window.pinballPresentation.table.lights.cues.has('eyes'));
  await page.locator('#sound').click();
  expect(await groups(page)).toEqual([]);
  expect(await page.evaluate(() => window.pinballPresentation.sound.master.gain.value)).toBeCloseTo(.18);
  await writeFile('/tmp/awaken-render-timing.json', JSON.stringify(timings, null, 2));
});
