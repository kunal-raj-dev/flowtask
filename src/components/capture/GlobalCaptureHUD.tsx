import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { parseTaskInput } from '../../utils/nlpParser';
import { audioEngine } from '../../services/audioEngine';
import {
  Calendar,
  Clock,
  Folder,
  AlertCircle,
  Brain,
  Coffee,
  Zap,
  CornerDownLeft,
  X,
  Sparkles,
} from 'lucide-react';
import type { Priority, CognitiveLoad } from '../../types/task';

export interface GlobalCaptureHUDProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalCaptureHUD: React.FC<GlobalCaptureHUDProps> = ({ isOpen, onClose }) => {
  const { addTask, projects } = useTaskContext();
  const [inputVal, setInputVal] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setInputVal('');
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const parsed = useMemo(() => {
    return parseTaskInput(inputVal);
  }, [inputVal]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const title = parsed.cleanTitle.trim();
    if (!title) return;

    // Match projectTag if present
    let targetProjectId = 'inbox';
    if (parsed.projectTag) {
      const matched = projects.find(
        (p) =>
          !p.isArchived &&
          (p.name.toLowerCase() === parsed.projectTag?.toLowerCase() ||
            p.id.toLowerCase() === parsed.projectTag?.toLowerCase())
      );
      if (matched) targetProjectId = matched.id;
    }

    addTask(title, {
      projectId: targetProjectId,
      priority: parsed.priority || 'p3',
      dueDate: parsed.dueDate,
      plannedDate: parsed.plannedDate || parsed.dueDate,
      dueTime: parsed.dueTime,
      estimatedMinutes: parsed.estimatedMinutes || 30,
      cognitiveLoad: parsed.cognitiveLoad,
      tags: parsed.tags,
      contextTags: parsed.contextTags,
    });

    audioEngine.playTaskComplete();
    setInputVal('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'p1':
        return { label: 'P1 Urgent', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' };
      case 'p2':
        return { label: 'P2 High', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      case 'p3':
        return { label: 'P3 Normal', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' };
      default:
        return { label: 'P4 Low', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30' };
    }
  };

  const getCognitiveBadge = (load: CognitiveLoad) => {
    switch (load) {
      case 'deep_work':
        return { label: 'Deep Work', icon: Brain, color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' };
      case 'medium':
        return { label: 'Medium', icon: Zap, color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      case 'shallow':
      default:
        return { label: 'Shallow Admin', icon: Coffee, color: 'bg-stone-500/15 text-stone-600 dark:text-stone-400 border-stone-500/30' };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      data-testid="global-capture-hud"
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface-l1)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden card-surface animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header / Status bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-color)] bg-[var(--bg-surface-l2)]/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-brand)]">
            <Sparkles size={14} />
            <span>Omnichannel Quick-Capture HUD</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-surface-l2)] transition-colors"
            title="Close (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What needs doing? (~45m #work !p1 ~deep tomorrow)"
              className="w-full px-3 py-2 text-sm bg-transparent border-b-2 border-[var(--color-brand)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              autoFocus
              data-testid="capture-hud-input"
            />
            <button
              type="submit"
              disabled={!parsed.cleanTitle.trim()}
              className="absolute right-1 px-3 py-1 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-transform active:scale-95 shadow-sm"
              data-testid="capture-hud-submit"
            >
              <span>Capture</span>
              <CornerDownLeft size={12} />
            </button>
          </div>

          {/* Live NLP Extraction Token Chips */}
          <div className="flex flex-wrap items-center gap-1.5 min-h-[28px] pt-1" data-testid="capture-tokens-container">
            {parsed.cleanTitle && (
              <span className="text-[11px] text-[var(--text-secondary)] font-medium max-w-[200px] truncate mr-1">
                "{parsed.cleanTitle}"
              </span>
            )}

            {parsed.dueDate && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                <Calendar size={11} />
                <span>{parsed.dueDate}</span>
              </span>
            )}

            {parsed.dueTime && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                <Clock size={11} />
                <span>{parsed.dueTime}</span>
              </span>
            )}

            {parsed.estimatedMinutes && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <Clock size={11} />
                <span>{parsed.estimatedMinutes}m</span>
              </span>
            )}

            {parsed.projectTag && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Folder size={11} />
                <span>#{parsed.projectTag}</span>
              </span>
            )}

            {parsed.priority && (
              (() => {
                const badge = getPriorityBadge(parsed.priority);
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badge.color}`}>
                    <AlertCircle size={11} />
                    <span>{badge.label}</span>
                  </span>
                );
              })()
            )}

            {parsed.cognitiveLoad && (
              (() => {
                const cog = getCognitiveBadge(parsed.cognitiveLoad);
                const Icon = cog.icon;
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cog.color}`}>
                    <Icon size={11} />
                    <span>{cog.label}</span>
                  </span>
                );
              })()
            )}
          </div>

          {/* Quick Syntax Hints Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-color)]/60 text-[10px] text-[var(--text-muted)] font-mono">
            <div className="flex items-center gap-2">
              <span className="hover:text-[var(--text-secondary)]">#project</span>
              <span className="hover:text-[var(--text-secondary)]">!p1-p4</span>
              <span className="hover:text-[var(--text-secondary)]">~45m</span>
              <span className="hover:text-[var(--text-secondary)]">~deep</span>
              <span className="hover:text-[var(--text-secondary)]">tomorrow</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-color)]">↵</kbd>
              <span>Save</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-color)] ml-1">Esc</kbd>
              <span>Cancel</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
