# FlowTask

FlowTask is a local-first day planner for students and developers. Plan a realistic day, connect a task to a focus session, and review what you completed. The app includes an optional account and cloud sync; without an account, workspace data stays in this browser profile. Browser storage can be cleared or evicted, so download a JSON backup regularly.

The public landing page is `/` (also `/welcome`). Continue to the planner at `/app`. Existing links such as `/?view=today` continue to open their requested workspace view. The workspace includes Daily Desk, projects, milestones, planning, notes, study tools, review, Focus Studio, and 18 complete appearance themes. Focus media is loaded as needed; personal image and audio files stay on this device and are excluded from JSON backups.

See [V2 beta implementation and verification](docs/FLOWTASK_2_BETA.md) and [V3 product notes](docs/FLOWTASK_V3.md) for current behavior, limitations, and release status.

## Run locally

Requires Node.js 22 and npm.

```sh
npm install
npm run dev
```

Open `http://localhost:5173/` for the landing page or `http://localhost:5173/app` for the planner.

## Verify changes

```sh
npm test
npm run lint
npm run build
npm run test:security
npm run test:rules
```

`npm run test:rules` uses a disposable local Firestore emulator at `127.0.0.1:8088`; it does not test production rules. Browser tests run with `npm run test:e2e` after installing the configured Playwright browsers.

## Stack

React 19, TypeScript, Vite, Zustand, IndexedDB, Firebase (optional account and sync), and Vitest/Playwright. The app works offline for previously loaded code and locally available data; the full media library is not precached by default.

## Data and privacy

Local-first storage is not a guaranteed backup. JSON exports include supported workspace data, preferences, dashboards, and project milestones, but omit personal media files and active timer checkpoints. Optional diagnostics are off by default. Calendar feed URLs and task content are not sent as diagnostics. See Settings → Privacy and Settings → Data for account sync, storage estimates, export, restore, and media details.
