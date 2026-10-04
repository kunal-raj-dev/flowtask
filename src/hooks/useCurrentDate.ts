import { useState, useEffect } from 'react';
import { formatLocalDate } from '../utils/nlpParser';

let globalTodayStr = formatLocalDate(new Date());
function computeTomorrow(base: Date): string {
  const tmrw = new Date(base);
  tmrw.setDate(tmrw.getDate() + 1);
  return formatLocalDate(tmrw);
}

let globalTomorrowStr = computeTomorrow(new Date());
const listeners = new Set<(date: string) => void>();

// Check once every 60 seconds if the calendar day rolled over
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = new Date();
    const next = formatLocalDate(now);
    if (next !== globalTodayStr) {
      globalTodayStr = next;
      globalTomorrowStr = computeTomorrow(now);
      listeners.forEach((fn) => fn(next));
    }
  }, 60 * 1000);
}

export function getTodayStr(): string {
  return globalTodayStr;
}

export function getTomorrowStr(): string {
  return globalTomorrowStr;
}

export function useTodayStr(): string {
  const [date, setDate] = useState(globalTodayStr);

  useEffect(() => {
    listeners.add(setDate);
    return () => {
      listeners.delete(setDate);
    };
  }, []);

  return date;
}

export function useTomorrowStr(): string {
  const [tmrw, setTmrw] = useState(globalTomorrowStr);

  useEffect(() => {
    const update = () => setTmrw(globalTomorrowStr);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return tmrw;
}
