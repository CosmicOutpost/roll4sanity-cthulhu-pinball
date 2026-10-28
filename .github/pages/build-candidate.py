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
