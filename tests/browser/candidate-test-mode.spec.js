import { test, expect } from '@playwright/test';
const base=process.env.DUAL_PAGES_URL?.replace(/\/+$/, '') + '/';
test.skip(!process.env.DUAL_PAGES_URL, 'Requires the candidate Pages build');
for(const [device,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]])test(`test mode isolated and real stone hits on ${device}`,async({page},info)=>{
 test.setTimeout(60000);await page.setViewportSize(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}playtest-candidate/?debug=1`);await page.waitForFunction(()=>window.pinballPresentation);
 const toggle=page.locator('#test-toggle'), reset=page.locator('#test-reset'), counts=page.locator('#test-counts');
 await expect(page.locator('#ritual-test-mode')).toBeHidden();
 await page.locator('#test-tools').click(); await expect(page.locator('#ritual-test-mode')).toBeVisible();
 await expect(toggle).toHaveText('TEST MODE: OFF');await expect(reset).toBeDisabled();
 expect(await page.evaluate(()=>window.pinball.state.ritual.binds.size)).toBe(0);
 await toggle.click();await expect(toggle).toHaveText('TEST MODE: ON');await expect(page.locator('.bind-lamp.lit')).toHaveCount(4);
 await expect(page.locator('.stone-lamps .empowered')).toHaveCount(3);await expect(page.locator('.stone-lamps .lit')).toHaveCount(0);
 await expect(counts.locator('span')).toHaveText(['WEST CONTACT 0 · HIT 0','CENTRE CONTACT 0 · HIT 0','EAST CONTACT 0 · HIT 0']);
 const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth, viewport:innerWidth, bar:document.querySelector('#ritual-test-mode').getBoundingClientRect().toJSON()}));
 expect(bounds.scroll).toBeLessThanOrEqual(bounds.viewport);expect(bounds.bar.right).toBeLessThanOrEqual(bounds.viewport);
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.pinball.charge===1);await page.keyboard.up('Space');await page.waitForFunction(()=>!window.pinball.shooter&&!window.pinball.travel);
 async function hit(id){
  await page.keyboard.press('p');
  await page.evaluate(id=>{const s=window.pinball,b=s.stones[id],B=window.Phaser.Physics.Matter.Matter.Body,n={x:-Math.sin(b.angle),y:Math.cos(b.angle)};B.setPosition(s.ball,{x:b.position.x+30*n.x,y:b.position.y+30*n.y});B.setVelocity(s.ball,{x:-7*n.x,y:-7*n.y});s.flashes.delete(`stone:${id}`);},id);
  await page.keyboard.press('p');await page.waitForFunction(id=>window.pinball.flashes.has(`stone:${id}`),id);await page.waitForTimeout(300);
 }
 // A real back-face contact now counts and activates the west stone.
 await page.keyboard.press('p');
 await page.evaluate(()=>{const s=window.pinball,b=s.stones[0],B=window.Phaser.Physics.Matter.Matter.Body,n={x:-Math.sin(b.angle),y:Math.cos(b.angle)};B.setPosition(s.ball,{x:b.position.x-30*n.x,y:b.position.y-30*n.y});B.setVelocity(s.ball,{x:7*n.x,y:7*n.y});});
 await page.keyboard.press('p');await expect(counts.locator('span').first()).toHaveText('WEST CONTACT 1 · HIT 1');
 await page.waitForTimeout(300);
 for(const id of [0,0,1,2])await hit(id);
 await expect(counts.locator('span')).toHaveText(['WEST CONTACT 3 · HIT 3','CENTRE CONTACT 1 · HIT 1','EAST CONTACT 1 · HIT 1']);
 await expect(page.locator('.stone-lamps .lit')).toHaveCount(3);await expect(page.locator('#ritual-status')).toHaveText('CTHULHU BOUND');
 expect(await page.evaluate(()=>window.pinball.state.ritual.sealed)).toBe(true);
 await page.screenshot({path:info.outputPath(`test-${device}.png`),fullPage:true});
 await reset.click();await expect(counts.locator('span')).toHaveText(['WEST CONTACT 0 · HIT 0','CENTRE CONTACT 0 · HIT 0','EAST CONTACT 0 · HIT 0']);await expect(page.locator('.stone-lamps .lit')).toHaveCount(0);await expect(page.locator('.bind-lamp.lit')).toHaveCount(4);
 await page.locator('#test-tools').click(); await expect(page.locator('#ritual-test-mode')).toBeHidden(); await expect(page.locator('#test-tools')).toHaveText('TEST TOOLS · ON');
 await page.locator('#test-tools').click(); await expect(page.locator('#ritual-test-mode')).toBeVisible();
 await page.keyboard.press('r');await expect(page.locator('.bind-lamp.lit')).toHaveCount(4);
 await toggle.click();await expect(toggle).toHaveText('TEST MODE: OFF');await expect(page.locator('.bind-lamp.lit')).toHaveCount(0);
 expect(await page.evaluate(()=>({score:window.pinball.state.score,ball:window.pinball.state.ballNumber}))).toEqual({score:0,ball:1});
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.pinball.charge===1);await page.keyboard.up('Space');await page.waitForFunction(()=>window.pinball.state.phase==='playing');
 await expect(toggle).toBeDisabled();expect(errors).toEqual([]);
});
for(const [name,path] of [['live',''],['original','playtest/']])test(`test controls absent from ${name}`,async({page})=>{await page.goto(`${base}${path}`);await page.waitForSelector('canvas');await expect(page.locator('#ritual-test-mode')).toHaveCount(0);});
