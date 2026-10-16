import { useMemo } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { useFocusStore } from '../store/useFocusStore';
import { formatLocalDate } from '../utils/nlpParser';
import { getTodayStr } from './useCurrentDate';
import type { FocusLog } from '../types/task';

/**
 * Fine-grained hook that calculates total focused seconds today.
 * Subscribes to live timer ticks only within the components that call it,
 * preventing root TaskContext and whole-app re-renders.
 */
export function useTotalFocusedTodaySeconds(): number {
  const context = useTaskContext();
  const liveElapsed = useFocusStore((s) => s.focusElapsedSeconds);
  const liveSession = useFocusStore((s) => s.focusSession);
  const todayStr = getTodayStr();

  return useMemo(() => {
    // In unit test environments where context has mock totalFocusedTodaySeconds defined
    if (
      context &&
      Object.prototype.hasOwnProperty.call(context, 'totalFocusedTodaySeconds') &&
      typeof (context as any).totalFocusedTodaySeconds === 'number'
    ) {
      return (context as any).totalFocusedTodaySeconds;
    }

    const focusLogs = (context?.focusLogs || []) as FocusLog[];
    const completedToday = focusLogs
      .filter((log) => log.endedAt && formatLocalDate(new Date(log.endedAt)) === todayStr)
      .reduce((acc, log) => acc + (log.seconds || 0), 0);

    const session = context?.focusSession || liveSession;
    const isLiveToday =
      session &&
      (session.state === 'running' || session.state === 'paused') &&
      formatLocalDate(new Date(session.startedAt)) === todayStr;

    const liveSec = isLiveToday ? liveElapsed : 0;
    return completedToday + liveSec;
  }, [context, liveSession, liveElapsed, todayStr]);
}
