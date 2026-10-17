# Project: FlowTask Modern Platform, WebMCP & Zero-Warning Transformation

## Architecture
FlowTask is a high-performance offline-first local task manager and focus acceleration PWA built with React 19, TypeScript, Vite, Tailwind CSS, and Zustand. State synchronization is governed by deterministic commands (`commandService.ts`) and reactive domain stores (`useTaskStore`, `useFocusStore`, `useUIStore`). Persistence relies on IndexedDB (`flowtask_storage_v2`) with optional Firestore cloud backup.

This transformation delivers:
1. **Zero-Warning Strict Lint Standard**: Clean Oxlint & React 19 compiler compliance (0 errors, 0 warnings across all 278 files).
2. **Modern Web Platform Integration**: Native Document Picture-in-Picture (PiP), Screen Wake Lock with visibility-change re-acquisition, Media Session API OS controls, Persistent Storage quota protection, and hardware-accelerated View Transitions.
3. **Client-Side WebMCP (Model Context Protocol)**: In-browser AI assistant tool interface exposing atomic workspace actions (`createTask`, `listTodayTasks`, `startFocusSession`, `getWorkspaceStatus`) with JSON Schema validation and lifecycle unregistration.
4. **PWA Precache & Performance Optimization**: Workbox precache footprint reduction (<1.3 MB, over 50% drop from 2.5 MB) via runtime caching (`StaleWhileRevalidate`) and CSS `content-visibility: auto` layout containment.
5. **Production Deployment & UX Polish**: Vercel immutable asset caching, Node.js 22 serverless runtime, Instant Guest Workspace launcher, and Focus Studio keyboard accelerators (`C`, `F`).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Impure Date Remediation | Eliminate 4 nullary `new Date()` render evaluations via `useTodayStr()` in `FocusStudio.tsx`, `WeeklyWorkloadWidget.tsx`, `WeeklyWorkload.tsx`, `DailyPlanning.tsx` | M1 | R3 |
| F2 | Ref Mutation Remediation | Eliminate 4 ref-in-render mutations by moving assignments to `useEffect` in `InboxTriage.tsx`, `useFocusTrap.ts`, `FocusRuntime.tsx`, `FocusStudio.tsx` | M1 | R3 |
| F3 | Cascading `setState` Remediation | Eliminate 9 cascading `setState` in `useEffect` instances via `useSyncExternalStore` and derived state in `Dialog.tsx`, `QuickNotesWidget.tsx`, `DashboardEditor.tsx`, `TaskExecutionDetails.tsx`, `useStudio.ts`, `FocusStudio.tsx` | M1 | R3 |
| F4 | Hook Dependencies Alignment | Resolve 15 missing/unnecessary dependency warnings across `TimelineCanvas.tsx`, `DiagnosticsRuntime.tsx`, `FocusRuntime.tsx`, `TimelineView.tsx`, `FocusStudio.tsx` | M1 | R3 |
| F5 | Syntax & Cleanliness Cleanup | Fix unused expression in `mediaService.ts:95`, unused var in `StudyView.tsx:138`, and configure root `.oxlintrc.json` | M1 | R3 |
| F6 | Document Picture-in-Picture | Singleton PiP coordinator in `src/services/pictureInPictureService.ts`, root portal `<FocusPipPortal />`, launch triggers in `FocusMiniPlayer` & `FocusStudio`, two-way state sync with `useFocusStore`, and graceful non-Chromium fallback | M2 | R1 |
| F7 | Screen Wake Lock API | Standalone hook `src/hooks/useWakeLock.ts` with `visibilitychange` re-acquisition and cleanup; integration into active focus sessions and study sprints | M2 | R1 |
| F8 | Media Session API | `navigator.mediaSession` integration in `src/services/studioAudio.ts` with metadata (`title`, `artist`, `album`, `artwork`) and OS controls (`play`, `pause`, `stop`, `nexttrack`) | M2 | R1 |
| F9 | Persistent Storage Request | `navigator.storage.persist()` proactive quota protection in `src/services/dbService.ts` on IndexedDB initialization | M2 | R1 |
| F10 | View Transitions Wrapper | Hardware-accelerated `document.startViewTransition` helper for view switching and studio enter/exit with motion fallback | M2 | R1 |
| F11 | Client-Side WebMCP Service | `src/services/webMcpService.ts` exposing `createTask`, `listTodayTasks`, `startFocusSession`, and `getWorkspaceStatus` with JSON Schemas, parameter validation, and `AbortSignal` lifecycle unregistration | M3 | R2 |
| F12 | Workbox Precache Optimization | Update `vite.config.ts` with `globIgnores` excluding Firebase, rolldown runtime, and non-critical lazy chunks to achieve <1.3 MB precache payload | M4 | R4 |
| F13 | Firebase Runtime Caching | Configure `StaleWhileRevalidate` Workbox runtime caching for Firebase and lazy chunks loaded on-demand | M4 | R4 |
| F14 | CSS Layout Containment | Add `content-visibility: auto` with `contain-intrinsic-size` on virtual task rows and widget items with editing override | M4 | R4 |
| F15 | Vercel Deployment Config | Immutable caching headers for `/media/(.*)` and Node.js 22 LTS runtime specification in `vercel.json` | M5 | R5 |
| F16 | Guest Workspace Quick Launch | Instant "Launch Guest Workspace" CTA on `/welcome` (`WelcomePage.tsx`) routing to `/` with interactive sample tasks | M5 | R5 |
| F17 | Focus Studio Shortcuts | Keyboard accelerators `C` (Clear Mode) and `F` (Fullscreen) with text input guards and documentation in `ShortcutsModal.tsx` | M5 | R5 |
| F18 | Automated Verification & E2E Pass | 100% green unit tests (435+), zero lint warnings (`npm run lint`), build success with precache < 1.4 MB, security check pass, and Playwright E2E passing | M6 | Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | React 19 & Oxlint Zero-Warning Remediation | Fix all 49 Oxlint / React 19 compiler warnings across the 21 files; configure root `.oxlintrc.json`; verify `npm run lint` = 0 errors, 0 warnings and tests 100% green | none | DONE |
| M2 | Modern Web Platform Integration | Implement Document PiP coordinator & UI triggers, Screen Wake Lock hook, Media Session API, Persistent Storage request, and View Transitions wrapper | M1 | DONE |
| M3 | Client-Side WebMCP Tools Service | Implement `src/services/webMcpService.ts` with 4 atomic tools, JSON Schemas, parameter validation, store execution, and `AbortSignal` cleanup | M1 | IN_PROGRESS |
| M4 | Service Worker Precache, Virtualization & Bundle Optimization | Optimize `vite.config.ts` Workbox precache (<1.3 MB), configure Firebase runtime caching, and apply CSS `content-visibility: auto` containment | M1 | IN_PROGRESS |
| M5 | Vercel Production Deployment & UX Craft Polish | Update `vercel.json` (media cache headers & Node 22 runtime), add Guest Workspace CTA to `WelcomePage.tsx`, and add `C`/`F` Focus Studio shortcuts | M1 | IN_PROGRESS |
| M6 | Final Verification, Security, Precache & E2E Gates | Execute automated verification gates: `npm run lint`, `npm test`, `npm run build`, `npm run test:security`, and Playwright E2E suites | M1, M2, M3, M4, M5 | PLANNED |

---

## Interface Contracts

### 1. Document Picture-in-Picture (`src/services/pictureInPictureService.ts`)
```typescript
export interface PipSession {
  window: Window;
  close: () => void;
}

export interface PipService {
  isSupported(): boolean;
  isOpen(): boolean;
  requestPipWindow(options?: { width?: number; height?: number }): Promise<Window>;
  closePipWindow(): void;
  subscribe(listener: (isOpen: boolean) => void): () => void;
  getPipWindow(): Window | null;
}
```

### 2. Screen Wake Lock (`src/hooks/useWakeLock.ts`)
```typescript
export function useWakeLock(enabled: boolean): {
  isSupported: boolean;
  isActive: boolean;
  error: Error | null;
  release: () => Promise<void>;
  request: () => Promise<void>;
};
```

### 3. Media Session API (`src/services/studioAudio.ts`)
```typescript
export function updateMediaSessionMetadata(track: {
  title: string;
  artist?: string;
  album?: string;
  artwork?: Array<{ src: string; sizes?: string; type?: string }>;
}): void;

export function registerMediaSessionHandlers(handlers: {
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onNextTrack?: () => void;
}): void;
```

### 4. Client-Side WebMCP Service (`src/services/webMcpService.ts`)
```typescript
export interface WebMcpToolDefinition<TParams = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  execute: (params: TParams) => Promise<TResult> | TResult;
}

export interface WebMcpService {
  registerTools(signal?: AbortSignal): void;
  unregisterTools(): void;
  getTools(): WebMcpToolDefinition[];
  executeTool(name: string, params: unknown): Promise<unknown>;
}
```

### 5. View Transitions (`src/utils/viewTransitions.ts`)
```typescript
export function transitionView(updateCallback: () => void | Promise<void>): Promise<void>;
```

---

## Code Layout
- `src/services/pictureInPictureService.ts` — Document PiP window coordinator & style cloning
- `src/components/focus/FocusPipPortal.tsx` — Root portal rendering HUD into PiP window
- `src/hooks/useWakeLock.ts` — Screen Wake Lock hook with visibilitychange handling
- `src/services/studioAudio.ts` — Web Audio synthesizer with `navigator.mediaSession`
- `src/services/dbService.ts` — IndexedDB manager with `navigator.storage.persist()`
- `src/utils/viewTransitions.ts` — View transitions helper
- `src/services/webMcpService.ts` — WebMCP browser AI assistant tools registry
- `vite.config.ts` — Workbox precache exclusions & runtime caching configuration
- `vercel.json` — Edge cache headers and serverless Node.js 22 runtime
- `src/components/views/WelcomePage.tsx` — Guest workspace CTA and sample tasks
- `src/components/focus/FocusStudio.tsx` — Focus Studio shortcuts and PiP trigger
- `src/components/focus/FocusMiniPlayer.tsx` — Header mini player PiP trigger
- `.oxlintrc.json` — Oxlint rules configuration pinning plugins and suppressing false-positive export warnings
