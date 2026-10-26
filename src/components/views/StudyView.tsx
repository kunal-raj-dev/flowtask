import { isStudyTask } from '../../utils/taskSelectors';
import React, { useState, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { lazy, Suspense } from 'react';
import { normalizeStudyTemplates, STARTER_STUDY_TEMPLATES, MAX_STUDY_TEMPLATES, studyId, STUDY_PACING_PRESETS, type StudyTemplate } from '../../utils/studyTemplates';
import type { WorkspacePreferences } from '../../types/dashboard';
import type { StudySessionModalProps } from '../modals/StudyPlanEditor';
import {
  BookOpen,
  Sparkles,
  Play,
  Calendar,
  Clock,
  History,
  LayoutTemplate,
  Plus,
  CheckCircle2,
  ArrowRight,
  Copy, Pencil, Trash2,
} from 'lucide-react';

interface StudyViewProps {
  onStartSprint?: (taskId: string) => void;
  onSelectTask?: (taskId: string) => void;
}
const StudySessionModal = lazy(() => import('../modals/StudySessionModal').then(module => ({ default: module.StudySessionModal })));

export const StudyView: React.FC<StudyViewProps> = ({
  onStartSprint,
  onSelectTask,
}) => {
  const { tasks, toggleSubTask, toggleTaskStatus, focusLogs, showToast, undoLastAction, workspacePreferences = {}, setWorkspacePreference } = useTaskContext();
  const todayStr = useTodayStr();

  const [activeTab, setActiveTab] = useState<'continue' | 'planned' | 'templates' | 'history'>('continue');
  const [planner, setPlanner] = useState<Partial<StudySessionModalProps> | null>(null);
  const workspace = (workspacePreferences.workspace || {}) as WorkspacePreferences;
  const templates = workspace.studyTemplates === undefined ? STARTER_STUDY_TEMPLATES : normalizeStudyTemplates(workspace.studyTemplates);
  const saveTemplates = (next: StudyTemplate[]) => {
    if (!setWorkspacePreference) throw new Error('Template storage is unavailable. Reload this workspace and try again.');
    if (next.length > MAX_STUDY_TEMPLATES || JSON.stringify(next).length > 250_000) throw new Error('The template library is full. Remove an unused template or make this plan smaller.');
    const valid = normalizeStudyTemplates(next);
    if (valid.length !== next.length) throw new Error('Check the template name, session names and target titles before saving.');
    setWorkspacePreference('workspace', { ...workspace, studyTemplates: valid });
  };
  const saveTemplate = (template: StudyTemplate) => {
    const exists = templates.some(item => item.id === template.id);
    saveTemplates(exists ? templates.map(item => item.id === template.id ? template : item) : [...templates, template]);
    showToast('Study template saved');
  };
  const removeTemplate = (template: StudyTemplate) => {
    const before = templates;
    try {
      saveTemplates(templates.filter(item => item.id !== template.id));
      showToast(`Removed “${template.title}”`, 'Undo', () => saveTemplates(before));
    } catch (cause) { showToast(cause instanceof Error ? cause.message : 'Could not remove this template.'); }
  };
  const restoreStarters = () => {
    try { const previous = templates; saveTemplates([...templates, ...STARTER_STUDY_TEMPLATES.filter(starter => !templates.some(item => item.id === starter.id))]); showToast('Missing starter templates restored', 'Undo', () => saveTemplates(previous)); }
    catch (cause) { showToast(cause instanceof Error ? cause.message : 'Could not restore the starters.'); }
  };

  // Unfinished study sprint tasks
  const continueSessions = useMemo(() => {
    return tasks.filter((t) => {
      if (t.deletedAt || t.archivedAt || t.status === 'done') return false;
      const isStudy = isStudyTask(t);
      const date = t.plannedDate || t.dueDate;
      return Boolean(isStudy && (!date || date <= todayStr) && t.subtasks?.length);
    });
  }, [tasks, todayStr]);

  // Planned sessions include an explicit overdue label for past dates.
  const plannedSessions = useMemo(() => {
    return tasks.filter((t) => {
      if (t.deletedAt || t.archivedAt || t.status === 'done') return false;
      const isStudy = isStudyTask(t);
      return isStudy && (t.plannedDate || t.dueDate || (t.workBlocks && t.workBlocks.length > 0));
    });
  }, [tasks]);

  // Structured planned study work blocks from canonical schedule
  const plannedWorkBlocks = useMemo(() => {
    const list: Array<{ task: (typeof tasks)[0]; block: NonNullable<(typeof tasks)[0]['workBlocks']>[0] }> = [];
    tasks.forEach((t) => {
      if (t.deletedAt || t.archivedAt || t.status === 'done' || !isStudyTask(t)) return;
      if (t.workBlocks && t.workBlocks.length > 0) {
        t.workBlocks
          .filter((b) => b.status === 'scheduled' || b.status === 'in_progress')
          .forEach((b) => list.push({ task: t, block: b }));
      }
    });
    return list.sort((a, b) => (a.block.date || '').localeCompare(b.block.date || '') || (a.block.startTime || '').localeCompare(b.block.startTime || ''));
  }, [tasks]);

  // Study history strictly from study tasks and completed focus logs
  const studyHistory = useMemo(() => {
    const studyTaskIds = new Set(tasks.filter(isStudyTask).map((t) => t.id));
    const studyLogs = focusLogs.filter((log) => {
      if (log.isStudy) return true;
      if (log.taskId && studyTaskIds.has(log.taskId)) return true;
      if (log.mode === 'sprint' && (!log.taskId || studyTaskIds.has(log.taskId))) return true;
      return false;
    });
    const doneTasks = tasks.filter(
      (t) =>
        t.status === 'done' &&
        !t.deletedAt && !t.archivedAt && isStudyTask(t)
    );
    return { logs: studyLogs, completed: doneTasks };
  }, [focusLogs, tasks]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20">
      {/* Study Hub Header */}
      <div className="workspace-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)] mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Study Hub
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Plan your targets, study at your own pace, and pick up where you left off.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlanner({ initialMode: 'paste' })}
            className="desk-button"
          >
            <BookOpen size={14} />
            <span>Paste a plan</span>
          </button>
          <button type="button" className="desk-button primary" onClick={() => setPlanner({ initialMode: 'build' })}><Plus size={14} />New session</button>
        </div>
      </div>

      {planner && <Suspense fallback={<p role="status">Opening study planner…</p>}><StudySessionModal {...planner} isOpen onClose={() => setPlanner(null)} onStartSprint={onStartSprint} onSaveTemplate={saveTemplate} onCreated={date => { setActiveTab(date > todayStr ? 'planned' : 'continue'); showToast('Study session created', 'Undo', () => undoLastAction()); }} /></Suspense>}

      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Study Hub navigation"
        className="workspace-tabs flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 mb-6 overflow-x-auto scrollbar-none"
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
            <div className="workspace-panel p-8 text-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-l1)]/40">
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
                      <h3 className="text-base font-bold text-[var(--text-primary)]"><button type="button" className="text-left" onClick={() => onSelectTask?.(session.id)}>{session.title}</button></h3>
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

                    <div className="flex flex-wrap gap-2">
                    <button type="button" className="desk-button" aria-label={`Edit targets for ${session.title}`} onClick={() => onSelectTask?.(session.id)}>Edit targets</button>
                    <button
                      type="button"
                      onClick={() => onStartSprint?.(session.id)}
                      disabled={!nextUnfinished}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all shadow-sm self-start sm:self-center"
                    >
                      <Play size={13} className="fill-current" />
                      <span>Start Sprint</span>
                    </button>
                    </div>
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
                  {!nextUnfinished && <div className="flex flex-wrap items-center justify-between gap-3 text-xs"><span>All targets complete. Ready to finish?</span><button type="button" className="desk-button primary" onClick={() => toggleTaskStatus(session.id)}>Mark session complete</button></div>}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Planned Sessions & Work Blocks */}
      {activeTab === 'planned' && (
        <div className="flex flex-col gap-6">
          {/* Calendar-anchored Planned Study Work Blocks */}
          {plannedWorkBlocks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <Clock size={14} />
                <span>Planned Study Work Blocks ({plannedWorkBlocks.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plannedWorkBlocks.map(({ task, block }) => (
                  <div
                    key={block.id}
                    className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        {block.title || task.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-0.5">
                        <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                          {block.date} {block.startTime && block.endTime ? `· ${block.startTime}–${block.endTime}` : ''}
                        </span>
                        <span>· {block.durationMinutes}m block</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStartSprint?.(task.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      Launch
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Scheduled Study Sessions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Calendar size={14} />
              <span>Study Tasks & Targets ({plannedSessions.length})</span>
            </div>
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
                        {(t.plannedDate || t.dueDate)! < todayStr ? 'Overdue · ' : ''}{t.plannedDate || t.dueDate || 'Flexible'}
                      </span>
                      {t.estimatedMinutes && <span>· {t.estimatedMinutes}m</span>}
                      {t.workBlocks?.length ? <span>· {t.workBlocks.length} work block{t.workBlocks.length === 1 ? '' : 's'}</span> : null}
                      {t.subtasks?.length ? (
                        <span>· {t.subtasks.length} subtasks</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button type="button" className="desk-button" aria-label={`Edit targets for ${t.title}`} onClick={() => onSelectTask?.(t.id)}>Edit targets</button>
                    <button
                      type="button"
                      onClick={() => onStartSprint?.(t.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      Launch
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && <section aria-label="Study templates" className="space-y-6">
        {/* Standard Pacing Presets */}
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Standard Pacing Presets</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Standard interval timers sharing canonical focus runtime configurations.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {STUDY_PACING_PRESETS.map((preset) => (
              <div
                key={preset.id}
                className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] flex flex-col justify-between gap-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">{preset.name}</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{preset.description}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                  <span className="font-mono font-semibold">{preset.timer.focusMinutes}m / {preset.timer.shortBreakMinutes}m</span>
                  <button
                    type="button"
                    onClick={() => setPlanner({
                      initialSessions: [{
                        id: studyId(),
                        sessionTopic: `${preset.name} Session`,
                        rawText: '',
                        durationMinutes: preset.timer.focusMinutes,
                        targetPacingMinutes: preset.timer.focusMinutes,
                        targets: [
                          { id: studyId(), title: 'Target 1', estimatedMinutes: preset.timer.focusMinutes },
                          { id: studyId(), title: 'Target 2', estimatedMinutes: preset.timer.focusMinutes },
                        ],
                      }],
                    })}
                    className="desk-button primary text-xs"
                  >
                    Use Preset
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><p className="text-xs text-[var(--text-secondary)]">Reusable plans you can edit. Choose a template to review its targets before creating a session.</p><button type="button" className="desk-button" disabled={templates.length >= MAX_STUDY_TEMPLATES} onClick={() => setPlanner({ purpose: 'template' })}><Plus size={15} />New template</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{templates.map(template => <article key={template.id} className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] space-y-3" aria-label={template.title}>
            <h3 className="text-sm font-bold break-words">{template.title}</h3><p className="text-xs text-[var(--text-secondary)] break-words">{template.description}</p>
            <ul className="text-xs text-[var(--text-secondary)] space-y-1">{template.sessions.flatMap(session => session.targets).slice(0, 3).map((target, index) => <li key={index} className="break-words">{target.title} · {target.estimatedMinutes}m</li>)}</ul>
            <p className="text-xs text-[var(--text-muted)]">{template.sessions.reduce((sum, session) => sum + session.targets.length, 0)} targets · {template.sessions.reduce((sum, session) => sum + session.targets.reduce((minutes, target) => minutes + (target.estimatedMinutes || 0), 0), 0)}m</p>
            <div className="flex flex-wrap items-center gap-2"><button type="button" className="desk-button primary" onClick={() => setPlanner({ template, initialSessions: template.sessions })}>Use Template<ArrowRight size={14} /></button><button type="button" className="desk-button" aria-label={`Edit ${template.title}`} onClick={() => setPlanner({ purpose: 'template', template, initialSessions: template.sessions })}><Pencil size={14} />Edit</button><button type="button" className="desk-icon-button" aria-label={`Duplicate ${template.title}`} disabled={templates.length >= MAX_STUDY_TEMPLATES} onClick={() => setPlanner({ purpose: 'template', template: { ...template, id: studyId(), title: `${template.title} copy` }, initialSessions: template.sessions })}><Copy size={15} /></button><button type="button" className="desk-icon-button" aria-label={`Delete ${template.title}`} onClick={() => removeTemplate(template)}><Trash2 size={15} /></button></div>
          </article>)}</div>
          {!templates.length && <p className="desk-notice">No saved templates yet. Create one with your own targets.</p>}
          <button type="button" className="desk-button mt-4" onClick={restoreStarters}>Restore missing starter templates</button>
        </div>
      </section>}
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
