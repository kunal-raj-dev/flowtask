# Live deployment inspection — 21 October 2026

User-supplied website: `https://flowtask-kunal.vercel.app/`.
Firebase project: `flowtask-kunal`, number `329450602694`, Web App `FlowTask Web`.

This is the existing live deployment, not an isolated staging environment. The checks below read deployment configuration and application assets. No production Firestore documents, users, authorization settings, rules, TTL policies or environment variables were changed.

## Verified findings

| Check | Observed result | Release implication |
|---|---|---|
| Deployed source | Vercel deployment and `/build-info.json` identify commit `3ec47e715555f4eff15a495e8e1c6bf3cedf2f58` | Customer production remains on the base build; the candidate is now deployed only to isolated staging |
| Vercel project | Project name `flowtask`, production branch `main`; the public hostname differs from the project name | This is the customer production project; the approved candidate Preview uses separate `flowtask-staging` |
| Runtime configuration | Project default is Node `24.x`; candidate `package.json` requires `22.x` | Confirm the candidate's build/function runtime is Node 22; do not infer it from the project default |
| Health endpoint | `GET /api/health` returns 404 | New health/API code is absent from the deployed build |
| CSP | Live policy still permits `unsafe-inline` and `unsafe-eval` in `script-src` | Candidate CSP/Auth/App Check integration remains unverified on hosting |
| Web app identity | Management API confirms the supplied project number and active Web App ID match the deployed public web configuration | Public client configuration can be used for a scoped verification build |
| Google provider | Enabled | A real account journey still needs testing against the candidate |
| Authorized Auth domains | `flowtask-kunal.firebaseapp.com`, `flowtask-kunal.web.app`, `flowtask-kunal.vercel.app` | Localhost and a future preview domain are not authorized; candidate sign-in cannot be assumed to work there |
| Deployed Firestore rules | Owner-only recursive access, 11 lines; release updated 1 October 2026; differs from the 115-line candidate | Candidate field/revision/deletion-barrier controls have not reached the backend |
| Operation receipt TTL | `operations.expiresAt`: not configured | Seven-day server expiry is not active |
| Rate-limit bucket TTL | `serviceRateLimits.expiresAt`: not configured | Backend retention policy is not active |
| App Check | Management endpoint reports the App Check API unused/disabled | Monitoring/site-key setup is incomplete; do not enable enforcement blindly |
| Vercel environment | Only the six Firebase public web variables are configured across production/preview/development | `APP_ORIGIN` and server Admin configuration required by new account-deletion/health endpoints are missing; diagnostics should remain disabled |
| Preview protection | Existing Vercel protection covers deployments except custom domains | Preserve protection on a new candidate preview |

The first browser visit loaded an older cached client and showed a section-load error. Applying its visible update brought it to the currently deployed base build. This is evidence for the old/new service-worker acceptance gate, not proof that the candidate has passed that deployment drill.

## Work completed after receiving the deployment details

- Confirmed Vercel and Firebase ownership/configuration through existing authenticated CLI sessions. Routine Vercel session refresh succeeded; no new credentials were created.
- Matched the active Firebase Web App and retrieved the already-public browser configuration.
- Created ignored `.env.live-check.local`. It targets the **existing live Firebase project**, includes only public client configuration and the supplied origin, and keeps diagnostics disabled. It contains no Admin credential.
- Built the current candidate successfully with `vite build --mode live-check --outDir test-results-live-readiness/candidate`. The ordinary verified `dist` and default test environment are preserved.
- Saved sanitized configuration summaries and the deployed rules in ignored `test-results-live-readiness/`. Authentication tokens, refresh tokens and server secrets are excluded from these summaries.

The configured build alone does not prove authenticated sync, account deletion, App Check, CSP or two-device behavior.

## Concrete next deployment

The user approved a separate Firebase staging project and protected Preview. **`flowtask-kunal-staging`**, display name **FlowTask Staging**, has now been created without linking a billing account, together with Vercel **`flowtask-staging`**. Staging has its own client/server configuration, reviewed rules, non-TTL indexes and authorized Preview domain. Current deployment identity and acceptance progress are in [STAGING_SETUP.md](STAGING_SETUP.md). Production configuration remains separate.

The [22 October verification report](evidence/2026-10-22/README.md) records passing hosted local/A/B switching, declined/repeated device import, independent-profile unrelated edits/conflicts, offline reconnect, focus delivery and disposable-account deletion. The user confirmed Google sign-in on the same staging Firebase web app. Before any production promotion, complete cross-browser CI, physical-device/accessibility/usability checks, operator configuration, the deployed upgrade/rollback drill and the monitored beta.

Official references: [Vercel deployment environments](https://vercel.com/docs/deployments/environments), [Vercel CLI deploy](https://vercel.com/docs/cli/deploy), [Firebase security checklist](https://firebase.google.com/support/guides/security-checklist).
