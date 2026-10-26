# Flowtask: product audit and focused upgrade strategy

**Research date: 26 October 2026 · Research and planning only · No product implementation authorized or performed**

Read this report with the [competitive intelligence appendix](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/COMPETITIVE_INTELLIGENCE.md) and [verification record](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/VERIFICATION.md). The appendix covers all 33 requested products, two additional relevant alternatives, current price observations, and the limits of community evidence.

## 1. Executive verdict

**Flowtask is a capable, visually distinctive beta with a stronger engineering foundation than its everyday workflow suggests. It is not yet a compelling replacement for a trusted task manager or daily planner. Its biggest problem is that its interfaces make inconsistent promises about the same work.**

A user can capture a task, connect a note, enter an attractive focus environment, and save the next action. That is a useful foundation. But the same user can also move a locked task, create overlapping reservations without a warning through the task drawer, and read “1.3 h planned” while two tasks reserve six hours. Typing “tomorrow” into Today creates a deadline tomorrow while keeping the task planned today. These are material trust failures, not cosmetic polish issues.

The product already spans task management, calendar planning, study sessions, notes, life areas, quarterly goals, routines, reviews, dashboards, and ambient focus. That breadth currently costs more attention than it earns. **A meaningful problem is present—starting and returning to self-directed work—but Flowtask is drifting toward another overloaded productivity dashboard.** The remedy is a smaller default experience and shared behavioral contracts, not another major feature category or a rewrite.

### Evidence language

- **Observed:** reproduced in the running local app with synthetic data; screenshots and steps are in the verification record.
- **Code finding:** directly inspected implementation or a local check. This does not automatically prove every deployed path behaves the same way.
- **Verified external:** current official public product documentation or pricing. Marketing claims verify what a vendor offers or claims, not that the promised outcome occurs.
- **Hypothesis:** a proposed product or business decision that needs user evidence.
- **Speculative:** a possible later experiment with no commitment recommended now.

### Assessment scores

These are judgment scores, not instrumented benchmarks or comparisons from equivalent paid trials. Anchors: **1 = substantially unusable; 5 = useful beta with material gaps; 8 = coherent, trusted, polished; 10 = exceptional category execution.** Confidence varies with evidence depth.

| Dimension | Weight | Score / 10 | Evidence and confidence |
|---|---:|---:|---|
| Workflow coherence | 20% | 5.0 | Working capture → task → focus loop, but competing homes and overlapping study/general-work semantics. High confidence. |
| Capture and task handling | 10% | 6.5 | Fast first capture, rich metadata and linked notes; ambiguous date meaning and excessive initial detail. High. |
| Planning trust | 20% | 3.5 | Reproduced lock bypass, silent drawer overlaps, misleading reservation/effort presentation. High. |
| Focus and execution | 15% | 7.0 | Immersive Studio, shared runtime, next-action checkpoint, resumable state. Long-running/sleep reliability not exercised. Medium. |
| Visual and interaction quality | 10% | 6.0 | Recognizable art direction; too many badges, translucent layers and controls compete with work. Visual judgment. Medium. |
| Mobile and accessibility | 10% | 5.0 | Responsive navigation exists; narrow-screen capture is pushed down and controls can be small. Partial audit only. Medium/low. |
| Engineering and recovery foundation | 10% | 7.0 | Durable commands, validation, recovery, passing local tests. This scores the foundation, not proven production reliability. Medium. |
| Differentiation today | 5% | 4.0 | Useful combination, but each headline capability has close alternatives and no demonstrated retention advantage. Medium. |
| **Weighted assessment** | **100%** | **5.4** | **Functional, ambitious beta; not yet a trusted category contender.** |

Product-market fit, retention, willingness to pay, real task-start improvement, and support burden are **unknown**. No score for those would be evidence-based.

### Why choose or reject it today?

**Choose it today** if you want a free public beta that starts without an account, prefer a calming visual environment, do substantial work on one laptop, and like having task context and a timer together. The local-first path and saved next-action cue are tangible benefits, not just future promises.

**Reject or abandon it** if you need dependable calendar commitments, mature cross-provider scheduling, reliable access across devices, a minimal first screen, or an established task system you can trust without checking its interpretation. A new user sees a large life-management system before establishing a daily habit. An experienced user will notice the time-model inconsistencies and compare the maintenance burden with their existing tools.

**Superior alternatives for specific jobs:** Sunsama presents a more deliberate daily-planning proposition; Morgen documents stronger multi-calendar planning and explicit AI confirmation; Todoist offers a much broader capture/integration ecosystem; Things separates start dates and deadlines clearly; Llama Life has a sharper “work through the list” proposition; Workona specializes in restoring browser context; myNoise offers much deeper sound control. These are supported capability/positioning comparisons, not a claim that every paid interaction was independently tested. See the linked primary sources in the appendix.

**Greatest untapped advantage:** the existing connection between a task, its next small action, linked context and a shared focus lifecycle. Make that connection obvious and dependable. Neither an attractive room nor a feature inventory is a defensible advantage on its own.

## 2. Product investigation

### Scope and what the checks actually establish

The audit examined the current working tree, not just committed HEAD or old project reports. It includes 301 production TS/TSX files, the main domain/services, task and calendar paths, Studio/runtime, storage/sync/recovery, extension capture, and representative secondary views. Browser exploration used a fresh local origin on port 5176 with synthetic tasks and notes. The existing server on 5173 was preserved. All major navigation areas were inspected, but not every setting or feature combination was exercised.

Local validation passed **1,361 tests in 170 files**, application TypeScript checking, and **15 security tests**. Lint exited successfully with three FocusStudio hook-dependency warnings. Test output also included React `act(...)` and expected environment warnings. These results do not override the reproduced workflow defects. The host used Node 25.6.1 while the project specifies Node 22.x; CI/release-environment validation remains necessary. No dependencies were installed and no production build was generated.

### The five most consequential findings

#### A. A locked task can still be moved through the session editor

**Observed · P0 · High confidence.** A task was scheduled for 14:30–17:30, its “Lock this task's scheduled time” option was enabled, then **Edit Session → Morning → Apply Session** moved it to 08:00–11:00. The lock stayed enabled. The product communicates protection that this path does not enforce.

The drawer's [session handler](C:/Users/kunal/Desktop/Flow-task/src/components/tasks/drawer/TaskDrawerProperties.tsx:78) patches task clock fields directly. The generic [task update command](C:/Users/kunal/Desktop/Flow-task/src/services/commandService.ts:108) does not supply a universal scheduling guard. Dedicated [work-session move/resize operations](C:/Users/kunal/Desktop/Flow-task/src/services/workBlockService.ts:264) do check locks, but not every scheduling surface uses them.

**Required result:** every move, resize, date edit, preset, nudge, bulk change and planner apply must pass through the same time-change policy. Changing a locked reservation must require an explicit, visible unlock or a clearly scoped override. Add regression coverage at the command boundary and through the drawer that failed.

#### B. Effort and calendar reservations tell different stories

**Observed · P0 · High confidence.** The drawer accepted two tasks at 14:30–17:30 without a conflict warning. The Plan header showed **1.3 h planned / 6 h capacity**. That first example represented 360 minutes of reservation demand, 180 minutes of unique occupied time and 180 minutes of overlapping demand—not six unique occupied hours. After moving one task to 08:00–11:00, the tasks reserved six distinct hours while the header still showed 1.3 h.

The arithmetic is explainable: [dayPlanSummary](C:/Users/kunal/Desktop/Flow-task/src/utils/dayPlanSummary.ts:188) totals estimated task effort separately from scheduled duration; [TimelineView](C:/Users/kunal/Desktop/Flow-task/src/components/views/TimelineView.tsx:118) labels that estimate as “planned.” The [daily planning summary](C:/Users/kunal/Desktop/Flow-task/src/components/workflow/DailyPlanning.tsx:198) similarly offered 285 minutes of “breathing room” from 75 estimated minutes and a 360-minute budget. The current UI does not communicate which quantity is being described.

**Required result:** distinguish remaining effort, reserved calendar time, conflicting reservations and remaining available time. A 45-minute task should not silently acquire a three-hour reservation because the default session preset is three hours. Some calendar paths already warn about conflicts; the defect is inconsistent enforcement, not a complete absence of conflict logic.

![Plan shows 1.3 hours while the displayed task alone reserves three hours](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/evidence/15-reservation-capacity.jpg)

#### C. Ordinary date language does not match the likely capture intention

**Observed behavior; intention is a hypothesis · P0.** On 26 October, entering `Read chapter tomorrow #personal ~45m p1` in Today produced a task **planned 26 October, due 27 October**. The preview did say “Deadline,” so this is not an invisible parser failure. It is a questionable product contract that requires the user to understand special syntax to obtain an ordinary planning outcome.

The [parser](C:/Users/kunal/Desktop/Flow-task/src/utils/nlpParser.ts:142) supports explicit `plan:` and `due:` tokens, but bare date language falls into `dueDate` at [line 179](C:/Users/kunal/Desktop/Flow-task/src/utils/nlpParser.ts:179). [Today capture](C:/Users/kunal/Desktop/Flow-task/src/components/views/today/HorizonTodayView.tsx:566) defaults the planned date to today.

**Proposed contract:** ordinary “tomorrow” means planned tomorrow; explicit “due Friday” or `due:` means deadline. Keep both fields independently editable in a visible capture preview. Validate that contract with unfamiliar users before finalizing it. Apply it consistently to global capture, task composer, inbox and extension. Do not reinterpret historical deadlines automatically.

#### D. The breakdown can confidently suggest unrelated work

**Observed and code reproduced · P1, release-blocking if advertised as intelligent assistance.** `decompose Audit onboarding accessibility` returned steps about receipts, 1099s, income reconciliation, tax filing and archiving a filing confirmation, totaling 110 minutes. The [template classifier](C:/Users/kunal/Desktop/Flow-task/src/utils/aiCopilot.ts:37) matches `/audit/i` to tax work. “Fix typo in README” also receives an oversized generic development sequence in the pure function; that example was code-tested, not separately run through the UI.

The interface partly discloses local templates, yet task-row wording includes “Breakdown with AI.” Users should not need to inspect supported commands to learn the limitations. **Relabel deterministic templates honestly; remove broad ambiguous matches; provide an editable first action when confidence is low; do not invent precise effort.** Buying an LLM is not necessary to fix this issue. Goblin.tools produced relevant proposal steps in one public test, but that single example is not a general quality benchmark.

#### E. Scheduling general work makes it “study” work

**Observed and code confirmed · P1.** Scheduling the proposal and reading tasks made them appear as planned sessions in Study Hub. The [study selector](C:/Users/kunal/Desktop/Flow-task/src/utils/taskSelectors.ts:37) treats any task with `sessionMetadata.isSession` as a study task, and the drawer sets that flag when adding a session.

**Required result:** separate work kind (optional study/general classification), planned reservation and actual focus session. Keep study templates for users who choose them. Scheduling a project proposal must not implicitly enroll it in a study workflow.

### Feature-by-feature disposition

“Keep” means retain the capability and its useful foundation; it does not mean the implementation needs no maintenance.

| Area | What provides value | Deficiency or limit | Decision and evidence |
|---|---|---|---|
| Landing and first use | Clear start-with-one-task path; no account needed; privacy/backup messaging visible. | Broad student/developer and life-management framing obscures the first repeatable job. | **Improve.** Promise a useful first session and return cue. Observed first-use screen, evidence 01. |
| Today / Top 3 | Fast capture and a manageable shortlist; existing five-minute starting action. | Horizon and modular dashboard offer different daily hierarchies. Returning to Today restores a local default view mode. | **Choose one default, keep customization advanced.** [TodayView](C:/Users/kunal/Desktop/Flow-task/src/components/views/TodayView.tsx:43), evidence 11. |
| Task capture | NLP preview, project, effort and priority extraction work in the tested example. | Planned/deadline meaning above; default 30-minute display can look like a user estimate when none was set. | **Fix contracts.** [Today capture](C:/Users/kunal/Desktop/Flow-task/src/components/views/today/HorizonTodayView.tsx:550), [task row](C:/Users/kunal/Desktop/Flow-task/src/components/tasks/WorkspaceTaskRow.tsx:128). |
| Inbox / Upcoming | Captures unscheduled work without requiring a calendar slot. | Several entry points can create different scheduling expectations; full cross-surface parity was not tested. | **Keep, unify commands.** Acceptance matrix below. |
| Task drawer | Next action, context, dependencies, dates, notes, subtasks and history can all be useful. | Too many early choices: life area, goal, defer, life admin, breakdown, session, reminders and more. Three-hour session defaults are disproportionate. | **Redesign hierarchy after P0.** Show title, next action, context, planned day, estimate first; advanced sections on demand. Evidence 04. |
| Projects | Outcome, task list/board/matrix, milestone and notes support ongoing work. | Empty metrics and optional structure add setup burden. Sequential availability uses creation/id order, which may not express the user's desired order. | **Keep projects; simplify defaults; make sequence explicit if used.** [eligibility](C:/Users/kunal/Desktop/Flow-task/src/utils/taskEligibility.ts:43). |
| Dependencies and eligibility | Completed/deferred/archived/blocked work is considered; missing references and blockedBy cycles are validated. | More than one relationship concept increases semantic burden. | **Keep guardrails, hide complexity until needed.** [validation](C:/Users/kunal/Desktop/Flow-task/src/utils/workspaceValidation.ts:118). No claim that cycle validation is missing. |
| Calendar / Plan | Canvas and multi-day grid, manual reservations, imported calendar overlay, preview planning and undo foundations. | Inconsistent lock/conflict checks, clock versus WorkBlock writes, misleading effort labels. | **Repair before expansion.** Findings A/B and technical blueprint. |
| Calendar connections | Local .ics import and read-only feed/Webcal give useful availability context. | This is not native Google/Outlook read/write integration. Imported file events are device-only and excluded from cloud/portable backup. | **Describe scope plainly.** [calendar service](C:/Users/kunal/Desktop/Flow-task/src/services/calendarService.ts). One native provider only after demand evidence. |
| Focus Studio | Strong atmosphere, configurable sound/session, Zen/fullscreen/PiP, task queue and next-action note. | The control inventory and decorative environment compete with an immediate Start/Resume decision. | **Keep, simplify entry and active state.** Evidence 02. |
| Focus runtime | Headless lifecycle, wall-clock elapsed time, checkpoints, eligibility and one active session; finishing is designed to avoid duplicate logging. | Sleep/wake, closed-tab behavior, real PiP and multi-device handoff were not proven here. | **Preserve architecture; verify failure cases.** [lifecycle](C:/Users/kunal/Desktop/Flow-task/src/services/focusLifecycle.ts:75), [runtime](C:/Users/kunal/Desktop/Flow-task/src/components/focus/FocusRuntime.tsx:79). |
| Pause / park / finish | Saving “Open outline and write the first paragraph” retained a useful next-action cue. | “Save context & take a break” finishes an interrupted session and opens a new cycle/reflection. Users may expect pause. | **Clarify semantics.** [Studio action](C:/Users/kunal/Desktop/Flow-task/src/components/focus/FocusStudio.tsx:1513). Do not rebuild a second timer. |
| Sprint / Pomodoro presentations | Multiple session structures can fit different work. | Different surfaces and labels make the same lifecycle look like separate products. | **Merge entry vocabulary.** [ModalRoot](C:/Users/kunal/Desktop/Flow-task/src/components/modals/ModalRoot.tsx:154) routes two presentations over shared runtime. |
| Notes | Markdown, task creation from selection, backlink, linked-task list and recovery/version support. | A full PKM ambition would dilute the execution product. | **Keep contextual notes; do not chase Obsidian.** Observed source-note task; [NotesView](C:/Users/kunal/Desktop/Flow-task/src/components/views/NotesView.tsx:954), evidence 06. |
| Quick Notes / daily notes | Capture can happen without a task or project ceremony. | Scratchpad, daily note, task notes and Notes library need clearer ownership/discovery. | **Merge access around the active work context; preserve stored notes.** Evidence 11. |
| Study Hub | Session planning/templates can serve a student segment. | General scheduling currently populates it; competes with general focus queue. | **Make optional specialization after semantics fix.** Finding E. |
| Life areas / goals | Can connect projects to broader intentions for users who want it. | Five starter areas and empty percentage cards add obligations before demonstrated value. Quarterly goals do not help the first task begin. | **Move behind optional setup.** Retain existing data and deep links. Observed empty-state views. |
| Routines | Starter routines and run history may support a stable repeated action. | No observed longitudinal use; avoid “proven” effectiveness language without supporting evidence. | **Keep optional; evaluate one return ritual rather than a full habit suite.** Observed library/history. |
| Daily / weekly review | Existing structure for inbox processing, standup and reflection. | Multiple review destinations and reports can turn reflection into administrative work. | **Merge default to one useful question and tomorrow's next action.** Preserve advanced logbook/exports. |
| Energy / capacity personalization | Configurable capacity and optional estimation calibration are potentially useful. | Fixed circadian curve and “optimal cognitive” wording look more individualized than the data supports. 12/14-hour study presets should not imply healthy or optimal targets. | **Use neutral, editable assumptions.** [energy curve](C:/Users/kunal/Desktop/Flow-task/src/components/timeline/CircadianEnergyCurve.tsx:25), [settings](C:/Users/kunal/Desktop/Flow-task/src/components/modals/SettingsDrawer.tsx:494). |
| Estimation calibration | Existing actual/estimate history can support user adjustment. | Tag/project samples can start at two; tracked focus is not total effort and may be biased. | **Show uncertainty and sample count; opt-in suggestion only.** [calibrator](C:/Users/kunal/Desktop/Flow-task/src/utils/velocityCalibrator.ts). |
| Dashboard customization | Valuable to an invested user with established preferences. | Empty widgets, alternate layouts and custom arrangements delay the first useful action. | **Keep as advanced, not onboarding.** [DailyDesk](C:/Users/kunal/Desktop/Flow-task/src/components/dashboard/DailyDesk.tsx), evidence 11. |
| Global search / shortcuts | Search and capture affordances are visible; useful for experienced users. | Complete keyboard order, dialog escape/focus restoration and all shortcut conflicts not audited. | **Keep; include a keyboard-only core journey in release checks.** No accessibility certification implied. |
| Browser extension | Active-tab capture, explicit host permissions and durable acknowledgement are sensible foundations. | Origin setup/open-app requirement and packaged install/update journey were not exercised. | **Keep narrow: chosen page → task/context.** [manifest](C:/Users/kunal/Desktop/Flow-task/extension/manifest.json). Do not build a tab manager. |
| Reminders | Browser notification path can help while supported runtime is available. | Closed-app/background delivery was not verified. | **State delivery conditions; test before promising alarm reliability.** [reminder service](C:/Users/kunal/Desktop/Flow-task/src/services/reminderService.ts). |
| Backup / local persistence | Export downloaded successfully; recovery and pre-migration snapshots exist in code. | Export is not proof of successful restoration or protection from browser storage removal. Local-first is not equivalent to ordinary local Markdown files. | **Keep, test restore and failure recovery prominently.** [dbService](C:/Users/kunal/Desktop/Flow-task/src/services/dbService.ts:233). |
| Optional cloud sync | Per-entity revisions, receipts, conflict handling and preserved copies provide a serious base. | Real signed-in concurrent-device and deployed rules behavior untested. | **Harden before using sync as a paid promise.** [workspace store](C:/Users/kunal/Desktop/Flow-task/src/services/workspaceStore.ts:340). |
| Visual system / motion | Consistent warm palette, curated rooms, reduced-motion preference support. | Many translucent cards, large headings, emojis and chips reduce information hierarchy; readability over imagery needs measurement. | **Simplify surfaces around work.** Do not add more ambient animation. [motion preference](C:/Users/kunal/Desktop/Flow-task/src/hooks/useMotionPreference.ts). |
| Responsive / accessibility | Narrow-screen layouts and bottom navigation exist; tested document had no horizontal overflow. | At effective 355×767 CSS viewport, backup/header/capacity consume much of the screen before capture. Checkbox measured 18×18; hit-area/spacing compliance needs a real audit. | **Prioritize capture, resume and readable controls.** Evidence 07/08; [checkbox](C:/Users/kunal/Desktop/Flow-task/src/components/ui/MorphCheckbox.tsx:23). |
| Performance | Existing lazy loading, selectors, budgets and performance tests show intent. | No fresh production timings, large-workspace profiling or device battery measurements were collected. | **Measure before optimizing.** Review whole-workspace persistence/validation costs under realistic data; do not infer pervasive rerenders from architecture alone. |

### New user versus experienced user

For a newcomer, onboarding's first-task prompt is appropriate. The problem comes immediately afterward: a task turns into a dense editor, and the sidebar advertises a whole life system. The default should answer **“What am I doing next?”** before explaining how to manage goals or customize a dashboard.

For an experienced task-manager user, power is not the missing ingredient. They need unambiguous dates, predictable keyboard capture, import/export confidence, clear calendar boundaries and preserved workflow rules. A product that looks flexible but moves a locked block creates verification work. That user will keep Todoist, Things or TickTick as the trusted record and treat Flowtask as a disposable timer unless the integration is unusually smooth.

## 3. Competitive position and lessons

The [appendix](C:/Users/kunal/Desktop/Flow-task/docs/research/2026-10-26-strategy/COMPETITIVE_INTELLIGENCE.md) is the full matrix and source record. The most consequential comparisons are:

| Rival / substitute | Why users adopt it | What Flowtask should learn | What it should not copy |
|---|---|---|---|
| Sunsama | Deliberate, finite daily planning and shutdown ritual. | Make capacity and commitment emotionally credible. | A mandatory planning ceremony for every capture. |
| Morgen | Calendars, task sources and Frames with an AI proposal the user confirms. | Preview changes and preserve user agency. | Broad provider integration before core time semantics work. |
| Akiflow | Consolidated inbox, keyboard speed and manual time control. | Reduce translation between capture and calendar. | An expensive integration catalogue for a small team. |
| Motion / Reclaim | Offload finding and adapting calendar space. | Automate bounded rescheduling only when constraints are trustworthy. | Silent broad replanning or a multi-product AI suite. |
| Ellie / Llama Life / Structured | A clear daily list/timeline or a list you actively work through. | A single visible route from choice to action. | Another parallel task universe inside Studio. |
| Todoist / Things / TickTick | Trusted capture, clear task semantics, mature everyday utility. | Win at the execution handoff while maintaining baseline task trust. | Feature-for-feature replacement. |
| Goblin.tools | A very short route from vague work to smaller steps. | Immediate useful output and progressive granularity. | Irrelevant confident templates or unlimited decomposition. |
| Workona / Obsidian / Craft | Restore resources or preserve useful context. | Put the needed note/link beside the next action. | Full browser session infrastructure or a new PKM system. |
| Momentum / Forest / LifeAt | A repeat cue, rewarding environment or emotionally tangible focus commitment. | Make the act of returning feel easy and satisfying. | Decorative expansion, guilt mechanics or more screens to start/stop. |

Current pricing creates a difficult middle: Todoist, TickTick, free calendars, free timers and free local note tools establish a low-cost baseline; premium planners justify higher prices with integrations and daily reliability. Flowtask cannot justify a premium planner price with ambience alone. Nor does being free establish preference. Users still pay with migration effort and attention.

**Do not claim competitors have ignored recovery.** Yoodoo explicitly advertises “Fix my day” for overruns/non-starts with protected meetings, reviewed changes and undo. Workona restores browser context; Llama Life supports active execution. The proposed opportunity is a specific combination of task-level return context and conservative schedule repair—not an invented new category. [Yoodoo](https://www.yoodoo.app/), [Workona](https://workona.com/), [Llama Life](https://llamalife.co/features).

Public comments suggest useful failure themes—planning becoming maintenance, unwanted AI breadth, subscription resentment, sync friction, configuration distraction, and excessive steps before a timer starts. They are **qualitative signals from a small self-selected sample**, not market incidence, churn rates or proof of product-market fit. The appendix dates and qualifies them.

## 4. Differentiation strategy

### Initial target and job

**Hypothesis:** begin with people doing interruption-prone, self-directed work on a laptop: students building substantial coursework/projects and early-career developers or independent builders. Recruit within one of those groups first; “students and developers” is still two acquisition audiences. Start with independent builders who already keep task lists but lose momentum when returning to a project, unless interviews show stronger student demand.

The job: **“When I have a little time and scattered context, help me choose a realistic piece of work, start it, and return without reconstructing where I was.”**

These users often have one to three active projects, an existing notes/browser environment and irregular interruptions. They do not necessarily want calendar automation or a medicalized productivity identity. Avoid making clinical ADHD treatment claims. Meeting-heavy executives, team project managers, committed PKM enthusiasts and people who require robust multi-provider calendar writeback are poor initial targets.

**Proposed positioning:** *Flowtask helps you pick up meaningful work with one clear next step, the context you need, and a plan that survives interruptions.*

This is a product direction, not a verified unique market claim. The default experience should make its value obvious in one task and one return visit.

### Five potential switching reasons

| Reason to switch | Current support | What must become true before claiming it |
|---|---|---|
| Start without an account or a setup project. | No-account first capture works. | Most unfamiliar target users reach useful work quickly without configuring the app. |
| Resume without reconstructing the work. | Next-action checkpoint and linked notes already work. | One Resume entry opens the correct task cue, note and chosen resources; no duplicate queues. |
| A plan you can trust when the day changes. | Preview, eligibility, undo and capacity foundations exist. | Consistent locks/conflicts, truthful time quantities, conservative reviewable changes. |
| A quiet place to execute using your existing tools. | Studio, task context and local notes exist. | Context links and selection capture work without needing a second PKM/calendar system. |
| Fair ownership and cost. | Local path and export exist. | Restore is verified, sync is reliable if offered, pricing transparent; access to existing data is not held hostage. |

People may still prefer Todoist + Forest or Things + a note. Flowtask should win only if the combination saves recurring reconstruction effort. Test against those combinations, not an imaginary user with no tools.

### What makes this defensible?

Not a timer, a next-action field, or a room. These are copyable. A plausible advantage is accumulated personal execution context—reliable links between unfinished work, useful return cues, actual outcomes and realistic plans—combined with unusually good interaction execution and a focused distribution channel. That takes time and evidence; it is not a moat already established.

Keep the execution history useful and portable. Lock-in through obscure storage is the opposite of trust. Do not collect sensitive task text or browsing history merely to manufacture a data advantage.

### Principles and deliberate exclusions

1. **One work object across planning and focus.** Focus is a state of the task, not another task manager.
2. **The user can always understand the change.** Preview, locks, honest uncertainty and one-step undo.
3. **Optional structure follows repeated use.** Projects, goals, routines and dashboards remain available without becoming prerequisites.
4. **Stopping well makes returning easier.** Ask for a cue at a natural interruption; do not turn every pause into a form.
5. **Environment supports the work.** One good room/sound default, easy mute, reduced motion, no ornamental animation required to act.

Reject for now: own video/body-doubling network; autonomous all-day AI agent; team PM suite; graph PKM; automatic browser-session harvesting; biometric/circadian optimization; richer life scoring; more gamified streak debt; native app rewrites; and a paid music-science claim. None is justified by current evidence or realistic maintenance capacity.

## 5. Future day-in-the-life vision

**Proposed experience; not implemented.** The test is whether a user completes the day with less planning and context-reconstruction effort.

**08:55 — Return.** Maya opens Today. Above the fold are her unfinished project, “Write the one-paragraph problem statement,” and the note she linked yesterday. Resume is the dominant action. Inbox and today's other commitments are available without competing for attention. No life-area completion score or empty study widget appears by default.

**09:00 — Capture and choose.** She enters “Review draft tomorrow ~30m.” The preview says Planned tomorrow, Estimate 30m; adding “due Friday” adds a separate deadline. She can edit either token. The task does not acquire a time slot or urgency simply because she captured it. She chooses two commitments for today and leaves the rest in Inbox/Upcoming.

**09:05 — Make a plausible plan.** Plan shows remaining estimated effort, meeting occupancy and actual free space as different quantities. Unknown estimates are marked assumed, not presented as measured precision. She places a 40-minute block for the proposal. A 30-minute review task cannot silently receive a three-hour block. If she overlaps a meeting or another protected block, the app explains the conflict and offers a clear choice; no silent ripple moves locked work.

**09:10 — Begin.** Start opens the same task in Studio. The next action and chosen note are visible; her chosen reference link opens only when she asks. The environment uses her last simple preference. Timer type and room configuration are secondary. She can begin with five minutes without signing a behavioral contract or choosing a productivity identity.

**09:27 — Interrupted.** A call arrives. Pause stops the active timer without implying completion. “Park this work” optionally saves “Continue with the customer example; source is in the linked note.” It records an interrupted session separately from task completion. She can dismiss the cue if she already knows what to do; nothing demands a reflection essay.

**10:20 — Recover.** Today says that the original reservation has passed and the task remains unfinished. It does not silently pretend that planned time was worked. Maya can resume now or preview a later slot. The preview moves only flexible work and explains what will change. A locked appointment stays protected. Declining the repair leaves the task safe and unscheduled rather than fabricating a promise.

**10:25 — Resume.** Resume presents the saved action and context immediately. She spends less time finding the right document. That reduction in real reconstruction time—not simply clicking Resume—is the outcome to test.

**13:30 — Switch projects.** She chooses another project and sees one available action. Optional breakdown suggests an editable step only when relevant. Ambiguous “audit” language does not turn into tax advice. Existing study templates remain accessible if this project actually involves studying.

**16:45 — Finish honestly.** Finishing a session asks whether the task is done only if needed; elapsed time never automatically means completed work. She can record an outcome or the next action. Her note/task link stays intact. An overrun changes remaining effort explicitly rather than rewriting the past.

**17:00 — Close.** The default review asks “What will make tomorrow easier to start?” and offers her saved cue. She may inspect focus history or a weekly review, but no guilt-inducing score punishes interruptions. Existing exports and recovery remain accessible. The day ends with less unresolved context, not a longer list of dashboard obligations.

Behavioral basis is modest: Leroy and Glomb's four studies found benefits from a ready-to-resume plan under specific interruption conditions. That supports testing a return cue; it does not demonstrate Flowtask retention, clinical benefit or a universal productivity improvement. [Original study](https://pubsonline.informs.org/doi/10.1287/orsc.2017.1184).

## 6. Implementation blueprint and roadmap

### Preserve the architecture; consolidate the contracts

**No rebuild is justified.** Keep React/TypeScript, the workspace store, IndexedDB path, optional Firebase, focus lifecycle, validators, recovery and existing tests. The failure is that several UI paths bypass stronger domain operations. Treat the current code as a foundation to consolidate, not disposable prototype code.

#### Proposed domain boundaries

| Concept | Meaning | Rule |
|---|---|---|
| Task | Work and its outcome, next action, optional planned day/deadline/deferral. | Planned day is not deadline; neither creates actual work history. |
| WorkBlock | A reserved interval for a task, with explicit timezone/instants and lock policy. | One canonical schedule record; task clock fields become temporary compatibility projections. |
| Focus session/log | Actual start/pause/finish and outcome. | Does not manufacture task completion or reserve future time. |
| Work kind | Optional study/general or another user-relevant classification. | Independent from having a reservation or running a timer. |
| Context | Linked note, chosen resource and return cue. | Minimal, user-controlled and reachable from Start/Resume. |

There are currently workspace WorkBlocks, optional task-level blocks, legacy task clock fields, and session metadata. Dedicated work-session operations already exist, but the drawer and several calendar actions still write task clocks. [WorkBlock operations](C:/Users/kunal/Desktop/Flow-task/src/services/workBlockService.ts:191), [task shape](C:/Users/kunal/Desktop/Flow-task/src/types/task.ts), [planner apply](C:/Users/kunal/Desktop/Flow-task/src/services/schedulePlanner.ts:90), [calendar grid](C:/Users/kunal/Desktop/Flow-task/src/components/views/CalendarTimeGrid.tsx:294), [canvas](C:/Users/kunal/Desktop/Flow-task/src/components/views/timeline/TimelineCanvas.tsx:160).

**One scheduling command boundary** should validate eligibility, task/date availability, lock status, interval validity, timezone, collisions with relevant commitments and stale preview fingerprints. It should return a structured result: accepted, needs explicit conflict confirmation, or rejected with a reason. Apply changes atomically with one undo. Creation, drawer presets, drag/resize, nudge, date change, unschedule, bulk actions and automated preview must use it. Reuse existing functions before introducing abstraction layers.

**Four separate time facts:** (1) remaining estimated effort; (2) reservation demand (sum of blocks); (3) occupied time (union of applicable intervals); (4) remaining free time within the chosen work window after commitments and now. Collision excess is separate again. Avoid double-counting meetings and task reservations. A single “capacity” number cannot explain all of these. The default can remain simple: “75m work estimated · 6h reserved · 0m free in your work window,” with details when relevant. Unknown/assumed effort must be visible.

#### Migration and reliability work are part of the feature

1. Inventory every schedule reader/writer and existing record shape; add characterization fixtures before changing semantics.
2. Introduce a read adapter and shared command policy first. Fix lock bypass immediately rather than waiting for a long migration.
3. Classify legacy records: unambiguous clocks, existing canonical blocks, duplicate embedded/global blocks, missing timezone, conflicts and invalid intervals. Snapshot before conversion.
4. Convert only what can be interpreted safely. Do not guess DST offsets, silently shift historical dates, or overwrite contradictory records. Provide a review/repair path for ambiguous schedules.
5. Ship cloud rules/schema compatibility before clients that write new shapes. Keep an explicit compatibility window for older clients, export/import and offline queues; portable backup version and workspace schema need not have the same number.
6. Use preview fingerprints, durable receipts and rollback/recovery already present. Test idempotence, undo, import/restore and partial persistence failure. Roll out behind a flag to synthetic/opt-in workspaces before general availability.
7. Retire redundant writers only after all views agree. This is migration work, not a search-and-replace of fields.

### Priorities, effort and acceptance criteria

Estimates are **planning ranges in focused engineering days**, assuming one engineer familiar with this repository, occasional design help, no native app work and no major provider surprises. They exclude calendar waiting time and are not commitments. S ≈ 1–2 days; M ≈ 3–5; L ≈ 6–10; XL ≈ 10–15+. User validation can run alongside engineering. Do not add these ranges mechanically where work overlaps.

| Priority / package | Expected impact | Effort / confidence | Dependencies and principal risk | Measurable acceptance |
|---|---|---|---|---|
| **P0.1 Shared time-change guard** | Very high trust; stops lock bypass and inconsistent conflicts. | L, 6–9d; high value confidence. | Inventory drawer/grid/canvas/nudge/bulk paths. Risk: breaking legitimate explicit overrides. | Locked intervals unchanged through every entry point; overlap always rejected or explicitly acknowledged; rejected operations leave no partial mutations. |
| **P0.2 Capture date contract** | High; fewer accidental commitments and overdue noise. | M, 3–5d; medium intention confidence. | Quick unfamiliar-user wording check; shared parser adapter across capture surfaces. Risk: changing familiar syntax. | Table-driven examples for bare dates, `plan:`, `due:`, both, locale/timezone and no-date capture; ≥8/10 target participants correctly predict result in a small usability gate. |
| **P0.3 Canonical reservations + safe migration** | Very high reliability and maintainability. | XL, 10–15d plus 5–8d migration/recovery hardening; high need, medium estimate confidence. | P0.1 policy and shape inventory. Risk: timezone ambiguity, older clients, duplicate blocks. | Fixture round-trips preserve intent; no duplicate sessions; all views use the same schedule; ambiguous records preserved for review; rollback/restore works. |
| **P0.4 Honest time summary** | High; prevents false reassurance. | M, 3–5d, overlapping P0.3; high. | Agreed effort/reservation/union/free-time definitions. Risk: overcomplicated UI or double-counting. | Reproduced 75m/6h case displays both quantities accurately; overlaps, meetings, now, unknown estimates and day boundaries have reviewed examples. |
| **P0.5 Release and recovery gate** | High risk reduction. | M–L, 4–7d initially; medium. | Node 22 CI, current cloud rules, migration fixtures. Risk: passing mocks hide real browser/device failures. | Supported-Node checks; backup restore; interrupted write recovery; two-tab owner; timer sleep/reload; keyboard journey; critical cross-browser paths verified. Publish conditions/limits. |
| **P1.1 One Today + progressive drawer** | High activation and lower cognitive load. | L, 6–9d; medium, needs usability evidence. | Core contracts stable. Risk: disrupting users' custom dashboards. | First capture and Resume above fold on agreed phone/desktop sizes; advanced layouts and stored fields preserved; ≥8/10 unfamiliar users start without assistance. |
| **P1.2 Return-to-work flow** | Highest differentiation hypothesis. | L, 6–10d; medium/low outcome confidence. | Reuse nextAction, linked notes, shared runtime; P1.1. Risk: checkpoint prompts become overhead. | One task/context across Start/Pause/Park/Finish; cue optional; no duplicate logs; median observed reconstruction time improves against participants' current workflow. |
| **P1.3 Honest breakdown + study separation** | Medium/high comprehension and credibility. | M, 3–5d; high defect confidence. | Work-kind schema decision. Risk: changing existing Study Hub membership. | Audit/proposal/typo cases relevant or explicitly uncertain; deterministic assistance labeled accurately; ordinary scheduled tasks stay out of Study Hub unless classified. |
| **P1.4 Mobile / keyboard / readability pass** | High for users outside full desktop. | M–L, 4–7d; medium scope confidence. | P1.1 design hierarchy. Risk: appearance fixes without interaction testing. | Core flow keyboard-only; focus restored after dialogs; tested contrast over backgrounds; adequate hit regions; mobile capture/resume visible with keyboard; physical-device check. |
| **P1.5 Cohort validation and pricing discovery** | Essential: prevents building an unvalued niche. | 3–5d setup/analysis plus 4 weeks observation; medium. | Prototype after P0, stable P1 core; target recruitment. Risk: enthusiasts/friends bias results. | 8–12 problem interviews, 5–8 formative usability sessions, 20–30 beta users; document abandoners and current-tool comparisons, not just testimonials. |
| **P2.1 One native calendar provider** | Conditional; high only if target users need it. | XL, 10–20d initial plus recurring ops; low estimate confidence. | Reliable blocks/sync, provider demand, OAuth/security scope. Risk: refresh tokens, recurring events, rate limits and two-way conflicts. | Start read-only; move to writeback only with explicit source-of-truth rules, reconciliation, revocation and support capacity. Proceed if a clear majority of retained target users require it. |
| **P2.2 Selective interoperability** | Conditional switching-friction reduction. | M–L, 4–8d for one narrow import/context path; medium. | User evidence of their incumbent tools. Risk: ongoing API compatibility. | One useful import or chosen-link workflow retains provenance, avoids duplicate tasks and can be reversed; no full PKM/tab platform. |
| **P2.3 Optional personalized assistance** | Speculative. | Discovery first; no reliable build estimate yet. | Relevant task-history evidence, consent, meaningful sample sizes and cost limits. | Suggestions beat simple defaults in observed use; show uncertainty, remain editable, no medical claims or sensitive-content telemetry. |

### Proposed sequence and release boundaries

**Gate A, roughly weeks 1–3:** guard the failed paths, agree date/time contracts, characterize data, correct misleading labels where safe. Do not launch new premium planning claims while these fail.

**Gate B, roughly weeks 3–9:** canonical reservation adapter/migration, truthful capacity and recovery tests. A planning beta ships only after the acceptance matrix below passes in the supported environment.

**Gate C, roughly weeks 9–16:** simplify Today/drawer and integrate the existing return cue/context into one execution flow; correct template/study semantics and complete core accessibility checks. Validate designs with tasks before implementation approval; this report does not authorize the redesign.

**Gate D, roughly weeks 14–20:** run the focused cohort and four-week return observation; adjust the proposition before adding integrations. Recruiting/interviews can overlap earlier engineering, but one engineer cannot parallelize all implementation packages. Allow roughly 14–20 calendar weeks for this full program, with a narrower trust-fix release sooner. P2 is not automatically the next sprint.

### Acceptance matrix that prevents the same class of defect

| Operation | Test across | Required invariants |
|---|---|---|
| Create/move/resize reservation | Drawer, canvas, multi-day grid, preset, nudge, preview apply, bulk | Same lock/overlap/eligibility rules; explicit timezone; atomic mutation; one undo. |
| Planned day / deadline / defer | Today, Inbox, global capture, composer, extension | Same meaning; no accidental time slot; no reactivation of blocked/deferred work. |
| Pause/park/finish/mark done | Studio, sprint presentation, task action, tab HUD | One active runtime; elapsed work not duplicated; completion explicit; cue preserved. |
| Recovery | Reload, owner-tab change, offline writes, storage failure, import, migration, cloud conflict | No silent loss; durability status truthful; preserved copies/export; stale actions rejected safely. |
| Capacity | Overlaps, meetings, unknown estimates, locked blocks, now/past, midnight, DST | Effort and occupancy agree with their labels; no double-counting; assumptions visible. |

Do not expand testing merely for test count. These tests protect observed failures and high-cost data transitions. Use existing unit tests for domain rules, a few browser journeys for integration, and manual device/accessibility checks where mocks cannot establish behavior.

### Validation and commercial discipline

**Primary outcome hypothesis:** users resume a meaningful piece of work with less reconstruction effort and return voluntarily on several days. Timer minutes alone are a poor success metric: they can reward leaving a timer running or prolonging a task.

Track, with opt-in and minimal data:

- **Activation:** first self-chosen useful work session plus a saved next action/context within one day. Record what users count as useful in interviews.
- **Speed:** observe capture-to-correct-task and launch-to-real-work, not only button clicks. Provisional usability goals: median correct capture under 10 seconds and useful first session within 60 seconds for most unfamiliar participants. These are proposed gates, not industry benchmarks.
- **Resume quality:** actual time finding context and beginning work; cue used/edited/skipped; self-reported reconstruction burden. Compare with each participant's incumbent combination.
- **Reliability:** locked-move escapes, unacknowledged overlaps, duplicate logs, failed durable writes, restore failures. Zero known critical cases at release, with honest operational monitoring afterward.
- **Return:** meaningful use on three distinct days in a week; D7 and D28 return with explicit cohort definitions. A launch cohort should be tracked by signup/start date and meaningful action, not email opening. With 20–30 users, report counts and qualitative reasons rather than pretending statistical certainty.
- **Burden:** time spent organizing versus doing, checkpoint dismissal, abandonment after setup, and support effort per active user.

Existing security tests deliberately constrain diagnostics to consented numeric data. Preserve that boundary: no raw titles, note bodies, resource URLs or browsing history in telemetry. Qualitative research can use participant-controlled examples with explicit consent.

**Pricing hypothesis:** retain a genuinely useful local core and easy export; test an optional low-cost sync/convenience tier around $3–5/month only after recovery and sync are supportable. This is a discovery range, not an economic recommendation validated by willingness-to-pay data. Regional/student offers may matter to the initial audience. Do not launch a lifetime promise for ongoing cloud/AI costs without a sustainability model. Do not mimic a $15–30 planner price before delivering the calendar reliability and integration value those products sell.

## 7. The ten changes with the strongest expected value

1. **Make locks and conflict policy universal.** A locked task must stay locked through every editing path. This is the most immediate trust repair.
2. **Unify reservations safely.** One canonical time model, compatibility adapter and recoverable migration; stop maintaining independent clock truths.
3. **Make capture dates predictable.** Planned day, deadline and deferral must mean the same thing everywhere, with an editable preview.
4. **Tell the truth about time.** Separate effort, reservations, occupancy, conflicts and free time; remove false breathing-room reassurance.
5. **Choose one default Today.** Put capture and the next useful action first; move life-management and layout configuration behind demonstrated need.
6. **Make return context the core execution experience.** Build on the existing nextAction/note/runtime foundation; reduce reconstruction after interruption.
7. **Fix irrelevant breakdowns and AI wording.** A smaller honest helper is better than confidently inventing the wrong work.
8. **Separate study from scheduling.** Preserve useful student specialization without redefining all scheduled tasks as study sessions.
9. **Complete the core mobile and accessibility journey.** Test capture, resume, dialogs, timer controls and readability on actual devices and keyboard-only use.
10. **Validate repeat preference before expanding.** Release behind recovery gates, recruit a narrow cohort, compare with current tools, and use four-week evidence to decide pricing and integrations.

The standard for success is not “Flowtask contains all the features.” It is a user returning after an interruption, finding the right next step immediately, and trusting that the app has neither lost the work nor quietly changed the plan. That is a credible direction to investigate. It is not yet an outcome the product has demonstrated.
