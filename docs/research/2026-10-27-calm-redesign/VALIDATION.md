# Local validation — 27 October 2026

## Passing checks

- `npm run lint` — passed.
- `npm run build` — passed, including TypeScript. No deployment was performed.
- Targeted Vitest suite — **106 tests across 9 files passed**: Today composition, Horizon Today, desktop header, Studio, view container, onboarding, appearance, Studio appearance, and production-readiness/recovery tests.
- Studio browser suite — **12 tests passed** in Chromium. This includes lobby and active-session geometry at 1920×1080, 1536×864, 1366×768, 1280×720, 1024×768, 390×844, 360×640, and 844×390; a three-hour timer on a small phone; opacity preview/persistence; all eight Studio palettes with accessibility checks; and floating timer background, independent theme, and Space-key controls.
- Workspace browser suite — **3 tests passed**, each opening all 22 workspace sections at 320px, 390px, and 1440px, checking headings and horizontal overflow. This represents 66 route/viewport combinations.

The Studio tests ran as an 11-test presentation run and a separate floating-timer run. The existing floating-timer assertions were updated to its current accessible names, “Pause focus session” and “Resume focus session”; visible-control geometry excludes preparation controls that are intentionally hidden. The keyboard scenario focuses a noninteractive corner so its setup cannot accidentally toggle playback.

## Manual browser verification

Used a separate local origin, `http://localhost:5175`, for sample data. The user's existing workspace at `http://localhost:5173` was not populated with test tasks.

Verified task capture, parsed P2/~20m details, project assignment, reload persistence, Top 3 pinning, completion, Studio entry, room selection, independent Warm Linen palette, task-linked session start, pause, return to the desk, session reopening, completion, reflection dismissal, and the prepared lobby. Screenshots in `evidence/` are from this isolated example workspace, except for the explicitly named before images.

## Bugs corrected during verification

1. Today capture helpers inserted `#p1` and `25m`, while the parser expects `p1` and `~25m`. Helpers now insert recognized syntax. Metadata-only input cannot create an accidental task. Component tests cover both behaviors.
2. Recovery snapshots rejected schema 9 even though the existing backup writer emits schema 9 for scheduled work blocks. The reader/writer compatibility guard now accepts the current schema, with a save/read regression test. This removes a false checkpoint-failure warning that could obscure mobile Studio controls when scheduled work was present.
3. Phone task rows could leave very little title width when a timer and actions were present. Actions now occupy their own row and titles wrap.

## Outstanding performance gate

`npm run test:budgets` does **not** pass. Its current measured values are:

| Metric | Measured gzip bytes | Limit | Result |
| --- | ---: | ---: | --- |
| Landing JS | 153,384 | 184,320 | Pass |
| Planner JS | 344,312 | 409,600 | Pass |
| Landing CSS | 30,631 | 35,840 | Pass |
| Planner CSS | 39,011 | 35,840 | Fail: 3,171 bytes / 3.10 KiB over |

The size gate was not relaxed. The script stops at this CSS assertion, so later budget assertions are not confirmed by this run. CSS consolidation remains a performance follow-up; this result does not affect the successful production compilation or the passing interaction/layout checks.

No full cloud acceptance, Firestore emulator suite, real-device browser test, production deployment, or security release certification is claimed. This is a verified local interface redesign, with the stylesheet-size limitation recorded explicitly.
