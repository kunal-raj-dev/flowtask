"""Download and verify the curated public-license workspace image pack."""
import hashlib
import html
import json
import re
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/media-workspace-open-assets.json"
CACHE = Path(tempfile.gettempdir()) / "flowtask-workspace-open-assets"
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "FlowTask/2.0 (https://flowtask-kunal.vercel.app; workspace visual library)"
ALLOWED_LICENSES = {"CC0", "Public domain", "CC BY 4.0"}

# Use-case category remains separate from the visual genre so existing recommendations keep working.
ASSETS = [
    ("nature-utah-dunes", "Dunes at Dusk", "File:Utah Dunes Landscape - West Desert District.jpg", "nature", "planning-reflection", ["nature", "desert", "landscape"], ["open", "quiet"], "Soft dunes and distant mountains in the Utah desert at dusk.", [50, 52]),
    ("nature-red-mountain-lake", "Red Mountain Lake", "File:Pitamakan Lake with Red Mountain (48920896467).jpg", "nature", "study-research", ["nature", "mountain", "lake", "study"], ["expansive", "fresh"], "A high alpine lake below a red mountain ridge.", [50, 50]),
    ("nature-tateyama-snow", "Tateyama Snow Route", "File:Tateyama Kurobe Alpine Route - AlpineRoute6309.jpg", "nature", "study-research", ["nature", "snow", "mountain", "research"], ["still", "cool"], "Snow-covered slopes along the Tateyama Alpine Route.", [50, 52]),
    ("nature-taynish-forest", "Taynish Rainforest", "File:Taynish atlantic oakwood, temperate rainforest, argyll, scotland 2.jpg", "nature", "study-research", ["nature", "forest", "biology", "research"], ["lush", "quiet"], "Dense green oak woodland in a temperate rainforest.", [50, 50]),
    ("nature-koh-chang", "Koh Chang Rainforest", "File:Tropical rainforest 2, Koh Chang, Thailand.jpg", "nature", "study-research", ["nature", "tropical", "forest", "biology"], ["vivid", "immersive"], "Layered tropical rainforest on Koh Chang, Thailand.", [50, 50]),
    ("nature-havelock-mangrove", "Havelock Mangrove Coast", "File:Havelock Island, Mangrove tree on the beach, Andaman Islands.jpg", "nature", "personal-life-admin", ["nature", "coast", "travel", "island"], ["calm", "bright"], "A mangrove tree beside a quiet beach on Havelock Island.", [50, 50]),

    ("architecture-ashford-brutalist", "Ashford Brutalist", "File:Brutalist architecture, Ashford, Kent.jpg", "architecture", "code-build", ["architecture", "concrete", "design", "engineering"], ["graphic", "cool"], "A sculptural concrete building in Ashford, Kent.", [50, 50]),
    ("architecture-nemo-museum", "NEMO by the Water", "File:2006.10 - Amsterdam photo of modern architecture - the NEMO museum with its ship-architecture form under a high Dutch sky in Amsterdam; Dutch city + geotag, Fons Heijnsbroek, The Netherlands (27366204860).jpg", "architecture", "design-creative", ["architecture", "museum", "design", "creative"], ["bold", "aquatic"], "The green, ship-shaped NEMO museum beside the Amsterdam waterfront.", [50, 50]),
    ("architecture-paris-curved-glass", "Paris Curved Glass", "File:Curved architecture of a reflective building with multiple glass windows in Paris.jpg", "architecture", "design-creative", ["architecture", "glass", "design", "geometry"], ["reflective", "modern"], "A curved glass facade reflecting the surrounding city in Paris.", [50, 50]),
    ("architecture-prague-station", "Prague Station Ceiling", "File:Prague Main Railway Station Ceiling Lights.jpg", "architecture", "planning-reflection", ["architecture", "station", "travel", "transit"], ["airy", "geometric"], "The sweeping illuminated ceiling of Prague Main Railway Station.", [50, 48]),
    ("architecture-budapest-bridge", "Budapest Chain Bridge", "File:Budapest Night Chain bridge 5.jpg", "architecture", "personal-life-admin", ["architecture", "bridge", "travel", "city"], ["night", "luminous"], "The Chain Bridge crossing the Danube at night in Budapest.", [50, 50]),
    ("architecture-quebec-price", "Quebec Price Building", "File:Price Building illuminated at night in Quebec City.jpg", "architecture", "planning-reflection", ["architecture", "city", "night", "design"], ["night", "striking"], "The illuminated Price Building rises over Quebec City at night.", [50, 48]),

    ("space-carina-nebula", "Carina Nebula", "File:ESO - The Carina Nebula (by).jpg", "space", "study-research", ["space", "astronomy", "nebula", "science"], ["cosmic", "warm"], "A richly colored view of the Carina Nebula.", [50, 50]),
    ("space-andromeda", "Andromeda Galaxy", "File:Andromeda Galaxy 2025.png", "space", "study-research", ["space", "astronomy", "galaxy", "science"], ["vast", "cool"], "A wide view of the Andromeda Galaxy against deep space.", [50, 50]),
    ("space-cygnus-loop", "Cygnus Loop", "File:Ultraviolet image of the Cygnus Loop Nebula crop.jpg", "space", "study-research", ["space", "astronomy", "nebula", "science"], ["electric", "dark"], "Blue ultraviolet filaments from the Cygnus Loop Nebula.", [50, 50]),
    ("space-california-nebula", "California Nebula", "File:California nebula NGC1499.jpg", "space", "study-research", ["space", "astronomy", "nebula", "science"], ["glowing", "colorful"], "Colorful gas clouds form the California Nebula.", [50, 50]),
    ("space-lunar-horizon", "Lunar Horizon", "File:Lunar Landscape Scene (Poly Haven).png", "space", "design-creative", ["space", "moon", "landscape", "design"], ["minimal", "quiet"], "A still lunar horizon beneath a dark star field.", [50, 55]),
    ("space-mars", "Mars: Near and Far", "File:Mars near and far (potw2228a).jpg", "space", "study-research", ["space", "mars", "astronomy", "science"], ["planetary", "curious"], "Mars seen as a small planet against a wide star field.", [50, 50]),

    ("illustration-berry-plate", "Berry Botanical Plate", "File:Vintage illustrations by Miss May Rivers digitally enhanced by rawpixel 116.jpg", "illustration", "study-research", ["illustration", "botanical", "biology", "plant"], ["vintage", "colorful"], "A vintage botanical illustration of berry plants and fruit.", [50, 50]),
    ("illustration-starry-night", "Starry Night", "File:Van Gogh - Starry Night - Google Art Project.jpg", "illustration", "design-creative", ["painting", "art", "illustration", "night"], ["expressive", "classic"], "An expressive night sky painted above a quiet village.", [50, 50]),
    ("illustration-figures-landscape", "Figures in the Landscape", "File:Figures in the landscape, 1926, Hermann Scherer.jpg", "illustration", "design-creative", ["print", "art", "illustration", "landscape"], ["graphic", "expressive"], "An expressionist black-and-white landscape print.", [50, 50]),
    ("illustration-waterfall-engraving", "Waterfall Engraving", "File:Hendrick Goltzius, Dutch (active Haarlem) - Landscape with a Waterfall - Google Art Project.jpg", "illustration", "writing-communication", ["print", "engraving", "art", "landscape"], ["historic", "detailed"], "A fine-line historical engraving of a waterfall landscape.", [50, 50]),
    ("illustration-nansen-woodcut", "Northern Woodcut", "File:Nansen - Nord i Tåkeheimen, woodcut 3.png", "illustration", "study-research", ["woodcut", "art", "mountain", "history"], ["nordic", "graphic"], "A dramatic northern landscape rendered as a woodcut.", [50, 50]),
    ("illustration-great-wave", "The Great Wave", "File:The Great Wave off Kanagawa.jpg", "illustration", "design-creative", ["woodblock", "art", "ocean", "illustration"], ["classic", "dynamic"], "A Japanese woodblock print of a great wave and distant mountain.", [50, 50]),

    ("abstract-sophie-circles", "Sophie Taeuber Circles", "File:Animated circle figure (1934)- Sophie Taeuber-Arp.jpg", "abstract", "design-creative", ["abstract", "geometry", "color", "design"], ["playful", "modernist"], "A balanced abstract composition of colored circles.", [50, 50]),
    ("abstract-together-two", "Together No. 2", "File:'Together 2. nr. 6.346' - an abstract gouache painting on paper, painted in 2001 by Dutch artist Fons Heijnsbroek.tif", "abstract", "design-creative", ["abstract", "painting", "color", "creative"], ["bold", "layered"], "An abstract gouache composition with strong color blocks.", [50, 50]),
    ("abstract-geometric-bird", "Geometric Bird Vessel", "File:Greece, Geometric Period, 8th Century BC - Geometric Bird Askos - 1993.1 - Cleveland Museum of Art.tif", "abstract", "design-creative", ["abstract", "geometry", "ceramic", "pattern"], ["ancient", "crafted"], "An ancient ceramic vessel decorated with geometric bird motifs.", [50, 50]),
    ("abstract-color-tale", "Color Tale", "File:'Color Tale' - abstract painting in green and yellow blur - watercolor on paper - modern abstract expressionism by Fons Heijnsbroek, 2008 - free download art image CC0, high resolutions TIFF.tif", "abstract", "design-creative", ["abstract", "watercolor", "color", "art"], ["fluid", "fresh"], "Loose green and yellow watercolor forms on paper.", [50, 50]),
    ("abstract-the-cage", "The Cage", "File:'The Cage' - abstract watercolor painting in color and lines - by artist Fons Heijnsbroek, created in 2010. Free art image in high resolutions tiff.tif", "abstract", "design-creative", ["abstract", "watercolor", "lines", "art"], ["expressive", "fluid"], "An abstract watercolor with layered colored lines.", [50, 50]),
    ("abstract-kandinsky", "Kandinsky Improvisation", "File:Vasily Kandinsky - Improvisation No. 30 (Cannons) - 1931.511 - Art Institute of Chicago.jpg", "abstract", "design-creative", ["abstract", "painting", "color", "art"], ["energetic", "modernist"], "A vivid early abstract painting by Wassily Kandinsky.", [50, 50]),

    ("macro-grape-crystal", "Grape Crystal Close-up", "File:2016-03-29 19-10-45 cristaux-vin-134f.jpg", "macro", "study-research", ["macro", "mineral", "crystal", "science"], ["tactile", "detailed"], "Small pale crystals clustered across a dark mineral surface.", [50, 50]),
    ("macro-indian-paintbrush", "Indian Paintbrush", "File:Indian paintbrush castilleja coccinea flower close up macro flora photography.jpg", "macro", "study-research", ["macro", "flower", "botany", "biology"], ["vivid", "natural"], "A close view of bright red Indian paintbrush flowers.", [50, 50]),
    ("macro-white-bloom", "Soft White Bloom", "File:Macro Flower 1.jpg", "macro", "design-creative", ["macro", "flower", "texture", "creative"], ["soft", "delicate"], "A delicate white flower seen at close range.", [50, 50]),
    ("macro-green-butterfly", "Green Butterfly", "File:Pale Green Butterfly Feeding on Lantana Flower – Garden Macro, India.jpg", "macro", "study-research", ["macro", "butterfly", "flower", "biology"], ["curious", "bright"], "A pale green butterfly feeding on a lantana flower.", [50, 50]),
    ("macro-bioluminescent-beetle", "Bioluminescent Beetle", "File:Close-up view of a bioluminescent beetle Elateroidea.jpg", "macro", "study-research", ["macro", "insect", "biology", "science"], ["luminous", "night"], "A close view of a beetle glowing in the dark.", [50, 50]),
    ("macro-leaf-moss", "Leaf on Moss", "File:Macro view of a single green leaf fragment on a mossy rock.jpg", "macro", "personal-life-admin", ["macro", "leaf", "moss", "nature"], ["quiet", "textural"], "A small green leaf resting on a moss-covered rock.", [50, 50]),
]


def clean(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]*>", " ", value or "")).strip()


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    records = []
    for slug, title, file_title, visual_style, category, contexts, moods, alt_text, focal in ASSETS:
        response = session.get(API, params={
            "action": "query", "format": "json", "titles": file_title,
            "prop": "imageinfo", "iiprop": "url|size|extmetadata|sha1|mime", "iiurlwidth": 2560,
        }, timeout=35)
        response.raise_for_status()
        # Wikimedia's JSON includes artist names with diacritics; decode as UTF-8
        # explicitly instead of relying on a guessed legacy response encoding.
        pages = json.loads(response.content.decode("utf-8")).get("query", {}).get("pages", {})
        page = next(iter(pages.values()), {})
        if "missing" in page or not page.get("imageinfo"):
            raise ValueError(f"Commons file was not found: {file_title}")
        info = page["imageinfo"][0]
        meta = info.get("extmetadata", {})
        license_name = clean(meta.get("LicenseShortName", {}).get("value", ""))
        if license_name not in ALLOWED_LICENSES:
            raise ValueError(f"Unsupported license for {file_title}: {license_name or 'missing'}")
        width, height = int(info.get("width", 0)), int(info.get("height", 0))
        if width < 1600 or height < 1000:
            raise ValueError(f"Source is too small for a workspace cover: {file_title} ({width}x{height})")
        source_url = info.get("descriptionurl", "")
        file_url = info.get("url", "")
        download_url = file_url
        scaled = int(info.get("size", 0)) > 30 * 1024 * 1024
        if scaled:
            download_url = info.get("thumburl", "")
            if not download_url:
                raise ValueError(f"No high-resolution derivative was supplied for large source: {file_title}")
        ext = Path(urlparse(download_url).path).suffix.lower() or ".img"
        target = CACHE / f"{slug}{'-2560' if scaled else ''}{ext}"
        if not target.exists() or target.stat().st_size == 0:
            with session.get(download_url, stream=True, timeout=(20, 120)) as download:
                download.raise_for_status()
                with target.open("wb") as output:
                    for chunk in download.iter_content(1024 * 1024):
                        if chunk:
                            output.write(chunk)
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        license_url = clean(meta.get("LicenseUrl", {}).get("value", "")) or None
        if license_url and license_url.startswith("http://"):
            license_url = "https://" + license_url[7:]
        creator = clean(meta.get("Artist", {}).get("value", "")) or clean(meta.get("Credit", {}).get("value", "")) or "Unspecified creator"
        attribution = clean(meta.get("Attribution", {}).get("value", ""))
        records.append({
            "id": f"ws-{slug}", "title": title, "sourceTitle": file_title,
            "category": category, "visualStyle": visual_style,
            "contexts": contexts, "moods": moods, "altText": alt_text,
            "focalPoint": {"x": focal[0], "y": focal[1]},
            "creator": creator, "attribution": attribution,
            "license": license_name, "licenseUrl": license_url,
            "sourceUrl": source_url, "sourceFileUrl": file_url, "downloadFileUrl": download_url,
            "sourceSha256": digest, "sourceSha1": info.get("sha1"),
            "sourceWidth": width, "sourceHeight": height,
            "downloadedWidth": int(info.get("thumbwidth", width)) if scaled else width,
            "downloadedHeight": int(info.get("thumbheight", height)) if scaled else height,
            "sourceBytes": int(info.get("size", target.stat().st_size)),
            "sourceMime": info.get("mime"), "sourceFile": target.name,
            "verifiedAt": date.today().isoformat(),
            "provenance": "Downloaded from the Wikimedia Commons file page; the file-level license was checked before download.",
            "changesMade": "Downloaded from the source file page; large originals use its 2560-pixel Wikimedia rendition. Responsive WebP derivatives are generated for FlowTask.",
        })
        print(f"Verified and downloaded {slug} · {license_name} · {width}×{height}", flush=True)
    styles = {}
    for item in records:
        styles[item["visualStyle"]] = styles.get(item["visualStyle"], 0) + 1
    if len(records) != 36 or len(styles) != 6 or any(count != 6 for count in styles.values()):
        raise ValueError(f"Expected six assets in each of six visual styles; found {styles}")
    OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} with {len(records)} verified source records.")


if __name__ == "__main__":
    main()
