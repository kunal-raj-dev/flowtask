# FlowTask release candidate: implementation and operation

This change implements the personal-product release plan in the existing React/TypeScript, IndexedDB, Firebase and Vercel/Worker architecture. It does not add teams, billing, SSO or a framework rewrite.

**Release status: candidate, not approved for broad production rollout.** Isolated protected staging is deployed, hosted cloud journeys pass in independent browser profiles, and the user confirmed Google sign-in. Physical devices, screen readers, cross-browser CI, usability sessions, operator configuration and the monitored beta remain required gates. Customer production had not been promoted or reconfigured when the hosted evidence below was collected. Git-linked deployments after source publication must be checked separately. Current evidence and remaining work are recorded below.

## Reproducible verification

Use Node **22.x**, npm's lockfile, Java 21 and the checked-in runtime files. Local validation uses Node 22.23.3. CI installs its own browsers and Java runtime.

```sh
npm ci
npm run verify
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e:release
npm run test:performance
npm audit --omit=dev --audit-level=moderate
```

`verify` runs lint, TypeScript, the complete unit/component suite, API/proxy/telemetry security tests, a separately started Firestore emulator, the production build and asset budgets. The emulator runner verifies a pinned SHA-256 before starting the official Firestore JAR, refuses an occupied port, uses only `demo-flowtask`, and shuts it down after testing. It does not require an already running emulator or production login.

The release Playwright configuration starts **Vite preview on port 5191**, runs Chromium/Firefox/WebKit, and stores screenshots/traces in `test-results-release-candidate/`. It explicitly enables production service-worker assertions, including installing directly from `/app` and opening the landing page offline. Development-server test runs are not release-build evidence. CI retains browser reports and traces for 14 days. A local Chromium run uses installed Chrome; CI uses Playwright Chromium. Edge and physical Safari/Chrome remain separate manual gates.

### Capability acceptance matrix

| Capability | Implemented success / persistence | Empty and loading | Failure and recovery | Evidence / remaining gate |
|---|---|---|---|---|
| Capture and task editing | Shared task commands; stable IDs; NLP interpretation and editable task fields; serialized durable saves | Empty lists, disabled empty capture; workspace loading screen | Validation before publication; visible save failure, retry and export | Component coverage, production capture/reload at 320–1920px; physical keyboard checks pending |
| Projects, milestones, dependencies | Delete/move clears invalid references; relationship-aware Undo/Redo | Inbox and project empty states | Invalid graph rejected; original record retained on failed hydration | New relationship/persist/reload/undo fixtures |
| Recurrence, subtasks, archive/trash, bulk actions | Existing domain commands retained; destructive delete/bulk operations checkpointed | Existing list/selection states | Undo and pre-operation checkpoint | Existing command/component suite; user acceptance before beta |
| Recovery and import | Workspace-required asynchronous checkpoints; full portable workspace; latest ten retained atomically; daily deduplication | No-checkpoint guidance; busy states | Durable-write errors, raw original export, archived original before restore; future format rejected | Isolation, corruption, retention, CAS and migration tests; quota fault injection |
| Account boundary | Account-keyed providers/listeners/timer projections; explicit destination/count import preview; Keep separate | Offer waits for hydrated, synced account | Delayed delivery is ignored after disconnect; repeated IDs skipped | Store tests and hosted local/A/B/import/deletion journeys pass; user confirmed Google sign-in |
| Cloud delivery | Durable outbox; receipt-based transactions; revisions; persisted jittered backoff; separate local/cloud status | Upload pending, synced, follower preview | Offline queue, permanent-error pause, affected-record conflict preview, both versions preserved before choice | Rules/store tests and actual Firestore delivery/conflict/offline journeys pass in independent profiles; physical-device acceptance remains |
| Additional tabs | Read-only follower, durable refresh notifications, explicit handover after save drain | Follower is useful without mounting editing/timer UI | Stale-writer compare-and-swap prevents overwrites; blocked handover preserves edits | Two-tab production browser test; no-Web-Locks fallback relies on stale-write detection |
| Focus and Studio | Shared start validation/defaults; headless completion; persisted lifecycle/checkpoint; one completion owner | Taskless focus, inactive controls | Refresh/sleep/wake elapsed-time calculation; device capability fallback; account-scoped state | Existing focus tests and new default/session tests; real sleep, audio, PiP and mobile interruption checks pending |
| Plan and scheduling | Existing working-hour/capacity/locked-task/calendar-aware preview and explicit apply/Undo | Compact empty backlog; direct mobile Plan | Conflict explanations and editable proposals | Existing scheduler tests and production Plan journeys |
| Assistant | Local command proposals and editable previews | Empty guidance | Validated domain actions; unsupported suggestions remain visible | Existing assistant/WebMCP tests; no remote task-content telemetry |
| Visual system | Calm amber branding; compact header; Today/Inbox/Plan/Projects/Focus; More for secondary views; consolidated workspace CSS; 14–16px body and 12px metadata | Shared empty/loading feedback | Visible focus and keyboard alternatives; full-height mobile panels | Browser widths 320/390/768/1024/1440/1920; axe with contrast enabled on all 18 Today themes and an image background; broader manual/screen-reader audit pending |
| Offline and media | Core shell precached; self-hosted fonts; on-demand media, versioned media URLs and cached catalog/revisions | Download/retry guidance for uncached media | Saved work retained across reload; update waits for focus and durable save | Existing offline/update tests plus release journeys; old deployed build upgrade drill pending |
| Diagnostics and operations | Device-specific opt-in; numeric allowlist; build identifiers; health route; atomic rate limits | Disabled without both deployment flags and device consent | No raw error messages, stack traces, tasks, account IDs, tokens, calendar URLs or replay in reports | API security tests; hosting alert destinations/retention/budgets require operator configuration |

This matrix is an acceptance inventory, not a claim that human/device checks have already happened. Browser axe checks do not certify WCAG conformance; desktop lab timings do not certify field Web Vitals.

## Saved data and recovery

Focus uses timestamps across refresh and sleep. Paused time is excluded. Pomodoro and Countdown complete at their duration even with Studio closed; Stopwatch and Sprint pacing continue until explicitly finished so overtime pacing remains available. Returning to an account reconciles its saved lifecycle once; another account and follower tabs do not run its timer or audio. Pause/resume/finish and assistant completion share domain commands and use session IDs for idempotent logs.

Workspace schema is **8**. Portable JSON backup format remains **6** for compatibility. Workspace IDs, task IDs, deep links, dashboards and media references are retained. An unsupported newer format cannot replace saved data.

Before normalizing older IndexedDB records, `legacy_backups` preserves the pre-migration record (including the `v7:<workspace>` archive). Scoped localStorage workspaces are copied durably into IndexedDB. Unscoped legacy task data belongs only to `local`; signing in never assigns it to an account.

Each durable mutation returns an operation ID and an awaitable `persisted` outcome. A successful local save is distinct from cloud acknowledgement. IndexedDB writes atomically compare the loaded `writeVersion`; a stale writer cannot retry its way into overwriting a newer tab. Keep the failing tab open and export before reopening it.

Recovery checkpoints include tasks, projects, dashboards, preferences, custom views, focus history and recipes. Active focus sessions, lifecycle checkpoints, synchronization queues, internal flags, imported calendar file contents and personal media binaries do not replay on restore. Media references remain portable; missing personal files need separate re-import. Private calendar URLs can exist in a downloaded preference backup, so store exported files privately.

Checkpoints are scoped for create/list/read/delete. Snapshot creation succeeds only after the IndexedDB transaction commits. Retention and insertion occur in the same transaction; the latest ten successful checkpoints remain per workspace. The first successful daily checkpoint after meaningful saved activity uses the device's local calendar day. There is no background checkpoint when the application is closed. Destructive operations/import replacement preserve a pre-operation checkpoint first; a failed checkpoint blocks its durable replacement and can be retried.

Unowned old global snapshots remain in a separate export-only legacy section. They are not automatically assigned to a signed-in account. A local checkpoint is in the same browser profile and is not protection against device loss or browser-data clearing. Download JSON and keep a separate copy.

If hydration fails: keep the profile intact → Export original data → download an available checkpoint → restore a suitable checkpoint or retry opening. Recovery archives the original before writing the selected portable workspace. Never advise clearing site data as the first recovery action.

## Cloud and backend deployment

The approved isolated environment and current hosted evidence are tracked in [STAGING_SETUP.md](STAGING_SETUP.md). `npm run test:cloud:staging` is an explicit live test against a protected staging Preview, using two independent browser profiles and disposable users. Set `FLOWTASK_STAGING_URL` and the ignored staging client configuration first. It rejects production targets and mismatched Firebase/Vercel project identities. No traces, passwords or token recordings are created. A failed run retains its managed protection secret for a retry; revoke any remaining acceptance-runner secrets in the staging project's deployment protection settings after troubleshooting. A passing run revokes all secrets created by this runner and archives its report by deployment ID.

Firebase Admin 14 currently depends on `jwks-rsa` 4 / ESM-only `jose` 6. The hosted Vercel Node 22 loader rejected this combination before handler execution (`ERR_REQUIRE_ESM`), although ordinary local imports passed. The scoped `firebase-admin > jwks-rsa` override uses 3.2.2; the rest of Admin remains on 14.5. Its production dependency audit is clean. The security suite imports the real handlers with synchronous `require(ESM)` disabled. Remove the compatibility override only after an upstream fix passes that check and actual staging token verification/deletion.

1. Create a separate **staging Firebase project** and disposable accounts. Populate `.env` from `.env.example`; never put server credentials under `VITE_`. Add exact staging/production auth domains in Firebase. Configure Google sign-in and `APP_ORIGIN` for production API origin validation. Preview handlers use their exact platform-injected `VERCEL_URL`; request headers cannot choose this origin.
2. Deploy reviewed `firestore.rules` and `firestore.indexes.json` to the intended project explicitly. Avoid relying on the checkout's default project. Rules enforce ownership, deletion barriers, entity bounds/allowlists and revision progression. Server `serviceRateLimits` documents are inaccessible to clients.
3. Verify TTL is enabled for operation `expiresAt` fields, completed-deletion barriers under `users` and server rate-limit buckets. New receipts carry a seven-day expiry. Expiry is automatic only when server TTL is active: unbilled staging rejected these policies with HTTP 403. Do not silently enable billing; track this as a release dependency. The optional legacy client cleanup reads at most 100 expired receipts; startup does not scan receipt history. Legacy receipts with no expiry need a one-off bounded administrator migration, with staging rehearsal and count-only audit output.
4. Set the reCAPTCHA Enterprise site key for App Check. Observe valid/invalid traffic in staging and production before enabling enforcement. Test Google popup/redirect and App Check with the deployed CSP; a Vite preview does not exercise Vercel headers. Enable Firestore enforcement only after legitimate clients have adopted the new build.
5. Deploy account deletion with Admin SDK credentials and recent-auth checks. Its atomic per-user quota is ten requests per hour. A deletion barrier denies stale client writes throughout retries. Verify partial cleanup and retry using disposable accounts.
6. For private calendar proxy, replace the exact origin in `workers/wrangler.toml`, choose the intended Worker/account, keep the explicit calendar host allowlist, and deploy the rate-limit binding (20/IP/minute). Production fails closed when the binding is missing. `TEST_MODE` is only for tests. Set `VITE_CALENDAR_PROXY_URL` after the deployed worker is verified.
7. `GET /api/health` is uncached and returns a build/configuration signal without secrets. A successful response confirms required settings are present, not that a real database/auth transaction succeeded. Add a staging synthetic login/sync check separately.

Use Firebase's [security checklist](https://firebase.google.com/support/guides/security-checklist) for project configuration and the [App Check monitoring guidance](https://firebase.google.com/docs/app-check/monitor-metrics) for enforcement rollout. Keep real secrets, private calendar URLs and task contents out of CI artifacts.

### Diagnostics, alerts and retention

Remote collection requires `VITE_DIAGNOSTICS_ENABLED=true`, server `DIAGNOSTICS_ENABLED=true`, correct `APP_ORIGIN`, server credentials, and explicit user consent **on this browser and workspace**. Consent is not imported from a backup or another device. Session replay is absent. `/api/diagnostics` rejects unknown fields, oversized bodies, invalid numeric measurements, cross-origin requests and excessive requests. Disable both flags to stop remote collection.

Before enabling it, the operator must publish the actual hosting log-retention period on `/data-retention`, restrict log access and choose deletion/export procedures. The checkout deliberately does not invent a retention policy for an unconfigured hosting account. Default flags remain off.

Configure operator-owned alerts for API 5xx, function failures, error-rate increases, Firestore permission spikes, sustained delivery queue failures, hosting availability, Firestore reads/writes/storage and billing budgets. Start with staging baselines; investigate a sustained API error rate over 1%/5min or repeat availability failures. Billing budget alerts notify; they are not spending caps. Send only sanitized identifiers/counts to alerts. No email/Slack notification destination was configured by this implementation.

Field objectives at p75: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1, tracked separately for mobile/desktop and release version. Numeric opt-in samples are incomplete population data; label their sampling bias. [Core Web Vitals guidance](https://web.dev/articles/vitals).

## Performance and accessibility gates

Build budget checks enforce landing JS ≤180KiB gzip, planner JS ≤400KiB gzip, initial CSS ≤35KiB gzip for each route, and core precache ≤1.5MiB. Accounting follows the Vite manifest's complete static import graph for each route, including every imported stylesheet, rather than just the entry CSS file. Dashboard layout, appearance picker, Studio and secondary-view styles load with their owning components. Calendar, cloud and media remain lazy; fonts are self-hosted. Bundled media URLs use generated content revisions, including responsive variants. No media binary is added to the core precache.

`npm run test:performance` starts a separate preview on port 5192. It measures three cold Chromium profiles per route/device with service workers blocked, 40ms latency, 1.6MB/s download, 750KB/s upload and 4× CPU slowdown on mobile. It enforces p75 LCP ≤2.5s, CLS ≤0.1 and scripted capture Event Timing ≤200ms; nearest-rank p75 of three samples is their maximum. These local scripted interactions are not field INP, and exclude authentication/cloud latency. Full samples are saved in `test-results-lab-performance/report.json`. Optional `FLOWTASK_PROFILE_CAPTURE=true` writes a synthetic capture CPU profile for diagnosis. Initial audio setup is scheduled after the action paints so optional click feedback does not block task capture.

Large-workspace browser fixtures cover 1,000 and 10,000 tasks, cap mounted task rows below 80, require durable capture, and record lab timings as JSON attachments. The desktop capture-input guard is 1.5s including browser automation overhead. It is a regression alarm, not an INP measurement or proof of the 200ms field goal.

WCAG target is **2.2 AA**, with 4.5:1 normal-text contrast and a product target of 44px primary touch controls. Automated checks include contrast rather than disabling the rule. Keyboard, focus restoration, real screen readers, 200%/400% zoom, broader theme/surface and image-overlay combinations, mobile keyboard and safe areas still require manual release sign-off. [WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/).

## Security review map

This maps applicable [OWASP ASVS 5.0](https://owasp.org/projects/asvs/) areas to evidence; it is not an ASVS certification.

| ASVS area | Implementation / review evidence |
|---|---|
| Validation and business logic | Shared workspace validation at import/mutation/cloud boundaries; bounded extension payloads; idempotent captures and delivery receipts |
| Browser security | Exact extension origin registration, exact receiver origin/source, acknowledgement after durability; tightened script CSP; local content rendering |
| Authentication and session management | Firebase Auth account-keyed providers, listener generation invalidation, explicit device import, hosted recent-auth deletion and old-token write denial; Google sign-in confirmed by the user |
| Authorization | Firestore owner checks, deletion barriers, allowed entity fields, revision checks; isolated emulator negative tests |
| API and services | Origin validation, strict diagnostic envelope, atomic deletion/diagnostic rate limits, fail-closed calendar limiter and host allowlist |
| Data protection and privacy | Account-scoped local records/checkpoints; portable backup exclusions; device-specific monitoring consent; numeric-only reporting and replay absent |
| Configuration, logging and errors | Node/lockfile/CI, environment example, no secret telemetry, build metadata, health route, recovery screens, operator alert/retention requirements |

## Release and incident procedure

Internal candidate → migration/recovery regression pass → staging cloud/device/security checks → limited beta → **seven monitored days** → broad release. Do not waive data loss, account isolation, broken capture/plan/focus/backup, or critical accessibility failures.

Record each release's Git revision, build ID, runtime, environment, rules/index version, sanitized verification reports, screenshots and responsible operator. Never rename the beta build stable based only on green unit tests.

**Incident:** stop rollout; disable optional remote diagnostics if involved; identify build/workspace scope using sanitized counts; preserve the failing browser and export before recovery; reproduce with synthetic records in staging; select a compatible build; communicate scope and recovery steps through the operator's approved channel. Do not request authentication tokens, raw private calendar feeds or unredacted task dumps in reports.

**Rollback:** retain previous immutable assets so open clients can load old chunks. Revert only to a build that understands schema 8 and the current outbox semantics, or ship a forward repair. For a schema rollback, first export and archive the current raw record, use the preserved pre-migration version in a disposable profile, validate task relationships/IDs and account scope, then explicitly import a compatible portable backup. Never overwrite a live schema-8 record with an old binary or clear IndexedDB. Test an active session, offline pending operation, refresh and acknowledgement against both builds before resuming rollout.

### Required external sign-off

- Linux CI execution of the complete Chromium/Firefox/WebKit suite. Current Windows WebKit is blocked by OS Code Integrity; Firefox cannot create a page locally.
- Physical two-device/network journeys. Real hosted sync/account/conflict/offline/deletion checks already pass in independent browser profiles, and the user confirmed Google sign-in.
- Worker binding/rate limits, billed-environment Firestore TTL, monitoring access/retention, budget and hosting alert delivery. Hosted CSP/Auth and App Check exchange pass; App Check enforcement needs monitored rollout.
- Edge plus physical Android Chrome/iPhone Safari capture → Plan → focus → backup; real sleep/wake, offline reload, old/new service worker and pending writes.
- Keyboard-only and real screen-reader journeys; all-theme contrast and background overlays; mobile keyboard/safe areas/zoom/landscape.
- Five unfamiliar users: at least four create a task and start focus without guidance within one minute.
- Seven-day monitored beta with zero unresolved release blockers and a rehearsed rollback.

## Verification evidence for this checkout

**Current checkpoint: 22 October 2026.** Complete Node 22 verification passes **1,100 unit/component tests**, **15 security tests** and **9 isolated rules tests**. The final UI refinement passes build/budgets/lint and **6 Chromium production smoke journeys**. **12 live cloud acceptance checks** pass on the protected staging Preview, including focus delivery and deleted-token rejection. Google sign-in was confirmed by the user; real App Check exchange returns HTTP 200.

Current deployment, exact asset/lab measurements, screenshots and browser limitations are preserved in the [22 October verification report](evidence/2026-10-22/README.md). The current WebKit rerun is blocked by Windows Code Integrity before navigation; Firefox also remains an open local-runtime gate. Both remain mandatory in Linux CI. The remaining external sign-offs above are not waived.

### Historical local baseline — 21 October 2026

Executed on 21 October 2026 using Node **22.23.3** on Windows:

| Check | Historical result |
|---|---|
| Clean lockfile install | Passed with Node 22 |
| Lint and TypeScript | Passed |
| Unit/component suite | **1,094 passed**, 133 files; no unexpected React `act` warnings |
| API/proxy/telemetry security | **12 passed** |
| Automatically started isolated Firestore rules emulator | **8 passed** |
| Production build and static dependency/precache checks | Passed |
| Production dependency audit | **0 vulnerabilities** across reported severity levels |
| Production Chromium journeys | **61 passed**, no skips |
| Production WebKit journeys | **58 passed**, 3 capability/platform skips |
| Firefox | Local runtime fails while creating a page, before app navigation; verification remains open |

That historical production-browser run executed 122 cases with two workers: **119 passed, 3 skipped, zero failed, zero flaky**. The three Windows WebKit skips cover absent Web Audio OS controls, unsupported PiP, and offline service-worker navigation requiring physical Safari verification. Silent focus without Web Audio passed on both engines; OS controls and direct-install offline entry passed in Chromium. All 18 Today themes with a background image, 320–1920px capture/reload, keyboard dialogs, two tabs, corruption recovery, and 1,000/10,000-task fixtures passed on both engines where supported. Firefox remains mandatory in CI; its local startup failure is not application compatibility evidence.

The historical browser command was `npm run test:e2e:release -- --project=chromium --project=webkit --workers=2 --reporter=line,json`. The default release command and CI include Firefox with one worker. Ignored browser output under `test-results-release-candidate/` is replaced by later runs; the preserved 21 October screenshots and lab evidence are linked below. All verification workspaces are synthetic.

| Asset budget | Measured bytes | Limit |
|---|---:|---:|
| Landing initial JS, gzip | 167,961 | 184,320 |
| Planner initial JS, gzip | 316,332 | 409,600 |
| Landing initial CSS, gzip | 30,102 | 35,840 |
| Planner initial CSS, gzip | 35,821 | 35,840 |
| Core precache, 46 entries | 1,559,420 | 1,572,864 |

CSS accounting includes all static route imports. The core precache contains every dependency of both initial routes; on-demand view code/styles are cached when loaded. Treat the remaining CSS/precache headroom as a hard constraint for future changes.

That historical lab run passed all budgets under the conditions described above:

| Device / route | LCP p75 | CLS p75 | Scripted capture p75 |
|---|---:|---:|---:|
| Desktop landing | 684ms | 0 | — |
| Desktop planner | 908ms | 0.00051 | 32ms |
| Mobile landing | 1,000ms | 0 | — |
| Mobile planner | 780ms | 0 | 128ms |

These are synthetic local measurements, not field INP or a cloud-latency measurement. The preserved [lab samples and conditions](evidence/2026-10-21/lab-performance.json) are independently inspectable. [Desktop](evidence/2026-10-21/today-desktop.png) and [mobile](evidence/2026-10-21/today-mobile.png) screenshots use a synthetic workspace with a fixed calendar date for reproducibility.

Local logs are ignored files named `test-results-production-*.log`; browser screenshots, traces and lab JSON attachments live under `test-results-release-candidate/`. CI publishes equivalent evidence. External sign-off above remains pending regardless of local test results.
