# FlowTask: a calmer daily desk and Focus Studio

Research and implementation: 27 October 2026. Everything in this change is local. No publication, push, account creation, paid trials, or external app integration was performed.

## Research method and limits

Five established references were selected for complementary strengths, rather than claiming a universal ranking: Sunsama, Akiflow, Things 3, Structured, and Endel. I read their official product material and inspected public product imagery in a browser. This is a comparative expert review, not a logged-in usability test or a measured user study. Product documentation establishes available behaviors; recommendations below are my design interpretations.

LifeAt was also investigated for ambient environments. Its indexed product description was available, but its live website returned a paused-deployment/503 screen during this session. It is therefore supplementary context, not evidence of a currently verified interface. Endel provides the fifth directly inspectable reference.

The local audit included the actual Today page, desktop navigation, header, workspace background, Focus Studio, its preparation state, active timer, room browser, and mobile presentation. Screenshots in `evidence/` record the existing and revised local experience. Existing uncommitted work was retained.

## 1. Sunsama: make the day understandable

Sources: [official product overview and product screenshot](https://www.sunsama.com/), [Focus Mode manual](https://help.sunsama.com/docs/usage-guides/focus-mode/), [navigation redesign rationale](https://roadmap.sunsama.com/changelog/navigation-20).

**Observed pattern.** The public product image has a stable navigation column, distinct task columns, and a calendar rail. Work content carries the visual hierarchy. Its documented Focus Mode gives the current task its own minimal view while keeping notes, subtasks, timing, and completion available. Sunsama's own navigation redesign explains the cost of adding new workflow views to an earlier navigation model.

**Interpretation for FlowTask.** Navigation should describe where the user is working; it should not read like a catalogue of every feature. Planning and execution need different degrees of density. A task list benefits from quiet structure; an active focus session benefits from removing surrounding decisions.

**Applied.** Primary daily destinations stay visible. Life tools sit in a named disclosure that opens when one is active. The task list gets the dominant column. Daily capacity remains readable inside one compact summary. Normal laptop widths no longer automatically open two competing side shelves.

**Boundary.** We retain FlowTask's flexible dashboard, Top 3, task scheduling, and backlog. A competitor's column system does not justify replacing these existing capabilities.

## 2. Akiflow: keep capture fast

Sources: [official features](https://akiflow.com/features), [official product help](https://product.akiflow.com/help).

**Observed pattern.** Official material documents a command bar, natural-language task entry, keyboard shortcuts, daily rituals, time slots, and a focus timer. Its public focus illustration presents a compact timer next to the current task and a few direct controls. Task creation does not require visiting a configuration screen first.

**Interpretation for FlowTask.** Speed comes from a clear input and predictable actions. Showing every possible helper beside that input can make a powerful capture system appear harder to use. Secondary utilities need readable names when revealed; anonymous icon collections make discovery expensive.

**Applied.** The task input uses the whole capture row. Date, priority, project, and duration helpers remain in a keyboard-accessible disclosure; parsed task details still appear while typing. Search, New task, and Focus remain visible in the desktop header. Quick capture, interface sounds, and Settings are grouped in a named native popover, with outside-click and Escape dismissal.

**Boundary.** No third-party integrations, automated scheduling behavior, or new AI service is introduced. Existing local commands and natural-language parsing remain the implementation.

## 3. Things 3: power without visual noise

Source: [official features and Mac/iOS product imagery](https://culturedcode.com/things/features/).

**Observed pattern.** Things' public interface separates Today, evening work, upcoming work, projects, and areas with restrained headings and substantial whitespace. The feature page explicitly describes task details being available without occupying the task's initial writing surface. Its product screenshots use recurring rows and a consistent sidebar instead of a different card treatment for each small action.

**Interpretation for FlowTask.** Cute and premium can come from proportion, warmth, and small details. They do not require every element to glow, lift, or become a capsule. A repeated row rhythm helps users scan actual work.

**Applied.** The light palette becomes warm paper and grounded sage. Controls share an 11–12px corner treatment, while larger sections use 14–24px radii according to size. Task rows keep readable titles and stable geometry. Top 3 has a compact empty state rather than a tall nested card. Frequent controls and large content sections stop moving on hover.

**Boundary.** FlowTask remains a web workspace. Native Apple gestures and platform-only interactions were not copied.

## 4. Structured: let color support orientation

Sources: [official product overview with phone and web imagery](https://structured.app/), [visual planning](https://structured.app/visual-planning).

**Observed pattern.** Structured presents tasks through a single visual timeline, with colors distinguishing activities and different planning views. Its public phone and web imagery preserves an obvious sequence and gives time a spatial role. Color supports the plan rather than replacing its labels.

**Interpretation for FlowTask.** Planning tools must be readable at a glance on phones. Piling the desktop's navigation and side panels into a small screen defeats the benefit of visual organization. A gentle palette should still preserve semantic urgency and clear selection.

**Applied.** Phones keep a single task column and existing bottom navigation. Timeline access becomes a focused drawer where the full rail cannot comfortably coexist with tasks. Overdue work is presented as a compact, actionable review prompt. Capacity, completion, and focused time remain distinct, with their existing calculations unchanged.

**Boundary.** Existing due dates, scheduling constraints, calendar events, and overbooked warnings remain authoritative. The redesign does not infer a task's time from its title or invent progress.

## 5. Endel: a focus state should need fewer decisions

Source: [official product, desktop, mobile, and web player overview](https://endel.io/).

**Observed pattern.** Endel's public product presentation emphasizes a small number of sound contexts and a discreet desktop player. The website shows a tightly related visual language across mobile, watch, desktop, and web playback. Its product explanation distinguishes continuing soundscapes from timed scenarios.

**Interpretation for FlowTask.** Preparing a session and living inside a running session are separate experiences. During focus, the task, remaining time, and pause/resume control should dominate. Environmental controls should be nearby without covering the environment.

**Applied.** Studio preparation contains a concise selection of three rooms and three rituals, with the full libraries behind explicit browse actions. The active timer surface becomes substantially narrower, leaving the room visible around it. Notes, queue, phases, sound, style, floating timer, and fullscreen remain accessible. Disabled reset/finish controls are removed from the preparation presentation. The user's chosen Studio palette and panel-opacity control continue to work.

**Boundary.** No efficacy claims, biometric inputs, adaptive sound science, or subscription behavior from Endel are attributed to FlowTask. The reference is its visual and interaction restraint.

## Findings in the existing local UI

| Finding | Why it matters | Implemented response |
| --- | --- | --- |
| Header, backup reminder, budget card, capacity bar, quick tags, and overdue prompt all compete before tasks | The page looks busy even when it contains almost no work | Compact backup strip; one integrated capacity summary; quieter page header and task helpers |
| Task capture shares a horizontal layout with five quick-tag controls | The title input can shrink and truncate at ordinary desktop widths | Full-width input row; helper disclosure below |
| Two side shelves open at a 1200px content threshold | A 1440px laptop can lose most of its useful task width | Raise full-rail threshold to 1500px content width; backlog starts collapsed |
| Life tools and seven secondary destinations remain prominent beside daily work | All navigation looks equally important | Named disclosures; active Life destination automatically remains exposed |
| Studio offers six rooms, six rituals, task choice, rhythm, phase, timer, and playback at once | Starting feels like configuring a dashboard | Curated three-plus-three preview with full browsers retained |
| Running Studio timer uses a broad, tall opaque surface | A chosen room becomes largely hidden | Smaller centered session surface with stable title/timer/actions hierarchy |
| Repeated card hover lifts, scaling pills, and a pulsing capacity dot | Routine work gets unnecessary movement | Static section geometry and quiet control feedback; reduced-motion path |
| Large nested empty states | An empty day still consumes a screen before useful work | Shorter Top 3 state with straightforward guidance |

## The visual system

The default light theme is **Alabaster Dawn**: `#f7f7f2` canvas, `#f0f1eb` navigation, `#fffefa` paper, and a sage accent starting at `#496650`. The existing palette generator computes readable text and accent colors for all surfaces. Explicit custom accents and the other bundled themes remain supported.

Large content areas use quiet borders and a light shadow. Smaller actions use a consistent control shape. Saturated color is concentrated on the next action and meaningful status. The workspace photograph is softly veiled so text has a calm context. The Focus Studio image stays immersive because its interface takes less space.

The companion column contains a bundled room image, a working Studio entry, a small botanical detail, and the existing daily-note action. It carries warmth without adding fabricated statistics or another task-management system. On smaller screens, work retains priority and this optional column is omitted.

Motion choices follow the installed design-motion-principles skill: productivity restraint first, subtle production refinement second. There are no new decorative loops, autoplay sounds, external fonts, or new dependencies. The operating-system and in-app reduced-motion settings continue to apply.

## Preservation and review scope

Preserved: local persistence, optional sync architecture, task capture/parser, task completion and pinning, Top 3, backlog, calendar, daily planning, budgets, notes, projects, customizable dashboards, all bundled themes, focus lifecycle and recovery, breaks, queue, sound layers, recipes, personal media, fullscreen, floating timer, and opacity preferences.

This is an interface redesign, not a claim that every enterprise release gate is complete. Automated checks and browser observations are recorded in `VALIDATION.md`. Cloud sync, deployment, account access, and real-device operating-system integrations are outside this local visual change.
