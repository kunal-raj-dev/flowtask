# Connected Notes — upgrade milestone 1

Implemented locally on 25 October 2026. This advances the first slice of the [competitive upgrade plan](research/2026-10-25/PRODUCT_UPGRADE_PLAN.md). It does not claim that the subsequent reminder/calendar/life-organization releases are complete or deployed.

## User-facing behavior

Notes is now a primary desktop destination and is available through mobile More and global search. The library provides all notes, favorites, daily notes, archive/trash, text/tag search, and project filtering. The editor supports plain Markdown writing and a safe preview of headings, lists, checkboxes, code, bold, links, and optional stable reference tokens. Link note creates a human-readable related-note connection; incoming references appear as backlinks. Titles can change without breaking those links.

Select note text to create a linked task. Repeating capture of the same selection reuses the task. Creation and provenance are one workspace command; completion remains the ordinary task's state across lists, projects, Today and Plan. Task details link back to the source note. Notes can also be assigned to a project, and projects expose their linked notes.

Today and the Notes library open the same dated daily note. A trashed or archived daily note is opened with a restore action, rather than silently resurrected or duplicated. Browser history restores the selected note.

Scratchpad import is explicit. The confirmation explains that imported notes in a signed-in workspace will sync to the account; the original device-local scratchpad stays unchanged. Markdown import shows a preview and avoids reimporting identical title/body text. Download a note as Markdown, or use the complete workspace JSON backup to preserve links, history, tasks and settings. Individual Markdown files preserve writing; JSON is the lossless workspace format for relationships.

## Data and conflict contracts

- Workspace schema **9** adds optional `notes`; older workspaces normalize to an empty collection. IndexedDB migration saves a v8 recovery copy before normalization. Older task descriptions, local scratchpads, project milestones and preferences are retained.
- Portable backup schema **7** includes notes and bounded version history. Older backups remain accepted. Replace/import uses the existing checkpoint and restore pipeline. Merge preserves differing imported text as a recovered copy rather than overwriting it, and identical repeat imports do not create more copies.
- Notes are individual records/Firestore documents, not one preference blob. They use the existing durable local commit, revisioned outbox, undo, read-only-tab policy and account-scoped collection. Account deletion already recursively deletes all owned collections, including notes.
- Text saves compare against the editor's base. If another update changed the text, the draft becomes a recovered copy. Explicit account conflict resolution also preserves the losing note text as another note before applying the chosen version. These are optimistic record-level conflicts, not real-time collaborative editing.
- Recent text versions are grouped at one-minute intervals, with explicit Save version and Restore actions. Up to **four** versions are retained per note. This is bounded recovery, not an unlimited audit history or a separate-device backup.
- Notes support **40,000 body characters**, 200 title characters, 20 tags (50 characters each), 200 related-note IDs, and **30 linked task selections** (up to 1,000 characters each). Together with bounded history this keeps supported payloads below Firestore's document-size limit. Oversized/malformed inputs are rejected before mutation.
- Titles/body render as text/React nodes. Raw HTML is never executed; external preview links allow only HTTP(S). References are resolved only within the current workspace.
- Autosave flushes on blur, note/view change and page hide; save/sync errors stay visible and the workspace retains unsaved in-memory changes for retry/export. Closing a browser before a durable commit is never represented as guaranteed protection.

## Deployment and remaining work

Deploy the updated `firestore.rules` before publishing the frontend that queries the new `notes` collection. An old deployed ruleset will deny those queries. The code and emulator checks are not evidence that production rules or hosted cloud/device acceptance have been deployed or passed.

Notes are part of the core PWA precache; the production offline test covers reload and editing after service-worker activation. Existing CSS/JS/precache limits remain unchanged. Unused legacy project styles were removed, and board WIP/study continuity styles now load with their owning feature.

The next roadmap work remains reminder delivery/mobile capture, calendar connections and week/multiple-block planning, then life areas/goals/routines. OAuth scopes, push infrastructure and native surfaces need their own end-to-end contracts. General collaboration, rich handwriting/PDF tools and hosted AI are later conditional work.

## Verification on 25 October 2026

- Supported Node **22.23.4**: complete `verify` pipeline passed — lint, TypeScript, **1,185 unit/component tests in 145 files**, **15 security tests**, **10 isolated Firestore emulator rules tests**, production build and unchanged performance/cache budgets.
- Production Chrome: **23 journeys passed** across Connected Notes, entry flow and production readiness. Includes note-to-task/source navigation, backlinks, history restoration, portable export, mobile preview/accessibility, installed offline note reload/edit/reload, task/focus entry, multi-tab ownership, Today across all 18 themes, and 1,000/10,000-task workspaces.
- Final build budgets: landing JavaScript 168,712 bytes gzip; planner JavaScript 334,841 bytes gzip; planner initial CSS 35,809 bytes gzip; core precache 1,673,263 bytes. Existing limits were not raised.
- Reviewed desktop and mobile Notes captures visually; checked local diffs for whitespace errors.
- After the last migration/layout changes, reran all three Notes journeys plus durable-capture and mobile Plan/accessibility checks against the final production build: **5/5 passed** (overlapping the original 23).

Production cloud deployment, physical devices, real screen readers and the existing Linux Firefox/WebKit release gates remain unverified by this milestone. Automated accessibility scanning here is a bounded check, not a compliance certification. [Verification record](evidence/2026-10-25-connected-notes/verification.md).
