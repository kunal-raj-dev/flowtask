import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { filterTasksByPredicate } from '../../utils/smartViewUtils';
import type { Priority, SmartFilterPredicate } from '../../types/task';
import {
  X,
  Zap,
  Brain,
  Flame,
  Clock,
  Archive,
  Sparkles,
  Filter,
  Briefcase,
  Star,
  Target,
  Plus,
  Moon,
  Coffee,
  Lock,
} from 'lucide-react';

interface SmartFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_ICONS = [
  { id: 'filter', Icon: Filter, label: 'Filter' },
  { id: 'zap', Icon: Zap, label: 'Quick' },
  { id: 'brain', Icon: Brain, label: 'Focus' },
  { id: 'flame', Icon: Flame, label: 'Urgent' },
  { id: 'star', Icon: Star, label: 'Star' },
  { id: 'target', Icon: Target, label: 'Target' },
  { id: 'clock', Icon: Clock, label: 'Time' },
  { id: 'moon', Icon: Moon, label: 'Evening' },
  { id: 'coffee', Icon: Coffee, label: 'Stale' },
  { id: 'lock', Icon: Lock, label: 'Blocked' },
  { id: 'briefcase', Icon: Briefcase, label: 'Work' },
  { id: 'sparkles', Icon: Sparkles, label: 'Magic' },
  { id: 'archive', Icon: Archive, label: 'Backlog' },
];

const COLOR_OPTIONS = [
  'text-indigo-500',
  'text-amber-500',
  'text-rose-500',
  'text-emerald-500',
  'text-blue-500',
  'text-purple-500',
  'text-cyan-500',
];

export const SmartFilterModal: React.FC<SmartFilterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { tasks, projects, addSmartView, setActiveView } = useTaskContext();

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('filter');
  const [selectedColor, setSelectedColor] = useState('text-indigo-500');

  // Predicate settings
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [durationMode, setDurationMode] = useState<'any' | 'quick' | 'deep'>('any');
  const [dueRange, setDueRange] = useState<SmartFilterPredicate['dueRange']>('any');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [onlyStale, setOnlyStale] = useState(false);
  const [onlyEvening, setOnlyEvening] = useState(false);

  if (!isOpen) return null;

  const currentPredicate: SmartFilterPredicate = {
    priorities: selectedPriorities.length > 0 ? selectedPriorities : undefined,
    maxMinutes: durationMode === 'quick' ? 15 : undefined,
    minMinutes: durationMode === 'deep' ? 45 : undefined,
    dueRange: dueRange !== 'any' ? dueRange : undefined,
    projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
    isBlocked: onlyBlocked ? true : undefined,
    isStale: onlyStale ? true : undefined,
    isEvening: onlyEvening ? true : undefined,
    status: 'active',
  };

  const matchingCount = filterTasksByPredicate(tasks, currentPredicate).length;

  const handleTogglePriority = (p: Priority) => {
    setSelectedPriorities((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const handleToggleProject = (projId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projId) ? prev.filter((id) => id !== projId) : [...prev, projId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newView = addSmartView(name.trim(), selectedIcon, selectedColor, currentPredicate);
    setActiveView(`smart:${newView.id}` as any);
    setName('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l1)] rounded-xl p-6 sm:p-7 border border-stone-200/90 dark:border-white/10 shadow-modal space-y-5 animate-scale-up card-surface max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-[var(--color-brand)] border border-amber-500/20">
              <Filter size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Create Smart Filter View
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Save dynamic task queries as 1-click sidebar perspectives
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Smart Filter Modal"
            className="p-1.5 rounded-lg text-stone-400 hover:text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* View Name & Icon */}
          <div>
            <label htmlFor="smart-filter-name-input" className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              View Name
            </label>
            <input
              id="smart-filter-name-input"
              name="smartFilterName"
              aria-label="Smart filter view name"
              type="text"
              autoFocus
              placeholder="e.g. High Priority Specs, Weekend Errand Sprint..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] focus:border-[var(--color-brand)] text-[var(--text-primary)] outline-none shadow-xs"
            />
          </div>

          {/* Icon Selector */}
          <div>
            <span className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Icon & Tint
            </span>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {AVAILABLE_ICONS.map(({ id, Icon }) => {
                const isSelected = selectedIcon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedIcon(id)}
                    className={`p-2 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[var(--color-brand)]/15 border-[var(--color-brand)] text-[var(--color-brand)] shadow-xs'
                        : 'border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>

            {/* Color Tint Selector */}
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Tint:</span>
              {COLOR_OPTIONS.map((c) => {
                const isSelected = selectedColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`w-5 h-5 rounded-full border transition-all ${
                      c === 'text-indigo-500' ? 'bg-indigo-500' :
                      c === 'text-amber-500' ? 'bg-amber-500' :
                      c === 'text-rose-500' ? 'bg-rose-500' :
                      c === 'text-emerald-500' ? 'bg-emerald-500' :
                      c === 'text-blue-500' ? 'bg-blue-500' :
                      c === 'text-purple-500' ? 'bg-purple-500' : 'bg-cyan-500'
                    } ${isSelected ? 'ring-2 ring-offset-2 ring-[var(--color-brand)] scale-110 shadow-xs' : 'opacity-70 hover:opacity-100'}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Priorities */}
          <div>
            <span className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Priority Filter
            </span>
            <div className="flex items-center gap-2">
              {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p) => {
                const isSelected = selectedPriorities.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleTogglePriority(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                      isSelected
                        ? p === 'p1'
                          ? 'bg-rose-500/15 text-rose-600 border-rose-500 shadow-xs'
                          : p === 'p2'
                          ? 'bg-amber-500/15 text-amber-600 border-amber-500 shadow-xs'
                          : 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] border-[var(--color-brand)] shadow-xs'
                        : 'border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                );
              })}
              {selectedPriorities.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedPriorities([])}
                  className="text-[11px] text-[var(--text-muted)] hover:text-stone-500 underline ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Duration Filter */}
          <div>
            <span className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Effort & Duration
            </span>
            <div className="flex items-center gap-2">
              {[
                { id: 'any', label: 'Any Duration' },
                { id: 'quick', label: '⚡ Quick Wins (≤ 15m)' },
                { id: 'deep', label: '🧠 Deep Focus (≥ 45m)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDurationMode(opt.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    durationMode === opt.id
                      ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] border-[var(--color-brand)] font-semibold shadow-xs'
                      : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date Range */}
          <div>
            <span className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Due Date Horizon
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'any', label: 'Any Date' },
                { id: 'today', label: 'Today' },
                { id: 'tomorrow', label: 'Tomorrow' },
                { id: 'this_week', label: 'This Week' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'unscheduled', label: 'No Due Date' },
              ].map((range) => (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => setDueRange(range.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    dueRange === range.id
                      ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] border-[var(--color-brand)] font-semibold shadow-xs'
                      : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Special Focus Criteria */}
          <div>
            <span className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Special Focus Criteria
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyEvening((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  onlyEvening
                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500 font-semibold shadow-xs'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Moon size={12} className="text-indigo-500" />
                <span>🌙 This Evening Only</span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyStale((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  onlyStale
                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500 font-semibold shadow-xs'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Coffee size={12} className="text-purple-500" />
                <span>💤 Needs Momentum (Stale)</span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyBlocked((prev) => !prev)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  onlyBlocked
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500 font-semibold shadow-xs'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Lock size={12} className="text-rose-500" />
                <span>🔒 Blocked Tasks</span>
              </button>
            </div>
          </div>

          {/* Project Inclusion */}
          {projects.filter((p) => p.id !== 'inbox' && p.id !== 'ideas').length > 0 && (
            <div>
              <span className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Limit to Specific Projects (Optional)
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {projects
                  .filter((p) => p.id !== 'inbox' && p.id !== 'ideas')
                  .map((proj) => {
                    const isSelected = selectedProjectIds.includes(proj.id);
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => handleToggleProject(proj.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)] border-[var(--color-brand)] font-semibold shadow-xs'
                            : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span>{proj.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Matching Count Preview & Submit */}
          <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Currently matches <strong>{matchingCount}</strong> active {matchingCount === 1 ? 'task' : 'tasks'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs px-3.5 py-2 rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white transition-colors disabled:opacity-50 shadow-sm"
              >
                <Plus size={14} />
                <span>Save Smart View</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
