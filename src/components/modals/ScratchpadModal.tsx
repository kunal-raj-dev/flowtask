import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';
import {
  X,
  Copy,
  Check,
  Trash2,
  FileEdit,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface ScratchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY_SCRATCHPAD = 'flowtask_scratchpad_v1';

export const ScratchpadModal: React.FC<ScratchpadModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addTask, showToast } = useTaskContext();
  const [content, setContent] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SCRATCHPAD) || '';
  });
  const [copied, setCopied] = useState(false);
  const [extractedCount, setExtractedCount] = useState<number | null>(null);

  // Autosave to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SCRATCHPAD, content);
  }, [content]);

  if (!isOpen) return null;

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

  const handleExtractTasks = () => {
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return;

    let created = 0;
    lines.forEach((line) => {
      // Strip markdown bullets / numbers
      const cleanLine = line.replace(/^[-*•]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();
      if (cleanLine.length > 0) {
        addTask(cleanLine);
        created++;
      }
    });

    if (created > 0) {
      audioEngine.playCompletionChime();
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
      setExtractedCount(created);
      setTimeout(() => setExtractedCount(null), 3000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 dark:bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#12151D] rounded-xl p-6 border border-stone-200/80 dark:border-white/10 shadow-2xl dark:shadow-black/70 card-surface relative flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200/60 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-[var(--color-brand)] border border-amber-500/20 shadow-xs">
              <FileEdit size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 tracking-tight">
                  Sticky Scratchpad
                </h3>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                Fleeting thoughts, phone numbers, and raw notes. Autosaved locally.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Text Area */}
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
            className="w-full flex-1 p-4 bg-stone-50/70 dark:bg-[#0E1118] border border-stone-200/70 dark:border-white/5 rounded-lg outline-none text-sm text-stone-900 dark:text-stone-100 resize-none font-mono leading-relaxed focus:border-[var(--color-brand)] shadow-inner"
          />
        </div>

        {/* Footer with Counters & Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200/60 dark:border-white/5 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3 text-stone-400 font-mono text-[11px]">
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
              className="p-2 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-stone-100 dark:hover:bg-white/5 transition-colors disabled:opacity-30"
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
              onClick={handleExtractTasks}
              disabled={!content.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-bold shadow-xs transition-all active:scale-95 disabled:opacity-40"
            >
              <Sparkles size={13} />
              <span>Extract Tasks</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
