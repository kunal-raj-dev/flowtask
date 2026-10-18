# FlowTask — landing-first integration

Release review date: 18 October 2026 (Asia/Calcutta).

## User-visible behavior

- `/` and `/index.html` show the landing page. `/welcome` remains a landing alias.
- Every workspace CTA opens `/app`; the landing logo returns to `/`.
- New users complete the actual Student/Developer setup and create their own first task. Visiting the landing page or choosing Continue never injects sample tasks or marks setup complete.
- Returning users reopen their existing account/device workspace. No database, account or storage-key migration is introduced.
- The saved Default Start View applies on ordinary app entry. Explicit view links and shared snapshot destinations take precedence. The dashboard option opens Today, where the canvas lives.
- Legacy root view links, Quick Add shortcuts and snapshot links still open the planner. Consumed root shortcuts become `/app` URLs so refresh stays in the planner.
- Quick Add waits for hydration and blocking dialogs, including setup and Studio, then opens once and consumes its URL action.
- Landing and its shared feedback component join the shell/appearance precache. Service-worker updates require user action and do not force-reload active sessions.

## Integration fixes

- Connected the previously saved-only Default Start View preference and corrected its invalid standalone dashboard destination.
- Added accessible names to workspace start/dashboard selectors, the cover switch, auto-archive selector, Smart Natural Language Parsing and Keyboard Halo switches.
- Replaced fixed Saved badge colors with palette-aware text and an opaque surface.
- Updated browser journeys for canonical app entry, actual onboarding/local dates, pressed-state project pins and deliberate Studio scene selection. Tests wait for Studio dismissal before planner shortcuts.

## Validation

- **Unit test suite**: 631 passed across 93 files (`npm test`)
- **Linter**: 0 warnings, 0 errors on 321 files (`npm run lint` with oxlint)
- **Security test suite**: 6/6 passed (`npm run test:security`)
- **Production build**: passed (`tsc -b && vite build`) with 41 precached entries in PWA workbox
- **Playwright Chromium E2E**:
  - `entryFlow.spec.ts`: 11/11 passed (landing-first, setup, returning user, deep links, Quick Add deferred hydration, offline entry)
  - `auditRegression.spec.ts`: 17/17 passed (local calendar date before UTC midnight, export/restore, settings accessibility in light & dark, responsive viewports)
  - `diurnalAtmosphere.spec.ts`: 10/10 passed (all 18 themes token validation, schedule boundaries, high contrast, active Studio preservation, offline reload)
  - `focusStudioV2.spec.ts`: 7/7 passed
  - `workspaceV2.spec.ts`: 26/26 passed
  - `studioOfflineV2.spec.ts`: 1/1 passed
  - `aestheticsUnifiedSettings.spec.ts`: 2/2 passed
- **Cross-browser smoke checks**:
  - Microsoft Edge: Passed (root landing → setup → task-linked Studio)
  - WebKit (Safari): Passed (root landing → setup → task-linked Studio)

## Verification boundaries

Browser tests use a local production build and disposable browser contexts. Live Firebase account switching, real account deletion, production data changes and physical Safari/iOS certification are not performed. Windows WebKit offline service-worker navigation remains a browser-driver limitation; the WebKit smoke matrix covers online entry, appearance, shortcuts and active Focus sessions. No manual hosting deployment is performed.

## Reproduce

Run `npm test`, `npm run lint`, `npm run test:security` and `npm run build`. Start the production preview on port 5191. Set `FLOWTASK_E2E_URL` to that local server and `FLOWTASK_PRODUCTION` to `true`.

The Chromium verification covers entryFlow, diurnalAtmosphere, aestheticsUnifiedSettings, auditRegression, focusStudioV2, workspaceV2 and studioOfflineV2 specifications. Edge/WebKit smoke checks select entry, appearance, shortcut and active-session journeys from the entryFlow and diurnalAtmosphere specifications.

Test JSON, traces and screenshots are local ignored artifacts under `test-results/` and `screenshots/`. The committed palette comparison sheet is `docs/THEME_COMPARISON.html`.
