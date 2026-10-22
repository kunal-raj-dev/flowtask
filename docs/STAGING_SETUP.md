# Isolated staging checkpoint

Updated: 22 October 2026. The user approved **separate staging and a protected Vercel Preview**, without linking a billing account. This records the isolated environment before source publication; production had not been changed during its setup and acceptance checks. A later push to `main` may trigger Git-linked hosting and requires a separate deployment check.

## Provisioned resources

| Resource | Verified identity |
|---|---|
| Firebase / Google Cloud | `flowtask-kunal-staging`, display name FlowTask Staging |
| Project number | `646411971687` |
| Firebase Web App | `1:646411971687:web:4d67afaa64e13c7d1478c2` |
| Firestore | `(default)`, `nam5`, native standard, deletion protection enabled |
| Billing | Disabled; no billing account linked |
| Vercel | `flowtask-staging`, `prj_NVliQCRmwY1sAuGIShUZMvkWAe5e` |
| Vercel team | `team_8Z1IwIGv9Ezj3dNtNWxzH7Hc` |
| Runtime / protection | Node `22.x`; Vercel Authentication on generated deployment domains |

These are separate from production Firebase `flowtask-kunal` and Vercel project `flowtask`. Never use the default Firebase target when provisioning staging: pass `--project flowtask-kunal-staging` explicitly.

## Deployment progress

- Management APIs enabled for staging; the project, app and database creation operations completed.
- Firebase CLI configuration is isolated in ignored `test-results-live-readiness/staging-firebase.json`. Deploy reviewed rules/indexes from copies in that directory. The first attempt rejected paths outside its project directory; these paths have been corrected.
- Reviewed rules and non-TTL indexes deployed successfully. Google, anonymous and email/password providers were enabled through the official Firebase CLI. Email/password is for disposable staging fixtures; it is not an application login feature or evidence that Google sign-in passed.
- Server handlers now determine the exact Preview origin from platform-injected `VERCEL_URL`. Request headers cannot select an allowed origin. Fifteen API/security tests pass, including cross-preview rejection and the hosted loader compatibility regression.
- Preview environment variables now contain staging client configuration, disabled diagnostics and a dedicated server identity, `flowtask-preview-api@flowtask-kunal-staging.iam.gserviceaccount.com`. Its only project roles are `datastore.user` and `firebaseauth.admin`. The server key was submitted in memory directly to Vercel sensitive environment variables; it was not saved locally. Rotate it in Vercel and remove the old IAM key when rotating credentials.
- Current protected Preview: `https://flowtask-staging-9i20sn5er-kunal-rajs-projects-7518d379.vercel.app`, deployment `dpl_FuMeKe4FCM6H34poaiwHAEygAJQn`. Build status READY; target Preview (`null` in the deployment API). Its exact hostname is authorized in staging Auth and reCAPTCHA Enterprise. Earlier candidates exposed the loader and hydration regressions recorded in the implementation checkpoint.
- Vercel initialized the first deployment of this new CLI project as that project's Production target, even though Preview was requested. The bootstrap deployment belongs only to the new staging project, has no server or Firebase production-target credentials, and stays protected. Subsequent candidates, including the current deployment above, use the configured Preview environment. No customer production resource was modified.
- Firestore rejected TTL deployment with HTTP 403 because staging billing is disabled. Only the isolated deployment copy omits TTL; the reviewed release `firestore.indexes.json` retains all three policies. Server expiry for `operations`, `users` deletion barriers and `serviceRateLimits` remains a billed-environment release dependency. No billing account was linked. The bounded client receipt cleanup remains available.
- Real cloud acceptance checks pass: **12 successful checks** on the final Preview. Use `FLOWTASK_STAGING_URL` with `npm run test:cloud:staging`; it refuses production targets, uses temporary protection access, genuine disposable Firebase sessions and removes its own users afterward. Traces and recordings of credentials remain disabled. Passing runs archive their report by deployment ID; failed setup runs cannot overwrite an archived success.
- The runner uses Vercel's [documented automation header](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation), restricted to the exact Preview origin. Fresh access configuration intermittently sent the browser or its initial JS/CSS requests to Vercel SSO even after an API probe succeeded. Startup retries only those observed protection redirects with bounded delays; ordinary application errors still fail. Neither protection nor CSP is relaxed. App Check exchange is a required assertion, rather than an optional reported check.
- App Check is registered with a domain-restricted Enterprise score key, one-hour tokens and default risk threshold. Enforcement remains disabled. The client site key is in Preview configuration only. Do not interpret registration as proof of valid real-user traffic; token exchange and Google sign-in remain separate checks.
- The complete cloud journey passes on the current candidate: declined import with local preservation, hydration on a second independent profile, offline reconnect/reload exactly once alongside unrelated edits, same-record conflict review with both versions preserved, local/A/B switching and repeated login, repeated approved import without duplicates, cross-account read denial and disposable-account deletion. Focus survives minimize/pause/reload and delivers exactly one completion log to the other profile. The pre-deletion ID token is explicitly rejected when attempting to recreate a task.
- Real Enterprise App Check exchange returns **HTTP 200** with the hosted CSP. Enforcement remains off for monitored rollout; field legitimate-user coverage is still needed.
- **Real Google sign-in: user-confirmed successful on 22 October 2026**, on earlier Preview `flowtask-staging-79758ah0g-kunal-rajs-projects-7518d379.vercel.app`, using the same staging Firebase web app/provider configuration. The final Preview's hostname has also been authorized. This is direct human confirmation of the Google-provider journey, distinct from the runner's password-fixture sessions.
- Four orphaned acceptance accounts from the failed-loader runs were cleaned up through the staging management API, including their workspace subcollections. Only the runner's precisely named `example.invalid` fixtures were targeted; customer accounts changed: zero.
- Final audit: billing remains disabled; deployed rules match the reviewed source hash; server credentials are sensitive variables scoped only to Preview; temporary automation secrets remaining: **zero**; an unauthenticated request is redirected to Vercel authentication. The user's ordinary Google/Vercel sessions were not changed.

## Resume and evidence rules

Keep raw credentials in authenticated CLI state or in encrypted server environment variables. Never add Admin private keys, bearer tokens, bypass secrets or disposable-account passwords to this document, logs, screenshots or tracked files. Public Firebase client configuration may live in ignored `.env.staging.local`.

Record actual deployment URLs, build identity, protection checks, deployed rule hash and test results here as they complete. Keep Google-provider verification, App Check integration, retention policies, two-device tests and deletion distinct; one does not prove another.

Do not link billing to enable a feature. If a provider requires billing, record that dependency and continue work that fits the approved unbilled staging setup. Physical devices, real screen readers, unfamiliar-user sessions and seven monitored beta days remain release gates.
