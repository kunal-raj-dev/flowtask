import type { FocusSession } from "../types/task";
export interface FinishedStudioSession {
  session: FocusSession;
  seconds: number;
  nextPhase: "focus" | "short_break" | "long_break";
  nextCycle: number;
  finishedAt: number;
}
export function nextStudioPhase(
  session: FocusSession,
): Pick<FinishedStudioSession, "nextPhase" | "nextCycle"> {
  const cycle = session.pomodoroCycle || 1;
  if (session.pomodoroPhase && session.pomodoroPhase !== "focus")
    return { nextPhase: "focus", nextCycle: cycle };
  if (cycle >= (session.timerConfiguration?.cyclesBeforeLongBreak || 4))
    return { nextPhase: "long_break", nextCycle: 1 };
  return { nextPhase: "short_break", nextCycle: cycle + 1 };
}
export function pausedSeconds(session: FocusSession, now = Date.now()) {
  return Math.max(
    0,
    Math.floor(
      ((session.totalPausedMs || 0) +
        (session.state === "paused" && session.pausedAt
          ? now - session.pausedAt
          : 0)) /
        1000,
    ),
  );
}
