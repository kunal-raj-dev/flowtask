# Production-readiness implementation checkpoint

Updated: 22 October 2026. Workspace: `Flow-task`. Base revision: `3ec47e7`.

This checkpoint accompanies the implementation and verification evidence. Use `git log` and `git status` for the current source-publication state. The hosted checks below were collected against isolated, protected staging before publication to `main`; customer production had not been promoted or reconfigured during those checks. A push can trigger Git-linked hosting, so verify its resulting deployment separately. Publishing source does not waive the remaining release gates.

## Plan coverage

| Milestone | Implemented in this checkout | Remaining release evidence |
|---|---|---|
| 1. Engineering baseline | Node 22 pins, clean install, CI, lint/typecheck/unit/security, isolated rules emulator, production build/browser configuration, capability matrix | CI execution on the hosting repository |
| 2. Data and recovery | Graph-safe deletion/reassignment and Undo, boundary validation, schema-8 archive/migration, corruption recovery, full workspace-scoped durable checkpoints, retention of ten, legacy export | Staging migration/recovery rehearsal on representative exported workspaces |
| 3. Cloud/account safety | Explicit device import, isolated providers, durable outbox/receipts/backoff, conflict recovery, follower handover; real hosted account/offline/conflict/deletion journeys and App Check exchange verified; Google sign-in confirmed by the user | Physical-device/network journeys, monitored App Check enforcement, billed-environment TTL |
| 4. Functional workflows | Shared focus commands and headless completion, defaulted timers, timestamp recovery, shared capture validation, explicit scheduling preview/apply, capability fallbacks; hosted focus pause/reload/completion and one-log delivery verified | Physical sleep/wake, audio/PiP/mobile interruption and broader feature acceptance |
| 5. Visual redesign | Navigation/header hierarchy, capture-first Today, compact Plan, mobile panels, shared tokens, amber default, retained 18 themes, component-owned styles, reduced motion; compact backup banner verified at 320/390/768/1440px | Real screen readers, mobile keyboard/zoom/landscape, unfamiliar-user usability sessions |
| 6. Performance/offline | Granular row subscriptions, bounded large lists, route budgets including complete CSS graph, self-hosted fonts, hashed media, core offline precache, update deferral, measured capture lab | Field p75, physical offline/update checks, deployed old/new build compatibility drill |
| 7. Security/operations | Exact extension origins/acknowledgements/deduplication, rules/abuse controls, tightened CSP, opt-in content-free diagnostics, health route, privacy/help and incident/rollback runbook; protected staging/CSP/Auth/App Check exchange verified | App Check monitored enforcement, Worker binding, monitoring/budgets/retention/alert delivery, monitored beta |

Full interfaces, acceptance matrix, migration/recovery guidance and operational instructions: [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).

## Latest continuation work

The interrupted work had reached production-build verification. The resumed checks found and fixed:

- Offline tests silently using development semantics; production mode is now explicit. Direct `/app` installation also precaches the landing route so offline `/` opens correctly.
- CSS accounting that counted only the entry stylesheet. The corrected budget follows every static route import; secondary component styles now load with their components.
- Real Today contrast failures and a timeline scroll region without keyboard access.
- Suspense test synchronization and stale browser selectors after the navigation redesign.
- Cold first-capture delay caused by synchronous Web Audio initialization. A CPU profile attributed approximately 313ms to AudioContext creation. Optional global feedback now starts after the action paints and cancels on unmount.
- Capture typing rerendering the entire Today surface; capture state is now local. Existing natural-language parsing semantics are retained, with additional date regression coverage.
- Project hashtags resolving differently in inline and multiline capture. Both paths now resolve available project IDs/names through the same task command before validation.
- Calendar parsing loaded by the initial workspace bundle. The parser now loads only for an imported file or connected feed. Late calendar responses and imports validate their workspace; older selected-day requests cannot overwrite newer ones, and account changes immediately clear projected calendar events.
- Browser-dependent audio failure now explains that the timer continues silently. The browser suite separately tests unavailable audio and supported OS media controls.
- Hosted staging exposed a Firebase Admin / Vercel loader incompatibility before account-deletion handler execution. Admin stays on 14.5 with a scoped `jwks-rsa` 3.2.2 override; a real-handler import test disables synchronous `require(ESM)`. Production dependencies audit clean.
- Cloud preferences hydration/listening now use the same bounded allowed-ID query required by the deployed rules. The unrestricted read was denied even for an empty account. A rules regression checks the allowed query, unrestricted-query rejection and cross-account denial.
- Automatic appearance migration waits for account hydration. Creating a default preference before receiving an existing account preference caused an avoidable conflict on a new device; a component regression now reproduces that sequence.
- Initial/listener permission and configuration failures now show actionable paused status, distinct from transient offline failure. Pending local operations are preserved.
- Rules now accept a bounded dashboard cover focal point, retaining the existing cover-position workflow in cloud workspaces.
- Real offline delivery exposed a connection-generation race: an old delivery could reach the server after reconnect, leaving its local operation unacknowledged. The next connection now resumes the same operation ID after the old flush releases its lock. The regression fails before the fix and passes afterward.
- Cloud receive and conflict resolution retain Inbox and referenced legacy built-in projects. Previously, choosing an account version with implicit project documents left the task list visible but subsequent edits failed until reload. Missing custom-project relationships still wait for a valid cloud graph.
- Visual inspection of the hosted mobile journey exposed a backup reminder inheriting a full-width utility action. Its component-owned grid and compact labels now keep both actions usable without crushing the explanation. A browser regression covers visible-banner layout and durable dismissal; obsolete Today override selectors were removed to retain the CSS budget.
- Live acceptance now requires successful App Check exchange, archives passing reports per deployment, and revokes all runner-owned temporary access secrets after success. Fresh protection configuration exposed Vercel SSO redirects for both the page and initial assets; startup retries only these validated redirects, including CSP-blocked reports. A fresh-access run passes all 12 cloud checks; the final audit confirms zero temporary secrets and unauthenticated HTTP 302 protection.

## Continuation instructions

Use Node 22 and run `npm run verify`, then production browser checks, then `npm run test:performance` against the resulting build. Do not rebuild while a browser/performance suite is using `dist`.

Local Firefox currently fails before application navigation while creating its first page, with `RenderCompositorSWGL failed mapping default framebuffer, no dt`. Repeated launches, including a software-rendering probe, reproduced the runtime failure. This is not a passed Firefox gate. Keep Firefox mandatory in Linux CI and verify on a functioning runtime before release.

A [similar Windows startup report in the Playwright tracker](https://github.com/microsoft/playwright/issues/41347) was unresolved and classified as environment-specific. That does not establish the cause on this machine; do not change application behavior or disable browser security to manufacture a passing Firefox result.

The user subsequently supplied the live URL and Firebase project. A read-only [live deployment audit](LIVE_DEPLOYMENT_AUDIT.md) confirmed access and configuration gaps. The user then approved separate staging and a protected Preview. Firebase `flowtask-kunal-staging` and Vercel `flowtask-staging` have been provisioned, with billing disabled and Node 22 / Preview protection configured. Follow the [staging checkpoint](STAGING_SETUP.md) for the exact identities and current deployment progress. Live cloud checks are mandatory; local emulator and deterministic tests cannot substitute for them. Physical-device checks, user testing, the deployed update/rollback drill and seven monitored beta days remain open. Do not mark broad production readiness complete based on local automation.

## Verified checkpoint

- Node 22.23.3: lint, TypeScript, production build, complete route-CSS accounting and core offline dependency checks pass.
- Latest complete Node 22 verification: **1,100 unit/component tests** across 133 files, **15 security tests**, **9 isolated emulator rules tests**. The subsequent banner-only refinement passes TypeScript/build/budgets/lint and the final **6 Chromium smoke journeys**.
- **12 hosted cloud acceptance checks pass** on the final protected Preview, including focus-log delivery and old-token write denial after deletion. Real App Check exchange returns HTTP 200; Google sign-in was confirmed by the user against the same staging Firebase web app.
- The 21 October broad browser baseline was 119 passed / 3 capability skips. On 22 October the current Chromium smoke suite passes 6/6. WebKit cannot launch: Windows Code Integrity events 3077/3033 block its bundled `nghttp3.dll`, exit `0xC0E90002`. Firefox also remains unverified locally. Keep both mandatory in Linux CI; no security policy was weakened.
- Production dependency audit: **0 vulnerabilities**.
- Final scripted capture lab p75: **24ms desktop / 104ms mobile**; LCP at most **968ms**, CLS at most **0.00051** under the documented lab conditions. Field performance remains a beta gate.
- Current screenshots, cloud/backend/protection reports and lab samples: `docs/evidence/2026-10-22/`; prior evidence remains in `docs/evidence/2026-10-21/`.

The next work is Linux cross-browser CI, physical devices and real screen readers, representative migration/update/rollback rehearsals, operator monitoring/calendar/TTL/budget configuration, unfamiliar-user testing and the monitored beta. The staging cloud implementation is no longer awaiting initial setup. Do not restart from the original audit or discard the implemented source. Detailed counts, artifacts and remaining sign-off are in [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md).
