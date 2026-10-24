import { test, expect } from '@playwright/test';

const shots = [
  { id: 'left-ramp', kind: 'ramp', x: 185, y: 470, colour: 0x21e58d, iris: [89, 236, 170] },
  { id: 'right-ramp', kind: 'ramp', x: 315, y: 470, colour: 0xf23c55, iris: [245, 109, 128] },
  { id: 'left-orbit', kind: 'orbit', x: 59, y: 451, colour: 0x329dff, iris: [101, 182, 255] },
  { id: 'right-orbit', kind: 'orbit', x: 441, y: 451, colour: 0xaf58ff, iris: [195, 130, 255] },
];
async function open(page) {
  await page.addInitScript(() => {
    localStorage.setItem('roll4sanity-music', 'false'); // Isolate effects; leave production defaults untouched.
    localStorage.setItem('roll4sanity-muted', 'false');
    localStorage.setItem('roll4sanity-reduced-effects', 'false');
  });
  await page.goto('./?debug=1'); await page.waitForFunction(() => !!window.pinballPresentation);
  await page.keyboard.press('d');
  await page.evaluate(() => {
    const f = window.pinballPresentation, r = f.sound.ritual;
    window.completionAudit = { events: [], completions: [], eyes: [], roars: [], instances: [], peak: 0 };
    const audit = window.completionAudit;
    const completed = f.guided.completeShot.bind(f.guided);
    f.guided.completeShot = shot => { audit.events.push({ id: shot.id, at: window.pinball.elapsed }); return completed(shot); };
    const complete = f.table.lights.completeSpell.bind(f.table.lights);
    f.table.lights.completeSpell = shot => { audit.eyes.push({ id: shot.id, at: window.pinball.elapsed }); return complete(shot); };
    const end = r.endSpell.bind(r);
    r.endSpell = (completed, kind) => { if (completed) audit.completions.push({ kind, at: window.pinball.elapsed }); return end(completed, kind); };
    const roar = r.roar.bind(r);
    r.roar = () => {
      audit.roars.push({ id: f.table.lights.cues.get('eyes')?.shotId, at: window.pinball.elapsed, time: f.sound.context.currentTime });
      const result = roar(); const g = [...r.groups].findLast(g => g.name === 'roar'); if (g) audit.instances.push(g);
      return result;
    };
  });
}
async function serve(page) {
  await page.keyboard.down('Space'); await page.waitForFunction(() => window.pinball.charge === 1); await page.keyboard.up('Space');
  await page.waitForFunction(() => { const p = window.pinball; return !p.travel && !p.shooter && p.elapsed > p.shotLock; });
}
async function enter(page, shot, overlap = false) {
  await page.evaluate(({ x, y, overlap }) => {
    const p = window.pinball, Body = window.Phaser.Physics.Matter.Matter.Body;
    // Initial position fixture only; real Matter capture and guide timing follow.
    // A separate overlap stress fixture deliberately bypasses the normal recapture
    // lock so two otherwise genuine completions occur within one roar's lifetime.
    if (overlap) p.shotLock = p.elapsed - 1;
    Body.setPosition(p.ball, { x, y }); Body.setVelocity(p.ball, { x: 0, y: -7 }); Body.setAngularVelocity(p.ball, 0);
  }, { ...shot, overlap });
  await page.waitForFunction(id => window.pinball.travel?.shot.id === id, shot.id);
  const actual = await page.evaluate(() => ({ id: window.pinball.travel.shot.id, kind: window.pinball.travel.shot.kind }));
  expect(actual).toEqual({ id: shot.id, kind: shot.kind });
}
async function snapshot(page) {
  return page.evaluate(() => {
    const a = window.completionAudit, f = window.pinballPresentation, cue = f.table.lights.cues.get('eyes');
    return { events: a.events, completions: a.completions, eyes: a.eyes, roars: a.roars,
      cue: cue && { id: cue.shotId, colour: cue.palette.colour, at: cue.at, duration: cue.until - cue.at },
      groups: [...f.sound.ritual.groups].map(g => ({ name: g.name, released: g.released })) };
  });
}
async function assertPeak(page, shot) {
  await page.waitForFunction(() => { const p = window.pinball, c = window.pinballPresentation.table.lights.cues.get('eyes'); return c && p.elapsed - c.at >= 400; });
  const pixels = await page.evaluate(() => {
    const ctx = document.querySelector('canvas').getContext('2d');
    return [230, 310].map(x => [...ctx.getImageData(x + 8, 391, 1, 1).data].slice(0, 3));
  });
  for (const eye of pixels) eye.forEach((value, channel) => expect(Math.abs(value - shot.iris[channel])).toBeLessThanOrEqual(2));
}

for (const shot of shots) {
  test(`${shot.id}: one confirmed completion, correct eyes, one roar; restart-aborted run is silent`, async ({ page }, info) => {
    await open(page); await serve(page);
    expect((await snapshot(page)).completions).toHaveLength(0); // Launch guide is never a ritual.
    await enter(page, shot);
    await page.waitForFunction(() => window.completionAudit.completions.length === 1);
    const result = await snapshot(page);
    expect(result.events).toEqual([{ id: shot.id, at: result.completions[0].at }]);
    expect(result.eyes).toEqual(result.events);
    expect(result.roars).toHaveLength(1); expect(result.roars[0].id).toBe(shot.id);
    expect(result.roars[0].at).toBe(result.completions[0].at);
    expect(result.cue).toMatchObject({ id: shot.id, colour: shot.colour, at: result.completions[0].at });
    expect(result.cue.duration).toBeCloseTo(2550, 6);
    expect(result.groups.filter(g => g.name === 'roar' && !g.released)).toHaveLength(1);
    await assertPeak(page, shot);
    await page.screenshot({ path: info.outputPath(`${shot.id}-completion.png`) });
    await page.evaluate(() => { for (let i = 0; i < 20; i++) window.pinballPresentation.guided.update(); });
    expect((await snapshot(page)).roars).toHaveLength(1);
    await page.keyboard.press('r'); await serve(page); await enter(page, shot);
    await page.keyboard.press('r');
    await page.waitForTimeout(2100); // Beyond either route's duration, with ordinary scene updates.
    const aborted = await snapshot(page);
    expect(aborted.events).toHaveLength(1); expect(aborted.completions).toHaveLength(1); expect(aborted.eyes).toHaveLength(1); expect(aborted.roars).toHaveLength(1);
    expect(aborted.cue).toBeUndefined(); expect(aborted.groups).toEqual([]);
  });
}

test('pause freezes a real orbit; muted completion still requests one roar and shows CALM blue eyes without replay', async ({ page }) => {
  await open(page); await serve(page); await enter(page, shots[2]); await page.keyboard.press('p');
  const frozen = await page.evaluate(() => window.pinball.elapsed);
  await page.locator('#sound').click();
  if (await page.locator('#motion').textContent() === 'LIGHTS: FULL') await page.locator('#motion').click();
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.pinball.elapsed)).toBe(frozen);
  expect((await snapshot(page)).completions).toHaveLength(0);
  await page.keyboard.press('p'); await page.waitForFunction(() => window.completionAudit.completions.length === 1);
  const result = await snapshot(page);
  expect(result.events).toHaveLength(1); expect(result.eyes).toEqual(result.events); expect(result.roars).toHaveLength(1);
  expect(result.roars[0].at).toBe(result.eyes[0].at);
  expect(result.cue.colour).toBe(shots[2].colour); expect(result.cue.duration).toBeCloseTo(2550, 6);
  expect(result.groups).toEqual([]);
  expect(await page.evaluate(() => window.pinballPresentation.sound.master.gain.value)).toBe(0);
  await expect(page.locator('#motion')).toHaveText('LIGHTS: CALM');
  expect(await page.evaluate(() => window.pinballPresentation.table.lights.chase)).toBe(null);
  await page.locator('#sound').click(); await page.waitForTimeout(100);
  expect((await snapshot(page)).roars).toHaveLength(1);
  expect((await snapshot(page)).groups.some(g => g.name === 'roar')).toBe(false);
});

test('consecutive actual guides replace overlapping colour and fade the old roar without suppressing the new request', async ({ page }) => {
  await open(page); await serve(page); await enter(page, shots[0]);
  await page.waitForFunction(() => window.completionAudit.completions.length === 1);
  await page.evaluate(() => {
    const f = window.pinballPresentation, a = window.completionAudit;
    a.probe = f.sound.context.createAnalyser(); a.probe.fftSize = 1024; f.sound.master.connect(a.probe);
    a.samples = new Float32Array(1024);
  });
  await enter(page, shots[3], true);
  await page.waitForFunction(() => {
    const a = window.completionAudit; a.probe.getFloatTimeDomainData(a.samples);
    for (const value of a.samples) a.peak = Math.max(a.peak, Math.abs(value));
    return a.completions.length === 2;
  });
  const result = await snapshot(page);
  expect(result.events.map(e => e.id)).toEqual(['left-ramp', 'right-orbit']);
  expect(result.completions).toHaveLength(2); expect(result.eyes).toEqual(result.events);
  expect(result.roars.map(e => e.id)).toEqual(['left-ramp', 'right-orbit']);
  result.roars.forEach((r, i) => expect(r.at).toBe(result.completions[i].at));
  expect(result.cue.id).toBe('right-orbit'); expect(result.cue.colour).toBe(shots[3].colour); expect(result.cue.duration).toBeCloseTo(2550, 6);
  const overlap = await page.evaluate(() => {
    const a = window.completionAudit, ctx = window.pinballPresentation.sound.context;
    return { beforeOldEnd: ctx.currentTime < a.instances[0].end, released: a.instances[0].released,
      latestLive: !a.instances.at(-1).released, peak: a.peak };
  });
  expect(overlap.beforeOldEnd).toBe(true); expect(overlap.released).toBe(true); expect(overlap.latestLive).toBe(true);
  await assertPeak(page, shots[3]);
  await page.waitForTimeout(120);
  expect((await snapshot(page)).groups.filter(g => g.name === 'roar')).toHaveLength(1);
  const peak = await page.evaluate(async () => {
    const a = window.completionAudit;
    for (let i = 0; i < 15; i++) { await new Promise(requestAnimationFrame); a.probe.getFloatTimeDomainData(a.samples); for (const v of a.samples) a.peak = Math.max(a.peak, Math.abs(v)); }
    const f = window.pinballPresentation; f.sound.master.disconnect(a.probe); a.probe.disconnect(); return a.peak;
  });
  expect(peak).toBeGreaterThan(.01); expect(peak).toBeLessThan(.3);
  await page.waitForFunction(() => !window.pinballPresentation.table.lights.cues.has('eyes') && window.pinballPresentation.sound.ritual.groups.size === 0);
  const final = await snapshot(page); expect(final.completions).toHaveLength(2); expect(final.roars).toHaveLength(2);
});
