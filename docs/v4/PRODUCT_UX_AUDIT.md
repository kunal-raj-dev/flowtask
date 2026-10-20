# FlowTask V4 product and workflow audit

Audit date: 19 October 2026. Scope: source and documentation review, without application changes. This document is a strategy input, not an implementation authorization. The main audit coordinates runtime verification and external research separately.

## Product judgment

FlowTask already contains most of the ingredients of a strong individual productivity product: fast capture, distinct planned dates and deadlines, realistic capacity planning, task-linked focus, local storage, recoverable edits, optional sync, and project outcomes. V4 should improve coherence and trust before expanding the feature count.

The strongest positioning is a personal planner that helps a student or independent builder choose a realistic day, work on one useful next action, and resume reliably. It should not become a team project-management suite, a general document editor, or an AI scheduling service by default.

The largest product issues found in source are competing meanings of workspace, incidental layout choices changing the daily experience, divergent task-selection rules between surfaces, duplicate export experiences with different guarantees, and several overlapping focus/study/planning interfaces. Their existence is confirmed; the degree to which users find each confusing requires usability testing.

## What exists and should be credited

| Area | Existing behavior and evidence | V4 implication |
|---|---|---|
| Capture | Shared `TaskComposer`, NLP chips, project defaults, Quick Add, batch capture, study parser. `TaskContext.tsx:346-347` applies project defaults from the active route. | Reuse the command and parsing foundations. Do not claim contextual project capture is missing because a board caller omits the project override. |
| Planning | Planned date is separate from deadline (`types/task.ts:59-62`); guided day selection, Top 3, daily capacity and auto-slot preview already exist (`DailyPlanning.tsx`, `TimelineView.tsx:160-206`). | Integrate these into one coherent plan surface. “AI scheduling” is unnecessary to solve the current friction. |
| Task detail | Next action, dates, project, subtasks, notes, recurrence, dependencies, tags, study tools and history. Advanced sections already use disclosure (`TaskDrawer.tsx:289-323`). | Keep progressive disclosure; rebuild the visual hierarchy and consistency instead of removing valuable data. |
| Projects | Optional outcome, target date, cover, focus preset, soft WIP limit and milestones (`ProjectIntent.tsx:14-29`, `ProjectPath.tsx`). List/board/matrix already available per project (`ProjectsView.tsx:149-166`). | Project workflow is richer than a plain folder model. Avoid adding duplicate goals/roadmaps on top. |
| Today | Guided Daily Desk includes capture, demand, three priorities, next task, agenda, notes, study continuation and reflection (`DailyDesk.tsx:115-202,216-286`). | Preserve the useful loop while reducing simultaneous blocks and clarifying state. |
| Focus | Immersive Studio, saved recipes, scene/audio controls, queue, notes, next action, completion reflection; global mini-player and PiP (`FocusStudio.tsx`, `AppLayout.tsx:535-545,889`). | Keep differentiated focus environment, but make it optional after one-click task focus. |
| Portability | Full workspace export exists (`ExportImportModal.tsx:91`); recovery, import preview, account migration and data boundaries are documented. | Unify all backup entry points and verify the promise instead of inventing another backup format/UI. |
| Accessibility | Shared Dialog/Drawer, focus management, reduced-motion preferences, keyboard controls and non-drag widget move actions exist. | Extend the primitives consistently to legacy overlays and interactions. |

## Findings grounded in code

Severity here reflects user impact, not a claim of runtime reproduction. “Confirmed” means the relevant behavior follows from the inspected source; browser and regression verification should follow before remediation.

| ID / priority | Finding and evidence | Consequence / V4 decision |
|---|---|---|
| UX-01 / P1 | **Confirmed misleading backup scope.** `ReviewView.tsx:59-70` calls `exportToJSON(tasks, projects, 2)` without extras. `fileExporter.ts:51-68` writes tasks/projects plus empty default custom views/history; it has no dashboards/preferences/recipes. `ReviewView.tsx:220-233` labels this “JSON Backup” and “Complete versioned workspace snapshot.” Full export instead calls `createWorkspaceBackup` in `ExportImportModal.tsx:91`. | A user can reasonably believe they have a complete recovery copy when they do not. Route every “backup” action to the canonical full backup. Retain task reports with explicit report wording and scope. |
| UX-02 / P1 | **Confirmed inconsistent Inbox membership.** `taskSelectors.ts:10`, `Sidebar.tsx:176-177`, and `TaskList.tsx:90-97` exclude tasks with deadlines. `InboxTriage.tsx:14-24` excludes planned dates but does not exclude deadlines. | Triage can present an item absent from the visible Inbox/count. Define Inbox as “not yet organized” explicitly and share the predicate everywhere. Deadline-only Inbox behavior is a product decision requiring migration/test coverage, not a cosmetic fix. |
| UX-03 / P1 | **Confirmed legacy project modal accessibility gap.** Edit and delete/reassign overlays in `ProjectsView.tsx:365-473` are plain nested divs, outside shared Dialog, without dialog role, modal semantics, focus containment or Escape handling in that file. | Keyboard/screen-reader operation is less dependable than other dialogs. Replace with common primitives and test focus return, labels, cancellation and background inertness. Exact browser/screen-reader symptoms remain to be verified. |
| UX-04 / P2 | **Confirmed terminology collision.** Real data workspace is selected from `user.uid` or `local` (`TaskContext.tsx:220-223`). Today’s layout switcher says “Switch dashboard,” “Current desk,” “Edit workspace,” and “Create New Dashboard” (`DashboardHeader.tsx:40-55`). Project detail calls itself “Project Workspace” (`ProjectsView.tsx:135`). | Users cannot infer whether switching a desk changes data scope. Reserve “Workspace” for the data/account container, “Project” for work organization, and “Dashboard” for an optional view. Rename layout editing to “Customize dashboard.” |
| UX-05 / P2 | **Confirmed layout-dependent daily workflow.** `isGuidedDailyDesk` compares widget IDs/types and all layout geometry to the starter (`DailyDesk.tsx:40-63`); `DashboardEditor.tsx:184` chooses the guided Today presentation only when the signature matches. | A resize/reorder can change the entire daily experience. Make Today an explicit stable view independent of dashboard geometry. Existing custom dashboards remain accessible and exportable; migration must not discard them. |
| UX-06 / P2 | **Confirmed duplicate navigation models.** Desktop has Today, Inbox, Plan, Upcoming, Projects plus Study/Review and six perspectives (`Sidebar.tsx:222-245`). Mobile gives direct destinations to Today, Inbox, Upcoming and More (`MobileBottomNav.tsx:24-28`), with Plan/Projects behind More. Projects already contain List/Board/Matrix (`ProjectsView.tsx:149-166`); Upcoming also contains List/Timeline (`UpcomingView.tsx:36`). | Consolidate global Plan/Upcoming into one destination with Day/Week views; expose Board/Matrix as task presentations, not competing workspaces. Mobile must keep planning first-class. Actual frequency/preference needs validation. |
| UX-07 / P2 | **Confirmed independent Upcoming semantics.** `UpcomingView.tsx:43-46` admits `isSomeday` tasks if dated. The canonical `isUpcomingTask` excludes them (`taskSelectors.ts:12`). Its horizon uses `(estimatedMinutes || 25)` (`UpcomingView.tsx:58-70`), while shared day summaries use configurable fallback (default 30) and calendar budget (`dayPlanSummary.ts:117-122`). | The same task can be intentionally deferred yet counted as upcoming, and time totals can disagree. One domain-level membership/capacity contract must serve every view and badge. |
| UX-08 / P2 | **Confirmed study classification leak.** `StudyView.tsx:110-118` includes any active task with at least two unfinished subtasks in Continue Sprint, even if no study tag, project or session metadata exists. Planned Sessions checks only presence of a date (`StudyView.tsx:124-133`), not today/future. | Ordinary checklists may appear as study sessions; old dates appear under future-oriented copy. Make structured study an explicit task capability, with optional conversion and preview; do not classify work from subtask count alone. |
| UX-09 / P2 | **Confirmed competing starting preferences.** Today prefers `workspacePreferences.activeDashboardId` over the default dashboard (`TodayView.tsx:26-29,51`). Settings offers both “Today” and “Custom Workspace Dashboard” (`WorkspaceSettings.tsx:95-101`), while both resolve to Today (`entryRoute.ts:17-20`). | Decide between “resume last view” and “always open chosen start view,” explain that choice, and eliminate aliases presented as different destinations. Verify changing default after selecting another dashboard. |
| UX-10 / P2 | **Confirmed missing manual task ordering in the inspected list contract.** `TaskCollection.tsx:14-24,30` supports priority/date/title/estimate sorting; `Task` has no ordering field, while dashboards and milestones do. | Let users explicitly order today’s next actions and project tasks. Keep initial scope to stable task rank/position, with keyboard Move up/down and undo; avoid introducing configurable workflow engines. |
| UX-11 / P2 | **Confirmed duplicated focus presentation.** `StudySprintRunnerModal.tsx` renders its own timer, controls, ambient choices and pacing; `FocusStudio.tsx` has another full preparation/session/environment experience. `PomodoroModal` routes to Studio. | One session runtime and one focus shell, with optional study target rail. Preserve study pacing/targets; remove the separate cockpit surface after parity and migration tests. Runtime ownership requires architecture audit. |
| UX-12 / P2 | **Confirmed bulk heuristic priority mutation.** `EisenhowerView.tsx:259-277` applies suggested priorities in multiple grouped batch updates; the UI offers “Auto-align” without a before/after preview. Quadrants are derived from a single priority field and heuristic score. | Keep Matrix as optional manual presentation. Remove or rebuild Auto-align as an explained preview committed atomically with one Undo. Do not sell a score as objective importance. |
| UX-13 / P3 | **Confirmed developer-oriented product copy.** Review export text exposes “RFC-4180” and “formula injection” (`ReviewView.tsx:193-212`), study capture says “Parse Session” (`StudyView.tsx:197-207`), settings says “Hourly Timeline Canvas” (`WorkspaceSettings.tsx:98`). | Use outcome language: Export task report, Import study plan, Plan your day. Keep implementation/security details in help/docs. |
| UX-14 / P3 | **Confirmed unnecessary passive daily UI state.** Daily flow always sets Focus to `aria-current="step"` (`DailyDesk.tsx:193`), irrespective of whether a session has started. | Derive the current state from work done/session state or remove the stepper. Do not imply the user is on a step they did not choose. |

Potential issues requiring runtime confirmation: default-dashboard preference precedence, editing project outcome and immediately navigating before blur, user comprehension of calendar/backup exclusions, mobile discoverability of Plan and Projects, and whether Today above-the-fold density delays starting meaningful work. These are not asserted as reproduced failures.

## Recommended information architecture

Desktop primary navigation: **Today / Inbox / Plan / Projects**. Review is a secondary destination. Search and capture are global actions. Focus is a global session action/mini-player, not a separate organizational database. Pinned projects/saved views sit below core navigation. Settings/account/data status sit at the bottom.

Mobile primary navigation: **Today / Plan / Add / Inbox / More**. More exposes Projects, pinned views, Review and Settings in an accessible sheet. Test the placement of Projects versus Inbox using target users; preserve the same concepts and names across devices.

Plan owns **Day / Week** plus list/agenda presentation. Upcoming is a week/list mode, with existing URLs mapped to its equivalent. Today is the work queue for the current date, not the entire dashboard builder. Projects own List and Board; Matrix is an optional advanced presentation available in the view menu. Saved smart filters remain accessible without forcing everyone to understand predicate building.

Workspace management in V4 should first make the existing boundary clear: **On this device** versus **Account workspace**, sync state, backup state, account migration and recovery. Do not add arbitrary workspace creation merely to justify a switcher. The actual model is one workspace per account plus guest; introducing multiple independent workspaces changes data isolation, sync paths, backup and session ownership. If usability research establishes a need for separate Work/Study/Personal containers, add those as a later explicitly funded feature. Projects and saved views solve much of the segmentation need today.

## Primary flows to design and test

### 1. Capture and clarify

From any view, the same Add action opens one composer. The default project/date is visible before saving and follows current context; keyboard users get the same defaults. NLP interpretations appear as removable chips, and literal text can be preserved. Save immediately and keep a single “Added to … / Undo” confirmation. Multi-line paste becomes a preview of tasks with destination, optional common date and duplicate hints before one commit. Study import is an advanced structured variant, not a competing first-run capture tool.

Inbox has one definition everywhere. A user can set a project, plan later, defer intentionally, or delete with Undo. Scheduling should not unexpectedly erase project context or deadlines. Triage uses exactly the visible Inbox set and can be completed by keyboard or touch.

### 2. Build a realistic day

Today shows capture, a concise capacity indicator, user-ordered priorities/next actions and one focus CTA. Agenda and notes are secondary context. “Plan day” opens a workspace panel containing unscheduled/backlog choices beside day commitments and remaining capacity. Selecting tasks updates a draft only. Moving a task changes planned date; setting a deadline remains a distinct action.

Auto-slot stays optional. Preview proposed blocks, overflow tasks and why each could not fit. Existing locked tasks and calendar events cannot move. Apply once creates one undoable transaction. Choosing a different date retains explicit date context in all controls. Overdue deadline work and previously planned unfinished work are distinct categories; neither should silently overwrite deadlines or flood Today.

### 3. Organize a project

Create a named project with optional outcome. Capture tasks immediately; details, covers and focus environment come later. Use one task list/board backed by the same filter/sort/order model. Optional milestones are grouped checkpoints rather than a second to-do system. Show blocked tasks explicitly, preserve their dependency relationship on moves, and choose the next actionable task rather than blindly the first array item. Archive a project with visible task implications and Undo; delete requires a clear reassignment consequence and accessible dialog.

### 4. Start, interrupt and resume focus

One click from a task starts the last-used rhythm and opens a compact focus shell; Studio is an optional expansion. The task, next action, duration and Pause/Finish controls stay visible. Background scene/music selection is secondary and never required to start. Sound playback permission/failure does not prevent timing. An active session is visible across all views and can be resumed from its mini-player, reload recovery and PiP without starting another session.

Study adds a target/subtask rail and optional pacing to the same shell. Changing the current target, marking it solved, taking a break and finishing are distinct actions. End summary separates **session ended**, **task completed**, and **next action**. A user may stop after 20 minutes and keep the task open. Offer a brief next-step note at interruption; resume returns to that note and correct target.

### 5. Close and resume the day

Review leads with completed work, recorded focus and unfinished commitments. Reflection is optional. Carry unfinished planned work forward through an explicit review with Today/Tomorrow/Backlog choices; do not alter real deadlines. Summaries explain estimates versus recorded time. Reports have a chosen range and clear scope. Full backups are a data-control action using one exporter, with included/excluded data and restore preview.

### 6. First run and personalization

Retain the current useful “one task, then focus” introduction (`OnboardingFlow.tsx:10-42`). No mandatory account, occupation quiz, theme choice or dashboard customization. Optional sample workspace must be clearly distinguishable and reversible. Later personalization exposes density, light/dark/system, readable accent and a small set of featured appearances; preserve all existing theme values and access to the full library. Presets should show exactly which work-budget/timer settings change and offer Undo.

## Keep / Improve / Rebuild / Remove / Add

| Decision | Scope | Reason and expected impact |
|---|---|---|
| Keep | Local-first capture, optional account, distinct planned/deadline fields, subtask/next-action model, undo/recovery, recurrence, export/import | Strong foundations and user data contracts; trust and speed outweigh novelty. |
| Keep | Focus Studio environments, saved presets, quiet visual identity, optional milestone outcomes | Differentiation already exists; integrate rather than clone competitors. |
| Improve | Composer defaults/chips, task rows, empty states, project list/board, keyboard parity, mobile Plan, smart views | Lower routine interaction cost without increasing conceptual burden. |
| Improve | Planning preview, capacity language, rollover decisions, review summaries, sync/backup status | Reduce ambiguity and make automation understandable and reversible. |
| Rebuild | Navigation/view shell, stable Today independent from dashboards, shared list contracts, planning surface, focus/study shell | Structural improvements address fragmentation and inconsistent behavior. Reuse domain commands and tested engines. |
| Rebuild | Backup/report entry points and project overlays | Fix material trust/accessibility defects before visual polish. |
| Remove | Duplicate “full backup” exporter, duplicate startup option, standalone navigation duplicates, separate study cockpit after parity, heuristic mutation without preview | Remove contradictory/low-value surfaces while preserving underlying useful capabilities. |
| Remove from default | Dashboard construction, Matrix, detailed analytics, study controls on ordinary tasks, long theme library | Progressive disclosure rather than destructive deletion of user data or settings. |
| Add | Explicit task/manual queue order, small resume note at interruption, accessible context pinning, unified storage/sync/backup status | Supports repeated daily jobs; bounded scope tied directly to inspected gaps. Some underlying resume/pinning data already exists and should be reused. |

## Acceptance criteria and validation

All are proposed targets, not measurements of the current build.

- Given any task fixture, Inbox list/count/triage, Today list/count/queue and Plan/week demand use consistent membership and estimation rules. Fixtures cover deadline-only, planned-plus-deadline, someday-plus-date, blocked, completed, archived, deleted and missing estimate cases.
- All UI actions labelled “backup” produce the same versioned full-workspace payload and restore projects/tasks/milestones/dashboards/saved views/preferences/history/presets as specified. Media/timer/calendar exclusions appear before download and restore; tests assert them.
- Keyboard-only capture → plan → focus → complete → undo works without a pointer. Every modal traps/returns focus and exposes a name; pointer drag has keyboard alternatives. Test project edit/delete specifically, not only shared primitive tests.
- Existing guest/account workspaces and customized dashboards migrate without task, title, note, preference, order or layout loss. Legacy routes resolve predictably. Editing a dashboard cannot change Today’s primary workflow.
- A task can start focus in one direct action from its row/Today, without required environment selection. Pause/reload/resume/finish across full Studio, compact player and PiP yields one session record and correct time attribution.
- Plan auto-slot is previewed, never moves locked blocks, respects calendar conflicts and does not overwrite deadlines; one Undo restores the entire operation.
- Touch targets follow the design system minimum and all core flows work at 360 CSS pixels, 200% zoom, reduced motion and keyboard navigation. Native screen-reader/mobile validation is a separate release gate.
- In at least ten moderated sessions across students/developers, target ≥90% unassisted success for capture, project assignment, planning, starting/resuming focus and finding backup. Target median first saved task ≤30 seconds and first task-linked session ≤60 seconds; report observed samples without claiming statistical proof.
- A comprehension check asks users what a dashboard switch, project move, account switch and JSON backup will change/include. Target ≥90% correct answers after the redesigned flows. Failure means labels/model need revision before feature expansion.

## Scope exclusions and sequencing

Do not bundle team permissions, shared workspaces, AI chat, autonomous rescheduling, two-way calendar sync, website blocking, habit/goal gamification, a full notes editor, billing, a native rewrite or new theme/media libraries into the first V4 release. Existing WebMCP/extension/integration capabilities can remain isolated until their release and security gates are met.

Quick wins after approval: canonical backup routing/copy, shared Inbox/Upcoming predicates, project dialogs, startup-label cleanup and explicit study classification. Major upgrades: Today/dashboard separation, navigation/Plan consolidation, shared task organization/order, unified focus/study shell. Stabilize data semantics first; otherwise a redesigned surface will inherit the same contradictory behavior.

Usability hypotheses to test before final high-cost UI decisions: whether people use more than one dashboard; whether Matrix is used regularly; whether they need separate independent workspaces; whether first-class study navigation benefits non-students; whether manual day order materially improves starting focus. Feature removal must be based on task value and evidence, not aesthetic dislike.
