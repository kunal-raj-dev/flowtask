# Connected Notes verification

25 October 2026 · Windows · Node 22.23.4 · installed Chrome · isolated synthetic browser profiles. No customer account was used and no production configuration was changed.

## Automated checks

| Check | Result |
|---|---|
| `scripts/verify.mjs` on Node 22 | Passed |
| Lint and TypeScript | Passed |
| Complete unit/component suite | 1,185 passed across 145 files |
| Security/server/telemetry tests | 15 passed |
| Isolated Firestore rules emulator | 10 passed, including new note ownership/revision/size/history checks |
| Production build | Passed |
| Existing bundle/precache budgets | Passed without increasing limits |
| Production Chrome browser journeys | 23 passed: Connected Notes, entry flow, production readiness |
| Final-build Chrome subset after the last migration/layout changes | 5 passed: all three Connected Notes journeys, durable capture at supported widths, and mobile Plan/accessibility |
| Focused new-data cases | Included actual notes import/restore, old-schema migration and raw fallback checkpoints, repeated capture/import, conflicting text preservation and write-failure recovery |
| Diff whitespace check | Passed |

Production browser command:

```powershell
node node_modules/@playwright/test/cli.js test e2e/connectedNotes.spec.ts e2e/entryFlow.spec.ts e2e/productionReadiness.spec.ts --config=playwright.release.config.ts --project=chromium
```

The preview server serves the production build at `127.0.0.1:5191`. The final verification rebuild also includes the localStorage fallback migration checkpoint and the final Daily note button placement. Full unit/type/rules/build checks cover that final source. The 23-browser run preceded those last limited changes; the five affected Notes, durable-capture and mobile Plan journeys were then rerun against the final build and all passed. These five overlap the original 23 and are not 28 distinct journeys.

## Performance budgets

| Measure | Actual bytes | Existing limit |
|---|---:|---:|
| Landing JavaScript, gzip | 168,712 | 184,320 |
| Planner JavaScript, gzip | 334,841 | 409,600 |
| Landing initial CSS, gzip | 30,103 | 35,840 |
| Planner initial CSS, gzip | 35,809 | 35,840 |
| Core precache | 1,673,263 | 1,677,721.6 |

These are build-size checks, not field Core Web Vitals. The current CSS/cache margins are small; subsequent milestones need to continue using lazy feature boundaries and removing obsolete styles.

## Visual evidence

- [Desktop Notes](notes-desktop.png)
- [Mobile Notes preview](notes-mobile.png) — contains literal test input used to verify that unsafe HTML/URLs are not executed.

## Release boundaries

This is local implementation evidence. Deploy the updated Firestore rules before the frontend that queries `users/{uid}/notes`. No hosted account acceptance, production deployment, physical-device test, real screen-reader test or new Firefox/WebKit verification was performed. Existing broader-release gates still apply.
