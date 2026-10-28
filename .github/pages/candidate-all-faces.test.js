import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { PinballPhysics } from '../src/game/physics.js';
import { COVER_STONES } from '../src/game/table.js';
import { BINDS, SEAL_BONUS } from '../src/game/binding-ritual.js';
const { Body } = Matter;
const steps = (s, n) => { for (let i = 0; i < n; i++) s.step(); };
function strike(s, id, face) {
  const t = COVER_STONES[id], a = t.angle + face * Math.PI / 2;
  const n = { x: Math.cos(a), y: Math.sin(a) };
  Body.setPosition(s.ball, { x: t.x + 35*n.x, y: t.y + 35*n.y });
  Body.setVelocity(s.ball, { x: -7*n.x, y: -7*n.y });
  steps(s, 9);
}
function game() {
  const s = new PinballPhysics(); s.state.launch(); s.shooter = false; s.shotLock = 0;
  Body.setStatic(s.ball, false); return s;
}
test('all four real faces on all three stones score once and preserve passive collision', () => {
  for (let id = 0; id < 3; id++) for (let face = 0; face < 4; face++) {
    const s = game(); strike(s,id,face);
    assert.equal(s.state.score, 100, `stone ${id}, face ${face}`);
    assert.equal(s.pendingKick, null); assert.equal(s.state.ritual.stones.size, 0); s.destroy();
  }
});
test('cooldown suppresses new contacts until elapsed, then permits another score', () => {
  const s = game(); strike(s,1,0); assert.equal(s.state.score,100);
  strike(s,1,2); assert.equal(s.state.score,100);
  steps(s,35); strike(s,1,2); assert.equal(s.state.score,200); s.destroy();
});
test('no contact awards nothing; each empowered stone activates once and victory awards once', () => {
  const s=game(); for (const bind of BINDS) s.state.completeBind(bind);
  Body.setPosition(s.ball,{x:250,y:700}); Body.setVelocity(s.ball,{x:0,y:0}); steps(s,3);
  assert.equal(s.state.score,0); assert.equal(s.state.ritual.stones.size,0);
  strike(s,0,0); steps(s,35); strike(s,0,2);
  assert.equal(s.state.score,200); assert.equal(s.state.ritual.stones.size,1);
  strike(s,1,1); strike(s,2,3);
  assert.equal(s.state.ritual.sealed,true); assert.equal(s.state.score,400+SEAL_BONUS);
  steps(s,35); strike(s,2,0); assert.equal(s.state.score,500+SEAL_BONUS); s.destroy();
});
