import { useState } from 'react';
import { CalendarDays, List } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { UpcomingView } from './UpcomingView';
import { TimelineView } from './TimelineView';
import '../../styles/planning-workspace.css';

interface PlanningViewProps {
  onSelectTask: (id: string) => void;
  onStartFocus: (id: string) => void;
  onStartSprint?: (id: string) => void;
  onOpenStudySession?: () => void;
  onOpenBrainDump?: () => void;
}
export function PlanningView(props: PlanningViewProps) {
  const { activeView, setActiveView, workspacePreferences = {}, setWorkspacePreference } = useTaskContext();
  const today = useTodayStr();
  const workspace = (workspacePreferences.workspace || {}) as Record<string, unknown>;
  const saved = (workspace.planning || {}) as { date?: string; filterDate?: string | null };
  const [date, setDate] = useState(saved.date && /^\d{4}-\d{2}-\d{2}$/.test(saved.date) ? saved.date : today);
  const [filterDate, setFilterDate] = useState<string | null>(saved.filterDate || null);
  const calendar = activeView === 'timeline';
  const updateDate = (next: string | null) => {
    if (next) setDate(next);
    setFilterDate(next);
    setWorkspacePreference?.('workspace', { ...workspace, planning: { date: next || date, filterDate: next } });
  };
  const selectMode = (view: 'upcoming' | 'timeline') => {
    setWorkspacePreference?.('workspace', { ...workspace, lastPlanView: view, planning: { date, filterDate } });
    setActiveView(view);
  };
  return <div className="planning-workspace desk-page-frame">
    <header className="desk-page-header">
      <div><p className="desk-eyebrow">Make room for what matters</p><h1>Plan</h1><p className="desk-page-description">Your upcoming work, in the view that suits you.</p></div>
      <div className="workspace-view-switch" role="group" aria-label="Planning presentation">
        <button type="button" aria-pressed={!calendar} onClick={() => selectMode('upcoming')}><List size={16} />List</button>
        <button type="button" aria-pressed={calendar} onClick={() => selectMode('timeline')}><CalendarDays size={16} />Calendar</button>
      </div>
    </header>
    <div className="planning-content">{calendar ? <TimelineView {...props} selectedDateStr={date} onSelectedDateChange={next => updateDate(next)} /> : <UpcomingView {...props} embedded selectedDate={filterDate} onSelectedDateChange={updateDate} />}</div>
  </div>;
}
