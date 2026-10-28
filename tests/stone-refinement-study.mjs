import Matter from 'matter-js';
import { PinballPhysics } from '../src/game/physics.js';
import { actionSession } from './helpers/action-session.js';
const {Body}=Matter;
const originalBuild=PinballPhysics.prototype.buildTable, originalStep=PinballPhysics.prototype.step, originalCollision=PinballPhysics.prototype.onCollision;
const layouts={original:[[135,395,-.314],[250,430,.314],[365,395,.314]],starting:[[155,500,-.314],[250,540,.314],[345,500,.314]],below:[[185,535,-.314],[250,545,.314],[315,535,.314]],up:[[140,495,-.314],[250,545,.314],[360,495,.314]],up2:[[145,495,-.314],[250,545,.314],[355,495,.314]]};
let chosen, result;
PinballPhysics.prototype.buildTable=function(){originalBuild.call(this);for(let i=0;i<3;i++){let[x,y,a]=chosen[i],b=this.stones[i];Body.setPosition(b,{x,y});Body.setAngle(b,a);}};
PinballPhysics.prototype.onCollision=function(e){for(const pair of e.pairs){const o=pair.bodyA===this.ball?pair.bodyB:pair.bodyB===this.ball?pair.bodyA:null;if(!o)continue;if(o.label.startsWith('stone:')){const i=+o.label.split(':')[1];result.contacts[i]++;if(this.isStoneFront(o,pair.collision)){result.front[i]++;if(this.state.ritual.empowered)result.empowered[i]++;if(this.elapsed-(result.lastFlip??-1e6)<2500)result.afterFlip[i]++;}}else if(o.label.startsWith('flipper:'))result.lastFlip=this.elapsed;}return originalCollision.call(this,e)};
PinballPhysics.prototype.step=function(){originalStep.call(this);if(this.state.phase!=='playing'||!this.ball||this.travel||this.shooter)return;for(let i=0;i<3;i++){const t=chosen[i],near=Math.hypot(this.ball.position.x-t[0],this.ball.position.y-t[1])<50;if(near&&!result.inside[i])result.approaches[i]++;result.inside[i]=near;}};
const all={};for(const [name,layout]of Object.entries(layouts)){chosen=layout;const games=[];for(const threshold of [710,725,740,755,770,785])for(const interval of [45,75,120,180]){result={approaches:[0,0,0],contacts:[0,0,0],front:[0,0,0],afterFlip:[0,0,0],empowered:[0,0,0],inside:[false,false,false],lastFlip:null};let g=actionSession({threshold,interval});games.push({routes:g.events.filter(e=>['left-ramp','right-ramp','left-orbit','right-orbit'].includes(e.id)).map(e=>e.id),threshold,interval,phase:g.phase,score:g.score,elapsed:g.elapsed,violations:g.violations,...result});}all[name]=games;}
console.log(JSON.stringify(all,null,2));
