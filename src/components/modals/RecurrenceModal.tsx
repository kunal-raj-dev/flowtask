import React, { useState } from 'react';
import type { CustomRecurrenceRule } from '../../types/task';
import { Repeat, Check, X, Sparkles } from 'lucide-react';

interface RecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRule?: CustomRecurrenceRule;
  onSave: (rule: CustomRecurrenceRule) => void;
}

const DAYS_OF_WEEK = [
  { label: 'S', name: 'Sunday', value: 0 },
  { label: 'M', name: 'Monday', value: 1 },
  { label: 'T', name: 'Tuesday', value: 2 },
  { label: 'W', name: 'Wednesday', value: 3 },
  { label: 'T', name: 'Thursday', value: 4 },
  { label: 'F', name: 'Friday', value: 5 },
  { label: 'S', name: 'Saturday', value: 6 },
];

export const RecurrenceModal: React.FC<RecurrenceModalProps> = ({
  isOpen,
  onClose,
  currentRule,
  onSave,
}) => {
  const [interval, setInterval] = useState<number>(currentRule?.interval || 1);
  const [unit, setUnit] = useState<'days' | 'weeks' | 'months'>(currentRule?.unit || 'weeks');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(currentRule?.daysOfWeek || [1]);
  const [mode, setMode] = useState<'scheduled' | 'completion'>(currentRule?.mode || 'scheduled');

  if (!isOpen) return null;

  const toggleDay = (dayVal: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(dayVal)) {
        if (prev.length === 1) return prev; // keep at least one day
        return prev.filter((d) => d !== dayVal);
      } else {
        return [...prev, dayVal].sort((a, b) => a - b);
      }
    });
  };

  const getSummary = () => {
    let summary = `Every ${interval === 1 ? '' : interval + ' '}${
      interval === 1 ? unit.slice(0, -1) : unit
    }`;
    if (unit === 'weeks' && daysOfWeek.length > 0) {
      const dayNames = daysOfWeek.map((d) => DAYS_OF_WEEK.find((item) => item.value === d)?.name);
      summary += ` on ${dayNames.join(', ')}`;
    }
    if (mode === 'completion') {
      summary += ' (after completion)';
    }
    return summary;
  };

  const applyPreset = (presetInterval: number, presetUnit: 'days' | 'weeks' | 'months', presetDays?: number[]) => {
    setInterval(presetInterval);
    setUnit(presetUnit);
    if (presetDays) setDaysOfWeek(presetDays);
  };

  const handleSave = () => {
    onSave({
      interval: Math.max(1, interval),
      unit,
      daysOfWeek: unit === 'weeks' ? daysOfWeek : undefined,
      mode,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-recurrence-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl p-6 text-[var(--text-primary)] card-surface animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Repeat size={20} />
            </div>
            <div>
              <h2 id="custom-recurrence-title" className="text-base font-bold text-[var(--text-primary)]">
                Custom Recurrence Rule
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Flexible habits, routines, and maintenance schedules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Quick Presets
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => applyPreset(3, 'days')}
              className="px-2.5 py-1 text-xs rounded-xl bg-[var(--bg-surface-l2)] hover:bg-indigo-500/15 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 border border-[var(--border-hairline)] transition-colors"
            >
              Every 3 Days
            </button>
            <button
              type="button"
              onClick={() => applyPreset(1, 'weeks', [1, 3, 5])}
              className="px-2.5 py-1 text-xs rounded-xl bg-[var(--bg-surface-l2)] hover:bg-indigo-500/15 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 border border-[var(--border-hairline)] transition-colors"
            >
              Mon, Wed, Fri
            </button>
            <button
              type="button"
              onClick={() => applyPreset(2, 'weeks')}
              className="px-2.5 py-1 text-xs rounded-xl bg-[var(--bg-surface-l2)] hover:bg-indigo-500/15 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 border border-[var(--border-hairline)] transition-colors"
            >
              Every 2 Weeks
            </button>
            <button
              type="button"
              onClick={() => applyPreset(3, 'months')}
              className="px-2.5 py-1 text-xs rounded-xl bg-[var(--bg-surface-l2)] hover:bg-indigo-500/15 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 border border-[var(--border-hairline)] transition-colors"
            >
              Quarterly (3 Mo)
            </button>
          </div>
        </div>

        {/* Frequency & Unit Inputs */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Repeat Interval
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)] font-medium">Every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-16 px-2.5 py-1.5 text-center text-sm font-bold bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] rounded-xl outline-none focus:border-indigo-500 transition-colors"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as any)}
              className="flex-1 px-3 py-1.5 text-xs font-semibold bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] rounded-xl outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="days">Day{interval > 1 ? 's' : ''}</option>
              <option value="weeks">Week{interval > 1 ? 's' : ''}</option>
              <option value="months">Month{interval > 1 ? 's' : ''}</option>
            </select>
          </div>
        </div>

        {/* Days of Week (if unit === 'weeks') */}
        {unit === 'weeks' && (
          <div className="mb-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              On Days
            </label>
            <div className="flex items-center justify-between gap-1.5">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = daysOfWeek.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    title={day.name}
                    className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs scale-105'
                        : 'bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recurrence Mode */}
        <div className="mb-5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Schedule Base
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('scheduled')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                mode === 'scheduled'
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'bg-[var(--bg-surface-l2)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
              }`}
            >
              <div className="text-xs font-bold mb-0.5">Strict Schedule</div>
              <div className="text-[10px] opacity-80">Calculates from original due date</div>
            </button>
            <button
              type="button"
              onClick={() => setMode('completion')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                mode === 'completion'
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'bg-[var(--bg-surface-l2)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
              }`}
            >
              <div className="text-xs font-bold mb-0.5">After Completion</div>
              <div className="text-[10px] opacity-80">Calculates from when marked done</div>
            </button>
          </div>
        </div>

        {/* Preview Summary */}
        <div className="mb-6 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2.5">
          <Sparkles size={16} className="text-indigo-500 shrink-0" />
          <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            {getSummary()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Check size={14} />
            <span>Apply Rule</span>
          </button>
        </div>
      </div>
    </div>
  );
};
