# Ecosystem upgrade implementation checkpoint

25 October 2026. This is the first implementation increment of the [ecosystem roadmap](research/2026-10-25-ecosystem/IMPLEMENTATION_PLAN.md), applied on top of the existing Antigravity changes. It does not mark all roadmap phases complete.

## Delivered in this increment

| Area | Behavior now implemented | Main source |
|---|---|---|
| Task availability | One pure eligibility module handles completion, deletion, archive, Someday, defer dates, explicit dependencies, sequential projects and archived projects. Today, priorities, focus suggestions, planning and execution use compatibility adapters around it. Captured blocked tasks remain available for inbox triage. | `src/utils/taskEligibility.ts`, `taskSelectors.ts`, `src/services/workspaceSelectors.ts` |
| Defer boundaries | Today, navigation counts and dashboard/focus consumers wake at the next defer boundary and reconcile when a sleeping tab resumes. The clock depends on boundary values, so fresh task arrays cannot trigger an effect loop. | `src/hooks/useTaskAvailabilityClock.ts` |
| Zoned work sessions | Creation, move and time edits derive clock labels from the saved IANA zone. Invalid local times and ambiguous DST inputs fail without mutation. End-time and duration edits keep both work-block projections consistent. Resize checks conflicts; day-capacity intersections account for midnight and DST. | `src/utils/zonedTime.ts`, `src/services/workBlockService.ts` |
| Scheduling eligibility | Preview checks project/dependency availability on the selected day; a timestamp defer boundary limits the earliest placement. Project state participates in the stale-preview fingerprint. Existing scheduled commitments remain visible. | `src/services/schedulePlanner.ts`, `src/utils/autoSlotAlgorithm.ts` |
| Safer Balance Day | The user reviews named flexible tasks before one atomic command. Priorities, deadlines due today/overdue, locked work and existing schedules are protected. One Undo restores the batch. | `src/components/views/today/TodayFocusProgressBar.tsx`, `src/utils/rolloverEngine.ts` |
| Honest finish forecast | The label says Estimated finish, exposes a next-day offset and warns when continuous remaining work extends past planning hours. This is an approximation around timed calendar commitments. | `src/utils/dayPlanSummary.ts` |
| Five-minute start | Single-Task Horizon starts a persistent 300-second countdown through the shared focus lifecycle, without rewriting the task estimate. An existing session is reopened. The execution boundary rejects unavailable tasks. | `HorizonTodayView.tsx`, `src/services/focusLifecycle.ts` |
| Clearer Today | Timeline, Options and Plan my day form the primary controls. Options contains routines, single-task mode, daily notes and customization. Morning requires an actual morning time; deep work in the afternoon stays in Daytime Flow. Photo backgrounds have opaque task-reading surfaces. | `HorizonTodayView.tsx`, `src/styles/workspace.css` |
| Mobile Plan | The unscheduled tray starts collapsed below 1024px, with an accessible count/toggle, leaving the calendar reachable. Desktop keeps the tray beside the calendar. | `TimelineView.tsx`, `src/styles/plan.css` |

Existing Antigravity work—decomposition controls, magnetic timeline behavior, completion feedback, the audio mixer and tab HUD—was retained. This increment hardens specific behaviors and improves the daily workflow; it does not claim those earlier features as new work here.

## Data compatibility decisions

- No schema bump, dependency addition or bulk rewrite of saved schedules.
- Workspace-level work blocks are preferred when editing a known block; embedded blocks remain a compatibility projection and are written in the same workspace transaction.
- Existing inconsistent historical instants/clock labels are preserved until an explicit time edit. A later migration must snapshot, classify and visibly repair ambiguous records. A fixed-offset repair is unsafe.
- Sequential projects retain the existing `createdAt`, then ID ordering. Explicit per-project task order and its migration remain a follow-up.
- With a complete workspace, completed, archived, deleted or missing dependency records do not block the task. A context-free predicate conservatively retains explicit blockers. Dependency creation still needs the planned cycle/self-reference audit.
- Offline caching keeps core routes and Settings available on first install. The Routines library follows other secondary screens: load it online once before relying on it offline. Its assets use the existing runtime cache. Asset limits were kept unchanged.

## Verification

Evidence lives in [the implementation evidence folder](evidence/2026-10-25-implementation/). The baseline reproduced Antigravity's 167 suites / 1,331 passing tests under Node 22. Final verification results are recorded after the production browser pass.

New tests exercise eligibility parity, defer wakeups, zoned round-trips (India, Nepal, UTC+14 and DST), failed-write atomicity, work-session persistence, resize conflicts, protected rollover, focus lifecycle and the changed UI. `e2e/ecosystemFoundation.spec.ts` covers dependency completion, resumed-tab availability, balance/Undo/persistence, a real five-minute session, and Today/Plan at 320, 390 and 1440px.

## Next bounded work packages

1. Finish phase 0's schedule migration and entity-contract ledger. Define repair UI for inconsistent historical blocks and explicit sequential ordering before expanding automation.
2. Complete phase 1's task drawer, capture and accessibility work. Extend the reading-surface audit across all themes and image choices; validate long titles and physical phone input.
3. Phase 2: route manual drop, resize, keyboard moves and preview application through one schedule validator/command. Migrate legacy task-clock placement conservatively and add collision explanations.
4. Phase 3: editable small-step decomposition with provenance, clear resume behavior, next-action context and outcome measurements. The existing heuristic splitter is not a verified AI planning service.
5. Continue notes/project continuity, browser capture, provider calendars and adaptive environments in the roadmap's dependency order. These remain separate increments with their own acceptance gates.

Local automated verification does not substitute for authenticated provider checks, physical-device checks or monitored beta usage. Existing deployment requirements in the repository continue to apply.
