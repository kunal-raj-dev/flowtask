# FlowTask v2 Cohort Study Protocol & Evaluation Methodology

**Document Version:** 1.0.0  
**Status:** Canonical Reference  
**Scope:** Human-subject field validation for FlowTask v2 (Milestones M3 & M4)

---

## 1. Executive Summary & Study Objectives

This protocol establishes the empirical framework for evaluating FlowTask v2 in real-world professional and academic settings. FlowTask represents a local-first productivity workstation designed to eliminate planning anxiety, minimize cognitive friction, and facilitate sustainable flow states.

### Core Hypotheses
1. **Hypothesis 1 (Cognitive Load Reduction):** Guided daily capacity planning and honest effort feedback significantly reduce end-of-day cognitive fatigue (measured via NASA-TLX) compared to open-ended backlog management tools.
2. **Hypothesis 2 (Pacing Realism):** Grounding planned commitments against actual recorded focus duration narrows the intention-action gap, driving realistic plan sizing within 10 days of continuous use.
3. **Hypothesis 3 (Neurodivergent Ergonomics):** Calibrated low-friction capture (NLP parser), deliberate quiet hours, and progressive step breakdowns provide measurable anxiety attenuation for ADHD and executive function impaired users.

---

## 2. Participant Cohort Stratification

The evaluation study utilizes a diverse, stratified sample of $N = 48$ participants divided across 4 distinct user archetypes ($n = 12$ per cohort).

### Cohort Archetypes

| Cohort | Target Profile | Dominant Pain Points | Primary FlowTask Modality |
| :--- | :--- | :--- | :--- |
| **A: Software Engineers & Tech Leads** | Knowledge workers juggling PR reviews, deep coding sprints, and ad-hoc interruptions. | Context switching fragmentation, over-committing sprint tasks. | Focus Studio, Keyboard Accelerator Rail, Workspace Pacing. |
| **B: Graduate & Medical Students** | High-volume curriculum learners with multi-hour continuous revision blocks. | Exam cram exhaustion, passive vs active recall tracking. | Study Mode (Pomodoro / 50-10 / 90-min ultradian cycles), Subject tagging. |
| **C: Independent Creators & Freelancers** | Solo operators handling client delivery, administrative overhead, and billing. | Blurry work-life boundaries, lack of shutdown ritual. | Life Areas & Goals, Evening Shutdown ritual, CSV invoicing export. |
| **D: Neurodivergent / ADHD Adults** | Adults with clinically confirmed or self-reported executive dysfunction. | Task initiation paralysis, time blindness, sensory overload. | Step-breakdown Granularity slider, Ambient soundscapes, Diurnal light theme. |

### Inclusion Criteria
- Age 18–65, active computer usage $\ge 25$ hours/week.
- Currently using at least one digital task manager or calendar (Todoist, Notion, TickTick, Apple Reminders, Google Calendar).
- Willingness to maintain study journals and complete daily check-ins for 14 consecutive calendar days.

### Exclusion Criteria
- Mandatory corporate employer surveillance software requiring keystroke logging or blocking local storage.
- Inability to use modern web browsers (Chrome/Chromium 120+, Edge 120+, Firefox 120+, Safari 17+).

---

## 3. 14-Day Evaluation Protocol

The study follows an A/B within-subject longitudinal design across two 7-day phases:

```
[Day -2 .. 0]   Onboarding, baseline setup & pre-study questionnaire
[Day 1 .. 7]    Phase 1: Baseline Week (Existing tools + baseline telemetry)
[Day 8 .. 14]   Phase 2: FlowTask v2 Intervention Week
[Day 15 .. 16]  Post-study comprehensive reassessment & exit interviews
```

### Protocol Execution Details

#### Days 1–7 (Phase 1: Control Baseline)
- Participants continue using their established workflow tools (e.g., Todoist, Apple Notes, Google Calendar).
- Each evening at 18:00, participants complete a 2-minute daily reflection recording:
  - Total planned tasks vs completed tasks.
  - Subjective estimation accuracy (1–5 scale).
  - NASA-TLX Mental Demand and Frustration subscales.

#### Day 7 (Transition & Onboarding)
- Participants attend a 15-minute standardized video walkthrough of FlowTask v2:
  - 1-task zero-state onboarding.
  - Daily capacity target configuration (default: 6.0 hours).
  - Focus Studio scene & ambient audio selection.
  - Evening shutdown ritual.

#### Days 8–14 (Phase 2: FlowTask v2 Workstation)
- Participants migrate daily planning to FlowTask v2 as their primary driver.
- External meetings connected via read-only .ics / webcal calendar feeds.
- Automated client-side telemetry tracks session completion, pacing parity, and shutdown adherence.
- Evening shutdown executed daily via FlowTask modal (`daily_shutdown` workspace review).

---

## 4. Qualitative Survey Instrumentation

### 4.1 NASA Task Load Index (NASA-TLX)
Administered daily at day completion and aggregated across 6 dimensions (0–100 scale):
1. **Mental Demand:** How much mental and perceptual activity was required?
2. **Temporal Demand:** How much time pressure did you feel due to the pace of tasks?
3. **Performance:** How satisfied were you with what you achieved?
4. **Effort:** How hard did you have to work to accomplish your level of performance?
5. **Frustration:** How insecure, discouraged, irritated, or stressed did you feel?
6. **Executive Load:** How difficult was task initiation and sequencing?

### 4.2 System Usability Scale (SUS)
Administered on Day 15 (10 standard Likert questions, scored 0–100). Target benchmark for release readiness: $\ge 82.5$ (Grade A).

### 4.3 Pacing Realism & Emotional Calm Index (FT-PRECI)
A custom 5-item scale tailored to local-first planning:
- "The tool prevented me from scheduling an impossible workday."
- "I finished my workday with a clear mental boundary."
- "The interface did not induce guilt over uncompleted tasks."
- "Ambient sound and studio visuals helped me sustain focus without distraction."
- "My task data felt completely private and under my control."

---

## 5. Quantitative Telemetry Endpoints

All telemetry is aggregated strictly on the participant's device inside IndexedDB. Telemetry packets are anonymized and summarized at study conclusion:

| Metric Code | Full Metric Title | Telemetry Source | Unit |
| :--- | :--- | :--- | :--- |
| **DCV** | Daily Completion Velocity | Tasks marked done / Total planned tasks | Ratio (0.00–1.00) |
| **PRP** | Pacing Realism Parity | Actual recorded focus seconds / Planned duration seconds | Ratio ($\approx 1.00$ ideal) |
| **SBR** | Step Breakdown Rate | Tasks broken down via granularity slider / Total complex tasks | Percentage |
| **CSI** | Context Switch Index | Task focus switches per active working hour | Count/hr |
| **FAR** | Focus Session Abandonment | Interrupted focus logs / Total started focus sessions | Percentage |
| **ESR** | Evening Shutdown Regularity | Days completed shutdown / Total active working days | Percentage |

---

## 6. Informed Consent, Ethical Safeguards & Privacy Guarantee

FlowTask adheres to zero-compromise local-first privacy:
1. **Zero Text Leakage:** Task titles, notes, subtask contents, project names, and notes NEVER leave the user's browser.
2. **Aggregate Telemetry Only:** Telemetry export contains purely mathematical counts, durations, and state transitions (e.g., `{ "event": "focus_completed", "duration_minutes": 25, "pacing_ratio": 0.92 }`).
3. **Explicit Opt-in Consent:** Cloud sync is strictly optional. Users can run the entire 14-day study in 100% offline anonymous mode, exporting their study JSON packet via a single click on Day 15.
4. **Right to Erase:** Participants can purge all local IndexedDB data and cached calendar feeds at any point via Settings > Data & Privacy > Reset Defaults or indexedDB clear.
