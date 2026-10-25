# Competitive research and upgrade plan

Prepared 25 October 2026 for a broader **personal life and work** audience, as requested by the owner.

- [Competitive research](COMPETITIVE_RESEARCH.md): 28 products, 12 deeper workflow profiles, prominent daily-use features, reasons to use/pay, six qualitative user discussions, dated pricing signals, and UI/UX patterns with sources.
- [Product upgrade plan](PRODUCT_UPGRADE_PLAN.md): inspected current capabilities, 36 gap/scope decisions, 24 backlog items, six delivery waves, navigation and screen specifications, engineering contracts, and acceptance journeys.

Main recommendation: connect **tasks + notes + calendar + routines + review**. The existing capture/planning/focus capabilities should be refined and joined up. First build slice: **a portable Notes library with linked tasks and search**, then reminder delivery/mobile capture, calendar/week planning, and life areas/routines.

## Current product evidence

Inspected local checkout: `b2e8726` (`feat: share backgrounds across workspace views`). Only this research directory was added during the task; no application source was changed and no deployment was performed.

The capture uses an isolated headless Chrome profile, synthetic data, Asia/Kolkata timezone, a real advancing clock, and reduced-motion preference. The seed task dates are 25 October 2026; rerunning on a later date requires updating those synthetic dates to inspect the same Today composition.

The research capture ran on the available Node 25.6.1 runtime against Vite's development server and installed Chrome. The repository's supported release verification remains Node 22.x and the production-build checks documented in `PRODUCTION_READINESS.md`; this capture does not replace them.

| Capture | Viewport | File |
|---|---|---|
| Today desktop | 1440×1000 | [Screenshot](evidence/today-desktop.png) |
| Today mobile | 390×1000 | [Screenshot](evidence/today-mobile.png) |
| Plan desktop | 1440×1000 | [Screenshot](evidence/plan-desktop.png) |
| Projects desktop | 1440×1000 | [Screenshot](evidence/projects-desktop.png) |
| Task detail desktop | 1440×1000 | [Screenshot](evidence/task-detail-desktop.png) |

[Structured observations](evidence/observations.json) include visible text, headings, page overflow observations, task drawer geometry/opacity, and runtime errors. The four main-view captures reported no document-width overflow, and no page runtime errors were observed in this limited journey. This is not full accessibility, production, performance, or device certification.

To reproduce, start the existing Vite development server on `127.0.0.1:5185`, then run:

```powershell
node docs/research/2026-10-25/capture-current-product.mjs
```

Set `FLOWTASK_RESEARCH_URL` to use a different running local server. The capture script does not read or alter the user's ordinary browser profile or authenticate to cloud services.

## Public visual references

Vendor-published screenshots from [Sunsama](https://www.sunsama.com/), [Akiflow](https://akiflow.com/), and [NotePlan](https://noteplan.co/) were visually inspected. Their assets were opened in an isolated browser and rendered into a task-specific temporary directory for analysis. Vendor screenshots are not republished in this research directory. `inspect-public-references.mjs` records the exact source assets and can reproduce the inspection. The attempted Structured image opened as a download and was not visually inspected; its analysis uses official product/help text instead.

No paid competitor account was used, no live competitor usability test was conducted, and no proprietary most-used-feature telemetry was available. The research labels facts, selected user anecdotes, inferences, and proposed design targets separately.

## Validation performed for this deliverable

- Reviewed source and existing product/release documentation against the proposed gap inventory.
- Executed the isolated current-product capture and checked its five outputs; no page runtime errors observed.
- Visually checked the current Today desktop/mobile, Plan, Projects, and task detail captures, and the three public vendor references described above.
- Checked Markdown local-link targets and backlog/gap ID coverage.
- Application test/build/release suites were not rerun for a documentation-only change. Previous release results remain historical evidence in their original documents.
