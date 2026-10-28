import { test, expect } from '@playwright/test';
const base=process.env.DUAL_PAGES_URL?.replace(/\/+$/, '') + '/';
test.skip(!process.env.DUAL_PAGES_URL, 'Requires the candidate Pages build');
for (const [device,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]) {
 for (const calm of [false,true]) test(`victory ${device} ${calm?'CALM':'FULL'} stays playable and resets`,async({page},info)=>{
  test.setTimeout(60000); await page.setViewportSize(viewport);
  if(calm) await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}playtest-candidate/?debug=1`); await page.waitForFunction(()=>window.pinballPresentation);
  await page.keyboard.press('d'); // Keep the inspection hooks without drawing collision outlines.
  if(calm) await page.locator('#sound').click();
  if(calm) expect(await page.evaluate(()=>window.pinballPresentation.sound.muted)).toBe(true);
  await page.locator('#test-tools').click(); await page.locator('#test-toggle').click();
  await page.keyboard.down('Space'); await page.waitForFunction(()=>window.pinball.charge===1); await page.keyboard.up('Space');
  await page.waitForFunction(()=>!window.pinball.shooter&&!window.pinball.travel);
  await page.evaluate(()=>{const r=window.pinballPresentation.sound.ritual; window.roarCount=0;const roar=r.roar.bind(r);r.roar=(...args)=>{window.roarCount++;return roar(...args);};});
  for(const id of [0,1,2]) {
    await page.keyboard.press('p');
    await page.evaluate(id=>{const s=window.pinball,b=s.stones[id],B=window.Phaser.Physics.Matter.Matter.Body,n={x:-Math.sin(b.angle),y:Math.cos(b.angle)};B.setPosition(s.ball,{x:b.position.x+30*n.x,y:b.position.y+30*n.y});B.setVelocity(s.ball,{x:-7*n.x,y:-7*n.y});},id);
    await page.keyboard.press('p'); await page.waitForFunction(id=>window.pinball.state.ritual.stones.has(id),id);
  }
  await page.waitForFunction(()=>window.pinballPresentation.table.scene.bindingVictory.title.visible);
  const state=await page.evaluate(()=>{const s=window.pinball,v=window.pinballPresentation.table.scene.bindingVictory;return {sealed:s.state.ritual.sealed, score:s.state.score, at:s.state.ritual.sealedAt, title:v.title.text, alpha:v.title.alpha, ball:!!s.ball, calm:window.pinballPresentation.table.lights.reduced};});
  expect(state.sealed).toBe(true); expect(state.score).toBeGreaterThanOrEqual(10300); expect(state.title).toBe('CTHULHU IS BOUND!'); expect(state.alpha).toBeGreaterThan(0); expect(state.ball).toBe(true); expect(state.calm).toBe(calm);
  await page.waitForTimeout(300); await page.screenshot({path:info.outputPath(`victory-${device}-${calm?'calm':'full'}.png`),fullPage:true});
  await page.keyboard.press('p'); const pausedAt=await page.evaluate(()=>window.pinball.elapsed);
  await page.waitForTimeout(150); expect(await page.evaluate(()=>window.pinball.elapsed)).toBe(pausedAt);
  await page.keyboard.press('p');
  await page.keyboard.down('z'); await expect.poll(()=>page.evaluate(()=>window.pinball.controls.left)).toBe(true); await page.keyboard.up('z');
  await page.waitForFunction(()=>window.pinball.elapsed-window.pinball.state.ritual.sealedAt>4200);
  expect(await page.evaluate(()=>({title:window.pinballPresentation.table.scene.bindingVictory.title.visible, graphics:window.pinballPresentation.table.scene.bindingVictory.graphics.commandBuffer.length, at:window.pinball.state.ritual.sealedAt, roars:window.roarCount}))).toMatchObject({title:false,at:state.at,roars:1});
  expect(await page.evaluate(()=>window.pinballPresentation.table.scene.bindingVictory.graphics.commandBuffer.length)).toBeGreaterThan(0);
  await page.keyboard.press('p');
  await page.evaluate(()=>{const s=window.pinball,b=s.stones[2],B=window.Phaser.Physics.Matter.Matter.Body,n={x:-Math.sin(b.angle),y:Math.cos(b.angle)};B.setPosition(s.ball,{x:b.position.x+30*n.x,y:b.position.y+30*n.y});B.setVelocity(s.ball,{x:-7*n.x,y:-7*n.y});});
  await page.keyboard.press('p'); await page.waitForFunction(()=>window.pinball.flashes.has('stone:2')); await page.waitForTimeout(100);
  expect(await page.evaluate(()=>({at:window.pinball.state.ritual.sealedAt,roars:window.roarCount,title:window.pinballPresentation.table.scene.bindingVictory.title.visible}))).toEqual({at:state.at,roars:1,title:false});
  await page.locator('#test-reset').click(); await page.waitForFunction(()=>!window.pinball.state.ritual.sealed);
  await expect.poll(()=>page.evaluate(()=>window.pinballPresentation.table.scene.bindingVictory.title.visible)).toBe(false);
  expect(errors).toEqual([]);
 });
}
