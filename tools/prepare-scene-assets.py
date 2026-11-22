"""Create browser delivery encodings; preserve the original generated PNG artwork."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
source=root/'assets/generated/v1'
forest=Image.open(source/'forest-arena.png').convert('RGB')
forest.save(root/'assets/scenes/forest/ground.webp',quality=94,method=6)
slime=Image.open(source/'slime-leaf.png').convert('RGBA')
slime.save(root/'assets/monsters/slime-leaf.webp',quality=94,method=6)
bounds=slime.getchannel('A').point(lambda value:255 if value>32 else 0).getbbox()
(root/'assets/monsters/slime-leaf.json').write_text(json.dumps({'source':'assets/generated/v1/slime-leaf.png','bounds':bounds,'animation':'runtime squash-and-stretch of static cutout'},indent=2))
print('Forest/Slime delivery copies encoded; originals preserved. Slime visible bounds:',bounds)
