import { useMemo, useState } from 'react';
import { List, ListChecks } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { useTaskAvailabilityClock } from '../../hooks/useTaskAvailabilityClock';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { isInboxTask } from '../../utils/taskSelectors';
import { TaskComposer } from '../tasks/TaskComposer';
import { WorkspaceTaskRow } from '../tasks/WorkspaceTaskRow';
import { VirtualTaskList } from '../tasks/VirtualTaskList';
import { InboxTriageView } from './InboxTriageView';
import '../../styles/inbox-workspace.css';

interface InboxViewProps {
  onSelectTask: (id: string) => void;
  onStartFocus: (id: string) => void;
  onStartSprint?: (id: string) => void;
  onGoToToday?: () => void;
}

export function InboxView({ onSelectTask, onStartFocus, onStartSprint, onGoToToday }: InboxViewProps) {
  const { tasks, projects, workspacePreferences = {}, setWorkspacePreference, toggleTaskStatus, toggleTaskPinToday, updateTask, deleteTask, batchUpdateTasks, batchDeleteTasks } = useTaskContext();
  const workspace = (workspacePreferences.workspace || {}) as Record<string, unknown>;
  const [mode, setMode] = useState<'list' | 'process'>(workspace.inboxMode === 'process' ? 'process' : 'list');
  const today = useTodayStr();
  const now = useTaskAvailabilityClock(tasks);
  const inboxTasks = useMemo(() => tasks.filter(task => !task.deletedAt && !task.archivedAt && task.status !== 'done' && isInboxTask(task, today, { tasks, projects, now })).sort((a, b) => a.createdAt - b.createdAt), [tasks, projects, today, now]);
  const { focusedTaskId } = useKeyboardNavigation({ tasks: inboxTasks, onSelectTask, onToggleStatus: toggleTaskStatus, onTogglePinToday: toggleTaskPinToday, onUpdateTask: updateTask, onDeleteTask: deleteTask, onBatchUpdate: batchUpdateTasks, onBatchDelete: batchDeleteTasks, onStartFocus, enabled: mode === 'list' });
  const selectMode = (next: 'list' | 'process') => {
    setMode(next);
    setWorkspacePreference?.('workspace', { ...workspace, inboxMode: next });
  };
  return <div className="inbox-workspace desk-page-frame">
    <header className="desk-page-header">
      <div><p className="desk-eyebrow">A place to begin</p><h1>Inbox</h1><p className="desk-page-description">Capture now. Make room to decide later.</p></div>
      <div className="workspace-view-switch" role="group" aria-label="Inbox presentation">
        <button type="button" aria-pressed={mode === 'list'} onClick={() => selectMode('list')}><List size={16} />List</button>
        <button type="button" aria-pressed={mode === 'process'} onClick={() => selectMode('process')}><ListChecks size={16} />Process</button>
      </div>
    </header>
    <section className="inbox-capture" aria-label="Add a task to Inbox"><TaskComposer taskInputLabel="Task title" /></section>
    {mode === 'process' ? <InboxTriageView embedded onSelectTask={onSelectTask} onGoToToday={onGoToToday} /> : <section className="inbox-task-surface" aria-label="Inbox tasks">
      <div className="inbox-list-heading"><h2>Unsorted</h2><span>{inboxTasks.length} {inboxTasks.length === 1 ? 'task' : 'tasks'}</span></div>
      {inboxTasks.length ? <VirtualTaskList tasks={inboxTasks} estimatedItemHeight={76} className="inbox-task-list" renderTask={task => <WorkspaceTaskRow task={task} onSelectTask={onSelectTask} onStartFocus={onStartFocus} onStartSprint={onStartSprint} isKeyboardFocused={focusedTaskId === task.id} />} /> : <div className="inbox-empty"><h3>A clear place to start.</h3><p>Add a thought or task above. It stays here until you decide what comes next.</p></div>}
    </section>}
  </div>;
}
