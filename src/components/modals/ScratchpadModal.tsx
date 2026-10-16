import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { parseTaskInput } from '../../utils/nlpParser';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';
import {
  X,
  Copy,
  Check,
  Trash2,
  FileEdit,
  Sparkles,
  CornerDownLeft,
  CheckSquare,
  Square,
  Eye,
  Edit3,
  Calendar,
  Clock,
  ArrowRight,
} from 'lucide-react';

export interface ScratchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'scratchpad' | 'staging';
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

export const ScratchpadModal: React.FC<ScratchpadModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'scratchpad',
}) => {
  const {
    workspacePreferences,
    setWorkspacePreference,
    addMultipleTasks,
    showToast,
  } = useTaskContext();

  const [activeTab, setActiveTab] = useState<'scratchpad' | 'staging'>(initialTab);
  const [content, setContent] = useState<string>(() => {
    return (workspacePreferences.scratchpad as string) || '';
  });
  const [copied, setCopied] = useState(false);
  const [extractedCount, setExtractedCount] = useState<number | null>(null);

  // Staging tab state
  const [stagingText, setStagingText] = useState(content);
  const [stagingViewMode, setStagingViewMode] = useState<'edit' | 'preview'>('edit');
  const [stagingItems, setStagingItems] = useState<ParsedStagingItem[]>([]);

  // Autosave scratchpad content to workspace preferences
  useEffect(() => {
    if (workspacePreferences.scratchpad !== content) {
      setWorkspacePreference('scratchpad', content);
    }
  }, [content, workspacePreferences.scratchpad, setWorkspacePreference]);

  if (!isOpen) return null;

  // Scratchpad metrics
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    audioEngine.playCompletionChime();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (!content.trim()) return;
    const previous = content;
    setContent('');
    showToast('Cleared scratchpad notes', 'Undo', () => {
      setContent(previous);
    });
  };

  const handleExtractDirectly = () => {
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return;

    const cleanLines = lines
      .map((line) => line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
      .filter((line) => line.length > 0);

    if (cleanLines.length === 0) return;

    addMultipleTasks(cleanLines);
    audioEngine.playCompletionChime();
    try {
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
    } catch {}

    setExtractedCount(cleanLines.length);
    setTimeout(() => setExtractedCount(null), 3000);
  };

  // Staging logic
  const parseLines = (rawText: string): ParsedStagingItem[] => {
    const lines = rawText
      .split('\n')
      .map((l) => l.replace(/^[-*•\s]*(\[[ xX]\])?\s*(\d+[.)\]])?\s*/, '').trim())
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
    const parsed = parseLines(stagingText);
    setStagingItems(parsed);
    setStagingViewMode('preview');
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

  const handleImportStaging = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const itemsToImport =
      stagingViewMode === 'preview'
        ? stagingItems.filter((i) => i.isSelected)
        : parseLines(stagingText).map((i) => ({ ...i, isSelected: true }));

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

  const stagingLineCount = stagingText.split('\n').filter((l) => l.trim().length > 0).length;
  const selectedCount = stagingItems.filter((i) => i.isSelected).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scratchpad-modal-title"
      className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface-l1)] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 border border-[var(--border-subtle)] shadow-2xl card-surface relative flex flex-col max-h-[90dvh] sm:max-h-[85vh] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-10 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto -mt-2 mb-3 shrink-0" />

        {/* Header with Tab Navigation */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)] gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-[var(--color-brand)] border border-amber-500/20 shadow-xs">
              {activeTab === 'scratchpad' ? <FileEdit size={18} /> : <Sparkles size={18} />}
            </div>
            <div>
              <h3 id="scratchpad-modal-title" className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                {activeTab === 'scratchpad' ? 'Sticky Scratchpad' : 'Multi-Task Brain Dump & Staging'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                {activeTab === 'scratchpad'
                  ? 'Fleeting thoughts & raw notes. Autosaved locally.'
                  : 'Paste meeting notes, emails, or lists — automatically structured via NLP.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setActiveTab('scratchpad')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'scratchpad'
                    ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Notes
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('staging');
                  if (!stagingText && content) {
                    setStagingText(content);
                  }
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  activeTab === 'staging'
                    ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                NLP Staging
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab 1: Scratchpad */}
        {activeTab === 'scratchpad' && (
          <>
            <div className="flex-1 py-4 min-h-[260px] flex flex-col">
              <textarea
                id="scratchpad-textarea"
                name="scratchpadContent"
                aria-label="Scratchpad notes"
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Jot down quick thoughts, meeting notes, code snippets, or task bullets...
- Call Alex @calls p1 ~15m
- Review PR #code tomorrow"
                className="w-full flex-1 p-4 bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded-xl outline-none text-sm text-[var(--text-primary)] resize-none font-mono leading-relaxed focus:border-[var(--color-brand)] shadow-inner"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-hairline)] flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-3 text-[var(--text-muted)] font-mono text-[11px]">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} chars</span>
                {extractedCount !== null && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                    ✓ Extracted {extractedCount} tasks to Inbox!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!content.trim()}
                  title="Clear scratchpad"
                  aria-label="Clear scratchpad"
                  className="p-2 text-[var(--text-muted)] hover:text-rose-500 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/5 transition-colors disabled:opacity-30"
                >
                  <Trash2 size={15} />
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!content.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200/70 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/5 text-stone-700 dark:text-stone-300 font-medium transition-colors disabled:opacity-30"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStagingText(content);
                    setActiveTab('staging');
                  }}
                  disabled={!content.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold transition-all disabled:opacity-30"
                >
                  <Eye size={13} />
                  <span>Preview in Staging</span>
                </button>

                <button
                  type="button"
                  onClick={handleExtractDirectly}
                  disabled={!content.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-bold shadow-xs transition-all active:scale-95 disabled:opacity-40"
                >
                  <Sparkles size={13} />
                  <span>Extract Tasks</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Tab 2: NLP Staging */}
        {activeTab === 'staging' && (
          <>
            {stagingLineCount > 0 && (
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] py-2 mb-3">
                <div className="flex items-center gap-1.5 bg-[var(--bg-surface-l2)] p-1 rounded-lg border border-[var(--border-hairline)]">
                  <button
                    type="button"
                    onClick={() => setStagingViewMode('edit')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      stagingViewMode === 'edit'
                        ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Edit3 size={12} />
                    <span>Raw Text ({stagingLineCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchToPreview}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      stagingViewMode === 'preview'
                        ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Eye size={12} />
                    <span>Structured Preview</span>
                  </button>
                </div>

                {stagingViewMode === 'preview' && (
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

            <div className="flex-1 overflow-y-auto min-h-[220px]">
              {stagingViewMode === 'edit' ? (
                <textarea
                  autoFocus
                  id="brain-dump-textarea"
                  name="brainDumpNotes"
                  aria-label="Brain dump notes"
                  rows={9}
                  value={stagingText}
                  onChange={(e) => setStagingText(e.target.value)}
                  placeholder={`- [ ] Review architecture spec tomorrow morning p1 #work ~45m\n* Finish quarterly filing by friday #finance\n1. Pick up groceries and laundry tonight\nSchedule dentist cleaning next week`}
                  className="w-full text-xs p-4 bg-[var(--bg-surface-l2)] text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl outline-none focus:border-[var(--color-brand)] resize-none font-mono leading-relaxed card-surface h-full"
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
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          item.isSelected
                            ? 'bg-[var(--bg-surface-l2)] border-amber-500/30 card-surface'
                            : 'bg-[var(--bg-surface-l2)]/40 border-transparent opacity-60'
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

            <div className="flex items-center justify-between pt-4 mt-3 border-t border-[var(--border-hairline)]">
              <span className="text-xs text-[var(--text-muted)] font-mono font-medium">
                {stagingViewMode === 'preview'
                  ? `${selectedCount} of ${stagingItems.length} selected for import`
                  : `${stagingLineCount} ${stagingLineCount === 1 ? 'task' : 'tasks'} detected`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>

                {stagingViewMode === 'edit' && stagingLineCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleSwitchToPreview}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[var(--bg-surface-l2)] hover:bg-stone-200/60 dark:hover:bg-white/[0.08] text-[var(--text-primary)] rounded-lg text-xs font-semibold border border-[var(--border-hairline)] transition-all shadow-xs"
                  >
                    <Eye size={13} />
                    <span>Preview Structure</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleImportStaging()}
                  disabled={stagingViewMode === 'preview' ? selectedCount === 0 : stagingLineCount === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white rounded-lg text-xs font-bold shadow-xs transition-all disabled:opacity-40 active:scale-95 card-surface"
                >
                  <span>Import {stagingViewMode === 'preview' ? `(${selectedCount})` : stagingLineCount > 0 ? `(${stagingLineCount})` : ''}</span>
                  <CornerDownLeft size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
