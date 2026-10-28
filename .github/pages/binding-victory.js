// Candidate-only presentation driven by the existing once-per-game seal timestamp.
export class BindingVictory {
  constructor(scene, sim, lights) {
    this.sim = sim; this.lights = lights;
    this.graphics = scene.add.graphics().setDepth(3.8);
    this.panel = scene.add.graphics().setDepth(3.9);
    const titleStyle = { fontFamily: 'Georgia, serif', fontSize: '24px', fontStyle: 'bold', color: '#ffe2a0', stroke: '#071d16', strokeThickness: 4 };
    const detailStyle = { fontFamily: 'Georgia, serif', fontSize: '14px', color: '#e4e4b4', stroke: '#071d16', strokeThickness: 3 };
    this.title = scene.add.text(250, 606, 'CTHULHU IS BOUND!', titleStyle).setOrigin(.5).setDepth(4);
    this.detail = scene.add.text(250, 632, 'THE RITUAL IS COMPLETE', detailStyle).setOrigin(.5).setDepth(4);
    this.bonus = scene.add.text(250, 654, '+10,000', { ...detailStyle, fontStyle: 'bold', color: '#ffe1a2' }).setOrigin(.5).setDepth(4);
  }
  update() {
    const {sim, lights, graphics:g, panel} = this, r = sim.state.ritual;
    g.clear(); panel.clear();
    const active = r.sealed && sim.state.phase !== 'gameover';
    const age = active ? Math.max(0, sim.elapsed-r.sealedAt) : Infinity;
    const captionAlpha = age < 3200 ? 1 : Math.max(0, 1-(age-3200)/800);
    for (const text of [this.title,this.detail,this.bonus]) text.setVisible(active && captionAlpha>0).setAlpha(captionAlpha);
    if (!active) return;
    if (captionAlpha>0) {
      panel.fillStyle(0x061c16,.91*captionAlpha).fillRoundedRect(74, 580, 352, 102, 5);
      panel.lineStyle(2,0xdcc178,.95*captionAlpha).strokeRoundedRect(74,580,352,102,5);
      panel.lineStyle(1,0x68d8a0,.8*captionAlpha).strokeRect(80,586,340,90);
      panel.lineStyle(1,0xdcc178,.8*captionAlpha).lineBetween(106,592,394,592).lineBetween(106,670,394,670);
    }
    const calm=lights.reduced, progress=Math.min(age/2100,1), eased=1-(1-progress)*(1-progress);
    const radius=calm ? 76 : 105-29*eased;
    const alpha=calm ? .48 : .35 + .45*(1-progress);
    const rotation=calm ? 0 : (1-progress)*age*.00065;
    const x=270,y=391;
    g.lineStyle(6,0x19b97a,alpha*.25).strokeCircle(x,y,radius+7);
    g.lineStyle(2,0x42e5a4,alpha).strokeCircle(x,y,radius+7);
    g.lineStyle(2,0xffd875,alpha).strokeCircle(x,y,radius);
    g.lineStyle(1.5,0x8ef1b0,alpha).strokeCircle(x,y,radius-12);
    // Rotating radial marks and four fixed Bind jewels make motion legible.
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6+rotation, c=Math.cos(a), s=Math.sin(a);
      g.lineStyle(2,0xf5d486,alpha).lineBetween(x+c*(radius-7),y+s*(radius-7),x+c*(radius-2),y+s*(radius-2));
    }
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2-Math.PI/2, px=x+Math.cos(a)*radius, py=y+Math.sin(a)*radius;
      g.fillStyle(0x20c984,alpha).fillCircle(px,py,5);
      g.lineStyle(1.5,0xffdc82,alpha).strokeCircle(px,py,5);
    }
    if (!calm && age<900) {
      const id=[...r.activations].find(([,at])=>at===r.sealedAt)?.[0];
      const source=sim.stones[id]?.position;
      if (source) {
        const u=Math.min(age/650,1), px=source.x+(x-source.x)*u, py=source.y+(y-source.y)*u, a=1-age/900;
        g.lineStyle(9,0x24e998,.25*a).lineBetween(source.x,source.y,px,py);
        g.lineStyle(4,0xffe495,.9*a).lineBetween(source.x,source.y,px,py);
        g.fillStyle(0xffefb4,.9*a).fillCircle(px,py,8);
      }
    }
    if (!calm && age>=1950 && age<2300) {
      const flash=Math.sin(Math.PI*(age-1950)/350)*.35;
      g.lineStyle(5,0xffefa6,flash).strokeCircle(x,y,radius);
    }
  }
  destroy() { this.graphics.destroy(); this.panel.destroy(); this.title.destroy(); this.detail.destroy(); this.bonus.destroy(); }
}
