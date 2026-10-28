"""Apply only the approved trial coordinates to an archived prototype."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) / 'src/game/table.js'
source = path.read_text()
for old, new in [
    ('{ x: 135, y: 395, angle: -.314 }', '{ x: 145, y: 495, angle: -.314 }'),
    ('{ x: 250, y: 430, angle: .314 }', '{ x: 250, y: 545, angle: .314 }'),
    ('{ x: 365, y: 395, angle: .314 }', '{ x: 355, y: 495, angle: .314 }'),
]:
    if source.count(old) != 1:
        raise SystemExit(f'Expected exactly one original stone: {old}')
    source = source.replace(old, new, 1)
path.write_text(source)

# Candidate only: score any real ball contact with a stone, retaining its
# existing per-body cooldown and passive Matter collision response.
physics = Path(sys.argv[1]) / 'src/game/physics.js'
source = physics.read_text()
old = "if (!this.isStoneFront(other, collision) || (this.cooldowns.get(other.id) ?? 0) > this.elapsed) continue;"
new = "if ((this.cooldowns.get(other.id) ?? 0) > this.elapsed) continue;"
if source.count(old) != 1:
    raise SystemExit('Expected exactly one original stone face guard')
physics.write_text(source.replace(old, new, 1))

# Approved visual-only guide study. The physical rails use the same points
# and widths; only the drawing colours and decorative engraving change.
renderer = Path(sys.argv[1]) / 'src/game/render.js'
source = renderer.read_text()
old = '''      this.stroke(rail.points, rail.width + 5, 0x03111a, .8);
      this.stroke(rail.points, rail.width, 0x456069);
      this.stroke(rail.points, Math.max(2, rail.width - 5), 0x91aca3, .75);
      this.stroke(rail.points, 1, 0xd5e7ca, .45);'''
new = '''      this.stroke(rail.points, rail.width + 5, 0x081b17, .9);
      this.stroke(rail.points, rail.width + 2, 0x927747, .72);
      this.stroke(rail.points, rail.width, 0x364a3d);
      this.stroke(rail.points, Math.max(2, rail.width - 4), 0x4a5946, .95);
      this.stroke(rail.points, 1, 0xa39065, .48);
      // Small etched strokes follow each existing visible rail segment.
      for (let i = 1; i < rail.points.length; i++) {
        const [ax, ay] = rail.points[i-1], [bx, by] = rail.points[i];
        const dx=bx-ax, dy=by-ay, len=Math.hypot(dx,dy);
        for (let d=23; d<len-14; d+=46) {
          const x=ax+dx*d/len, y=ay+dy*d/len, nx=-dy/len, ny=dx/len;
          this.stroke([[x-nx*2,y-ny*2],[x+nx*2,y+ny*2]], 1, 0xc9a96b, .4);
        }
      }'''
if source.count(old) != 1: raise SystemExit('Candidate guide drawing hook not unique')
renderer.write_text(source.replace(old, new, 1))

# Install the isolated test-only UI into this archived build, never the prototype.
import shutil
base = Path(__file__).resolve().parent
target = Path(sys.argv[1])
for name in ('ritual-test-mode.js', 'ritual-test-mode.css', 'ritual-panel-draft.css', 'binding-victory.js'):
    shutil.copyfile(base / name, target / 'src/game' / name)
shutil.copyfile(base / 'candidate-all-faces.test.js', target / 'tests/candidate-all-faces.test.js')
# Replace only the old candidate victory caption/ellipse, preserving the
# existing stone pulses, HUD, once-only roar, and all gameplay events.
ritual = target / 'src/game/ritual-presentation.js'
code = ritual.read_text()
old = "    this.banner.setVisible(age>=0&&age<3500&&!sim.state.paused&&sim.state.phase==='playing');\n    if(age>=0&&age<2200){g.lineStyle(3,0xebd18e,(lights.reduced ? .12 : .35)*(1-age/2200)).strokeEllipse(270,391,120,55);}"
if code.count(old) != 1: raise SystemExit('Candidate victory presentation hook not unique')
code = code.replace(old, '    this.banner.setVisible(false);', 1)
old = "r.sealed ? 'CTHULHU IS SEALED!' : sim.state.phase==='gameover' ? `INCOMPLETE · B${r.binds.size}/4 · S${r.stones.size}/3` : r.empowered ? `STRIKE THE STONES · ${r.stones.size}/3` : `BIND ALL FOUR SHOTS · ${r.binds.size}/4`"
new = "r.sealed ? 'CTHULHU BOUND' : sim.state.phase==='gameover' ? 'RITUAL INCOMPLETE' : r.empowered ? `STONES ${r.stones.size}/3` : `BINDS ${r.binds.size}/4`"
if code.count(old) != 1: raise SystemExit('Candidate ritual progress label not unique')
ritual.write_text(code.replace(old, new, 1))
index = target / 'index.html'
code = index.read_text()
old = 'Once all Binds are lit, strike each stone’s front rubber face.'
if code.count(old) != 1: raise SystemExit('Candidate stone instructions not unique')
index.write_text(code.replace(old, 'Once all Binds are lit, strike each stone on any side.', 1))
main = target / 'src/main.js'
code = main.read_text()
for old, new in [
    ("import { PinballPhysics } from './game/physics.js';", "import { PinballPhysics } from './game/physics.js';\nimport { RitualTestMode } from './game/ritual-test-mode.js';\nimport { BindingVictory } from './game/binding-victory.js';"),
    ('    this.ritual = new RitualPresentation(this, this.sim, this.table.lights, this.feedback.sound);', '    this.ritual = new RitualPresentation(this, this.sim, this.table.lights, this.feedback.sound);\n    this.testMode = new RitualTestMode(this.sim, this);\n    this.bindingVictory = new BindingVictory(this, this.sim, this.table.lights);'),
    ('this.unbind(); this.ritual.destroy();', 'this.unbind(); this.bindingVictory.destroy(); this.testMode.destroy(); this.ritual.destroy();'),
    ('    this.ritual.update();', '    this.ritual.update();\n    this.testMode.update();\n    this.bindingVictory.update();'),
]:
    if code.count(old) != 1: raise SystemExit(f'Candidate hook not unique: {old}')
    code = code.replace(old, new, 1)
main.write_text(code)
