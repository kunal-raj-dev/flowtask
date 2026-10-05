import React, { useState } from 'react';
import { Sparkles, Sun, CheckCircle2, ArrowRight, Clock, Target, ShieldCheck, Flame } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { formatLocalDate } from '../../utils/nlpParser';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const {
    addMultipleTasks,
    updateSettings,
    settings,
    theme,
    toggleTheme,
  } = useTaskContext();

  const [capacity, setCapacity] = useState(settings?.targetWorkCapacityHours || 6.0);
  const [task1, setTask1] = useState('');
  const [task2, setTask2] = useState('');
  const [task3, setTask3] = useState('');

  if (!isOpen) return null;

  const handleSkip = () => {
    updateSettings({ onboardingCompleted: true });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('flowtask_onboarding_completed', 'true');
    }
    onClose();
  };

  const handleFinish = () => {
    // Save capacity setting
    updateSettings({
      targetWorkCapacityHours: capacity,
      onboardingCompleted: true,
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('flowtask_onboarding_completed', 'true');
    }

    // Add captured top 3 tasks if typed
    const todayStr = formatLocalDate(new Date());
    const tasksToAdd = [task1.trim(), task2.trim(), task3.trim()].filter(Boolean);

    if (tasksToAdd.length > 0) {
      addMultipleTasks(tasksToAdd, {
        priority: 'p1',
        isPinnedToday: true,
        dueDate: todayStr,
        plannedDate: todayStr,
        estimatedMinutes: 45,
      });
    }

    audioEngine.playCompletionChime();
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Backdrop with ambient blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="relative z-10 w-full max-w-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] rounded-3xl shadow-2xl overflow-hidden flex flex-col transform transition-all duration-300 animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome Setup Ritual"
      >
        {/* Header bar with progress dots & Skip button */}
        <div className="px-6 pt-5 pb-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === i
                    ? 'w-7 bg-amber-500'
                    : step > i
                    ? 'w-3 bg-amber-500/50'
                    : 'w-2 bg-stone-300 dark:bg-stone-700'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2.5 py-1 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
          >
            Skip setup
          </button>
        </div>

        {/* Step 1: Mindful Welcome */}
        {step === 1 && (
          <div className="p-6 sm:p-8 space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <Sun size={32} className="animate-spin-slow" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Cognitive Psychology-Informed Planning
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                Welcome to FlowTask
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
                Traditional to-do lists trigger anxiety with endless backlogs. FlowTask guards your mental bandwidth with the <strong className="text-[var(--text-primary)]">Rule of 3</strong> and realistic daily capacities.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-2 text-left">
              <div className="p-3 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-1">
                <Target size={16} className="text-amber-500" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">Top 3 Focus</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Anchor each day with your 3 highest-leverage tasks.</p>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-1">
                <Clock size={16} className="text-indigo-500" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">Time Blocking</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Schedule realistic blocks, never overcommit.</p>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-1">
                <ShieldCheck size={16} className="text-emerald-500" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">Anti-Shame</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Morning clean-slate triage resets guilt-free.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                audioEngine.playClickSound();
                setStep(2);
              }}
              className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Set Up My Daily Capacity</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Capacity & Theme Calibration */}
        {step === 2 && (
          <div className="p-6 sm:p-8 space-y-6 animate-fade-in">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Step 1 of 2
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                Calibrate Your Daily Deep Work Capacity
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Human cognitive energy caps out at 4–6 hours of true deep work per day.
              </p>
            </div>

            {/* Capacity Slider & Presets */}
            <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[var(--text-secondary)] block">Target Daily Workload:</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Work or study sprint hours</span>
                </div>
                <div className="flex items-center gap-1 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-xl px-2.5 py-1 focus-within:ring-2 focus-within:ring-amber-500 transition-all">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    aria-label="Target daily workload in hours"
                    value={capacity}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= 1 && v <= 24) setCapacity(v);
                    }}
                    className="w-12 bg-transparent text-right font-mono font-bold text-sm text-amber-700 dark:text-amber-300 outline-none"
                  />
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">hrs</span>
                </div>
              </div>

              <input
                type="range"
                min="1"
                max={Math.max(16, Math.ceil(capacity))}
                step="0.5"
                value={capacity}
                onChange={(e) => setCapacity(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                <span>1h (Minimal)</span>
                <span>6h (Recommended Deep Work)</span>
                <span>{Math.max(16, Math.ceil(capacity))}h (Marathon)</span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-hairline)]">
                {[4, 6, 8, 10, 12, 14].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setCapacity(hrs)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all ${
                      capacity === hrs
                        ? 'border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {hrs === 12 ? '12h (Study Marathon)' : `${hrs}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Theme Switch */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Preferred Interface Appearance
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (theme !== 'light') toggleTheme();
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    theme === 'light'
                      ? 'border-amber-500 bg-amber-500/10 text-stone-900 font-bold'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/40 text-[var(--text-muted)]'
                  }`}
                >
                  <div className="text-xs flex items-center justify-between">
                    <span>☀️ Alabaster Light</span>
                    {theme === 'light' && <CheckCircle2 size={13} className="text-amber-600" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (theme !== 'dark') toggleTheme();
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    theme === 'dark'
                      ? 'border-amber-500 bg-amber-500/10 text-stone-100 font-bold'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/40 text-[var(--text-muted)]'
                  }`}
                >
                  <div className="text-xs flex items-center justify-between">
                    <span>🌙 Obsidian Dark</span>
                    {theme === 'dark' && <CheckCircle2 size={13} className="text-amber-500" />}
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => {
                  audioEngine.playClickSound();
                  setStep(3);
                }}
                className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
              >
                <span>Continue to Top 3 Focus</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Capture Top 3 Focus Tasks */}
        {step === 3 && (
          <div className="p-6 sm:p-8 space-y-6 animate-fade-in">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Step 2 of 2
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                What are your Top 3 priorities today?
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                If you could only achieve three things before going to sleep, what would make today a win?
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs font-bold text-amber-500 font-mono">1.</span>
                <input
                  type="text"
                  placeholder="Most important deliverable or deep focus task..."
                  value={task1}
                  onChange={(e) => setTask1(e.target.value)}
                  className="w-full text-xs pl-8 pr-4 py-2.5 rounded-xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] focus:border-amber-500 text-[var(--text-primary)] outline-none"
                  autoFocus
                />
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs font-bold text-amber-500 font-mono">2.</span>
                <input
                  type="text"
                  placeholder="Second priority (e.g. team review or write spec)..."
                  value={task2}
                  onChange={(e) => setTask2(e.target.value)}
                  className="w-full text-xs pl-8 pr-4 py-2.5 rounded-xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] focus:border-amber-500 text-[var(--text-primary)] outline-none"
                />
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs font-bold text-amber-500 font-mono">3.</span>
                <input
                  type="text"
                  placeholder="Third priority (or quick critical errand)..."
                  value={task3}
                  onChange={(e) => setTask3(e.target.value)}
                  className="w-full text-xs pl-8 pr-4 py-2.5 rounded-xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] focus:border-amber-500 text-[var(--text-primary)] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => {
                  audioEngine.playClickSound();
                  setStep(4);
                }}
                className="px-6 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
              >
                <span>Review & Launch</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Celebration & Launch */}
        {step === 4 && (
          <div className="p-6 sm:p-8 space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
              <Sparkles size={32} />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Workspace Initialized
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                You are ready to enter flow.
              </h2>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">
                Daily capacity locked at <strong>{capacity.toFixed(1)}h</strong>. Your day is structured around intention, not overwhelm.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] text-left text-xs space-y-2">
              <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Flame size={14} className="text-amber-500" />
                <span>Today&apos;s Focus Anchor:</span>
              </div>
              {[task1, task2, task3].filter(Boolean).length > 0 ? (
                <ul className="space-y-1 pl-5 list-disc text-[var(--text-secondary)]">
                  {[task1, task2, task3].filter(Boolean).map((t, idx) => (
                    <li key={idx} className="truncate">{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--text-muted)] italic">
                  No initial tasks entered. You can use the Omnibar or press &apos;N&apos; anytime.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Enter Flow State & Launch Today</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
