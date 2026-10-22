# Continuation verification — 22 October 2026

Node **22.23.3**, Windows. Evidence collected before source publication, from the working-tree implementation based on `3ec47e7`. Verified protected [staging Preview](https://flowtask-staging-9i20sn5er-kunal-rajs-projects-7518d379.vercel.app): deployment `dpl_FuMeKe4FCM6H34poaiwHAEygAJQn`. Customer production had not been promoted or reconfigured when this evidence was collected. A later Git push and its hosting result require their own build-identity check.

| Check | Evidence |
|---|---|
| Complete Node 22 verification | **1,100 unit/component tests**, 133 files; **15 security tests**, **9 isolated rules tests**; lint/typecheck/build/budgets pass |
| Final banner refinement | Additional TypeScript/build/budget/lint checks and **6/6 Chromium production smoke journeys** pass |
| Hosted cloud acceptance | **12 checks pass**: protected origin/CSP/build identity, explicit/declined import, independent-profile sync, offline exactly-once delivery, conflict preservation/resolution, local/A/B isolation, repeated import, cross-account denial, focus-log delivery and deletion/old-token write denial |
| Google provider | User confirmed sign-in on an earlier Preview of the same staging web app on 22 October; final hostname also authorized |
| App Check | Real Enterprise token exchange **HTTP 200**; enforcement disabled pending monitored rollout |
| Backend | Deployed rules match reviewed source; server variables sensitive and Preview-only; billing disabled |
| Cleanup/protection | Disposable fixture users removed; temporary automation secrets remaining **0**; fresh unauthenticated requests require Vercel authentication |
| Production dependency audit | **0 vulnerabilities** |
| WebKit rerun | 5 selected cases blocked before navigation by Windows Code Integrity events 3077/3033 for bundled `nghttp3.dll`, exit `0xC0E90002`; no security settings changed |
| Firefox | Earlier local runtime failure remains open; mandatory Linux CI gate retained |

The final reminder is tested while visible at **320, 390, 768 and 1440px**: controls remain at least 44px, the text does not collapse and dismissal survives reload. Earlier empty-workspace tests did not expose this state. Obsolete Today overrides were removed while retaining the CSS budget.

| Asset budget | Measured bytes | Limit |
|---|---:|---:|
| Landing initial JS, gzip | 167,957 | 184,320 |
| Planner initial JS, gzip | 316,677 | 409,600 |
| Landing initial CSS, gzip | 30,102 | 35,840 |
| Planner initial CSS, gzip | 35,757 | 35,840 |
| Core precache, 46 entries | 1,559,960 | 1,572,864 |

| Lab p75 | Landing LCP | Planner LCP | Capture interaction |
|---|---:|---:|---:|
| Desktop | 688ms | 872ms | 24ms |
| Mobile | 968ms | 800ms | 104ms |

Maximum measured CLS: **0.00051**. These are synthetic local measurements, not field INP or cloud-latency guarantees. Conditions and raw samples are in [performance-lab.json](performance-lab.json).

Artifacts: [cloud acceptance](cloud-acceptance.json), [backend rules/billing](staging-backend.json), [hosting protection](hosting-protection.json), [deployment](deployment.json), [WebKit environment](webkit-environment.json), [desktop](cloud-today-desktop.png), [mobile](cloud-today-mobile.png).

Raw logs remain ignored under `test-results-production-*.log` and `test-results-live-readiness/`. Current browser smoke output uses `test-results-production-current-smoke/`. Live fixtures never record traces or credentials.

The final cloud rerun starts with fresh temporary protection access and passes all 12 checks, including mandatory App Check exchange. Earlier setup attempts exposed Vercel SSO redirects for the page or its initial JS/CSS before the planner could start. The runner bounds retries to those validated protection redirects; ordinary application errors still fail. After acceptance, a separate audit confirms zero remaining runner secrets, unauthenticated HTTP 302 protection and sensitive Preview-only server variables. Passing evidence is archived per deployment before replacing the report above.

Still required: Linux cross-browser CI; physical Android/iPhone/Edge and screen-reader journeys; representative migration/update/rollback rehearsals; calendar Worker binding and operator monitoring/alerts/retention; a billed-environment TTL decision; unfamiliar-user usability sessions; and seven monitored beta days. No broad production-readiness sign-off is claimed.
