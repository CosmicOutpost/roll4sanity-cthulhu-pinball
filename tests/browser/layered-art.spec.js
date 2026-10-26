import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) test(`static layers ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 1050 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?debug=1');
  await page.waitForFunction(() => window.pinballPresentation?.table?.artLayers);
  const inspect = () => page.evaluate(() => {
    const table = window.pinballPresentation.table;
    const { background, cthulhu, logo } = table.artLayers;
    return { background: background.visible, cthulhu: cthulhu.visible, logo: logo.visible,
      depths: [background.depth, cthulhu.depth, logo.depth, table.base.depth, table.moving.depth],
      ball: !!window.pinball.ball, renderer: table.scene.game.renderer.type };
  });
  expect(await inspect()).toEqual({ background: true, cthulhu: true, logo: false, depths: [-3,-2,-1,0,5], ball:true, renderer:1 });
  await page.keyboard.press('KeyD');
  await page.screenshot({path:`reviews/assembled-${mobile?'mobile':'desktop'}.png`});
  await page.evaluate(() => window.pinballPresentation.table.artLayers.cthulhu.setVisible(false));
  await page.screenshot({path:`reviews/background-${mobile?'mobile':'desktop'}.png`});
  expect((await inspect()).background).toBe(true);
  // Existing texture is a test stand-in only, never a proposed logo asset.
  expect(await page.evaluate(() => {
    const {logo, cthulhu, background} = window.pinballPresentation.table.artLayers;
    logo.setTexture('art-cthulhu').setPosition(30,50).setScale(.1).setVisible(true);
    const valid=logo.texture.key==='art-cthulhu' && logo.x===30 && logo.y===50 && logo.scaleX===.1 && logo.depth===-1 && !cthulhu.visible && background.visible;
    logo.setVisible(false); cthulhu.setVisible(true); return valid;
  })).toBe(true);
  await page.keyboard.down('Space'); await page.waitForTimeout(1250); await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.pinball.state.phase==='playing');
  await page.waitForTimeout(1500);
  await page.screenshot({path:`reviews/playing-${mobile?'mobile':'desktop'}.png`});
  expect(errors).toEqual([]);
});
