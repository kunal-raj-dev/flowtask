import type { FocusRecipe, MediaAsset } from "../types/studio";
import { DEFAULT_TIMER } from "../types/studio";

export const SCENE_CATEGORIES = [
  ["nature", "Nature & forest"],
  ["mountains", "Mountains & lakes"],
  ["cozy", "Cozy study"],
  ["anime", "Illustrated worlds"],
  ["city", "City & night"],
  ["ocean", "Ocean & escape"],
  ["space", "Space & cosmic"],
  ["minimal", "Minimal & abstract"],
] as const;
const timer = (minutes: number, pause = 5, mode = DEFAULT_TIMER.mode) => ({
  ...DEFAULT_TIMER,
  mode,
  focusMinutes: minutes,
  shortBreakMinutes: pause,
});
export const BUILT_IN_RECIPES: FocusRecipe[] = [
  {
    id: "dsa-deep-work",
    name: "DSA Deep Work",
    description: "One problem. A little room to think.",
    sceneId: "ink-ripple",
    layers: [{ id: "brown", volume: 0.3 }],
    musicId: null,
    musicVolume: 0.25,
    timer: timer(50, 10),
    taskSource: "project",
    builtIn: true,
  },
  {
    id: "rainy-writing",
    name: "Rainy Writing",
    description: "Let the words find their own pace.",
    sceneId: "category:cozy",
    layers: [{ id: "ambient-window-rain", volume: 0.45 }],
    musicId: null,
    musicVolume: 0.25,
    timer: timer(25, 5, "stopwatch"),
    taskSource: "manual",
    builtIn: true,
  },
  {
    id: "library-reading",
    name: "Library Reading",
    description: "A quiet space for your next chapter.",
    sceneId: "old-library",
    layers: [],
    musicId: null,
    musicVolume: 0.25,
    timer: timer(25),
    taskSource: "top3",
    builtIn: true,
  },
  {
    id: "midnight-coding",
    name: "Midnight Coding",
    description: "A city asleep. An idea taking shape.",
    sceneId: "category:city",
    layers: [],
    musicId: "genre:electronic",
    musicVolume: 0.25,
    timer: timer(50, 10),
    taskSource: "project",
    builtIn: true,
  },
  {
    id: "morning-planning",
    name: "Morning Planning",
    description: "Make a little space for what matters.",
    sceneId: "category:mountains",
    layers: [],
    musicId: "genre:piano",
    musicVolume: 0.25,
    timer: timer(10, 5, "countdown"),
    taskSource: "top3",
    builtIn: true,
  },
  {
    id: "quiet-reset",
    initialPhase: "short_break",
    name: "Quiet Reset",
    description: "Step back. Come back a little lighter.",
    sceneId: "category:ocean",
    layers: [{ id: "ambient-ocean", volume: 0.4 }],
    musicId: null,
    musicVolume: 0.25,
    timer: timer(5, 5, "countdown"),
    taskSource: "manual",
    builtIn: true,
  },
];
export const SYNTHETIC_SOUNDS: MediaAsset[] = ["brown", "pink", "white"].map(
  (id) => ({
    id,
    title: `${id[0].toUpperCase()}${id.slice(1)} noise`,
    category: "ambient",
    src: "",
    license: "Original procedural audio",
    creator: "FlowTask",
    loop: true,
  }),
);

function assetValid(value: unknown): value is MediaAsset {
  if (!value || typeof value !== "object") return false;
  const a = value as MediaAsset;
  return (
    typeof a.id === "string" &&
    typeof a.title === "string" &&
    typeof a.src === "string" &&
    a.src.startsWith("/media/") &&
    !a.src.includes("..") &&
    typeof a.license === "string"
  );
}
export async function loadCatalog(
  path: string,
  signal?: AbortSignal,
): Promise<MediaAsset[]> {
  const cache =
    typeof caches !== "undefined"
      ? await caches.open("flowtask-catalog-v2").catch(() => null)
      : null;
  try {
    const response = await fetch(path, { signal });
    if (!response.ok) throw new Error("Media catalog is unavailable.");
    const data = await response.clone().json();
    const list = Array.isArray(data)
      ? data
      : data.assets || data.backgrounds || data.tracks || [];
    if (!Array.isArray(list) || !list.every(assetValid))
      throw new Error("Media catalog has invalid entries.");
    await cache?.put(path, response).catch(() => {});
    return list;
  } catch (error) {
    if (signal?.aborted) throw error;
    const saved = await cache?.match(path);
    if (!saved) throw error;
    const data = await saved.json();
    const list = Array.isArray(data)
      ? data
      : data.assets || data.backgrounds || data.tracks || [];
    return list.filter(assetValid);
  }
}
export function resolveAsset(
  id: string | null | undefined,
  assets: MediaAsset[],
): MediaAsset | undefined {
  if (!id) return undefined;
  if (id.startsWith("category:"))
    return assets.find((a) => a.category === id.slice(9) && a.kind !== "video");
  if (id.startsWith("genre:"))
    return assets.find(
      (a) =>
        a.genre?.toLowerCase().includes(id.slice(6)) ||
        (id === "genre:electronic" && a.genre === "minimal-electronic"),
    );
  return assets.find((a) => a.id === id);
}
const number = (value: unknown, low: number, high: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= low &&
  value <= high;
export function parseRecipe(raw: string): FocusRecipe {
  if (raw.length > 50000) throw new Error("Recipe file is too large.");
  const r = JSON.parse(raw) as FocusRecipe;
  if (
    !r ||
    typeof r.name !== "string" ||
    !r.name.trim() ||
    r.name.length > 80 ||
    typeof r.sceneId !== "string" ||
    !r.timer ||
    !["pomodoro", "countdown", "stopwatch", "sprint"].includes(r.timer.mode) ||
    !number(r.timer.focusMinutes, 1, 240) ||
    !number(r.timer.shortBreakMinutes, 1, 60) ||
    !number(r.timer.longBreakMinutes, 1, 60) ||
    !Number.isInteger(r.timer.cyclesBeforeLongBreak) ||
    !number(r.timer.cyclesBeforeLongBreak, 1, 12) ||
    !Array.isArray(r.layers) ||
    r.layers.length > 4 ||
    !r.layers.every(
      (l) =>
        typeof l.id === "string" && l.id.length < 150 && number(l.volume, 0, 1),
    ) ||
    !(r.musicId === null || typeof r.musicId === "string") ||
    !number(r.musicVolume, 0, 1)
  )
    throw new Error("This is not a valid FlowTask focus recipe.");
  return {
    id: crypto.randomUUID(),
    name: r.name.trim(),
    description: String(r.description || "").slice(0, 200),
    sceneId: r.sceneId.startsWith("local:") ? "" : r.sceneId.slice(0, 150),
    breakSceneId:
      typeof r.breakSceneId === "string" && !r.breakSceneId.startsWith("local:")
        ? r.breakSceneId.slice(0, 150)
        : "",
    layers: r.layers
      .filter((l) => !l.id.startsWith("local:"))
      .map((l) => ({ id: l.id, volume: l.volume, muted: Boolean(l.muted) })),
    musicId: r.musicId?.startsWith("local:") ? null : r.musicId,
    musicVolume: r.musicVolume,
    timer: {
      mode: r.timer.mode,
      focusMinutes: r.timer.focusMinutes,
      shortBreakMinutes: r.timer.shortBreakMinutes,
      longBreakMinutes: r.timer.longBreakMinutes,
      cyclesBeforeLongBreak: r.timer.cyclesBeforeLongBreak,
      autoStart: Boolean(r.timer.autoStart),
    },
    initialPhase: ["focus", "short_break", "long_break"].includes(
      r.initialPhase || "",
    )
      ? r.initialPhase
      : "focus",
    taskSource: ["top3", "project", "manual"].includes(r.taskSource)
      ? r.taskSource
      : "manual",
    favorite: false,
  };
}
export function shareableRecipe(recipe: FocusRecipe): string {
  const {
    name,
    description,
    sceneId,
    breakSceneId,
    layers,
    musicId,
    musicVolume,
    timer,
    taskSource,
    initialPhase,
  } = recipe;
  return JSON.stringify(
    {
      version: 1,
      name,
      description,
      sceneId: sceneId.startsWith("local:") ? "" : sceneId,
      breakSceneId: breakSceneId?.startsWith("local:") ? "" : breakSceneId,
      layers: layers.filter((l) => !l.id.startsWith("local:")),
      musicId: musicId?.startsWith("local:") ? null : musicId,
      musicVolume,
      timer,
      taskSource,
      initialPhase,
    },
    null,
    2,
  );
}
