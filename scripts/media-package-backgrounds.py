"""Package original generated FlowTask artwork as local responsive WebP assets.

Usage: python scripts/media-package-backgrounds.py docs/media-background-sources.json
The source PNGs stay untouched; the primary WebP retains the original dimensions.
"""
import json
from pathlib import Path
import sys
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/media/backgrounds/v1'
CATEGORY = {'nature-forest':'nature','mountains-lakes':'mountains','cozy-study':'cozy','anime-inspired':'anime','city-night':'city','ocean-escape':'ocean','space-cosmic':'space','minimal-abstract':'minimal'}

def package(source_path):
    sources = json.loads(Path(source_path).read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = []
    for item in sources:
        image = ImageOps.exif_transpose(Image.open(item['path'])).convert('RGB')
        asset_id = item['id']
        full = OUT / f'{asset_id}.webp'
        source_mtime = Path(item['path']).stat().st_mtime
        if not full.exists() or full.stat().st_mtime < source_mtime:
            image.save(full, 'WEBP', quality=88, method=6)
        thumb = image.copy()
        thumb.thumbnail((400, 225), Image.Resampling.LANCZOS)
        thumb_path = OUT / f'{asset_id}-thumb.webp'
        if not thumb_path.exists() or thumb_path.stat().st_mtime < source_mtime:
            thumb.save(thumb_path, 'WEBP', quality=78, method=6)
        small = image.copy()
        small.thumbnail((960, 540), Image.Resampling.LANCZOS)
        small_path = OUT / f'{asset_id}-960.webp'
        if not small_path.exists() or small_path.stat().st_mtime < source_mtime:
            small.save(small_path, 'WEBP', quality=84, method=6)
        prefix = f'/media/backgrounds/v1/{asset_id}'
        catalog.append({
            'id': asset_id, 'title': item['title'],
            'category': CATEGORY.get(item['category'], item['category']),
            'src': prefix + '.webp', 'thumbnail': prefix + '-thumb.webp',
            'variants': [{'src':prefix + '-960.webp','width':small.width,'height':small.height},
                         {'src':prefix + '.webp','width':image.width,'height':image.height}],
            'width': image.width, 'height': image.height, 'kind':'image',
            'bytes':full.stat().st_size, 'license':'Original AI-generated artwork; project use',
            'creator':'FlowTask / OpenAI image generation',
            'sourceUrl':None, 'verifiedAt':'2026-10-16',
            'provenance':'Created specifically for FlowTask with the built-in OpenAI image generation tool; not a stock photograph.',
        })
    catalog_path = OUT.parent / 'catalog.json'
    if catalog_path.exists():
        packaged_ids = {item['id'] for item in sources}
        catalog.extend(x for x in json.loads(catalog_path.read_text(encoding='utf-8')) if x['id'] not in packaged_ids)
    catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
    print(f'Packaged {len(sources)} original stills; {sum(x["bytes"] for x in catalog if x["kind"]=="image")/1024/1024:.2f} MiB primary images')

if __name__ == '__main__':
    package(sys.argv[1] if len(sys.argv)>1 else ROOT / 'docs/media-background-sources.json')
