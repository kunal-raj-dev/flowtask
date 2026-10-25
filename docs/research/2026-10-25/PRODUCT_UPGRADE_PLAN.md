# FlowTask: product and UI/UX upgrade plan

Implementation has begun. See [Connected Notes milestone and deployment requirements](../../CONNECTED_NOTES.md) for the first implemented release slice. The remaining waves below are still planned.

Prepared **25 October 2026** for **people organizing personal life and work**. This is a proposed implementation backlog and design specification, not a record of shipped features. It accompanies the [competitive research](COMPETITIVE_RESEARCH.md) and extends the earlier student/developer strategy to the broader audience requested by the owner.

## 1. Product decision

Build around a connected daily loop:

```text
Capture → Inbox → Task / Note / Routine
                    ↓
              Area / Project / Goal
                    ↓
             Plan around calendar
                    ↓
             Focus with context
                    ↓
              Review and adjust
```

The same task can appear in Inbox, a project, a note, Today, and Plan without becoming five independent copies. A note can exist without a task. A routine can produce today's actions without filling the backlog with future duplicates. A hard deadline must remain unchanged when a work block moves.

**The first substantial expansion should be connected Notes.** Reminder delivery and phone capture should run as the next critical foundation work; calendar connection, weekly planning, areas, and routines follow through dependency-aware releases. Consistent interaction and data trust are requirements throughout.

Keep the current React/TypeScript/Zustand/IndexedDB architecture and optional Firebase sync. This roadmap does not establish a need for a framework rewrite. Preserve the current appearance system, themes, focus engine, project data, and existing routes while improving shared components and models.

## 2. Current baseline and evidence

Evidence types: **S** = inspected source, **V** = local visual/DOM observation using synthetic data, **D** = repository documentation only. “Present” means the capability exists in this checkout; it does not establish production reliability on every device. The existing [production-readiness gates](../../PRODUCTION_READINESS.md) remain relevant and were not rerun by this documentation task.

| Area | What exists today | Evidence | Upgrade implication |
|---|---|---|---|
| Navigation | Desktop Today, Inbox, Plan, Projects; Focus Studio; advanced destinations collapsed under More; mobile Today/Inbox/Add/Plan/More | S/V: `Sidebar.tsx`, `MobileBottomNav.tsx`, screenshots | Evolve this hierarchy; do not propose it as a new redesign from scratch. |
| Capture | Shared composer, natural-language parsing, quick add, batch staging, keyboard commands, voice utility, browser extension | S: `TaskComposer.tsx`, `nlpParser.ts`, `ScratchpadModal.tsx`, `voiceDictationService.ts`, `extension/popup.js` | Improve coverage, discoverability, source metadata, and delivery status. A native global shortcut/widget is not established. |
| Task semantics | Planned date, deadline/time, priority, recurrence, custom recurrence mode, subtasks, tags/context, dependencies, archive/trash | S: `types/task.ts` | Preserve these fields; make labels and behavior consistent. Task reminder records/delivery are a separate gap. |
| Planning | Time blocking, auto-slot proposal, schedule locking, capacity, Top 3, Today timeline, Upcoming | S/V: `TimelineView.tsx`, `autoSlotAlgorithm.ts`, `HorizonTodayView.tsx` | Consolidate planning entry points; deepen week planning and support multiple work blocks per task. |
| Notes | Task descriptions with Markdown preview, a general scratchpad, selection-to-task/subtask conversion, quick note widget | S/V: `TaskDrawerNotes.tsx`, `ScratchpadModal.tsx`, `QuickNotesWidget.tsx` | Standalone note records/library, links, backlinks, daily notes, note history, and cross-entity search are missing. |
| Notes continuity | Task descriptions belong to task records; scratchpad is explicitly excluded from synchronized preference keys | S: `workspaceEntities.ts:22–32`, `cloudWorkspace.ts` | Do not promise cross-device scratchpad availability. Provide a deliberate import into the new Notes model. |
| Projects | Outcomes, dates, covers, focus recipes, WIP hints, milestones, project tasks, list/board/matrix | S: `types/task.ts`, `ProjectIntent.tsx`, `ProjectPath.tsx` | Add linked notes and light sections; add optional life-area/goal relationships. Avoid duplicating milestones. |
| Focus | Task-linked timers, multiple modes, checkpoints, interruptions/resume, logs, scenes/audio | S/D: focus components, lifecycle services, README | Refine one consistent Start/Resume/Finish path. More timer modes are low priority. |
| Calendar | Read-only ICS file/feed context; import is device-local and excluded from cloud sync and JSON backup | S/D: `calendarService.ts`, README | OAuth provider connection, multiple calendars, freshness, and safe event writes need separate work. |
| Review | Daily/weekly review, shutdown, insights/logbook, deterministic estimate suggestions | S: review components, `planningSuggestions.ts` | Connect to notes, goals, routine outcomes, and weekly planning. Avoid inventing a second analytics system. |
| Durability | IndexedDB/local workspace, optional account sync, outbox/conflict/recovery concepts, backups, undo, snapshots | S/D: workspace services, `PRODUCTION_READINESS.md` | Extend every new entity through these boundaries; retain the remaining live/device/release gates. |
| Portability | JSON backup/restore; CSV and Markdown task export | S: `workspaceBackup.ts`, `ExportImportModal.tsx`, `fileExporter.ts` | Add inbound CSV/Markdown and competitor mapping. Existing exports must not be counted as missing. |
| Copilot | Local deterministic breakdown, plan preview, focus, and summary commands | S/D: `aiCopilot.ts`, `copilotCommands.ts`, responsive Copilot docs | Explain the local capability honestly. A hosted generative assistant or agent service is a future addition. |

Source paths in the table are relative to `src/` unless a different root is shown. Current screen captures are in [evidence](evidence/observations.json). Existing release test counts in older documents are historical evidence, not fresh results of this task.

## 3. Complete gap and scope ledger

**Improve** = useful foundations already exist. **Add** = the inspected source does not establish this capability. **Validate** = requires usage research or platform verification. **Later** = tracked explicitly outside the first complete personal-organizer release. Benchmark links are in the corresponding [research profiles](COMPETITIVE_RESEARCH.md#1-the-competitive-landscape).

| ID | Capability | Current assessment | Benchmark / user need | Planned treatment |
|---|---|---|---|---|
| G01 | Fast natural-language task capture | Improve | Todoist, TickTick | U02: one composer and consistent optional chips; keep existing parser. |
| G02 | External capture queue and source references | Improve | Akiflow, Routine, web capture | U03: existing extension delivery, duplicate prevention, pending/error status, source link. |
| G03 | Mobile share target and rapid launch | Add/Validate | Mobile task/note capture | U03: test PWA routes/share support; native companion later where web cannot cover the job. |
| G04 | General task reminders and snooze | Add | TickTick, bundled reminders, Structured | U04: persisted reminders plus transparent delivery conditions. |
| G05 | Flexible recurring tasks | Improve | Things, TickTick | U14: recurrence editor, completion-based examples, exceptions and clear edit scope. |
| G06 | Standalone searchable Notes library | Add | Keep, Obsidian, Notion, NotePlan | U05: independent notes, recents, favorites, tags, archive/trash. |
| G07 | Note links, backlinks, and task provenance | Add | Obsidian, Amplenote, NotePlan | U06: stable references, linked tasks, safe rename/delete behavior. |
| G08 | Daily notes and journaling | Add | NotePlan, Amplenote | U07: optional dated notes and small prompts; never force daily writing. |
| G09 | Note editing beyond a description | Add/Improve | Everyday notes and contextual writing | U05: headings, lists, checkboxes, code, links, autosave; a single canonical format. |
| G10 | Unified search across entities | Improve/Add | Things Quick Find, Routine, notes apps | U08: extend task/command search to notes, projects, dates, and later areas. |
| G11 | Attachment storage and retrieval | Add | Evernote, OneNote, household/reference needs | U15: links first, then managed files with explicit local/cloud/export status. |
| G12 | Calendar provider connection | Add | Sunsama, Morgen, Akiflow | U09: Google read connection first; retain ICS; Outlook next when demand supports it. |
| G13 | Two-way calendar blocks and event editing | Add | Specialist planners | U17: opt-in writes after read sync, ownership, recurrence, and recovery contracts. |
| G14 | Week/month planning | Improve | Sunsama, Structured, calendar apps | U10: build on Upcoming and WeeklyWorkload; genuine multi-day planning and mobile agenda. |
| G15 | Multiple scheduled work blocks per task | Add | Long work spread across days | U11: schedule blocks distinct from tasks; current task has one start/end pair. |
| G16 | Safer rescheduling and capacity | Improve | Sunsama, Motion, Reclaim | U10/U11: shared summary rules, unknown estimates, lock protection, proposal and undo. |
| G17 | Optional life areas | Add | Work, Home, Health, Learning, Personal administration | U12: areas group projects/notes; tags remain available; setup is optional. |
| G18 | Goals connected to projects and review | Add/Improve | Life planning and project outcomes | U12: lightweight goal objects; reuse milestones instead of replacing them. |
| G19 | Habit check-ins and routine sequences | Add | TickTick, Tiimo, Habitica | U13: separate check-in history and ordered routine steps; gentle scheduling. |
| G20 | Templates for common life workflows | Improve | Notion, Trello, ordinary personal use | U14: extend existing task/dashboard presets into useful task/note/routine templates. |
| G21 | Contextual daily and weekly review | Improve | Sunsama, NotePlan | U07/U10/U12/U13: link existing reviews to notes and commitments. |
| G22 | Inbound migration from other tools | Add | Switching cost | U16: CSV mapper and Markdown import, previews and per-field loss reports. |
| G23 | Portable notes, recovery, and history | Add/Improve | Obsidian, NotePlan, Capacities | U01/U05/U16: note backup/export/history and restore round trips. |
| G24 | Consistent desktop/mobile interaction | Improve | Things, Structured, familiar app conventions | U01/U18: common components, typography, contextual actions, focus behavior. |
| G25 | Cross-device trust and capability disclosure | Improve | Sync convenience and bundled alternatives | U01/U04/U05: per-content state; don't describe every local preference as synced. |
| G26 | Practical source integrations | Add | Akiflow, Routine, Trello | U19: select email/task sources after demand validation; preserve source identity. |
| G27 | General API, webhooks, automation | Add | Power users and integrations | U20: scoped authenticated commands, auditability and rate limits; after stable entities. |
| G28 | Generative AI assistance | Add | Current workspace/planner products | U21: optional summarization/breakdown with previews; measure real value and cost. |
| G29 | Shared household lists or project collaboration | Add | To Do, Reminders ecosystem, Trello | U22: later pilot with roles, invitations, conflict handling, and clear private boundaries. |
| G30 | Native widgets, desktop hotkey, watch surfaces | Add/Validate | TickTick, Structured, native alternatives | U23: validate demand/platform gaps; separate delivery track, not a CSS task. |
| G31 | OCR, handwriting, PDF annotation | Add | Evernote, OneNote | U24: specialist later; file/reference workflow first. |
| G32 | Knowledge graph, canvas, arbitrary databases | Add | Obsidian, Notion, Capacities | U24: later experiments; links/search before complex representations. |
| G33 | Advanced team PM, portfolios, resource planning | Add | Asana, ClickUp | U22/U24: separate expansion, after evidence of team demand. |
| G34 | Full gamification economy | Add | Habitica | U24: optional experiment; basic habits and respectful feedback first. |
| G35 | Native website/app blocking | Add | Focus-specialist alternatives | U23/U24: separate extension/native capability; no web-only promise. |
| G36 | Extra themes, timer modes, analytics scores | Existing breadth / Validate | Personalization and insight | Maintain/accessibility polish; expansion parked until evidence beats higher priorities. |

Every material feature family identified in the competitive review has a disposition here. This is a bounded research inventory, not an exhaustive audit of every feature in every competitor. “Include all missing things” becomes an explicit backlog with staging and exclusions, rather than adding all of them to the first release.

## 4. Target information architecture

### Navigation

Keep five desktop destinations: **Today, Inbox, Plan, Projects, Notes**. Retain Focus as a persistent action showing Start or Resume. Use a collapsible personal section for Areas, Goals, Routines, and Review as those capabilities arrive. Favorites can pin any project, note, or saved view; avoid displaying the same favorite twice in the same sidebar.

Keep the existing mobile tabs **Today, Inbox, Add, Plan, More** initially. Put Notes near the top of More and make recent notes available in search/capture. Test whether frequent note users benefit from replacing Inbox with Notes; do not add seven crowded tabs. Persist the last open note and maintain expected back behavior.

Board, Matrix, List, and Calendar are representations of data. Keep advanced global views available through More and commands while adding appropriate local view tabs within projects. Preserve existing URLs and saved views when consolidating routes.

### Objects and relationships

| Object | Meaning | Required relationships |
|---|---|---|
| Task | An action with one completion identity | Optional project, note origin, deadline, recurrence, work blocks, and reminders |
| Note | Writing/reference that can exist independently | Optional project/area/date, links to tasks/notes/projects, versions |
| Project | A finite outcome or body of work | Existing milestones/tasks, linked notes; optional area and goal |
| Area | An ongoing responsibility | Optional grouping for projects, notes, routines; not a separate account/workspace |
| Goal | An intended outcome to review | Linked projects/milestones and a review cadence; optional target date |
| Routine | An ordered or recurring sequence | Steps, schedule/window, skip/pause behavior, completion history |
| Habit | A repeated behavior to check in on | Frequency/target, dated check-ins; distinguish from tasks with deadlines |
| Work block | A planned interval allocated to work | One task or an explicitly defined routine; start/end/timezone and lock |
| Calendar event | A commitment owned locally or by a provider | Source/calendar identity, timezone, occurrence identity, cached state |

Do not turn areas into duplicate projects or turn every note checkbox into an independent task automatically. Offer **Create linked task** and clearly show when a checkbox is just part of the note. Multi-workspace isolation, team spaces, and accounts have different meanings and should not share one misleading control.

## 5. Screen-by-screen UI/UX specification

The measurements in this section are **proposed FlowTask design targets**, not measured competitor standards. Existing tokens and components should be reused or migrated systematically.

### Today

**Preserve:** quick capture, Top 3, clear task titles, next-action text, focus launch, capacity summary, optional timeline.

**Change:**

- Compact the mobile header. In the 390px capture, the page title, subtitle, layout selector, action row, and composer consume substantial space before the first actionable task. Aim to show capture and at least one task in a 390×844 viewport at default text size; keep zoom/reflow usable.
- Put **Plan my day** in one recognizable location; make Customize a secondary menu action. Move layout selection behind customization after the user has chosen a default. Do not remove existing layouts or reset user preferences.
- Show an active focus task as **Resume [task]**, with its next action and progress. Use the same state in the header and studio entry.
- Add a small **Daily note** entry and **Routine check-in** only when enabled. Avoid turning Today into an ever-growing widget wall.
- Label capacity honestly: **2h 15m selected · 3h 45m remaining**, with detail for calendar commitments and unknown estimates. “Available” should not ambiguously mean both total budget and remaining capacity.
- Keep Top 3 optional. Collapse empty-slot instructional copy after onboarding rather than giving it permanent space.
- Maintain one task-row component across Today, lists, projects, and search. Put title first, next action second, and only useful metadata beneath. Show the deadline distinctly when it matters; don't repeat every field on every row.

### Inbox and capture

One capture surface with a small **Task / Note** selector; default to the last explicit type or task for the existing quick-add route. Plain Enter saves a task; multiline note entry uses an obvious Save/Close behavior with a persistent save state. Optional NLP chips must be individually removable.

Captured items retain source URL/app and a timestamp where available. Inbox triage offers **Plan, Move, Convert to note, Defer, Archive**. Batch actions use the same commands as single-item actions. An unclassified item is valid; no requirement to choose an area or goal before saving.

For extension/mobile capture, show **Saved to this device**, **Waiting to deliver**, **Delivered**, and **Delivery failed** as distinct states. Reopening a capture must not deliver a duplicate. The existing extension already queues captures and acknowledges delivery; extend this behavior instead of replacing it blindly.

### Plan

Desktop: unscheduled work beside Day/Week calendar views; optional month overview for commitments. Mobile: an agenda and date strip with a deliberate switch to a scrollable timeline. Preserve calendar headers during intentional horizontal scrolling, and provide a non-drag time picker.

Use consistent time format, working-hour range, selected date, and terminology between Today's timeline and Plan. The current captures show a 24-hour Today rail and a narrower Plan range; unify settings rather than forcing one range for everyone.

Replace ordinary **Add Session / Session Duration Generator** wording with **Add work block** outside study-specific flows. Keep session numbers and pacing inside optional study tools. Consolidate **Plan my day**, **Auto-Slot Day**, and reschedule controls into a coherent hierarchy: choose work → place work → review changes.

Show provider events as sourced commitments and task blocks as editable work. Conflicts need text, not only color. Auto-plan preview names each moved item, what remains unscheduled, and which constraints were protected. Completing a task is different from finishing one block of work on it.

### Task details

Standard hierarchy: title/completion → next action and Focus → Plan for / Deadline / Reminder → project/area → subtasks → linked notes → secondary properties/history. Collapse advanced scheduling, dependencies, study tools, and audit details by default while keeping them searchable/discoverable.

The current drawer is a useful base: it already separates dates, includes a next action, and uses disclosure. Refine the oversized next-action panel, dense date controls, overlapping schedule language, and small action labels. Use a shared date control with explicit scope, locale-aware display, and an ordinary time-block action.

Desktop uses an inspector that preserves list position. Mobile uses an accessible sheet or full-screen detail page depending on content length; long note editing should be full-screen. Escape/back closes one layer and restores focus. Dialog behavior must match its modal semantics; background controls must not remain keyboard-operable behind a modal.

### Notes

Desktop has a note list and editor; optional references/agenda can open as a secondary panel when space allows. Mobile shows one step at a time: library → note → optional linked context. Provide Recents, Favorites, All notes, Tags, Daily notes, and Trash without forcing a deep folder tree.

Notes v1 supports title, headings, paragraphs, lists, checkboxes, code, links, undo/redo, search, and visible save status. Select text → Create linked task retains the source paragraph/reference. `[[` or an ordinary Link control can link notes/projects; keyboard syntax must be optional. Backlinks appear in a collapsible **Referenced by** section.

For an existing scratchpad, offer **Keep on this device** or **Import as a note** with the resulting sync scope shown. Never silently upload previously local-only writing. Task descriptions stay intact; converting one to a standalone note is an explicit, reversible action. Add version restore before advertising notes as a dependable long-term archive.

### Projects, areas, and goals

Project header: outcome, target date, next milestone, and one useful next action. Tabs: **Tasks · Notes · Milestones**; views live within Tasks. Keep covers optional. Replace “dedicated workspaces” copy in the current project screen with language matching actual project ownership.

Areas organize ongoing responsibilities such as Work, Home, Learning, and Personal. Offer examples that can be renamed or skipped. Goals connect to projects/milestones and appear in weekly review; avoid compulsory scores or fake precision from counting unrelated tasks.

### Routines and habits

Provide a short ordered routine editor, flexible recurrence/window, skip/pause, and a clear next step. A routine should not demand an exact clock time unless the user wants one. Habits have check-ins and targets; they are not overdue tasks every time a day is missed.

Review uses neutral language: **Done, Skipped, Paused, Adjust**. Show consistency only when useful and opt-in. Do not imply streaks measure character, mental health, or overall productivity. A full game economy remains outside this release.

### Review and Settings

Weekly review: unfinished commitments → overdue deadlines → projects/goals needing attention → notes needing action → routines → next week's capacity. End with a preview of deliberate changes, not silent rollover. Daily reflection can append to the dated note; journal writing remains optional.

Settings groups **Account & sync, Data & recovery, Calendars & connections, Reminders, Appearance, Workflow, Accessibility**. Show storage/save/sync state in context as well as Settings. Keep last cloud sync distinct from a separate backup. Display exclusions for imported calendars, personal media, and other device-local items.

## 6. Visual and interaction standards

| Property | Proposed standard | Verification |
|---|---|---|
| Typography | One principal UI family; 14–16px body/task text, 12–13px metadata, restrained 28–36px page headings; comfortable line height | Check reading at phone widths and 200% zoom; never rely on 10px text for essential information. |
| Spacing and density | A shared 4/8px scale; comfortable default and intentional compact mode | Same density preference across task rows, menus, and forms; no per-screen spacing drift. |
| Surface hierarchy | Page, sidebar, panel, selected/hover states; thin separators; restrained elevation | Migrate `--desk-*`, base tokens, and legacy utility styling to shared semantic roles. Avoid a new theme system. |
| Color | Brand accent for primary actions; explicit semantic colors for warning/error/success; text labels for priority/status | Check every existing theme and background image. Don't depend on checkbox color to explain priority. |
| Controls | Shared buttons, menus, date/time pickers, chips, tabs, inspector/sheet | Keyboard, touch, focus restoration, loading, disabled, error, and overflow states verified. |
| Touch | Aim for 44px usable targets with spacing; keep destructive actions separated | This is a product target, not a claim that WCAG AA universally mandates 44px. |
| Accessibility | WCAG 2.2 AA target; readable contrast, visible unobscured focus, labels, correct semantics, reflow, non-drag alternatives | Automated scans plus keyboard and real screen-reader checks; [WCAG reference](https://www.w3.org/WAI/WCAG22/quickref/). |
| Responsive behavior | Collapse companion panels before squeezing main content; full-width mobile editing; safe-area/keyboard handling | Check 320, 390, 768, 1024, 1280, 1440px and zoom. Deliberate calendar scrolling is different from page overflow. |
| Motion | Short purposeful feedback; no motion required to understand state; honor app and OS reduced-motion choices | Check content remains visible and operable when animations are disabled. Existing animation components need an audit before any broad motion rewrite. |
| Feedback | Clear local save, pending sync, conflict, error, and delivered states; undo for reversible changes | Network/storage-failure fixtures and real device background/resume checks. |
| Performance | Immediate input feedback; deferred heavy editors/search indexes; bounded media loading | Use field p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 as quality targets; lab capture/search measurements remain separate. [Web Vitals](https://web.dev/articles/vitals). |

Accessibility and performance standards above are release targets. This research did not perform a fresh compliance assessment or measure field performance. Exact screen widths and type sizes remain subject to usability validation.

## 7. Delivery roadmap

Priority reflects product judgment and dependencies, not fabricated usage counts or RICE scores. Effort labels are relative: **S** = localized refinement, **M** = a substantial bounded feature, **L** = several application/data boundaries, **XL** = a new delivery platform or authorization model. They are not calendar estimates. Re-estimate after the first prototypes and migration design.

### Release waves

| Wave | Deliverable | Backlog | Exit condition |
|---|---|---|---|
| **0 — Trust and common interactions** | Confirm current journeys/release gaps, shared task/date controls, save/sync language, baseline usability | U01, U02, U18 foundations | Capture → plan → focus → resume → review remains intact; no regression in export/recovery/accessibility. |
| **1 — Connected Notes** | Note records/library/editor, links, daily notes, search, safe scratchpad import, portable note backup | U05, U06, U07, U08, U16 minimum | A note survives offline editing, restart, optional sync, export and restore; a linked task is never duplicated. |
| **2 — Remember and plan across devices** | Reminder delivery, mobile/external capture improvements, Google read connection, week planning, multiple work blocks | U03, U04, U09, U10, U11 | A work-and-personal week can be planned around sourced commitments; reminders and failure states are understood on supported devices. |
| **3 — Organize life** | Areas/goals, habits/routines, broad templates, file references/attachments | U12, U13, U14, U15, U16 expansion | Home/work/learning use cases complete without study/developer configuration or an elaborate setup. |
| **4 — Reduce repeated maintenance** | Calendar writes, selected integrations, API/automation, optional AI | U17, U19, U20, U21 | Each connection has stable identity, permission, revocation, retry, conflict, and export behavior; measured value exceeds added burden. |
| **5 — Validated expansion** | Shared lists, native surfaces, specialist knowledge/focus tools | U22, U23, U24 | Separate research/business case, ownership model, maintenance budget, and acceptance plan. |

Reminder/platform discovery and calendar-provider investigation can start during Wave 1; they should not block delivery of useful local Notes. A smaller combined beta can contain Notes plus reminders before all Wave 2 features are ready. Do not assign delivery dates without staffing, estimates, and the existing release-gate schedule.

### Implementable backlog

| ID | Scope / priority / effort | Dependencies | Acceptance outcome |
|---|---|---|---|
| **U01** | Trust contracts, migration and release baseline; P0 / M | Existing readiness work | Supported data is never called synced until delivery succeeds; failed writes are recoverable; new schema restores correctly; remaining live gates have owners. |
| **U02** | Shared capture/task/date vocabulary; P0 / M | U01 foundations | Task created from any in-app entry has the same metadata semantics; moving planned work never changes its deadline; optional fields don't block capture. |
| **U03** | External/mobile capture; P1 / L | U01–02, platform discovery | Captures survive unavailable app/network and arrive once with source context; unsupported share/native behavior has an explicit fallback. |
| **U04** | Reminder model and delivery; P1 / L | U01–02, delivery service | Create, edit, snooze, complete, revoke permission and delete across devices without stale or duplicate reminders; platform limitations are disclosed. |
| **U05** | Notes library, editor, autosave, versions; P1 / L | U01, format decision | Independent note creation, rename, offline save, restart, optional sync, archive/trash/restore, backup and version recovery all work. |
| **U06** | Stable links and note-origin tasks; P1 / M | U05, command boundaries | Renaming/moving a source preserves references; creating a task twice accidentally does not make two tasks; completion stays consistent in all views. |
| **U07** | Daily notes and reflection links; P1 / M | U05, existing reviews | One date has one designated daily note per personal workspace/timezone convention; repeated opening doesn't duplicate it; optional prompts don't block use. |
| **U08** | Unified search and commands; P1 / M | U05–06 | Search tasks/notes/projects by title/body/type; filters and keyboard/touch work; deleted/private-scope content is excluded correctly. |
| **U09** | Calendar read connections; P1 / L | U01, provider integration | Multiple selected calendars retain source identity and freshness; revoked access preserves local tasks; DST/all-day/recurrence cases pass. |
| **U10** | Week planning and shared capacity model; P1 / M | Existing Upcoming/WeeklyWorkload, U09 where connected | Moving work between days shows capacity/unknown estimates; reviewable changes preserve deadlines, locks and external commitments. |
| **U11** | Independent work blocks; P1 / L | U01, U10 domain design | One task spans several days without duplicate task completion or inflated focused time; migration maps old start/end fields into one block. |
| **U12** | Areas and goal relationships; P2 / M | U05–06, existing projects/milestones | Users can skip setup, group existing work, archive/reorganize safely, and review a goal through its actual project outcomes. |
| **U13** | Habits and routines; P2 / L | U04, U10, recurrence contracts | Check-ins/steps work across timezones, pauses, skipped days and edits; routine instances don't flood future task views. |
| **U14** | Templates and recurrence refinement; P2 / M | U05, U12–13 for richer templates | Reusing a template creates fresh identities; date offsets preview clearly; editing a template doesn't mutate previous instances. |
| **U15** | Reference links and attachments; P2 / L | U05–06, storage contract | Size/type/offline/cloud/export state are visible; missing files are handled; deletion and restore have no orphaned unbounded storage. |
| **U16** | Import/export/migration; P1 minimum, P2 expansion / M | U05 minimum; all new entities for expansion | CSV mapping and Markdown note import preview transformations; repeat import is safe; unsupported fields are reported; full backup restores supported relationships. |
| **U17** | Opt-in calendar writes; P2 / L | U09, U11 | Create/update/delete only intended blocks; distinguish series/occurrence; retry creates no duplicate event; disconnect doesn't silently delete unrelated events. |
| **U18** | Component and responsive polish; P0 ongoing / M | Shared tokens/components | Five core screens share readable hierarchy, action behavior and focus handling; all preserved themes remain usable; no mobile content blocked by navigation/keyboard. |
| **U19** | Selected work-source integrations; P3 / L | U03, U09, stable commands | Start with one validated source; display original owner and link; one-way import vs two-way updates is explicit; rate limits/revocation recover cleanly. |
| **U20** | API/webhooks/automation; P3 / L | U05–06, U11, U19 contracts | Scopes, idempotent commands, audit records and revocation established; no uncontrolled access to private content. |
| **U21** | Optional hosted AI assistance; P3 / L | U02, U05, U10, privacy/cost design | Preview, edit, apply, undo; no automatic content upload without a clear boundary; offline/local alternatives; evaluation on real planning/note tasks. |
| **U22** | Shared lists and collaboration pilot; Later / XL | Separate ownership/permissions design | Invite/revoke/leave, private content separation, roles, concurrent changes, notifications and backup scope verified. |
| **U23** | Native/extension companion surfaces; Later / XL | Supported platform research, U03–04 | Demonstrate the missing platform job—widget, global capture, blocking or notification—and budget ongoing platform maintenance. |
| **U24** | Specialist feature experiments; Later / XL | Evidence of repeated unmet need | A specific workflow justifies OCR/ink/PDF, graph/canvas/database, team PM, or game features; prototype before expanding the domain. |

P0 means a prerequisite or release requirement; P1 means central personal-organizer value; P2 means the next coherent expansion; P3 and Later are conditional. This does not mean current reliability features are absent or need to be rebuilt.

## 8. Engineering contracts before implementation

### Notes and links

Choose one canonical note format and document its lossless supported subset. A Markdown-first representation fits current task descriptions and portability, but stable task anchors require durable IDs; character offsets alone will break when text changes. A structured editor is also viable if Markdown import/export and schema migration are deliberate. Prototype the hard editing cases before choosing the library.

Suggested note contract: `id`, `workspaceId`, `title`, `body`, `formatVersion`, timestamps/revision, archive/delete state, optional `projectId`/`areaId`/`dailyDate`, and references to stable entity IDs. Model explicit relationships separately or derive a search/link index from canonical content; do not create two independently writable sources of truth for task completion.

Extend `WorkspaceRecord`, synced entity/collection contracts, validation, migrations, command/outbox handling, cloud adapters/rules, export/restore, account deletion and recovery together. Current workspace schema supports versions through 8; do not pick the next schema number until implementation starts and the then-current code is checked.

Do not store a large note library in one preference blob. Per-note revisions reduce conflict scope. Until collaborative editing is a real requirement, avoid introducing a full real-time CRDT system by default. Concurrent offline edits still need preserved versions/conflict recovery; last-write-wins must not silently discard long-form writing.

### Scheduling

Current tasks store one `scheduledStart`/`scheduledEnd` pair. The study-session editor updates that pair and associated metadata; it does not establish a general collection of work blocks per task. Add blocks only with an explicit migration and selectors that avoid double-counting old fields and new records.

Proposed block contract: stable ID, task ID, start/end instants or carefully defined local date/time plus IANA timezone, locked state, estimate allocation, and optional external event mapping. Define cross-midnight, travel/DST, task completion, recurrence, deletion, and partial work before building the UI.

Keep planned demand, scheduled allocation, remaining capacity, and actually focused time separate. A completed work block does not necessarily complete the task. An event mirrored from a provider is not another independent copy of its task's duration.

### Calendar connections

Start with read permissions and selected calendars. Retain provider/calendar/event/occurrence identity and timezone; implement incremental refresh or equivalent reconciliation, revoked-token behavior, stale-state labels, recurring exceptions, all-day events, and cancellation. Provider OAuth connection records and secrets need their own secure handling, separate from portable task content.

Write access is a later capability with an explicit ownership policy. Never describe ICS import as two-way sync. Never delete a provider event just because a local cache was cleared. Connecting a work account is optional and should explain the actual requested scopes.

### Reminders

Task `dueTime` is not a reminder delivery guarantee. Add persisted reminder identity, intended time/timezone, relative trigger semantics if supported, snooze state, active device subscriptions, completion/deletion cancellation, and idempotent delivery.

Foreground timers alone cannot provide closed-app reminders. Web Push involves a service worker, permission and a subscription, and messages originate through a push service. Delivery remains dependent on the browser/device/network; native-like exact offline alarms cannot be promised for every web platform. [Push API reference](https://developer.mozilla.org/en-US/docs/Web/API/Push_API). Test supported devices and background states, provide a diagnostic/test reminder, and distinguish unsupported, permission denied, queued, and sent. Do not display “delivered” unless that state is actually known.

### Habits, areas, goals, and files

Habit check-ins and routine instances need dated identity and edit scope; do not generate infinite future tasks. Areas are organizational records, not account-security boundaries. Goals can link existing projects/milestones without inventing a second project hierarchy.

Attachments need storage quotas, ownership, local/cloud state, access validation, download/export, deletion and malware/content handling appropriate to the storage service. General file support should not accidentally upload existing personal audio/images, which currently have different guarantees. OCR and annotation add separate processing/storage requirements.

### Migration and compatibility

Each new entity ships with old-data fixtures, validation, forward migration, a recoverable pre-migration copy, offline behavior, cloud rules, import/export, deletion and restore. Maintain existing task descriptions, scratchpad content, dashboard layouts, themes, custom views, URLs, and project milestones. A change in organization must not erase data or silently upload something previously device-local.

## 9. Acceptance journeys

| Journey | Pass condition |
|---|---|
| Household capture | On a phone, capture “Renew passport next month”; add a deadline/reminder later; it is available in the intended account/device scope with source and save state. |
| Notes to action | Write a project note, select a paragraph, create a linked task, schedule it, then return from task to the exact note context. One completion identity survives across every view. |
| Work and personal week | Connect selected calendars, keep private details scoped appropriately, schedule work around commitments, move one block and preserve the task deadline. |
| Longer work | Split one task across two days; complete the first block, resume the same task later, and record accurate time without double counting. |
| Morning routine | Start an optional routine, skip a step/day, pause during travel, and continue without a backlog of artificial overdue tasks. |
| Search | Find a note by body text, a task by project, and an archived item intentionally; ordinary search excludes trash unless requested. |
| Reminder lifecycle | Create/snooze/complete a reminder across two devices, revoke permission, and delete the task; stale/duplicate notifications are prevented as far as the supported platform permits. |
| Offline and conflict | Edit a note offline, make a conflicting edit elsewhere, reconnect and recover both versions with a comprehensible choice. |
| Portability | Export the supported workspace, restore into an empty profile, and verify entities, references, history scope, and exclusions; importing twice does not duplicate content silently. |
| Accessible daily use | Keyboard-only and screen-reader users can capture, edit, schedule without drag, start/resume, and close overlays with focus restored. |

Initial formative usability targets: at least **80% of participants** finish the core capture → note/task → plan → focus → review journey without assistance; a familiar user captures another task within **10 seconds**; a new user reaches a useful first task/note within **60 seconds**. These are **proposed targets**, not established baselines or statistical proof. Measure the present product before interpreting changes.

Additional outcomes: successful search/retrieval, reminder comprehension, restore confidence, frequency of duplicate capture, weekly returning users, purposeful deferral, and observed maintenance time. Do not optimize task counts, streaks, or time in app as proxies for a better-organized life.

Automated checks should exercise new domain/migration and integration behavior. Validate small visual refinements by focused visual/interaction checks rather than adding tests that merely reproduce CSS. For source changes, use the repository's required checks and existing release configuration; this planning task has not run or passed them anew.

## 10. The first build slice

The best concrete starting slice is **Notes v1 plus linked task creation**, supported by U01/U02/U18 foundations:

1. Write the note-format, sync/privacy, version/conflict, and migration contracts against the current code.
2. Build a Notes library and editor with local persistence, archive/trash/restore, and a clear save state.
3. Add deliberate scratchpad import and selection-to-linked-task behavior.
4. Extend search and project context, plus optional daily note entry.
5. Ship complete JSON/Markdown portability and restore coverage for notes.
6. Enable optional note sync only after account/cloud conflict and deletion checks pass.
7. Test ordinary home/work workflows with new users, then proceed with reminder delivery and calendar/week planning.

This slice is large enough to deliver a new coherent user capability while preserving the product's existing planning and focus strengths. The remainder of the roadmap stays visible and dependency-ordered, rather than becoming a simultaneous rewrite.
