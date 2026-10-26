# Ecosystem implementation evidence

See [the implementation checkpoint](../../ECOSYSTEM_IMPLEMENTATION_STATUS.md) for scope and remaining work.

Final acceptance uses:

- `verify.log`: Node 22 lint, TypeScript, full unit/component suite, security checks, isolated Firestore emulator, production build and unchanged asset budgets.
- `browser-final.log`: Chromium production journeys for the foundation, entry flow, Focus Studio, Connected Notes and responsive workspace/settings/capture.
- `browser-cross-engine.log`: the new foundation journeys in Firefox and WebKit.
- `today-{width}-{browser}.png` and `plan-{width}-{browser}.png`: rendered viewport captures at 320, 390 and 1440px.

The unqualified screenshot names and other logs are diagnostic or intermediate runs. They are retained to distinguish discovered regressions and test-harness issues from final acceptance. `baseline-vitest.log` reproduces the pre-change 167-file / 1,331-test baseline. An intermediate browser run overlapped a production rebuild and is not valid evidence for offline/chunk-loading acceptance; final browser runs keep the build fixed.

Browser tests use disposable synthetic workspaces on a task-owned local preview origin. No production provider, account, calendar or user workspace data was changed by these fixtures.
