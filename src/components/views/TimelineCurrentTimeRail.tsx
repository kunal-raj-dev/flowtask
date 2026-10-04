import React, { useState, useEffect } from 'react';
import { minutesToTimeStr } from '../../utils/timelineUtils';

interface TimelineCurrentTimeRailProps {
  startHour: number;
  endHour: number;
  hourHeightPx: number;
  isToday: boolean;
}

/**
 * Isolated Current Time Indicator Red Pulsing Line.
 * Maintains its own 60-second timer so that only this indicator re-renders every minute,
 * preventing whole-view re-renders of the entire TimelineView schedule.
 */
export const TimelineCurrentTimeRail: React.FC<TimelineCurrentTimeRailProps> = ({
  startHour,
  endHour,
  hourHeightPx,
  isToday,
}) => {
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  if (!isToday || currentTimeMinutes < startHour * 60 || currentTimeMinutes > endHour * 60) {
    return null;
  }

  const topPx = ((currentTimeMinutes - startHour * 60) / 60) * hourHeightPx;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top: `${topPx}px` }}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20 -ml-1 shrink-0 animate-pulse" />
      <div className="flex-1 h-[2px] bg-rose-500/80 shadow-xs" />
      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white shrink-0 shadow-xs">
        {minutesToTimeStr(currentTimeMinutes)}
      </span>
    </div>
  );
};
