import React from 'react';
import { Target } from 'lucide-react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { isFocusTask } from '../../../utils/taskSelectors';
import { WorkspaceTaskRow } from '../../tasks/WorkspaceTaskRow';
import type { WidgetComponentProps } from '../../../types/dashboard';
export const Top3Widget: React.FC<WidgetComponentProps> = ({ widget, onSelectTask, onStartFocus, onStartSprint }) => {
  const { tasks } = useTaskContext(), today = useTodayStr();
  const priorities = tasks.filter(t => isFocusTask(t, today)).slice(0,3);
  return <div className="desk-priorities">{priorities.length ? <>{priorities.map((task, i) => <WorkspaceTaskRow key={task.id} task={task} featured rank={i+1} showNextAction={widget.config.showNextAction !== false} onSelectTask={id => onSelectTask?.(id)} onStartFocus={onStartFocus} onStartSprint={onStartSprint}/>)}{priorities.length < 3 && <p className="desk-priority-space">{3-priorities.length} {priorities.length === 2 ? 'space' : 'spaces'} left. Leave room for what matters.</p>}</> : <div className="desk-widget-empty"><Target size={25}/><h3>What matters most today?</h3><p>Star up to three tasks below. Give your day a clear place to start.</p></div>}</div>;
};
