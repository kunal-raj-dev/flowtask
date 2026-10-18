# FlowTask 2.0 beta implementation

Version: `2.0.0-beta.1` · 16 October 2026 (V3 workspace updates in progress)

The existing React/TypeScript/Vite/Zustand/IndexedDB/Firebase application now includes a full-window Focus Studio, a Ribbon F identity and a local-first media library. The landing-first public introduction is at `/` (and `/welcome`); the workspace planner lives at `/app`. Existing view and snapshot deep links remain fully supported.

## Verification result

| Check | Result |
| --- | --- |
| Unit/component tests | 402 passed across 66 files |
| Production build / TypeScript | Passed |
| Existing Chromium accessibility/settings checks | 12 passed |
| Focus Studio journeys | Seven passed in Chrome and seven in WebKit |
| Edge focus/resume/mobile/break checks | Three passed |
| Production offline pack | Chromium passed, including decoded background and advancing recorded-audio playback after offline reload |
| API/proxy security checks | Six passed |
| Firestore emulator rule checks | Five passed |
| Media technical/provenance QA | 48 stills, six silent videos, twelve ambients and eighteen distinct music tracks verified |
| Production dependency audit | Zero reported vulnerabilities |
| Lint | Exits successfully; nonblocking React hook/refresh/style warnings remain |

Selected Studio and welcome-page accessibility scans include contrast and report no serious/critical findings. Existing view audits cover selected accessibility flows, with some legacy contrast checks disabled; this is not a whole-product accessibility certification. Firefox and physical Safari/Android verification remain open as described below.

## Delivered

- Pomodoro, countdown, open-ended work and access to structured study sprints; durable phase/cycle/configuration, pause/resume, next-action context, task queues, scratchpad capture, reflection, five-minute continuation, clear mode, mini-player and supported Document Picture-in-Picture.
- Separate focus, break and paused-time accounting. The runtime finishes bounded sessions independently of modal visibility, caps elapsed time after sleep, and logs once by session ID. Manual next-phase start is the default.
- Six starter recipes; custom recipes, duplication, updates, favorites and validated JSON sharing. Today has recipe launch shortcuts. Shared recipes exclude personal media and task content.
- 48 original generated stills, eight collections with six each, plus six silent atmospheric motion scenes. WebP delivery includes native masters, 960px variants and thumbnails. Personal image imports have focal position, brightness, blur and readability controls. Motion respects reduced-motion/data-saving choices.
- Twelve recorded ambient layers, three offline noise generators, eighteen instrumental tracks across six genres, per-channel/master gains, four-layer limit, music sequencing, mute/solo and fades. Volume changes preserve sources; pausing preserves music position. Binaural audio is explicitly experimental.
- Eighteen planner themes, compact density, accent, system appearance, contrast/reduced-motion controls and opt-in typing sounds. The logo kit includes SVG masters, wordmarks, monochrome, PWA/maskable icons and social art.
- Guided daily capacity planning; optional keyboard inbox triage; auto-slot preview, undo and locked blocks; seven-day workload; project outcomes/date/cover/recipe/WIP; exam/DSA templates and study continuation; task next actions/history; focus/break/project review breakdown.
- Searchable settings groups, student/developer onboarding, complete workspace export/restore, local feedback reports, opt-in device-local diagnostics, privacy information and credits.
- The current workspace schema is v7, with repeat-safe migrations that preserve a pre-migration backup. IndexedDB v2 adds personal media. Finished logs, recipes and safe preferences sync as individual revision-aware records through the existing durable outbox. Large imports are split into bounded cloud transactions while retaining one local undo. V3 adds optional project milestones and task links; old projects remain valid without milestones.
- Explicit collection Firestore rules, a restricted private ICS worker, safer recurrence/local-day handling, an authenticated re-authentication-gated deletion endpoint and session-safe PWA updates.

## Ownership and media delivery

One tab owns a workspace through Web Locks; another tab waits until that owner closes. The app-level audio controller also holds an ownership lock. This deliberately avoids concurrent local writers and duplicate playback/history. The timer is device-local; finished history syncs. Small synchronous workspace-scoped lifecycle checkpoints recover immediate pause/finish reloads before the IndexedDB queue drains. Replayed finished checkpoints are checked against log IDs, preventing duplicate accounting. Reloaded browser audio requires a fresh playback gesture where autoplay policy blocks it.

Custom blobs stay in the workspace-scoped `media` store. JSON backups exclude those blobs; individual file export is available in Studio. Missing personal references show a clear message and allow a built-in replacement. Personal storage is limited to 250 MB; uploads are limited to 20 MB/image and 50 MB/audio. Download cleanup affects the curated cache, not tasks or personal uploads.

The optional offline starter pack contains eight stills, four recorded ambients and two tracks. Full libraries are lazy assets, excluded from mandatory PWA precaching. Background delivery is approximately 22.49 MiB; all audio codecs together approximately 56.45 MB.

Artwork is original AI-generated work, not stock photography. Native still dimensions are 1672×940/941. Motion scenes animate this artwork procedurally; they are not recorded footage. Audio contains 26 CC0 works, three CC BY 3.0 works and one CC BY 4.0 work. See the individual source, creator, license, edit and verification records:

- [Artwork credits](../public/media/CREDITS.md)
- [Audio credits](../public/media/audio/CREDITS.md)
- [Audio review instructions](audio-qa.md)
- [Brand kit](../public/brand/README.md)

## Run and verify

```sh
npm install
npm run dev -- --port 5174
npm run build
npm test
npm run lint
npm run test:security
npx playwright test e2e/focusStudioV2.spec.ts --project=chromium
```

For production/offline checks, first build and run `npm run preview -- --port 5176`, then set `FLOWTASK_E2E_URL=http://localhost:5176` and run `e2e/studioOfflineV2.spec.ts`. Firefox/WebKit projects are configured; install their browser binaries with `npx playwright install firefox webkit`. Run against a stable build, without modifying source during the test.

`npm run test:rules` expects a **local, disposable** Firestore emulator at `127.0.0.1:8088`, project `demo-flowtask`. The tests upload `firestore.rules`, clear only that emulator and exercise owner isolation, invalid writes, new collections, idempotency receipts and deletion barriers. They do not connect to production. The verification run used the official Firestore emulator v1.19.8 with Java 17. Newer Firebase CLI/emulator releases may require Java 21; see [Firebase setup](https://firebase.google.com/docs/emulator-suite/install_and_configure).

Media verification scripts require Python with Pillow/imageio-ffmpeg/numpy/soundfile:

```sh
python scripts/media-background-qa.py
python scripts/audio-build.py --verify
```

## Deployment configuration

The client needs the existing `VITE_FIREBASE_*` configuration for optional account/sync. Server-only account deletion needs `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` and exact `APP_ORIGIN`. Keep admin credentials out of all `VITE_*` variables. The Vercel function is `POST /api/account/delete`; local Vite alone does not run this function.

Deploy the explicit Firestore rules together with the client. Enable a TTL policy on the user root `expiresAt` field to remove anonymous deletion barriers after all previously issued tokens expire. A partial deletion keeps the write barrier and leaves authentication available for retry until cloud cleanup succeeds.

Deploy `workers/calendar-proxy.js` with exact `ALLOWED_ORIGINS` and an explicit `CALENDAR_HOSTS` allowlist. Set `VITE_CALENDAR_PROXY_URL` to this private worker. URLs travel in POST bodies; redirects, non-HTTPS targets, credentials, arbitrary hosts and oversized feeds are rejected. The public CORS proxy fallback was removed.

Set absolute deployed URLs for `og:image`/`twitter:image` and verify social cards on the final domain. The live V2 production build was verified against the local release commit during the prior release. V3 workspace changes in the current checkout have not been deployed; verify the published build identity before claiming they are available on the public site.

## Release gates still requiring people or production access

- Test real accounts across devices, account switching, live cloud retry and account deletion with the deployed rules/function. Local emulator and handler tests do not certify a production Firebase configuration.
- Complete headphone listening of all tracks/loop seams and mixed playback. Technical decoding, waveform/seam processing and provenance checks are complete; subjective listening approval is separate.
- Verify current Firefox on a working runner, physical iOS Safari/Android Chrome, screen readers and touch behavior. The Windows Firefox test browser encountered a graphics/page setup failure before application verification. WebKit automation is an engine check, not physical Safari certification. Windows WebKit offline navigation is marked `fixme` because its observed internal navigation error matches [Playwright issue #42775](https://github.com/microsoft/playwright/issues/42775); Chromium offline reload passed, while physical Safari offline verification remains pending.
- Run student/developer usability sessions for the three-minute first-session target and the two-action return path. Automated journeys verify functionality; they do not replace human usability measurements.
- Measure LCP/INP/CLS at mobile/desktop field p75 after deployment. No field-performance or public-beta retention claims are made. Diagnostics are off by default, device-local counts only, and can be exported explicitly; no analytics service receives user data.

Google Calendar two-way sync, real AI, website blocking, GitHub capture and personal-media cloud sync remain the approved 2.1 backlog.
