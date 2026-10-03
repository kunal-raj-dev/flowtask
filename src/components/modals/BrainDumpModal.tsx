import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { parseTaskInput } from '../../utils/nlpParser';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';
import {
  X,
  Sparkles,
  CornerDownLeft,
  CheckSquare,
  Square,
  Eye,
  Edit3,
  Calendar,
  Clock,
} from 'lucide-react';

interface BrainDumpModalProps {
  onClose: () => void;
}

interface ParsedStagingItem {
  id: string;
  originalText: string;
  title: string;
  priority?: string;
  dueDate?: string;
  dueTime?: string;
  projectTag?: string;
  estimatedMinutes?: number;
  isSelected: boolean;
}

export const BrainDumpModal: React.FC<BrainDumpModalProps> = ({ onClose }) => {
  const { addMultipleTasks } = useTaskContext();
  const [text, setText] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [stagingItems, setStagingItems] = useState<ParsedStagingItem[]>([]);

  // Parses raw text lines into structured staging items
  const parseLines = (rawText: string) => {
    const lines = rawText
      .split('\n')
      .map((l) =>
        l
          .replace(/^[-*•\s]*(\[[ xX]\])?\s*(\d+[.)\]])?\s*/, '') // Strip checkboxes, bullets, numbers
          .trim()
      )
      .filter((l) => l.length > 0);

    return lines.map((line, idx) => {
      const parsed = parseTaskInput(line);
      return {
        id: `staging-${idx}-${line.slice(0, 10)}`,
        originalText: line,
        title: parsed.cleanTitle || line,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        projectTag: parsed.projectTag,
        estimatedMinutes: parsed.estimatedMinutes,
        isSelected: true,
      };
    });
  };

  const handleSwitchToPreview = () => {
    const parsed = parseLines(text);
    setStagingItems(parsed);
    setViewMode('preview');
  };

  const handleToggleItem = (id: string) => {
    setStagingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  const handleToggleAll = () => {
    const allSelected = stagingItems.every((item) => item.isSelected);
    setStagingItems((prev) => prev.map((item) => ({ ...item, isSelected: !allSelected })));
  };

  const handleImport = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const itemsToImport =
      viewMode === 'preview'
        ? stagingItems.filter((i) => i.isSelected)
        : parseLines(text).map((i) => ({ ...i, isSelected: true }));

    if (itemsToImport.length === 0) return;

    addMultipleTasks(itemsToImport.map((item) => item.originalText));

    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {}

    audioEngine.playCompletionChime();
    onClose();
  };

  const lineCount = text.split('\n').filter((l) => l.trim().length > 0).length;
  const selectedCount = stagingItems.filter((i) => i.isSelected).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface-l2)] rounded-xl p-6 sm:p-7 border border-[var(--border-hairline)] shadow-modal relative card-surface max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs shrink-0">
            <Sparkles size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Multi-Task Brain Dump & Staging
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Paste messy meeting notes, emails, or lists &mdash; automatically structured via NLP
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        {lineCount > 0 && (
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3 mb-3">
            <div className="flex items-center gap-1.5 bg-[var(--bg-surface-l1)] p-1 rounded-lg border border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'edit'
                    ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Edit3 size={12} />
                <span>Raw Text ({lineCount})</span>
              </button>
              <button
                type="button"
                onClick={handleSwitchToPreview}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  viewMode === 'preview'
                    ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Eye size={12} />
                <span>Structured Preview</span>
              </button>
            </div>

            {viewMode === 'preview' && (
              <button
                type="button"
                onClick={handleToggleAll}
                className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                {selectedCount === stagingItems.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto min-h-[220px]">
          {viewMode === 'edit' ? (
            <textarea
              autoFocus
              id="brain-dump-textarea"
              name="brainDumpNotes"
              aria-label="Brain dump notes"
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`- [ ] Review architecture spec tomorrow morning p1 #work ~45m\n* Finish quarterly filing by friday #finance\n1. Pick up groceries and laundry tonight\nSchedule dentist cleaning next week`}
              className="w-full text-xs p-4 bg-[var(--bg-surface-l1)]/60 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-lg outline-none focus:border-[var(--color-brand)] resize-none font-mono leading-relaxed card-surface h-full"
            />
          ) : (
            <div className="space-y-2">
              {stagingItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  No tasks parsed. Return to raw editor to add text.
                </div>
              ) : (
                stagingItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleItem(item.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      item.isSelected
                        ? 'bg-[var(--bg-surface-l1)] border-amber-500/30 card-surface'
                        : 'bg-[var(--bg-surface-l1)]/40 border-transparent opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleItem(item.id);
                        }}
                        className="text-amber-600 dark:text-amber-400 shrink-0"
                      >
                        {item.isSelected ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} className="text-stone-400" />
                        )}
                      </button>
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {item.title}
                      </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {item.projectTag && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold">
                          #{item.projectTag}
                        </span>
                      )}
                      {item.priority && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase font-mono ${
                            item.priority === 'p1'
                              ? 'bg-rose-500/15 text-rose-600'
                              : item.priority === 'p2'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-blue-500/15 text-blue-600'
                          }`}
                        >
                          {item.priority.toUpperCase()}
                        </span>
                      )}
                      {(item.dueDate || item.dueTime) && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                          <Calendar size={10} />
                          <span>{item.dueDate || 'Today'} {item.dueTime || ''}</span>
                        </span>
                      )}
                      {item.estimatedMinutes && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 flex items-center gap-0.5">
                          <Clock size={10} />
                          <span>{item.estimatedMinutes}m</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-muted)] font-mono font-medium">
            {viewMode === 'preview'
              ? `${selectedCount} of ${stagingItems.length} selected for import`
              : `${lineCount} ${lineCount === 1 ? 'task' : 'tasks'} detected`}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>

            {viewMode === 'edit' && lineCount > 0 ? (
              <button
                type="button"
                onClick={handleSwitchToPreview}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-surface-l1)] hover:bg-stone-200/60 dark:hover:bg-white/[0.08] text-[var(--text-primary)] rounded-lg text-xs font-semibold border border-[var(--border-hairline)] transition-all shadow-xs"
              >
                <Eye size={13} />
                <span>Preview Structure</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => handleImport()}
              disabled={viewMode === 'preview' ? selectedCount === 0 : lineCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white rounded-lg text-xs font-bold shadow-xs transition-all disabled:opacity-40 active:scale-95 card-surface"
            >
              <span>Import {viewMode === 'preview' ? `(${selectedCount})` : lineCount > 0 ? `(${lineCount})` : ''}</span>
              <CornerDownLeft size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
