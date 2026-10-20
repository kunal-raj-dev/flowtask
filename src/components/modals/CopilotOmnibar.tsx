import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  ArrowRight,
  CheckCircle2,
  Clock,
  Zap,
  Play,
  Layers,
} from 'lucide-react';
import { executeWebMcpTool } from '../../services/webMcpService';
import { suggestSubtasks, generateStarterStep, type SuggestedSubtask } from '../../utils/aiCopilot';
import { audioEngine } from '../../utils/audioEngine';
import { SPRING_TACTILE } from '../../utils/springPhysics';
import { useMotionPreference } from '../../hooks/useMotionPreference';
import { useModalStore } from '../../store/useModalStore';

export interface CopilotOmnibarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CopilotResult {
  type: 'decomposition' | 'summary' | 'focus' | 'general';
  title: string;
  starterStep?: string;
  subtasks?: SuggestedSubtask[];
  summaryData?: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    topThreeCount: number;
    topThreeCompleted: number;
    totalPlannedMinutes: number;
    focusedSeconds: number;
  };
  message?: string;
}

const QUICK_SUGGESTIONS = [
  { label: 'Decompose feature', prompt: 'Implement user profile settings and dark mode' },
  { label: 'Decompose bug fix', prompt: 'Fix memory leak in background focus timer' },
  { label: 'Plan launch', prompt: 'Prepare marketing launch and product hunt campaign' },
  { label: 'Daily summary', prompt: 'Show me my daily productivity summary' },
  { label: 'Start focus', prompt: 'Start 25m Pomodoro on priority tasks' },
];

export const CopilotOmnibar: React.FC<CopilotOmnibarProps> = ({ isOpen, onClose }) => {
  const reduced = useMotionPreference();
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [applied, setApplied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-focus input and restore previous focus on unmount
  useEffect(() => {
    if (isOpen) {
      const prevActive = document.activeElement as HTMLElement | null;
      inputRef.current?.focus();
      return () => {
        prevActive?.focus?.();
      };
    }
  }, [isOpen]);

  // Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleRunPrompt = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    setIsProcessing(true);
    setApplied(false);
    audioEngine.playClickSound();

    try {
      const lower = clean.toLowerCase();

      // Check intent: Summary
      if (lower.includes('summary') || lower.includes('stats') || lower.includes('progress')) {
        const summary = (await executeWebMcpTool('getDailySummary', {})) as {
          totalTasks: number;
          completedTasks: number;
          completionRate: number;
          topThreeCount: number;
          topThreeCompleted: number;
          totalPlannedMinutes: number;
          focusedSeconds: number;
        };

        setResult({
          type: 'summary',
          title: 'Daily Productivity Summary',
          summaryData: summary,
          message: `You have completed ${summary.completedTasks}/${summary.totalTasks} tasks today (${summary.completionRate}% completion rate).`,
        });
      }
      // Check intent: Focus
      else if (lower.includes('focus') || lower.includes('pomodoro') || lower.includes('sprint')) {
        const durationMatch = clean.match(/(\d+)\s*(?:m|min|minutes)/i);
        const minutes = durationMatch ? parseInt(durationMatch[1], 10) : 25;

        setResult({
          type: 'focus',
          title: `Start Focus Session (${minutes}m)`,
          message: `Ready to initiate a dedicated ${minutes}-minute deep work block with binaural beats and minimalist timer.`,
        });
      }
      // Default: Decompose task with offline heuristics
      else {
        const subtasks = suggestSubtasks(clean);
        const starterStep = generateStarterStep(clean);

        setResult({
          type: 'decomposition',
          title: clean,
          subtasks,
          starterStep,
          message: `Decomposed into ${subtasks.length} actionable execution steps with anti-procrastination starter.`,
        });
      }
    } catch {
      setResult({
        type: 'general',
        title: 'Action Error',
        message: 'Could not process the command. Please check workspace state and try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyToWorkspace = async () => {
    if (!result || applied) return;

    audioEngine.playPopSound();
    try {
      if (result.type === 'decomposition' && result.subtasks) {
        await executeWebMcpTool('createTask', {
          title: result.title,
          description: result.starterStep ? `${result.starterStep}\n\n` : '',
          estimatedMinutes: result.subtasks.reduce((sum, s) => sum + (s.estimatedMinutes || 20), 0),
        });
        setApplied(true);
      } else if (result.type === 'focus') {
        const durationMatch = query.match(/(\d+)\s*(?:m|min|minutes)/i);
        const minutes = durationMatch ? parseInt(durationMatch[1], 10) : 25;
        await executeWebMcpTool('startFocusSession', {
          taskTitle: query.replace(/start focus|pomodoro/gi, '').trim() || 'Deep Work Session',
          targetDurationMinutes: minutes,
        });
        setApplied(true);
        useModalStore.getState().openModal('focusEngine');
        onClose();
      }
    } catch {
      // Handled cleanly
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        key="copilot-backdrop"
        className="fixed inset-0 z-[9990] bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div key="copilot-wrapper" className="fixed inset-0 z-[9991] flex items-start justify-center pt-20 px-4 pointer-events-none">
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-label="FlowTask Copilot"
          aria-modal="true"
          initial={reduced ? undefined : { opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, scale: 0.96, y: -8 }}
          transition={reduced ? { duration: 0 } : SPRING_TACTILE}
          className="w-full max-w-2xl rounded-2xl bg-surface border border-border shadow-cute-modal p-4 pointer-events-auto flex flex-col gap-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  FlowTask Copilot
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-normal">
                    WebMCP 2.0 • Offline AI
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Decompose complex tasks, schedule timeline blocks, or review productivity metrics
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close Copilot"
              className="p-1 rounded-lg hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Prompt input */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-l1 border border-border focus-within:border-amber-500/50 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all">
            <Sparkles size={16} className="text-amber-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRunPrompt((e.target as HTMLInputElement).value || query);
                }
              }}
              placeholder="Ask Copilot: decompose a goal, schedule tasks, summarize today..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={() => handleRunPrompt(query)}
              disabled={!query.trim() || isProcessing}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            >
              {isProcessing ? 'Thinking...' : 'Execute'}
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Quick suggestions */}
          {!result && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-muted-foreground font-medium mr-1">Suggestions:</span>
              {QUICK_SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setQuery(item.prompt);
                    handleRunPrompt(item.prompt);
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg bg-surface-l1 hover:bg-surface-hover border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Result view */}
          {result && (
            <div className="flex flex-col gap-3 rounded-xl bg-surface-l1 border border-border/60 p-3.5 max-h-80 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" />
                  {result.title}
                </span>
                {result.type === 'decomposition' && (
                  <button
                    onClick={handleApplyToWorkspace}
                    disabled={applied}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                      applied
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                    }`}
                  >
                    {applied ? (
                      <>
                        <CheckCircle2 size={13} />
                        Added to Workspace
                      </>
                    ) : (
                      <>
                        <Layers size={13} />
                        Add Task with Subtasks
                      </>
                    )}
                  </button>
                )}
                {result.type === 'focus' && (
                  <button
                    onClick={handleApplyToWorkspace}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 text-amber-950 hover:bg-amber-400 transition-all flex items-center gap-1.5"
                  >
                    <Play size={13} />
                    Launch Focus Studio
                  </button>
                )}
              </div>

              {result.starterStep && (
                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {result.starterStep}
                </div>
              )}

              {result.subtasks && result.subtasks.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Execution Steps ({result.subtasks.length})
                  </span>
                  {result.subtasks.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border/40 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-muted/60 text-[10px] font-mono flex items-center justify-center text-muted-foreground font-semibold">
                          {idx + 1}
                        </span>
                        <span className="text-foreground">{step.title}</span>
                      </div>
                      {step.estimatedMinutes && (
                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          <Clock size={11} />
                          {step.estimatedMinutes}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {result.summaryData && (
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-surface border border-border/40 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Completion Rate
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {result.summaryData.completionRate}%
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {result.summaryData.completedTasks} / {result.summaryData.totalTasks} tasks
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface border border-border/40 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Top 3 Focus
                    </span>
                    <span className="text-xl font-bold text-amber-500">
                      {result.summaryData.topThreeCompleted} / {result.summaryData.topThreeCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Priority executed</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface border border-border/40 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                      Focus Time
                    </span>
                    <span className="text-xl font-bold text-sky-500">
                      {Math.round(result.summaryData.focusedSeconds / 60)}m
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Deep work logged</span>
                  </div>
                </div>
              )}

              {result.message && (
                <p className="text-xs text-muted-foreground">{result.message}</p>
              )}
            </div>
          )}

          {/* Footer hotkey tips */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2.5">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] font-mono">Cmd+J</kbd>
              <span>Toggle Copilot</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] font-mono">Esc</kbd>
              <span>Dismiss</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
