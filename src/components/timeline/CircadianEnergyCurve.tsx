import React, { useMemo } from 'react';
import type { Task, CognitiveLoad } from '../../types/task';
import { AlertCircle } from 'lucide-react';

export type CircadianPhase = 'wakeup' | 'peak' | 'lull' | 'rebound' | 'winddown';

export interface CircadianPhaseInfo {
  phase: CircadianPhase;
  label: string;
  recommendedLoad: CognitiveLoad;
  icon: string;
  description: string;
}

/**
 * Calculates normalized circadian energy level (0.0 to 1.0) based on hour of day (0 to 24).
 * Biologically calibrated to human alertness rhythms:
 * - Morning Wakeup (6am - 8:30am)
 * - Morning Peak Focus (9am - 12pm) -> ~0.95
 * - Afternoon Postprandial Dip (1:30pm - 3:30pm) -> ~0.40
 * - Evening Rebound (4:30pm - 7:30pm) -> ~0.80
 * - Sleep Window (10pm+) -> <0.30
 */
export function calculateCircadianEnergy(hour: number): number {
  const h = (hour + 24) % 24;
  if (h < 6) return 0.2;
  if (h < 8.5) {
    return Number((0.2 + ((h - 6) / 2.5) * 0.5).toFixed(2));
  }
  if (h <= 12) {
    const t = (h - 8.5) / 3.5;
    return Number((0.7 + Math.sin(t * Math.PI) * 0.3).toFixed(2));
  }
  if (h <= 15.5) {
    const dip = 0.85 - Math.sin(((h - 12) / 3.5) * Math.PI) * 0.45;
    return Number(Math.max(0.38, Math.min(0.85, dip)).toFixed(2));
  }
  if (h <= 19.5) {
    const t = (h - 15.5) / 4.0;
    return Number((0.45 + Math.sin(t * Math.PI) * 0.35).toFixed(2));
  }
  if (h <= 22) {
    return Number((0.70 - ((h - 19.5) / 2.5) * 0.35).toFixed(2));
  }
  return Number((0.35 - ((h - 22) / 2) * 0.15).toFixed(2));
}

export function getCircadianPhase(hour: number): CircadianPhaseInfo {
  const h = (hour + 24) % 24;
  if (h >= 6 && h < 9) {
    return {
      phase: 'wakeup',
      label: 'Morning Warmup',
      recommendedLoad: 'shallow',
      icon: '🌅',
      description: 'Cortisol awakening window. Best for planning, review, and light admin.',
    };
  }
  if (h >= 9 && h < 13) {
    return {
      phase: 'peak',
      label: 'Peak Focus Window',
      recommendedLoad: 'deep_work',
      icon: '🧠',
      description: 'Maximum executive function & alertness. Ideal for deep work & complex synthesis.',
    };
  }
  if (h >= 13 && h < 16) {
    return {
      phase: 'lull',
      label: 'Afternoon Lull',
      recommendedLoad: 'shallow',
      icon: '☕',
      description: 'Postprandial dip. Best for meetings, inbox triage, or low-friction tasks.',
    };
  }
  if (h >= 16 && h < 20.5) {
    return {
      phase: 'rebound',
      label: 'Evening Rebound',
      recommendedLoad: 'medium',
      icon: '⚡',
      description: 'Second alertness peak. Good for moderate coding, creative polish, and team sync.',
    };
  }
  return {
    phase: 'winddown',
    label: 'Rest & Wind-down',
    recommendedLoad: 'shallow',
    icon: '🌙',
    description: 'Melatonin rise. Decompress and capture thoughts for tomorrow.',
  };
}

export interface MismatchAdvisory {
  hasMismatch: boolean;
  message?: string;
  suggestedSlot?: string;
}

export function checkCircadianMismatch(
  scheduledStart: string,
  cognitiveLoad?: CognitiveLoad
): MismatchAdvisory {
  if (!scheduledStart || cognitiveLoad !== 'deep_work') {
    return { hasMismatch: false };
  }

  const [hoursStr, minutesStr] = scheduledStart.split(':');
  const startHour = parseInt(hoursStr, 10) + parseInt(minutesStr || '0', 10) / 60;

  // Afternoon dip: 13:30 to 15:30 (13.5 to 15.5)
  if (startHour >= 13.5 && startHour < 15.5) {
    return {
      hasMismatch: true,
      message: 'Deep work scheduled during afternoon circadian dip (1:30 PM - 3:30 PM).',
      suggestedSlot: 'Consider rescheduling to 9:30 AM or 4:30 PM for optimal cognitive velocity.',
    };
  }

  return { hasMismatch: false };
}

export interface CircadianEnergyCurveProps {
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  width?: number;
  tasks?: Task[];
  className?: string;
  onRescheduleTask?: (taskId: string, newStart: string) => void;
}

export const CircadianEnergyCurve: React.FC<CircadianEnergyCurveProps> = ({
  startHour = 7,
  endHour = 22,
  hourHeight = 60,
  width = 56,
  tasks = [],
  className = '',
  onRescheduleTask,
}) => {
  const totalHours = endHour - startHour;
  const totalHeight = totalHours * hourHeight;

  // Build SVG path points sampling every 30 minutes
  const pathD = useMemo(() => {
    const points: string[] = [];
    const step = 0.5; // Every 30 mins
    for (let h = startHour; h <= endHour; h += step) {
      const y = (h - startHour) * hourHeight;
      const energy = calculateCircadianEnergy(h);
      // Map energy 0.0 - 1.0 to x coordinate (4px to width - 8px)
      const x = 6 + energy * (width - 14);
      points.push(`${points.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }

    // Close path to left edge for gradient fill
    const firstY = 0;
    const lastY = totalHeight;
    return `${points.join(' ')} L 0 ${lastY} L 0 ${firstY} Z`;
  }, [startHour, endHour, hourHeight, width, totalHeight]);

  // Find any deep work tasks in the afternoon dip
  const mismatchedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.deletedAt || t.archivedAt || t.status === 'done') return false;
      if (!t.scheduledStart) return false;
      const advisory = checkCircadianMismatch(t.scheduledStart, t.cognitiveLoad);
      return advisory.hasMismatch;
    });
  }, [tasks]);

  return (
    <div
      className={`relative select-none pointer-events-none ${className}`}
      style={{ height: totalHeight, width }}
      data-testid="circadian-energy-curve"
    >
      <svg
        className="w-full h-full overflow-visible opacity-80"
        viewBox={`0 0 ${width} ${totalHeight}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="circadian-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="circadian-stroke" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#10B981" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.5" />
            <stop offset="80%" stopColor="#6366F1" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#64748B" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <path d={pathD} fill="url(#circadian-grad)" />
        <path
          d={pathD.substring(0, pathD.indexOf(' L 0'))}
          fill="none"
          stroke="url(#circadian-stroke)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Advisory Warning Banner if deep work tasks fall into circadian dip */}
      {mismatchedTasks.length > 0 && (
        <div
          className="absolute z-20 pointer-events-auto left-full ml-2 w-64 p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur-md text-amber-900 dark:text-amber-200 text-xs shadow-lg space-y-1.5 animate-fadeIn"
          style={{ top: Math.max(0, (13.5 - startHour) * hourHeight) }}
          data-testid="circadian-mismatch-warning"
        >
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-600 dark:text-amber-400">
            <AlertCircle size={13} />
            <span>Circadian Lull Alert</span>
          </div>
          <p className="text-[10px] leading-relaxed text-amber-800 dark:text-amber-300">
            {mismatchedTasks.length} deep work block{mismatchedTasks.length > 1 ? 's are' : ' is'}{' '}
            scheduled during the afternoon lull (1:30 - 3:30 PM).
          </p>
          {onRescheduleTask && (
            <div className="flex gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => onRescheduleTask(mismatchedTasks[0].id, '09:30')}
                className="px-2 py-1 rounded bg-amber-600 text-white font-medium text-[10px] hover:bg-amber-700 transition-colors shadow-xs"
              >
                Shift to 9:30 AM
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
