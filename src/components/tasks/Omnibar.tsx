import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { parseTaskInput } from '../../utils/nlpParser';
import type { Priority } from '../../types/task';
import {
  createVoiceDictationSession,
  isVoiceDictationSupported,
  type VoiceDictationSession,
} from '../../utils/voiceDictationService';
import { audioEngine } from '../../utils/audioEngine';
import {
  Plus,
  Calendar,
  Flag,
  Folder,
  Clock,
  Sparkles,
  CornerDownLeft,
  Mic,
  MicOff,
  Tag,
  LayoutTemplate,
} from 'lucide-react';

interface OmnibarProps {
  onOpenBrainDump: () => void;
}

export const Omnibar: React.FC<OmnibarProps> = ({ onOpenBrainDump }) => {
  const { addTask, setIsTemplatePickerOpen, showToast } = useTaskContext();
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice-to-Task Speech Recognition
  const [isListening, setIsListening] = useState(false);
  const sessionRef = useRef<VoiceDictationSession | null>(null);

  const isSpeechSupported = isVoiceDictationSupported();

  const toggleVoiceInput = useCallback(() => {
    if (!isSpeechSupported) {
      showToast('Voice dictation is not supported in this browser.');
      return;
    }

    if (isListening) {
      sessionRef.current?.stop();
      setIsListening(false);
      audioEngine.playClickSound();
      return;
    }

    const session = createVoiceDictationSession({
      onStart: () => {
        setIsListening(true);
        audioEngine.playClickSound();
      },
      onTranscript: (transcript) => {
        setInput(transcript);
      },
      onError: (msg) => {
        setIsListening(false);
        showToast(msg);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    sessionRef.current = session;
    const started = session.start();
    if (!started) {
      setIsListening(false);
      showToast('Could not access microphone.');
    }
  }, [isSpeechSupported, isListening, showToast]);

  useEffect(() => {
    return () => {
      sessionRef.current?.abort();
    };
  }, []);

  // Global 'N' shortcut to focus Omnibar and 'Ctrl+Shift+V' to toggle Voice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global 'N' shortcut to focus Omnibar
      if (
        (e.key === 'n' || e.key === 'N') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Ctrl+Shift+V or Cmd+Shift+V to toggle Voice Dictation
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        toggleVoiceInput();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleVoiceInput]);

  const parsed = parseTaskInput(input);
  const hasRecognizedTokens =
    parsed.dueDate ||
    parsed.priority ||
    parsed.projectTag ||
    parsed.estimatedMinutes ||
    (parsed.contextTags && parsed.contextTags.length > 0);

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
        className={`relative rounded-xl transition-all duration-150 border ${
          isFocused
            ? 'bg-white dark:bg-[var(--bg-surface-l2)] border-amber-500/60 dark:border-amber-400/50 shadow-elevated ring-2 ring-amber-500/20'
            : 'bg-white dark:bg-[var(--bg-surface-l2)] border-[var(--border-subtle)] shadow-subtle hover:border-[var(--border-hairline)]'
        }`}
      >
        <div className="flex items-center px-4 py-3">
          <div className="text-[var(--text-muted)] mr-3 flex-shrink-0 transition-colors">
            <Plus size={18} className={isFocused ? 'text-amber-500 dark:text-amber-400' : ''} />
          </div>

          <input
            ref={inputRef}
            id="task-capture-input"
            name="taskInput"
            aria-label="Add a task"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={
              isFocused
                ? typeof window !== 'undefined' && window.innerWidth < 640
                  ? "Task name... (e.g. #work @calls p1)"
                  : "Type task name... ('tomorrow', '#project', '@context', 'p1', '~30m')"
                : typeof window !== 'undefined' && window.innerWidth < 640
                ? "Add a task..."
                : "Add a task... (press 'N')"
            }
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

            <button
              type="button"
              onClick={() => setIsTemplatePickerOpen(true)}
              title="Workflow Blueprints & Templates"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <LayoutTemplate size={16} />
            </button>

            {isSpeechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                title={isListening ? 'Stop listening (Ctrl+Shift+V)' : 'Dictate task hands-free (Ctrl+Shift+V)'}
                className={`p-1.5 rounded-lg transition-all ${
                  isListening
                    ? 'text-rose-500 bg-rose-500/15 border border-rose-500/30 animate-pulse ring-2 ring-rose-500/20'
                    : 'text-[var(--text-muted)] hover:text-rose-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                }`}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}

            {input.trim() && (
              <button
                type="submit"
                className="flex items-center gap-1 px-3 py-1.5 bg-stone-900 dark:bg-white hover:bg-stone-800 dark:hover:bg-stone-100 text-white dark:text-stone-950 rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
              >
                <span>Add</span>
                <CornerDownLeft size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Active Speech Dictation Waveform Indicator */}
        {isListening && (
          <div className="px-4 py-2 bg-rose-500/[0.08] dark:bg-rose-500/[0.12] border-t border-rose-500/20 flex items-center justify-between gap-3 text-xs text-rose-600 dark:text-rose-400 animate-slide-down">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span className="font-semibold">
                Listening... Speak naturally (e.g. &quot;Finish Q4 spec tomorrow at 2pm #work p1 ~45m&quot;)
              </span>
            </div>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className="px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-[11px] font-bold text-rose-700 dark:text-rose-300 transition-colors"
            >
              Done (Ctrl+Shift+V)
            </button>
          </div>
        )}

        {/* Quick Helper Token Chips when focused & empty */}
        {isFocused && input.trim().length === 0 && (
          <div className="px-4 pb-2.5 pt-1 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] animate-slide-down">
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
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setInput((prev) => (prev ? `${prev} @calls` : '@calls '));
              }}
              className="px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 transition-colors"
            >
              + @calls
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setInput((prev) => (prev ? `${prev} @computer` : '@computer '));
              }}
              className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
            >
              + @computer
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

            {parsed.contextTags && parsed.contextTags.length > 0 && (
              parsed.contextTags.map((ctx) => (
                <span
                  key={ctx}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-400/40 shadow-xs font-mono"
                >
                  <Tag size={10} />@{ctx}
                </span>
              ))
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
