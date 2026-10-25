import { normalizeAppearance } from '../utils/appearance';
import { validateNotes } from '../utils/noteModel';
import type {
  WorkspaceRecord,
  SyncCollection,
  SyncedEntity,
  EntityChange,
  SyncedPreference,
} from "../types/workspace";
import type { FocusLog } from "../types/task";
import type { FocusRecipe } from "../types/studio";
import { normalizeDashboard } from '../utils/dashboardModel';
import { normalizePresentation } from '../utils/workspacePresentation';

export const SYNC_COLLECTIONS: SyncCollection[] = [
  "tasks",
  "projects",
  "dashboards",
  "focusLogs",
  "recipes",
  "preferences",
  "notes",
];
export const SYNC_PREFERENCE_KEYS = [
  "settings",
  "appearance",
  "studio",
  "templates",
  "customViews",
  "profile",
  "workspace",
] as const;
// Device-local playback, personal blobs, feed URLs and scratchpads never leave this device here.
export function safePreference(key: string, value: unknown): unknown {
  if (key === 'appearance') return normalizeAppearance(value);
  if (key === 'workspace' && value && typeof value === 'object') {
    const { pinnedDestinations, viewDisplaySettings, defaultDashboardId, showCovers, presentation } = value as Record<string, unknown>;
    const safePresentation = normalizePresentation(presentation);
    return { ...(pinnedDestinations ? { pinnedDestinations } : {}), ...(viewDisplaySettings ? { viewDisplaySettings } : {}), ...(defaultDashboardId ? { defaultDashboardId } : {}), ...(typeof showCovers === 'boolean' ? { showCovers } : {}), ...(safePresentation ? { presentation: safePresentation } : {}) };
  }
  if (key !== "studio" || !value || typeof value !== "object") return value;
  const {
    queue: _queue,
    nextAction: _next,
    projectId: _project,
    ...safe
  } = value as Record<string, unknown>;
  return {
    ...safe,
    missingPersonalScene:
      String(safe.sceneId || "").startsWith("local:") ||
      Boolean(safe.missingPersonalScene),
    missingPersonalMusic:
      String(safe.musicId || "").startsWith("local:") ||
      Boolean(safe.missingPersonalMusic),
    sceneId: String(safe.sceneId || "").startsWith("local:")
      ? ""
      : safe.sceneId,
    breakSceneId: String(safe.breakSceneId || "").startsWith("local:")
      ? ""
      : safe.breakSceneId,
    musicId: String(safe.musicId || "").startsWith("local:")
      ? null
      : safe.musicId,
  };
}
export function workspaceEntities(
  record: WorkspaceRecord,
  collection: SyncCollection,
): SyncedEntity[] {
  if (collection === "tasks" || collection === "projects" || collection === "notes")
    return record[collection] || [];
  if (collection === "dashboards")
    return (record.dashboards || []).map(d => { const { sm: _mobile, ...layouts } = d.layouts; return { ...d, layouts }; });
  if (collection === "focusLogs")
    return (record.preferences.focusLogs as FocusLog[]) || [];
  if (collection === "recipes")
    return ((record.preferences.focusRecipes as FocusRecipe[]) || []).map(
      (r) => ({
        ...r,
        sceneId: r.sceneId.startsWith("local:") ? "" : r.sceneId,
        breakSceneId: r.breakSceneId?.startsWith("local:")
          ? ""
          : r.breakSceneId,
        musicId: r.musicId?.startsWith("local:") ? null : r.musicId,
      }),
    );
  const revisions = (record.preferences._syncRevisions || {}) as Record<
    string,
    { revision: number; updatedAt: number }
  >;
  return SYNC_PREFERENCE_KEYS.filter((key) =>
    key === "customViews"
      ? record.customViews.length > 0
      : record.preferences[key] !== undefined,
  ).map((key) => ({
    id: key,
    value: safePreference(
      key,
      key === "customViews" ? record.customViews : record.preferences[key],
    ),
    ...revisions[key],
  }));
}
export function replaceEntities(
  record: WorkspaceRecord,
  collection: SyncCollection,
  values: SyncedEntity[],
): WorkspaceRecord {
  if (collection === 'notes') return { ...record, notes: validateNotes(values) };
  if (collection === "tasks")
    return { ...record, tasks: values as WorkspaceRecord["tasks"] };
  if (collection === "projects")
    return { ...record, projects: values as WorkspaceRecord["projects"] };
  if (collection === "dashboards")
    return { ...record, dashboards: values.map(value => {
      const dashboard = normalizeDashboard(value);
      const local = record.dashboards?.find(d => d.id === dashboard.id);
      if (local?.layouts.sm) dashboard.layouts.sm = local.layouts.sm;
      return dashboard;
    }) };
  if (collection === "focusLogs")
    return {
      ...record,
      preferences: { ...record.preferences, focusLogs: values },
    };
  if (collection === "recipes")
    return {
      ...record,
      preferences: {
        ...record.preferences,
        focusRecipes: values.map((value) => {
          const r = value as FocusRecipe;
          const local = (
            (record.preferences.focusRecipes || []) as FocusRecipe[]
          ).find((x) => x.id === r.id);
          return {
            ...r,
            ...(local?.sceneId.startsWith("local:") && !r.sceneId
              ? { sceneId: local.sceneId }
              : {}),
            ...(local?.musicId?.startsWith("local:") && !r.musicId
              ? { musicId: local.musicId }
              : {}),
          };
        }),
      },
    };
  const preferences = { ...record.preferences };
  const revisions = {
    ...((preferences._syncRevisions as Record<string, unknown>) || {}),
  };
  let customViews = record.customViews;
  for (const key of SYNC_PREFERENCE_KEYS) {
    const entity = (values as SyncedPreference[]).find((v) => v.id === key);
    if (!entity) {
      if (key === "customViews") customViews = [];
      else delete preferences[key];
    }
    if (entity) {
      if (key === "customViews")
        customViews = entity.value as WorkspaceRecord["customViews"];
      else if (key === "studio")
        preferences[key] = {
          ...(entity.value as object),
          ...Object.fromEntries(
            Object.entries((preferences[key] || {}) as object).filter(
              ([k]) =>
                ["queue", "nextAction", "projectId"].includes(k) ||
                (["sceneId", "breakSceneId", "musicId"].includes(k) &&
                  String(
                    (preferences[key] as Record<string, unknown>)[k],
                  ).startsWith("local:") &&
                  !(entity.value as Record<string, unknown>)[k]),
            ),
          ),
        };
      else preferences[key] = key === 'appearance' ? normalizeAppearance(entity.value) : entity.value;
      revisions[key] = {
        revision: entity.revision || 0,
        updatedAt: entity.updatedAt || 0,
      };
    }
  }
  preferences._syncRevisions = revisions;
  return { ...record, preferences, customViews };
}
export function applyEntityChanges(
  record: WorkspaceRecord,
  changes: EntityChange[],
): WorkspaceRecord {
  let result = record;
  for (const collection of SYNC_COLLECTIONS) {
    const selected = changes.filter((c) => c.collection === collection);
    if (!selected.length) continue;
    const map = new Map(
      workspaceEntities(result, collection).map((v) => [v.id, v]),
    );
    for (const change of selected) {
      if (change.after) map.set(change.id, change.after);
      else map.delete(change.id);
    }
    result = replaceEntities(result, collection, [...map.values()]);
    // Removing a preference is explicit; absent snapshots don't erase device defaults.
    for (const c of selected)
      if (collection === "preferences" && !c.after) {
        result = { ...result, preferences: { ...result.preferences } };
        delete result.preferences[c.id];
        if (c.id === "customViews") result.customViews = [];
      }
  }
  return result;
}
