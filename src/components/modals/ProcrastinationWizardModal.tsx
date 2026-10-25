import React, { useState } from 'react';
import type { Task } from '../../types/task';
import {
  X,
  Sparkles,
  Zap,
  FileEdit,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Compass,
} from 'lucide-react';
import { audioEngine } from '../../services/audioEngine';

export interface ProcrastinationWizardModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onAddSubtasks?: (taskId: string, subtaskTitles: string[]) => void;
  onStartSprint?: (taskId: string, durationMinutes: number) => void;
  onSaveDraftToNotes?: (taskId: string, draft: string) => void;
}

export type ProcrastinationType = 'overwhelmed' | 'averse' | 'perfectionism';

export const ProcrastinationWizardModal: React.FC<ProcrastinationWizardModalProps> = ({
  task,
  isOpen,
  onClose,
  onAddSubtasks,
  onStartSprint,
  onSaveDraftToNotes,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<ProcrastinationType | null>(null);

  // Overwhelmed breakdown inputs
  const [microSteps, setMicroSteps] = useState<string[]>([
    'Gather links, files, and relevant reference tabs',
    'Write down the 3 main sections or bullet points',
    'Complete the very first draft bullet point',
  ]);

  // Perfectionism ugly draft
  const [uglyDraft, setUglyDraft] = useState<string>('');

  if (!isOpen) return null;

  const handleSelectType = (type: ProcrastinationType) => {
    setSelectedType(type);
    setStep(2);
    audioEngine.playMagneticSnap();
  };

  const handleCommitOverwhelmed = () => {
    const validSteps = microSteps.filter((s) => s.trim().length > 0);
    if (onAddSubtasks && validSteps.length > 0) {
      onAddSubtasks(task.id, validSteps);
    }
    audioEngine.playTaskComplete();
    setStep(3);
  };

  const handleLaunchSprint = (minutes: number = 5) => {
    if (onStartSprint) {
      onStartSprint(task.id, minutes);
    }
    audioEngine.playTimerChime();
    setStep(3);
  };

  const handleSaveUglyDraft = () => {
    if (onSaveDraftToNotes && uglyDraft.trim()) {
      onSaveDraftToNotes(task.id, uglyDraft);
    }
    audioEngine.playTaskComplete();
    setStep(3);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Procrastination Diagnostic Wizard"
      data-testid="procrastination-wizard-modal"
    >
      <div className="w-full max-w-lg bg-[var(--bg-main)] border border-[var(--border-color)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-l1)]">
          <div className="flex items-center gap-2">
            <Compass className="text-[var(--color-brand)]" size={20} />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Procrastination Triage Wizard</h2>
              <p className="text-[11px] text-[var(--text-secondary)] truncate max-w-xs">
                {task.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Modal"
            className="p-1 rounded-lg hover:bg-[var(--bg-surface-l2)] text-[var(--text-secondary)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Step 1: Diagnose */}
          {step === 1 && (
            <div className="space-y-4" data-testid="wizard-step-1">
              <h3 className="text-base font-bold text-center">What is holding you back right now?</h3>
              <p className="text-xs text-center text-[var(--text-secondary)] max-w-sm mx-auto">
                No guilt. Executive dysfunction is a friction problem, not a character flaw. Pick the
                feeling that matches:
              </p>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <button
                  onClick={() => handleSelectType('overwhelmed')}
                  className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] hover:border-amber-500 hover:bg-amber-500/5 text-left transition-all"
                  data-testid="type-overwhelmed-btn"
                >
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">1. Overwhelmed</div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      It feels huge, amorphous, or confusing. I don't know where to start.
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectType('averse')}
                  className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] hover:border-blue-500 hover:bg-blue-500/5 text-left transition-all"
                  data-testid="type-averse-btn"
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Zap size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">2. Averse / Low Dopamine</div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      I dread doing it, it feels boring or tedious, and my brain resists starting.
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectType('perfectionism')}
                  className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] hover:border-purple-500 hover:bg-purple-500/5 text-left transition-all"
                  data-testid="type-perfectionism-btn"
                >
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <FileEdit size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold">3. Perfectionism / High Stakes</div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      I want it to be great and fear making a flawed or substandard draft.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Tailored Intervention */}
          {step === 2 && selectedType === 'overwhelmed' && (
            <div className="space-y-4" data-testid="wizard-intervention-overwhelmed">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Sparkles size={16} />
                <span>Micro-Action Decomposition</span>
              </div>
              <h3 className="text-sm font-bold">Break it into 3 bite-sized 5-minute tasks</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Completing just one micro-step is 100% enough to build momentum:
              </p>

              <div className="space-y-2">
                {microSteps.map((stepText, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[var(--text-muted)] w-5">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={stepText}
                      onChange={(e) => {
                        const next = [...microSteps];
                        next[idx] = e.target.value;
                        setMicroSteps(next);
                      }}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
                <button
                  onClick={() => setStep(1)}
                  className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Back
                </button>
                <button
                  onClick={handleCommitOverwhelmed}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] shadow"
                  data-testid="commit-subtasks-btn"
                >
                  <span>Add Micro-Steps & Begin</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && selectedType === 'averse' && (
            <div className="space-y-4 text-center" data-testid="wizard-intervention-averse">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Zap size={16} />
                <span>The 5-Minute Dash</span>
              </div>
              <h3 className="text-sm font-bold">Just do 5 minutes. Permission to quit guaranteed.</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Set a timer for 5 minutes. Work with zero expectation of finishing. If you still hate
                it at 5 minutes, stop guilt-free. 80% of the time, the brain resistance fades once
                started.
              </p>

              <div className="py-6 flex justify-center">
                <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-mono text-2xl font-black">
                  <Clock size={24} />
                  <span>05:00</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
                <button
                  onClick={() => setStep(1)}
                  className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Back
                </button>
                <button
                  onClick={() => handleLaunchSprint(5)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow"
                  data-testid="launch-dash-btn"
                >
                  <span>Launch 5-Minute Dash</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && selectedType === 'perfectionism' && (
            <div className="space-y-4" data-testid="wizard-intervention-perfectionism">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
                <FileEdit size={16} />
                <span>The Ugly First Draft Sandbox</span>
              </div>
              <h3 className="text-sm font-bold">Write garbage on purpose</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                You cannot edit a blank page. Write stream-of-consciousness fragments without grammar,
                styling, or judgment:
              </p>

              <textarea
                value={uglyDraft}
                onChange={(e) => setUglyDraft(e.target.value)}
                placeholder="Write rough unpolished thoughts here... Just get words on screen..."
                rows={5}
                className="w-full p-3 text-xs rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-purple-500 font-mono"
                data-testid="ugly-draft-textarea"
              />

              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-color)]">
                <button
                  onClick={() => setStep(1)}
                  className="px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveUglyDraft}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 shadow"
                  data-testid="save-ugly-draft-btn"
                >
                  <span>Save Draft to Task Notes</span>
                  <Check size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success Confirmation */}
          {step === 3 && (
            <div className="space-y-4 text-center py-4" data-testid="wizard-step-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-base font-bold">Friction Shattered!</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                You've lowered the activation energy barrier. Take a breath, stay relaxed, and trust
                the momentum.
              </p>

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] shadow"
                  data-testid="close-wizard-btn"
                >
                  Ready to Work
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
