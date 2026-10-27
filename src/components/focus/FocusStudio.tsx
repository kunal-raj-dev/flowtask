import { useTaskAvailabilityClock } from '../../hooks/useTaskAvailabilityClock';
import { getTaskEligibility } from '../../utils/taskEligibility';
import { shouldIgnoreShortcut, shortcutHintsEnabled } from '../../services/shortcutRegistry';
import { useMotionPreference } from '../../hooks/useMotionPreference';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import {
  ArrowLeft,
  Play,
  Pause,
  Image,
  Headphones,
  FileText,
  Timer,
  X,
  Check,
  Heart,
  Upload,
  Download,
  ListTodo,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  RotateCcw,
  Plus,
  Trash2,
  ArrowRight,
  CloudOff,
  Settings2,
  Coffee,
  Sparkles,
  Palette,
  Search,
  Leaf,
} from "lucide-react";
import { useTaskContext } from "../../context/TaskContext";
import { useModal } from "../../context/ModalContext";
import { useFocusStore } from "../../store/useFocusStore";
import { useStudioPreferences, useMediaCatalog } from "../../hooks/useStudio";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  SCENE_CATEGORIES,
  resolveAsset,
  parseRecipe,
  shareableRecipe,
} from "../../services/studioCatalog";
import { mediaService } from "../../services/mediaService";
import { studioAudio } from "../../services/studioAudio";
import { downloadFile, downloadBlob } from "../../utils/fileExporter";
import { formatTimerClock } from "../../utils/focusTimeFormat";
import { useTodayStr } from "../../hooks/useCurrentDate";
import { BrandLogo } from "../ui/BrandLogo";
import { pictureInPictureService } from "../../services/pictureInPictureService";
import { transitionView } from "../../utils/viewTransitions";
import { FocusAudioPanel } from "./FocusAudioPanel";
import { ResetConfirmationDialog } from "./ResetConfirmationDialog";
import { StudioEnvironmentLibrary } from './StudioEnvironmentLibrary';
import { StudioThemePicker } from './StudioThemePicker';
import { STUDIO_THEME_IDS, studioThemeTokens } from '../../utils/studioAppearance';
import { THEMES } from '../../utils/themeRegistry';
import type {
  FocusRecipe,
  MediaAsset,
  TimerConfiguration,
  AppearancePreferences,
} from "../../types/studio";
import type { FinishedStudioSession } from "../../services/studioSessionEngine";

type Panel =
  "scenes" | "sound" | "recipes" | "notes" | "timer" | "queue" | "appearance" | null;
type Phase = "focus" | "short_break" | "long_break";
const labels: Record<NonNullable<Panel>, string> = {
  scenes: "Find your somewhere",
  sound: "Set the atmosphere",
  recipes: "Your focus rituals",
  notes: "A little space for thoughts",
  timer: "Find your rhythm",
  queue: "One thing, then the next",
  appearance: "Make it your space",
};
function Range({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  onPreview,
  onPreviewEnd,
  disabled = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onPreview?: (v: number) => void;
  onPreviewEnd?: () => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const current = draft ?? value;
  return (
    <label className="studio-range">
      <span>
        {label}
        <small>
          {Math.round(current * (max === 1 ? 100 : 1))}
          {max === 1 ? "%" : ""}
        </small>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={current}
        onChange={(e) => {
          const v = Number(e.target.value);
          setDraft(v);
          onPreview?.(v);
        }}
        onPointerUp={() => {
          onChange(current);
          setDraft(null);
          onPreviewEnd?.();
        }}
        onKeyUp={() => {
          onChange(current);
          setDraft(null);
          onPreviewEnd?.();
        }}
        onBlur={() => {
          if (draft !== null && draft !== value) onChange(draft);
          setDraft(null);
          onPreviewEnd?.();
        }}
      />
    </label>
  );
}

/**
 * Primary focus surface; the headless lifecycle owns persistence and completion.
 * Sprint pacing remains available through FocusEngineModal.
 */
export function FocusStudio({
  taskId,
  onClose,
  initialPanel = null,
  initialPhase = "focus",
}: {
  taskId: string | null;
  onClose: () => void;
  initialPanel?: Panel;
  initialPhase?: Phase;
}) {
  const ctx = useTaskContext();
  const hints = shortcutHintsEnabled(ctx.settings);
  const { openModal } = useModal();
  const {
    preferences: p,
    update,
    recipes,
    saveRecipes,
  } = useStudioPreferences();
  const media = useMediaCatalog();
  const [panelOpacityPreview, setPanelOpacityPreview] = useState<number | null>(null);
  const highContrast = Boolean((ctx.workspacePreferences.appearance as Partial<AppearancePreferences> | undefined)?.highContrast);
  const session = useFocusStore((s) => s.focusSession);
  const elapsed = useFocusStore((s) => s.focusElapsedSeconds);
  const [panel, setPanelState] = useState<Panel>(initialPanel),
    [category, setCategory] = useState("all");
  const [sceneQuery, setSceneQuery] = useState('');
  const setPanel = useCallback((next: Panel) => {
    setPanelOpacityPreview(null);
    setPanelState(next);
  }, []);
  const [clear, setClear] = useState(false),
    [motionPaused, setMotionPaused] = useState(false);
  const [loadedSceneId, setLoadedSceneId] = useState<string | null>(null);
  const [lastReadyScene, setLastReadyScene] = useState<MediaAsset | null>(null);
  const [selectedTaskState, setSelectedTask] = useState<string | undefined>(
    taskId || session?.taskId || undefined,
  );
  const [message, setMessage] = useState(""),
    [note, setNote] = useState(
      String(ctx.workspacePreferences.scratchpad || ""),
    );
  const [recipeName, setRecipeName] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(""),
    [storageUsage, setStorageUsage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null),
    videoRef = useRef<HTMLVideoElement>(null);
  const packAbort = useRef<AbortController | null>(null);
  const last = ctx.workspacePreferences.studioLastSession as
    FinishedStudioSession | undefined;
  const [summaryDismissed, setSummaryDismissed] = useState<number>(
    Number(ctx.workspacePreferences.studioSummaryDismissed || 0),
  );
  const active = session?.workspaceId === ctx.workspaceId ? session : null;

  const [isFullscreen, setIsFullscreen] = useState(() =>
    Boolean(typeof document !== 'undefined' && (document.fullscreenElement || (document as any).webkitFullscreenElement))
  );

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (!fsElement) {
        if (root.current?.requestFullscreen) {
          await root.current.requestFullscreen();
        } else if ((root.current as any)?.webkitRequestFullscreen) {
          await (root.current as any).webkitRequestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        } else {
          setMessage('Fullscreen is not supported on this browser.');
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch {
      setMessage('Fullscreen is unavailable. Studio still fills your browser.');
    }
  }, []);
  const removePersonalAsset = async (assetId: string, title: string) => {
    const projectReferences = ctx.projects.filter(project => project.coverAssetId === assetId);
    const dashboardReferences = ctx.dashboards.filter(dashboard => dashboard.coverImage === assetId || dashboard.widgets.some(widget => widget.type === "quietScene" && widget.config.sceneId === assetId));
    const referenceCount = projectReferences.length + dashboardReferences.reduce((count, dashboard) => count + Number(dashboard.coverImage === assetId) + dashboard.widgets.filter(widget => widget.type === "quietScene" && widget.config.sceneId === assetId).length, 0);
    const referenceCopy = referenceCount ? ` It is used by ${referenceCount} workspace cover${referenceCount === 1 ? "" : "s"}; those references will be cleared.` : "";
    if (!window.confirm(`Remove “${title}” from this device?${referenceCopy}`)) return;
    try {
      await mediaService.remove(assetId, ctx.workspaceId);
      projectReferences.forEach(project => ctx.updateProject(project.id, { coverAssetId: undefined, coverFocalPoint: undefined }));
      if (dashboardReferences.length) {
        const nextDashboards = ctx.dashboards.map(dashboard => ({
          ...dashboard,
          ...(dashboard.coverImage === assetId ? { coverImage: undefined, coverFocalPoint: undefined } : {}),
          widgets: dashboard.widgets.map(widget => widget.type === "quietScene" && widget.config.sceneId === assetId ? { ...widget, config: { ...widget.config, sceneId: undefined, focalPoint: undefined } } : widget),
        }));
        ctx.updateDashboards(nextDashboards);
      }
      media.refreshPersonal();
      if (p.sceneId === assetId || p.breakSceneId === assetId) update({ sceneId: p.sceneId === assetId ? "" : p.sceneId, breakSceneId: p.breakSceneId === assetId ? "" : p.breakSceneId });
      if (p.musicId === assetId) update({ musicId: null });
      setMessage(referenceCount ? `Removed ${title} and cleared ${referenceCount} cover reference${referenceCount === 1 ? "" : "s"}.` : `Removed ${title} from this device.`);
    } catch { setMessage(`Could not remove ${title}. Your workspace data is still safe.`); }
  };
  const [phase, setPhase] = useState<Phase>(
    active?.pomodoroPhase || initialPhase,
  );
  const currentPhase = active?.pomodoroPhase || phase;
  const scene = resolveAsset(
    currentPhase !== "focus" ? p.breakSceneId || p.sceneId : p.sceneId,
    media.scenes,
  );
  const sceneMissing =
    Boolean(p.missingPersonalScene && !scene) ||
    ((currentPhase === "focus"
      ? p.sceneId
      : p.breakSceneId || p.sceneId
    ).startsWith("local:") &&
      !scene);
  const sceneResults = useMemo(() => {
    const terms = sceneQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return media.scenes.filter(asset => {
      const inCategory = category === 'all' || (category === 'favorites' && p.favorites.includes(asset.id)) ||
        (category === 'recent' && p.recent.includes(asset.id)) || asset.category === category;
      const categoryName = SCENE_CATEGORIES.find(([id]) => id === asset.category)?.[1] || asset.category;
      const description = [asset.title, categoryName, ...(asset.moods || []), ...(asset.contexts || [])].join(' ').toLocaleLowerCase();
      return inCategory && terms.every(term => description.includes(term));
    });
  }, [media.scenes, category, sceneQuery, p.favorites, p.recent]);
  const chooseScene = (id: string) => update({
    recipeId: '',
    ...(currentPhase === 'focus' ? { sceneId: id, missingPersonalScene: false } : { breakSceneId: id }),
    recent: [id, ...p.recent.filter(value => value !== id)].slice(0, 12),
  });
  const timer = active?.timerConfiguration || p.timer;
  const minutes =
    currentPhase === "focus"
      ? timer.focusMinutes
      : currentPhase === "long_break"
        ? timer.longBreakMinutes
        : timer.shortBreakMinutes;
  const seconds = active
    ? active.targetDurationSec > 0
      ? Math.max(0, active.targetDurationSec - elapsed)
      : elapsed
    : timer.mode === "stopwatch" && currentPhase === "focus"
      ? 0
      : minutes * 60;
  const running = active?.state === "running";
  const showSummary = last && last.finishedAt > summaryDismissed && !active;
  const lobby = !active && !showSummary;
  const today = useTodayStr();
  const availabilityNow = useTaskAvailabilityClock(ctx.tasks);
  const availableTasks = useMemo(
    () =>
      ctx.tasks.filter(
        (t) => getTaskEligibility(t, { tasks: ctx.tasks, projects: ctx.projects, now: availabilityNow }).actionable,
      ),
    [ctx.tasks, ctx.projects, availabilityNow],
  );
  const queue = useMemo(
    () =>
      availableTasks.filter((t) =>
        p.taskSource === "top3"
          ? t.topThreeDate === today ||
            (t.isPinnedToday && (t.plannedDate || t.dueDate) === today)
          : p.taskSource === "project"
            ? t.projectId === p.projectId
            : p.queue.includes(t.id),
      ),
    [availableTasks, p.taskSource, p.projectId, p.queue, today],
  );
  const selectedTask =
    selectedTaskState !== undefined
      ? selectedTaskState
      : queue[0]?.id || "";
  const task = ctx.tasks.find(
    (t) => t.id === (active?.taskId || selectedTask),
  );
  useFocusTrap(root, () => {
    const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fsElement) {
      if (document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        void (document as any).webkitExitFullscreen().catch(() => {});
      }
      return;
    }
    if (panel) setPanel(null);
    else if (clear) setClear(false);
    else void transitionView(() => onClose());
  });
  useEffect(() => {
    const listener = (e: Event) =>
      setMessage((e as CustomEvent<string>).detail);
    window.addEventListener("flowtask:audio-error", listener);
    return () => window.removeEventListener("flowtask:audio-error", listener);
  }, []);

  const pendingNote = useRef({ note, save: ctx.setWorkspacePreference });
  useEffect(() => {
    pendingNote.current = { note, save: ctx.setWorkspacePreference };
  }, [note, ctx.setWorkspacePreference]);
  useEffect(
    () => () => {
      pendingNote.current.save("scratchpad", pendingNote.current.note);
    },
    [],
  );
  const { setWorkspacePreference, workspacePreferences } = ctx;
  const savedScratchpad = String(workspacePreferences.scratchpad || "");
  useEffect(() => {
    const id = setTimeout(() => {
      if (note !== savedScratchpad)
        setWorkspacePreference("scratchpad", note);
    }, 450);
    return () => clearTimeout(id);
  }, [note, setWorkspacePreference, savedScratchpad]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (motionPaused || document.hidden) video.pause();
    else void video.play().catch(() => {});
  }, [scene?.src, motionPaused]);
  useEffect(() => {
    const listener = () => {
      if (document.hidden) {
        videoRef.current?.pause();
      } else if (!motionPaused) {
        void videoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, [motionPaused]);
  useEffect(
    () => () => {
      packAbort.current?.abort();
    },
    [],
  );
  const start = async (requestedPhase = phase, overrideMinutes?: number) => {
    setMessage("");
    try {
      if (p.layers.length || p.musicId) await studioAudio.unlock();
    } catch {
      setMessage("Audio is unavailable. Your timer can still run.");
    }
    if (active) ctx.stopFocusSession();
    const config = p.timer;
    const duration =
      overrideMinutes ??
      (requestedPhase === "focus"
        ? config.focusMinutes
        : requestedPhase === "long_break"
          ? config.longBreakMinutes
          : config.shortBreakMinutes);
    ctx.startFocusSession(
      requestedPhase === "focus" ? config.mode : "pomodoro",
      selectedTask || null,
      task?.title ||
        (requestedPhase === "focus" ? "Deep focus" : "A little breathing room"),
      config.mode === "stopwatch" &&
        requestedPhase === "focus" &&
        !overrideMinutes
        ? 0
        : duration * 60,
    );
    ctx.updateFocusSession({
      workspaceId: ctx.workspaceId,
      pomodoroPhase: requestedPhase,
      pomodoroCycle: last?.nextCycle || 1,
      recipeId: p.recipeId,
      timerConfiguration: config,
      nextAction: task?.nextAction || p.nextAction,
    });
    setPhase(requestedPhase);
    setSummaryDismissed(last?.finishedAt || Date.now());
  };
  const toggle = async () => {
    if (running) {
      ctx.pauseFocusSession();
    } else if (active?.state === "paused" || active?.state === "ready") {
      try {
        if (p.layers.length || p.musicId) await studioAudio.unlock();
      } catch {
        /* timer still works */
      }
      ctx.resumeFocusSession();
    } else {
      await start();
    }
  };
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });

  const [resetConfirmMode, setResetConfirmMode] = useState<"reset" | "restartRound" | null>(null);
  const wasRunningBeforeReset = useRef(false);

  const handleResetClick = () => {
    if (!active) return;
    if (elapsed === 0 || active.state === "ready") {
      ctx.resetFocusSession("discard", active.id);
      return;
    }
    wasRunningBeforeReset.current = active.state === "running";
    if (wasRunningBeforeReset.current) {
      ctx.pauseFocusSession();
    }
    setResetConfirmMode("reset");
  };

  const handleRestartRoundClick = () => {
    if (!active) return;
    if (elapsed === 0 || active.state === "ready") {
      ctx.restartFocusRound("discard", active.id);
      return;
    }
    wasRunningBeforeReset.current = active.state === "running";
    if (wasRunningBeforeReset.current) {
      ctx.pauseFocusSession();
    }
    setResetConfirmMode("restartRound");
  };

  const showPip = useCallback(async () => {
    if (!pictureInPictureService.isSupported()) {
      setMessage(
        "Floating windows are unavailable in this browser. Minimize Studio to use the in-app player.",
      );
      return;
    }
    try {
      await pictureInPictureService.requestPipWindow({ width: 340, height: 220 });
    } catch {
      setMessage(
        "The floating timer could not open. The in-app player is still available.",
      );
    }
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      // Escape dismissal is a native modal control and remains active when master shortcuts are off
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const fsElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
        if (fsElement) {
          // In fullscreen mode: exit fullscreen without closing the studio
          if (document.exitFullscreen) {
            void document.exitFullscreen().catch(() => {});
          } else if ((document as any).webkitExitFullscreen) {
            void (document as any).webkitExitFullscreen().catch(() => {});
          }
          return;
        }
        if (panel) {
          setPanel(null);
        } else if (clear) {
          setClear(false);
        } else {
          void transitionView(() => onClose());
        }
        return;
      }

      if (ctx.settings?.keyboardShortcutsEnabled === false || shouldIgnoreShortcut(event)) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,select,button,[contenteditable=true]"))
        return;
      if (event.code === "Space") {
        event.preventDefault();
        void toggleRef.current();
      } else if (event.code === "KeyF") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.code === "KeyZ" || event.code === "KeyC") {
        event.preventDefault();
        setClear((prev) => !prev);
        setPanel(null);
      } else if (event.code === "KeyP") {
        event.preventDefault();
        void showPip();
      } else if (event.code === "KeyI") {
        event.preventDefault();
        openModal('interruption');
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [panel, clear, onClose, toggleFullscreen, showPip, setPanel, ctx.settings?.keyboardShortcutsEnabled, openModal]);
  useEffect(() => {
    if (summaryDismissed)
      setWorkspacePreference("studioSummaryDismissed", summaryDismissed);
  }, [summaryDismissed, setWorkspacePreference]);
  const finish = (outcome: "completed" | "interrupted") => {
    if (!active) return;
    ctx.updateFocusSession({ outcome });
    ctx.stopFocusSession();
    setSummaryDismissed(0);
  };
  const selectRecipe = (r: FocusRecipe) => {
    if (active) {
      setMessage(
        "Finish or pause and finish the current session before changing its recipe.",
      );
      return;
    }
    update({
      recipeId: r.id,
      sceneId: r.sceneId,
      breakSceneId: r.breakSceneId || r.sceneId,
      layers: r.layers,
      musicId: r.musicId,
      musicVolume: r.musicVolume,
      timer: r.timer,
      taskSource: r.taskSource,
    });
    setPhase(r.initialPhase || "focus");
    setMessage(`${r.name} is ready.`);
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const asset = await mediaService.importFile(file, ctx.workspaceId);
      media.refreshPersonal();
      update(
        asset.kind === "image" ? { sceneId: asset.id } : { musicId: asset.id },
      );
      setMessage("Added to your personal library on this device.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      event.target.value = "";
    }
  };
  const importRecipe = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 50000) throw new Error("Recipe file is too large.");
      const r = parseRecipe(await file.text());
      saveRecipes([...recipes, r]);
      setMessage(`${r.name} imported.`);
    } catch (error) {
      setMessage((error as Error).message);
    }
    event.target.value = "";
  };
  const saveRecipe = () => {
    const name = recipeName.trim();
    if (!name) return;
    const r: FocusRecipe = {
      id: crypto.randomUUID(),
      name: name.slice(0, 80),
      description: "Your own little ritual.",
      sceneId: p.sceneId,
      breakSceneId: p.breakSceneId,
      layers: p.layers,
      musicId: p.musicId,
      musicVolume: p.musicVolume,
      timer: p.timer,
      taskSource: p.taskSource,
      favorite: true,
      initialPhase: currentPhase,
    };
    saveRecipes([...recipes, r]);
    update({ recipeId: r.id });
    setRecipeName("");
    setMessage("Your recipe is saved.");
  };
  const downloadPack = async () => {
    const assets = [
      ...SCENE_CATEGORIES.flatMap(
        ([cat]) =>
          media.scenes.find((s) => s.category === cat && s.kind !== "video") ||
          [],
      ),
      ...media.audio.filter((a) => a.category === "ambient").slice(0, 4),
      ...media.audio.filter((a) => a.category === "music").slice(0, 2),
    ];
    if (!assets.length) {
      setMessage("The media library is still loading. Try again in a moment.");
      return;
    }
    packAbort.current = new AbortController();
    try {
      setDownloadProgress("Preparing…");
      await mediaService.downloadPack(
        assets,
        (done, total) => setDownloadProgress(`${done}/${total}`),
        packAbort.current.signal,
      );
      setMessage("Your starter pack is available offline.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setDownloadProgress("");
    }
  };

  const updateTimer = (patch: Partial<TimerConfiguration>) => {
    if (active) {
      setMessage("Timer settings apply to your next session.");
    }
    update({ recipeId: '', timer: { ...p.timer, ...patch } });
  };
  const captureTask = () => {
    const selected =
      noteRef.current?.value
        .slice(noteRef.current.selectionStart, noteRef.current.selectionEnd)
        .trim() || note.trim();
    if (!selected) return;
    ctx.addTask(selected.slice(0, 1000), { projectId: "inbox" });
    setMessage("Thought captured in your Inbox.");
  };
  const rate = (rating: 1 | 2 | 3) => {
    if (!last) return;
    const logs = ctx.focusLogs.map((log) =>
      log.id === last.session.id ? { ...log, rating } : log,
    );
    ctx.setWorkspacePreference("focusLogs", logs);
    setMessage("Thanks. Your reflection is saved.");
  };
  const reduced = useMotionPreference();
  const dataSaving = Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData,
  );
  const musicMissing =
    Boolean(p.musicId?.startsWith("local:") || p.missingPersonalMusic) &&
    !resolveAsset(p.musicId, media.audio);
  const canAnimate =
    scene?.kind === "video" && p.motionEnabled && !reduced && !dataSaving;
  const savedLobbyRecipes = recipes.filter(recipe => !recipe.builtIn || recipe.favorite).slice(0, 3);
  const panelOpacity = highContrast ? 1 : panelOpacityPreview ?? p.panelOpacity;
  const playbackLabel = running ? 'Pause' : active?.state === 'paused' || active?.state === 'ready' ? 'Resume' : currentPhase === 'focus' ? 'Start focus' : 'Start break';
  const cycle = active?.pomodoroCycle || last?.nextCycle || 1;
  return (
    <div
      ref={root}
      className={`focus-studio ${clear ? "is-clear" : ""} ${lobby ? 'is-lobby' : 'is-session'}`}
      data-session-state={active?.state || (showSummary ? 'finished' : 'ready')}
      data-phase={currentPhase}
      data-studio-theme={p.interfaceTheme}
      data-interface-tone={THEMES[p.interfaceTheme].scheme}
      role="dialog"
      aria-modal="true"
      aria-label="Focus Studio"
      tabIndex={-1}
      style={
        {
          "--studio-overlay": p.overlay,
          "--studio-panel-opacity": `${panelOpacity * 100}%`,
          "--studio-panel-blur": `${panelOpacity * 24}px`,
          ...studioThemeTokens(p.interfaceTheme, highContrast),
          "--text-primary": "var(--studio-text)",
          "--text-secondary": "var(--studio-secondary)",
          colorScheme: THEMES[p.interfaceTheme].scheme,
        } as CSSProperties
      }
    >
      <div className="studio-backdrop" aria-hidden="true">
        {lastReadyScene && scene && loadedSceneId !== scene.id && (
          lastReadyScene.kind === "video" && canAnimate ? (
            <video
              key={`prev-${lastReadyScene.id}`}
              className="is-ready"
              src={lastReadyScene.src}
              poster={lastReadyScene.poster || lastReadyScene.thumbnail}
              autoPlay
              muted
              loop
              playsInline
              style={{
                objectPosition: `${p.focalX}% ${p.focalY}%`,
                filter: `brightness(${p.brightness}) blur(${p.blur}px)`,
              }}
            />
          ) : (
            <img
              key={`prev-${lastReadyScene.id}`}
              className="is-ready"
              src={lastReadyScene.poster || lastReadyScene.src}
              alt=""
              style={{
                objectPosition: `${p.focalX}% ${p.focalY}%`,
                filter: `brightness(${p.brightness}) blur(${p.blur}px)`,
              }}
            />
          )
        )}
        {canAnimate ? (
          <video
            key={scene.id}
            className={loadedSceneId === scene.id ? "is-ready" : undefined}
            ref={videoRef}
            src={scene.src}
            poster={scene.poster || scene.thumbnail}
            autoPlay
            muted
            loop
            playsInline
            onCanPlay={() => {
              setLoadedSceneId(scene.id);
              setLastReadyScene(scene);
            }}
            style={{
              objectPosition: `${p.focalX}% ${p.focalY}%`,
              filter: `brightness(${p.brightness}) blur(${p.blur}px)`,
            }}
          />
        ) : (
          scene && (
            <img
              key={scene.id}
              className={loadedSceneId === scene.id ? "is-ready" : undefined}
              src={scene.poster || scene.src}
              srcSet={
                scene.kind !== "video"
                  ? scene.variants
                      ?.map((v) => `${v.src} ${v.width}w`)
                      .join(", ")
                  : undefined
              }
              sizes="100vw"
              alt=""
              onLoad={() => {
                setLoadedSceneId(scene.id);
                setLastReadyScene(scene);
                setMessage((value) =>
                  value ===
                  "This background is unavailable. Your focus session is unaffected."
                    ? ""
                    : value,
                );
              }}
              style={{
                objectPosition: `${p.focalX}% ${p.focalY}%`,
                filter: `brightness(${p.brightness}) blur(${p.blur}px)`,
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
                setMessage(
                  "This background is unavailable. Your focus session is unaffected.",
                );
              }}
            />
          )
        )}
      </div>
      <div className="studio-shade" />
      <header className="studio-header">
        <div className="studio-brand">
          <BrandLogo size={34} />
          <span>
            FlowTask<span className="studio-beta">STUDIO</span>
          </span>
        </div>
        <div className="studio-header-center"><span aria-hidden="true" />A QUIETER KIND OF PRODUCTIVE</div>
        <div className="studio-header-actions">
          <button
            onClick={() => {
              setClear(!clear);
              setPanel(null);
            }}
            aria-label={clear ? "Exit Zen view" : "Enter Zen view"}
            title={(clear ? "Exit Zen view" : "Zen view") + (hints ? " (Z)" : "")}
          >
            <Sparkles size={18} />
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen" : "Toggle fullscreen"}
            title={isFullscreen ? (hints ? "Exit fullscreen (F)" : "Exit fullscreen") : (hints ? "Fullscreen (F)" : "Fullscreen")}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={() => void showPip()}
            aria-label="Open floating timer"
            title={hints ? "Floating timer (P)" : "Floating timer"}
          >
            <PictureInPicture2 size={18} />
          </button>
          <button aria-label="Back to planner" onClick={() => void transitionView(() => onClose())} className="studio-exit">
            <ArrowLeft size={16} />
            <span>Back to planner</span>
          </button>
        </div>
      </header>
      <main className={`studio-stage ${panel ? "has-panel" : ""}`}>
        {lobby && <div className="studio-lobby-intro"><p className="studio-eyebrow"><Leaf size={13} strokeWidth={1.5} aria-hidden="true" /> YOUR FOCUS SANCTUARY</p><h2>A little space to <em>find your flow.</em></h2><p>Somewhere quiet. Something meaningful. At your own pace.</p></div>}
        <div className={lobby ? 'studio-lobby' : 'studio-session'}>
        <section className="studio-session-core" aria-label={lobby ? 'Prepare your session' : 'Current session'}>
        <div className="studio-mode-switch" aria-label="Session phase">
          {(["focus", "short_break", "long_break"] as Phase[]).map((mode) => (
            <button
              key={mode}
              aria-pressed={currentPhase === mode}
              onClick={() => {
                if (active) {
                  setMessage(
                    "Finish your current session before changing phase.",
                  );
                  return;
                }
                setPhase(mode);
                setSummaryDismissed(last?.finishedAt || Date.now());
              }}
            >
              {mode === "focus"
                ? "Focus"
                : mode === "short_break"
                  ? "Short break"
                  : "Long break"}
            </button>
          ))}
        </div>
        <div className="studio-title-slot">
          <p className="studio-eyebrow">
            {currentPhase !== "focus"
              ? "A LITTLE BREATHING ROOM"
              : running
                ? "RIGHT HERE. ONE THING AT A TIME."
                : active?.state === 'paused' ? 'PAUSED · RETURN WHEN YOU ARE READY'
                : "MAKE ROOM FOR WHAT MATTERS"}
          </p>
          <h1 title={currentPhase === 'focus' ? task?.title : undefined}>
            {currentPhase !== "focus"
              ? "Rest is part of the rhythm."
              : task
                ? task.title
                : "One thing at a time."}
          </h1>
          {(task?.nextAction || p.nextAction) && (
            <p className="studio-next-action">
              Next step · {task?.nextAction || p.nextAction}
            </p>
          )}
        </div>
        {lobby && <div className="studio-lobby-config">
          <label className="studio-intention-field"><span><small>01</small>Your intention</span><select aria-label="Focus task" value={selectedTask} onChange={event => setSelectedTask(event.target.value)}><option value="">Open focus · a little time for yourself</option>{availableTasks.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
          <div className="studio-rhythm-field">
            <div className="studio-rhythm-heading"><span><small>02</small>Your rhythm</span><button type="button" onClick={() => setPanel('timer')}><Settings2 size={12} />Custom</button></div>
            <div className="studio-rhythm-options" role="group" aria-label="Focus rhythm">
              {([25, 50] as const).map(value => <button key={value} type="button" aria-label={`${value}-minute focus`} aria-pressed={timer.mode === 'pomodoro' && timer.focusMinutes === value && timer.shortBreakMinutes === (value === 50 ? 10 : 5)} onClick={() => updateTimer({ mode: 'pomodoro', focusMinutes: value, shortBreakMinutes: value === 50 ? 10 : 5 })}><strong>{value}<small>min</small></strong><span>{value === 25 ? 'A gentle start' : 'A little deeper'}</span></button>)}
              <button type="button" aria-label="Open-ended focus" aria-pressed={timer.mode === 'stopwatch'} onClick={() => updateTimer({ mode: 'stopwatch' })}><strong aria-hidden="true">∞</strong><span>Your own pace</span></button>
            </div>
          </div>
        </div>}
        <div
          className={`studio-clock ${p.timerStyle === "ring" ? "with-ring" : ""} ${seconds >= 3600 ? 'is-hour-clock' : ''} ${active && active.targetDurationSec > 0 && seconds <= 60 && seconds > 0 ? 'urgency-pulse animate-pulse' : ''}`}
          role="timer"
          aria-label={`${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds ${(active ? active.targetDurationSec > 0 : timer.mode !== "stopwatch" || currentPhase !== "focus") ? "remaining" : "elapsed"}`}
        >
          <span className="studio-clock-digits">{formatTimerClock(seconds)}</span>
          {p.timerStyle === 'ring' && <small className="studio-clock-caption" aria-hidden="true">{running ? 'ONE MOMENT AT A TIME' : active?.state === 'paused' ? 'TAKE YOUR TIME' : 'MAKE A LITTLE ROOM'}</small>}
          {p.timerStyle === "ring" && (() => {
            const ringRadius = 52;
            const ringCircumference = 2 * Math.PI * ringRadius; // ~326.726
            const ringTargetSec = active?.targetDurationSec || (timer.mode === 'pomodoro' ? (currentPhase === 'focus' ? timer.focusMinutes : currentPhase === 'short_break' ? timer.shortBreakMinutes : timer.longBreakMinutes) * 60 : 25 * 60);
            const ringFractionElapsed = ringTargetSec > 0 ? Math.max(0, Math.min(1, elapsed / ringTargetSec)) : 0;
            const ringDashoffset = timer.mode === 'stopwatch'
              ? ringCircumference * (1 - Math.max(0, Math.min(1, (elapsed % 3600) / 3600)))
              : -ringFractionElapsed * ringCircumference;
            return (
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="57" className="studio-ring-markers" />
                <circle cx="60" cy="60" r={ringRadius} className="studio-ring-track" />
                <circle
                  cx="60"
                  cy="60"
                  r={ringRadius}
                  className="studio-ring-progress"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashoffset}
                />
              </svg>
            );
          })()}
        </div>
        <div className="studio-session-label">
          <p>
          {timer.mode === "stopwatch" && currentPhase === "focus"
            ? "Open-ended · your pace, your space"
            : `${minutes} minutes ${currentPhase === "focus" ? "of intention" : "to recharge"}`}
          </p>
          {timer.mode === 'pomodoro' && <span className="studio-round-progress"><span className="studio-round-dots" aria-hidden="true">{Array.from({ length: Math.min(8, timer.cyclesBeforeLongBreak) }, (_, index) => <i key={index} data-complete={index < cycle - 1 || undefined} data-current={index === cycle - 1 || undefined} />)}</span>Round {cycle} of {timer.cyclesBeforeLongBreak}</span>}
        </div>
        <div className="studio-playback" data-preparing={lobby || undefined}>
          <button
            type="button"
            className="studio-control-btn studio-reset-btn"
            disabled={!active}
            onClick={handleResetClick}
            aria-label="Reset current timer"
            title="Reset current timer"
          >
            <RotateCcw size={17} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            className="studio-start"
            aria-label={playbackLabel}
            onClick={() => void toggle()}
          >
            {running ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
            <span>{playbackLabel}</span>
            {hints && <kbd aria-hidden="true">Space</kbd>}
          </button>

          <button
            type="button"
            className="studio-control-btn studio-finish-btn"
            disabled={!active}
            onClick={() => finish("completed")}
            aria-label="Finish session"
            title="Finish session"
          >
            <Check size={18} />
            <span>Finish</span>
          </button>
        </div>
        <button
          className="studio-task-link"
          onClick={() => setPanel(panel === "queue" ? null : "queue")}
        >
          <ListTodo size={15} />
          {task ? "Change task" : "Choose a task to focus on"}
          <ArrowRight size={14} />
        </button>
        <div className="studio-context-actions"><button onClick={()=>setPanel(panel==='notes'?null:'notes')}><FileText size={14}/>Notes</button><button onClick={()=>setPanel(panel==='queue'?null:'queue')}><ListTodo size={14}/>Queue{queue.length ? ` · ${queue.length}` : ''}</button></div>
        {lobby && scene && <button type="button" className="studio-current-room" onClick={() => setPanel('scenes')} aria-label={`Change room, currently ${scene.title}`}><img src={scene.thumbnail || scene.poster || scene.src} alt="" /><span><small>YOUR ROOM</small>{scene.title}</span><ArrowRight size={14} /></button>}
        <div className="studio-break-prompt-slot">
          {currentPhase !== "focus" && p.breakPrompts && (
            <p className="studio-break-prompt">
              <Coffee size={16} /> Look away, stretch a little, or get some water.
            </p>
          )}
        </div>
        </section>
        {lobby && <StudioEnvironmentLibrary scene={scene} scenes={media.scenes} recipes={recipes} savedRecipes={savedLobbyRecipes} recipeId={p.recipeId} onChooseScene={chooseScene} onChooseRecipe={selectRecipe} onBrowseRooms={() => setPanel('scenes')} onBrowseRecipes={() => setPanel('recipes')} />}
        </div>
      </main>
      <div className="studio-bottom">
        <div className="studio-scene-caption">
          {scene ? (
            <>
              <span>{scene.title}</span>
              <small>
                {scene.category === "personal"
                  ? "Your own little corner"
                  : "YOUR SOMEWHERE, RIGHT HERE"}
              </small>
            </>
          ) : (
            <>
              <span>Your quiet corner</span>
              <small>CHOOSE A SCENE. MAKE IT YOURS.</small>
            </>
          )}
          {canAnimate && (
            <button
              onClick={() => setMotionPaused(!motionPaused)}
              aria-label={
                motionPaused
                  ? "Play background motion"
                  : "Pause background motion"
              }
            >
              {motionPaused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          )}
        </div>
        <nav className="studio-dock" aria-label="Focus customization">
          {(
            [
              { id: "scenes", icon: Image, name: "Room" },
              { id: "sound", icon: Headphones, name: "Sound" },
              { id: "timer", icon: Timer, name: "Session" },
              { id: "appearance", icon: Palette, name: "Style" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-pressed={panel === item.id}
              onClick={() => setPanel(panel === item.id ? null : item.id)}
            >
              <item.icon size={19} />
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
        <div className="studio-shortcuts">
          {hints ? <><kbd>Space</kbd>{running ? 'pause' : active ? 'resume' : 'begin'}<span>·</span><kbd>Esc</kbd>back to your day</> : 'Your pace. Your space.'}
        </div>
      </div>
      {(message || media.error || sceneMissing) && (
        <div className="studio-message" role="status">
          {message ||
            (sceneMissing
              ? "This personal background is on another device. Choose a built-in scene here."
              : media.error)}
          <button onClick={() => setMessage("")} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}
      {panel && (
        <aside className="studio-panel" aria-label={labels[panel]}>
          <header>
            <div>
              <span className="studio-eyebrow">YOUR FOCUS STUDIO</span>
              <h2>{labels[panel]}</h2>
            </div>
            <button
              onClick={() => setPanel(null)}
              aria-label="Close customization panel"
            >
              <X size={20} />
            </button>
          </header>
          <div className="studio-panel-body">
            {panel === 'appearance' && <>
              <div className="studio-opacity-control">
                <Range label="Panel opacity" value={highContrast ? 1 : p.panelOpacity} disabled={highContrast} onPreview={setPanelOpacityPreview} onPreviewEnd={() => setPanelOpacityPreview(null)} onChange={panelOpacity => update({ panelOpacity })} />
                <p className="studio-help">{highContrast ? 'Increased contrast keeps panels fully opaque.' : 'Adjust the timer card, side panels and bottom dock. 0% is clear; 100% is solid.'}</p>
              </div>
              <p className="studio-help">A palette for your room. Your planner keeps its own theme.</p>
              <StudioThemePicker value={p.interfaceTheme} onChange={interfaceTheme => update({ interfaceTheme })} />
              <div className="studio-details">
                <h3>Floating timer</h3>
                <label className="studio-check"><input type="checkbox" checked={p.pipBackground} onChange={e => update({ pipBackground: e.target.checked })} />Use the current Studio background</label>
                <label className="studio-field">Floating timer theme<select aria-label="Floating timer theme" value={p.pipTheme} onChange={e => update({ pipTheme: e.target.value as typeof p.pipTheme })}><option value="studio">Match Studio</option>{STUDIO_THEME_IDS.map(id => <option key={id} value={id}>{THEMES[id].label}</option>)}</select></label>
                <p className="studio-help">Theme and background changes stay in sync, even while the timer is floating.</p>
              </div>
            </>}
            {['timer','recipes','queue'].includes(panel) && <nav className="studio-session-tabs" aria-label="Session tools">{(['timer','recipes','queue'] as const).map(tab=><button key={tab} aria-pressed={panel===tab} onClick={()=>setPanel(tab)}>{tab==='timer'?'Timer':tab==='recipes'?'Recipes':'Task queue'}</button>)}</nav>}
            {panel === "scenes" && (
              <>
                <label className="studio-room-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search rooms" placeholder="A room, a place, a feeling…" value={sceneQuery} onChange={event => setSceneQuery(event.target.value)} />{sceneQuery && <button type="button" onClick={() => setSceneQuery('')} aria-label="Clear room search"><X size={14} /></button>}</label>
                <div className="studio-chips">
                  <button
                    aria-pressed={category === "all"}
                    onClick={() => setCategory("all")}
                  >
                    All scenes
                  </button>
                  <button
                    aria-pressed={category === "favorites"}
                    onClick={() => setCategory("favorites")}
                  >
                    Favorites
                  </button>
                  <button
                    aria-pressed={category === "recent"}
                    onClick={() => setCategory("recent")}
                  >
                    Recent
                  </button>
                  {SCENE_CATEGORIES.map(([id, name]) => (
                    <button
                      key={id}
                      aria-pressed={category === id}
                      onClick={() => setCategory(id)}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    aria-pressed={category === "personal"}
                    onClick={() => setCategory("personal")}
                  >
                    Personal
                  </button>
                </div>
                <p className="studio-room-result-count" role="status">{sceneResults.length} {sceneResults.length === 1 ? 'room' : 'rooms'}{sceneQuery.trim() ? ' for your moment' : ' to make your own'}</p>
                {sceneResults.length === 0 && <div className="studio-room-empty"><Leaf size={28} strokeWidth={1.2} aria-hidden="true" /><h3>{category === 'favorites' && !sceneQuery ? 'Keep a little collection.' : 'A different somewhere?'}</h3><p>{category === 'favorites' && !sceneQuery ? 'Tap a heart on any room to save it here.' : 'Try a different word or explore all your rooms.'}</p><button type="button" onClick={() => { setSceneQuery(''); setCategory('all'); }}>Explore all rooms<ArrowRight size={14} /></button></div>}
                <div className="studio-scene-grid">
                  {sceneResults.map((a) => (
                      <div
                        className={`studio-scene-card ${scene?.id === a.id ? "selected" : ""}`}
                        key={a.id}
                      >
                        <button
                          className="studio-scene-select"
                          aria-label={`Use ${a.title} background`}
                          aria-pressed={scene?.id === a.id}
                          onClick={() => chooseScene(a.id)}
                        >
                          <img
                            src={a.thumbnail || a.poster || a.src}
                            alt=""
                            loading="lazy"
                          />
                          <span>{a.title}</span>
                          {a.kind === "video" && <small>Motion</small>}
                        </button>
                        <button
                          className="studio-favorite"
                          aria-label={`${p.favorites.includes(a.id) ? "Unfavorite" : "Favorite"} ${a.title}`}
                          onClick={() =>
                            update({
                              favorites: p.favorites.includes(a.id)
                                ? p.favorites.filter((id) => id !== a.id)
                                : [...p.favorites, a.id],
                            })
                          }
                        >
                          <Heart
                            size={14}
                            fill={
                              p.favorites.includes(a.id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </div>
                    ))}
                </div>
                <label className="studio-upload">
                  <Upload size={17} />
                  Bring your own background
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    onChange={(e) => void upload(e)}
                    hidden
                  />
                </label>
                <p className="studio-help">
                  <CloudOff size={13} /> Personal files stay on this device.
                  Images up to 20 MB.
                </p>
                <details className="studio-details">
                  <summary>
                    <Settings2 size={15} />
                    Scene adjustments
                  </summary>
                  <Range
                    label="Readability overlay"
                    value={p.overlay}
                    onChange={(v) => update({ overlay: v })}
                  />
                  <Range
                    label="Brightness"
                    value={p.brightness}
                    min={0.25}
                    max={1.5}
                    onChange={(v) => update({ brightness: v })}
                  />
                  <Range
                    label="Blur"
                    value={p.blur}
                    max={20}
                    step={1}
                    onChange={(v) => update({ blur: v })}
                  />
                  <Range
                    label="Horizontal position"
                    value={p.focalX}
                    max={100}
                    step={1}
                    onChange={(v) => update({ focalX: v })}
                  />
                  <Range
                    label="Vertical position"
                    value={p.focalY}
                    max={100}
                    step={1}
                    onChange={(v) => update({ focalY: v })}
                  />
                  <label className="studio-check">
                    <input
                      type="checkbox"
                      checked={p.motionEnabled}
                      onChange={(e) =>
                        update({ motionEnabled: e.target.checked })
                      }
                    />
                    Enable motion scenes
                  </label>
                  <label className="studio-check">
                    <input
                      type="checkbox"
                      checked={p.shuffleAtBoundary}
                      onChange={(e) =>
                        update({ shuffleAtBoundary: e.target.checked })
                      }
                    />
                    Shuffle favorites between sessions
                  </label>
                  <button
                    className="studio-text-button"
                    onClick={() =>
                      update({
                        sceneId: "",
                        breakSceneId: "",
                        overlay: 0.35,
                        blur: 0,
                        brightness: 1,
                        focalX: 50,
                        focalY: 50,
                      })
                    }
                  >
                    Reset to quiet background
                  </button>
                </details>
                {scene && (
                  <p className="studio-credit">
                    {scene.title} · {scene.creator} · {scene.license}
                    {scene.sourceUrl && (
                      <a
                        href={scene.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source
                      </a>
                    )}
                  </p>
                )}
              </>
            )}
            {panel === "sound" && (
              <FocusAudioPanel
                preferences={p}
                media={media}
                musicMissing={musicMissing}
                onUpdate={update}
                onUpload={upload}
                onMessage={setMessage}
                Range={Range}
              />
            )}
            {panel === "recipes" && (
              <>
                <p className="studio-panel-intro">
                  Your atmosphere, rhythm and intention. Ready in a moment.
                </p>
                <div className="studio-recipe-list">
                  {recipes.map((r) => {
                    const cover = resolveAsset(r.sceneId, media.scenes);
                    return (
                      <article
                        key={r.id}
                        className={p.recipeId === r.id ? "selected" : ""}
                      >
                        {cover && (
                          <img
                            src={cover.thumbnail || cover.src}
                            alt=""
                            loading="lazy"
                          />
                        )}
                        <button onClick={() => selectRecipe(r)}>
                          <span>{r.name}</span>
                          <small>{r.description}</small>
                          <em>
                            {r.timer.mode === "stopwatch"
                              ? "Your own pace"
                              : `${r.timer.focusMinutes}/${r.timer.shortBreakMinutes}`}{" "}
                            ·{" "}
                            {r.layers.length
                              ? `${r.layers.length} sound layers`
                              : "Quiet space"}
                          </em>
                        </button>
                        <div className="studio-recipe-actions">
                          <button
                            aria-label={`Export ${r.name} recipe`}
                            onClick={() =>
                              downloadFile(
                                shareableRecipe(r),
                                `${r.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.flowtask.json`,
                                "application/json",
                              )
                            }
                          >
                            <Download size={15} />
                          </button>
                          <button
                            aria-label={`Duplicate ${r.name} recipe`}
                            onClick={() =>
                              saveRecipes([
                                ...recipes,
                                {
                                  ...r,
                                  id: crypto.randomUUID(),
                                  name: `${r.name} copy`.slice(0, 80),
                                  builtIn: false,
                                },
                              ])
                            }
                          >
                            <Plus size={15} />
                          </button>
                          {r.builtIn && <button aria-label={`Favorite recipe ${r.name}`} aria-pressed={r.favorite} onClick={()=>saveRecipes(recipes.map(x=>x.id===r.id?{...x,favorite:!x.favorite}:x))}><Heart size={14} fill={r.favorite?'currentColor':'none'}/></button>}
                          {!r.builtIn && (
                            <>
                              <button
                                aria-label={`Favorite ${r.name} recipe`}
                                aria-pressed={r.favorite}
                                onClick={() =>
                                  saveRecipes(
                                    recipes.map((x) =>
                                      x.id === r.id
                                        ? { ...x, favorite: !x.favorite }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <Heart
                                  size={15}
                                  fill={r.favorite ? "currentColor" : "none"}
                                />
                              </button>
                              <button
                                aria-label={`Delete ${r.name} recipe`}
                                onClick={() =>
                                  saveRecipes(
                                    recipes.filter((x) => x.id !== r.id),
                                  )
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
                <h3>Make it your own</h3>
                <label className="studio-field">
                  Recipe name
                  <input
                    maxLength={80}
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="My Sunday study room"
                  />
                </label>
                <button
                  className="studio-secondary"
                  disabled={!recipeName.trim()}
                  onClick={saveRecipe}
                >
                  <Plus size={16} />
                  Save current setup
                </button>
                {recipes.some(r=>r.id===p.recipeId && !r.builtIn) && <button className="studio-secondary" onClick={()=>{
                  saveRecipes(recipes.map(r=>r.id===p.recipeId?{...r,name:recipeName.trim().slice(0,80)||r.name,sceneId:p.sceneId,breakSceneId:p.breakSceneId,layers:p.layers,musicId:p.musicId,musicVolume:p.musicVolume,timer:p.timer,taskSource:p.taskSource,initialPhase:currentPhase}:r));
                  setRecipeName('');setMessage('Recipe updated for next time.');
                }}>Update selected recipe</button>}
                <label className="studio-upload">
                  <Upload size={16} />
                  Import a recipe
                  <input
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(e) => void importRecipe(e)}
                  />
                </label>
                <p className="studio-help">
                  Exports contain your setup, never private task titles or
                  personal files.
                </p>
              </>
            )}
            {panel === "notes" && (
              <>
                <p className="studio-panel-intro">
                  Park a thought here. Your work will be waiting.
                </p>
                <label className="studio-field">
                  Focus scratchpad
                  <textarea
                    ref={noteRef}
                    rows={10}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="A thought, a reminder, the next little step…"
                  />
                </label>
                <button
                  className="studio-secondary"
                  onClick={captureTask}
                  disabled={!note.trim()}
                >
                  <Plus size={16} />
                  Capture selection as a task
                </button>
                {task && (
                  <button
                    className="studio-text-button"
                    onClick={() => {
                      const text =
                        noteRef.current?.value
                          .slice(
                            noteRef.current.selectionStart,
                            noteRef.current.selectionEnd,
                          )
                          .trim() || note.trim();
                      if (text) {
                        ctx.addSubTask(task.id, text.slice(0, 1000));
                        setMessage("Added to the current task as a subtask.");
                      }
                    }}
                  >
                    Add selection as a subtask
                  </button>
                )}
                <label className="studio-field">
                  Where will you pick up?
                  <input
                    maxLength={500}
                    value={task?.nextAction || p.nextAction}
                    onChange={(e) =>
                      task
                        ? ctx.updateTask(task.id, {
                            nextAction: e.target.value,
                          })
                        : update({ nextAction: e.target.value })
                    }
                    placeholder="The very next action, when you return"
                  />
                </label>
                <button
                  className="studio-secondary"
                  disabled={!active}
                  onClick={() => {
                    finish("interrupted");
                    setMessage(
                      "Your next step is saved. Come back when you are ready.",
                    );
                  }}
                >
                  <Coffee size={16} />
                  Save context & take a break
                </button>
                <p className="studio-help">
                  Your scratchpad stays in this workspace on this device.
                </p>
              </>
            )}
            {panel === "timer" && (
              <>
                <p className="studio-panel-intro">
                  Structure when you need it. Flexibility when you don't.
                </p>
                <label className="studio-field">
                  Timer mode
                  <select
                    value={p.timer.mode}
                    onChange={(e) =>
                      updateTimer({
                        mode: e.target.value as TimerConfiguration["mode"],
                      })
                    }
                  >
                    <option value="pomodoro">Pomodoro · work and rest</option>
                    <option value="countdown">Single countdown</option>
                    <option value="stopwatch">Open-ended stopwatch</option>
                    <option value="sprint">Study sprint</option>
                  </select>
                </label>
                <div className="studio-chips">
                  {[25, 50].map((m) => (
                    <button
                      key={m}
                      onClick={() =>
                        updateTimer({
                          focusMinutes: m,
                          shortBreakMinutes: m === 50 ? 10 : 5,
                        })
                      }
                    >
                      {m}/{m === 50 ? 10 : 5}
                    </button>
                  ))}
                </div>
                {(
                  [
                    { key: "focusMinutes", label: "Focus minutes", max: 240 },
                    {
                      key: "shortBreakMinutes",
                      label: "Short break minutes",
                      max: 60,
                    },
                    {
                      key: "longBreakMinutes",
                      label: "Long break minutes",
                      max: 60,
                    },
                    {
                      key: "cyclesBeforeLongBreak",
                      label: "Sessions before long break",
                      max: 12,
                    },
                  ] as const
                ).map((field) => (
                  <label className="studio-field" key={field.key}>
                    {field.label}
                    <input
                      type="number"
                      min={1}
                      max={field.max}
                      value={p.timer[field.key]}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 1 && n <= field.max)
                          updateTimer({ [field.key]: n });
                      }}
                    />
                  </label>
                ))}
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={p.timer.autoStart}
                    onChange={(e) =>
                      updateTimer({ autoStart: e.target.checked })
                    }
                  />
                  Automatically start the next interval
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={p.breakPrompts}
                    onChange={(e) => update({ breakPrompts: e.target.checked })}
                  />
                  Gentle break suggestions
                </label>
                <label className="studio-check">
                  <input
                    type="checkbox"
                    checked={p.timerStyle === "ring"}
                    onChange={(e) =>
                      update({
                        timerStyle: e.target.checked ? "ring" : "digital",
                      })
                    }
                  />
                  Show progress ring
                </label>
                {timer.mode === "pomodoro" &&
                  Boolean(active && ((active.pomodoroCycle && active.pomodoroCycle > 1) || active.pomodoroPhase !== "focus")) && (
                    <div className="studio-restart-round-section" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <button
                        type="button"
                        className="studio-secondary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        disabled={!active}
                        onClick={handleRestartRoundClick}
                        aria-label="Restart Pomodoro round from cycle 1"
                        title="Restart Pomodoro round"
                      >
                        <RotateCcw size={15} />
                        <span>Restart round (Cycle 1)</span>
                      </button>
                      <p className="studio-help" style={{ marginTop: '0.25rem' }}>
                        Resets your Pomodoro sequence back to cycle 1 of {timer.cyclesBeforeLongBreak}.
                      </p>
                    </div>
                  )}
                <button
                  className="studio-secondary"
                  onClick={() => {
                    onClose();
                    openModal("studySession");
                  }}
                >
                  Configure a structured study sprint
                  <ArrowRight size={16} />
                </button>
                <h3>Take your space offline</h3>
                <button
                  className="studio-secondary"
                  disabled={!!downloadProgress}
                  onClick={() => void downloadPack()}
                >
                  <Download size={16} />
                  {downloadProgress
                    ? `Downloading ${downloadProgress}`
                    : "Download starter pack"}
                </button>
                {downloadProgress && (
                  <button
                    className="studio-text-button"
                    onClick={() => packAbort.current?.abort()}
                  >
                    Cancel download
                  </button>
                )}
                <p className="studio-help">
                  Eight scenes, four ambient layers and two tracks. Only chosen
                  media is downloaded.
                </p>
                <button
                  className="studio-text-button"
                  onClick={() =>
                    void mediaService
                      .usage()
                      .then((info) =>
                        setStorageUsage(
                          `${(info.usage / 1024 / 1024).toFixed(1)} MB used on this device`,
                        ),
                      )
                  }
                >
                  Check storage usage
                </button>
                {storageUsage && <p className="studio-help">{storageUsage}</p>}
                <button
                  className="studio-text-button"
                  onClick={() =>
                    void mediaService
                      .clearDownloads()
                      .then(() =>
                        setMessage(
                          "Downloaded media cleared. Your tasks and personal uploads are safe.",
                        ),
                      )
                  }
                >
                  Clear downloaded media
                </button>
                <details className="studio-details">
                  <summary>Personal files on this device</summary>
                  <p className="studio-help">
                    Personal images and audio are exported separately from JSON
                    workspace backups.
                  </p>
                  {[...media.scenes, ...media.audio]
                    .filter((a) => a.id.startsWith("local:"))
                    .map((a) => (
                      <div className="studio-personal-file" key={a.id}>
                        <span>{a.title}</span>
                        <button
                          aria-label={`Export ${a.title}`}
                          onClick={() =>
                            void mediaService
                              .list(ctx.workspaceId)
                              .then((records) => {
                                const record = records.find(
                                  (r) => r.id === a.id,
                                );
                                if (record)
                                  downloadBlob(
                                    record.blob,
                                    `${record.title}.${record.kind === "image" ? "webp" : record.blob.type.includes("mpeg") ? "mp3" : record.blob.type.includes("wav") ? "wav" : record.blob.type.includes("ogg") ? "ogg" : record.blob.type.includes("webm") ? "webm" : record.blob.type.includes("aac") ? "aac" : "m4a"}`,
                                  );
                              })
                          }
                        >
                          <Download size={15} />
                        </button>
                        <button
                          aria-label={`Remove ${a.title}`}
                          onClick={() => void removePersonalAsset(a.id, a.title)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                </details>
              </>
            )}
            {panel === "queue" && (
              <>
                <label className="studio-field">
                  Build your queue from
                  <select
                    value={p.taskSource}
                    onChange={(e) =>
                      update({
                        taskSource: e.target.value as
                          "top3" | "project" | "manual",
                      })
                    }
                  >
                    <option value="top3">Today's Top 3</option>
                    <option value="project">A project</option>
                    <option value="manual">Choose tasks</option>
                  </select>
                </label>
                {p.taskSource === "project" && (
                  <label className="studio-field">
                    Project
                    <select
                      value={p.projectId}
                      onChange={(e) => update({ projectId: e.target.value })}
                    >
                      <option value="">Select a project</option>
                      {ctx.projects
                        .filter((project) => !project.isArchived)
                        .map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <div className="studio-queue">
                  {(p.taskSource === "manual" ? availableTasks : queue).map(
                    (t) => (
                      <div
                        key={t.id}
                        className={selectedTask === t.id ? "selected" : ""}
                      >
                        {p.taskSource === "manual" && (
                          <input
                            type="checkbox"
                            aria-label={`Queue ${t.title}`}
                            checked={p.queue.includes(t.id)}
                            onChange={(e) =>
                              update({
                                queue: e.target.checked
                                  ? [...p.queue, t.id]
                                  : p.queue.filter((id) => id !== t.id),
                              })
                            }
                          />
                        )}
                        <button
                          disabled={!!active}
                          onClick={() => {
                            setSelectedTask(t.id);
                            setPanel(null);
                          }}
                        >
                          <span>{t.title}</span>
                          <small>
                            {
                              ctx.projects.find(
                                (project) => project.id === t.projectId,
                              )?.name
                            }{" "}
                            · {t.estimatedMinutes || 25} min
                          </small>
                          {t.subtasks.length > 0 && (
                            <small>
                              {t.subtasks.filter((s) => s.completed).length}/
                              {t.subtasks.length} steps complete
                            </small>
                          )}
                        </button>
                        {selectedTask === t.id && <Check size={16} />}
                      </div>
                    ),
                  )}
                </div>
                {!(p.taskSource === "manual" ? availableTasks : queue)
                  .length && (
                  <p className="studio-panel-intro">
                    A little space to begin. Choose another task source, or
                    start a session without a task.
                  </p>
                )}
                <button
                  className="studio-text-button"
                  disabled={!!active}
                  onClick={() => {
                    setSelectedTask("");
                    setPanel(null);
                  }}
                >
                  Focus without a task
                </button>
              </>
            )}
          </div>
        </aside>
      )}
      {showSummary && (
        <section className="studio-summary" aria-label="Session reflection">
          <button
            className="studio-summary-close"
            aria-label="Dismiss reflection"
            onClick={() => setSummaryDismissed(last.finishedAt)}
          >
            <X size={16} />
          </button>
          <span className="studio-eyebrow">
            {last.session.pomodoroPhase === "focus"
              ? "A LITTLE PROGRESS, MADE"
              : "A LITTLE ROOM TO RECHARGE"}
          </span>
          <h2>
            {last.session.outcome === "interrupted"
              ? "Ready when you return."
              : "That was time well spent."}
          </h2>
          <p>
            {last.seconds < 60
              ? `${last.seconds}s`
              : `${Math.floor(last.seconds / 60)} min${last.seconds % 60 ? ` ${last.seconds % 60}s` : ""}`}{" "}
            {last.session.pomodoroPhase === "focus" ? "focused" : "of rest"}
            {last.session.taskTitle ? ` · ${last.session.taskTitle}` : ""}
          </p>
          <div className="studio-reflection">
            <span>How did it feel?</span>
            {(
              [
                { label: "Scattered", value: 1 },
                { label: "Steady", value: 2 },
                { label: "In flow", value: 3 },
              ] as const
            ).map((r) => (
              <button key={r.value} onClick={() => rate(r.value)}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="studio-summary-actions">
            <button onClick={() => void start("focus", 5)}>
              Continue 5 min
            </button>
            <button
              className="studio-primary"
              onClick={() => {
                if (
                  last.session.timerConfiguration?.mode === "stopwatch" ||
                  last.session.timerConfiguration?.mode === "countdown"
                ) {
                  void start("focus");
                } else {
                  void start(last.nextPhase);
                }
              }}
            >
              {last.session.timerConfiguration?.mode === "stopwatch" ||
              last.session.timerConfiguration?.mode === "countdown"
                ? "Start new session"
                : last.nextPhase === "focus"
                  ? "Back to focus"
                  : "Take a break"}
              <ArrowRight size={15} />
            </button>
          </div>
          {last.session.taskId && (
            <button
              className="studio-text-button"
              onClick={() => {
                if (
                  ctx.tasks.find((t) => t.id === last.session.taskId)
                    ?.status !== "done"
                )
                  ctx.toggleTaskStatus(last.session.taskId!);
                const next = queue.find((t) => t.id !== last.session.taskId);
                setSelectedTask(next?.id || "");
                setSummaryDismissed(last.finishedAt);
              }}
            >
              Mark task done
              {queue.some((t) => t.id !== last.session.taskId)
                ? " & move to the next"
                : ""}
            </button>
          )}
        </section>
      )}
      <ResetConfirmationDialog
        isOpen={resetConfirmMode !== null}
        onClose={() => {
          if (wasRunningBeforeReset.current) {
            ctx.resumeFocusSession();
          }
          setResetConfirmMode(null);
        }}
        onConfirmSave={() => {
          if (resetConfirmMode === "restartRound") {
            ctx.restartFocusRound("save", active?.id);
          } else {
            ctx.resetFocusSession("save", active?.id);
          }
          setResetConfirmMode(null);
        }}
        onConfirmDiscard={() => {
          if (resetConfirmMode === "restartRound") {
            ctx.restartFocusRound("discard", active?.id);
          } else {
            ctx.resetFocusSession("discard", active?.id);
          }
          setResetConfirmMode(null);
        }}
        elapsedSeconds={elapsed}
        taskTitle={active?.taskTitle || task?.title}
        phase={currentPhase}
        isRoundRestart={resetConfirmMode === "restartRound"}
      />
    </div>
  );
}
import '../../styles/focus-studio.css';
import '../../styles/studio-appearance.css';
import '../../styles/calm-studio.css';
