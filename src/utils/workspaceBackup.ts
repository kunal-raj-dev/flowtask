import { getEffectiveTaskEstimate } from './taskTimeSummary';
import { normalizeAppearance } from './appearance';
import { normalizePresentation } from './workspacePresentation';
import type { FocusLog } from "../types/task";
import type { WorkspaceRecord } from "../types/workspace";
import type { WorkspaceDashboard } from "../types/dashboard";
import { validateDashboards } from './dashboardModel';
import { parseRecipe } from "../services/studioCatalog";
import { DEFAULT_STUDIO, DEFAULT_TIMER } from "../types/studio";

export interface BackupExtras {
  preferences: Record<string, unknown>;
  customViews?: WorkspaceRecord["customViews"];
  dashboards?: WorkspaceDashboard[];
}

/** Portable user data only: active timers, checkpoints and sync operations must never replay on restore. */
export function createWorkspaceBackup(record: Pick<WorkspaceRecord, 'tasks' | 'projects' | 'preferences' | 'customViews' | 'dashboards'>) {
  const preferences = Object.fromEntries(Object.entries(record.preferences).filter(([key]) =>
    !key.startsWith('_') && !['focusSession', 'focusCheckpointAt', 'studioLastSession', 'studioSummaryDismissed'].includes(key)));
  return { schemaVersion: 6, version: 6, tasks: record.tasks.map(task => { const estimate = getEffectiveTaskEstimate(task); return estimate ? { ...task, estimatedMinutes: estimate } : task; }), projects: record.projects, dashboards: record.dashboards,
    preferences, customViews: record.customViews,
    mediaNote: 'Personal image/audio files are excluded. Export them separately from Focus Studio.' };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
/** A backup may contain private device preferences, but never restore a running timer or sync queue. */
export function validateBackupExtras(raw: unknown): BackupExtras | undefined {
  if (!object(raw) || (!("preferences" in raw) && !("customViews" in raw) && !("dashboards" in raw)))
    return undefined;
  if ((typeof raw.schemaVersion === 'number' && raw.schemaVersion > 6) || (typeof raw.version === 'number' && raw.version > 6)) throw new Error('This backup requires a newer FlowTask version.');
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

  return {
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
  for (const d of [...(before.dashboards || []), ...(incoming.dashboards || [])]) {
    if (!dashboardMap.has(d.id)) dashboardMap.set(d.id, d);
  }
  return {
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
