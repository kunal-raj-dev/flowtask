import { useWorkspaceSelector } from '../../services/workspaceStore';
import { isFocusComplete } from '../../services/focusLifecycle';
import { DEFAULT_TIMER } from '../../types/studio';
import {
  nextStudioPhase,
  type FinishedStudioSession,
} from "../../services/studioSessionEngine";
import { useEffect, useRef, useState } from "react";
import { useTaskContext } from "../../context/TaskContext";
import { useFocusStore } from "../../store/useFocusStore";
import { useStudioPreferences, useMediaCatalog } from "../../hooks/useStudio";
import { studioAudio } from "../../services/studioAudio";
import { resolveAsset } from "../../services/studioCatalog";
import { audioEngine } from "../../utils/audioEngine";
import { useWakeLock } from "../../hooks/useWakeLock";

export function FocusRuntime() {
  const context = useTaskContext();
  const readOnly = useWorkspaceSelector(snapshot => Boolean(snapshot.readOnly));
  const current = useRef(context);
  useEffect(() => {
    current.current = context;
  });
  useEffect(() => {
    const play = () => current.current.resumeFocusSession();
    const pause = () => current.current.pauseFocusSession();
    const stop = () => current.current.stopFocusSession();
    window.addEventListener('flowtask:media-play', play);
    window.addEventListener('flowtask:media-pause', pause);
    window.addEventListener('flowtask:media-stop', stop);
    return () => {
      window.removeEventListener('flowtask:media-play', play);
      window.removeEventListener('flowtask:media-pause', pause);
      window.removeEventListener('flowtask:media-stop', stop);
    };
  }, []);
  const session = useFocusStore((s) => s.focusSession);
  const { preferences, update } = useStudioPreferences();
  const catalog = useMediaCatalog();
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    if (readOnly) return;
    const abort = new AbortController();
    let release: (() => void) | undefined;
    if (navigator.locks) {
      void navigator.locks
        .request(
          `flowtask-focus-audio:${context.workspaceId}`,
          { signal: abort.signal },
          async () => {
            if (abort.signal.aborted) return;
            setOwner(true);
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          },
        )
        .catch(() => {});
    } else {
      const id = crypto.randomUUID();
      const key = `flowtask-audio-owner:${context.workspaceId}`;
      const heartbeat = () => {
        try {
          const lease = JSON.parse(localStorage.getItem(key) || "null");
          const mine = !lease || lease.id === id || lease.until < Date.now();
          if (mine)
            localStorage.setItem(
              key,
              JSON.stringify({ id, until: Date.now() + 4000 }),
            );
          setOwner(mine);
        } catch {
          setOwner(false);
        }
      };
      heartbeat();
      const interval = setInterval(heartbeat, 1500);
      return () => {
        clearInterval(interval);
        studioAudio.stop();
        try {
          const lease = JSON.parse(localStorage.getItem(key) || "null");
          if (lease?.id === id) localStorage.removeItem(key);
        } catch {
          /* unavailable */
        }
      };
    }
    return () => {
      abort.abort();
      release?.();
      studioAudio.stop();
      setOwner(false);
    };
  }, [context.workspaceId, readOnly]);
  useEffect(() => {
    if (!owner) return;
    const complete = () => {
      const ctx = current.current;
      const active = useFocusStore.getState().focusSession;
      if(active?.recoverCompletion && active.workspaceId===ctx.workspaceId) { ctx.stopFocusSession(); return; }
      if (
        !active ||
        active.workspaceId !== ctx.workspaceId ||
        active.state !== "running" ||
        active.targetDurationSec <= 0
      )
        return;
      if (!isFocusComplete(active)) return;
      const transition = nextStudioPhase(active);
      ctx.updateFocusSession({
        outcome: "completed",
        accumulatedElapsedMs: active.targetDurationSec * 1000,
        state: "completed",
      });
      ctx.stopFocusSession();
      audioEngine.playPomodoroComplete();
      ctx.showToast(
        active.pomodoroPhase === "focus"
          ? "Session complete. Take a little breathing room."
          : "Break complete. Ready when you are.",
      );
      if (active.timerConfiguration?.autoStart && active.mode === "pomodoro") {
        const config = active.timerConfiguration || DEFAULT_TIMER;
        const target =
          transition.nextPhase === "focus"
            ? config.focusMinutes
            : transition.nextPhase === "long_break"
              ? config.longBreakMinutes
              : config.shortBreakMinutes;
        ctx.startFocusSession(
          "pomodoro",
          active.taskId,
          active.taskTitle,
          target * 60,
        );
        ctx.updateFocusSession({
          ...transition,
          pomodoroPhase: transition.nextPhase,
          pomodoroCycle: transition.nextCycle,
          timerConfiguration: config,
          recipeId: active.recipeId,
        });
      }
    };
    complete();
    const interval = setInterval(complete, 500);
    document.addEventListener("visibilitychange", complete);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", complete);
    };
  }, [owner]);
  useEffect(() => {
    if (!owner || (session && session.workspaceId !== context.workspaceId)) {
      studioAudio.stop();
      return;
    }
    const last = context.workspacePreferences.studioLastSession as
      FinishedStudioSession | undefined;
    const keepPlaying =
      !session &&
      last?.session.outcome === "completed" &&
      preferences.continueAudioOnFinish;
    if (session?.state === "paused") {
      studioAudio.pause();
      return;
    }
    if (session?.state !== "running" && !keepPlaying) {
      studioAudio.stop();
      return;
    }
    if (!preferences.layers.length && !preferences.musicId) { studioAudio.stop(); return; }
    audioEngine.stopAmbientSound();
    void studioAudio
      .mix(
        preferences.layers,
        {
          asset: resolveAsset(preferences.musicId, catalog.audio),
          volume: preferences.musicVolume,
        },
        catalog.audio,
        preferences.masterVolume,
      )
      .catch((error) =>
        window.dispatchEvent(
          new CustomEvent("flowtask:audio-error", {
            detail: (error as Error).message,
          }),
        ),
      );
  }, [
    owner,
    session,
    context.workspaceId,
    context.workspacePreferences.studioLastSession,
    preferences.layers,
    preferences.musicId,
    preferences.musicVolume,
    preferences.masterVolume,
    preferences.continueAudioOnFinish,
    catalog.audio,
  ]);
  useEffect(() => {
    const next = () => {
      if (useFocusStore.getState().focusSession?.state !== "running") return;
      const track = resolveAsset(preferences.musicId, catalog.audio);
      if (!track) return;
      const list = catalog.audio.filter(
        (a) => a.category === "music" && a.genre === track.genre,
      );
      const index = list.findIndex((a) => a.id === track.id);
      if (list.length) update({ musicId: list[(index + 1) % list.length].id });
    };
    window.addEventListener("flowtask:music-ended", next);
    return () => window.removeEventListener("flowtask:music-ended", next);
  }, [preferences.musicId, catalog.audio, update]);
  useWakeLock(owner && session?.workspaceId === context.workspaceId && session?.state === "running");
  return null;
}
