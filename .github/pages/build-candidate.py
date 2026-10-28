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

# Install the isolated test-only UI into this archived build, never the prototype.
import shutil
base = Path(__file__).resolve().parent
target = Path(sys.argv[1])
for name in ('ritual-test-mode.js', 'ritual-test-mode.css', 'binding-victory.js'):
    shutil.copyfile(base / name, target / 'src/game' / name)
shutil.copyfile(base / 'candidate-all-faces.test.js', target / 'tests/candidate-all-faces.test.js')
# Replace only the old candidate victory caption/ellipse, preserving the
# existing stone pulses, HUD, once-only roar, and all gameplay events.
ritual = target / 'src/game/ritual-presentation.js'
code = ritual.read_text()
old = "    this.banner.setVisible(age>=0&&age<3500&&!sim.state.paused&&sim.state.phase==='playing');\n    if(age>=0&&age<2200){g.lineStyle(3,0xebd18e,(lights.reduced ? .12 : .35)*(1-age/2200)).strokeEllipse(270,391,120,55);}"
if code.count(old) != 1: raise SystemExit('Candidate victory presentation hook not unique')
ritual.write_text(code.replace(old, '    this.banner.setVisible(false);', 1))
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
