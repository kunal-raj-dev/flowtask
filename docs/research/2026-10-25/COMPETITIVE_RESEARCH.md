# FlowTask: competitive research for personal life and work

Research date: **25 October 2026, India time**. Product baseline: local checkout at commit `b2e8726`. Audience: **anyone organizing personal life and work**, as confirmed by the product owner during this research. Students and individual developers remain useful segments, rather than the entire market.

Read next: [the implementation and UI/UX upgrade plan](PRODUCT_UPGRADE_PLAN.md). [Evidence and reproducibility](README.md) records the current-product inspection.

## The decision this research supports

FlowTask should become a dependable personal organizer connecting **tasks, notes, calendar, projects, routines, and review**. Its advantage can be the handoff between these activities: a captured thought becomes an action, fits into a realistic day, carries its context into focus, and returns to the weekly review.

The existing product already covers a substantial portion of task management and focused work. The most valuable expansion is a connected notes and life-organization layer, followed by dependable reminders, practical calendar connections, and capture across devices. More task views, themes, and timer modes have a weaker case than completing these workflows.

This is a proposed product direction derived from the evidence below. It is not a measured finding about FlowTask retention or willingness to pay.

## Method and limits

- Selected **28 reference products**, spanning task managers, daily planners, notes/knowledge tools, bundled alternatives, visual routine tools, and adjacent project-management suites. Selection reflects workflow relevance and useful design benchmarks. This is **not a market-share ranking**; comparable current active-user data was not established.
- Examined current official product pages, help articles, and selected pricing pages. Read **six public discussion threads** for qualitative reasons to pay, stay, or switch. These were purposively selected, are self-reported, and are not a representative customer survey.
- Reviewed FlowTask source models, navigation, capture, task notes, calendar services, sync scope, exports, and release documentation. Inspected five local screens with synthetic data, including desktop and mobile Today, Plan, Projects, and task detail. No personal browser profile or cloud account was used.
- Visually examined three vendor-published app screenshots: Sunsama, Akiflow, and NotePlan. Other competitor UI observations below come from documented flows and public product materials. No paid-account, end-to-end competitor usability benchmark was conducted. Marketing screenshots can lag the shipped app.
- **“Most used features” cannot be ranked reliably from these public sources.** The lists below identify prominent daily-use capabilities and features mentioned in the selected discussions. Priority is our inference, not proprietary feature-usage telemetry.
- Pricing is a dated snapshot. Currency, tax, promotion, billing term, and platform can change the payable amount. Historical discussion prices are not used as current pricing evidence. Provider claims about hours saved, productivity, or clinical benefit are not treated as independently verified outcomes.

## 1. The competitive landscape

### Twelve primary workflow benchmarks

#### 1. Todoist — quick capture and dependable task organization

**Core capabilities:** natural-language task entry, recurrence, projects, priorities, labels, filters, and task views. Its pricing page currently places ordinary task reminders in the free tier; calendar layout, durations, custom reminders, deadlines, and more filters sit in Pro. [Features](https://www.todoist.com/features), [plan comparison](https://www.todoist.com/pricing).

**Why choose it:** a straightforward task system that accepts work quickly and scales into more deliberate organization. In the selected user thread, quick capture, fewer project/filter restrictions, and calendar functionality recur as reasons for using or upgrading. Some users say the free allowance is sufficient. [User discussion](https://www.reddit.com/r/todoist/comments/1gncaub/is_the_pro_worth_it/).

**UX lesson:** make capture the shortest path; put metadata behind optional controls. Views should change how the same tasks are presented. **FlowTask implication:** refine the composer and saved filters already present; add reliable reminders and migration paths. Do not rebuild NLP capture as a supposedly missing feature.

#### 2. TickTick — broad personal productivity in one subscription

**Core capabilities:** quick capture, tags/filters, subtasks, recurrence, calendar scheduling, habits, and focus tools. Public materials also describe widgets and several reminder types, with platform-specific differences. Premium expands calendar functionality, duration, capacity, and other limits. [Features](https://ticktick.com/features), [Premium comparison](https://ticktick.com/upgrade).

**Why choose it:** combines tools that might otherwise require a task app, calendar planner, habit tracker, and timer. In the sampled discussion, people repeatedly mention calendar time blocking and filters; widgets, reminders, habits, and Pomodoro also appear. This is qualitative evidence, not a frequency census. [User discussion](https://www.reddit.com/r/ticktick/comments/1biscmq/ticktick_premium_experiences/).

**UX lesson:** feature breadth works better when tools are optional modules. **FlowTask implication:** add habits and reminder delivery while retaining a calm default. Its existing focus engine already addresses much of the timer use case.

#### 3. Things — clear task semantics and polished interaction

**Core capabilities:** Inbox, Today, Upcoming, Anytime, Someday, projects/headings, tags, quick entry, and an evening section. Planned relevance and deadlines have distinct meanings. [Features](https://culturedcode.com/things/features/), [date-based lists](https://culturedcode.com/things/support/articles/4001304/), [scheduling](https://culturedcode.com/things/support/articles/2803579/).

**Why choose it:** low-friction daily use and a comprehensible organization model. A recent discussion includes both praise for design/reliability and frustration about feature development; these are individual accounts, not a measured reliability comparison. [User discussion](https://www.reddit.com/r/thingsapp/comments/1wcgqot/cultured_codes_laziness_is_finally_catching_up/).

**UX lesson:** clear temporal categories and restrained rows can be valuable without exposing every property. **FlowTask implication:** retain separate planning/deadline fields, Someday, and evening behavior; make them consistent across surfaces. Preserve an obvious route to deferred work.

#### 4. Sunsama — planning a feasible day

**Core capabilities:** guided daily planning, workload estimates, timeboxing, calendar context, and review. The documented ritual compares planned workload with a threshold and helps users decide what to defer. [Daily planning manual](https://help.sunsama.com/docs/usage-guides/daily-planning/), [product overview](https://www.sunsama.com/).

**Why choose it:** its value proposition is help deciding what fits, especially when tasks arrive from several tools. The sampled discussion includes a customer paying to address chronic underestimation, plus replies questioning whether an extra subscription is worthwhile. [User discussion](https://www.reddit.com/r/todoist/comments/1p1o9by/todoist_sunsama_is_my_perfect_situation/). The vendor explicitly frames its price around daily professional value. [Pricing rationale](https://help.sunsama.com/docs/billing/pricing-manifesto/).

**UX lesson:** the planning ritual can be the product. Its published screenshot places day columns beside a calendar. **FlowTask implication:** improve the existing capacity planner, weekly planning, planned-versus-actual learning, and deliberate deferral; keep the ritual optional.

#### 5. Akiflow — aggregate work, then allocate time

**Core capabilities:** a universal inbox, calendars, time blocking, integrations, shortcuts, and an assistant. Its current plan bundles tasks, subtasks, meetings, integrations, and power features. [Product](https://akiflow.com/), [plans](https://akiflow.com/pricing).

**Why choose it, inferred:** people with work scattered across services can reduce repeated copying and source switching. This inference follows its aggregation proposition; no customer sample specific to Akiflow was collected here.

**UX lesson:** its published screenshot makes unscheduled inbox items and a multi-day calendar adjacent; source icons preserve provenance. **FlowTask implication:** extend the existing browser capture into a trustworthy capture queue and selective integrations. Preserve source URLs and external IDs. Do not call a new integration a synchronization feature unless updates and deletion behavior are defined.

#### 6. Motion — reduce scheduling decisions

**Core capabilities:** automated task/calendar planning, project workflows, meetings, and increasingly docs/notes and assistants. Its current plan presentation bundles these capabilities, so describing it only as an AI calendar would be incomplete. [Product](https://www.usemotion.com/), [plans](https://www.usemotion.com/pricing).

**Why choose it, inferred:** users may pay to reduce manual schedule maintenance when deadlines, priorities, and meetings change. Automated planning introduces a control tradeoff: people must understand why a task moved and how to protect a commitment. This is a design risk inferred from the workflow, not a verified complaint rate.

**UX lesson:** automation needs legible constraints and a reversible change history. **FlowTask implication:** evolve its local scheduling preview before offering autonomous rescheduling. Show the proposed moves, overflow, protected blocks, and reasons; retain Apply and Undo.

#### 7. Notion — flexible notes and structured information

**Core capabilities:** pages/blocks, databases with properties and alternate views, linked information, templates, and collaboration. Each database item is also a page. Its current product also emphasizes AI and agents. [Database structure](https://www.notion.com/help/intro-to-databases), [product](https://www.notion.com/product), [plans](https://www.notion.com/pricing).

**Why choose it, inferred:** users can adapt one system to work, reference material, and personal dashboards. The sampled discussion also describes time spent maintaining complex templates and difficulty for beginners. It illustrates a risk, not a verdict on all Notion users. [User discussion](https://www.reddit.com/r/Notion/comments/1jcw3y1/are_we_making_notion_too_complicated_after_6/).

**UX lesson:** reusable objects and views are powerful; blank-canvas setup can require substantial effort. **FlowTask implication:** offer connected notes, project context, and opinionated templates before considering a general database builder. **Correction to older comparisons:** Notion documents offline support in desktop/mobile apps; its scope is not identical to FlowTask's local-first model. [Offline guide](https://www.notion.com/help/guides/working-offline-in-notion-everything-you-need-to-know).

#### 8. Obsidian — ownership, connected knowledge, and extensibility

**Core capabilities:** local notes, linking, backlinks, graph/canvas concepts, and an extension ecosystem. Core use is free; sync and publishing are optional paid services. [Product](https://obsidian.md/), [pricing](https://obsidian.md/pricing), [backlinks](https://obsidian.md/help/plugins/backlinks).

**Why choose it:** keeping durable personal knowledge and building connections across notes. In the sampled Sync discussion, commenters describe paying to avoid configuring other sync methods and dealing with their friction; file/storage limits remain relevant to some. Their experiences do not establish a product-wide failure rate. [User discussion](https://www.reddit.com/r/ObsidianMD/comments/1e713w4/is_obsidian_sync_worth_it/).

**UX lesson:** a note's incoming references help users recover context. **FlowTask implication:** add portable standalone notes, stable links, backlinks, and version history. A graph can wait until the links themselves prove useful. Browser IndexedDB is not equivalent to a folder of ordinary Markdown files.

#### 9. Amplenote — thoughts moving into action

**Core capabilities:** rapid jots, developed notes, tasks, and calendar-oriented workflows. Its help explains that Jots and Notes are different ways of working with notes, rather than entirely separate content classes. [Jots explained](https://www.amplenote.com/help/jots), [help overview](https://www.amplenote.com/help).

**Why choose it, inferred:** retain the source context while turning writing into actionable work. The paid offering highlights external calendar sync, side-by-side note viewing, and additional capabilities. [Subscription comparison](https://www.amplenote.com/subscriptions/new).

**UX lesson:** capture and refinement can use the same underlying information. **FlowTask implication:** connect its existing scratchpad-to-task action to a durable Notes library, references, and search. A note-origin task must remain one task when shown in Inbox, a project, Today, and Plan.

#### 10. NotePlan — daily notes beside a real schedule

**Core capabilities:** daily/project notes, tasks, linked context, time blocks, and Apple calendar/reminder connections. Its materials also describe backlinks and portable text storage. [Product](https://noteplan.co/), [plans and feature summary](https://noteplan.co/pricing).

**Why choose it, inferred:** a day's actions and the thinking behind them remain together. Calendar integration and contextual notes can replace manual movement between a notebook and a day planner.

**UX lesson:** the inspected official screenshot combines a left navigation tree, a central daily note, and a right calendar. Tasks appear within writing, while scheduled time stays visible. **FlowTask implication:** introduce an optional daily note/journal and a project Notes tab that share the same note model. Make a calendar an optional companion panel to writing, rather than a mandatory permanent third column.

#### 11. Routine — integrated work objects and fast navigation

**Core capabilities:** tasks, meetings, notes, capture, integrations, and contextual information. Current offerings also include assistants and automation; the pricing comparison describes a free tier plus paid planning/power features. [Product](https://www.routine.co/), [plans](https://www.routine.co/pricing).

**Why choose it, inferred:** bring scattered work and information into one navigable environment while preserving context.

**UX lesson:** global capture and commands can shorten travel between objects and actions. **FlowTask implication:** extend the existing command palette into search across tasks, notes, projects, and dates. Keep search and capture visibly discoverable for people who never use keyboard shortcuts. Do not require an assistant conversation to perform an ordinary edit.

#### 12. Structured — make a day visible and approachable

**Core capabilities:** a visual task timeline and cross-device day planning. Its Pro documentation distinguishes calendar import, recurrence, customization, AI, notifications, and replanning by platform; parity should not be assumed. [Product](https://structured.app/), [Pro feature/platform table](https://help.structured.app/en/articles/324674).

**Why choose it, inferred:** a visual sequence can make the next action easier to identify than a large project system. Paid features extend that day-planning workflow.

**UX lesson:** time, order, and the next step should be easy to see on a phone. **FlowTask implication:** improve a mobile agenda and simple routine sequences. Allow task durations without forcing users to number a study session. Avoid equating a decorative timeline with an effective planning workflow.

### Sixteen adjacent and bundled benchmarks

Reasons to choose/pay in this table are **our interpretation of documented capabilities**, unless otherwise specified. “Bundled” means an alternative users may already have; storage and optional services can still cost money.

| Product | Prominent capabilities and organizing model | Why it is an alternative / useful lesson for FlowTask |
|---|---|---|
| **Reclaim** | Flexible calendar scheduling for focus time, habits, tasks, meetings, and buffers; free and paid tiers. [Product](https://reclaim.ai/), [plans](https://reclaim.ai/pricing) | Protecting time within a calendar can matter more than a sophisticated task database. Model flexible windows and protected commitments before increasing automation. |
| **Morgen** | Multiple calendars, task integrations, time blocking, planning recommendations, scheduling links, and cross-platform apps. [Product](https://www.morgen.so/), [plans](https://www.morgen.so/pricing) | Useful to people juggling work/personal calendars. FlowTask needs calendar identity and visibility controls, not just a generic events overlay. |
| **Apple Reminders** | Lists/smart lists, pinned lists, subtasks, and specialized everyday lists such as groceries. [User guide](https://support.apple.com/guide/reminders/welcome/mac) | An already available organizer can meet ordinary needs with little setup. Household capture and clear lists should work without learning a project methodology. |
| **Microsoft To Do** | My Day, suggestions, task lists, cross-device access, and shared lists. [Product](https://www.microsoft.com/en-us/microsoft-365/microsoft-to-do-list-app) | A small set of understandable actions is an important baseline. FlowTask must add useful planning/context beyond simply collecting checkboxes. |
| **Google Calendar + Tasks** | Calendar-based commitments, task dates/times, Gmail/Workspace connections, and task visibility on the schedule. [Calendar](https://workspace.google.com/products/calendar/), [Tasks help](https://support.google.com/tasks/answer/7675772?hl=en) | Already sits where many users plan their time. Match familiar date navigation and make task-versus-event ownership clear. |
| **Apple Notes** | A familiar note collection/editor across Apple devices. [User guide](https://support.apple.com/guide/notes/welcome/mac) | Immediate availability and ordinary note-taking are serious alternatives to a paid organizer. Ship a useful writing experience before specialist knowledge tools. |
| **Google Keep** | Quick notes/lists, labels, colors, pins, search, cross-device access, offline changes, and collaboration. [Product](https://workspace.google.com/products/keep/) | Low-effort capture and retrieval are compelling. A simple note should not need a project, goal, or folder before it can be saved. |
| **OneNote** | Notebook-style information capture, digital ink, annotation, and sharing. [Product](https://www.microsoft.com/en-us/microsoft-365/onenote/digital-note-taking-app) | Especially relevant to class/meeting notes and people who think spatially. Rich ink/PDF annotation is a specialist opportunity, rather than a prerequisite for Notes v1. |
| **Evernote** | Notes, web clipping, document scanning, advanced search, tasks, calendar features, and AI utilities. [Feature catalogue](https://evernote.com/features) | A reference archive needs strong retrieval and capture. Source-preserving clipping, attachments, and later OCR matter more than more decorative note layouts. |
| **Capacities** | Connected objects, daily notes and knowledge organization; Pro adds task/calendar and other power capabilities. [Product](https://capacities.io/), [plans](https://capacities.io/pricing) | Related information is easier to recover when typed and linked. FlowTask can add light relationships without immediately building arbitrary object types or schemas. |
| **Anytype** | Official indexed FAQ describes on-device/offline-first data, encryption, and peer sync; membership pricing is documented. [FAQ](https://anytype.io/faq/), [plans](https://anytype.io/pricing/) | Ownership/privacy can influence choice. Evidence here is limited to indexed official material because the pages did not expose a readable body; no UI conclusions are drawn from them. Do not imply FlowTask cloud sync is end-to-end encrypted. |
| **Trello** | Boards/cards, Inbox, Planner, templates, integrations, and automation. [Tour](https://trello.com/tour), [Planner](https://trello.com/planner) | Spatial progress and capture-to-calendar are familiar workflows. FlowTask already has a board; prioritize consistent task details and bounded column customization over recreating Trello. |
| **ClickUp** | Task/project hierarchy, alternate views, docs, fields/statuses, automations, time tools, reporting, and integrations. [Feature catalogue](https://clickup.com/features) | Consolidation and team process control can justify payment. Use progressive disclosure; a personal organizer should not require team-level configuration to begin. |
| **Asana** | My Tasks, project tracking, dependencies, time/reporting tools, and work updates. [Features](https://asana.com/features) | Team coordination solves a different problem from personal execution. Preserve a unified personal task view; treat assignments/permissions as a separate future product layer. |
| **Tiimo** | Visual schedules, routines, focus countdowns, customization, and widgets; marketed around executive-function support. [Product](https://www.tiimoapp.com/) | Visible next steps and gentle language can reduce interaction burden. Borrow these patterns without claiming clinical outcomes or imposing a single organizing style. |
| **Habitica** | Habit, daily, to-do, and reward task types are documented in its official API; official tools expose habit trends and task statistics. [API](https://apidoc.habitica.com/), [official data tool](https://tools.habitica.com/habitica_user_data_display.html?sectionOpen=taskOverviewSection) | Reward-oriented routines are an adjacent motivation model. A full role-playing economy is optional. The public site was not text-readable here, so current UI and paid packaging were not established. |

## 2. Features that repeatedly matter

The order below is a **FlowTask opportunity ranking**, informed by recurring product patterns and the six selected threads. It is not a claim about industry-wide usage frequency. Sources for named examples are in the profiles above.

| Rank | Daily-use capability | The job people are trying to complete | Benchmarks | FlowTask assessment |
|---|---|---|---|---|
| 1 | Fast capture and a trusted inbox | Stop remembering something without interrupting the current activity | Todoist, TickTick, Keep, Routine, Akiflow | Strong in-app base; external/mobile capture and delivery status need expansion. |
| 2 | Trustworthy save, retrieval, and device continuity | Find the same work later, wherever it was captured | Obsidian Sync, bundled notes/tasks, Capacities | Optional sync exists; scratchpad remains device-local. New content must get explicit sync/backup contracts. |
| 3 | Useful reminders and recurrence | Remember commitments and recurring life administration | TickTick, Todoist, Reminders, Structured | Recurrence exists; a task reminder delivery system was not found in the inspected source. |
| 4 | Today plus calendar-aware planning | Decide what deserves attention and what actually fits | Sunsama, Akiflow, Morgen, Structured | Daily task selection and time blocking exist. Provider connections and weekly planning need more depth. |
| 5 | Notes connected to action | Keep the reason, reference, and next step together | NotePlan, Amplenote, Notion, Routine | Task descriptions and scratchpad exist; a standalone linked note library does not. |
| 6 | Projects, life areas, and saved views | Organize ongoing responsibilities without losing the daily view | Things, Todoist, Notion | Projects and filters exist; explicit areas and goal-to-project relationships are gaps. |
| 7 | Simple routines and habits | Repeat useful behavior and review it without cluttering tasks | TickTick, Reclaim, Tiimo, Habitica | Repeating tasks are a base, but habit check-ins and multi-step routines need different semantics. |
| 8 | Portable import, export, and recovery | Start with existing information and leave with usable data | Obsidian, NotePlan, Capacities | JSON restore and CSV/Markdown exports exist; common inbound migration formats and note portability need expansion. |
| 9 | Daily/weekly review and estimate feedback | Learn what happened and consciously replan | Sunsama, NotePlan, Things' temporal lists | Existing reviews, focus logs, and estimates should be connected more coherently. |
| 10 | A fast, readable interface | Finish an ordinary action without navigating a configuration system | Things, To Do, Structured | Current shell is a useful foundation; typography, density, action naming, and cross-view consistency need targeted work. |
| 11 | Selective integrations and automation | Reduce repeated copying from sources of work | Akiflow, Routine, Trello, Reclaim | Browser capture exists; select integrations by observed demand. |
| 12 | Sharing and collaboration | Coordinate a household list or shared outcome | To Do, Reminders ecosystem, Trello, Notion, Asana | Useful later, but requires ownership, rights, conflict, and notification design. A snapshot share is not collaborative editing. |

## 3. What people pay for, and why free alternatives still win

### What the qualitative evidence actually says

| Discussion examined | Themes observed | Product implication | Confidence boundary |
|---|---|---|---|
| [Todoist Pro discussion](https://www.reddit.com/r/todoist/comments/1gncaub/is_the_pro_worth_it/) | Capture with less organizational friction; more project/filter capacity; calendar value; some free users need no upgrade | Charge for demonstrated additional value, rather than forcing an awkward free workflow | Historical self-reports; current entitlements come from the official pricing page |
| [TickTick Premium experiences](https://www.reddit.com/r/ticktick/comments/1biscmq/ticktick_premium_experiences/) | Calendar time blocking, filters, widgets, reminder/routine use, focus tools | Integrate daily planning and follow-through so users avoid duplicate work | Multiple comments in one selected thread; not a population estimate |
| [Todoist + Sunsama](https://www.reddit.com/r/todoist/comments/1p1o9by/todoist_sunsama_is_my_perfect_situation/) | Better estimation and day selection; disagreement over paying for a second planning layer | A planning ritual must change decisions, not merely show the same list elsewhere | Customers' perceptions do not prove time saved or product feature differences |
| [Obsidian Sync value](https://www.reddit.com/r/ObsidianMD/comments/1e713w4/is_obsidian_sync_worth_it/) | Less configuration and sync friction, support for the developer, concern about storage/file limits | Reliability and understandable limits can be a paid service | Old plan details are excluded from current pricing comparisons |
| [Notion complexity](https://www.reddit.com/r/Notion/comments/1jcw3y1/are_we_making_notion_too_complicated_after_6/) | Template maintenance, beginner effort, aesthetic setup overshadowing daily use | Ship ready-to-use workflows and small defaults | Critical thread selection creates bias; it does not establish typical Notion experience |
| [Things development/design discussion](https://www.reddit.com/r/thingsapp/comments/1wcgqot/cultured_codes_laziness_is_finally_catching_up/) | Appreciation of design/reliability alongside requests for more capabilities | Polish and capability both matter; avoid sacrificing one to maximize the other | Anecdotes, unverified reliability/revenue claims excluded |

**Synthesis, inferred:** subscription value tends to come from reduced maintenance, clearer decisions, trustworthy continuity, and integration into an existing routine. A long feature list alone is not sufficient. Free/bundled tools can win because they are already installed, familiar, connected to an account, and sufficient for simple needs. A paper checklist is also a real substitute when software adds more maintenance than it removes.

### Current pricing signals, not a recommended FlowTask price

| Product | Public price/packaging observed | Why the distinction matters |
|---|---|---|
| TickTick | **US$49.99/year** Premium on the inspected page; free tier available. [Source](https://ticktick.com/upgrade) | Broad personal functionality at a materially lower annual cost than several planning specialists. |
| Sunsama | **US$17/month billed yearly**, or **US$22 monthly**. [Source](https://www.sunsama.com/pricing) | A premium planning layer needs recurring value beyond task collection. |
| Akiflow | **US$34 monthly**; inspected yearly offer **US$19/month**, labelled promotional. [Source](https://akiflow.com/pricing) | Do not treat the promotional annual amount as an enduring baseline. |
| Obsidian Sync | Entry Sync **US$4/user/month billed annually**, or **US$5 monthly**; core app is free. [Source](https://obsidian.md/pricing) | Paid convenience can coexist with useful free local functionality. |
| NotePlan | **US$99 paid annually**, displayed as **US$8.33/month**; **US$12 monthly**. [Source](https://noteplan.co/pricing) | The page's annual equivalent is rounded/inconsistent with exact division; preserve the actual annual charge rather than multiplying the display figure. |
| Morgen | **US$15/month billed yearly**, or **US$30 monthly**, for the inspected individual plan. [Source](https://www.morgen.so/pricing) | Multi-calendar planning competes at a premium to a simple task list. |
| Todoist, Notion, Routine, Amplenote, Motion | Free/paid or subscription packaging verified, but numeric comparisons omitted here to avoid mixing locale, promotion, credits, and billing-state differences. [Todoist](https://www.todoist.com/pricing), [Notion](https://www.notion.com/pricing), [Routine](https://www.routine.co/pricing), [Amplenote](https://www.amplenote.com/subscriptions/new), [Motion](https://www.usemotion.com/pricing) | Price comparisons require the same region, purchase channel, entitlement, and billing term. |

**FlowTask commercial hypothesis:** keep basic capture, personal tasks/notes, accessible interaction, and data export useful. Potential paid value is managed continuity/version history, more connected services, advanced scheduling, and optional hosted AI with explicit usage terms. Whether basic sync belongs free or paid must be tested against both service cost and bundled competitors; it is not settled by this research. Accessibility, an exit path, and emergency recovery should not become bargaining chips. Validate local pricing and student affordability separately from US professional pricing.

## 4. UI/UX patterns to carry forward

These are patterns to adapt to FlowTask, not instructions to copy another product's visual identity. Exact dimensions below are not competitor measurements; proposed dimensions belong in the upgrade plan.

| Pattern | Reference evidence | Why it helps / tradeoff | FlowTask decision |
|---|---|---|---|
| A stable sidebar for destinations; views within content | Things' documented date lists; Notion database view model | Separates where the user is from how information is displayed | Preserve Today/Inbox/Plan/Projects; add Notes deliberately, with advanced views under contextual tabs or More. |
| One recognizable capture affordance | Todoist Quick Add; Routine capture; TickTick shortcuts | Builds a habit; optional metadata must not block saving | One shared task/note capture pipeline across header, keyboard, mobile, and extension. |
| Backlog adjacent to calendar | Inspected Akiflow screenshot; Sunsama day columns/calendar | Makes conversion from intention to scheduled time visible; wide layouts need mobile alternatives | Keep Plan's unscheduled list and calendar relationship; add week and mobile agenda modes. |
| Writing beside schedule and references | Inspected NotePlan screenshot; Amplenote note modes | Context remains available while deciding or doing | Notes editor with optional agenda and backlinks; avoid mandatory third panes on smaller displays. |
| Progressive property disclosure | Things' focused task model; Notion editable properties | Everyday actions stay simple; power fields remain available | Consistent detail hierarchy with secondary recurrence/dependency/study sections. Existing FlowTask disclosure is a base to refine. |
| Distinct temporal semantics | Things scheduling and date-list help; Todoist plan comparison includes deadlines | Planning intent is different from a hard commitment | Standardize “Plan for”, “Deadline”, “Time block”, and “Reminder” as separate concepts. |
| Guided rituals with an escape route | Sunsama daily planning manual | Helps people make decisions; can otherwise feel like a daily obligation | Optional morning and weekly flows; preserve direct task entry and planning. |
| Typed, linked information | Obsidian backlinks; Notion database items; Capacities objects | Helps find the source and consequences of an action | Stable task/note/project links before graph visualization or arbitrary databases. |
| Mobile next-action clarity | Structured timeline; Tiimo visual schedule/timer | Reduces the amount of navigation required to act | Compact Today header, legible agenda, reachable capture, persistent resume, full-screen note editing. |
| Explicit platform scope | Structured Pro platform table; Notion offline guide | Prevents misleading promises about feature parity | Publish a FlowTask capability matrix for web/PWA/extension and any later native app. |

### The current FlowTask UI already aligns in several ways

The inspected Today screen has a stable left sidebar, a task-oriented center, and an optional desktop timeline. Mobile has Today, Inbox, a prominent capture button, Plan, and More. The current sidebar already collapses many advanced destinations. These should not be presented as new ideas discovered during this research.

The remaining visual/workflow opportunities are more specific: reduce mobile header space, clarify capacity labels, unify Today and Plan time conventions, make note navigation first-class, standardize task metadata and scheduling actions, and improve typography/readability across themes. See the [screen-by-screen specification](PRODUCT_UPGRADE_PLAN.md#5-screen-by-screen-uiux-specification).

## 5. Product positioning and strategic boundaries

Proposed promise: **“One place to turn everything on your mind into a day you can follow.”**

This promise must work for planning a workday, keeping up with home administration, preparing a trip, following a routine, developing a project, and keeping useful notes. “All of life” should mean useful relationships between these activities; it should not require a separate application for every possible life domain.

| Need | Recommended approach | Specialist expansion to consider later |
|---|---|---|
| Household and life administration | Lists, recurrence, reminders, areas, lightweight project templates | Shared household ownership and recurring bills integrations |
| Personal projects and goals | Outcomes, milestones, linked notes, goal-to-project relationships, weekly review | Custom process automation and richer dependency visualization |
| Work and independent professional use | Calendar-aware planning, focus, context, selective inbox integrations | Team resource management and enterprise controls |
| Learning and study | Daily/project notes, attachments, study templates, existing focus/session tools | Handwriting, PDF annotation, spaced repetition |
| Habits and routines | Simple check-ins, ordered routines, flexible recurrence, gentle review | Extensive coaching or full game economies |
| Knowledge and reference | Notes, links, search, clipping, export | OCR, graph exploration, arbitrary typed databases |

There is room to explore shared lists, richer documents, native capture/widgets, AI assistance, and broader automation. Each needs a clear job, ownership model, and maintenance budget. They remain recorded in the [backlog and scope decisions](PRODUCT_UPGRADE_PLAN.md), so deferral does not make them disappear from the plan.

## 6. What to validate before committing the entire roadmap

Recruit a small exploratory group across home administration, employment/freelance work, study, personal projects, and visual/routine planning. Start with **12–15 participants**, including people who use bundled/free tools and people who pay; this is formative research, not a statistically representative sample.

Ask participants to show an actual recent captured item, a missed/rescheduled commitment, a note they needed to find, and the moment they chose to pay or cancel. Reconstruct the workflow before asking them to rank features. Test an integrated note-to-task-to-calendar prototype against the current product.

Suggested hypotheses:

1. A standalone linked Notes library removes enough context switching to improve repeat use.
2. Reminder delivery and phone capture matter more to broad personal use than additional analytics or visual themes.
3. Areas and routines help organize life without creating setup work that people abandon.
4. Users can distinguish planned date, deadline, time block, and reminder without explanation.
5. Users understand which notes, calendars, media, and settings are saved locally, synced, and backed up.
6. Calendar-aware planning leads people to defer work deliberately instead of filling every available minute.

Track observed completion, mistakes, help required, time to first useful outcome, and the participant's confidence. Do not infer willingness to pay from feature enthusiasm alone. Use a working trial and a concrete offer after the core value is demonstrated.

## 7. Evidence interpretation and refresh policy

Official sources establish documented features and packaging, not actual usage, satisfaction, or productivity improvement. Public discussions establish that certain people describe certain experiences, not how typical those experiences are. Visual references establish patterns present in the vendor's published examples, not a complete interaction audit.

Recheck plan entitlements and prices before making a public comparison, release claim, or pricing decision. Recheck UI behavior through hands-on trials before asserting interaction-speed advantages. This report extends the repository's earlier V4 research; it does not overwrite that historical audit or assume its old findings still describe the present code.
