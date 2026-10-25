# FlowTask Product Upgrade Plan #2: Next-Generation Capabilities & Technical Specifications

**Document ID:** PLAN-R2-2026-10-25-COMPREHENSIVE  
**Publication Date:** 25 October 2026  
**Research Series:** Research #2 (Next-Generation Productivity, Planning & Life Systems)  
**Strict Scope Boundary:** All capabilities previously researched, planned, and implemented in Wave 1 (Connected Notes, baseline task models, existing Pomodoro timers, and legacy theme styling) are **strictly excluded** from this document.  
This specification details the architecture, data models, state stores, and implementation blueprints for the **new missing capabilities** required to upgrade FlowTask to world-class 2026 standards.

---

## 1. System Architecture & Modular Taxonomy

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FLOWTASK WORKSTATION 2.0                                │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│ U-R2-01: INTERACTIVE     │ U-R2-02: TACTILE SOUND &    │ U-R2-03: LIFE OS ARCHITECTURE │
│ TIMEBLOCKING & CALENDARS │ KEYBOARD POWER MODE         │ (AREAS, GOALS & LIFE ADMIN)   │
│ • 2-Way Multi-Cal Sync   │ • Mechanical Earcon Engine  │ • Hierarchical Life Areas     │
│ • Drag-to-Grid (15m snap)│ • Vim Navigation (j/k, x, d)│ • Vision & Quarterly Goals    │
│ • Privacy Shield (Busy)  │ • Spring Vector Checkmarks  │ • Life Admin Checklists       │
├──────────────────────────┼─────────────────────────────┼───────────────────────────────┤
│ U-R2-04: EXECUTIVE       │ U-R2-05: CIRCADIAN ENERGY   │ U-R2-06: OMNICHANNEL CAPTURE  │
│ DYSFUNCTION SCAFFOLDING  │ RHYTHM SCHEDULING           │ & COMMAND CENTER 2.0          │
│ • "Just 10 Minutes" Mode │ • Cognitive Load Tagging    │ • Global Desktop/Browser HUD  │
│ • Visual Countdown Pie   │ • Circadian Curve Overlay   │ • Unified Cmd+K Search Index  │
│ • Non-Punitive Routines  │ • Peak vs Trough Placement  │ • Mobile Share Target API     │
├──────────────────────────┴─────────────────────────────┴───────────────────────────────┤
│ NEW FRONTIERS ADDED IN EXPANDED SPECIFICATION:                                         │
│ • U-R2-07: Defer vs Due Date Engine & Sequential Project Pipelines (OmniFocus 4)       │
│ • U-R2-08: The "Clean Slate" Backlog Quarantine & Opacity Decay Engine                 │
│ • U-R2-09: Estimation Bias Calibration Engine (Ellie Planner Standard)                 │
│ • U-R2-10: Procrastination Diagnostic Wizard (Amazing Marvin CBT Standard)             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Granular Module Specifications & Data Models

### Module U-R2-01: Interactive Multi-Calendar Timeblocking & Multi-Account Privacy Shield
*Benchmark: Notion Calendar (Cron), Sunsama, Vimcal*

#### Functional Requirements:
1. **Interactive Calendar Grid Component (`<CalendarTimeGrid />`):**
   - 1-day, 3-day, and 7-day multi-calendar grid (hourly lines 7:00 AM to 10:00 PM, customizable).
   - Dragging a task onto the grid locks it into a time slot with **magnetic snapping** to 15-minute or 30-minute intervals.
   - Resizing edge handles dynamically updates block duration with tabular monospace indicators.
2. **Multi-Account Synchronization & The Privacy Shield:**
   - 2-way sync with Google Calendar, Microsoft Outlook, and Apple iCloud CalDAV.
   - When a personal task is scheduled, FlowTask can write an anonymized "Busy" event to the user's corporate calendar, defending their time without exposing private details.

#### Data Model:
```typescript
export interface CalendarAccount {
  id: string;
  provider: 'google' | 'microsoft' | 'apple_caldav';
  email: string;
  name: string;
  color: string;
  syncEnabled: boolean;
  isWorkCalendar: boolean; // Target for privacy shield
  refreshToken: string;
}

export interface TimeBlock {
  id: string;
  taskId?: string;
  calendarAccountId?: string;
  externalEventId?: string;
  title: string;
  start: string; // ISO 8601 UTC
  end: string;   // ISO 8601 UTC
  isLocked: boolean; // Protected from auto-rescheduling
  isPrivacyShielded: boolean;
  bufferMinutesBefore?: number;
  bufferMinutesAfter?: number;
}
```

---

### Module U-R2-02: Tactile Micro-Interactions, Acoustic Earcons & Workstation Navigation
*Benchmark: Superlist, Things 3, Linear*

#### Web Audio FM Synthesis Implementation:
A zero-dependency acoustic earcon engine (`src/services/audioEngine.ts`):

```typescript
class AudioEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  public playTaskComplete() {
    if (!this.isEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    // Ascending arpeggio: E5 (659Hz) -> G#5 (830Hz) -> B5 (987Hz) -> E6 (1318Hz)
    const pitches = [659.25, 830.61, 987.77, 1318.51];
    pitches.forEach((freq, idx) => {
      const startTime = this.ctx!.currentTime + idx * 0.038;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // ADSR Envelope
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.003); // Attack 3ms
      gain.gain.exponentialRampToValueAtTime(0.04, startTime + 0.068); // Decay to sustain
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35); // Release

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  public playDeferWoodblock() {
    if (!this.isEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const startTime = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, startTime); // D5

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750, startTime);
    filter.Q.setValueAtTime(1.4, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.22, startTime + 0.016); // Soft felt attack
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.19);
  }
}

export const audioEngine = new AudioEngine();
```

---

### Module U-R2-03: Life OS Architecture: Areas, Vision Goals & Life Admin
*Benchmark: Craft, Things 3, Capacities*

#### Data Models:
```typescript
export interface LifeArea {
  id: string;
  name: string;
  icon: string; // Emoji or Lucide icon token
  color: string;
  sortOrder: number;
  isArchived: boolean;
}

export interface VisionGoal {
  id: string;
  areaId: string;
  title: string;
  description?: string;
  targetQuarter: string; // e.g. "2026-Q4"
  status: 'not_started' | 'in_progress' | 'achieved' | 'deferred';
  connectedProjectIds: string[];
}

export interface LifeAdminItem {
  id: string;
  title: string;
  category: 'vehicle' | 'legal_tax' | 'health' | 'home' | 'warranties';
  recurrenceIntervalMonths: number; // e.g. 12 for annual
  lastCompletedDate?: string;
  nextDueDate: string;
  attachedNoteId?: string;
}
```

---

### Module U-R2-04: Executive Function & Neurodivergent Flow Scaffolding
*Benchmark: Llama Life, Tiimo, Routinery*

#### Functional Requirements:
1. **The "Just 10 Minutes" Mode:**
   - Single-task immersion that guarantees permission to quit after 10 minutes.
   - Soft chime at 10m: *"Great start! Continue for 15m, or take a break?"*
2. **Visual Circular Countdown Pie Timer (`<VisualPieTimer />`):**
   - Renders a continuous, clockwise-emptying SVG ring to visually convey time passing.
3. **Paced Routine Runner:**
   - Ordered micro-step execution for Morning, Midday, and Evening rituals.
   - Non-punitive messaging: *"Ready when you are"* instead of broken streak warnings.

---

### Module U-R2-05: Circadian Energy Rhythm Scheduling
*Benchmark: Rise Science, Ample*

#### Functional Requirements:
- Tasks are tagged with cognitive energy demands:
  - 🧠 `Deep Work / High Cognitive`
  - ⚡ `Medium Energy`
  - ☕ `Shallow Admin / Low Cognitive`
- The system renders a sinusoidal circadian wave across the daily timeline (Morning Dip $\to$ Morning Peak $\to$ Afternoon Lull $\to$ Evening Rebound $\to$ Sleep Window), alerting users when complex tasks overlap with biological energy troughs.

---

### Module U-R2-06: Omnichannel Capture & Universal Command Center 2.0
*Benchmark: Akiflow, Raycast, Superlist*

#### Functional Requirements:
- **Global Floating HUD (`Option + Space`):** Floating frosted-glass input bar with live NLP token chips (`[📅 Tomorrow]`, `[⏳ 45m]`, `[📁 Project]`).
- **Unified Command Center 2.0 (`Cmd + K`):** Fast fuzzy search across tasks, notes, projects, areas, goals, and actions with sub-30ms response times.
- **Mobile Share Target API:** Native PWA receiver for links, text, and media.

---

### Module U-R2-07: Defer vs. Due Temporal Engine & Sequential Pipelines
*Benchmark: OmniFocus 4*

#### Functional Requirements:
1. **Strict Temporal Segregation:**
   - Tasks possess both `deferUntil` (invisible in "Available" view until threshold) and `dueDate` (hard deadline).
2. **Sequential Project Dependency Pipelines:**
   - In a sequential project, Action $N+1$ cannot become actionable until Action $N$ is completed.

```typescript
export interface SequentialTaskMetadata {
  deferUntil?: string; // ISO 8601 UTC
  isBlockedByPredecessor: boolean;
  predecessorTaskId?: string;
  projectExecutionMode: 'parallel' | 'sequential';
}
```

---

### Module U-R2-08: The "Clean Slate" Backlog Quarantine & Opacity Decay Engine
*Benchmark: Anti-Burnout / Churn Prevention*

#### Functional Requirements:
1. **Visual Opacity Decay:**
   Tasks deferred multiple times naturally fade in opacity:
   $$\text{Opacity}(\text{task}) = \max\left(0.40, \; 1.0 - 0.12 \times \text{DeferCount}\right)$$
2. **The "Clean Slate" Reset Chamber:**
   When overdue tasks exceed 15, FlowTask renders a warm, non-judgmental banner: *"Life happened. Want a Clean Slate?"* allowing 1-click archiving of stale tasks to the "Someday Parking Lot".

---

### Module U-R2-09: Estimation Bias Calibration Engine
*Benchmark: Ellie Planner*

#### Functional Requirements:
- Tracks planned vs. actual duration per task:
  $$R_{\text{bias}} = \frac{\sum T_{\text{actual}}}{\sum T_{\text{estimated}}}$$
- If $R_{\text{bias}} = 1.45$, the scheduling UI displays a smart warning: *"You typically need 43m for 30m estimates. Adjust block?"*

---

### Module U-R2-10: Procrastination Diagnostic Wizard
*Benchmark: Amazing Marvin (CBT Triage)*

#### Functional Requirements:
Clicking "Procrastinating?" on an avoided task opens a 3-step diagnostic flow:
- **Overwhelmed?** $\to$ Auto-break down into 3 five-minute micro-tasks.
- **Averse / Bored?** $\to$ Launch the 5-Minute Dash sprint.
- **Perfectionism?** $\to$ Open "Ugly First Draft" stream-of-consciousness scratchpad.

---

## 3. Phased Implementation Roadmap

### Milestone A: Workstation Velocity & Tactile Polish
- **Deliverables:**
  1. `<CalendarTimeGrid />` drag-and-drop time-blocking with 15m/30m magnetic snap.
  2. Web Audio FM Earcon Engine (`audioEngine.ts`).
  3. Single-key Vim workstation navigation (`j`/`k`, `Space`, `d`, `t`, `p`, `e`, `c`, `f`).
  4. Spring-based micro-interactions and 3-tier density toggles (Compact, Default, Spacious).
- **Verification:** Sub-16ms grid scheduling, zero audio clipping, full keyboard accessibility.

### Milestone B: Life Architecture & Executive Scaffolding
- **Deliverables:**
  1. Life Areas navigation and Vision & Quarterly Goals cascade.
  2. "Just 10 Minutes" mode and `<VisualPieTimer />`.
  3. Paced routine runner with non-punitive messaging.
  4. The "Clean Slate" Backlog Quarantine & Opacity Decay Engine.
- **Verification:** Seamless project/note assignment to Life Areas; flawless routine progression across timezones.

### Milestone C: Cognitive Intelligence & Omnichannel Capture
- **Deliverables:**
  1. Multi-account calendar sync with privacy shield ("Busy" blocks).
  2. Estimation Bias Calibration Engine ($R_{\text{bias}}$).
  3. Cognitive load classification and circadian energy curve overlay.
  4. Floating Quick-Capture HUD (`Option + Space`) and Command Center 2.0 (`Cmd + K`).
  5. Defer vs. Due temporal engine and sequential project pipelines.
- **Verification:** 10,000+ entity fuzzy search in under 30ms; zero duplicate events across Google/Outlook; accurate estimation calibration.
