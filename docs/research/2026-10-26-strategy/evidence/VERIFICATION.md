# Verification record and reproduction guide

**26 October 2026 · Flowtask local working-tree audit**

This file records the evidence behind the [main report](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/REPORT.md). It is a research artifact, not a new automated test suite or implementation patch.

## Environment and provenance

- Workspace: `C:\Users\kunal\Desktop\Flow-task`.
- Committed HEAD observed: `d5e09ea3b82632ad7b4bc61d4e50114a1def34aa`.
- **The working tree was already extensively modified and contained untracked files.** Findings refer to those current file contents, not just HEAD. Older audit reports were context only; current code/UI overrode stale claims.
- Package: `2.0.0-beta.1`; React 19, TypeScript 6, Vite 8, Zustand, IndexedDB/idb and optional Firebase. No dependency installation or upgrade performed.
- Host: Windows PowerShell, Node **25.6.1**, npm **11.9.0**. The repository requests Node **22.x**. Passing local checks here is not a supported-runtime release certification.
- Existing user server at port **5173** was preserved. An isolated server ran using existing dependencies: `npm run dev -- --host localhost --port 5176 --strictPort`. Browser interaction used `http://localhost:5176` and synthetic audit data.
- A fresh origin separates these browser records from the user's 5173 origin. No signed-in cloud account or real calendar was connected. No extension was installed.
- Browser automation used the provided Computer Use browser API. Desktop viewport capability was requested at 1440×900; phone at 390×844. Phone DOM measurements showed an effective **355×767 CSS viewport**. This is a browser-size simulation, not a physical-device test.
- The audit wrote only new research/evidence files under `docs/research/2026-10-26-strategy/`. It did not modify existing product source, redesign screens, commit, deploy or begin the proposed upgrades.
- Cleanup completed: the temporary 5176 server stopped, the original 5173 listener remained running, temporary audit tabs closed, and the browser viewport override reset.

## Local checks

| Check | Observed result | What it does not establish |
|---|---|---|
| `npm test -- --reporter=dot` | **170 test files, 1,361 tests passed**, approximately 87 seconds. | Does not cover every UI path. The scheduling defects below still reproduce. Output included React `act(...)` warnings and expected unavailable-environment/PiP logging. |
| `npm run lint` | Exit 0; **three warnings** in FocusStudio hook dependencies around lines 513/544. | Not a clean zero-warning result or proof of runtime correctness. |
| `node node_modules/typescript/bin/tsc --project tsconfig.app.json --noEmit --incremental false --pretty false` | Exit 0, no diagnostics. | Type checking cannot validate the date/scheduling product contract. |
| `npm run test:security` | **15/15 passed.** | Local tests, not a penetration test or deployed/cloud-rules certification. |

The security checks cover such boundaries as origin/consent constraints, numeric diagnostics, exact-origin extension messaging, calendar proxy fail-closed/private-host behavior, CSP and account-deletion checks. Actual deployed security posture was not verified.

No production build was generated, so existing `dist` output was not overwritten. No fresh Lighthouse/performance benchmark, Firestore emulator/rules run, full end-to-end suite or cross-browser suite was executed. The current CI configuration and existing budgets were inspected; their existence is not a new passing CI result.

Browser console inspection after the final reload returned no errors/warnings in the requested recent subset. That is not evidence that all flows are free of runtime warnings.

## Reproduced product findings

### F01 — Capture date interpretation

**Type:** observed behavior and code trace. **Severity:** P0 contract issue; user-intent expectation requires validation.

1. On 26 October 2026, open Today in the fresh workspace.
2. Enter `AUDIT — Read chapter tomorrow #personal ~45m p1`.
3. Observe the preview: deadline 27 October, project personal, 45m, P1.
4. Submit and open the task.
5. Observe **Planned 26 October; Due 27 October**. The task remains in Today.

Evidence: [03 capture/date meaning](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/03-capture-date-meaning.jpg), [04 task drawer](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/04-task-drawer-desktop.jpg).

Trace: [bare date → deadline](C:/Users/kunal/Desktop/Flow-task/src/utils/nlpParser.ts:179), [Today fallback](C:/Users/kunal/Desktop/Flow-task/src/components/views/today/HorizonTodayView.tsx:566). Explicit `plan:` exists; the finding is ambiguity/default meaning, not absence of a planned-date model.

### F02 — Silent drawer overlap and disproportionate duration preset

**Type:** observed. **Severity:** P0 planning trust.

1. Create two ordinary tasks, one with a 45-minute estimate and another without an explicit estimate.
2. Open each task's Session & Timeline area, add/edit session.
3. Use the Afternoon preset, 14:30–17:30, and Apply Session on both.
4. Both reservations are accepted through this drawer path; no overlap warning appears there.
5. Plan displays both three-hour reservations at the same time and approximately **1.3 h planned / 6 h capacity**.

Evidence: [05 overlapping reservations](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/05-overlap-capacity-desktop.jpg).

Correct interpretation: effort shown is 75 minutes (45 + assumed/default 30). Reservation demand is 360 minutes; unique occupied interval is 180 minutes; overlapping demand is 180 minutes. Do not call the first example six unique occupied hours. Some other calendar paths already warn about conflicts; the finding is path inconsistency.

Trace: [drawer apply](C:/Users/kunal/Desktop/Flow-task/src/components/tasks/drawer/TaskDrawerProperties.tsx:78) versus [dedicated createWorkSession conflict check](C:/Users/kunal/Desktop/Flow-task/src/services/workBlockService.ts:191).

### F03 — Lock bypass

**Type:** observed plus code trace. **Severity:** P0.

1. With Draft project proposal at 14:30–17:30, enable “Lock this task's scheduled time.”
2. Observe Locked state.
3. Open Edit Session, select Morning (08:00–11:00), Apply Session.
4. Task moves to 08:00–11:00. The lock remains checked and the row still indicates Locked.

Evidence: [13 lock bypass](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/13-lock-bypass.jpg), [saved accessibility state](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/13-lock-bypass.ax.txt), [16 checked lock after reload](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/16-locked-state.jpg). The screenshot shows lock state; the saved accessibility record contains the simultaneous 08:00–11:00 interval.

Trace: [drawer apply](C:/Users/kunal/Desktop/Flow-task/src/components/tasks/drawer/TaskDrawerProperties.tsx:78), [generic task update](C:/Users/kunal/Desktop/Flow-task/src/services/commandService.ts:108), contrasted with [locked work-session move](C:/Users/kunal/Desktop/Flow-task/src/services/workBlockService.ts:264).

### F04 — Capacity wording after non-overlapping reservations

**Type:** observed and arithmetic/code explanation. **Severity:** P0 presentation/contract.

After F03, the proposal occupies 08:00–11:00 and reading 14:30–17:30. These are six distinct reserved hours. The Plan header still reads 1.3 h planned / 6 h capacity. The daily planning confirmation separately used 75/360 min and reported 285 minutes of breathing room.

Evidence: [12 planning summary](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/12-planning-capacity-summary.jpg), [15 final reservations](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/15-reservation-capacity.jpg), [final accessibility state](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/15-reservation-capacity.ax.txt).

Trace: [effort aggregation](C:/Users/kunal/Desktop/Flow-task/src/utils/dayPlanSummary.ts:188), [breathing-room text](C:/Users/kunal/Desktop/Flow-task/src/components/workflow/DailyPlanning.tsx:203). This is not necessarily arithmetic corruption; it is an insufficiently disclosed distinction between task effort and scheduled occupancy.

### F05 — Unrelated breakdown

**Type:** observed plus pure-function reproduction. **Severity:** P1 credibility; release-blocking if the assistance is promoted as intelligent.

1. Open the local planning assistant.
2. Enter `decompose Audit onboarding accessibility`.
3. Observe four tax-related steps: gather receipts/1099s, reconcile income/expenses, complete filing and archive confirmation, totaling 110 minutes.
4. The same classification is reproducible directly in the decomposition function.

Evidence: [10 unrelated breakdown](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/10-unrelated-breakdown.jpg).

Trace: [tax template matches audit](C:/Users/kunal/Desktop/Flow-task/src/utils/aiCopilot.ts:37), [suggestSubtasks](C:/Users/kunal/Desktop/Flow-task/src/utils/aiCopilot.ts:119). A local template disclosure exists elsewhere; the report does not claim every assistant label conceals this. The task-row AI wording is nevertheless inconsistent with deterministic template behavior.

### F06 — General tasks become study sessions

**Type:** observed and direct selector logic. **Severity:** P1 semantic confusion.

After scheduling the ordinary proposal/reading tasks, Study Hub shows two planned sessions. [isStudyTask](C:/Users/kunal/Desktop/Flow-task/src/utils/taskSelectors.ts:37) includes any `sessionMetadata.isSession`, which the [drawer session handler](C:/Users/kunal/Desktop/Flow-task/src/components/tasks/drawer/TaskDrawerProperties.tsx:85) sets. This is not merely a badge opinion; it changes which work appears in a specialized view.

## Positive paths exercised

| Journey | Observed result | Evidence |
|---|---|---|
| Fresh landing → task | Captured Draft project proposal without an account; it appeared in Today/Top 3. | [01 first use](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/01-first-use-desktop.jpg) |
| Task → focus → saved cue | Started a 25-minute session, paused after about 22 seconds, saved “Open outline and write the first paragraph.” Cue appeared on the task; interrupted session finished and new cycle/reflection opened. | [02 Studio](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/02-studio-desktop.jpg); source [save action](C:/Users/kunal/Desktop/Flow-task/src/components/focus/FocusStudio.tsx:1513) |
| Note → linked task | Created Project context note, selected body text, chose Create linked task. Proposal context task appeared in Inbox with source linkage; Notes showed linked task. | [06 note link](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/06-note-task-link.jpg) |
| Narrow Today / Plan | Responsive layout and bottom navigation appeared; no document-level horizontal overflow in measured state. Capture was low on the screen. | [07 Today](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/07-today-phone.jpg), [08 Plan](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/08-plan-phone.jpg) |
| Modular Today | Top 3, tasks, study continuation, agenda and Quick Notes widgets rendered. Alternate hierarchy/duplication is a design concern, not a rendering failure. | [11 dashboard](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/11-dashboard-desktop.jpg) |
| Portable backup | Export downloaded to `C:\Users\kunal\Downloads\flowtask-local-2026-10-26.json`; parsed three synthetic tasks, one note, zero canonical workBlocks. | Export success only; restore not tested. Scheduled drawer tasks used legacy fields. |

The backup's **portable schema 8** and workspace runtime **schema 11** are intentionally different contracts in current source. That difference alone is **not a defect**. The audit did not repeat older claims that dependency-cycle validation or a shared focus runtime are missing; both exist in this tree.

## External public UI checks

- **Goblin.tools Magic ToDo:** entered the generic, non-sensitive “Write a short project proposal,” added it, invoked breakdown. Ten relevant but generic steps appeared at default granularity. [09 screenshot](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/09-goblin-breakdown.jpg). This is one example, not a broad model-quality benchmark.
- **myNoise rain generator:** inspected ten labeled spectral controls and selected Dark Rain preset. No audible playback-quality or concentration-effect claim is made.
- **Todoist pricing:** inspected INR annual pricing, changed currency to USD and verified annual versus monthly toggle. Pro showed $5/month annually/$60/year, then $7 monthly. [14 annual USD screenshot](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/14-todoist-usd-pricing.jpg). Business showed $8 annually/$10 monthly per member. No purchase made.

The complete external source links and pricing uncertainties are in the [competitive appendix](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/COMPETITIVE_INTELLIGENCE.md). No private Flowtask content was sent to competing services.

## Limits and next verification work

**Not established:** actual retention/PMF, actual willingness to pay, physical mobile usability, screen-reader compatibility, measured contrast across all themes, WCAG conformance, production loading latency, large-workspace performance, long-running/sleep timer reliability, closed-app notification delivery, signed-in concurrent cloud sync, actual calendar provider reconciliation, successful backup restore, packaged extension install, deployed cloud rules and malicious-actor resistance.

Source risks such as persistence cost, combined dependency-model complexity and provider maintenance were discussed as risks to test, not reported as confirmed user-visible defects. All user-outcome, ICP, differentiation and pricing proposals remain hypotheses until field validation.

Recommended next verification follows the roadmap's acceptance matrix: first reproduce/fix time guards and capture semantics in every entry point; then test recoverable migration/restore on supported Node and real browsers; then observe target users completing the simplified task-to-return journey. Do not substitute a higher test count for these specific outcomes.
