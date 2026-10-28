import { test, expect } from '@playwright/test';
const routes=[['right-ramp',315,473],['left-ramp',185,473],['left-orbit',59,450],['right-orbit',441,450]];
async function open(page){
 await page.goto('./?debug=1');await page.waitForFunction(()=>window.pinballPresentation&&document.querySelector('#ritual-progress'));
 await page.keyboard.press('d');
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.pinball.charge===1);await page.keyboard.up('Space');
 await page.waitForFunction(()=>{const p=window.pinball;return !p.travel&&!p.shooter&&p.elapsed>p.shotLock;});
}
async function pause(page){if(!await page.evaluate(()=>window.pinball.state.paused))await page.keyboard.press('p');}
async function position(page,x,y,vx,vy){
 await pause(page);await page.evaluate(({x,y,vx,vy})=>{
  const p=window.pinball,B=window.Phaser.Physics.Matter.Matter.Body;
  B.setPosition(p.ball,{x,y});B.setVelocity(p.ball,{x:vx,y:vy});B.setAngularVelocity(p.ball,0);p.shotLock=p.elapsed;
 },{x,y,vx,vy});await page.keyboard.press('p');
}
async function stone(page,id){const [x,y,a]=[[135,395,-.314],[250,430,.314],[365,395,.314]][id];
 const nx=-Math.sin(a),ny=Math.cos(a);await position(page,x+30*nx,y+30*ny,-7*nx,-7*ny);
 await page.waitForFunction(id=>window.pinball.flashes.has(`stone:${id}`),id);await pause(page);
}
for(const [width,height]of [[1440,1000],[390,844]])test(`four Binds and three physical seals, continued play and restart at ${width}`,async({page},info)=>{
 test.setTimeout(60000);await page.setViewportSize({width,height});const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await stone(page,0);expect(await page.evaluate(()=>window.pinball.state.ritual.stones.size)).toBe(0);
 for(const [id,x,y]of routes){
  await position(page,x,y,0,-7);await page.waitForFunction(id=>window.pinball.travel?.shot.id===id,id);
  expect(await page.evaluate(id=>window.pinball.state.ritual.binds.has(id),id)).toBe(false);
  await page.waitForFunction(id=>window.pinball.state.ritual.binds.has(id),id);await pause(page);
 }
 await expect(page.locator('.bind-lamp.lit')).toHaveCount(4);await expect(page.locator('.stone-lamps .empowered')).toHaveCount(3);
 await page.locator('#sound').click();await page.locator('#motion').click();
 // Silence never suppresses state; stationary CALM cues retain progress.
 for(let id=0;id<3;id++){
  await page.evaluate(id=>window.pinball.flashes.delete(`stone:${id}`),id);
  await stone(page,id);expect(await page.evaluate(id=>window.pinball.state.ritual.stones.has(id),id)).toBe(true);
 }
 await expect(page.locator('#ritual-status')).toHaveText('CTHULHU IS SEALED!');
 await expect(page.locator('.stone-lamps .lit')).toHaveCount(3);
 expect(await page.evaluate(()=>window.pinball.state.ritual.sealed)).toBe(true);
 // Continue with ordinary input, and capture the actual rendered victory state.
 await page.keyboard.press('p');await page.keyboard.press('KeyZ');await page.keyboard.press('Slash');
 await page.screenshot({path:info.outputPath(`sealed-${width}.png`),fullPage:true});
 await test.step('drain fixture retains victory and serves the next turn',async()=>{
  await position(page,250,935,0,8);await page.waitForFunction(()=>window.pinball.state.ballNumber===2);
  expect(await page.evaluate(()=>window.pinball.state.ritual.sealed)).toBe(true);
  await expect(page.locator('#ritual-status')).toHaveText('CTHULHU IS SEALED!');
 });
 await page.keyboard.press('r');await expect(page.locator('.bind-lamp.lit')).toHaveCount(0);await expect(page.locator('.stone-lamps .lit')).toHaveCount(0);
 await expect(page.locator('#ritual-status')).toHaveText('BIND ALL FOUR SHOTS · 0/4');
 expect(errors).toEqual([]);
});

test('keyboard-driven flipper fixtures can deliberately hit each target',async({page},info)=>{
 test.setTimeout(45000);await open(page);
 // These are mechanism fixtures: position/velocity are set once on a descending
 // approach. No shot velocity is injected after the flipper stroke.
 const fixtures=[{id:0,x:194,y:766,key:'KeyZ'},{id:1,x:233,y:774,key:'KeyZ'},{id:2,x:306,y:768,key:'Slash'}];
 for(const f of fixtures){
  await page.keyboard.press('r');await page.keyboard.down('Space');await page.waitForFunction(()=>window.pinball.charge===1);await page.keyboard.up('Space');
  await page.waitForFunction(()=>!window.pinball.travel&&!window.pinball.shooter);
  await position(page,f.x,f.y,0,2);await page.keyboard.down(f.key);
  await page.waitForFunction(id=>window.pinball.flashes.has(`stone:${id}`),f.id,{timeout:3000});await page.keyboard.up(f.key);
  await page.screenshot({path:info.outputPath(`aimed-stone-${f.id}.png`)});
 }
});
