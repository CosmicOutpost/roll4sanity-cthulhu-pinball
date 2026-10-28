import test from 'node:test';
import assert from 'node:assert/strict';
import { BindingRitual, BINDS } from '../src/game/binding-ritual.js';
test('explicit Bind IDs/kinds; repeats and unknown shots do not empower stones', () => {
 const r=new BindingRitual();
 assert.equal(r.complete({id:'launch',kind:'launch'}),false);
 assert.equal(r.complete({id:'left-ramp',kind:'orbit'}),false);
 for(let i=0;i<10;i++)r.complete(BINDS[0]);
 assert.equal(r.binds.size,1);assert.equal(r.empowered,false);
 for(const b of BINDS.slice(1))assert.equal(r.complete(b),true);
 assert.equal(r.empowered,true);assert.equal(r.revision,4);
});
test('dormant hits are not banked; three distinct empowered stones seal exactly once',()=>{
 const r=new BindingRitual();for(let id=0;id<3;id++)assert.equal(r.strike(id,0),false);
 for(const b of BINDS)r.complete(b);
 for(const id of [-1,3,1.5])assert.equal(r.strike(id,0),false);
 assert.equal(r.strike(2,100),true);assert.equal(r.strike(2,101),false);
 assert.equal(r.strike(0,200),true);assert.equal(r.sealed,false);
 assert.equal(r.strike(1,300),true);assert.equal(r.sealed,true);assert.equal(r.sealedAt,300);
 for(let id=0;id<3;id++)assert.equal(r.strike(id,999),false);
 assert.equal(r.revision,7);assert.equal(r.sealedAt,300);
});
