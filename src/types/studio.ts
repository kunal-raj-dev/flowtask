import type { FocusSessionMode } from "./task";

export type SceneCategory =
  | "nature"
  | "mountains"
  | "cozy"
  | "anime"
  | "city"
  | "ocean"
  | "space"
  | "minimal";
export interface MediaAsset {
  id: string;
  title: string;
  category: string;
  src: string;
  thumbnail?: string;
  kind?: "image" | "video";
  poster?: string;
  width?: number;
  height?: number;
  variants?: Array<{ src: string; width: number; height: number }>;
  genre?: string;
    /** Workspace cover genre, independent from the task-use category. */
    visualStyle?: string;
    licenseUrl?: string;
  durationSeconds?: number;
  loop?: boolean;
  license: string;
  creator: string;
    attribution?: string;
  sourceUrl?: string;
  verifiedAt?: string;
  contexts?: string[];
  moods?: string[];
  altText?: string;
  provenance?: string;
  bytes?: number;
  focalPoint?: { x: number; y: number };
}
export interface TimerConfiguration {
  mode: FocusSessionMode;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  autoStart: boolean;
}
export interface MixerLayer {
  id: string;
  volume: number;
  muted?: boolean;
}
export interface FocusRecipe {
  id: string;
  name: string;
  description: string;
  sceneId: string;
  breakSceneId?: string;
  layers: MixerLayer[];
  musicId: string | null;
  musicVolume: number;
  timer: TimerConfiguration;
  taskSource: "top3" | "project" | "manual";
  initialPhase?: "focus" | "short_break" | "long_break";
  favorite?: boolean;
  builtIn?: boolean;
  revision?: number;
  updatedAt?: number;
}
export interface AppearancePreferences {
  version?: 2;
  keyboardSounds?: boolean;
  theme: import('../utils/themeRegistry').AppTheme;
  mode: "manual" | "system" | "schedule";
  schedule: import('../utils/appearance').ThemeSchedule;
  atmosphere: { preset: 'off' | import('../utils/diurnalAura').DiurnalPeriod; intensity: number };
  accent: string;
  density: "comfortable" | "compact";
  reducedMotion: boolean;
  highContrast: boolean;
}
export interface StudioPreferences {
  themeMode: 'app' | 'custom';
  interfaceTheme: import('../utils/studioAppearance').StudioThemeId;
  panelOpacity: number;
  pipTheme: import('../utils/studioAppearance').FloatingThemeId;
  pipBackground: boolean;
  favoriteRecipes?: string[];
  missingPersonalScene?: boolean;
  missingPersonalMusic?: boolean;
  recipeId: string;
  sceneId: string;
  breakSceneId: string;
  layers: MixerLayer[];
  musicId: string | null;
  musicVolume: number;
  masterVolume: number;
  overlay: number;
  blur: number;
  brightness: number;
  focalX: number;
  focalY: number;
  favorites: string[];
  recent: string[];
  timer: TimerConfiguration;
  taskSource: "top3" | "project" | "manual";
  projectId: string;
  queue: string[];
  motionEnabled: boolean;
  shuffleAtBoundary: boolean;
  continueAudioOnFinish: boolean;
  breakPrompts: boolean;
  timerStyle: "digital" | "ring";
  nextAction: string;
}
export const DEFAULT_TIMER: TimerConfiguration = {
  mode: "pomodoro",
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
  autoStart: false,
};
export const DEFAULT_STUDIO: StudioPreferences = {
  themeMode: 'app',
  interfaceTheme: 'linen',
  panelOpacity: .96,
  pipTheme: 'studio',
  pipBackground: true,
  recipeId: "library-reading",
  sceneId: "old-library",
  breakSceneId: "",
  layers: [],
  musicId: null,
  musicVolume: 0.28,
  masterVolume: 0.45,
  overlay: 0.35,
  blur: 0,
  brightness: 1,
  focalX: 50,
  focalY: 50,
  favorites: [],
  recent: [],
  timer: DEFAULT_TIMER,
  taskSource: "top3",
  projectId: "",
  queue: [],
  motionEnabled: false,
  shuffleAtBoundary: false,
  continueAudioOnFinish: false,
  breakPrompts: true,
  timerStyle: "ring",
  nextAction: "",
};

export interface MediaCatalog {
  scenes: MediaAsset[];
  workspaceVisuals?: MediaAsset[];
  visuals?: MediaAsset[];
  audio: MediaAsset[];
  error?: string;
  refreshPersonal?: () => void;
}
export type FocusStudioPreferences = StudioPreferences;
