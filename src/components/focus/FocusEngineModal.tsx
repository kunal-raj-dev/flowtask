import { appShortcutAllowed } from '../../services/shortcutRuntime';
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useContext,
} from 'react';
import { WorkspaceStoreContext } from '../../services/workspaceStore';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  X,
  Waves,
  Headphones,
  CloudRain,
  Flame,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { useFocusStore, useFocusElapsedSeconds } from '../../store/useFocusStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useTaskContext } from '../../context/TaskContext';
import { useWakeLock } from '../../hooks/useWakeLock';
import {
  pictureInPictureService,
  isDocumentPipSupported,
} from '../../services/pictureInPictureService';
import {
  updateMediaSessionMetadata,
  registerMediaSessionHandlers,
} from '../../services/studioAudio';
import { audioEngine } from '../../utils/audioEngine';
import celebrate from '../../utils/celebrate';
import { formatTimerClock } from '../../utils/focusTimeFormat';
import { FEATURED_ROOMS, roomImage } from '../../services/featuredRooms';
import type { SubTask, TargetDifficulty } from '../../types/task';

export type FocusEngineMode = 'zen' | 'studio' | 'sprint';

export interface FocusEngineModalProps {
  isOpen?: boolean;
  taskId?: string | null;
  initialMode?: FocusEngineMode;
  initialPhase?: 'focus' | 'short_break' | 'long_break' | string;
  initialPanel?: string;
  onClose: () => void;
}

export interface StudioTrackVolumes {
  binaural: number;
  brown: number;
  rain: number;
  campfire: number;
  master: number;
}

export const openDocumentPip = async () => {
  return pictureInPictureService.requestPipWindow({ width: 340, height: 200 });
};

export const closeDocumentPip = () => {
  pictureInPictureService.closePipWindow();
};

/**
 * Genuine Web Audio synthesizer engine for Lo-Fi Studio multi-track ambient mixer.
 * Synthesizes Binaural Beats (40Hz difference), Brown Noise, Rain, and Campfire.
 */
class StudioMixerSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private binauralGain: GainNode | null = null;
  private brownGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private campfireGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private isInitialized = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          // AudioContext blocked or unavailable
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public init() {
    if (this.isInitialized) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, ctx.currentTime);
      this.masterGain.connect(ctx.destination);

      // 1. Binaural Beats (190Hz & 230Hz sine waves -> 40Hz gamma/focus difference)
      this.binauralGain = ctx.createGain();
      this.binauralGain.gain.setValueAtTime(0, ctx.currentTime);
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(190, ctx.currentTime);
      osc2.frequency.setValueAtTime(230, ctx.currentTime);

      if (typeof ctx.createStereoPanner === 'function') {
        const left = ctx.createStereoPanner();
        left.pan.value = -1;
        const right = ctx.createStereoPanner();
        right.pan.value = 1;
        osc1.connect(left);
        left.connect(this.binauralGain);
        osc2.connect(right);
        right.connect(this.binauralGain);
      } else {
        osc1.connect(this.binauralGain);
        osc2.connect(this.binauralGain);
      }
      osc1.start();
      osc2.start();
      this.oscillators.push(osc1, osc2);
      this.binauralGain.connect(this.masterGain);

      // 2. Brown Noise (Integrated random walk lowpass filtered at 380Hz)
      this.brownGain = ctx.createGain();
      this.brownGain.gain.setValueAtTime(0, ctx.currentTime);
      const brownBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
      const brownData = brownBuf.getChannelData(0);
      let lastBrown = 0;
      for (let i = 0; i < brownBuf.length; i++) {
        const white = Math.random() * 2 - 1;
        lastBrown = (lastBrown + 0.02 * white) / 1.02;
        brownData[i] = lastBrown * 3.5;
      }
      const brownSource = ctx.createBufferSource();
      brownSource.buffer = brownBuf;
      brownSource.loop = true;
      const brownFilter = ctx.createBiquadFilter();
      brownFilter.type = 'lowpass';
      brownFilter.frequency.setValueAtTime(380, ctx.currentTime);
      brownSource.connect(brownFilter);
      brownFilter.connect(this.brownGain);
      brownSource.start();
      this.sources.push(brownSource);
      this.brownGain.connect(this.masterGain);

      // 3. Rain Soundscape (Bandpass filtered pink noise at 1400Hz, Q=0.8)
      this.rainGain = ctx.createGain();
      this.rainGain.gain.setValueAtTime(0, ctx.currentTime);
      const rainBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
      const rainData = rainBuf.getChannelData(0);
      let r0 = 0,
        r1 = 0,
        r2 = 0;
      for (let i = 0; i < rainBuf.length; i++) {
        const white = Math.random() * 2 - 1;
        r0 = 0.998 * r0 + white * 0.06;
        r1 = 0.99 * r1 + white * 0.08;
        r2 = 0.95 * r2 + white * 0.16;
        rainData[i] = (r0 + r1 + r2) * 0.2;
      }
      const rainSource = ctx.createBufferSource();
      rainSource.buffer = rainBuf;
      rainSource.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.setValueAtTime(1400, ctx.currentTime);
      rainFilter.Q.setValueAtTime(0.8, ctx.currentTime);
      rainSource.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      rainSource.start();
      this.sources.push(rainSource);
      this.rainGain.connect(this.masterGain);

      // 4. Campfire Crackle (Warm low rumble + random crackle impulses)
      this.campfireGain = ctx.createGain();
      this.campfireGain.gain.setValueAtTime(0, ctx.currentTime);
      const campBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
      const campData = campBuf.getChannelData(0);
      let lastCamp = 0;
      for (let i = 0; i < campBuf.length; i++) {
        const white = Math.random() * 2 - 1;
        lastCamp = (lastCamp + 0.015 * white) / 1.015;
        const crackle = Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.8 : 0;
        campData[i] = lastCamp * 2.8 + crackle;
      }
      const campSource = ctx.createBufferSource();
      campSource.buffer = campBuf;
      campSource.loop = true;
      const campFilter = ctx.createBiquadFilter();
      campFilter.type = 'lowpass';
      campFilter.frequency.setValueAtTime(450, ctx.currentTime);
      campSource.connect(campFilter);
      campFilter.connect(this.campfireGain);
      campSource.start();
      this.sources.push(campSource);
      this.campfireGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch {
      // Audio graph initialization error guard
    }
  }

  public setVolumes(volumes: StudioTrackVolumes, muted = false) {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = muted ? 0 : Math.max(0, Math.min(1, volumes.master));

    try {
      this.masterGain?.gain.setTargetAtTime(master, now, 0.05);
      this.binauralGain?.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volumes.binaural)),
        now,
        0.05
      );
      this.brownGain?.gain.setTargetAtTime(Math.max(0, Math.min(1, volumes.brown)), now, 0.05);
      this.rainGain?.gain.setTargetAtTime(Math.max(0, Math.min(1, volumes.rain)), now, 0.05);
      this.campfireGain?.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volumes.campfire)),
        now,
        0.05
      );
    } catch {
      // Audio volume automation guard
    }
  }

  public dispose() {
    this.oscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.sources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.oscillators = [];
    this.sources = [];
    try {
      this.masterGain?.disconnect();
      this.ctx?.close().catch(() => {});
    } catch {}
    this.ctx = null;
    this.isInitialized = false;
  }
}

export const FocusEngineModal: React.FC<FocusEngineModalProps> = ({
  isOpen = true,
  taskId: propTaskId = null,
  initialMode = 'zen',
  initialPhase = 'focus',
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Domain Store & Context
  const storeTasks = useTaskStore((s) => s.tasks);
  const taskContext = useTaskContext();
  const workspaceStore = useContext(WorkspaceStoreContext);
  const tasks = taskContext?.tasks || storeTasks;

  const focusSession = useFocusStore((s) => s.focusSession);
  const liveElapsedSeconds = useFocusElapsedSeconds();
  const legacyStart = useFocusStore((s) => s.startFocusSession);
  const legacyPause = useFocusStore((s) => s.pauseFocusSession);
  const legacyResume = useFocusStore((s) => s.resumeFocusSession);
  const legacyStop = useFocusStore((s) => s.stopFocusSession);
  const legacyUpdate = useFocusStore((s) => s.updateFocusSession);
  const legacySwitch = useFocusStore((s) => s.switchSubtask);
  const startFocusSession = workspaceStore ? taskContext.startFocusSession : legacyStart;
  const pauseFocusSession = workspaceStore ? taskContext.pauseFocusSession : legacyPause;
  const resumeFocusSession = workspaceStore ? taskContext.resumeFocusSession : legacyResume;
  const stopFocusSession = workspaceStore ? taskContext.stopFocusSession : legacyStop;
  const updateFocusSession = workspaceStore ? taskContext.updateFocusSession : legacyUpdate;
  const switchSubtask = workspaceStore ? taskContext.switchFocusSubtask : legacySwitch;

  // Mode Selection: 'zen' | 'studio' | 'sprint'
  const [mode, setMode] = useState<FocusEngineMode>(() => {
    if (focusSession?.mode === 'sprint') return 'sprint';
    return initialMode;
  });

  // Pomodoro Phase: 'focus' | 'short_break' | 'long_break'
  const [phase, setPhase] = useState<'focus' | 'short_break' | 'long_break'>(() => {
    if (
      initialPhase === 'short_break' ||
      initialPhase === 'long_break' ||
      initialPhase === 'focus'
    ) {
      return initialPhase;
    }
    return 'focus';
  });

  // Selected Task
  const effectiveTaskId = propTaskId || focusSession?.taskId || null;
  const task = useMemo(() => {
    if (effectiveTaskId) {
      const found = tasks.find((t) => t.id === effectiveTaskId);
      if (found) return found;
    }
    return tasks[0] || null;
  }, [effectiveTaskId, tasks]);

  // Subtasks for Sprint mode
  const subtasks = useMemo<SubTask[]>(() => task?.subtasks || [], [task?.subtasks]);

  const [activeSubtaskIndex, setActiveSubtaskIndex] = useState(() => {
    if (focusSession?.subtaskId && subtasks.length > 0) {
      const idx = subtasks.findIndex((s) => s.id === focusSession.subtaskId);
      if (idx >= 0) return idx;
    }
    const firstUnsolved = subtasks.findIndex((s) => !s.completed);
    return firstUnsolved >= 0 ? firstUnsolved : 0;
  });

  const currentSubtask: SubTask | undefined = subtasks[activeSubtaskIndex];

  // Duration settings
  const phaseDurations = useMemo(
    () => ({
      focus: 25 * 60,
      short_break: 5 * 60,
      long_break: 15 * 60,
    }),
    []
  );

  // Banked seconds for sprint runner
  const [bankedSeconds, setBankedSeconds] = useState(0);

  // Studio scene and audio mixer state
  const [sceneId, setSceneId] = useState<string>('rainy-desk');
  const [mixerVolumes, setMixerVolumes] = useState<StudioTrackVolumes>({
    binaural: 0.35,
    brown: 0.4,
    rain: 0.4,
    campfire: 0.3,
    master: 0.8,
  });
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const mixerRef = useRef<StudioMixerSynthesizer | null>(null);

  // Fullscreen & PiP states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(() => pictureInPictureService.isOpen());

  // Running status
  const isRunning = focusSession?.state === 'running';

  // Screen Wake Lock keeps display awake during active sessions
  useWakeLock(isRunning);

  // Synchronize Picture-in-Picture status
  useEffect(() => {
    return pictureInPictureService.subscribe((open) => {
      setIsPipActive(open);
    });
  }, []);

  // Web Audio Mixer initialization and volume updates
  useEffect(() => {
    if (mode === 'studio' && isRunning && !isAudioMuted) {
      if (!mixerRef.current) {
        mixerRef.current = new StudioMixerSynthesizer();
      }
      mixerRef.current.setVolumes(mixerVolumes, isAudioMuted);
    } else if (mixerRef.current) {
      mixerRef.current.setVolumes(mixerVolumes, true);
    }
  }, [mode, isRunning, mixerVolumes, isAudioMuted]);

  // Clean up synthesizer on unmount
  useEffect(() => {
    return () => {
      mixerRef.current?.dispose();
      mixerRef.current = null;
    };
  }, []);

  // Phase transition handler: updates phase and synchronizes target duration to active session
  const handlePhaseChange = useCallback(
    (newPhase: 'focus' | 'short_break' | 'long_break') => {
      setPhase(newPhase);
      const newTarget = phaseDurations[newPhase];
      if (focusSession) {
        updateFocusSession({
          targetDurationSec: newTarget,
          pacingSecondsPerUnit: newTarget,
        });
      }
      try {
        audioEngine.playClickSound();
      } catch {}
    },
    [focusSession, phaseDurations, updateFocusSession]
  );

  // Compute countdown target duration
  const targetDurationSec = useMemo(() => {
    if (mode === 'zen') {
      return phaseDurations[phase];
    }
    if (focusSession?.targetDurationSec) {
      return focusSession.targetDurationSec;
    }
    if (mode === 'sprint') {
      if (currentSubtask?.estimatedMinutes && currentSubtask.estimatedMinutes > 0) {
        return currentSubtask.estimatedMinutes * 60;
      }
      return 30 * 60;
    }
    return phaseDurations[phase];
  }, [mode, phase, phaseDurations, focusSession?.targetDurationSec, currentSubtask]);

  const elapsedSec = focusSession ? liveElapsedSeconds : 0;
  const remainingSec = Math.max(0, targetDurationSec - elapsedSec);
  const formattedCountdown = formatTimerClock(remainingSec);

  // Next action description
  const nextActionStep = useMemo(() => {
    if (task?.nextAction) return task.nextAction;
    if (currentSubtask?.title) return currentSubtask.title;
    return 'Take the first small intentional step';
  }, [task?.nextAction, currentSubtask]);

  // Play / Pause toggle
  const handleTogglePlayPause = useCallback(() => {
    if (isRunning) {
      pauseFocusSession();
    } else if (focusSession && focusSession.state === 'paused') {
      resumeFocusSession();
    } else {
      const modeName = mode === 'sprint' ? 'sprint' : 'pomodoro';
      const targetSec =
        mode === 'sprint'
          ? (currentSubtask?.estimatedMinutes || 30) * 60
          : phaseDurations[phase];

      startFocusSession(
        modeName,
        task?.id || null,
        task?.title || 'Deep Focus Session',
        targetSec,
        currentSubtask?.id || null,
        currentSubtask?.title || null,
        targetSec
      );
    }
    try {
      audioEngine.playClickSound();
    } catch {}
  }, [
    isRunning,
    focusSession,
    mode,
    phase,
    task,
    currentSubtask,
    phaseDurations,
    pauseFocusSession,
    resumeFocusSession,
    startFocusSession,
  ]);

  // Complete current task
  const handleCompleteTask = useCallback(() => {
    if (task) {
      taskContext?.toggleTaskStatus?.(task.id);
    }
    try {
      audioEngine.playRuleOf3Fanfare();
      celebrate({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch {}
  }, [task, taskContext]);

  // Sprint: Mark current subtask completed and advance to next
  const handleMarkSolvedAndNext = useCallback(() => {
    if (!currentSubtask || !task || currentSubtask.completed) return;

    // 1. Calculate surplus seconds for banked time
    const stepTarget = (currentSubtask.estimatedMinutes || 30) * 60;
    const surplus = stepTarget - elapsedSec;
    setBankedSeconds((prev) => prev + surplus);

    // 2. Mark current subtask complete
    taskContext?.toggleSubTask?.(task.id, currentSubtask.id);

    // 3. Audio & Confetti
    try {
      audioEngine.playRuleOf3Fanfare();
      celebrate({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
    } catch {}

    // 4. Advance to next uncompleted subtask or cleanly finish session if all done
    const nextUnsolved = subtasks.findIndex((s, idx) => idx > activeSubtaskIndex && !s.completed && s.id !== currentSubtask.id);
    if (nextUnsolved >= 0) {
      const nextSub = subtasks[nextUnsolved];
      const nextTargetSec = (nextSub?.estimatedMinutes || 30) * 60;
      setActiveSubtaskIndex(nextUnsolved);
      if (focusSession && switchSubtask && nextSub) {
        switchSubtask(nextSub.id, nextSub.title, nextTargetSec);
      }
    } else {
      stopFocusSession();
    }
  }, [
    currentSubtask,
    task,
    elapsedSec,
    activeSubtaskIndex,
    subtasks,
    focusSession,
    switchSubtask,
    taskContext,
    stopFocusSession,
  ]);

  // Reset timer
  const handleResetTimer = useCallback(() => {
    stopFocusSession();
    try {
      audioEngine.playClickSound();
    } catch {}
  }, [stopFocusSession]);

  // Document PiP Toggle
  const handleTogglePip = useCallback(async () => {
    if (pictureInPictureService.isOpen()) {
      pictureInPictureService.closePipWindow();
      setIsPipActive(false);
    } else {
      try {
        await openDocumentPip();
        setIsPipActive(true);
      } catch (err) {
        console.warn('[FocusEngine] Document PiP failed:', err);
      }
    }
  }, []);

  // Fullscreen Toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Synchronize fullscreen state from document events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Media Session API Integration
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const taskTitle = task?.title || 'Deep Focus Session';
    const albumName =
      mode === 'zen' ? 'Zen Minimalist' : mode === 'studio' ? 'Lo-Fi Studio' : 'Step-by-Step Sprint';

    updateMediaSessionMetadata({
      title: taskTitle,
      artist: 'FlowTask Focus',
      album: albumName,
    });

    registerMediaSessionHandlers({
      onPlay: () => {
        handleTogglePlayPause();
      },
      onPause: () => {
        pauseFocusSession();
      },
      onStop: () => {
        stopFocusSession();
        onClose();
      },
      onNextTrack: () => {
        if (mode === 'sprint') {
          handleMarkSolvedAndNext();
        }
      },
    });

    try {
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (mode === 'sprint' && activeSubtaskIndex > 0) {
          const prevIdx = activeSubtaskIndex - 1;
          const prevSub = subtasks[prevIdx];
          setActiveSubtaskIndex(prevIdx);
          if (focusSession && switchSubtask && prevSub) {
            switchSubtask(prevSub.id, prevSub.title, (prevSub.estimatedMinutes || 30) * 60);
          }
        }
      });
    } catch {}

    try {
      navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused';
    } catch {}
  }, [
    task?.title,
    mode,
    isRunning,
    focusSession,
    activeSubtaskIndex,
    subtasks,
    handleTogglePlayPause,
    handleMarkSolvedAndNext,
    pauseFocusSession,
    stopFocusSession,
    switchSubtask,
    onClose,
  ]);

  // Keyboard Shortcuts: Space (play/pause), Enter (next/complete), p (PiP), f (fullscreen), Esc (dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && !appShortcutAllowed(e)) return;
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleTogglePlayPause();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'sprint') {
          handleMarkSolvedAndNext();
        } else {
          handleCompleteTask();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        void handleTogglePip();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleTogglePlayPause,
    handleMarkSolvedAndNext,
    handleCompleteTask,
    handleTogglePip,
    toggleFullscreen,
    mode,
    onClose,
  ]);

  // Mode Transition Handler (preserves running timer without reset)
  const handleModeChange = (newMode: FocusEngineMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    if (focusSession) {
      updateFocusSession({
        mode: newMode === 'sprint' ? 'sprint' : 'pomodoro',
      });
    }
    try {
      audioEngine.playClickSound();
    } catch {}
  };

  if (!isOpen) return null;

  // Subtask completion stats for sprint mode
  const completedSubtasksCount = subtasks.filter((s) => s.completed).length;
  const sprintProgressPercent =
    subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;

  const renderDifficultyBadge = (diff?: TargetDifficulty) => {
    switch (diff) {
      case 'HARD':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
            Hard
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Medium
          </span>
        );
      case 'EASY':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Easy
          </span>
        );
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Unified Focus Engine"
      className="focus-engine fixed inset-0 z-50 flex flex-col bg-[#090b10] text-stone-100 font-sans select-none overflow-hidden"
    >
      {/* Aesthetic Scene Backdrop for Lo-Fi Studio */}
      {mode === 'studio' && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <img
            src={roomImage(sceneId)}
            alt=""
            className="w-full h-full object-cover opacity-35 filter brightness-75 transition-opacity duration-700"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-radial from-transparent via-[#090b10]/60 to-[#090b10]/95" />
        </div>
      )}

      {/* Top Horizon Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#090b10]/80 backdrop-blur-md">
        {/* Brand & Task Title Capsule */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs font-semibold">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? 'bg-amber-400 animate-pulse' : 'bg-stone-500'
              }`}
            />
            <span className="text-stone-300 font-medium tracking-wide">FlowTask Focus</span>
          </div>

          {task && (
            <span className="text-xs font-medium text-stone-400 truncate max-w-[240px] md:max-w-md">
              {task.title}
            </span>
          )}
        </div>

        {/* Mode Switcher Tabs: [ Zen | Studio | Sprint ] */}
        <nav
          role="tablist"
          aria-label="Focus mode tabs"
          className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'zen'}
            aria-controls="focus-panel-zen"
            onClick={() => handleModeChange('zen')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'zen'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Zen
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'studio'}
            aria-controls="focus-panel-studio"
            onClick={() => handleModeChange('studio')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'studio'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Studio
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sprint'}
            aria-controls="focus-panel-sprint"
            onClick={() => handleModeChange('sprint')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'sprint'
                ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Sprint
          </button>
        </nav>

        {/* Global Modal Utilities */}
        <div className="flex items-center gap-2">
          {isDocumentPipSupported() && (
            <button
              type="button"
              onClick={handleTogglePip}
              title={isPipActive ? 'Close Floating PiP (P)' : 'Open Floating PiP (P)'}
              aria-label="Toggle Picture-in-Picture"
              className={`p-2 rounded-xl border transition-colors ${
                isPipActive
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-stone-400 hover:text-white border-white/10'
              }`}
            >
              <PictureInPicture2 size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
            aria-label="Toggle Fullscreen"
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-400 hover:text-white border border-white/10 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Exit Focus (Esc)"
            aria-label="Close Focus Engine"
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-stone-400 hover:text-rose-400 border border-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Main Mode View Container */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center p-6 overflow-y-auto">
        {/* ==================== 1. ZEN MINIMALIST MODE ==================== */}
        {mode === 'zen' && (
          <div
            id="focus-panel-zen"
            role="tabpanel"
            aria-label="Zen Minimalist Mode"
            className="w-full max-w-2xl flex flex-col items-center text-center animate-fadeIn"
          >
            {/* Phase Selector Pills */}
            <div className="flex items-center gap-2 mb-8 p-1 rounded-full bg-white/[0.04] border border-white/10">
              <button
                type="button"
                onClick={() => handlePhaseChange('focus')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  phase === 'focus'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Focus 25m
              </button>
              <button
                type="button"
                onClick={() => handlePhaseChange('short_break')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  phase === 'short_break'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Short Break 5m
              </button>
              <button
                type="button"
                onClick={() => handlePhaseChange('long_break')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  phase === 'long_break'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Long Break 15m
              </button>
            </div>

            {/* Countdown Clock */}
            <div className="my-4">
              <span
                role="timer"
                aria-live="polite"
                aria-label="Countdown timer"
                className="font-mono text-7xl md:text-9xl font-black text-amber-400 tracking-tighter tabular-nums drop-shadow-md select-all"
              >
                {formattedCountdown}
              </span>
            </div>

            {/* Current Task Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-4 max-w-xl truncate">
              {task?.title || 'Deep Focus Session'}
            </h1>

            {/* Next Action Step */}
            <p className="text-sm md:text-base text-stone-400 mt-2 max-w-lg flex items-center justify-center gap-2">
              <Sparkles size={14} className="text-amber-400 shrink-0" />
              <span>{nextActionStep}</span>
            </p>

            {/* Controls Bar */}
            <div className="flex items-center gap-4 mt-10">
              <button
                type="button"
                onClick={handleTogglePlayPause}
                aria-label={isRunning ? 'Pause session' : 'Start session'}
                className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-base shadow-lg hover:shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Pause size={18} className="fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={18} className="fill-current" />
                    <span>Start Focus</span>
                  </>
                )}
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-950/20 text-stone-950 font-extrabold uppercase">
                  Space
                </kbd>
              </button>

              <button
                type="button"
                onClick={handleCompleteTask}
                aria-label="Complete Task"
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-emerald-500/20 text-stone-200 hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 font-semibold text-sm transition-all active:scale-95 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Complete</span>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-stone-400 font-bold">
                  ↵
                </kbd>
              </button>

              <button
                type="button"
                onClick={handleResetTimer}
                title="Reset timer"
                aria-label="Reset timer"
                className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ==================== 2. LO-FI STUDIO MODE ==================== */}
        {mode === 'studio' && (
          <div
            id="focus-panel-studio"
            role="tabpanel"
            aria-label="Lo-Fi Studio Mode"
            className="w-full max-w-4xl flex flex-col items-center animate-fadeIn"
          >
            {/* Scene Selector Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {FEATURED_ROOMS.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  onClick={() => setSceneId(room.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    sceneId === room.id
                      ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                      : 'bg-stone-900/80 hover:bg-stone-800 text-stone-300 border border-white/10'
                  }`}
                >
                  {room.title}
                </button>
              ))}
            </div>

            {/* Center Floating Timer HUD */}
            <div className="flex flex-col items-center mb-8 p-6 rounded-3xl bg-[#0b0e14]/75 border border-white/10 backdrop-blur-xl shadow-2xl">
              <span
                role="timer"
                aria-live="polite"
                aria-label="Countdown timer"
                className="font-mono text-5xl md:text-6xl font-black text-amber-400 tracking-tight tabular-nums"
              >
                {formattedCountdown}
              </span>

              <h2 className="text-lg font-bold text-white mt-2 truncate max-w-md">
                {task?.title || 'Deep Focus Session'}
              </h2>

              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  aria-label={isRunning ? 'Pause session' : 'Start session'}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {isRunning ? (
                    <>
                      <Pause size={14} className="fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} className="fill-current" />
                      <span>Play</span>
                    </>
                  )}
                  <kbd className="text-[9px] font-mono px-1 py-0.5 rounded bg-stone-950/20 text-stone-950 font-bold">
                    Space
                  </kbd>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAudioMuted(!isAudioMuted)}
                  aria-label={isAudioMuted ? 'Unmute atmosphere' : 'Mute atmosphere'}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
                    isAudioMuted
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-white/[0.05] hover:bg-white/[0.08] text-stone-300 border-white/10'
                  }`}
                >
                  {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{isAudioMuted ? 'Muted' : 'Silence'}</span>
                </button>
              </div>
            </div>

            {/* Multi-Track Web Audio Mixer Panel */}
            <div className="w-full p-6 rounded-3xl bg-[#0b0e14]/85 border border-white/10 backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Headphones size={18} className="text-amber-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-300">
                    Atmospheric Multi-Track Mixer
                  </h3>
                </div>

                {/* Master Volume */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 font-medium">Master</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    aria-label="Master volume"
                    value={mixerVolumes.master}
                    onChange={(e) =>
                      setMixerVolumes((v) => ({ ...v, master: parseFloat(e.target.value) }))
                    }
                    className="w-24 accent-amber-500 cursor-pointer"
                  />
                  <span className="font-mono text-xs text-stone-400 w-8">
                    {Math.round(mixerVolumes.master * 100)}%
                  </span>
                </div>
              </div>

              {/* 4 Independent Multi-Track Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Binaural Beats */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Headphones size={15} className="text-sky-400" />
                      <span className="text-xs font-semibold text-stone-200">Binaural Beats</span>
                    </div>
                    <span className="text-[10px] font-mono text-sky-400 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                      40 Hz Focus
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      aria-label="Binaural Beats volume"
                      value={mixerVolumes.binaural}
                      onChange={(e) =>
                        setMixerVolumes((v) => ({ ...v, binaural: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                    <span className="font-mono text-xs text-stone-400 w-8 text-right">
                      {Math.round(mixerVolumes.binaural * 100)}%
                    </span>
                  </div>
                </div>

                {/* 2. Brown Noise */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Waves size={15} className="text-amber-400" />
                      <span className="text-xs font-semibold text-stone-200">Brown Noise</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      Deep Rumble
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      aria-label="Brown Noise volume"
                      value={mixerVolumes.brown}
                      onChange={(e) =>
                        setMixerVolumes((v) => ({ ...v, brown: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <span className="font-mono text-xs text-stone-400 w-8 text-right">
                      {Math.round(mixerVolumes.brown * 100)}%
                    </span>
                  </div>
                </div>

                {/* 3. Rain */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CloudRain size={15} className="text-teal-400" />
                      <span className="text-xs font-semibold text-stone-200">Rain Soundscape</span>
                    </div>
                    <span className="text-[10px] font-mono text-teal-400 px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/20">
                      1.4 kHz Bandpass
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      aria-label="Rain volume"
                      value={mixerVolumes.rain}
                      onChange={(e) =>
                        setMixerVolumes((v) => ({ ...v, rain: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-teal-400 cursor-pointer"
                    />
                    <span className="font-mono text-xs text-stone-400 w-8 text-right">
                      {Math.round(mixerVolumes.rain * 100)}%
                    </span>
                  </div>
                </div>

                {/* 4. Campfire */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame size={15} className="text-orange-400" />
                      <span className="text-xs font-semibold text-stone-200">Campfire Crackle</span>
                    </div>
                    <span className="text-[10px] font-mono text-orange-400 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                      Warm Hearth
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      aria-label="Campfire volume"
                      value={mixerVolumes.campfire}
                      onChange={(e) =>
                        setMixerVolumes((v) => ({ ...v, campfire: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-orange-400 cursor-pointer"
                    />
                    <span className="font-mono text-xs text-stone-400 w-8 text-right">
                      {Math.round(mixerVolumes.campfire * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 3. SPRINT STEP-BY-STEP MODE ==================== */}
        {mode === 'sprint' && (
          <div
            id="focus-panel-sprint"
            role="tabpanel"
            aria-label="Step-by-Step Sprint Mode"
            className="w-full max-w-3xl flex flex-col animate-fadeIn"
          >
            {/* Sprint Progress & Pace Summary Card */}
            <div className="mb-6 p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Sprint Velocity
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-white">
                    {completedSubtasksCount} of {subtasks.length} solved
                  </span>
                  <span className="text-xs text-stone-400">({sprintProgressPercent}%)</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-stone-400">Banked Pace</span>
                  <p
                    className={`font-mono text-sm font-bold ${
                      bankedSeconds >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {bankedSeconds >= 0 ? `+${Math.round(bankedSeconds / 60)}m` : `${Math.round(bankedSeconds / 60)}m`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTogglePlayPause}
                  aria-label={isRunning ? 'Pause sprint' : 'Start sprint'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {isRunning ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current" />}
                  <span>{isRunning ? 'Pause' : 'Start'}</span>
                </button>
              </div>
            </div>

            {/* Active Question / Subtask Hero Card */}
            {currentSubtask ? (
              <div className="p-6 rounded-3xl bg-[#0b0e14] border border-white/10 shadow-xl mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Step {activeSubtaskIndex + 1} of {subtasks.length}
                    </span>
                    {renderDifficultyBadge(currentSubtask.difficulty)}
                  </div>

                  <div className="text-right">
                    <span
                      role="timer"
                      aria-live="polite"
                      aria-label="Countdown timer"
                      className="font-mono text-3xl font-extrabold text-amber-400 tabular-nums"
                    >
                      {formattedCountdown}
                    </span>
                    <span className="block text-[10px] text-stone-400">target pace</span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white mb-6">
                  {currentSubtask.title}
                </h2>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={activeSubtaskIndex === 0}
                      onClick={() => setActiveSubtaskIndex((i) => Math.max(0, i - 1))}
                      aria-label="Previous subtask"
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none text-stone-300 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={activeSubtaskIndex >= subtasks.length - 1}
                      onClick={() =>
                        setActiveSubtaskIndex((i) => Math.min(subtasks.length - 1, i + 1))
                      }
                      aria-label="Next subtask"
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none text-stone-300 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleMarkSolvedAndNext}
                    aria-label="Mark Solved and Next"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>Mark Solved & Next</span>
                    <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-stone-950/20 text-stone-950 font-bold">
                      ↵
                    </kbd>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-3xl bg-white/[0.02] border border-dashed border-white/10 text-center mb-6">
                <p className="text-stone-400 text-sm">
                  No subtasks defined on this task. Add subtasks to enable guided auto-pacing.
                </p>
              </div>
            )}

            {/* Subtask Checklist */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1">
                Sprint Subtasks Checklist
              </h3>
              {subtasks.map((st, idx) => (
                <div
                  key={st.id}
                  onClick={() => setActiveSubtaskIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    activeSubtaskIndex === idx
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={st.completed}
                      aria-label={`Toggle completion for ${st.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (task) {
                          taskContext?.toggleSubTask?.(task.id, st.id);
                        }
                      }}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        st.completed
                          ? 'bg-emerald-500 border-emerald-500 text-stone-950'
                          : 'border-stone-600 hover:border-amber-400'
                      }`}
                    >
                      {st.completed && <Check size={12} strokeWidth={3} />}
                    </button>

                    <span
                      className={`text-sm truncate ${
                        st.completed
                          ? 'line-through text-stone-500'
                          : activeSubtaskIndex === idx
                          ? 'text-white font-semibold'
                          : 'text-stone-300'
                      }`}
                    >
                      {st.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {renderDifficultyBadge(st.difficulty)}
                    <span className="text-xs font-mono text-stone-500">
                      {st.estimatedMinutes || 30}m
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
