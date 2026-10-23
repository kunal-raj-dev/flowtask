"""Validate background files and build a visual contact sheet (QA only)."""
import hashlib
import json
from pathlib import Path
from collections import Counter
import subprocess
import sys
from PIL import Image, ImageDraw, ImageOps
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
CATALOG=PUBLIC/'media/backgrounds/catalog.json'
assets=json.loads(CATALOG.read_text(encoding='utf-8'))
stills=[x for x in assets if x['kind']=='image']
videos=[x for x in assets if x['kind']=='video']
assert len({x['id'] for x in assets})==len(assets),'Duplicate IDs'
hashes=set()
for item in assets:
    for field in ('src','thumbnail'):
        path=PUBLIC/item[field].lstrip('/')
        assert path.is_file(),f'Missing {field}: {path}'
    for field in ('license','creator','verifiedAt','provenance'):
        assert item[field],f'Missing rights metadata {item["id"]}: {field}'
    if item['kind']=='image':
        path=PUBLIC/item['src'].lstrip('/')
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        assert digest not in hashes,f'Duplicate primary artwork {item["id"]}'
        hashes.add(digest)
        image=Image.open(path)
        assert image.size==(item['width'],item['height'])
        assert image.width>=1280 and image.height>=720,f'Undersized {item["id"]}'
        for variant in item.get('variants',[]):
            assert (PUBLIC/variant['src'].lstrip('/')).exists()
    else:
        path=PUBLIC/item['src'].lstrip('/')
        result=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(path),'-f','null','-'],capture_output=True)
        assert result.returncode==0,f'Video decode failure: {item["id"]}'
        metadata=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-i',str(path)],capture_output=True,text=True).stderr
        assert 'Audio:' not in metadata,f'Unexpected audio stream: {item["id"]}'
        assert (PUBLIC/item['poster'].lstrip('/')).exists()
counts=Counter(x['category'] for x in stills)
if '--allow-incomplete' not in sys.argv:
    assert len(stills)==51,f'Expected 51 stills, got {len(stills)}'
    assert set(counts)=={'nature','mountains','cozy','anime','city','ocean','space','minimal'}
    assert all(count>=6 for count in counts.values()),counts
    assert {'kyoto-rain','dolomite-dawn','penthouse-noir'} <= {item['id'] for item in stills}
    assert len(videos)==6,f'Expected six videos, got {len(videos)}'
sheet=Image.new('RGB',(1600,math_rows:=((len(assets)+3)//4)*256),(21,24,29))
draw=ImageDraw.Draw(sheet)
for i,item in enumerate(assets):
    x=(i%4)*400; y=(i//4)*256
    image=ImageOps.fit(Image.open(PUBLIC/item['thumbnail'].lstrip('/')).convert('RGB'),(396,223),method=Image.Resampling.LANCZOS)
    sheet.paste(image,(x+2,y+2))
    draw.text((x+10,y+232),item['title'],fill=(233,236,241))
sheet.save(PUBLIC/'media/backgrounds/qa-contact-sheet.webp','WEBP',quality=85)
print(json.dumps({'stills':len(stills),'videos':len(videos),'collections':dict(counts),'totalMiB':round(sum(p.stat().st_size for p in (PUBLIC/'media/backgrounds/v1').glob('*'))/1024/1024,2)},indent=2))
