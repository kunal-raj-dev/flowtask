# FlowTask v2 Telemetry Metrics Packet & Computation Specification

**Document Version:** 1.0.0  
**Specification Level:** Core Technical Specification  
**Architecture:** Client-Side Local Aggregation Engine

---

## 1. Architectural Philosophy: Local-First Telemetry

Traditional web applications stream raw user telemetry (mouse tracking, session replay, keystrokes, personal task strings) to remote cloud ingestion endpoints. FlowTask v2 departs fundamentally from this paradigm by computing all metrics locally in the browser runtime:

1. **Edge Computation:** Metrics calculations occur exclusively in browser client memory (`IndexedDB` + Web Workers).
2. **Deterministic Privacy:** No personal task titles, descriptions, calendar events, or project labels are ever attached to telemetry events.
3. **Differential Anonymization:** Timestamps are normalized to relative day indices ($D_1 \dots D_{14}$) and hour buckets rather than absolute epoch timestamps.

```
+--------------------------------------------------------+
| Client Application (React / Zustand / IndexedDB)       |
|                                                        |
|  [ User Action ] ---> [ Event Dispatcher ]             |
|                                |                       |
|                                v                       |
|                     [ Privacy Masking Filter ]         |
|                     (Strips all text/PII)              |
|                                |                       |
|                                v                       |
|                   [ Local Telemetry Rollup ]           |
|                   (IndexedDB: 'flowtask_telemetry')    |
|                                |                       |
|                                v                       |
|  [ User Exports Data ] <--- [ Aggregate Metrics ]      |
+--------------------------------------------------------+
```

---

## 2. Core Success Metric Mathematical Formulas

### 2.1 Daily Completion Velocity (DCV)
Measures the proportion of deliberately planned tasks that reach terminal completion on the planned date.

$$\text{DCV} = \frac{\sum_{i=1}^{N_{\text{planned}}} \mathbb{I}(\text{status}_i = \text{'done'} \land \text{completedDate}_i = \text{plannedDate}_i)}{\max(1, N_{\text{planned}})}$$

- **Target Benchmark:** $0.70 \le \text{DCV} \le 0.85$.
- **Interpretation:** $\text{DCV} > 0.95$ often signals trivial plan sizing (under-ambition), while $\text{DCV} < 0.50$ correlates directly with burnout, planning anxiety, and over-allocation.

---

### 2.2 Pacing Realism Parity (PRP)
Evaluates whether user estimates reflect grounded physical reality by comparing estimated task allocations to actual stopwatch/Pomodoro logged duration.

$$\text{PRP} = \frac{\sum_{j \in \mathcal{T}_{\text{timed}}} \text{ActualLoggedSeconds}_j}{\sum_{j \in \mathcal{T}_{\text{timed}}} \text{EstimatedSeconds}_j}$$

- **Target Benchmark:** $0.85 \le \text{PRP} \le 1.15$.
- **Interpretation:**
  - $\text{PRP} < 0.70$: Chronic overestimation or premature abandonment.
  - $\text{PRP} > 1.40$: Severe planning optimism bias / task underestimation ("planning fallacy").

---

### 2.3 Context Switch Index (CSI)
Measures workplace fragmentation and executive attention thrashing by evaluating focus task transitions per active hour.

$$\text{CSI} = \frac{\text{UniqueTaskSwitchCount}}{\max(1.0, \text{TotalActiveWorkstationHours})}$$

- **Target Benchmark:** $\text{CSI} \le 2.5 \text{ switches/hr}$.
- **Interpretation:** Lower CSI indicates deep, continuous focus blocks with minimal task interleaved overhead.

---

### 2.4 Session Continuity Rate (SCR)
Calculates the ratio of focus sessions that reached natural timer completion versus sessions cancelled or aborted mid-interval.

$$\text{SCR} = \frac{N_{\text{completed\_focus\_sessions}}}{N_{\text{completed\_focus\_sessions}} + N_{\text{interrupted\_focus\_sessions}}}$$

- **Target Benchmark:** $\text{SCR} \ge 0.80$ (80% uninterrupted completion).
- **Interpretation:** Directly measures whether focus session configurations (25m Pomodoro vs 50m deep work) match the user's operational reality.

---

### 2.5 Evening Shutdown Regularity (ESR)
Quantifies whether the user executes a clean boundary between working time and personal evening recovery.

$$\text{ESR} = \frac{\sum_{k=1}^{7} \mathbb{I}(\text{ShutdownCompleted}_k = \text{true})}{N_{\text{workdays}}}$$

- **Target Benchmark:** $\text{ESR} \ge 0.85$.

---

## 3. Client-Side Telemetry Event Schemas

Below are the canonical event payloads stored in the local aggregation store.

### Schema 1: `focus_session_completed`
```typescript
export interface FocusSessionCompletedEvent {
  eventId: string;             // UUIDv4
  eventType: 'focus_completed';
  timestampRelativeHour: number; // 0-23
  dayIndex: number;            // 1-14
  mode: 'work' | 'study' | 'sprint';
  timerPacingType: 'pomodoro' | 'fifty_ten' | 'ultradian' | 'custom';
  targetDurationSeconds: number;
  actualDurationSeconds: number;
  interrupted: boolean;
  ambientAudioActive: boolean;
  ambientSoundCategory?: 'binaural' | 'rain' | 'lofi' | 'cafe' | 'white_noise';
}
```

### Schema 2: `task_scheduled_event`
```typescript
export interface TaskScheduledEvent {
  eventId: string;
  eventType: 'task_scheduled';
  dayIndex: number;
  hasEstimatedDuration: boolean;
  estimatedMinutes?: number;
  priorityLevel: 'p1' | 'p2' | 'p3' | 'p4';
  isRecurring: boolean;
  isEveningTask: boolean;
  isStudyTask: boolean;
  subtaskCount: number;
}
```

### Schema 3: `workspace_review_recorded`
```typescript
export interface WorkspaceReviewRecordedEvent {
  eventId: string;
  eventType: 'review_recorded';
  reviewType: 'daily_shutdown' | 'weekly_review';
  dayIndex: number;
  rolloverTaskCount: number;
  completedTaskCount: number;
  moodSelfReport?: 'calm' | 'satisfied' | 'neutral' | 'fatigued' | 'overwhelmed';
  recordedDurationMinutes: number;
}
```

---

## 4. Local Aggregation Engine Pipeline

1. **Ingestion Ring Buffer:** Up to 5,000 events stored in `IndexedDB` store `flowtask_telemetry`.
2. **Rolling 7-day Computation:** When the user navigates to `InsightsView`, calculations run in a background microtask to compute:
   - Observed Focus Distribution (Deep Work vs Study vs Operational).
   - Effort Accounting Breakdown (Estimated vs Actual Focus vs Unestimated).
   - Hourly activity heatmap matrix (7 days $\times$ 24 hourly buckets).
3. **Data Portability & Export:** The telemetry packet can be downloaded as `flowtask-study-packet-<date>.json` containing only the anonymized mathematical tables for academic study review.
