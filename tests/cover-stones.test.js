import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { PinballPhysics } from '../src/game/physics.js';
import { COVER_STONES, SHOTS, FIXED_DT, MAX_SPEED } from '../src/game/table.js';
import { BINDS, SEAL_BONUS } from '../src/game/binding-ritual.js';
const { Body, Events, Vector } = Matter;
const steps=(s,n)=>{for(let i=0;i<n;i++)s.step();};
function live(s,pos,velocity={x:0,y:0}) {
 s.state.launch();s.shooter=false;s.shotLock=0;Body.setStatic(s.ball,false);
 Body.setPosition(s.ball,pos);Body.setVelocity(s.ball,velocity);
}
function front(s,id,speed=7){
 const t=COVER_STONES[id],n={x:-Math.sin(t.angle),y:Math.cos(t.angle)};
 live(s,{x:t.x+n.x*30,y:t.y+n.y*30},{x:-n.x*speed,y:-n.y*speed});
}

test('all three real rubber fronts score 100; backs and sides are passive',()=>{
 for(let id=0;id<3;id++)for(const face of ['front','back','side']){
  const s=new PinballPhysics(),t=COVER_STONES[id];
  const a=t.angle+(face==='front'?Math.PI/2:face==='back'?-Math.PI/2:0),n={x:Math.cos(a),y:Math.sin(a)};
  live(s,{x:t.x+n.x*30,y:t.y+n.y*30},{x:-n.x*7,y:-n.y*7});steps(s,8);
  assert.equal(s.state.score,face==='front'?100:0,`${id} ${face}`);
  assert.equal(s.pendingKick,null,'stones must not add a powered kick');
  assert.equal(s.state.ritual.stones.size,0,'dormant hits are not banked');s.destroy();
 }
});
test('anti-chatter cooldown suppresses immediate recollision, then permits a fresh strike',()=>{
 const s=new PinballPhysics();front(s,1);steps(s,8);assert.equal(s.state.score,100);
 front(s,1);steps(s,8);assert.equal(s.state.score,100);
 steps(s,35);front(s,1);steps(s,8);assert.equal(s.state.score,200);s.destroy();
});
test('initial stone placements allow direct real flipper shots across nearby timing windows',()=>{
 const fixtures=[{id:0,side:'left',offset:32,y:784,delays:[2,3,4]},
 {id:1,side:'left',offset:74,y:770,delays:[3,6]},
 {id:2,side:'right',offset:39,y:764,delays:[2,3,4]}];
 for(const f of fixtures)for(const delay of f.delays){
  const s=new PinballPhysics();live(s,{x:f.side==='left'?155+f.offset:345-f.offset,y:f.y},{x:0,y:2});
  const ball=s.ball;let bat=false;const intervening=[];
  Events.on(s.engine,'collisionStart',({pairs})=>{for(const pair of pairs){const o=pair.bodyA===ball?pair.bodyB:pair.bodyB===ball?pair.bodyA:null;if(!o)continue;if(o.label.startsWith('flipper:'))bat=true;else if(bat&&!o.label.startsWith('stone:'))intervening.push(o.label);}});
  for(let tick=0;tick<150&&!s.flashes.has(`stone:${f.id}`);tick++){s.controls[f.side]=tick>=delay&&tick<delay+20;s.step();}
  assert.ok(bat);assert.ok(s.flashes.has(`stone:${f.id}`),JSON.stringify({...f,delay}));
  assert.deepEqual(intervening,[],'aimed shot must not rely on another mechanism');
  assert.equal(s.ball,ball);assert.equal(s.state.phase,'playing');s.destroy();
 }
});
test('96 stationary perimeter approaches escape without rescue or a local trap',()=>{
 for(let id=0;id<3;id++)for(let a=0;a<32;a++){
  const s=new PinballPhysics(),t=COVER_STONES[id];
  live(s,{x:t.x+28*Math.cos(a*Math.PI/16),y:t.y+28*Math.sin(a*Math.PI/16)});
  let escaped=false;for(let i=0;i<720;i++){s.step();if(!s.ball||Math.hypot(s.ball.position.x-t.x,s.ball.position.y-t.y)>60){escaped=true;break;}}
  assert.ok(escaped,`stone ${id} perimeter ${a}`);s.destroy();
 }
});
test('normal and speed-limit front strikes cannot pass through a stone or receive active energy',()=>{
 for(let id=0;id<3;id++)for(const speed of [4,12,22]){
  const s=new PinballPhysics(),t=COVER_STONES[id],n={x:-Math.sin(t.angle),y:Math.cos(t.angle)};
  front(s,id,speed);let hit=false;
  for(let i=0;i<12;i++){s.step();hit ||= s.flashes.has(`stone:${id}`);assert.ok(Vector.magnitude(s.ball.velocity)<=MAX_SPEED+.01);}
  assert.ok(hit);assert.ok(Vector.dot(Vector.sub(s.ball.position,t),n)>0,'ball rebounds on front side');s.destroy();
 }
});
test('real guided captures and returns survive all four stones; aborted runs earn no Bind',()=>{
 for(const shot of SHOTS){
  const s=new PinballPhysics();live(s,{x:shot.entry.x,y:shot.entry.y+18},{x:0,y:-7});
  steps(s,1);assert.equal(s.travel?.shot.id,shot.id);assert.equal(s.state.ritual.binds.size,0);
  const ball=s.ball;while(s.travel)s.step();
  assert.ok(s.state.ritual.binds.has(shot.id));assert.equal(s.completedShot.shot.id,shot.id);
  assert.equal(s.ball,ball);assert.equal(ball.isStatic,false);assert.equal(ball.collisionFilter.mask,0xFFFFFFFF);
  assert.deepEqual(ball.velocity,shot.exitVelocity);
  steps(s,25);assert.equal(s.state.phase,'playing');assert.equal(s.state.ballNumber,1);s.destroy();
  const aborted=new PinballPhysics();live(aborted,shot.entry,{x:0,y:-7});aborted.step();aborted.restart();steps(aborted,300);
  assert.equal(aborted.state.ritual.binds.size,0);assert.equal(aborted.completedShot,null);aborted.destroy();
 }
});
test('ritual persists across drains, awards victory once and keeps exactly three turns',()=>{
 const s=new PinballPhysics();live(s,{x:250,y:600});
 for(const b of BINDS)s.state.completeBind(b);
 front(s,0);steps(s,8);assert.equal(s.state.ritual.stones.size,1);
 Body.setPosition(s.ball,{x:250,y:950});s.step();assert.equal(s.state.ballNumber,2);assert.equal(s.state.ritual.stones.size,1);
 front(s,1);steps(s,8);front(s,2);steps(s,8);
 assert.equal(s.state.ritual.sealed,true);assert.equal(s.state.score,300+SEAL_BONUS);
 const earned=s.state.score;steps(s,35);front(s,2);steps(s,8);assert.equal(s.state.score,earned+100);
 for(const turn of [2,3]){assert.equal(s.state.ballNumber,turn);live(s,{x:250,y:950});s.step();}
 assert.equal(s.state.phase,'gameover');assert.equal(s.ball,null);assert.equal(s.state.ritual.sealed,true);
 s.restart();assert.equal(s.state.ritual.binds.size,0);assert.equal(s.state.ritual.stones.size,0);assert.equal(s.state.ritual.sealed,false);s.destroy();
});
test('pause and terminal phase reject progress and points; final-drain victory stays recorded',()=>{
 const s=new PinballPhysics();s.state.launch();s.state.paused=true;
 assert.equal(s.state.completeBind(BINDS[0]),false);assert.equal(s.state.hitStone(0,0),false);
 s.state.paused=false;for(const b of BINDS)s.state.completeBind(b);s.state.hitStone(0,1);s.state.hitStone(1,2);
 s.state.ballNumber=3;s.state.hitStone(2,3);s.state.drain();assert.equal(s.state.ritual.sealed,true);
 const score=s.state.score;assert.equal(s.state.hitStone(2,4),false);assert.equal(s.state.score,score);s.destroy();
});
