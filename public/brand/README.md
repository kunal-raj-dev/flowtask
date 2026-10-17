# FlowTask 2.0 brand kit

The **Flow Ribbon F** is a continuous, forward-leaning silhouette. Its raised upper terminal suggests forward movement; the open counter and middle arm keep the F recognizable at small sizes.

## Files

- `mark.svg`: amber vector master on a transparent background.
- `mark-black.svg`, `mark-white.svg`: flat monochrome masters.
- `icon.svg`: amber mark on the charcoal rounded tile, matching the React component and favicon.
- `wordmark.svg`: horizontal primary lockup; monochrome variants are supplied alongside it.
- `icon-192.png`, `icon-512.png`: general PWA icons with a transparent outer corner.
- `icon-maskable-192.png`, `icon-maskable-512.png`, `icon-maskable.svg`: opaque, full-bleed maskable icons. The mark sits entirely within the central safe area.
- `apple-touch-icon.png`: opaque 180px iOS home-screen icon.
- `social-preview.svg`, `social-preview.png`: editable and ready-to-share 1200 × 630 social card.

## Colors and typography

| Token | Value | Use |
| --- | --- | --- |
| Charcoal | `#23211E` | Tile, primary wordmark |
| Amber | `#F5A623` | Primary brand accent |
| Light amber | `#F9CC72` | Ribbon highlight |
| Deep amber | `#E18A16` | Ribbon end |
| Warm ivory | `#F8F5EE` | Light brand background |

Use **Plus Jakarta Sans** for the product wordmark and interface. The editable SVG wordmarks reference this font with a Segoe UI / sans-serif fallback; export with Plus Jakarta Sans installed for exact typography. Timer numerals should use tabular figures.

## Usage

Keep at least one ribbon-stem width of clear space around a standalone mark. Use the tile at 16px or larger; use the full wordmark at 120px or larger. Preserve proportions and the open F counter. Use a monochrome master where gradients cannot reproduce reliably. Do not add a persistent glow, pulse, rotation, or decorative badge.

The default tagline is **Plan your day. Enter your flow.** The React `BrandLogo` retains its `size`, `className`, `showWordmark`, and `subtitle` props. An empty subtitle hides the tagline.

Use general icons with `purpose: any` and the dedicated full-bleed icons with `purpose: maskable`; do not interchange them. App URLs and manifest shortcuts are unchanged. Social image metadata currently uses `/brand/social-preview.png`; set the absolute production image URL when the public origin is finalized, because some external link scrapers require an absolute URL.

## Provenance and verification

All shapes and brand artwork were authored specifically for FlowTask on 2026-10-16. No stock images, third-party logos, recognizable characters, or image-generation outputs are included. The SVG masters are the source of truth; PNGs are exports from those SVGs. System fonts are referenced, not redistributed.

The icon and social card were rendered and visually inspected. The ribbon silhouette remains recognizable at 16px; the maskable version keeps the mark in the central 80% safe circle. Wordmark and icon accessibility behavior are covered by the component tests.
