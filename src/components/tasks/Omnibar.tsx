import React, { useState, useRef, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { parseTaskInput } from '../../utils/nlpParser';
import type { Priority } from '../../types/task';
import {
  Plus,
  Calendar,
  Flag,
  Folder,
  Clock,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react';

interface OmnibarProps {
  onOpenBrainDump: () => void;
}

export const Omnibar: React.FC<OmnibarProps> = ({ onOpenBrainDump }) => {
  const { addTask } = useTaskContext();
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global 'N' shortcut to focus Omnibar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'n' || e.key === 'N') &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const parsed = parseTaskInput(input);
  const hasRecognizedTokens =
    parsed.dueDate || parsed.priority || parsed.projectTag || parsed.estimatedMinutes;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    addTask(input);
    setInput('');
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'p1':
        return { label: 'P1 Urgent', color: 'bg-gradient-to-r from-rose-500/15 to-red-500/10 text-rose-800 dark:text-rose-300 border-rose-400/40' };
      case 'p2':
        return { label: 'P2 High', color: 'bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-800 dark:text-amber-300 border-amber-400/40' };
      case 'p3':
        return { label: 'P3 Medium', color: 'bg-gradient-to-r from-blue-500/15 to-indigo-500/10 text-blue-800 dark:text-blue-300 border-blue-400/40' };
      case 'p4':
        return { label: 'P4 Low', color: 'bg-gradient-to-r from-stone-500/15 to-stone-500/10 text-stone-800 dark:text-stone-300 border-stone-400/40' };
    }
  };

  return (
    <div className="w-full mb-6">
      <form
        onSubmit={handleSubmit}
        className={`relative rounded-2xl transition-all duration-200 border ${
          isFocused
            ? 'bg-white dark:bg-[var(--bg-surface-l2)] border-indigo-400/70 dark:border-indigo-500/60 shadow-[0_8px_30px_-4px_rgba(99,102,241,0.18)] dark:shadow-[0_8px_30px_-4px_rgba(99,102,241,0.3)] ring-2 ring-indigo-500/20 card-surface'
            : 'bg-white/95 dark:bg-[var(--bg-surface-l2)]/90 backdrop-blur-md border-stone-200/90 dark:border-[var(--border-hairline)] shadow-card hover:border-stone-300 dark:hover:border-[var(--border-color)] card-surface'
        }`}
      >
        <div className="flex items-center px-4 py-3">
          <div className="text-[var(--text-muted)] mr-3 flex-shrink-0 transition-colors">
            <Plus size={18} className={isFocused ? 'text-indigo-600 dark:text-indigo-400' : ''} />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={isFocused ? "Type task name... ('tomorrow', '#project', 'p1', '~30m')" : "Add a task... (press 'N')"}
            className="w-full bg-transparent text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
          />

          <div className="flex items-center gap-1.5 ml-2">
            <button
              type="button"
              onClick={onOpenBrainDump}
              title="Multi-line Brain Dump"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Sparkles size={16} />
            </button>

            {input.trim() && (
              <button
                type="submit"
                className="flex items-center gap-1 px-3.5 py-1.5 bg-gradient-to-r from-stone-900 to-stone-800 dark:from-white dark:to-stone-100 hover:from-stone-800 hover:to-stone-700 dark:hover:from-stone-100 dark:hover:to-stone-200 text-white dark:text-stone-950 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 card-surface"
              >
                <span>Add</span>
                <CornerDownLeft size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Quick Helper Token Chips when focused & empty */}
        {isFocused && input.trim().length === 0 && (
          <div className="px-4 pb-2.5 pt-1 flex items-center gap-1.5 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] animate-slide-down">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Quick:</span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setInput((prev) => (prev ? `${prev} today` : 'today '));
              }}
              className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface-l1)] hover:bg-stone-200/70 dark:hover:bg-white/[0.08] transition-colors"
            >
              + today
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setInput((prev) => (prev ? `${prev} tomorrow` : 'tomorrow '));
              }}
              className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface-l1)] hover:bg-stone-200/70 dark:hover:bg-white/[0.08] transition-colors"
            >
              + tomorrow
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setInput((prev) => (prev ? `${prev} ~25m` : '~25m '));
              }}
              className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface-l1)] hover:bg-stone-200/70 dark:hover:bg-white/[0.08] transition-colors"
            >
              + ~25m
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setInput((prev) => (prev ? `${prev} p1` : 'p1 '));
              }}
              className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              + p1
            </button>
          </div>
        )}

        {/* Real-time NLP parsing badges preview */}
        {input.trim().length > 0 && hasRecognizedTokens && (
          <div className="px-4 pb-2.5 pt-1.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-hairline)] mt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
              Parsed:
            </span>

            {parsed.dueDate && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/40 shadow-xs font-mono">
                <Calendar size={11} />
                {parsed.dueDate} {parsed.dueTime ? `@ ${parsed.dueTime}` : ''}
              </span>
            )}

            {parsed.priority && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs font-mono ${
                  getPriorityBadge(parsed.priority).color
                }`}
              >
                <Flag size={11} />
                {getPriorityBadge(parsed.priority).label}
              </span>
            )}

            {parsed.projectTag && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-indigo-800 dark:text-indigo-300 border border-indigo-400/40 shadow-xs font-mono">
                <Folder size={11} />#{parsed.projectTag}
              </span>
            )}

            {parsed.estimatedMinutes && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-800 dark:text-amber-300 border border-amber-400/40 shadow-xs font-mono">
                <Clock size={11} />
                {parsed.estimatedMinutes >= 60
                  ? `${parsed.estimatedMinutes / 60}h`
                  : `${parsed.estimatedMinutes}m`}
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
