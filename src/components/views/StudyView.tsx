import { isStudyTask } from '../../utils/taskSelectors';
import React, { useState, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { parseStudySessions } from '../../utils/sessionParser';
import {
  BookOpen,
  Sparkles,
  Play,
  Calendar,
  History,
  LayoutTemplate,
  Plus,
  CheckCircle2,
  ArrowRight,
  Code2,
  GraduationCap,
  FileText,
  Layers,
  Check,
} from 'lucide-react';

interface StudyViewProps {
  onStartSprint?: (taskId: string) => void;
  onSelectTask?: (taskId: string) => void;
}

const STUDY_TEMPLATES = [
  {
    id: 'dsa',
    title: 'DSA Practice Sprint',
    description: 'Algorithmic problem-solving session with targeted difficulty levels and pacing.',
    icon: Code2,
    color: 'text-amber-600 bg-amber-500/10 border-amber-500/30',
    sampleInput: `Session: DSA Problem Solving (9:00 AM - 12:00 PM)
- Two Sum (Easy, 15m) https://leetcode.com/problems/two-sum
- 3Sum (Medium, 30m) https://leetcode.com/problems/3sum
- Longest Substring Without Repeating Characters (Medium, 30m) https://leetcode.com/problems/longest-substring-without-repeating-characters
- Median of Two Sorted Arrays (Hard, 45m) https://leetcode.com/problems/median-of-two-sorted-arrays
- Merge k Sorted Lists (Hard, 45m) https://leetcode.com/problems/merge-k-sorted-lists`,
  },
  {
    id: 'exam',
    title: 'Exam Revision & Active Recall',
    description: 'High-yield syllabus review, active recall questioning, and past-paper revision.',
    icon: GraduationCap,
    color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
    sampleInput: `Session: Systems & Architecture Revision (2:00 PM - 5:00 PM)
- Virtual Memory & Paging Mechanisms (45m)
- Cache Coherence Protocols (MESI) (45m)
- Past Paper 2024: Concurrency Questions 1-4 (60m)
- Formula Sheet & Critical Definitions Review (30m)`,
  },
  {
    id: 'reading',
    title: 'Deep Reading & Research',
    description: 'Paper reading, documentation deep-dives, and structured note extraction.',
    icon: FileText,
    color: 'text-blue-600 bg-blue-500/10 border-blue-500/30',
    sampleInput: `Session: Distributed Systems Papers (10:00 AM - 12:30 PM)
- Read Raft Consensus Algorithm Section 1-4 (45m)
- Extract state transition diagrams to notes (30m)
- Read Spanner: Google's Globally Distributed Database (60m)
- Summarize TrueTime API guarantees (15m)`,
  },
  {
    id: 'dev',
    title: 'Development Sprint',
    description: 'Feature implementation with atomic milestones, test coverage, and documentation.',
    icon: Layers,
    color: 'text-purple-600 bg-purple-500/10 border-purple-500/30',
    sampleInput: `Session: Core Auth & Workspace Upgrade (1:30 PM - 4:30 PM)
- Implement schema migration v4 to v5 (45m)
- Build responsive grid layout adapter (60m)
- Write unit tests for dayPlanSummary (45m)
- Verify end-to-end cloud sync conflict handling (30m)`,
  },
];

export const StudyView: React.FC<StudyViewProps> = ({
  onStartSprint,
  onSelectTask,
}) => {
  const { tasks, addStudySessions, toggleSubTask, focusLogs, showToast } = useTaskContext();
  const todayStr = useTodayStr();

  const [activeTab, setActiveTab] = useState<'continue' | 'planned' | 'templates' | 'history'>('continue');
  const [templateInput, setTemplateInput] = useState('');
  const [isParsingOpen, setIsParsingOpen] = useState(false);

  // Unfinished study sprint tasks
  const continueSessions = useMemo(() => {
    return tasks.filter((t) => {
      if (t.deletedAt || t.archivedAt || t.status === 'done') return false;
      const isStudy = isStudyTask(t);
      return Boolean(isStudy && t.subtasks?.some(sub => !sub.completed));
    });
  }, [tasks]);

  // Planned sessions include an explicit overdue label for past dates.
  const plannedSessions = useMemo(() => {
    return tasks.filter((t) => {
      if (t.deletedAt || t.archivedAt || t.status === 'done') return false;
      const isStudy = isStudyTask(t);
      return isStudy && (t.plannedDate || t.dueDate);
    });
  }, [tasks]);

  // Study history from focusLogs and completed tasks
  const studyHistory = useMemo(() => {
    const sprintLogs = focusLogs.filter((log) => log.mode === 'sprint');
    const doneTasks = tasks.filter(
      (t) =>
        t.status === 'done' &&
        !t.deletedAt && !t.archivedAt && isStudyTask(t)
    );
    return { logs: sprintLogs, completed: doneTasks };
  }, [focusLogs, tasks]);

  const handleApplyTemplate = (sampleText: string) => {
    try {
      const parsed = parseStudySessions(sampleText);
      if (parsed.length > 0) {
        addStudySessions(parsed, todayStr);
        showToast(`Created ${parsed.length} study session${parsed.length > 1 ? 's' : ''}`);
        setActiveTab('continue');
      } else {
        showToast('Could not parse any sessions from template.');
      }
    } catch {
      showToast('Error importing study template.');
    }
  };

  const handleCustomImport = () => {
    if (!templateInput.trim()) return;
    try {
      const parsed = parseStudySessions(templateInput);
      if (parsed.length > 0) {
        addStudySessions(parsed, todayStr);
        showToast(`Imported ${parsed.length} study session${parsed.length > 1 ? 's' : ''}`);
        setTemplateInput('');
        setIsParsingOpen(false);
        setActiveTab('continue');
      } else {
        showToast('No sessions recognized. Please format like the templates.');
      }
    } catch {
      showToast('Error parsing custom study session.');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* Study Hub Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)] mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Study Hub
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Targeted study sprints, paced question solving, and active recall
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsParsingOpen(!isParsingOpen)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold btn-forest-primary shadow-subtle active:scale-95 transition-all"
          >
            <Plus size={14} />
            <span>Parse Session</span>
          </button>
        </div>
      </div>

      {/* Parse Modal Drawer Inline */}
      {isParsingOpen && (
        <div className="mb-6 p-4 rounded-2xl border border-emerald-600/30 bg-[var(--bg-surface-l2)] shadow-lg animate-in fade-in duration-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
            Paste Study Schedule or Question Targets
          </h2>
          <textarea
            rows={5}
            value={templateInput}
            onChange={(e) => setTemplateInput(e.target.value)}
            placeholder={`Session 1: DSA Practice (8:30am - 11:30am)\n- Two Sum (Easy, 15m)\n- 3Sum (Medium, 30m)\n- Longest Substring Without Repeating Characters (Medium, 30m)`}
            className="w-full p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-xs text-[var(--text-primary)] font-mono placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsParsingOpen(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l1)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCustomImport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Check size={14} />
              <span>Import Targets</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Study Hub navigation"
        className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 mb-6 overflow-x-auto scrollbar-none"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'continue'}
          onClick={() => setActiveTab('continue')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'continue'
              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l1)]'
          }`}
        >
          <Sparkles size={14} className="text-amber-600" />
          <span>Continue Sprint</span>
          {continueSessions.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 font-bold">
              {continueSessions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'planned'}
          onClick={() => setActiveTab('planned')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'planned'
              ? 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border border-emerald-600/30'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l1)]'
          }`}
        >
          <Calendar size={14} className="text-emerald-600" />
          <span>Planned Sessions</span>
          {plannedSessions.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-600/20 font-bold">
              {plannedSessions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'templates'}
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'templates'
              ? 'bg-blue-600/15 text-blue-800 dark:text-blue-300 border border-blue-600/30'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l1)]'
          }`}
        >
          <LayoutTemplate size={14} className="text-blue-600" />
          <span>Templates</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'history'
              ? 'bg-purple-600/15 text-purple-800 dark:text-purple-300 border border-purple-600/30'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l1)]'
          }`}
        >
          <History size={14} className="text-purple-600" />
          <span>History</span>
        </button>
      </div>

      {/* Tab 1: Continue Sprints */}
      {activeTab === 'continue' && (
        <div className="flex flex-col gap-4">
          {continueSessions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-l1)]/40">
              <Sparkles size={28} className="text-amber-500 mx-auto mb-2.5 opacity-80" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                No active study sprints
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto mt-1">
                Pick a template from the Templates tab or parse your syllabus to start a focused sprint.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className="mt-3.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
              >
                Browse Templates
              </button>
            </div>
          ) : (
            continueSessions.map((session) => {
              const completedCount = session.subtasks?.filter((s) => s.completed).length || 0;
              const totalCount = session.subtasks?.length || 0;
              const nextUnfinished = session.subtasks?.find((s) => !s.completed);
              const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] shadow-subtle hover:border-amber-500/40 transition-all flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3
                        className="text-base font-bold text-[var(--text-primary)] cursor-pointer hover:text-emerald-700 transition-colors"
                        onClick={() => onSelectTask?.(session.id)}
                      >
                        {session.title}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mt-1">
                        <span>
                          {completedCount}/{totalCount} targets finished ({progressPct}%)
                        </span>
                        {session.estimatedMinutes ? (
                          <span className="font-mono text-[var(--text-muted)]">
                            {session.estimatedMinutes}m est.
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onStartSprint?.(session.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all shadow-sm self-start sm:self-center"
                    >
                      <Play size={13} className="fill-current" />
                      <span>Start Sprint</span>
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface-l1)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Next Target Highlight */}
                  {nextUnfinished && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 shrink-0">
                          Next Target
                        </span>
                        <span className="font-semibold text-[var(--text-primary)] truncate">
                          {nextUnfinished.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSubTask(session.id, nextUnfinished.id)}
                        className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 text-xs font-semibold flex items-center gap-1 shrink-0"
                      >
                        <CheckCircle2 size={14} />
                        <span>Done</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Planned Sessions */}
      {activeTab === 'planned' && (
        <div className="flex flex-col gap-3">
          {plannedSessions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-l1)]/40 text-xs text-[var(--text-secondary)]">
              No upcoming study sessions scheduled on your calendar.
            </div>
          ) : (
            plannedSessions.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] flex items-center justify-between gap-3"
              >
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {t.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-0.5">
                    <span className="font-mono text-emerald-700 dark:text-emerald-400">
                      {(t.plannedDate || t.dueDate)! < todayStr ? 'Overdue · ' : ''}{t.plannedDate || t.dueDate}
                    </span>
                    {t.estimatedMinutes && <span>· {t.estimatedMinutes}m</span>}
                    {t.subtasks?.length ? (
                      <span>· {t.subtasks.length} subtasks</span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onStartSprint?.(t.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Launch
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Starter Study Templates */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STUDY_TEMPLATES.map((tmpl) => {
            const Icon = tmpl.icon;
            return (
              <div
                key={tmpl.id}
                className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] flex flex-col justify-between shadow-subtle group hover:border-emerald-600/40 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`p-2 rounded-xl border ${tmpl.color}`}>
                      <Icon size={18} />
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {tmpl.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                    {tmpl.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                    5-6 targets
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl.sampleInput)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <span>Use Template</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 4: Study History */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/70 border border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Study Sprints
              </span>
              <span className="font-mono text-xl font-bold text-[var(--text-primary)]">
                {studyHistory.logs.length}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/70 border border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Time Studied
              </span>
              <span className="font-mono text-xl font-bold text-amber-700 dark:text-amber-400">
                {Math.round(
                  studyHistory.logs.reduce((acc, l) => acc + (l.seconds || 0), 0) / 60
                )}
                m
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/70 border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                Completed Sessions
              </span>
              <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {studyHistory.completed.length}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {studyHistory.logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/40 rounded-xl">
                No recorded study sprints yet. Complete your first session to track progress.
              </div>
            ) : (
              studyHistory.logs.slice(-10).reverse().map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] flex items-center justify-between text-xs"
                >
                  <div className="truncate">
                    <span className="font-semibold text-[var(--text-primary)] block truncate">
                      {log.subtaskTitle || log.taskTitle || 'Study Sprint'}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {log.endedAt ? new Date(log.endedAt).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                    {Math.round(log.seconds / 60)}m
                  </span>
                </div>
              ))
            )}
          </div>

          {studyHistory.completed.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Completed Study Tasks
              </h3>
              {studyHistory.completed.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-l1)]/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-[var(--text-secondary)] line-through truncate">
                      {task.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--text-muted)]">
                    {task.subtasks?.length || 0} targets
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
