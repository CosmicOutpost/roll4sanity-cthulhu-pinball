import { BINDS } from './binding-ritual.js';
import { COVER_STONES } from './table.js';

// Fixed, reusable graphics and a compact HUD. Never writes to gameplay state.
export class RitualPresentation {
  constructor(scene, sim, lights, sound) {
    Object.assign(this, { scene, sim, lights, sound });
    this.graphics = scene.add.graphics().setDepth(3);
    this.banner = scene.add.text(250, 620, 'CTHULHU IS SEALED!\n+10,000 · KEEP PLAYING', {
      fontFamily: 'monospace', fontSize: '18px', align: 'center', color: '#ffe5a0',
      stroke: '#061a13', strokeThickness: 5,
    }).setOrigin(.5).setDepth(4).setVisible(false);
    this.hud = document.createElement('section');
    this.hud.id = 'ritual-progress'; this.hud.setAttribute('aria-label', 'Four Binds and three Cover Stones');
    this.hud.innerHTML = `<div class="bind-lamps">${BINDS.map(b => `<span class="bind-lamp" data-bind="${b.id}" style="--bind-colour:${b.colour}" title="${b.name} Bind: ${b.shot}"><i></i>${b.name}<small>${b.shot.replace('Right ' ,'R ').replace('Left ','L ').toUpperCase()}</small></span>`).join('')}</div><div class="seal-progress"><span id="ritual-status" role="status" aria-live="polite"></span><span class="stone-lamps" aria-label="Cover Stones">${[0,1,2].map(i=>`<span data-stone="${i}" title="Cover Stone ${i+1}">${i+1}</span>`).join('')}</span></div>`;
    document.querySelector('.scoreboard').insertAdjacentElement('afterend', this.hud);
    this.previous = null; this.seenStones = new Set(); this.seenVictory = false;
  }
  update() {
    const { sim, lights, sound } = this, r = sim.state.ritual;
    if (r !== this.previous) { this.previous=r; this.seenStones.clear(); this.seenVictory=false; this.signature=null; }
    const signature = `${r.revision}:${sim.state.phase}`;
    if (signature !== this.signature) {
      this.signature = signature;
      for (const b of BINDS) {
        const el=this.hud.querySelector(`[data-bind="${b.id}"]`), on=r.binds.has(b.id);
        el.classList.toggle('lit',on);el.setAttribute('aria-label',`${b.name}: ${b.shot}, ${on?'bound':'not yet bound'}`);
      }
      for (let i=0;i<3;i++) {
        const el=this.hud.querySelector(`[data-stone="${i}"]`);
        el.classList.toggle('empowered',r.empowered);el.classList.toggle('lit',r.stones.has(i));
        el.setAttribute('aria-label',`Stone ${i+1}: ${r.stones.has(i)?'sealed':r.empowered?'ready':'locked'}`);
      }
      this.hud.querySelector('#ritual-status').textContent = r.sealed ? 'CTHULHU IS SEALED!' : sim.state.phase==='gameover' ? `INCOMPLETE · B${r.binds.size}/4 · S${r.stones.size}/3` : r.empowered ? `STRIKE THE STONES · ${r.stones.size}/3` : `BIND ALL FOUR SHOTS · ${r.binds.size}/4`;
      this.hud.dataset.sealed = String(r.sealed);
    }
    if (!sim.state.paused) {
      let activated=false;
      for (const id of r.stones) if (!this.seenStones.has(id)) { this.seenStones.add(id); activated=true; }
      if (r.sealed && !this.seenVictory) { this.seenVictory=true; sound.ritual.roar(); }
      else if (activated) sound.play('ramp'); // Reuse the existing celebratory synth.
    }
    const g=this.graphics;g.clear();
    COVER_STONES.forEach((t,id)=>{
      const body=sim.stones[id], active=r.stones.has(id);
      const flash=Math.max(0,Math.min(1,((sim.flashes.get(`stone:${id}`)??0)-sim.elapsed)/250));
      const rim=active?0x9ee2b3:r.empowered?0xf0c765:0x9d8658;
      g.fillStyle(active?0x34674d:0x142e26).fillPoints(body.vertices,true);
      g.lineStyle(2,rim).strokePoints(body.vertices,true,true);
      const point=(x,y)=>({x:t.x+x*Math.cos(t.angle)-y*Math.sin(t.angle),y:t.y+x*Math.sin(t.angle)+y*Math.cos(t.angle)});
      const a=point(-8,8),b=point(8,8);
      g.lineStyle(3,flash?0xffedbc:rim).lineBetween(a.x,a.y,b.x,b.y);
      // Simple I / II / III inscriptions keep identity readable without new assets.
      for(let mark=0;mark<=id;mark++){const x=t.x+(mark-id/2)*4;g.lineStyle(1.5,rim).lineBetween(x,t.y-3,x,t.y+3);}
      const at=r.activations.get(id),age=at===undefined?Infinity:sim.elapsed-at;
      if(age>=0&&age<850){
        const strength=1-age/850;
        if(lights.reduced){g.lineStyle(2,0xe3ce8a,.3).strokeCircle(t.x,t.y,19);}
        else {const u=age/850,x=t.x+(270-t.x)*u,y=t.y+(391-t.y)*u;
          g.lineStyle(2,0xe5cf86,.45*strength).lineBetween(t.x,t.y,x,y);
          g.fillStyle(0xf5e1a2,.65*strength).fillCircle(x,y,4);}
      }
    });
    const age=r.sealedAt===null?Infinity:sim.elapsed-r.sealedAt;
    this.banner.setVisible(age>=0&&age<3500&&!sim.state.paused&&sim.state.phase==='playing');
    if(age>=0&&age<2200){g.lineStyle(3,0xebd18e,(lights.reduced ? .12 : .35)*(1-age/2200)).strokeEllipse(270,391,120,55);}
  }
  destroy(){this.hud.remove();this.graphics.destroy();this.banner.destroy();}
}
