"""Build the curated FlowTask workspace cover library as responsive WebP files."""
import json
import hashlib
import tempfile
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/media/workspace/v1"
MANIFEST = ROOT / "docs/media-workspace-sources.json"
OPEN_ASSETS_FILE = ROOT / "docs/media-workspace-open-assets.json"
OPEN_ASSETS_CACHE = Path(tempfile.gettempdir()) / "flowtask-workspace-open-assets"
PUBLIC_CREDITS = ROOT / "public/media/workspace/CREDITS.md"

# category, slug, title, contexts, moods, alt text, focal point, art direction
ASSETS = [
    ("study-research", "morning-library", "Morning Library", ["study", "reading", "research"], ["quiet", "warm"], "Sunlit shelves and an open reading table in a calm library.", [50, 50], "Warm natural-light library reading table, no readable text."),
    ("study-research", "archival-reading-room", "Archival Reading Room", ["study", "history", "research"], ["focused", "classic"], "A quiet archival reading room with long tables and tall shelves.", [50, 48], "Refined archival library interior with a long oak table."),
    ("study-research", "botanical-research", "Botanical Research", ["study", "science", "biology", "research"], ["fresh", "curious"], "Botanical specimens and a notebook in a softly lit research room.", [52, 50], "Botanical study table, specimen leaves and soft daylight."),
    ("study-research", "quiet-campus-dawn", "Campus at Dawn", ["study", "school", "university", "exam"], ["fresh", "hopeful"], "A peaceful university walkway in the early morning.", [50, 48], "Quiet campus path in gentle morning light."),
    ("study-research", "quiet-study-stack", "Quiet Study Stack", ["study", "reading", "exam"], ["cozy", "focused"], "A small stack of books beside a warm reading lamp.", [50, 52], "Cozy quiet study stack and warm lamp, no legible titles."),
    ("study-research", "field-notes-greenhouse", "Field Notes in the Greenhouse", ["study", "science", "biology", "research"], ["natural", "curious"], "Greenhouse leaves and blank field notes in soft sunlight.", [54, 50], "Greenhouse research table with botanical leaves and blank notes."),

    ("code-build", "warm-circuit-bench", "Warm Circuit Bench", ["code", "hardware", "engineering", "build"], ["inventive", "warm"], "A tidy electronics workbench with a small circuit board and tools.", [50, 53], "Small electronics prototype on a warm, orderly workbench."),
    ("code-build", "quiet-code-studio", "Quiet Code Studio", ["code", "software", "developer", "build"], ["quiet", "focused"], "A developer desk with a laptop angled away and soft window light.", [52, 52], "Quiet software studio, screen turned away and no readable UI."),
    ("code-build", "modular-hardware", "Modular Hardware", ["code", "hardware", "engineering", "build"], ["precise", "inventive"], "Modular electronic parts arranged on a clean work surface.", [50, 52], "Modular hardware components arranged on a clean bench."),
    ("code-build", "architecture-paper", "Architecture on Paper", ["code", "software", "architecture", "planning"], ["thoughtful", "precise"], "Abstract software architecture represented by blank paper diagrams.", [52, 50], "Blank technical sketch sheets and a ruler, without legible writing."),
    ("code-build", "quiet-server-gallery", "Quiet Server Gallery", ["code", "software", "infrastructure", "engineering"], ["cool", "focused"], "A quiet modern server gallery with soft blue indicator lights.", [50, 50], "Modern server cabinets in soft, calm light."),
    ("code-build", "prototype-workbench", "Prototype Workbench", ["code", "hardware", "engineering", "build"], ["hands-on", "inventive"], "A prototype object and hand tools on a natural wood workbench.", [50, 54], "A small hardware prototype on a sunlit workbench."),

    ("writing-communication", "draft-by-window", "Draft by the Window", ["writing", "communication", "editing"], ["quiet", "reflective"], "A blank notebook and pen beside a softly lit window.", [52, 50], "Blank writing notebook beside a rain-lit window, no legible text."),
    ("writing-communication", "voice-notes-studio", "Voice Notes Studio", ["writing", "communication", "audio"], ["warm", "expressive"], "A simple microphone and notebook in a small home recording corner.", [52, 50], "Quiet voice recording setup with notebook and microphone."),
    ("writing-communication", "editorial-paper", "Editorial Paper", ["writing", "editing", "publishing"], ["minimal", "calm"], "Layered handmade paper and a pencil on a calm writing table.", [50, 52], "Textured blank paper and pencil on a warm editorial desk."),
    ("writing-communication", "rainy-window-writing", "Rainy Window", ["writing", "journaling", "communication"], ["rainy", "cozy"], "A quiet writing corner beside a rain-streaked window.", [52, 50], "Rain on a window above a quiet writing table, no visible text."),
    ("writing-communication", "letterpress-corner", "Letterpress Corner", ["writing", "publishing", "craft"], ["tactile", "classic"], "A small letterpress studio with paper and type blocks.", [50, 54], "Traditional letterpress worktable with paper and type blocks."),
    ("writing-communication", "reading-and-editing", "Reading and Editing", ["writing", "reading", "editing"], ["thoughtful", "quiet"], "A book and red pencil on a calm editor's desk.", [50, 50], "Reading and editing scene with a closed book and pencil."),

    ("design-creative", "architectural-model", "Architectural Model", ["design", "architecture", "creative", "planning"], ["crafted", "warm"], "A detailed architectural model on a sunlit studio table.", [56, 50], "Wood and paper architectural model in a warm design studio."),
    ("design-creative", "ceramic-studio", "Ceramic Studio", ["design", "ceramics", "creative", "craft"], ["tactile", "quiet"], "Handmade clay forms on a potter's worktable.", [60, 56], "Two handmade clay vessels on a rustic studio table."),
    ("design-creative", "color-study-table", "Color Study Table", ["design", "color", "creative", "interior"], ["warm", "inspiring"], "Natural color swatches and textured materials on a design table.", [58, 52], "Color and material swatches arranged on a wooden table."),
    ("design-creative", "ink-paper-studio", "Ink and Paper Studio", ["design", "illustration", "creative", "drawing"], ["expressive", "quiet"], "Abstract ink studies and brushes on textured paper.", [50, 50], "Ink washes on blank handmade paper with brushes and glass jars."),
    ("design-creative", "sculpture-studio", "Sculpture Studio", ["design", "sculpture", "creative", "art"], ["sunlit", "crafted"], "A small abstract clay sculpture in a bright artist studio.", [58, 52], "Sculptural clay maquette in a warm, sunlit studio."),
    ("design-creative", "textile-workroom", "Textile Workroom", ["design", "textile", "creative", "craft"], ["tactile", "colorful"], "Folded fabric swatches and thread in a textile studio.", [55, 54], "Linen and woven textile swatches on a craft worktable."),

    ("planning-reflection", "morning-priorities", "Morning Priorities", ["planning", "priorities", "reflection", "daily"], ["fresh", "warm"], "A blank planner, small timer and cup on a sunlit table.", [50, 55], "Blank planner, ceramic cup and small brass timer in morning light."),
    ("planning-reflection", "weekly-overview", "Weekly Overview", ["planning", "weekly", "organization", "calendar"], ["organized", "calm"], "Minimal blank weekly planning cards and a desk calendar.", [50, 50], "Blank planning cards and calendar in a sunlit room."),
    ("planning-reflection", "reflective-evening", "Reflective Evening", ["planning", "reflection", "review", "daily"], ["reflective", "evening"], "A closed journal and pen in warm evening light.", [50, 53], "Closed blank journal and fountain pen at sunset."),
    ("planning-reflection", "project-milestone-map", "Project Milestone Map", ["planning", "project", "milestones", "roadmap"], ["precise", "thoughtful"], "A simple thread connecting small brass pins across blank paper.", [54, 50], "Abstract milestone line made from thread and brass pins, no text."),
    ("planning-reflection", "weekly-rhythm", "Weekly Rhythm", ["planning", "weekly", "calendar", "routine"], ["airy", "quiet"], "A blank desk calendar and water glass by a bright window.", [52, 50], "Unmarked desk calendar in a bright sunroom."),
    ("planning-reflection", "clear-priorities", "Clear Priorities", ["planning", "priorities", "reflection", "focus"], ["grounded", "simple"], "Three smooth stones and three blank cards on a garden-facing desk.", [50, 55], "Three stones and blank cards arranged on an oak table."),

    ("personal-life-admin", "home-admin", "Home Admin", ["personal", "home", "life-admin", "organization"], ["welcoming", "warm"], "Keys, blank envelopes and a linen tote on an entryway console.", [50, 52], "Keys and blank envelopes on a tidy entryway table."),
    ("personal-life-admin", "travel-preparation", "Travel Preparation", ["personal", "travel", "life-admin", "planning"], ["anticipatory", "bright"], "An unmarked map, camera and travel bag near a bright window.", [50, 50], "Travel map and camera arranged beside a carry-on, no readable details."),
    ("personal-life-admin", "kitchen-routine", "Kitchen Routine", ["personal", "home", "meal-planning", "routine"], ["fresh", "nourishing"], "Fresh vegetables, herbs and a blank recipe book on a kitchen counter.", [50, 54], "Fresh vegetables and blank notebook on a sunlit kitchen counter."),
    ("personal-life-admin", "home-reset", "Home Reset", ["personal", "home", "organization", "routine"], ["orderly", "soft"], "Folded linen towels and woven baskets in a calm home interior.", [58, 50], "Neatly folded linens and woven storage baskets in warm daylight."),
    ("personal-life-admin", "steady-finances", "Steady Finances", ["personal", "finance", "life-admin", "planning"], ["grounded", "orderly"], "Unmarked envelopes, coins and a calculator on a wooden table.", [50, 52], "Unmarked envelopes and coins beside a simple calculator."),
    ("personal-life-admin", "gentle-wellbeing", "Gentle Wellbeing", ["personal", "wellbeing", "routine", "health"], ["restful", "fresh"], "A rolled yoga mat, folded blanket and glass of water by a window.", [50, 54], "Yoga mat and folded blanket in a quiet, sunlit home corner."),
]
CATEGORY_LABELS = {
    "study-research": "Study & Research", "code-build": "Code & Build",
    "writing-communication": "Writing & Communication", "design-creative": "Design & Creative",
    "planning-reflection": "Planning & Reflection", "personal-life-admin": "Personal & Life Admin",
}
STYLE_LABELS = {
    "flowtask-original": "FlowTask original",
    "nature": "Cinematic nature",
    "architecture": "Architecture & city",
    "space": "Space & science",
    "illustration": "Illustration & editorial art",
    "abstract": "Abstract & geometric",
    "macro": "Macro & materials",
}

PROVENANCE = "Original FlowTask artwork generated specifically for this project with OpenAI image generation; not sourced from stock or copied product imagery."
CREATOR = "FlowTask / OpenAI image generation"
LICENSE = "Original AI-generated artwork; FlowTask project use"

def source_path(item):
    staged = ROOT / "tmp/workspace-art-originals" / item["category"] / f'{item["slug"]}.png'
    master = ROOT / item["path"]
    return staged if staged.exists() else master

def package():
    counts = {category: sum(1 for item in ASSETS if item[0] == category) for category in CATEGORY_LABELS}
    if len(ASSETS) != 36 or any(count != 6 for count in counts.values()):
        raise ValueError(f"Workspace library must contain six scenes in each of six collections; found {counts}.")
    OUT.mkdir(parents=True, exist_ok=True)
    catalog, manifest = [], []
    previous_catalog = {}
    previous_sources = {}
    catalog_path = OUT.parent / "catalog.json"
    if catalog_path.exists():
        previous_catalog = {item["id"]: item for item in json.loads(catalog_path.read_text(encoding="utf-8")).get("assets", [])}
    if MANIFEST.exists():
        previous_sources = {item["id"]: item for item in json.loads(MANIFEST.read_text(encoding="utf-8"))}
    for category, slug, title, contexts, moods, alt, focal, art_direction in ASSETS:
        asset_id = f"ws-{slug}"
        prefix = f"/media/workspace/v1/{asset_id}"
        master = OUT / f"{asset_id}.webp"
        source = source_path({"category": category, "slug": slug, "path": f"public/media/workspace/v1/{asset_id}.webp"})
        image = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
        image.thumbnail((2560, 2560), Image.Resampling.LANCZOS)
        width, height = image.size
        thumb_path = OUT / f"{asset_id}-thumb.webp"
        small_path = OUT / f"{asset_id}-960.webp"
        if source.resolve() != master.resolve():
            image.save(master, "WEBP", quality=88, method=4)
        thumb = image.copy(); thumb.thumbnail((400, 225), Image.Resampling.LANCZOS)
        if source.resolve() != master.resolve() or not thumb_path.exists():
            thumb.save(thumb_path, "WEBP", quality=78, method=4)
        small = image.copy(); small.thumbnail((960, 540), Image.Resampling.LANCZOS)
        if source.resolve() != master.resolve() or not small_path.exists():
            small.save(small_path, "WEBP", quality=84, method=4)
        bytes_on_disk = master.stat().st_size
        catalog.append({
            "id": asset_id, "title": title, "category": category,
            "src": prefix + ".webp", "thumbnail": prefix + "-thumb.webp",
            "variants": [{"src": prefix + "-960.webp", "width": small.width, "height": small.height}, {"src": prefix + ".webp", "width": width, "height": height}],
            "width": width, "height": height, "kind": "image", "bytes": bytes_on_disk,
            "license": LICENSE, "creator": CREATOR, "verifiedAt": "2026-10-18",
            "visualStyle": "flowtask-original",
            "provenance": PROVENANCE, "contexts": contexts, "moods": moods, "altText": alt,
            "focalPoint": {"x": focal[0], "y": focal[1]},
        })
        manifest.append({
            "id": asset_id, "title": title, "category": category,
            "contexts": contexts, "moods": moods, "altText": alt,
            "focalPoint": {"x": focal[0], "y": focal[1]},
            "artDirection": art_direction, "path": f"public/media/workspace/v1/{asset_id}.webp",
            "creator": CREATOR, "license": LICENSE, "provenance": PROVENANCE,
            "visualStyle": "flowtask-original",
        })

    open_assets = json.loads(OPEN_ASSETS_FILE.read_text(encoding="utf-8"))
    counts = {style: sum(1 for item in open_assets if item["visualStyle"] == style) for style in STYLE_LABELS if style != "flowtask-original"}
    if len(open_assets) != 36 or any(count != 6 for count in counts.values()):
        raise ValueError(f"Expected six downloaded covers in each new visual style; found {counts}.")
    for item in open_assets:
        required = ("id", "title", "category", "visualStyle", "creator", "license", "sourceUrl", "verifiedAt", "sourceSha256", "sourceFile")
        missing = [field for field in required if not item.get(field)]
        if missing:
            raise ValueError(f"{item.get('id', 'Unknown asset')} is missing required provenance fields: {', '.join(missing)}")
        if item["license"] not in {"CC0", "Public domain", "CC BY 4.0"}:
            raise ValueError(f"Unsupported license in workspace source ledger for {item['id']}: {item['license']}")
        if item["license"] == "CC BY 4.0" and not item.get("licenseUrl"):
            raise ValueError(f"CC BY asset has no license URL: {item['id']}")
        if len(item["sourceSha256"]) != 64:
            raise ValueError(f"Invalid SHA-256 in workspace source ledger for {item['id']}")
        asset_id = item["id"]
        prefix = f"/media/workspace/v1/{asset_id}"
        master = OUT / f"{asset_id}.webp"
        downloaded = OPEN_ASSETS_CACHE / item["sourceFile"]
        if not downloaded.is_file():
            # Packaged WebP files remain the reproducible fallback after source review/download.
            downloaded = master
        if not downloaded.is_file():
            raise FileNotFoundError(f"Missing downloaded source and packaged fallback for {asset_id}: {downloaded}")
        if downloaded != master and hashlib.sha256(downloaded.read_bytes()).hexdigest() != item["sourceSha256"]:
            raise ValueError(f"Downloaded source hash does not match the reviewed ledger for {asset_id}.")
        previous = previous_catalog.get(asset_id)
        previous_source = previous_sources.get(asset_id, {})
        thumb_path = OUT / f"{asset_id}-thumb.webp"
        small_path = OUT / f"{asset_id}-960.webp"
        can_reuse = (
            previous and previous_source.get("sourceSha256") == item["sourceSha256"]
            and master.is_file() and thumb_path.is_file() and small_path.is_file()
        )
        if can_reuse:
            width, height = previous["width"], previous["height"]
            small_width, small_height = previous["variants"][0]["width"], previous["variants"][0]["height"]
        else:
            image = ImageOps.exif_transpose(Image.open(downloaded)).convert("RGB")
            image.thumbnail((2560, 2560), Image.Resampling.LANCZOS)
            width, height = image.size
            if downloaded.resolve() != master.resolve():
                image.save(master, "WEBP", quality=88, method=4)
            thumb = image.copy(); thumb.thumbnail((400, 225), Image.Resampling.LANCZOS)
            thumb.save(thumb_path, "WEBP", quality=78, method=4)
            small = image.copy(); small.thumbnail((960, 540), Image.Resampling.LANCZOS)
            small.save(small_path, "WEBP", quality=84, method=4)
            small_width, small_height = small.size
        bytes_on_disk = master.stat().st_size
        catalog.append({
            "id": asset_id, "title": item["title"], "category": item["category"],
            "src": prefix + ".webp", "thumbnail": prefix + "-thumb.webp",
            "variants": [{"src": prefix + "-960.webp", "width": small_width, "height": small_height}, {"src": prefix + ".webp", "width": width, "height": height}],
            "width": width, "height": height, "kind": "image", "bytes": bytes_on_disk,
            "license": item["license"], "licenseUrl": item.get("licenseUrl"), "creator": item["creator"],
            "attribution": item.get("attribution"),
            "sourceSha256": item["sourceSha256"],
            "sourceUrl": item["sourceUrl"], "verifiedAt": item["verifiedAt"],
            "visualStyle": item["visualStyle"], "provenance": item["provenance"],
            "contexts": item["contexts"], "moods": item["moods"], "altText": item["altText"],
            "focalPoint": item["focalPoint"],
        })
        manifest.append({**item, "path": f"public/media/workspace/v1/{asset_id}.webp", "thumbnail": f"public/media/workspace/v1/{asset_id}-thumb.webp", "responsive": f"public/media/workspace/v1/{asset_id}-960.webp", "packagedBytes": bytes_on_disk})

    (OUT.parent / "catalog.json").write_text(json.dumps({"version": 2, "assets": catalog}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_contact_sheets(catalog)
    write_credits(open_assets)
    total = sum(asset["bytes"] for asset in catalog)
    print(f"Packaged {len(catalog)} workspace covers; {total / 1024 / 1024:.2f} MiB of primary WebP images")

def contact_sheet(catalog, title, subtitle, group_key, group_order, path):
    cell_w, image_h, caption_h, gap, header_h = 248, 136, 58, 12, 94
    cell_h = image_h + caption_h
    by_group = {key: [item for item in catalog if item.get(group_key) == key] for key in group_order}
    row_count = max((len(items) for items in by_group.values()), default=1)
    canvas = Image.new("RGB", (len(group_order) * (cell_w + gap) + gap, row_count * (cell_h + gap) + header_h), "#f3f0e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((gap, 13), title, fill="#25312d")
    draw.text((gap, 39), subtitle, fill="#68726c")
    for col, key in enumerate(group_order):
        x = gap + col * (cell_w + gap)
        label = CATEGORY_LABELS.get(key, STYLE_LABELS.get(key, key))
        draw.text((x, header_h - 20), label, fill="#39463f")
        for row, item in enumerate(by_group[key]):
            y = header_h + row * (cell_h + gap)
            with Image.open(ROOT / "public" / item["thumbnail"].lstrip("/")) as thumbnail:
                thumbnail = ImageOps.fit(thumbnail.convert("RGB"), (cell_w, image_h), method=Image.Resampling.LANCZOS, centering=(item.get("focalPoint", {}).get("x", 50) / 100, item.get("focalPoint", {}).get("y", 50) / 100))
                canvas.paste(thumbnail, (x, y))
            draw.rectangle((x, y + image_h, x + cell_w, y + cell_h), fill="#fffdf8")
            draw.text((x + 7, y + image_h + 4), item["title"][:34], fill="#303b35")
            detail = f"{CATEGORY_LABELS.get(item['category'], item['category'])} · {STYLE_LABELS.get(item.get('visualStyle', ''), item.get('visualStyle', ''))}"
            draw.text((x + 7, y + image_h + 25), detail[:43], fill="#68726c")
    canvas.save(ROOT / path, "WEBP", quality=86, method=4)

def write_contact_sheets(catalog):
    categories = list(CATEGORY_LABELS)
    styles = ["nature", "architecture", "space", "illustration", "abstract", "macro"]
    added = [item for item in catalog if item.get("visualStyle") in styles]
    contact_sheet(added, "FLOWTASK · 36 NEW OPEN-LICENSED COVERS", "Six visual genres · each image includes its use-case category and style", "visualStyle", styles, "docs/media-workspace-genres-contact-sheet.webp")
    write_combined_contact_sheet(catalog, categories, styles)

def write_combined_contact_sheet(catalog, categories, styles):
    cell_w, image_h, caption_h, gap, header_h = 248, 136, 58, 12, 108
    cell_h = image_h + caption_h
    section_gap = 65
    new_assets_y = header_h + 6 * (cell_h + gap) + section_gap
    canvas_h = new_assets_y + 6 * (cell_h + gap) + gap
    canvas = Image.new("RGB", (len(categories) * (cell_w + gap) + gap, canvas_h), "#f3f0e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((gap, 12), "FLOWTASK · WORKSPACE VISUAL LIBRARY", fill="#25312d")
    draw.text((gap, 37), "72 covers · title, use-case category and visual genre", fill="#68726c")
    draw.text((gap, 73), "36 FLOWTASK ORIGINALS · organized by use case", fill="#39463f")
    draw.text((gap, new_assets_y - 40), "36 OPEN-LICENSED ADDITIONS · organized by visual genre", fill="#39463f")
    original_assets = [item for item in catalog if item.get("visualStyle") == "flowtask-original"]
    new_assets = [item for item in catalog if item.get("visualStyle") in styles]
    groups = [(original_assets, "category", categories, header_h), (new_assets, "visualStyle", styles, new_assets_y)]
    for assets, group_key, group_order, top in groups:
        by_group = {key: [item for item in assets if item.get(group_key) == key] for key in group_order}
        for col, key in enumerate(group_order):
            x = gap + col * (cell_w + gap)
            draw.text((x, top - 19), CATEGORY_LABELS.get(key, STYLE_LABELS.get(key, key)), fill="#39463f")
            for row, item in enumerate(by_group[key]):
                y = top + row * (cell_h + gap)
                with Image.open(ROOT / "public" / item["thumbnail"].lstrip("/")) as thumbnail:
                    focal = item.get("focalPoint", {})
                    thumbnail = ImageOps.fit(thumbnail.convert("RGB"), (cell_w, image_h), method=Image.Resampling.LANCZOS, centering=(focal.get("x", 50) / 100, focal.get("y", 50) / 100))
                    canvas.paste(thumbnail, (x, y))
                draw.rectangle((x, y + image_h, x + cell_w, y + cell_h), fill="#fffdf8")
                draw.text((x + 7, y + image_h + 4), item["title"][:34], fill="#303b35")
                detail = f"{CATEGORY_LABELS.get(item['category'], item['category'])} · {STYLE_LABELS.get(item.get('visualStyle', ''), item.get('visualStyle', ''))}"
                draw.text((x + 7, y + image_h + 25), detail[:43], fill="#68726c")
    canvas.save(ROOT / "docs/media-workspace-contact-sheet.webp", "WEBP", quality=86, method=4)

def write_credits(open_assets):
    lines = ["# Workspace visual credits & licenses", "", "These covers are bundled as optimized, self-hosted WebP derivatives. Each open-license source is linked to its original file page. Images may be resized, cropped, and converted to WebP for FlowTask. Personal uploads remain local to the user's device.", ""]
    for style in ["nature", "architecture", "space", "illustration", "abstract", "macro"]:
        lines.extend([f"## {STYLE_LABELS[style]}", ""])
        for item in [asset for asset in open_assets if asset["visualStyle"] == style]:
            creator = item["creator"]
            attribution = item.get("attribution")
            license_text = item["license"]
            if item.get("licenseUrl"):
                license_text = f"[{license_text}]({item['licenseUrl'].replace('http://', 'https://')})"
            source = f"[Source file page]({item['sourceUrl']})"
            required_credit = f" Required attribution: {attribution}." if attribution else ""
            lines.append(f"- **{item['title']}** — {creator} — {license_text}. {source}.{required_credit} Adapted by resizing/cropping and WebP conversion.")
        lines.append("")
    PUBLIC_CREDITS.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_CREDITS.write_text("\n".join(lines), encoding="utf-8")

if __name__ == "__main__":
    package()
