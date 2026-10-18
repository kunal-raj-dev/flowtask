"""Build the curated FlowTask workspace cover library as responsive WebP files."""
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/media/workspace/v1"
MANIFEST = ROOT / "docs/media-workspace-sources.json"

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
    for category, slug, title, contexts, moods, alt, focal, art_direction in ASSETS:
        asset_id = f"ws-{slug}"
        prefix = f"/media/workspace/v1/{asset_id}"
        master = OUT / f"{asset_id}.webp"
        source = source_path({"category": category, "slug": slug, "path": f"public/media/workspace/v1/{asset_id}.webp"})
        image = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
        width, height = image.size
        if source.resolve() != master.resolve():
            image.save(master, "WEBP", quality=88, method=6)
        thumb = image.copy(); thumb.thumbnail((400, 225), Image.Resampling.LANCZOS)
        thumb.save(OUT / f"{asset_id}-thumb.webp", "WEBP", quality=78, method=6)
        small = image.copy(); small.thumbnail((960, 540), Image.Resampling.LANCZOS)
        small.save(OUT / f"{asset_id}-960.webp", "WEBP", quality=84, method=6)
        bytes_on_disk = master.stat().st_size
        catalog.append({
            "id": asset_id, "title": title, "category": category,
            "src": prefix + ".webp", "thumbnail": prefix + "-thumb.webp",
            "variants": [{"src": prefix + "-960.webp", "width": small.width, "height": small.height}, {"src": prefix + ".webp", "width": width, "height": height}],
            "width": width, "height": height, "kind": "image", "bytes": bytes_on_disk,
            "license": LICENSE, "creator": CREATOR, "verifiedAt": "2026-10-18",
            "provenance": PROVENANCE, "contexts": contexts, "moods": moods, "altText": alt,
            "focalPoint": {"x": focal[0], "y": focal[1]},
        })
        manifest.append({
            "id": asset_id, "title": title, "category": category,
            "contexts": contexts, "moods": moods, "altText": alt,
            "focalPoint": {"x": focal[0], "y": focal[1]},
            "artDirection": art_direction, "path": f"public/media/workspace/v1/{asset_id}.webp",
            "creator": CREATOR, "license": LICENSE, "provenance": PROVENANCE,
        })
    (OUT.parent / "catalog.json").write_text(json.dumps({"version": 1, "assets": catalog}, indent=2) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_contact_sheet(catalog)
    total = sum(asset["bytes"] for asset in catalog)
    print(f"Packaged {len(catalog)} workspace originals; {total / 1024 / 1024:.2f} MiB of primary WebP images")

def write_contact_sheet(catalog):
    categories = list(CATEGORY_LABELS)
    cell_w, cell_h, gap, header_h = 250, 175, 12, 82
    canvas = Image.new("RGB", (len(categories) * (cell_w + gap) + gap, 6 * (cell_h + gap) + header_h), "#f3f0e8")
    draw = ImageDraw.Draw(canvas)
    draw.text((gap, 18), "FLOWTASK · WORKSPACE VISUAL LIBRARY", fill="#25312d")
    draw.text((gap, 42), "36 original covers · six curated collections · WebP delivery", fill="#68726c")
    by_category = {category: [item for item in catalog if item["category"] == category] for category in categories}
    for col, category in enumerate(categories):
        x = gap + col * (cell_w + gap)
        draw.text((x, header_h - 22), CATEGORY_LABELS[category], fill="#39463f")
        for row, item in enumerate(by_category[category]):
            y = header_h + row * (cell_h + gap)
            with Image.open(ROOT / "public" / item["thumbnail"].lstrip("/")) as thumbnail:
                thumbnail = thumbnail.convert("RGB").resize((cell_w, 141), Image.Resampling.LANCZOS)
                canvas.paste(thumbnail, (x, y))
            draw.rectangle((x, y + 141, x + cell_w, y + cell_h), fill="#fffdf8")
            draw.text((x + 8, y + 149), item["title"][:32], fill="#303b35")
    canvas.save(ROOT / "docs/media-workspace-contact-sheet.webp", "WEBP", quality=86, method=6)

if __name__ == "__main__":
    package()
