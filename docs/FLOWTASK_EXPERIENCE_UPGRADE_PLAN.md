# FlowTask: a simpler workspace for meaningful progress

Product and experience upgrade plan · 27 October 2026  
Status: proposed specification, with an interactive concept. Product implementation remains future work.

## The decision

Make FlowTask the place where a person turns unclear work into a realistic next action, does it with the right context, and returns easily after an interruption.

The product promise is: **Open your workspace. Know what matters. Make the next step easier.**

The upgrade should improve the connection between existing capabilities before expanding their number. A beautiful workspace earns its place by helping someone start, stay oriented, and finish. The standard of a leading global product is coherence, accessibility, speed, dependable data, and careful detail across ordinary and difficult states.

The initial design assumption is a person managing individual knowledge work across a few projects. Students, builders, and professionals should all be supported; the first usability cohort should represent one of these groups so its findings are interpretable. Team administration and regulated enterprise features require separate discovery.

## 1. What exists, and what actually needs to change

This plan builds on the current repository, the 26 October strategy review, and the 27 October visual redesign. It replaces overlapping UI recommendations with one proposed implementation sequence. It does not replace the production-readiness runbook or declare previously reported defects fixed or still reproducible without a new check.

| Capability | Current evidence | Upgrade decision |
|---|---|---|
| Today and customizable dashboards | `TodayView.tsx` switches between Horizon and dashboard composition; `DailyDesk.tsx` provides another guided daily composition | One default Today with saved layout preferences. Reuse useful dashboard modules inside it. Existing custom dashboards remain accessible under Library. |
| Navigation | `Sidebar.tsx` groups daily destinations, life tools, perspectives, pins, and projects | Five primary destinations. Keep specialist tools searchable, pinnable, and reachable in Library. |
| Actionable steps | Tasks already have `nextAction`, subtasks, estimates, dependencies, and milestones | Bring the next action to the working surface. Improve the breakdown flow rather than building a second task model. |
| Suggested breakdown | `TaskDrawerSubtasks.tsx` immediately calls `addSubTasks` after generation; `aiProviderService.ts` supports configured providers and local fallback | Shared draft → edit → apply flow across all suggestion entry points. Accurate provider/fallback labels. |
| Focus | `FocusStudio.tsx`, `FocusEngineModal.tsx`, mini player and PiP; session types already include task/subtask IDs | One session lifecycle and one task context, with different presentations. Audit reachable routes before retiring old components. |
| Time planning | Canonical `WorkBlock` and legacy schedule fields coexist; shared adapters, eligibility, and planning services exist | Use the existing time model and migration work. Verify every writer and lock path before redesigning scheduling interactions. |
| Tracking and review | Focus logs, time summaries, reviews, Insights, Logbook, and guided rituals exist | One Review destination with evidence first and decisions next. Distinguish recorded effort, completion, and calendar occupancy. |
| Customization | Themes, backgrounds, Studio palettes, dashboards, workspace preferences | A small set of useful personal defaults, live preview, reset, and preservation of existing preferences. |
| Reliability | Local persistence, command services, recovery, optional sync, release checks | Preserve and extend these foundations. A visual migration must remain recoverable. |

Principal source files: [Today](../src/components/views/TodayView.tsx), [daily desk](../src/components/dashboard/DailyDesk.tsx), [navigation](../src/components/layout/Sidebar.tsx), [task drawer](../src/components/tasks/TaskDrawer.tsx), [breakdown](../src/components/tasks/drawer/TaskDrawerSubtasks.tsx), [AI providers](../src/services/aiProviderService.ts), [task/session types](../src/types/task.ts), [time summaries](../src/utils/taskTimeSummary.ts), [review](../src/components/views/ReviewView.tsx), [commands](../src/services/commandService.ts), [workspace](../src/services/workspaceStore.ts).

Visual evidence reviewed: the existing desktop Today and active Studio images in [the 27 October redesign evidence](research/2026-10-27-calm-redesign/evidence/). These show the earlier local redesign, rather than a new production audit. A fresh local browser DOM inspection was possible, but screenshot capture failed and the displayed composition did not reconcile with the inspected source. It is excluded from current-layout claims; reconcile the preview origin/build before implementation QA.

The earlier [validation record](research/2026-10-27-calm-redesign/VALIDATION.md) reports a planner CSS budget failure. Treat that as an unresolved checkpoint to remeasure, not permission to raise the limit. The [strategy report](research/2026-10-26-strategy/REPORT.md) supplies useful trust and migration findings; recheck its affected paths against current code when taking the corresponding tickets.

## 2. One daily loop

**Capture → clarify → choose → focus → record → review → return.**

Each transition should preserve the same task, its steps, context, and history. Users can enter anywhere: a quick captured thought does not require planning, a task does not require a project, and a focus session does not require an estimate.

| Moment | The user sees | Primary action | Result |
|---|---|---|---|
| First visit | One input and a short invitation to try a task | Add task | A useful personal item appears immediately; onboarding can end here. |
| Return | Unfinished work and its saved next action, if present | Resume | The correct task and relevant context reopen. |
| Unclear work | The task, a short outcome prompt, and optional suggested steps | Make a plan | A small editable proposal; nothing is inserted before Apply. |
| Choose today | A short ordered list and an honest capacity summary | Choose today's work | Intentional commitments, with deadlines shown separately. |
| Execute | Current step, task title, relevant note, and optional timer | Start / Resume | One session attached to that task or step. |
| Interrupted | Pause plus optional “Leave a return note” | Park for later | Measured work is saved and the task remains unfinished. |
| Stop | Session time and a short outcome choice | Save progress | Step/task completion remains an explicit decision. |
| Close the day | Completed work, unfinished choices, tomorrow's first action | Finish review | A saved review and only the task changes the user selected. |

Example: “Prepare customer demo” becomes “Select the three scenarios to show — about 10 min.” A completed focus interval may help finish that step; it does not automatically complete the demo. If interrupted, “Continue with the checkout scenario; test account is in the linked note” becomes the return cue.

## 3. A smaller product structure

### Primary navigation

1. **Today** — choose and do the next useful thing.
2. **Inbox** — capture and clarify unsorted work.
3. **Plan** — one day/week planning surface with list and calendar presentations.
4. **Projects** — outcomes, milestones, actionable tasks, and related context.
5. **Review** — progress, patterns, and decisions for the next period.

**Focus** is an always-available action that opens the current session or starts with the selected task. It is a working state, with a persistent session indicator when the user navigates elsewhere.

**Library** is a secondary disclosure for Notes, Study, Goals, Areas, Routines, custom dashboards, saved views, Archive, and Trash. Existing content remains discoverable through search and deep links. Users can pin a library tool or project beside the primary destinations. Notes stays one action away through its pin or the Library menu.

Search, quick capture, and the command menu share a consistent location and naming. Advanced shortcuts accelerate visible actions; they do not become the only way to find them. Inbox means captured work, with a separate future decision for notifications.

### Today, rebuilt around action

Above the fold at a normal laptop size:

- Date, Today, and a quiet Customize action.
- **Next up:** one chosen task, its next action, and Start/Resume. A paused session takes precedence; otherwise preserve the user's order. Suggestions explain their basis and never silently reorder the list.
- One-line capacity context with distinct estimates and available time; show missing estimates.
- A single capture row and today's ordered work.

Completed work is collapsed after it stops being useful to the current task. Empty evening, study, goal, ritual, and backlog sections do not reserve space. Overdue work becomes one “Review unfinished work” entry with explicit choices to keep, defer, or drop; genuine deadlines remain visible.

Top 3 becomes an optional “Today's priorities” grouping inside the same list. Default guidance suggests a small set; users can work without pinning or enforcing a fixed count. One task appears once in this surface even if it is both scheduled and a priority.

The optional context rail answers one question at a time: task details, today's schedule, or the helper. Opening task details replaces the existing rail rather than adding another competing column.

### Project workspace

Show the desired outcome, next milestone, next actionable task, and relevant notes/resources before project analytics. List is the default; Board and Timeline are alternate views of the same objects. Dependencies explain “Waiting for…” and exclude blocked work from Start suggestions. Milestone progress links to actual tasks and supports explicit milestone completion; task count is never described as percent of outcome achieved.

## 4. Break complex work into actions that can be started

The task surface has three visible essentials: title, next action/steps, and Start. Scheduling, recurrence, tags, dependency editing, history, and study-specific properties are in clearly named disclosures.

**Make a plan flow:**

1. Start from the task's existing title and description. Offer “What would done look like?” only when useful; allow skipping.
2. Produce a draft of roughly 3–5 concrete steps. Each describes an action and a recognizable result. Estimates are editable suggestions and may be omitted.
3. Let users edit, remove, reorder, or add steps before applying. Preserve completed steps. Identify duplicates and distinguish Add from Replace unfinished steps.
4. Offer “Make this step smaller” on one difficult step. Keep the normal hierarchy to task → step; promoting a step to a separate task retains context and is explicit.
5. Select a first step and apply one reversible command. Start uses that step's existing identity.

Provide “Find a 5-minute start” for a small foothold. Five minutes is a suggested session length, not a promise that the entire result can be achieved. Users can write their own first step without generating a plan.

The local fallback is called **Template suggestion**. A configured remote provider is named truthfully, and the product shows which task/context excerpt is sent. Provider failure keeps the user's draft and offers a local template; cancellation cannot apply a late response. Avoid suggesting code-specific steps for unrelated life tasks. Do not imply local generation when a remote provider is configured.

Quality gate: evaluate a fixed set of at least 30 varied tasks, including ambiguous, domestic, academic, creative, and technical work. Human reviewers assess relevance, clarity, feasible first action, and invented assumptions. The desired release gate is at least 90% usable without substantive correction, with no known materially misleading examples. This is a proposed product threshold, not an efficacy claim.

## 5. Focus as a continuous workspace

### Start

From a task, Start begins using the last appropriate session preference. First use offers a simple default duration and a visible alternative to work without a countdown. Room, sound, and advanced rhythm controls remain optional. Do not start audio automatically.

### During work

Keep visible: task title, current action, optional timer, Pause, and End session. A small disclosure reveals remaining steps and linked context. “Mark step done” and “Mark task done” are distinct actions. A distraction can be captured into Inbox without switching away from the task.

Use the same runtime for desk, minimal view, immersive Studio, and floating timer. Changing presentation, route, theme, or viewport cannot create a new session, restart the clock, or write an extra log. Preserve current task/subtask IDs. Keep PiP/fullscreen as enhancements with working fallbacks.

### Pause and return

Pause is immediate. An optional return note can be added afterward. Closing Focus returns to the workspace while the session's state remains clear. A session that was running stays running unless the user pauses or ends it; a paused session remains paused. Explain and test this consistently.

Returning presents the saved next action and relevant note, with “Resume this step” as the main action. If a scheduled reservation has passed, offer a reviewed planning change separately from continuing work.

### End

Show recorded focus time and simple choices: **Keep working later**, **Step finished**, **Task finished**. An optional short note can preserve the next action. Breaks are offered after saving progress and can be skipped. Closing the summary does not imply task completion.

State contract: ready → running ↔ paused → ended. Step completion and task completion are domain commands alongside this lifecycle, not hidden timer transitions. Implement this as an adapter to the existing lifecycle; reconcile its current `completed` and `outcome` semantics before considering a schema change.

## 6. Tracking that leads to a decision

| Question | Evidence shown | Useful next action |
|---|---|---|
| What moved forward? | Completed tasks/steps and the associated project | Continue the next unfinished step. |
| Where did my effort go? | Recorded focus by project; unattributed time remains visible | Assign context or adjust the next commitment. |
| What is blocking me? | Blocked tasks, dependencies, and repeated deferrals | Clarify, split, wait deliberately, or drop. |
| Is the day realistic? | Remaining estimated effort, reserved time, meetings, and free intervals | Remove a commitment or preview a revised plan. |
| What should change next week? | Commitments, completions, carryovers, and optional reflection | Choose one specific adjustment. |

Daily review should be completable in roughly two minutes: see progress, decide unfinished work, choose an optional first action for tomorrow. Weekly review has three steps: inspect meaningful progress, resolve stuck work, choose the next priorities. Preserve drafts and allow exit/resume. Longer analytics live behind details in Review.

Tracking rules:

- Recorded focus excludes breaks and pauses, is deduplicated by session/segment identity, and survives retries and reloads.
- Task and subtask time are two views of attributed work; never sum both into the project total.
- Planned estimates, elapsed time, remaining estimates, and occupied calendar intervals have separate labels and calculations. An expired estimate does not mean the task is done.
- Untimed work says “No estimate”; untracked work says “No time recorded.” Neither is evidence of no progress.
- Manual time, if introduced, is labeled, editable, and included once. Do not add it until its reconciliation policy is implemented.
- Day/week boundaries use the chosen reporting timezone. Midnight and timezone changes must not duplicate totals; reporting policy remains stable and visible.
- A changed estimate does not rewrite a historical review snapshot. New work added midweek is separated from the original commitment when showing follow-through.
- No opaque productivity score, task-count leaderboard, compulsory streak, or claim that long timer sessions equal good outcomes.

## 7. Customization with good defaults

**Quick Customize** previews a few everyday choices: comfortable/compact density, reading size, light/dark/system appearance, background or plain canvas, and context rail visibility. Apply and Cancel are explicit; Escape cancels an unfinished preview. Reset restores layout or appearance independently, without affecting work data.

**Saved workspace presets** arrive after the default workflow is stable:

- Daily work: next action and today's list.
- Planning: same tasks beside the calendar.
- Study: relevant study context and actionable targets.
- Personal: a quiet list with chosen routine/context modules.

These are starting layouts, not separate task databases or identities. Reuse the existing dashboard model where possible; create a thin presentation preference adapter rather than another workspace store. Copy a preset before customization, preserve existing custom dashboards, and offer a recoverable migration.

Advanced options include pinned destinations, visible row metadata, week start, working hours, optional sounds, and focus appearance. Retain existing theme and Studio selections. More themes are a lower priority than making the current themes consistently readable.

Persist semantic choices across devices where sync supports them. Keep viewport geometry, fullscreen/PiP state, local media references, and transient drawer positions device-local. Media remains subject to current backup exclusions. Preview all appearances against real task titles, error states, and keyboard focus.

## 8. Visual direction and viewport contract

### Art direction

Use the current warm-paper/sage direction as a base. Give work a clear typographic hierarchy, strong readable titles, quiet surfaces, and one primary accent. Use the existing Plus Jakarta Sans and tabular timer numerals. Favor repeated task rows, consistent spacing, restrained borders, and a smaller number of large surfaces.

The signature element is the **Next up** surface: a clear next action, recognizable project context, a little warmth, and an obvious route into work. It must also work with no background image, no animation, and a long task title.

Use an 8px spacing rhythm with 4px subdivisions, comfortable 14–16px body text, control heights around 36–40px on desktop and at least 44px for primary touch actions, and shared control/section corner tokens. Treat these as proposed design tokens to validate, not a demand for a second parallel stylesheet.

Motion provides feedback for state changes only: completion, panel entry, and focus handoff. Suggested durations are 120–180ms for local feedback and at most about 220ms for larger transitions. No repeating decorative motion during work; honor reduced motion. Read the applicable motion skills when implementing those transitions.

### Responsive layout

Layout responds to the available content width, text scaling, and open panels rather than the device label alone.

| Available space | Composition | Interaction rule |
|---|---|---|
| Narrow phone, including 320px | One content column; compact header; Today/Inbox/Add/Plan/More bottom navigation | Task titles wrap; details become a full-page sheet. Protect actions from keyboard and safe-area overlap. |
| Tablet or narrow desktop | Collapsible navigation and one working column | Schedule/details replace the current context region or open an accessible sheet. |
| Ordinary laptop | Navigation plus readable main work; one optional rail only when it fits | Closing the rail immediately restores task width. Task details replace the schedule rail. |
| Large desktop | Stable sidebar, main work region, and one useful context rail | Constrain reading widths; additional screen space improves context and breathing room. |
| Short landscape or high zoom | Reduced chrome and reflowed session controls | Every primary control remains reachable without a trapped nested scroll area. |

Initial geometry candidates: sidebar 216–232px, main comfortable width about 560–800px, secondary context 288–360px. Require room for these regions plus gutters before displaying a rail; otherwise collapse it. These are layout preferences, not minimum requirements imposed on phones.

Preserve one primary content scroll. Avoid nested scrolling inside short task cards. Resizing or changing presentation preserves drafts, selected task, current step, and session state. The active session indicator cannot cover capture or task actions.

### Accessibility and global quality

Target WCAG 2.2 AA, with manual verification of the core journey. Use visible focus, meaningful labels, sufficient contrast across all shipped themes, text alternatives to color, predictable focus restoration, accessible validation, keyboard scheduling alternatives to drag, and reduced-motion support. Test 200% text scaling and 400% zoom/reflow, long/localized strings, screen readers, and touch.

Use locale-aware dates and durations, explicit timezone behavior, configurable week start, international text input, and layouts capable of RTL. Do not promise full localization until translations and QA exist.

A global-quality product also needs understandable offline/save/sync states, recovery, import/export, loading/empty/error states, and stable performance. “Enterprise-ready” security, SSO, RBAC, compliance, and team administration are separate capabilities and should not be claimed from visual polish.

## 9. Technical approach: consolidate the existing system

Keep React, TypeScript, Zustand, IndexedDB, optional Firebase, and the existing command/undo architecture. The plan calls for incremental composition and policy consolidation; there is no justified framework rewrite.

| Area | Reuse | Proposed change / seam |
|---|---|---|
| App shell | `AppLayout`, `Sidebar`, `DesktopHeader`, `ViewContainer` | Shared destination registry, consistent capture/search, one secondary rail controller, route aliases. |
| Today | `TodayView`, `HorizonTodayView`, `DailyDesk`, useful dashboard widgets | One composition; shared selectors for next action, priorities, completed work, and capacity. |
| Task work surface | `TaskDrawer`, `TaskExecutionDetails`, drawer sections | Essentials first; shared breakdown draft; same working context in Focus. |
| Breakdown | `aiProviderService`, local templates, command services | Validated proposal object, cancellation/stale-result handling, editable diff, one apply/undo. |
| Focus | `useFocusStore`, `focusLifecycle`, `focusSessionService`, `FocusStudio`, checkpoint/PiP | Shared task/subtask context adapter and common outcome actions across every reachable presentation. |
| Planning | `WorkBlock`, `schedulePlanner`, `scheduleAdapter`, eligibility | Universal lock/conflict checks; proposal and one apply operation; explicit remaining-effort semantics. |
| Review | `ReviewView`, `FocusLog`, `ReviewEntry`, existing summaries | Shared evidence selectors and one guided decision surface. Snapshot period facts deliberately. |
| Personalization | Existing settings, appearance, dashboard model | Semantic workspace preference adapter; migration/versioning only when needed. |
| Persistence | `workspaceStore`, `commandService`, recovery/sync pipeline | Preserve atomic commands, safe retries, undo, export/restore, and compatibility. |

Do not introduce a parallel “action,” “session,” or “progress” database. `SubTask.id`, `FocusSession.subtaskId`, and `FocusLog.subtaskId` already establish useful identities. First derive the selected next step from these and the existing `nextAction` field. Only introduce an additive next-step pointer or completion criterion field if the implemented interaction proves it necessary; then audit validation, imports, backups, sync rules, and older clients together.

For an approved draft, carry source entity revision/fingerprint so an old proposal cannot overwrite newer work. Review/apply should be idempotent. Keep generated content outside durable task state until Apply. If the source changes while generation runs, refresh the proposal or explain the conflict.

Before consolidating Focus views, build a route/command reachability map. Remove obsolete paths only after a shared lifecycle test covers launch, step switch, pause, reload, PiP, navigation, and end. Before changing time writes, characterize legacy and canonical records and follow the existing recovery migration plan.

## 10. Prioritized implementation backlog

Effort is a planning range of focused engineering days for one developer familiar with this repository, with design help. It excludes user recruitment, waiting for external services, and unknown production failures. Estimates should be revised after the first gate; they are not delivery commitments.

| ID | Priority / scope | Effort | Depends on | Acceptance |
|---|---|---:|---|---|
| E01 | P0 — Baseline and reconcile preview/build, current defects, critical route map, CSS budget | 2–4d | — | Current reproducible evidence; supported runtime identified; benchmark numbers recorded; failing trust/budget gates triaged. |
| E02 | P0 — Verify/repair shared time and session invariants | 5–10d | E01 | Locks/conflicts consistent across writers; no duplicate logs; explicit completion; backup/restore and retry scenarios pass. Larger schema migration receives its own revised estimate. |
| E03 | P0 — New shell and canonical Today composition | 4–7d | E01; ship after E02 | Five clear destinations; legacy links work; single task representation; next action and capture above fold on laptop; no lost custom dashboards. |
| E04 | P0 — Task essentials and editable breakdown | 4–7d | E02, E03 | Draft survives cancel/error appropriately; no insertion before Apply; completed steps preserved; one undo; manual start remains immediate. |
| E05 | P0 — Focus continuity and shared outcome flow | 5–8d | E02, E04 | Same task/step/session survives all presentations, interruption and reload; session end never silently completes the task. |
| E06 | P1 — Unified planning and reviewed day repair | 4–8d | E02, E03 | Effort/occupancy labels agree; unknown estimates visible; locked blocks protected; apply/undo atomic; keyboard alternative works. |
| E07 | P1 — Outcome tracker and daily/weekly reviews | 4–7d | E02, E05 | No time double-counting; unfinished decisions explicit; review draft recovery; next priorities use actual task links. |
| E08 | P1 — Quick Customize and preserved workspace preferences | 3–5d | E03 | Preview/apply/cancel/reset; readable themes; existing choices retained; device-local geometry does not overwrite synced semantics. |
| E09 | P0 release gate — Responsive, accessibility, performance, migration and device QA | 5–8d | E03–E08 | Core journeys pass across target sizes and input methods; existing budget limits pass; no open critical data-loss or accessibility issue. |
| E10 | P1 — Presets, small quality fixes, and observed workflow refinements | 3–6d | E08, formative study | Presets reuse work data; useful changes trace to observed problems; optional tools remain discoverable. |

Suggested sequence:

- **Gate A, foundation:** E01/E02, design tokens, and formative concept testing. Resolve known trust failures before any public planning claims.
- **Gate B, usable vertical slice:** E03–E05. Deliver capture → next action → Focus → saved progress → return as one locally testable workflow.
- **Gate C, full daily system:** E06–E08. Connect realistic planning, actionable review, and restrained customization.
- **Gate D, release candidate:** E09 and focused E10 refinements. Opt-in migration and a monitored beta precede a default rollout.

The bounded experience program is roughly **8–14 engineering weeks**, plus a four-week beta observation period that can partly overlap late work. A significant canonical-time migration, a sync redesign, or a new provider integration expands that range and should trigger replanning. A smaller first release ends at Gate B; it must still meet the reliability and responsive gates for its shipped scope.

### First implementation slice

Start with E01, then ship **one coherent Today → task → Focus journey**. Include the simplified shell, Next up, editable step preview, task-linked session, explicit progress saving, and return cue. Validate this before adding presets, new analytics, integrations, or ambient content.

Implementation checklist:

- Inventory existing view aliases and focus commands; capture compatibility tests.
- Reconcile one Today composition and reuse existing task/time selectors.
- Give a selected task one stable work-context adapter.
- Route all step suggestion buttons through the shared proposal flow.
- Make the default Start action use the existing runtime and selected step.
- Unify end-session outcome actions and preserve the return cue.
- Verify real capture → focus → interruption → reload → return → review behavior on desktop and phone.

## 11. Validation that measures useful work

These are provisional product targets, not measured improvements or industry benchmarks. Establish the baseline before claiming a gain.

| Measure | Proposed gate / definition |
|---|---|
| Discoverability | At least 7 of 8 new participants can capture, clarify, start, and find saved work without coaching. Record exact counts and failures. |
| Capture speed | Median correct capture within 10 seconds once the app is ready, including confirmation of any parsed date. |
| Start friction | Existing selected task starts in one primary action; most new participants begin useful work within 60 seconds of arrival without appearance setup. |
| Return clarity | At least 7 of 8 can identify their correct next action and resume within 15 seconds in an interrupted-work scenario. |
| Breakdown usefulness | Human-reviewed task set meets the relevance gate in section 4; report local-template and remote-provider results separately. |
| Review usefulness | At least 7 of 8 can resolve unfinished work and choose a next action in about two minutes; qualitative feedback explains whether it helped. |
| Reliability | Zero known critical data loss, duplicate time logging, lock bypass, or broken restore cases in the shipped scope. |
| Recurring value | In a 20–30 person beta, report meaningful progress days, D7/D28 return counts, abandonment reasons, and preference versus their existing tool combination. A meaningful day includes explicit progress or a useful review decision; a timer left running alone does not qualify. |

Suggested formative tasks: capture a thought; clarify an ambiguous project; complete one step; receive an interruption; return after reload; handle a missed block; finish a daily review; change density and reset it; find an older note. Use participant-controlled examples and compare with their current workflow.

Instrumentation should use existing opt-in diagnostics boundaries. Collect numeric/timing events without raw task titles, note content, resource URLs, or provider prompts. Define denominators and exclusions before measuring. Research consent and participant recordings are separate from product telemetry.

### Verification matrix

Required sizes: 320×640, 390×844, 768×1024, 1024×768, 1366×768, 1440×900, 1920×1080, plus short landscape and zoom/reflow cases. Include a real iOS/Safari device, Android/Chrome, and keyboard/screen-reader desktop checks; browser emulation does not establish OS behavior.

Required states: empty workspace, long task titles, 100+ visible candidates, large stored history, blocked task, missing estimate, overdue deadline, active/paused/restoring session, offline write, storage failure, pending sync, cloud conflict, missing personal media, stale generated proposal, and interrupted migration.

Use domain tests for changed accounting/command invariants, component tests for proposals and focus restoration, and a small set of end-to-end journeys for real cross-surface behavior. Run repository verification and release checks appropriate to changed code, including budgets. Avoid test-count targets or assertions that merely restate the implementation.

Performance: preserve current bundle budgets; profile a declared representative dataset and device before setting additional limits. Aim for standard good Core Web Vitals thresholds at the 75th percentile: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1. Lab checks are regressions aids, not substitutes for field measurements. Lazy-load optional media and tools, reserve geometry, and scope subscriptions to the changed task/session.

## 12. Release and migration

Use an additive feature flag for the new shell/Today composition. Preview it with synthetic data, then opt-in workspaces. Snapshot and verify restore before any data-shape migration. Preserve tasks, completed steps, notes, focus history, custom layouts, personal media references, and route access.

Treat old dashboards as saved layouts. Never silently flatten them into the new default. Unsupported layout fragments get a preserved recovery copy and an actionable repair choice. Deploy compatible cloud rules before a client writes new shapes; retain compatibility with offline queues and older supported clients.

Roll out the interface independently of risky data migrations where possible. Rollback must keep newer saved work readable, rather than restoring an old snapshot over it. Stop rollout on data loss, duplicate accounting, destructive migration, or inability to resume active work. Use the existing production-readiness runbook for deployment and operational checks.

## 13. What to defer, and when to reconsider

| Capability | Revisit when |
|---|---|
| Two-way calendar integrations | Retained users demonstrate need; shared time semantics, provider reconciliation, and operational ownership are reliable. Start with one provider. |
| Autonomous all-day replanning | Reviewed repair is trusted and users repeatedly ask to delegate specific bounded changes. |
| Team collaboration and enterprise administration | A separate team use case, permissions model, and support commitment have been validated. |
| Additional rooms, themes, widgets, and gamification | The core loop is validated and a specific addition demonstrably improves use. |
| Deep knowledge management or browser-session capture | Linked notes/resources cannot meet a recurring observed need. |
| Native applications | A measured platform limitation materially blocks retained users; a rewrite is justified against improving the PWA. |

## 14. Reference patterns and source boundaries

Official sources checked on 27 October 2026. These establish documented patterns, not comparative usability scores. FlowTask recommendations are design inferences, and no competitor behavior is copied as a claim of uniqueness.

- [Linear: My issues](https://linear.app/docs/my-issues) documents a curated relevant-work view and conditional grouping. Inference: prioritize the person's next useful work and reveal sections only when relevant.
- [Sunsama: Focus Mode](https://help.sunsama.com/docs/usage-guides/focus-mode/) documents task-centered focus. Inference: carry task context into execution and reduce surrounding decisions.
- [Sunsama: Weekly Review 2.0](https://roadmap.sunsama.com/changelog/weekly-review-20) connects objectives, completed work, and reflection. Inference: review should end with a better choice for the next period.
- [W3C: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) explains the 24×24 CSS px AA minimum and exceptions. The proposed 44px primary touch targets are a more generous product choice.
- [W3C: Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) explains keeping focused controls visible. Inference: rails, sticky bars, and sheets must preserve keyboard orientation.
- [Google: Web Vitals](https://web.dev/articles/vitals) defines the performance thresholds used above. Validate the actual application; the targets are not current measured results.

## Deliverable boundary

This document specifies the upgrade and its implementation gates. The accompanying interactive concept uses fictional sample work to make Today, breakdown, Focus, review, and customization concrete. It is not connected to the live task store and is not evidence that the application has been upgraded. No deployment or product-data migration is part of this planning deliverable.

Planning-deliverable verification: the concept's JavaScript passes a syntax check and a DOM interaction smoke check covering navigation, draft cancel/apply/undo, session start/pause/return and explicit step completion, plan preview/apply/undo, capture escaping, missing-estimate labels, and saved review state. Its initial desktop composition was visually inspected in the browser. Browser viewport overrides produced inconsistent reported dimensions and screenshot failures, so exact responsive-size certification remains pending; the viewport contract above is an implementation requirement. The application's production test suite was not rerun for this documentation/concept-only change.
