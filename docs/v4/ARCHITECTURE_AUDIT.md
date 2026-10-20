# FlowTask V4 architecture and reliability audit

Audit date: 2026-10-19. Source inspection for the V4 planning phase. No product implementation or production-test changes were made. Findings below distinguish code-established behavior from risks requiring runtime reproduction. The coordinating audit runs the existing suite; this audit additionally ran isolated fixture reproductions in `test-results/v4-audit/architecture-repro.mjs`, with results in `architecture-repro-results.json`.

## Executive assessment

Keep the local-first React/TypeScript architecture, deterministic command transformations, IndexedDB persistence, explicit outbox, and optional Firebase synchronization. A backend rewrite, CRDT adoption, or new framework would add migration risk before solving the defects that matter. The urgent change is to make every supported mutation preserve a valid, reloadable workspace, then consolidate persistence, recovery and focus lifecycle contracts.

The current application has one device workspace (`local`) or one workspace per Firebase UID, not a first-class set of user-managed workspaces. Dashboards are separate presentation records within that workspace. The product should explicitly distinguish account, workspace, project, and dashboard before adding a workspace switcher.

## Current architecture

- `TaskProvider` chooses `user.uid || 'local'`, remounting `WorkspaceProvider` on identity change (`src/context/TaskContext.tsx:213`). A `WorkspaceStore` owns a complete `WorkspaceRecord`.
- IndexedDB `flowtask_storage_v2` contains workspaces, snapshots, legacy backups, outbox and media stores. The workspace and its outbox are committed in one IndexedDB transaction (`src/services/dbService.ts:171`).
- `WorkspaceStore.run` transforms state synchronously, computes entity diffs, adds revisions and operation IDs, publishes optimistically, then serializes durable commits. Cloud delivery follows local persistence (`src/services/workspaceStore.ts:82`).
- Firebase has six owner-scoped collections: tasks, projects, dashboards, focus logs, recipes and preferences. Revision checks and idempotency receipts run inside a transaction (`src/services/cloudWorkspace.ts:135`).
- Focus state spans workspace preferences, a Zustand projection, a legacy global localStorage record, a synchronous per-workspace checkpoint, `TaskContext`, the Studio runtime, modal lifecycle logic and the WebMCP bridge.
- Media is device-local; cloud preference projection excludes private feed URLs, scratchpad content, queue content and personal file references (`src/services/workspaceEntities.ts:32`).

## Release blockers / high-priority defects

### A1 — Valid UI operations can produce a workspace that fails on reload (P1)

Evidence is direct code-path inspection and successful isolated fixture reproduction, not a speculative race:

1. `commandService.permanentDeleteTask` removes only the target task (`src/services/commandService.ts:313`). Other tasks can retain its ID in `blockedBy`.
2. `TaskContext.deleteProject` moves tasks to the destination project without clearing or remapping their `milestoneId` (`src/context/TaskContext.tsx:659`). The normal task property selector correctly clears it when moving an individual task (`src/components/tasks/drawer/TaskDrawerProperties.tsx:88`), so the behavior differs by entry point.
3. Workspace load invokes `validateWorkspaceData` (`src/services/dbService.ts:71`), which rejects missing dependencies and milestone IDs outside the task's project (`src/utils/workspaceValidation.ts:118`, `:122`).

Reproduction fixtures: create B blocked by A, permanently delete A, invoke the same validator used on reload; create a task attached to a project milestone, mirror the project-delete reassignment transformation and invoke that validator. Both initially valid fixtures were rejected afterward with missing dependency/milestone errors. The remaining records are retained; this establishes inability to reopen through normal loading, not physical data destruction. This deserves a release gate before visual work.

Recommendation: atomic domain commands for deleting tasks, moving tasks and deleting projects; each command maintains referential integrity and describes its effects for undo. Validate at ingress and command boundaries. A malformed record must enter a recoverable quarantine with downloadable raw data, not strand the user on a workspace-opening screen.

Acceptance: every supported mutation followed by persistence and reload succeeds; dependency and milestone references are either preserved, deliberately remapped or cleared; undo restores the entire relationship change.

### A2 — Snapshot recovery is not scoped to the active account/workspace (P1)

`backupService` uses global `flowtask_snapshots_v1` (`src/utils/backupService.ts:16`), always creates snapshots with `workspaceId: 'local'` (`:157`), and falls back to the unscoped localStorage list (`:47`). `ExportImportModal` neither reads nor passes the current workspace ID; it initializes from `getStoredSnapshots()` and calls `loadSnapshotsFromIDB()` with the local default (`src/components/modals/ExportImportModal.tsx:49`, `:53`, `:61`). Snapshots taken while signed in are therefore attributed to `local`, can appear after account changes, and can be restored into the wrong workspace. Account-local removal deletes records by the account UID, so these mislabeled snapshots can survive it.

Also, pruning writes the retained list back into IndexedDB without deleting pruned records (`src/utils/backupService.ts:114`), so subsequently reloading the IDB snapshot store can reintroduce older entries. Snapshot errors are swallowed, yet the UI still chimes after creation (`src/components/modals/ExportImportModal.tsx:539`).

Recommendation: one recovery service with required workspace ID, typed full-workspace snapshot schema, atomic retention, durable success/error state, and explicit handling of unowned legacy snapshots. Do not silently assign old mixed snapshots to a signed-in account.

Acceptance: create snapshots under local/A/B, switch identities and verify isolation; remove A and verify its snapshots/media/checkpoints are gone; exceed retention and reload to verify retention remains bounded; quota failure never reports a successfully saved checkpoint.

### A3 — Daily automatic recovery is promised but not wired (P1/P2)

The UI says “Automatic daily checkpoints” and “Automatic daily snapshots will appear here” (`src/components/modals/ExportImportModal.tsx:533`, `:553`). `checkAndTriggerDailyAutoSnapshot` exists (`src/utils/backupService.ts:220`) but has no production caller in the inspected repository; references are only its definition and tests.

Recommendation: implement a real per-workspace checkpoint policy as part of recovery, with visible last successful checkpoint, or remove the promise until it works. Local snapshots must be described as local recovery, not independent backups against device loss.

### A4 — Extension capture reaches unrelated sites; receiver lacks sender validation (P1)

The extension content script runs on every `https://*.vercel.app/*` page (`extension/manifest.json:23`). The popup broadcasts the full task title and description/current URL to every open tab whose URL contains `vercel.app`, `localhost`, `127.0.0.1` or `flowtask` (`extension/popup.js:73`). The content script forwards the payload into page JavaScript via `window.postMessage(message, '*')` (`extension/content.js:6`). An unrelated Vercel tenant can therefore receive captured content when the user clicks Capture. The unchanged popup/content scripts reproduced this in an isolated mock-Chrome fixture with synthetic data: unrelated tenant tab 2 received the private-looking title and URL in a page message. This is a concrete extension routing disclosure, not an executed real-world attack.

Separately, `handleExternalCaptureMessage` checks only payload type and title, not `event.origin` or `event.source` (`src/context/TaskContext.tsx:357`). Production frame denial and COOP restrict reachability; no arbitrary cross-origin browser injection was demonstrated. Treat the missing receiver guard as defense in depth, not a proven standalone remote exploit.

Recommendation: configure one exact authorized FlowTask origin in the extension; narrow content-script matches and recipient selection; require an acknowledgement from the intended ready app. Enforce same-window/same-origin sender checks and bounded runtime payload validation; use a narrow extension bridge. Exercise unrelated-tenant delivery and hostile-origin/source rejection in browser tests. Do not describe the global same-page WebMCP bridge as a network API or an authentication boundary.

### A5 — Timed-session completion depends on entry path and mounted UI (P1/P2)

The Studio runtime returns before completion handling unless `active.timerConfiguration` exists (`src/components/focus/FocusRuntime.tsx:99`). The WebMCP start tool constructs a timed session without that field (`src/services/webMcpService.ts:379`). The legacy Pomodoro modal has its own completion effect (`src/components/focus/PomodoroModal.tsx:94`), while the mini-player does not own completion. Consequently a timed session started through the bridge can remain running at zero when the modal is not mounted. The legacy modal and Studio also maintain separate phase/cycle logic.

Recommendation: one headless focus lifecycle service/state machine, all entry points dispatching the same validated commands, timer UI subscribing to a projection. Completion, interruption, pause, recovery and phase transitions cannot depend on a particular surface staying mounted. Keep the existing synchronous checkpoint and session-ID idempotency protections.

Acceptance: UI, keyboard and bridge sessions all complete exactly once after navigation, reload, backgrounding and resume; two tabs never double-log; breaks never count as focused work; a failed save is visible and recoverable.

## Architecture / performance work worth doing

### A6 — Granular subscriptions are undermined by the broad context (P2)

`WorkspaceProvider` subscribes to the entire UI store (`src/context/TaskContext.tsx:236`), recreates `overdueTasks` on every render (`:301`), and exports one large memoized context. Even `useWorkspaceTasks`, `useWorkspaceProjects` and `useActiveTask` unconditionally read `TaskContext` for fallback (`:894`, `:901`, `:908`), so they remain subscribed to broad context updates despite their selector API.

Recommendation: separate stable command access from task/project/settings/sync/focus selectors; use explicit legacy adapters only where required. Remove fallback broad-context subscriptions from production consumers. Measure render counts and latency before asserting a speedup.

### A7 — Whole-workspace diffing and persistence will scale poorly (P2)

Each mutation compares serialized entities across all sync collections (`src/services/workspaceStore.ts:19`), structured-clones the complete workspace including history/outbox (`:72`), and writes the full workspace. Each save deletes and rewrites the complete workspace outbox (`src/services/dbService.ts:174`). Bulk UI loops such as Trash purge execute one full command per task (`src/components/views/RecoveryView.tsx:108`). Offline histories retain full before/after entities per command.

Recommendation: first introduce bulk commands and coalesced persistence with explicit durability semantics. Then, only where profiling justifies it, persist normalized entities and append/remove outbox operations incrementally. Keep the logical transaction across related entities and operation delivery. Do not jump directly to a new distributed database.

Acceptance: baseline and budget the 1k/10k-task fixtures, a long offline queue, 500-item bulk operations and repeated note edits; no long main-thread stalls or unbounded recovery growth. Imported-file limits must match tested capacity, rather than implying the current 100,000-task validation ceiling is a performance guarantee.

### A8 — Sync needs clearer readiness, error and conflict contracts (P2)

`connect` can mark an empty outbox synced before initial snapshots arrive; subscription errors only show a toast (`src/context/TaskContext.tsx:327`). Non-conflict transaction errors collapse to `offline` (`src/services/workspaceStore.ts:154`), hiding permission/schema/configuration failures behind a retryable network label. `receive` validates dashboards but accepts task/project/preferences casts directly (`src/services/workspaceEntities.ts:124`); a bad cloud shape can enter the UI and later fail stricter reload validation. Conflicts are resolved by whole pending-operation replay or discarding all pending changes; the UI has no record/field comparison.

Recommendation: model local durability separately from cloud connection, initial hydration and pending count; classify network/auth/validation/conflict errors; bounded retry/backoff for transient errors; validate each remote entity and quarantine malformed input; merge non-overlapping field changes and ask for comparison only when fields truly collide. Retain revisions and operation receipts.

Receipt cleanup currently scans the entire operations collection and is invoked only by the adapter's `read` path (`src/services/cloudWorkspace.ts:89`, `:120`), which normal live synchronization does not call. Use deployment-managed retention or a bounded scheduled cleanup; define retention from server commit time and supported offline replay windows, not blindly from the original client command timestamp.

### A9 — Multi-tab handling blocks the second workspace rather than synchronizing it (P2)

The first tab holds `navigator.locks.request('flowtask-workspace-' + workspaceId)` until provider unmount (`src/context/TaskContext.tsx:312`). Other tabs wait before even loading, and the opening screen tells users to close the other tab (`:848`). Without Web Locks, both tabs load independent complete records with no equivalent workspace-writer coordination.

Recommendation: explicitly support single-writer/follower tabs using a visible ownership state and safe handoff, or design tested multi-tab entity synchronization. The product should not sit indefinitely behind a loading message. Keep one audio owner and one session completion owner.

### A10 — Integration deployment contracts need a single source of truth (P2)

`calendarService` attempts external calendar fetches or a configured private proxy (`src/services/calendarService.ts:52`), while production CSP `connect-src` does not include ordinary Google Calendar/Outlook feed hosts or arbitrary configured worker origins (`vercel.json`, final CSP header). Those integrations will be blocked by production CSP unless deployments are adjusted. File import is a working fallback.

Recommendation: use a documented same-origin endpoint or generate a narrowly allowed proxy-origin policy from configuration; test against production headers. Retain the worker's origin/host allowlists, HTTPS requirement, no redirects, timeout, no-store and streaming size limit.

## Strong foundations to retain

- Local-first use works without cloud credentials; sign-in is optional and identity-keyed providers help prevent direct state carryover.
- Durable workspace/outbox transaction, serial save queue, optimistic revision checks, receipt-based retries, and protected undo against subsequently changed records.
- Import validation covers date formats, safe URLs, duplicate IDs, task dependencies and milestones. Extend this invariant to all commands rather than weakening it.
- Focus elapsed time derives from timestamps, with paused accumulation and a synchronous checkpoint that can recover an uncommitted completion.
- Cloud owner rules deny cross-user access and deletion-in-progress writes. Account deletion requires recent authentication and retains a write barrier on partial failure (`api/account/delete.mjs:16`).
- Private calendar and personal media data are intentionally separated from cloud projection. Preserve this privacy contract in new schemas.
- Existing unit, browser, security and rules tests are valuable regression assets. Their presence is not proof that the gaps above are covered.

## V4 architecture recommendation and migration sequence

1. **Repair invariants and recovery first.** Fix A1–A5, add regression fixtures and implement real per-workspace snapshots. Back up original records before any repair.
2. **Introduce a typed domain layer gradually.** Separate commands, selectors, persistence adapters, sync engine and focus lifecycle. Replace `preferences: Record<string, unknown>` with typed persisted/synced/device-only domains behind a compatibility adapter. Keep UI-only selection/modal state outside persisted domain state.
3. **Define workspace semantics.** Default V4 scope should be personal productivity: one account workspace with projects and optional saved dashboards. If actual Work/Personal spaces are approved, create stable workspace IDs independent of UID, namespace every entity/cache/media/checkpoint/undo record, and update Firestore paths/rules together. Do not present dashboard switching as full data isolation.
4. **Version migrations explicitly.** Existing normalization stamps schema 7, while exported backups declare version 6 (`src/utils/workspaceBackup.ts:20`). Separate app version, DB schema version and portable backup version; use ordered, idempotent migrations with fixtures from each supported version. Preserve IDs, dates, recurrence chains, focus log IDs and personal media links. Provide repair reports and rollback exports.
5. **Improve delivery incrementally.** Preserve existing Firebase adapter initially. Add deterministic two-device concurrency scenarios, interrupted commits, stale queues, account switching, malformed remote data and denied-write tests before changing sync representation.
6. **Make lifecycle failures observable.** Keep opt-in privacy-safe diagnostics. Add actionable local save/sync/recovery status; use redacted operational error classes for operator debugging, with no task titles, notes or feed URLs in telemetry.

## Explicit non-goals until evidence warrants them

No full-stack/framework rewrite; no CRDT without collaborative editing requirements; no collaborative workspaces just because the noun “workspace” exists; no server AI dependency for task parsing/planning; no promise of cross-device active focus takeover until its ownership protocol is specified and tested.
