# Product audit evidence

25 October 2026 · current working tree · no application implementation changes

Main deliverable: [First public release audit and development plan](../../PUBLIC_V1_AUDIT_AND_ROLLOUT_PLAN_2026-10-25.md).

## Environment and boundaries

- Workspace: `C:\Users\kunal\Desktop\Flow-task`.
- Git HEAD: `b2e8726b5a353f4a2ee3ebfb6faba74f2654d88c`, with substantial existing uncommitted changes.
- UI: current Vite development server at `http://localhost:5173`; separate in-app browser context with synthetic task/note/Area/Goal inputs.
- Required runtime used for final verification: Node 22.23.4. Initial diagnostic runs on the machine default Node 25.6.1 are not release evidence.
- Fresh Node 22 production output: `C:\Users\kunal\AppData\Local\Temp\flowtask-public-audit-20261025-01a17120-node22\dist`. Existing repository `dist` was not rebuilt.
- Browser UI inspection was against development code. The isolated production build was compiled and measured; its full browser matrix was not run here.
- No customer account sign-in, hosted data mutation, deployment, account deletion, browser permission grant, or billing operation was performed.
- No claim is made about physical phones, screen-reader acceptance, current hosted sync, or field Core Web Vitals.

## Reproductions

### Life Area lost on navigation

1. Open Life Areas and select New Life Area.
2. Enter `Audit Area — Persistence`, then Save Area.
3. Confirm the new card exists.
4. Open Today, then return to Life Areas.
5. The new Area no longer exists. The five hard-coded default cards return.

Evidence: [created Area](life-area-created.png), [after navigation](life-areas-after-navigation.png). Source: `LifeAreasView.tsx:28` uses component-local state.

### Goal lost on navigation

1. Open Vision & Goals and select New Goal.
2. Enter `Audit Goal — Persistence`, then Save Goal.
3. Confirm the new Goal exists.
4. Open Today, then return to Vision & Goals.
5. The new Goal no longer exists; the hard-coded starter objectives remain.

Evidence: [created Goal](goal-created.png), [after navigation](goals-after-navigation.png). Source: `GoalsView.tsx:45` uses component-local state.

### Deferral does not hide a task

1. Capture `Audit release brief today #work p1 ~30m` in Today.
2. Confirm the task survives reload.
3. In task details, set Defer Until to `2026-11-01` while the current date is `2026-10-25`.
4. The field says it hides the task from Today until that date.
5. Close details and reload. Today still contains `Audit release brief`.

Evidence: [saved future date](defer-date-set.png), [Today after reload](deferred-task-still-in-today.png). The page query returned one matching task. `utils/taskSelectors.ts` does not use the new defer predicate.

### Routine progress resets

1. Open Today → Launch Routine.
2. Advance from “Hydrate & 5 deep breaths” to “Review Top 3 Focus priorities.”
3. Close the runner and reopen it.
4. It returns to step 1. A started timer also returns to its initial stopped state on reopening.

The dialog initially retained focus on the launcher in the underlying page. Its local state and fixed default routine are visible in `RoutineRunner.tsx` and `ModalRoot.tsx`.

### Mobile layout defects

- At measured **320 × 800 CSS px**, Goal completion controls measured approximately **8 × 20px**; status content clipped even though document width equaled viewport width.
- At measured **390 × 844 CSS px**, the multi-day calendar retained the 256px staging shelf, leaving the calendar with an unusably narrow visible portion.
- Mobile Today used substantial first-screen space for controls and empty priorities ahead of the existing task.
- Actual 768 × 1024 and 1440 × 1000 CSS px layouts were also inspected. Early desktop screenshots were approximately 1309px wide. A screenshot filename alone should not be used to infer a measured viewport.

Evidence: [320px Goals](goals-mobile-320.png), [390px Goals](goals-mobile-390.png), [390px Life Areas](life-areas-mobile-390.png), [mobile Grid](plan-mobile-390.png), [tablet Today](today-tablet-768.png), [1440px Today](today-desktop-1440.png).

## Positive journeys verified manually

- Task capture resolved Work/P1/30 minutes, displayed the task in Today, and survived reload.
- Automatic scheduling opened a selection/preview dialog, proposed 09:15–09:45, applied the block, and offered Undo. The audited session was around 09:08 IST when the preview was generated.
- A note titled `Audit release checklist`, with Markdown body and Work assignment, persisted through navigation/reload.
- Global search for Audit returned both the task and the note.
- Task-linked focus started, paused, survived reload in the paused state, and finished. The local summary showed six seconds of focused time.
- Notes provided a separate mobile editor with a return-to-library action.
- Landing and Help loaded; landing labels its preview as illustrative and describes backup/storage limits.

These checks demonstrate specific local journeys. They do not establish correctness of every edge case or current cloud deployment.

## Fresh automated and build results

| Check | Result | Evidence |
|---|---|---|
| TypeScript | Pass, including Node 22 build preparation | `tsc -b --pretty false` |
| Lint on Node 22 | Pass | [lint log](lint-node22.log) |
| Node 22 unit/components | 161 files / 1,280 tests passed | [unit log](unit-node22.log) |
| Node 22 security/server suite | 15 tests passed | [security log](security-node22.log) |
| Fresh Node 22 production build | Pass | [build log](build-node22.log) |
| Existing budget script, fresh Node 22 output | Fails planner initial CSS assertion | [budget log](budgets-node22.log) |

Build metrics:

| Measure | Bytes | Existing limit | Result |
|---|---:|---:|---|
| Landing JS, gzip | 169,252 | 184,320 | Within |
| Planner JS, gzip | 343,105 | 409,600 | Within |
| Landing CSS, gzip | 31,042 | 35,840 | Within |
| Planner CSS, gzip | 36,920 | 35,840 | Over by 1,080 |
| Core precache | 1,748,017 | 1,677,721.6 | Over by approximately 70,295 |

The core precache contains 65 local entries. It was measured separately by extracting the local precache URLs from the generated `sw.js` and summing their file sizes. The checked-in budget script aborts on CSS before reaching its precache assertion.

Tests emitted React `act(...)` warnings and expected fallback logs. All tests passed; warnings remain useful cleanup work and are not converted into test failures in this report.

The build reports ineffective dynamic imports of `useNotes`: static consumers already keep it in the dependency graph. This is a concrete optimization investigation point, not proof that this module alone caused the budget regression.

The current rules emulator, dependency vulnerability audit, production browser matrix, hosted staging journeys, and lab/field performance were not rerun in this audit. Historical results remain in their original evidence directories and are not presented as current acceptance.

## Selected screen references

- [Task details on desktop](task-drawer-desktop.png)
- [Task details on mobile](task-details-mobile-390.png)
- [Project editing / Area assignment gap](project-area-assignment.png)
- [Plan on desktop](plan-desktop.png)
- [Multi-day Grid on desktop](plan-multiday-grid.png)
- [Notes checklist preview](notes-checklist-preview.png)
- [Notes on mobile](notes-mobile-390.png)
- [Global search](global-search.png)
- [Quick capture](quick-capture.png)
- [Settings Data](settings-data.png)
- [Review](review-desktop.png)
- [Weekly Review](weekly-review.png)
- [Help](help-mobile.png)

Some additional screenshots in this directory record intermediate screens and transitions. The reproduction notes and final verification above define the findings; a screenshot captured during a transition is not treated as a functional failure.

## Standards used for proposed acceptance

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/): AA target, including focus, keyboard, dragging alternatives, contrast, labels, reflow, and target-size requirements with exceptions.
- [Google Web Vitals](https://web.dev/articles/vitals): LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75; distinguish lab and field evidence.
- [OWASP ASVS 5.0](https://asvs.owasp.org/): requirements/evidence framework for relevant application security controls.

These are proposed verification targets. This audit does not certify conformance.
