import { getEffectiveTaskEstimate } from './taskTimeSummary';
import { validateNotes, recoveredNote } from './noteModel';
import { normalizeAppearance } from './appearance';
import { normalizePresentation } from './workspacePresentation';
import { normalizeStudyTemplates } from './studyTemplates';
import type { FocusLog } from "../types/task";
import type { WorkspaceRecord } from "../types/workspace";
import type { WorkspaceDashboard } from "../types/dashboard";
import { validateDashboards } from './dashboardModel';
import { parseRecipe } from "../services/studioCatalog";
import { DEFAULT_STUDIO, DEFAULT_TIMER } from "../types/studio";
import { validateAreas, validateGoals, validateRoutines, validateRoutineRuns, validateWorkBlocks, validateReviews } from './workspaceValidation';

export interface BackupExtras {
  notes?: WorkspaceRecord['notes'];
  areas?: WorkspaceRecord['areas'];
  goals?: WorkspaceRecord['goals'];
  routines?: WorkspaceRecord['routines'];
  routineRuns?: WorkspaceRecord['routineRuns'];
  workBlocks?: WorkspaceRecord['workBlocks'];
  reviews?: WorkspaceRecord['reviews'];
  habits?: WorkspaceRecord['habits'];
  preferences: Record<string, unknown>;
  customViews?: WorkspaceRecord["customViews"];
  dashboards?: WorkspaceDashboard[];
}

/** Portable user data only: active timers, checkpoints and sync operations must never replay on restore. */
export function createWorkspaceBackup(
  record: Pick<WorkspaceRecord, 'tasks' | 'projects' | 'preferences' | 'customViews' | 'dashboards' | 'notes'> &
    Partial<Pick<WorkspaceRecord, 'areas' | 'goals' | 'routines' | 'routineRuns' | 'workBlocks' | 'reviews' | 'habits'>>,
  options?: { schemaVersion?: 8 | 9 }
) {
  const preferences = Object.fromEntries(Object.entries(record?.preferences && typeof record.preferences === 'object' ? record.preferences : {}).filter(([key]) =>
    !key.startsWith('_') && !['focusSession', 'focusCheckpointAt', 'studioLastSession', 'studioSummaryDismissed'].includes(key)));
  const taskIds = new Set((record?.tasks || []).map(task => task.id));
  const validWorkBlocks = (record?.workBlocks || []).filter(block => taskIds.has(block.taskId));
  const schemaVer = options?.schemaVersion ?? ((record?.workBlocks && record.workBlocks.length > 0) ? 9 : 8);
  return {
    schemaVersion: schemaVer,
    version: schemaVer,
    notes: validateNotes(record?.notes || []),
    areas: validateAreas(record?.areas || []),
    goals: validateGoals(record?.goals || []),
    routines: validateRoutines(record?.routines || []),
    routineRuns: validateRoutineRuns(record?.routineRuns || []),
    workBlocks: validateWorkBlocks(validWorkBlocks, taskIds),
    reviews: validateReviews(record?.reviews || []),
    habits: record?.habits || [],
    tasks: (record?.tasks || []).map(task => { const estimate = getEffectiveTaskEstimate(task); return estimate ? { ...task, estimatedMinutes: estimate } : task; }),
    projects: record?.projects || [],
    dashboards: record?.dashboards || [],
    preferences,
    customViews: record?.customViews || [],
    mediaNote: 'Personal image/audio files are excluded. Export them separately from Focus Studio.',
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
/** A backup may contain private device preferences, but never restore a running timer or sync queue. */
export function validateBackupExtras(raw: unknown): BackupExtras | undefined {
  if (!object(raw) || (!("preferences" in raw) && !("customViews" in raw) && !("dashboards" in raw) && !("notes" in raw) && !("areas" in raw) && !("goals" in raw) && !("routines" in raw) && !("routineRuns" in raw) && !("workBlocks" in raw) && !("reviews" in raw) && !("habits" in raw)))
    return undefined;
  if ((typeof raw.schemaVersion === 'number' && raw.schemaVersion > 9) || (typeof raw.version === 'number' && raw.version > 9)) throw new Error('This backup requires a newer FlowTask version.');
  const prefs = raw.preferences;
  if (prefs !== undefined && !object(prefs))
    throw new Error("Backup preferences must be an object.");
  const preferences: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(prefs || {})) {
    if (
      key.startsWith("_") ||
      ["constructor", "prototype"].includes(key) ||
      ["focusSession", "focusCheckpointAt", "studioLastSession", "studioSummaryDismissed"].includes(
        key,
      )
    )
      continue;
    if (
      ["settings", "appearance", "studio", "profile", "workspace"].includes(key) &&
      !object(value)
    )
      throw new Error(`Invalid ${key} preferences.`);
    preferences[key] = value;
  }
  if (preferences.focusRecipes !== undefined) {
    if (
      !Array.isArray(preferences.focusRecipes) ||
      preferences.focusRecipes.length > 500
    )
      throw new Error("Invalid recipe collection.");
    const recipeIds = new Set<string>();
    preferences.focusRecipes = preferences.focusRecipes.map((value) => {
      if (
        !object(value) ||
        typeof value.id !== "string" ||
        !/^[^/\s]{1,200}$/.test(value.id) || recipeIds.has(value.id)
      )
        throw new Error("Invalid recipe ID.");
      recipeIds.add(value.id);
      return {
        ...parseRecipe(JSON.stringify(value)),
        id: value.id,
        sceneId: value.sceneId,
        musicId: value.musicId,
        breakSceneId:
          typeof value.breakSceneId === "string"
            ? value.breakSceneId.slice(0, 150)
            : "",
        favorite: Boolean(value.favorite),
      };
    });
  }
  if (preferences.studio) {
    const studio = preferences.studio as Record<string, unknown>;
    // Use the recipe validator for the shared timer/mixer shape, without importing private task content.
    parseRecipe(
      JSON.stringify({
        ...DEFAULT_STUDIO,
        ...studio,
        id: "check",
        name: "Preferences",
        description: "",
        timer: {
          ...DEFAULT_TIMER,
          ...(object(studio.timer) ? studio.timer : {}),
        },
      }),
    );
    for (const field of ["favorites", "recent", "queue"])
      if (
        studio[field] !== undefined &&
        (!Array.isArray(studio[field]) ||
          (studio[field] as unknown[]).some((v) => typeof v !== "string") ||
          (studio[field] as unknown[]).length > 1000)
      )
        throw new Error(`Invalid Studio ${field}.`);
    for (const [field, max] of [
      ["masterVolume", 1],
      ["overlay", 1],
      ["brightness", 1.5],
      ["blur", 20],
      ["focalX", 100],
      ["focalY", 100],
    ] as const)
      if (
        studio[field] !== undefined &&
        (typeof studio[field] !== "number" ||
          !Number.isFinite(studio[field]) ||
          (studio[field] as number) < 0 ||
          (studio[field] as number) > max)
      )
        throw new Error(`Invalid Studio ${field}.`);
  }
  if (preferences.appearance) preferences.appearance = normalizeAppearance(preferences.appearance);
  if (object(preferences.workspace)) {
    const templates = preferences.workspace.studyTemplates;
    if (templates !== undefined) {
      const normalized = normalizeStudyTemplates(templates);
      if (!Array.isArray(templates) || normalized.length !== templates.length) throw new Error('Invalid study templates in backup.');
      preferences.workspace.studyTemplates = normalized;
    }
    const { presentation, ...rest } = preferences.workspace;
    const safe = normalizePresentation(presentation);
    preferences.workspace = { ...rest, ...(safe ? { presentation: safe } : {}) };
  }
  if (preferences.focusLogs !== undefined) {
    if (
      !Array.isArray(preferences.focusLogs) ||
      preferences.focusLogs.length > 100000
    )
      throw new Error("Invalid focus history.");
    const ids = new Set();
    for (const entry of preferences.focusLogs as FocusLog[]) {
      if (
        !object(entry) ||
        typeof entry.id !== "string" ||
        !/^[^/\s]{1,200}$/.test(entry.id) ||
        ids.has(entry.id) ||
        !Number.isFinite(entry.seconds) ||
        entry.seconds < 0 ||
        !Number.isFinite(entry.startedAt) ||
        !Number.isFinite(entry.endedAt) ||
        (entry.phase !== undefined &&
          !["focus", "short_break", "long_break"].includes(entry.phase))
      )
        throw new Error("Invalid or duplicate focus history entry.");
      ids.add(entry.id);
    }
  }
  if (
    raw.customViews !== undefined &&
    (!Array.isArray(raw.customViews) ||
      raw.customViews.some(
        (v) =>
          !object(v) ||
          typeof v.id !== "string" ||
          typeof v.name !== "string" ||
          !object(v.predicate),
      ))
  )
    throw new Error("Invalid saved views.");

  let dashboards: WorkspaceDashboard[] = [];
  if (raw.dashboards !== undefined) {
    if (!Array.isArray(raw.dashboards) || raw.dashboards.length > 20)
      throw new Error("Invalid dashboards collection.");
    const dashIds = new Set<string>();
    dashboards = raw.dashboards.map((d: unknown) => {
      if (
        !object(d) ||
        typeof d.id !== "string" ||
        !/^[^/\s]{1,200}$/.test(d.id) ||
        dashIds.has(d.id) ||
        typeof d.name !== "string" ||
        !Array.isArray(d.widgets) ||
        d.widgets.length > 24 ||
        !object(d.layouts)
      ) {
        throw new Error("Invalid dashboard definition.");
      }
      dashIds.add(d.id);
      return validateDashboards([d])[0];
    });
  }

  const areas = Array.isArray(raw.areas) ? validateAreas(raw.areas) : undefined;
  const goals = Array.isArray(raw.goals) ? validateGoals(raw.goals) : undefined;
  const routines = Array.isArray(raw.routines) ? validateRoutines(raw.routines) : undefined;
  const routineRuns = Array.isArray(raw.routineRuns) ? validateRoutineRuns(raw.routineRuns) : undefined;
  const workBlocks = Array.isArray(raw.workBlocks) ? validateWorkBlocks(raw.workBlocks) : undefined;
  const reviews = Array.isArray(raw.reviews) ? validateReviews(raw.reviews) : undefined;
  const habits = Array.isArray(raw.habits) ? (raw.habits as WorkspaceRecord['habits']) : undefined;

  return {
    notes: validateNotes(raw.notes),
    areas,
    goals,
    routines,
    routineRuns,
    workBlocks,
    reviews,
    habits,
    preferences,
    customViews: (raw.customViews || []) as WorkspaceRecord["customViews"],
    dashboards,
  };
}

export function mergeBackupExtras(
  before: BackupExtras,
  incoming: BackupExtras,
  replace: boolean,
): BackupExtras {
  if (replace) return incoming;
  const preferences = { ...before.preferences, ...incoming.preferences };
  for (const key of ["focusLogs", "focusRecipes"]) {
    const map = new Map<string, { id: string }>();
    for (const item of [
      ...((before.preferences[key] || []) as { id: string }[]),
      ...((incoming.preferences[key] || []) as { id: string }[]),
    ])
      if (!map.has(item.id)) map.set(item.id, item);
    preferences[key] = [...map.values()];
  }
  const dashboardMap = new Map<string, WorkspaceDashboard>();
  const notes = new Map((before.notes || []).map(note => [note.id, note]));
  for (const note of incoming.notes || []) {
    const existing = notes.get(note.id);
    if (!existing) notes.set(note.id, note);
    else if (existing.body !== note.body || existing.title !== note.title) {
      // An import never overwrites a different local text with the same ID.
      const copy = recoveredNote(note);
      if (![...notes.values()].some(n => n.title === copy.title && n.body === copy.body)) notes.set(copy.id, copy);
    }
  }

  // Conflict handling with relationship remapping for Areas
  const areaRemap = new Map<string, string>();
  const areas = new Map((before.areas || []).map(a => [a.id, a]));
  for (const a of incoming.areas || []) {
    const existing = areas.get(a.id);
    if (!existing) {
      areas.set(a.id, a);
    } else if (existing.name !== a.name) {
      const newId = crypto.randomUUID();
      areaRemap.set(a.id, newId);
      areas.set(newId, { ...a, id: newId, name: `${a.name} (Imported)` });
    }
  }

  // Conflict handling with relationship remapping for Goals
  const goals = new Map((before.goals || []).map(g => [g.id, g]));
  for (const g of incoming.goals || []) {
    const targetAreaId = g.areaId && areaRemap.has(g.areaId) ? areaRemap.get(g.areaId) : g.areaId;
    const adjustedGoal = targetAreaId !== g.areaId ? { ...g, areaId: targetAreaId } : g;
    const existing = goals.get(g.id);
    if (!existing) {
      goals.set(g.id, adjustedGoal);
    } else if (existing.title !== g.title) {
      const newId = crypto.randomUUID();
      goals.set(newId, { ...adjustedGoal, id: newId, title: `${adjustedGoal.title} (Imported)` });
    }
  }

  const routines = new Map((before.routines || []).map(r => [r.id, r]));
  for (const r of incoming.routines || []) {
    const existing = routines.get(r.id);
    if (!existing) {
      routines.set(r.id, r);
    } else if (existing.title !== r.title) {
      const newId = crypto.randomUUID();
      routines.set(newId, { ...r, id: newId, title: `${r.title} (Imported)` });
    }
  }

  const routineRuns = new Map((before.routineRuns || []).map(r => [r.id, r]));
  for (const r of incoming.routineRuns || []) {
    if (!routineRuns.has(r.id)) routineRuns.set(r.id, r);
  }

  const workBlocks = new Map((before.workBlocks || []).map(w => [w.id, w]));
  for (const w of incoming.workBlocks || []) {
    const existing = workBlocks.get(w.id);
    if (!existing) {
      workBlocks.set(w.id, w);
    } else if (
      (typeof w.revision === 'number' && typeof existing.revision === 'number' && w.revision > existing.revision) ||
      (typeof w.updatedAt === 'number' && typeof existing.updatedAt === 'number' && w.updatedAt > existing.updatedAt)
    ) {
      workBlocks.set(w.id, w);
    }
  }

  const reviews = new Map((before.reviews || []).map(r => [r.id, r]));
  for (const r of incoming.reviews || []) {
    if (!reviews.has(r.id)) reviews.set(r.id, r);
  }

  const habits = new Map((before.habits || []).map(h => [h.id, h]));
  for (const h of incoming.habits || []) {
    if (!habits.has(h.id)) habits.set(h.id, h);
  }

  for (const d of [...(before.dashboards || []), ...(incoming.dashboards || [])]) {
    if (!dashboardMap.has(d.id)) dashboardMap.set(d.id, d);
  }

  return {
    notes: [...notes.values()],
    areas: [...areas.values()],
    goals: [...goals.values()],
    routines: [...routines.values()],
    routineRuns: [...routineRuns.values()],
    workBlocks: [...workBlocks.values()],
    reviews: [...reviews.values()],
    habits: [...habits.values()],
    preferences,
    customViews: [
      ...(before.customViews || []),
      ...(incoming.customViews || []).filter(
        (v) => !(before.customViews || []).some((old) => old.id === v.id),
      ),
    ],
    dashboards: validateDashboards([...dashboardMap.values()]),
  };
}
