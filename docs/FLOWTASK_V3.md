# FlowTask V3 — A calmer, more dependable daily flow

V3 keeps the FlowTask identity and existing 18 themes. Its product direction is a connected Plan → Focus → Reflect loop for students and developers, with local-first planning and optional account sync. AI planning, two-way Google Calendar sync, and website blocking are outside this release.

## Current implementation in this checkout

- Daily Desk presents Plan, Focus, and Reflect as a guided path. The existing capacity planner and shutdown reflection remain the actions behind those steps.
- Daily Desk can offer a local estimate suggestion when a still-open task has at least 25% more recorded task time than its current estimate. The reason and proposed value are shown; the user applies or dismisses it, and an accepted edit has Undo.
- Projects can keep an outcome, target date, cover, focus recipe, and ordered milestones. A milestone can be dated, completed, skipped, reordered, linked to existing project tasks, and used to return to its next open task. Existing project views remain in place.
- Project milestones are optional. Workspace schema v7 preserves a v6 snapshot before migration; backup format v6 includes milestones and task links. Existing projects without milestones remain valid.
- Settings can display estimated site storage and request persistent browser storage after the user presses the button. A granted request reduces eviction risk but is not presented as a backup. JSON backup excludes personal media and active timer checkpoints.
- Landing hero spacing is tightened for narrow mobile screens so its action and beta note appear before the product showcase.

## Product and data rules

Suggestions are deterministic and local. They use recorded task time and estimates, explain the reason, and never alter a task, deadline, or schedule without an explicit action. Session data, media playback, and appearance remain independent from project presentation.

Project milestone IDs are scoped within their project and task links must resolve within the task's project. Validation applies on import and workspace normalization. Cloud sync continues to use the existing project/task collections; no new analytics collection is added. Personal media remains device-local and is excluded from portable JSON backups.

Browser storage usage is an estimate for the site origin, not an exact FlowTask-only measurement. Browser eviction protection is optional and browser-controlled. A downloaded JSON file is the recovery copy; it should be stored separately from the browser profile.

## Verification and release status

The V3 changes in this checkout require a fresh full test, lint, build, security/rules, responsive browser, keyboard/accessibility, and storage/migration review before release. Automated checks cannot substitute for the planned 10 student/developer usability sessions, physical mobile/screen-reader checks, or field Core Web Vitals. Do not claim those gates passed until their evidence is recorded.

To verify locally:

```sh
npm test
npm run lint
npm run build
npm run test:security
npm run test:rules
```

The V2 deployment status and its previously recorded limitations are in [FLOWTASK_2_BETA.md](FLOWTASK_2_BETA.md). This V3 source work has not been pushed or deployed.
