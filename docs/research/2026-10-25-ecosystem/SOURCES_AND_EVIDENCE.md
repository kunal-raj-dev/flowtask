# Sources and evidence register

Research/inspection date: **25 October 2026**. Scope: **33 tools across seven categories**. Access means inspected during this research, not a promise that a dynamically changing page will remain identical.

## Method and confidence

1. Read current FlowTask source, models, services, UI components and release/research documents. Include the current uncommitted implementation rather than treating Git HEAD or an old plan as the complete product.
2. Open official competitor sites and help/documentation. Where an initial URL was unavailable, use the vendor's current documentation or official repository. Third-party search hits were not used as evidence for technical architecture or clinical effects.
3. Visually inspect published/public UI references for Sunsama, Akiflow, Tiimo, Goblin.tools, Things, Toby, myNoise and Capacities. Evidence depth varies: some are usable product screenshots; others are public page presentations. Do not equate this with eight authenticated usability tests.
4. Run a fresh isolated FlowTask capture on synthetic data; inspect all ten outputs and source-check specific inconsistencies.
5. Separate documented features, observed interfaces, UX interpretation, proposed FlowTask architecture and release gates. Estimate delivery explicitly rather than presenting it as measured velocity.

**Limits:** no paid competitor accounts, complete authenticated 33-app audit, measured competitor latency, audio/haptic comparison, native device/watch trial, proprietary source audit, user telemetry or new user study was performed. Pricing was not a requested deliverable and is omitted rather than carrying forward stale figures. Vendor claims about brain effects or efficacy are attributed and not independently endorsed.

The analysis is a comprehensive public-source comparison and code-grounded implementation plan. A final interaction benchmark of selected paid products would require authenticated access and equivalent test tasks; it should validate high-risk design choices, not postpone obvious improvements to the current product.

## Official competitor source coverage

D = official documentation/product evidence. V = public page or published UI also visually inspected. Profile numbers match [the analysis](COMPETITOR_ANALYSIS.md). Each profile states interpretation and implementation recommendations separately from sourced feature descriptions.

| # | Tool | Official references inspected | Depth / important qualification |
|---:|---|---|---|
| 1 | Sunsama | [Product/UI](https://www.sunsama.com/), [Daily Planning](https://help.sunsama.com/docs/usage-guides/daily-planning/) | D/V; workload threshold is configurable guidance, not a demonstrated universal hard cap |
| 2 | Akiflow | [Product/UI](https://akiflow.com/), [Time Slots](https://product.akiflow.com/en/help/articles/3089241-time-slots), [navigation](https://product.akiflow.com/help/articles/7210597-navigating-akiflow) | D/V; Time Slots source available through indexed official text; one direct fetch timed out |
| 3 | Motion | [Product](https://www.usemotion.com/), [auto-scheduling](https://www.usemotion.com/help/time-management/auto-scheduling), [how-to](https://www.usemotion.com/help/time-management/auto-scheduling/auto-scheduling-how-to-guide) | D; no private optimization code inspected |
| 4 | Morgen | [Product](https://www.morgen.so/), [Frames/planner](https://www.morgen.so/ai-planner) | D; current product includes recommendations and preview approval |
| 5 | Ellie | [Method/product](https://ellieplanner.com/) | D; published three-step workflow, no authenticated interaction test |
| 6 | Routine | [Current product](https://routine.co/) | D; current positioning broader than an agenda and notes app |
| 7 | Reclaim.ai | [Product](https://reclaim.ai/), [Habits](https://help.reclaim.ai/en/articles/4129152-habits-overview-auto-schedule-flexible-time-for-your-routines), [free/busy](https://help.reclaim.ai/en/articles/4129406-how-reclaim-uses-free-and-busy-time-to-keep-your-schedule-flexible), [2.0 FAQ](https://help.reclaim.ai/en/articles/15280604-reclaim-2-0-faq) | D; 2.0 Preview/Agents matter to a current comparison |
| 8 | Goblin.tools | [Directory](https://goblin.tools/), [Magic ToDo](https://goblin.tools/Todo), [Estimator](https://goblin.tools/Estimator) | D/V; public empty tool UI inspected, no private task content submitted |
| 9 | Tiimo | [Product/UI](https://www.tiimoapp.com/), [FAQ](https://www.tiimoapp.com/faq), [Apple award](https://www.apple.com/newsroom/2025/12/apple-unveils-the-winners-of-the-2025-app-store-awards/) | D/V; initial homepage consent overlay obscured product, so inspected official multi-screen asset separately |
| 10 | Llama Life | [How-to](https://llamalife.co/howitworks), [finish time](https://intercom.help/llama-life/en/articles/6459428-can-i-see-what-time-i-ll-be-finishing-my-tasks), [changelog](https://llamalife.co/whatsnew) | D; root page returned little readable text, official help supplies workflow detail |
| 11 | Structured | [Getting started](https://help.structured.app/en/articles/380546), [Inbox](https://help.structured.app/en/articles/338178), [Shortcuts](https://help.structured.app/en/articles/929922) | D; supplied `structured.today` unavailable through fetch; current official help used |
| 12 | Focusmate | [Product](https://www.focusmate.com/), [How It Works](https://www.focusmate.com/how-it-works/) | D; no live session booked or video partner contacted |
| 13 | Todoist | [Product](https://www.todoist.com/), [Karma](https://www.todoist.com/help/todoist/features/introduction-to-karma-OgWkWy) | D; corrected old/inaccessible Karma URL before delivery |
| 14 | Things 3 | [Features/UI](https://culturedcode.com/things/features/), [Today/Upcoming/Anytime/Someday](https://culturedcode.com/things/support/articles/4001304/), [scheduling](https://culturedcode.com/things/support/articles/2803579/) | D/V; no drag-physics measurements |
| 15 | TickTick | [Current product/features](https://ticktick.com/) | D; breadth documented, actual habits/matrix interaction not tested |
| 16 | Superlist | [Official basics](https://help.superlist.com/en/articles/10050-superlist-basics-lists-tasks-sections-meetings-explained) | D; homepage unavailable via fetch; no acoustic claims verified |
| 17 | OmniFocus 4 | [Product](https://www.omnigroup.com/omnifocus), [4.7 planned dates](https://www.omnigroup.com/blog/omnifocus-4.7-now-available), [perspectives](https://support.omnigroup.com/documentation/omnifocus/universal/4.7.1/en/perspectives/) | D; distinguish current three-date model from older manuals |
| 18 | Notion Calendar | [Settings](https://www.notion.com/en-gb/help/notion-calendar-settings), [shortcuts](https://www.notion.com/help/notion-calendar-keyboard-shortcuts), [events](https://www.notion.com/en-gb/help/manage-your-calendars-and-events), [blocking](https://www.notion.com/en-gb/help/blocking) | D; supplied calendar root not text-readable; exact numeric shortcut sequence not established |
| 19 | Vimcal | [Current product](https://www.vimcal.com/) | D; latency statement belongs to vendor, not this audit |
| 20 | Fantastical | [Official product](https://flexibits.com/fantastical) | D; no native calendar-set/weather workflow executed |
| 21 | Obsidian | [Product](https://obsidian.md/), [internal links](https://obsidian.md/help/links) | D; file-based portability is distinct from FlowTask's browser storage |
| 22 | Craft | [Product](https://www.craft.do/), [styling/cards](https://support.craft.do/en/write-and-edit/styling), [calendar/event notes](https://support.craft.do/en/plan-and-do/calendar) | D; old help URLs redirect to current paths |
| 23 | Capacities | [Product](https://capacities.io/), [organizational structures](https://docs.capacities.io/reference/organizational-structures), [reference](https://docs.capacities.io/reference) | D/V; public type/context presentation inspected, not a populated private workspace |
| 24 | Logseq | [Documentation](https://docs.logseq.com/), [official repository](https://github.com/logseq/logseq) | D; DB/file variants and beta/alpha status matter; no full source audit |
| 25 | Toby | [Product/UI](https://www.gettoby.com/), [2.0 update](https://www.gettoby.com/blog/toby-2-0), [collections](https://help.gettoby.com/support/solutions/articles/66000526357-collections) | D/V; September 2026 update included; no extension installed |
| 26 | Momentum | [Product](https://momentumdash.com/), [how it works](https://get.momentumdash.help/hc/en-us/articles/115007780748-How-Momentum-works), [Daily Goal](https://get.momentumdash.help/hc/en-us/articles/360012256274-Daily-Goal) | D; includes current expanded focus/tab/blocking features |
| 27 | Marinara | [Author's repository](https://github.com/schmich/marinara) | D; public implementation source exists; feature README inspected, timer internals not audited |
| 28 | Forest | [Official product](https://www.forestapp.cc/) | D; extension-specific behavior not established by native-app product examples |
| 29 | Workona | [Official product](https://workona.com/), [extension help](https://workona.com/help/tab-manager-chrome-firefox-edge-safari/) | D; no browser tabs closed/suspended or workspace activated |
| 30 | Brain.fm | [Product](https://www.brain.fm/), [science explanation](https://www.brain.fm/science) | D; research/medical claims attributed to vendor, not independently reviewed |
| 31 | Endel | [Official product](https://endel.io/) | D; adaptation/biometric claims documented, no sensors or playback tested |
| 32 | myNoise | [Index](https://mynoise.net/), [White Noise & Co](https://mynoise.net/NoiseMachines/whiteNoiseGenerator.php) | D/V; public control layout inspected; initial media load incomplete; no listening/calibration test |
| 33 | LifeAt | [Official product](https://lifeat.io/) | D; published feature/space examples; no session or co-working room joined |

## Technical implementation references

These support feasibility and platform behavior in the **proposed FlowTask architecture**, not assertions about competitor internals.

| Source | Why used |
|---|---|
| [Google Calendar incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync) | Provider cache, incremental state, deletions and resynchronization |
| [Google Calendar push notifications](https://developers.google.com/workspace/calendar/api/guides/push) | Change notification/watch lifecycle rather than assuming complete event payloads |
| [Chrome extension alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms) | Wake-up reconciliation and extension timer limitations |
| [Chrome declarative network requests](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) | Optional extension blocking capabilities |
| [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) | App-level graph, gain/filter control and reusable audio sources |
| [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) | Optional server-to-service-worker notification delivery |

Motion recommendations also use the local [motion-design skill](C:/Users/kunal/.agents/skills/motion-design/SKILL.md). No external message was sent under that skill.

## Current FlowTask evidence

Fresh capture ran against a task-owned Vite server at `http://127.0.0.1:5187`, using installed headless Chrome, isolated browser storage, synthetic task records, real advancing time, reduced-motion preference and Asia/Kolkata timezone. The repository package supports Node 22; this diagnostic capture used the host's available runtime and does not substitute for a supported-runtime release check.

| Capture | Viewport | Inspection |
|---|---|---|
| [Today desktop](evidence/today-1440.png) | 1440×1000 | Task hierarchy, image behind rows, agenda rail, grouping |
| [Plan desktop](evidence/timeline-1440.png) | 1440×1000 | Capacity, staging shelf, view/date controls and calendar |
| [Notes desktop](evidence/notes-1440.png) | 1440×1000 | Empty state, creation routes and library/editor split |
| [Projects desktop](evidence/projects-1440.png) | 1440×1000 | Project-card hierarchy and default projects |
| [Routines desktop](evidence/routines-1440.png) | 1440×1000 | Current library/history/editor entry points |
| [Review desktop](evidence/review-1440.png) | 1440×1000 | Review navigation, empty records and available rituals |
| [Today mobile](evidence/today-390.png) | 390×1000 | Header size, first task, bottom navigation and reading surface |
| [Plan mobile](evidence/timeline-390.png) | 390×1000 | Calendar pushed below initial visible viewport |
| [Notes mobile](evidence/notes-390.png) | 390×1000 | Mobile creation and library layout |
| [Task drawer](evidence/task-detail-1440.png) | 1440×1000 | Property density, next action, schedule and advanced fields |

[Structured observations](evidence/observations.json) record headings, visible main text, overflow observations and runtime errors. The main-view captures reported no document-width overflow; the limited journey observed no page runtime errors. No data mutation, cloud behavior, production performance or physical-device certification is inferred from these screenshots.

A separate [in-memory time-conversion diagnostic](evidence/time-diagnostic.json) invoked the current `addWorkBlock` helper through Vite SSR with a synthetic store stub. An input of 09:00 Asia/Kolkata produced 09:00Z rather than 03:30Z while retaining the Asia/Kolkata label. This establishes helper behavior, not the scope of affected public paths or existing saved data. No user workspace was written.

A [pure-selector diagnostic](evidence/eligibility-diagnostic.json) also confirmed that an active Today task with an unfinished blocker is actionable/in Today under the utility selectors but unavailable under the richer workspace service selector. This confirms inconsistent helper semantics; affected public consumers remain part of phase 0.

### Reproduce

```powershell
npm run dev -- --host 127.0.0.1 --port 5187 --strictPort
node docs/research/2026-10-25-ecosystem/capture.mjs
node docs/research/2026-10-25-ecosystem/inspect-public.mjs
```

Run the server and capture in separate terminals. `FLOWTASK_RESEARCH_URL` can select another local server. The fixture date is 25 October 2026; update fixture task dates for a later inspection. Scripts use a fresh browser context; they do not read the user's normal browser profile or authenticate to a cloud account.

The public-reference script stores vendor screenshots in a temporary directory and writes a [source/asset manifest](evidence/public-inspection.json). Vendor screenshots are not republished in this package. The Tiimo product asset is inspected directly because of its homepage consent overlay. Temporary captures may need regeneration after operating-system cleanup.

## Code and document evidence read

- Domain: `types/task.ts`, `types/note.ts`, `types/routine.ts`, settings/workspace entities, `commandService`, `workspaceStore`, `workspaceEntities`, calendar and reminder services.
- Planning: `schedulePlanner`, `autoSlotAlgorithm`, `dayPlanSummary`, `workBlockService`, `taskSelectors`, `workspaceSelectors`, `dependencyUtils`, `CalendarTimeGrid`, `TimelineView` and timeline components.
- Product: Today/Horizon, sidebar/header, task editing, planning dialog, Copilot, Notes, Routines, focus lifecycle/Studio/HUD, shortcut registry, breakdown and estimation helpers, extension manifest/README.
- Historical context: earlier research packages, public V1 audit, production-readiness/checkpoint and current UX simplification document. Historical test results are not reported as newly executed.

The source was changing concurrently during authoring. UI captures finished at 17:40 IST; a later final check found `GranularitySliderPopover`, five-level `decomposeTask` and task-row wiring added after capture. These are now recorded as present/in progress in G15 and P3-01. This report does not claim a frozen release candidate or certify those concurrent edits. The time and eligibility helper diagnostics were executed against the source available at their invocation.

### Corrections to earlier research assumptions

| Earlier assumption or supplied shorthand | Treatment in this package |
|---|---|
| “31 applications” | The supplied list contains exactly 33; all are individually covered. |
| Exact competitor hex colors/fonts/shortcut keys/audio synthesis/spring constants | Omitted unless verified. Proposed FlowTask values are clearly labeled as targets. |
| Motion guarantees mathematical completion/deadline feasibility | Removed. Estimates, constraints and planning heuristics limit what can be concluded. |
| Preview approval uniquely differentiates FlowTask | Morgen and Reclaim currently document previews too; our opportunity is the quality/clarity of implementation. |
| OmniFocus only distinguishes due versus defer | Current 4.7 documentation includes planned dates. |
| Logseq has one timeless local-Markdown implementation | Distinguish file behavior from the current database variant. |
| Brain.fm/myNoise behavior can be reproduced by a generic preset | Separate audio UX inspiration from proprietary technology, calibration and assets. |
| Routine editor/history, Notes, keyboard system or focus queue are absent in FlowTask | Current source already contains them; roadmap refines and joins them. |
| Old Area/Goal persistence and reminder defects still necessarily apply | Current working tree has relevant changes; revalidate rather than repeating old findings. |
| No overflow means a good phone workflow | Current mobile Plan still delays the calendar; usability requires more than width containment. |

## Validation of this planning package

The [document validation result](evidence/document-validation.json) confirms 33 profiles, seven categories, 30 gap rows, eight phases, 30 explicit gap-to-package mappings and zero broken local Markdown links. All ten product captures were inspected; both in-memory diagnostics above were executed. The task-owned Vite server was stopped after capture. Full application build/test/release suites were not rerun for this documentation-only deliverable. No application source, deployment, billing, external account, calendar or user browser state was changed by this research.
