# FlowTask ecosystem research and implementation plan

25 October 2026 · 7 categories · all 33 requested products · planning deliverable

**Recommendation:** make FlowTask a dependable place to choose a realistic day, start one useful action, and resume with its context intact. Improve the existing daily loop before expanding integrations or adding specialist systems.

## Read the deliverables

1. [Competitor analysis](COMPETITOR_ANALYSIS.md): 33 individual profiles covering features, UI structure, workflows, interaction tradeoffs, implementation approaches, and implications for FlowTask.
2. [Current-product comparison and design specification](FLOWTASK_GAPS_AND_DESIGN.md): inspected capabilities, 30 prioritized gaps, proposed screen behavior, and six complete user journeys.
3. [Phased implementation plan](IMPLEMENTATION_PLAN.md): eight phases, dependencies, engineering contracts, work packages, effort ranges, acceptance gates, rollout and measurement.
4. [Evidence and source register](SOURCES_AND_EVIDENCE.md): official references, inspection depth, limitations, reproducible captures, and corrections to earlier research.

## The decisions that determine the roadmap

| Decision | Rationale |
|---|---|
| Refine existing features before adding equivalent ones | Notes, routines, timeblocking, breakdowns, a focus queue, soundscapes, and keyboard commands already exist. Their integration and clarity are the opportunity. |
| Put readable tasks and the next action ahead of customization | The fresh mobile capture puts a large header above capture and tasks; background imagery sits behind task text. |
| Unify time and availability rules before smarter scheduling | Multiple schedule representations and dependency predicates remain in the inspected source. More automation would amplify inconsistencies. |
| Use editable suggestions with explanations | A user should understand why work moved and retain control of locked blocks, deadlines, and unavailable time. |
| Treat browser capture, calendar sync, and closed-app reminders as separate infrastructure | A web page cannot acquire native platform capabilities just through visual redesign. |
| Keep advanced PKM, custom audio calibration, and social accountability optional | These expand scope substantially and should earn their place through user evidence. |

## Delivery at a glance

| Phase | Outcome | Estimated engineer-weeks |
|---|---|---:|
| 0 | Freeze contracts; resolve time/actionability risks; establish baselines | 1–2 |
| 1 | Clear, accessible Today, task drawer, capture and mobile Plan | 2–3 |
| 2 | One dependable timeblocking model and calendar interaction layer | 3–5 |
| 3 | Better task initiation, execution horizon and recoverable routines | 2–4 |
| 4 | Notes, projects, meetings and resources maintain context | 2–4 |
| 5 | Extension capture and reliable focus visibility across browser tabs | 2–4 |
| 6 | Google Calendar integration, then controlled writes and reminders | 4–7 |
| 7 | Validated adaptive planning, optional sensory refinements and accountability | 3–5 |

Total: **19–34 engineer-weeks**, before an explicit 20–30% contingency. These are planning estimates, not measured velocity or calendar promises. With two engineers and design/QA support, allow roughly **14–24 elapsed weeks** with dependency-aware overlap and beta observation. Phase 0 must re-estimate against actual team capacity. The first useful release is phases 0–1; do not wait for phase 7 to improve daily use.

## Inspection scope

The baseline is the working tree at HEAD `d5e09ea`, including substantial pre-existing uncommitted work. This package does not overwrite the earlier R3 report or modify application source. Older release audits contain historical defects that have since received changes; they are not automatically current findings.

UI capture finished at 17:40 IST. Application files continued changing during document authoring; a final source check found a new five-level task-breakdown popover. The capability ledger and G15 now treat that as existing integration work to refine. Capture evidence is a dated snapshot; phase 0 must freeze and verify the candidate being implemented.

Fresh isolated browser inspection produced [ten captures and structured observations](evidence/observations.json), with no observed page runtime errors in those limited journeys. Desktop and mobile layouts were visually inspected. No production certification, authenticated competitor testing, new full test-suite run, deployment, or external account modification is implied.

All competitor architecture sketches are proposed ways FlowTask could deliver the behavior, unless explicitly labeled public implementation evidence. Exact proprietary algorithms, fonts, spring constants, audio samples and performance were not reverse-engineered.
