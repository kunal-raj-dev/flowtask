# FlowTask: current gaps and proposed product design

25 October 2026 · baseline: working tree at `d5e09ea`, including existing uncommitted changes. UI captures finished at 17:40 IST; later source checks include concurrent task-row/breakdown changes. Freeze a new candidate before phase-0 verification.

This is a planning audit, not a statement that the current product has passed release acceptance. **Observed** means fresh browser evidence; **Source** means inspected code; **Proposal** means a recommended design; **Gate** means evidence still needed. Older audits are historical and must not override current code without rechecking.

## 1. What FlowTask already has

| Capability | Current implementation evidence | Assessment |
|---|---|---|
| Natural-language capture | `TaskComposer`, `GlobalCaptureHUD`, `nlpParser`, `commandService.createTask` | Present; entry points and parsed defaults need parity validation |
| Brain Dump and Inbox triage | `BrainDumpModal`, `InboxTriage` | Present; connect capture and commitment more clearly |
| Daily ritual and Top 3 | `DailyPlanning`, `HorizonTodayView`, `EveningShutdownModal` | Present; improve selection, interruption and recovery semantics |
| Calendar planning | `TimelineView`, `TimelineCanvas`, `CalendarTimeGrid` | Present with multiple presentations; unify behavior and data |
| Scheduling proposal | `schedulePlanner`, `autoSlotAlgorithm`, `SchedulePlannerDialog` | Present: deterministic one-day placement with preview, reasons and fingerprint |
| Calendar input | `calendarService`, Settings `.ics` import/feed | Present as import/feed; not equivalent to OAuth read/write sync |
| Dates and dependencies | Task planned/due/defer fields, `dependencyUtils`, `workspaceSelectors` | Present, but predicate semantics differ |
| Work sessions/blocks | `Task.workBlocks`, workspace `workBlocks`, `workBlockService` | Present; duplicate representations and conversion need consolidation |
| Breakdown and starter action | `aiCopilot`, `procrastinationSplitter`, Copilot/drawer, newly added `GranularitySliderPopover` | Present; later source check found a five-level preview being wired into task rows. Refine editing, duplicate application, estimation and access across surfaces rather than add a duplicate control. |
| Execution support | `VisualPieTimer`, focus lifecycle/checkpoint, Focus Studio queue, study sprint | Present; refine a general-purpose Now/Next journey |
| Routines | `RoutinesView`, editor, `RoutineRunner`, saved runs | Present in current working tree; do not repeat earlier “missing editor/history” findings |
| Areas and goals | Current views use workspace services/selectors; entity sync includes both | Present; persistence and hosted acceptance require current evidence |
| Connected Notes | Library, daily note, search, links/backlinks, task links, versions, Markdown interchange | Present; context and editing continuity are the next opportunity |
| Focus environments | Studio, recipes, scene/media services, app-level audio graph, HUD | Present; improve defaults, resumption and sensory control |
| Keyboard system | Shortcut registry/runtime, command palette, keyboard navigation | Present; consolidate help/context and test full keyboard journeys |
| Browser extension | Manifest V3 popup captures active title/URL into the app | Present as a capture bridge; no badge, tab workspace or blocker in manifest |
| Reminders | Browser notification service with foreground reconciliation | Present; closed-app delivery is a separate capability |
| Local-first and optional sync | IndexedDB/workspace command system, recovery, exports, Firebase | Existing foundation to extend, with real-account/device gates still relevant |

Primary source anchors: [task model](../../../src/types/task.ts), [workspace entities](../../../src/services/workspaceEntities.ts), [planner](../../../src/services/schedulePlanner.ts), [calendar service](../../../src/services/calendarService.ts), [focus lifecycle](../../../src/services/focusLifecycle.ts), [notes model](../../../src/types/note.ts), [Studio](../../../src/components/focus/FocusStudio.tsx), [extension manifest](../../../extension/manifest.json).

## 2. Fresh UI findings

The capture used a separate headless Chrome context with synthetic records and Asia/Kolkata timezone. Screenshots reflect a particular theme/background and viewport; they do not prove every theme has the same issue. See [capture observations](evidence/observations.json).

| Finding | Evidence | Implication and proposed change |
|---|---|---|
| Task text sits directly on detailed scenery | [Today desktop](evidence/today-1440.png), [Today mobile](evidence/today-390.png) | Visual contrast varies with image content. Use a stable reading surface for task rows; retain images around the work surface and in Studio. Measure contrast before claiming compliance. |
| Today mobile has a large introductory card and four peer actions | Mobile capture: Timeline, Customize, Launch Routine and Plan my day occupy the header | Place date, capacity and one primary action in a compact header. Move appearance to a menu and routine launch into a contextual suggestion. |
| Mobile Plan shows header, capacity, date controls and staged tasks before the calendar | [Plan mobile](evidence/timeline-390.png) | The calendar is below the initial visible viewport. Default to agenda/current time with a collapsible task tray and compact date navigation. |
| Existing stage labels can contradict scheduled time | A task scheduled 15:00–16:00 appears under Morning Focus | `HorizonTodayView` admits tasks classified “deep” into morning regardless of their actual scheduled time. Use explicit time placement before cognitive preference. |
| Task drawer exposes many optional properties together | [Drawer](evidence/task-detail-1440.png) | Put title, next step, date, duration and project first. Collapse Life Area, Goal, defer, dependencies and study setup under named sections. |
| Default Notes has several equivalent creation routes | [Notes](evidence/notes-1440.png) shows plus, Write a note, New note and Today's note | Keep a clear primary creation route plus a distinct daily-note action; reduce duplicate empty-state controls. |
| Review opens to an all-time empty logbook with several further modes | [Review](evidence/review-1440.png) | Lead with a useful daily/weekly summary and next decision; keep detailed records and report export secondary. |
| Presentation density varies substantially between screens | Compare Today/Plan title cards with Notes/Routines headers | Adopt shared page, toolbar, row and empty-state patterns while retaining each workflow's useful layout. |

No page runtime errors were observed in these ten limited captures. No overflow was reported in the nine main-view observations. Neither result establishes complete accessibility, functionality, performance or mobile-device readiness.

## 3. Prioritized gap inventory

P0: correctness prerequisite for affected features. P1: core daily-use improvement. P2: useful expansion after core acceptance. P3: experiment or defer. These priorities express impact and dependency, not market prevalence. “Partial” means refinement or integration work, not absence.

| ID | Current state and evidence | Gap / required outcome | Reference pattern | Priority / phase |
|---|---|---|---|---|
| G01 | Source: two availability/dependency families | One reason-bearing eligibility rule used by Today, Plan, Focus, counts and search | OmniFocus | P0 / 0 |
| G02 | Source: work-block construction parses local date/time with `Z`, then stores a zone | Resolve a user's wall time in its actual zone; avoid mismatched instants and labels | Vimcal, calendars | P0 / 0 |
| G03 | Source: task schedule fields, embedded blocks and workspace blocks coexist | One authoritative scheduled-work model with validated legacy adapters | Motion, Akiflow | P0 / 0,2 |
| G04 | Source: grid handlers call task updates directly while preview has separate validation | Shared schedule commands for bounds, locks, availability, busy intervals and conflicts | Morgen | P0 / 0,2 |
| G05 | Gate: earlier audits and fixes refer to different working-tree states | Current evidence for migration, export, account isolation and release readiness | Local-first tools | P0 / 0 |
| G06 | Observed: photo directly under task text | Reliable reading surfaces and measured theme contrast | Things, Sunsama | P1 / 1 |
| G07 | Observed: large mobile header and calendar below initial viewport | Priorities/agenda visible quickly; one main action per state | Structured, Tiimo | P1 / 1 |
| G08 | Observed/source: inferred morning category can override 15:00 scheduling | Explicit date/time/evening choices outrank inferred intensity | Things | P1 / 1 |
| G09 | Observed: extensive task property panel | Progressive disclosure with a complete keyboard editing route | Things, Todoist | P1 / 1 |
| G10 | Present: NLP, HUD, composer and extension | Same input/defaults/overrides yield the same saved task; editable parser chips | Todoist, Akiflow | P1 / 1 |
| G11 | Present: planner selection uses broad active list | Eligible candidates, unfinished-commitment review and durable planning draft | Sunsama, Ellie | P1 / 1,2 |
| G12 | Present: capacity summaries; day summary and live slot availability differ | Label total budget versus remaining usable time; one shared calculation | Sunsama, Motion | P1 / 2 |
| G13 | Present: two planner presentations, zoom and multiday controls | Equivalent semantics, visible-range loading, overlap lanes and accessible moves | Notion Calendar | P1 / 2 |
| G14 | Partial: buffers plus single-day placement | Explainable multi-day proposals, breaks and preferred windows | Morgen, Reclaim | P2 / 2,7 |
| G15 | Present: local decomposition, editable Copilot steps and a concurrently added five-level row popover | Join those paths; preserve edits, prevent duplicate application, improve everyday-task proposals and estimate accounting | Goblin.tools | P1 / 3 |
| G16 | Present: timers and Studio task queue | Short queue with clear Now/Next, remaining demand and finish horizon | Llama Life | P1 / 3 |
| G17 | Present: routines with resume and run history | Resume semantics validated across sleep, account change and timer overlap | Tiimo | P1 / 3 |
| G18 | Present: Clean Slate and task opacity-decay utility | Gentle, reversible review that preserves deadlines and text legibility | Ellie, recovery synthesis | P1 / 3 |
| G19 | Present: keyboard registry and multiple launchers | Discoverable contextual commands and consistent shortcut suppression in inputs | Akiflow, Vimcal | P1 / 1,3 |
| G20 | Present: Notes and task references | One action from selected note text to canonical task, back to original context | Superlist, Obsidian | P1 / 4 |
| G21 | Partial: no first-class event-to-note lifecycle in current Note schema | Meeting occurrence → context note → follow-up tasks without duplicate extraction | Routine, Craft | P2 / 4,6 |
| G22 | Partial: project notes/resources/recipes exist in separate surfaces | Resume project with next action, recent note, resources and previous focus setup | Workona, Capacities | P1 / 4 |
| G23 | Present: minimal MV3 capture extension | Durable capture handoff, clear acknowledgment, dedupe, retry and account binding | Akiflow, Toby | P1 / 5 |
| G24 | Missing in extension: badge/session projection | Same timer across app, HUD and toolbar after browser suspension | Marinara | P2 / 5 |
| G25 | Missing: explicit tab-bundle workflow | Save/open selected resources by project with accurate restoration claims | Toby, Workona | P2 / 5 |
| G26 | Present: `.ics` input and calendar helpers | Real provider sync, source health, account settings and opt-in write semantics | Morgen, Fantastical | P2 / 6 |
| G27 | Present: local privacy helper; no provider mirror lifecycle | Display masking and cross-account Busy mirroring remain separate promises | Notion Calendar | P2 / 6 |
| G28 | Present: in-app/browser reminders | Explicit delivery capabilities, rolling reconciliation and optional push service | Tiimo, calendar apps | P1 disclosure / 1; P2 delivery / 6 |
| G29 | Present: recipes, audio layers, earcons and calibration heuristics | Stable quick presets, optional controls, measured estimate calibration | myNoise, Endel, Llama Life | P2 / 7 |
| G30 | Missing: native pairing/blocking/advanced PKM | Validate demand before separate social, blocking or rich-editor investment | Focusmate, Forest, Logseq | P3 / 7 experiments |

### Concrete code risks behind G01–G04

1. `utils/taskSelectors.isTaskActionable` considers active/someday/defer, but does not incorporate the richer predecessor/project ordering in `services/workspaceSelectors`. `schedulePlanner` imports the older `utils/dependencyUtils.isTaskBlocked`. A fresh [pure-selector diagnostic](evidence/eligibility-diagnostic.json) confirms that the same task with an unfinished blocker is actionable/in Today under the utility selectors and unavailable under the service selector. Public workflow impact still needs the phase-0 consumer audit; no blanket claim about all hosted failures is made.
2. `workBlockService.computeInstantsFromDate` appends `Z` to `date + startTime`, while independently saving a local IANA timezone. For a wall time of **09:00 Asia/Kolkata**, the expected instant is **03:30Z**, not **09:00Z**. A fresh [in-memory diagnostic](evidence/time-diagnostic.json) of the current `addWorkBlock` helper reproduced **09:00Z** with the zone still saved as Asia/Kolkata. Movement also formats derived labels using UTC accessors. Reproduce each public caller before migration; do not blindly shift all stored records by 5½ hours.
3. Grid rendering reads embedded `task.workBlocks`, while block services maintain both embedded and workspace arrays and other schedule surfaces use `scheduledStart`/`scheduledEnd`. `dbService` also projects blocks back into task fields. Establish which persisted records are canonical before extending split tasks.
4. `CalendarTimeGrid` already checks locks and previews resize locally in the current working tree. Those earlier gaps are partly addressed. It still contains direct task mutations, so the remaining work is shared domain validation, not re-adding the existing lock check or resize preview.

Source: [selectors](../../../src/utils/taskSelectors.ts), [workspace selectors](../../../src/services/workspaceSelectors.ts), [dependency helper](../../../src/utils/dependencyUtils.ts), [work blocks](../../../src/services/workBlockService.ts), [grid](../../../src/components/views/CalendarTimeGrid.tsx), [database hydration](../../../src/services/dbService.ts).

## 4. Design specification

All dimensions and timing below are **proposed FlowTask targets**, not measured competitor values. Validate them with content, zoom, touch and unfamiliar users. Retain current user preferences through migration.

### Information architecture

Use Today, Inbox, Plan, Projects and Notes as the primary work destinations. Put Review, Routines, Areas/Goals and specialist views in a secondary section that users can pin. Make Focus a persistent action/state, with Studio as an optional presentation of that state. Keep Study available as an optional workflow rather than making study terms part of every task.

Keep the established mobile Today / Inbox / Add / Plan / More pattern. More opens a searchable destination list and pinned shortcuts. Keep URLs and older saved destinations working; changing navigation must not change entity ownership or delete views.

Use plain names: Plan, Goals, Routines, Notes, Saved resources. Explain defer as “Available from.” Keep actual deadline separate. Labels such as “tickler,” “quarantine,” and “diagnose” can be replaced with a short explanation or removed from default paths.

### Today

Order the content by the decisions a person needs:

1. Compact date and capacity statement: “2h 25m planned · 1h 10m unscheduled room,” with a breakdown on demand.
2. Resume current focus if one exists; otherwise the next chosen task with Start.
3. Title-only capture, using the same parser preview as the global composer.
4. Up to three chosen priorities, followed by today's remaining tasks and an optional Evening section.
5. Collapsed completed work and a short shutdown/replan action.

Desktop: use a flexible main column and optional 280–360px agenda companion when sufficient width remains. Tablet: switch to one work surface with a toggled agenda. Phone: compact header and current/next task visible without navigating past customization panels. Aim for first actionable task within the first 350–400 CSS pixels at 390px width with representative text; measure, do not assume.

Explicit scheduling wins over inferred categories. A deep task scheduled at 15:00 remains an afternoon task. An explicit Evening choice remains in Evening. Do not infer a commitment time from a title classifier. An unscheduled deep task can carry an optional “Deep work” label without being assigned a morning slot.

The next-task recommendation must explain itself briefly: chosen priority, upcoming block or manual queue order. Let the user pick another task; do not repeatedly reorder the visible list while they are interacting.

### Plan

Desktop: one date/range header, clear 1/3/7-day controls, capacity, staged tasks and calendar. Keep “agenda/grid” as presentations of the same range/model. Vertical scale controls are separate from day count.

Phone: default to one-day agenda centered on now or the first upcoming commitment; show staged task count as a button. The tray opens as a sheet. Editing a task time opens a small accessible form. The week overview is an intentional switch, not a seven-column default squeezed onto a narrow viewport.

Task/event blocks show start/end, duration and source. Locked, proposed, busy, completed and conflict states use labels/icons as well as color. Show overlaps in lanes. Busy events are constraints; dragging a task into one gives an explanation and alternative slots, not silent movement of the meeting.

During drag, show a ghost interval and time label; Escape cancels. Auto-scroll only near scroll-container edges. Commit once at drop or resize release. Provide keyboard “Move / Resize / Unschedule” commands and touch time controls. After commit, preserve task selection and offer Undo.

### Capture and task details

Capture requires only a title. Show optional recognized date, duration and project chips. The user can remove a token without retyping. Title/raw parser text remains visible until commit. Do not silently switch an ambiguous date into a deadline.

Drawer default: title, next small action, project, duration, planned day, optional deadline, Start, description and checklist. Group secondary controls into Schedule, Relationships and More. Open an applicable group when arriving through a contextual action. Advanced study fields appear only for an explicitly enabled study session.

Save status and errors must be visible without confusing local save with cloud delivery. Preserve text on failure. Dates have explicit Clear actions. Escape closes safe surfaces and restores focus; dirty drafts survive accidental dismissal or offer recovery without an unnecessary confirmation for every edit.

### Focus and routines

One session identity powers task detail, mini-player, HUD and Studio. Minimal view shows current task, optional next step, remaining time, Pause, Finish and a small next-queue preview. Studio adds atmosphere without changing the task's ownership or creating a second session.

At zero, show “Time is up”: continue, add time, take a break, or finish. Finishing time does not mark the task done. Pausing does not erase work. Completing a step can reveal the next one, but only a user action advances to the next task unless a separately enabled routine policy says otherwise.

For “Just 5/10 minutes,” make a small temporary commitment rather than permanently overwriting the task estimate. Ask one optional nonclinical question such as “What is making it hard to start?” Offer “unclear next step,” “too large,” “waiting on something,” or “low energy,” followed by a useful action.

Routines need explicit resume/restart/skip/extend, a view of remaining steps and a durable completion record. A missed day should not reset all history or lower task-text opacity. Keep progress feedback optional; use language that supports resumption.

### Notes and project context

Use the existing Notes model and Markdown as the stable storage format. Make daily note distinct from general note creation. Support selection → Create linked task → editable preview → one canonical task with backlink. Clicking that task can return to the source note; deleted/archived sources display an understandable fallback.

A project resume card shows intended outcome, next available action, relevant milestone, recent note, saved resources and last focus recipe. None of these requires a general graph or customizable database. Meeting notes attach to a specific event occurrence, with a durable local identity even if the provider event is removed.

### Shared visual, interaction and accessibility rules

| Area | Proposed target |
|---|---|
| Reading surfaces | Opaque or sufficiently controlled tonal surfaces under task text; imagery around the work area and in Studio |
| Typography | Preserve current font system; 14–16px body, clear 12–13px metadata where usable; tabular numerals for clocks; no essential tiny text |
| Spacing/density | Shared spacing scale; comfortable default; compact rows optional; maintain 44px touch targets as a product target |
| Color | One principal accent, semantic warning/error colors; icon/text supplements for priority and schedule state |
| Focus/keyboard | Visible focus, semantic buttons, complete dialogs, field labels, focus restoration, no single-key shortcuts during text composition |
| Feedback | Immediate state acknowledgment; local save and cloud status separated; actionable error plus retry, preserved input and Undo |
| Motion | Calm, restrained movement with consistent deceleration; no animated entrance for every routine list rerender |
| Motion layers | Primary action shows position/state, secondary feedback reinforces it, a brief ambient status cue may complete the event; avoid continuous decorative movement in work surfaces |
| Timing | Starting targets: 80–120ms micro-feedback, 120–180ms presses, 180–250ms rows/panels, roughly 250–350ms dialogs; measure interruption and reduce if they delay work |
| Reduced motion | Instant placement/reorder plus clear textual state; no unnecessary spatial travel; independent scene pause/static setting |
| Audio | Off unless chosen; independent task/timer/typing/ambient controls; never the sole signal; respect mute and failed audio-unlock states |
| Recovery | Confirm only actions that need it; give reversible remove/archive and reliable Undo; never hide overdue deadlines through decorative fading |

Motion recommendations use the [motion-design skill](C:/Users/kunal/.agents/skills/motion-design/SKILL.md), adapted to a productivity interface. Values are design starting points. Accessibility targets include WCAG AA contrast and meaningful keyboard/touch/screen-reader use, with checks on actual rendered themes and device layouts.

## 5. Complete target journeys

### J1: Capture now, choose later

Capture a thought from Today or extension → see acknowledged local save → find it once in Inbox → choose a project/day later → schedule without changing the deadline. Same input and settings produce equivalent fields across surfaces. An unavailable app leaves the extension capture queued and clearly unconfirmed.

### J2: Plan a day that can fit

Review yesterday's unfinished commitments → inspect meetings → choose tasks and estimates → see capacity and any unplaced work → select up to three priorities → preview blocks → save once. Reload restores the plan; Undo reverses it; a changed task/calendar invalidates a stale proposal.

### J3: Start when the task feels too big

Open a task → choose smaller steps → select detail level → edit/remove proposals → approve once → start a five-minute attempt → extend, pause or finish → record work without automatically completing the parent. Existing estimates are not double-counted when steps are added.

### J4: Recover from an interrupted afternoon

A meeting overruns → current session pauses or ends explicitly → show remaining demand and upcoming gaps → offer changes only to flexible blocks → preview differences → apply or defer → preserve completed logs, deadlines and locked commitments. A user can decline and continue manually.

### J5: Turn context into work, then resume it

Open a project/meeting note → select an action → create one linked task → place it into a valid gap → start focus with the source note available → return later to a resume card with the task, note, resources and recipe. Changing a task title does not break its source link.

### J6: Focus through another browser tab

Start in the app → see the same session in HUD/extension badge → browser sleeps → wake and recompute from timestamps → finish once from either surface → one focus log appears → Review includes the session. Switching accounts clears private session projection until the new workspace is bound.

## 6. Scope choices

**Commit first:** G01–G13, G15–G20, G22–G23, reminder capability clarity. These improve core daily use and the reliability of features already advertised.

**Build behind bounded flags:** multiday proposals, event-linked notes, provider sync, tab bundles, toolbar timer, flexible habit windows and better estimate recommendations.

**Validate before investment:** arbitrary object databases, block transclusion, global graphs, weather, biometric adaptation, custom hearing calibration, native watch surfaces, public booking links, automatic team workload management, built-in video pairing, destructive gamification and full browser tab suspension. These are individually plausible businesses or platform projects, not small additions to an all-in-one roadmap.
