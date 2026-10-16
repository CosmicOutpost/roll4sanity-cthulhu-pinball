import { test, expect } from '@playwright/test';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../dist/', import.meta.url));
const prefixes = [
  '/wordpress/games/roll4sanity/',
  '/roll4sanity-cthulhu-pinball/',
];
let server, origin;

test.beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const prefix = prefixes.find(candidate => pathname.startsWith(candidate));
    if (!prefix) { res.writeHead(404).end(); return; }
    const file = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
    if (!file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const content = await readFile(file);
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

for (const prefix of prefixes) {
  test(`production build runs at ${prefix} with only local assets`, async ({ page }) => {
    const errors = [], requests = [], failures = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(`${origin}${prefix}?debug=1`);
    await page.waitForFunction(() => !!window.pinball);
    await page.keyboard.down('Space');
    await page.waitForFunction(() => window.pinball.charge > .95);
    await page.keyboard.up('Space');
    await page.waitForFunction(() => !window.pinball.shooter && !window.pinball.travel);
    expect(await page.evaluate(() => window.pinball.state.phase)).toBe('playing');
    await page.keyboard.press('r');
    await page.keyboard.press('d');
    const label = prefix === prefixes[0] ? 'wordpress' : 'github-pages';
    await page.screenshot({ path: `/tmp/roll4sanity-${label}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
    expect(requests.length).toBeGreaterThan(3);
    expect(requests.every(url => url.startsWith(origin + prefix))).toBe(true);
  });
}
