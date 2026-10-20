# FlowTask V4 research and product strategy

Research date: **19 October 2026**. This is a planning artifact, not an implementation. Sources below are official product documentation or primary platform/standards documentation. Competitor descriptions establish what those products document; they do not prove usability, retention, or productivity outcomes. No competitor hands-on benchmark or user interviews were conducted for this research.

## What the existing product already gets right

The inspected `README.md`, `docs/FLOWTASK_V3.md`, `src/types/task.ts`, `src/types/workspace.ts`, `src/components/dashboard/DailyDesk.tsx`, `src/components/layout/Sidebar.tsx`, and `src/components/focus/FocusStudio.tsx` describe a substantially capable personal planner. Its competitive fundamentals already include:

- Separate planned dates and actual deadlines; recurring tasks, someday and evening flags; estimates and recorded time; subtasks and task dependencies.
- Project outcomes, dates, milestones and focus recipes.
- A daily Plan → Focus → Reflect path, capacity summary, task capture, Top 3, calendar context, notes and study continuation.
- A task-linked focus session with pause/recovery fields, multiple timer modes, notes, queue, scenes and audio.
- Local browser persistence, optional account/cloud sync, JSON export, schema migration and recovery concepts.

These should not be presented as invented V4 features. The V4 problem is whether the same concepts behave consistently across surfaces, remain understandable at daily-use speed, and survive failures. The repository audit and browser review must establish which are reliable, duplicated, inaccessible or difficult to discover.

There is an important naming boundary: `TaskContext.tsx:220` constructs its workspace provider with `user?.uid || 'local'`. `WorkspaceRecord` is an account/local data boundary, while dashboards are layouts and projects organize work. A product proposal must not confuse these existing objects with already-implemented multiple named workspaces or shared team spaces.

## Evidence ledger: source facts → specific FlowTask decisions

All sources accessed 19 October 2026. Recommendations are our product/engineering judgment, not claims made by the linked sources.

| ID | Primary source and documented fact | FlowTask recommendation and reason |
| --- | --- | --- |
| R1 | [Things: date-based lists](https://culturedcode.com/things/support/articles/4001304/) distinguishes project/area context from when work becomes relevant; Today, Upcoming, Anytime and Someday have different meanings. | **Improve organization without more top-level destinations.** Keep projects as context and Today/Plan as time-based views of the same tasks. Give deferred work an explicit reviewable home. Consolidate navigation instead of exposing every available representation as a peer destination. |
| R2 | [Todoist: deadlines](https://www.todoist.com/help/todoist/features/introduction-to-deadlines-in-todoist-uMqbSLM6U) explicitly distinguishes the date someone plans to work from the fixed deadline. | **Keep FlowTask's existing `plannedDate`/`dueDate` distinction.** Use consistent labels “Plan for” and “Deadline”; rescheduling must not rewrite the deadline. Show both when they disagree, especially in rollover and auto-planning previews. Do not migrate these into one ambiguous date field. |
| R3 | [Sunsama: daily planning](https://help.sunsama.com/docs/usage-guides/daily-planning/) documents a guided process that reviews yesterday, adds work, considers workload and finalizes a plan. | **Rebuild the planning interaction around a feasible day.** Show available time after fixed events, selected demand, unknown estimates and overflow. Offer one reviewable proposal, including what will remain unscheduled, with Apply/Undo. Keep the ritual optional and quickly dismissible. |
| R4 | [Akiflow: time slots](https://product.akiflow.com/articles/3089241-time-slots) documents time containers containing tasks, project-specific slots, recurrence and confirmation-based replanning of unfinished work. | **Stage flexible work blocks after V4 core reliability.** A study/deep-work block can hold multiple small tasks, but it introduces another persisted object, capacity arithmetic and recurrence rules. Prototype with existing task queues first; add a block entity only if repeated workflows demonstrate value. Do not duplicate tasks simply to represent multiple work periods. |
| R5 | [Session](https://www.stayinsession.com/) presents an intention before focus, progress review after focus, and native Mac app/website blocking. | **Make starting and returning to focus the primary experience.** One task, optional next action, remembered duration, Start. At the end offer Complete / Continue / Stop and a short optional next-action note. Keep ambience in a secondary panel. Do not promise native website blocking from this web app. |
| R6 | [WCAG 2.2 additions](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/) includes AA requirements covering focus not entirely obscured, alternatives to dragging, and 24 CSS pixel minimum target sizing with specified exceptions. | **Treat access as a release requirement.** Every calendar move, list reorder and board action needs a simple non-drag pointer route plus keyboard operation. Adopt 44px mobile target design as a product target, while evaluating the actual WCAG criteria correctly. Sticky controls must not hide focused items. |
| R7 | [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) specifies contained focus, Escape behavior, initial focus and return focus; underlying modal content is inert. | **Use one tested overlay system.** Task details, menus, sheets and dialogs need intentional semantics, focus restoration and dismissal. Do not apply modal semantics to all panels indiscriminately. Test nested overlays and deletion of the invoking row manually. |
| R8 | [Web Vitals](https://web.dev/articles/vitals) defines good LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 at the 75th percentile, and distinguishes field from lab evidence. | **Measure product responsiveness, not just build size.** Use these field targets separately from reproducible local benchmarks for 1,000/10,000-task fixtures. Keep diagnostics opt-in and exclude task content. A Lighthouse score alone cannot establish field INP. |
| R9 | [MDN: storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) explains origin-wide storage, best-effort versus persistent data, browser-dependent quotas and eviction. | **Make durability visible and test recovery.** Show local saved state, pending sync, last successful export and omitted assets clearly. Persistence permission is useful but not a backup. Keep failed writes recoverable and never show success before durable local persistence. Validate exports through restore round trips. |
| R10 | [Chrome: page lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) documents freezing/discarding and recommends persisting user state as a page becomes hidden; a later event is not guaranteed. | **Harden focus across lifecycle changes.** Derive time from timestamps/checkpoints, persist on meaningful transitions, reconcile on return, and test discard/reload/sleep. A ticking interval cannot be the source of truth. These Chrome hooks are not a complete cross-browser contract; retain portable visibility/page lifecycle behavior and real-device checks. |
| R11 | [Firestore: transactions and batches](https://firebase.google.com/docs/firestore/manage-data/transactions) documents atomic writes, transaction retry on contention, and failure of client transactions when offline. | **Retain an explicit local command/outbox boundary.** An offline-first UX cannot depend on successful remote transactions. Define durable local apply, retry, conflict resolution and idempotency separately; use cloud atomic operations where related changes require them. Never imply that adopting Firestore transactions alone solves offline conflicts. |

## Recommended product position

**FlowTask helps students and individual developers turn a realistic daily plan into focused progress, and return to their work without losing context.** Its differentiation should be a reliable continuity between planning, doing and resuming, with an optional atmosphere that makes the workspace pleasant. It should not try to win through the number of task views, integrations, timer variations or themes.

An illustrative day: capture “Prepare algorithms assignment” without classification friction; assign a project and Friday deadline; plan 45 minutes today around classes; start focus from the exact task; record an interruption with a next step; return directly to that next step; review unfinished work without accidentally changing the Friday deadline. This single chain traverses the product's most valuable existing capabilities and should become the primary acceptance scenario.

### A coherent workspace model

Use plain terminology: **workspace** is the user's personal planning/data environment; **project** is a body of work with an outcome; **view** is a lens on tasks; **layout** is presentation. Changing a layout must never appear to change the ownership or location of tasks.

For V4 core, improve the current personal workspace: clear identity and sync status, coherent project creation/archive/move, export/restore, and durable settings. Keep Study/Work/Personal as project groupings or saved filters unless research establishes real isolation needs. Multiple private workspaces are a separate high-cost initiative: they require IDs independent of auth, per-workspace persistence, session ownership rules, cloud migration, backup scope and safe switching. Do not disguise a filtered dashboard as an isolated workspace. Shared collaboration requires a separate authorization and permissions design, and is outside the proposed V4 baseline.

### Reduce the number of decisions required to start work

Proposed primary destinations: **Today, Inbox, Plan, Projects**; persistent Focus access appears as Start/Resume state rather than competing navigation. Review is discoverable from Today and a secondary destination. Search/commands provide fast access to deeper functionality. Mobile emphasizes Today, Plan, Inbox and More with one consistent capture affordance. Validate exact labels and ordering with users rather than treating the competitor IA as a template.

Board, matrix, lists and timeline should be appropriate views of the same work. Keep specialized representations available where justified; remove them from default navigation before deleting working features. Preserve old routes and user data through any deprecation. This preserves capability while lowering the learning burden.

### Three valuable upgrades built from existing capabilities

1. **Resume with context.** Surface the current task, last next-action note, elapsed work and next meaningful step in Today and Focus. The code already contains `nextAction`, `InterruptionStash` and focus checkpoints; connect these consistently instead of adding an unrelated notes system. Acceptance: a participant interrupted for five minutes can resume the intended task within ten seconds without searching.
2. **Honest remaining capacity.** Make remaining time and planned demand legible, mark unknown estimates, and show exactly why work does not fit. Apply one reviewed plan with Undo; never silently alter deadlines, locked tasks or fixed events. Acceptance: an overfull day always identifies overflow, preserves hard constraints, and can return to its exact previous schedule.
3. **Recovery people can trust.** A compact data/status panel exposes saved locally, awaiting sync, sync conflict and backup freshness as distinct concepts. Restore previews count tasks/projects and explain exclusions before replace/merge. Acceptance: a seeded export restores to an empty profile with equivalent supported data; failed writes and sync retries do not silently lose or duplicate tasks.

### Simplify without damaging existing users

Keep local-first operation, task-linked focus, fast capture, keyboard operation, dates/deadlines, projects and portable backups. Improve project organization, onboarding, cross-view semantics and optional calendar context. Rebuild the navigation shell, task interaction consistency, focus entry/return and daily planning flow where audit findings justify it. Remove duplicate entry paths, ambiguous labels and decorative activity that competes with work. Move specialist study/developer utilities behind contextual controls or opt-in preferences before deciding whether to retire them.

Do not delete themes or personal media as a shortcut to polish. Standardize semantic design tokens and contrast behavior first; preserve selections or map them explicitly when retiring incompatible variants. Do not grow the theme catalogue in V4. Default focus should have restrained motion; sound, rich scenes and celebrations remain user-controlled and respect reduced-motion settings.

## What not to add by default

- **AI planning/chat:** V3 already has deterministic, local, explainable estimate suggestions. First prove that capacity calculations, plan previews and undo are trusted. AI would add network/cost/privacy dependencies and uncertain schedules without resolving the audited reliability risks. Reconsider only for a demonstrated workflow gap with an offline fallback, explicit data boundaries and user-approved changes.
- **Team collaboration:** The stated audience and current account/local schema support individual planning. Sharing, roles, invites, concurrent edits, deletion rights and audit trails are a different product. Do not make “workspace management” silently expand into a team SaaS rebuild.
- **Two-way calendar writes:** Keep read-only calendar context dependable first. Bidirectional writes bring ownership, timezone, recurrence, deletion, provider rate-limit and conflict problems. Defer until those contracts and user demand are established.
- **Native app or website blocking:** A web frontend cannot honestly match Session's native blockers. A browser extension or native companion would need its own scope, permissions and maintenance.
- **More quantified scores, streaks or badges:** Favor completed work, focused time and useful next steps. Do not turn an uncertain productivity model into a judgment of the user.
- **Framework replacement:** None of the researched workflow patterns requires abandoning React, TypeScript, Zustand, IndexedDB or optional Firebase. Profile and simplify the existing boundaries before proposing a migration.

## Validation before shipping

Recruit the ten student/developer usability sessions already called for in V3 documentation; do not claim research outcomes before conducting them. Test capture → plan → focus → interruption → resume → review, project organization, deadline-preserving reschedule, offline edits, and restore. Record completion, assistance, time, errors and participant confidence. Proposed directional gates: at least 8/10 complete the primary chain unaided; no unrecoverable data errors; first task-to-focus within 60 seconds for a first-time participant; capture an additional task within 10 seconds. These are proposed product gates, not measured baselines or statistically representative claims.

Technical validation must cover multiple browser engines, keyboard and screen readers, 320px layouts, zoom/reflow, reduced motion, theme contrast, mobile backgrounding and storage failures. Measure data-set scaling and session recovery separately from the initial page-load metrics. Launch criteria should distinguish tests run locally, tests requiring real devices, and field observations only available after a controlled release.

## Risks and sequencing implications

The greatest risk is broad UI change hiding unchanged data/recovery weaknesses. Stabilize correctness and establish repeatable workflow fixtures before rolling out the new shell. Another risk is removing expert workflows merely because they complicate navigation; use progressive disclosure and compatibility mapping before removal. Adding genuine workspaces or flexible work blocks expands the domain model: stage these behind documented migration and lifecycle contracts, not late UI shortcuts. Premium visual work should follow semantic tokens and shared interaction primitives so new screens do not create a second inconsistent design system.

The research supports an ambitious but bounded V4: **fewer competing surfaces, more reliable handoffs, stronger recovery, and a distinctly calmer focus experience**. Feature additions should pass a concrete test: does this help someone choose useful work, start it, return to it, or trust that it is safe?
