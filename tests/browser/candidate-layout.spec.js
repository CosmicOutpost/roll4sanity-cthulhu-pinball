import { test, expect } from '@playwright/test';
const base=process.env.DUAL_PAGES_URL?.replace(/\/+$/, '') + '/';
test.skip(!process.env.DUAL_PAGES_URL, 'Requires the candidate Pages build');
for (const [name,width,height] of [['desktop',1920,1080],['large',2560,1440],['laptop',1366,768],['mobile',390,844]]) {
 test(`candidate fits and controls work at ${name}`,async({page})=>{
  await page.setViewportSize({width,height}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}playtest-candidate/?debug=1`); await page.waitForFunction(()=>window.pinballPresentation);
  async function fits() {
   const layout=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return {scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,field:box('.playfield'),boxes:['.scoreboard','#ritual-progress','#left-flipper','#launch','#right-flipper','footer'].map(box)};});
   expect(layout.scrollW).toBeLessThanOrEqual(width); expect(layout.scrollH).toBeLessThanOrEqual(height);
   for(const box of layout.boxes) {expect(box.left).toBeGreaterThanOrEqual(0);expect(box.top).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width);expect(box.bottom).toBeLessThanOrEqual(height);}
   expect(layout.field.width/layout.field.height).toBeCloseTo(9/16,3);
  }
  await fits(); await page.locator('#test-tools').click(); await expect(page.locator('#ritual-test-mode')).toBeVisible(); await fits();
  await page.locator('#test-tools').click(); await expect(page.locator('#ritual-test-mode')).toBeHidden(); await fits();
  if(name==='mobile') {const launch=page.locator('#launch'),r=await launch.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForFunction(()=>window.pinball.charge>.95);await page.mouse.up();}
  else {await page.keyboard.down('Space');await page.waitForFunction(()=>window.pinball.charge>.95);await page.keyboard.up('Space');}
  await page.waitForFunction(()=>window.pinball.state.phase==='playing');
  if(name==='mobile') {const r=await page.locator('#left-flipper').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForFunction(()=>window.pinball.controls.left);await page.mouse.up();}
  else {await page.keyboard.down('z');await page.waitForFunction(()=>window.pinball.controls.left);await page.keyboard.up('z');}
  expect(errors).toEqual([]);
 });
}
test('candidate mobile accepts real touch gestures',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try {
  const page=await context.newPage();await page.goto(`${base}playtest-candidate/?debug=1`);await page.waitForFunction(()=>window.pinballPresentation);
  const client=await context.newCDPSession(page), launch=await page.locator('#launch').boundingBox();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:launch.x+launch.width/2,y:launch.y+launch.height/2}]});
  await page.waitForFunction(()=>window.pinball.charge>.95);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>!window.pinball.shooter&&!window.pinball.travel);
  const flip=await page.locator('#left-flipper').boundingBox();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:flip.x+flip.width/2,y:flip.y+flip.height/2}]});
  await page.waitForFunction(()=>window.pinball.controls.left);await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>!window.pinball.controls.left);
 } finally {await context.close();}
});
