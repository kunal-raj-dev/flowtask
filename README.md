# FlowTask

FlowTask is a local-first planner for personal life and work. Plan a realistic day, connect a task to a focus session, and review what you completed. The app includes an optional account and cloud sync; without an account, workspace data stays in this browser profile. Browser storage can be cleared or evicted, so download a JSON backup regularly.

Start with one task in the optional inline introduction, then choose a 25-minute focus session or keep planning. Student/developer presets, work budgets, and appearance are available later in Settings. Today keeps task capture near the top and resumes existing focus sessions. Automatic scheduling uses the time left in the selected day and previews changes before applying them.

The public landing page is `/` (also `/welcome`). Continue to the planner at `/app`. Existing links such as `/?view=today` continue to open their requested workspace view. The workspace includes Daily Desk, projects, milestones, planning, notes, study tools, review, Focus Studio, and 18 complete appearance themes. Focus media is loaded as needed; personal image and audio files stay on this device and are excluded from JSON backups.

See [V2 beta implementation and verification](docs/FLOWTASK_2_BETA.md) and [V3 product notes](docs/FLOWTASK_V3.md) for current behavior, limitations, and release status.

The first competitive-upgrade milestone adds a searchable Notes library, project context, daily notes, linked tasks, backlinks, Markdown import/export and recent version recovery. Notes use the existing local save and optional account-sync pipeline. Scratchpad import stays explicit. See [Connected Notes behavior, limits and deployment requirements](docs/CONNECTED_NOTES.md); updated Firestore rules must precede the upgraded frontend.

The current production-readiness candidate adds account-scoped recovery, explicit device import, safer cloud delivery, single-writer tabs, headless focus and a focused visual redesign. See the [acceptance matrix, deployment configuration, recovery and incident runbook](docs/PRODUCTION_READINESS.md). Live cloud/device checks and the monitored beta remain required before broad release.

For interrupted work, the [implementation checkpoint](docs/IMPLEMENTATION_STATUS.md) records milestone coverage, the latest fixes and the remaining release gates.

Today supports a full-area, theme-tinted background across both daily and modular views. The local Copilot offers editable task breakdowns, scheduling previews, task-linked focus and daily summaries. See [responsive workspace and Copilot behavior](docs/WORKSPACE_RESPONSIVE_COPILOT.md) for supported commands and verification details.

## Run locally

Requires Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173/` for the landing page or `http://localhost:5173/app` for the planner.

## Verify changes

```sh
npm run verify
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e:release
npm run test:performance
npm audit --omit=dev --audit-level=moderate
```

`verify` includes lint, TypeScript, unit/component tests, security tests, an automatically started disposable Firestore emulator, the production build and bundle budgets. The emulator uses `127.0.0.1:8088`; it does not test production rules. Release browser and performance checks use the production build. `npm run test:e2e` remains available for development-server checks.

The isolated hosted acceptance runner is `npm run test:cloud:staging`, with `FLOWTASK_STAGING_URL`, ignored staging client configuration and an authenticated Vercel CLI session (or `VERCEL_TOKEN`). It refuses production targets and creates/deletes only disposable acceptance accounts. Current deployment, verified journeys and remaining release dependencies are recorded in [staging setup](docs/STAGING_SETUP.md) and the [implementation checkpoint](docs/IMPLEMENTATION_STATUS.md).

## Stack

React 19, TypeScript, Vite, Zustand, IndexedDB, Firebase (optional account and sync), and Vitest/Playwright. The app works offline for previously loaded code and locally available data; the full media library is not precached by default.

## Data and privacy

Local-first storage is not a guaranteed backup. JSON exports include supported workspace data, preferences, dashboards, and project milestones, but omit personal media files and active timer checkpoints. Optional diagnostics are off by default. Calendar feed URLs and task content are not sent as diagnostics. See Settings → Privacy and Settings → Data for account sync, storage estimates, export, restore, and media details.

Settings → Calendar can import a local `.ics` file alongside an optional connected feed. Imported calendar contents stay on this device and are excluded from cloud sync and JSON backups. Importing another file replaces the previous import only after validation succeeds.

Set `APP_ORIGIN` to the actual public HTTPS origin when building a shared deployment so Open Graph, Twitter images, and canonical links are absolute. Vercel's production project hostname is used when available and no explicit origin is set. Local builds do not invent a public hostname.

See [final release polish and verification](docs/RELEASE_POLISH.md) for implemented changes and the remaining live-site/device checks before broad sharing.
