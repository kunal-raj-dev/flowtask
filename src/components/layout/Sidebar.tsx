import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import {
  Sun,
  Inbox,
  Calendar,
  Grid2X2,
  Kanban,
  Lightbulb,
  CheckCircle2,
  Plus,
  Moon,
  Volume2,
  VolumeX,
  Keyboard,
  DownloadCloud,
  Timer,
  Sparkles,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';

interface SidebarProps {
  onOpenPomodoro: () => void;
  onOpenShortcuts: () => void;
  onOpenExportImport: () => void;
  onOpenBrainDump: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenPomodoro,
  onOpenShortcuts,
  onOpenExportImport,
  onOpenBrainDump,
}) => {
  const {
    tasks,
    projects,
    activeView,
    setActiveView,
    theme,
    toggleTheme,
    soundEnabled,
    toggleSound,
    addProject,
  } = useTaskContext();

  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const todayStr = formatLocalDate(new Date());

  // Count active tasks for views
  const todayCount = tasks.filter(
    (t) => t.status !== 'done' && (t.dueDate === todayStr || t.isPinnedToday)
  ).length;

  const inboxCount = tasks.filter(
    (t) => t.status !== 'done' && t.projectId === 'inbox' && !t.dueDate
  ).length;

  const upcomingCount = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate > todayStr
  ).length;

  const somedayCount = tasks.filter(
    (t) => t.status !== 'done' && !t.dueDate && t.projectId === 'ideas'
  ).length;

  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      addProject(newProjectName.trim(), randomColor);
      setNewProjectName('');
      setIsAddingProject(false);
    }
  };

  const navItems = [
    { id: 'today', label: 'Today', icon: Sun, count: todayCount, color: 'text-amber-500' },
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: inboxCount, color: 'text-blue-500' },
    { id: 'upcoming', label: 'Upcoming', icon: Calendar, count: upcomingCount, color: 'text-purple-500' },
    { id: 'matrix', label: 'Priority Matrix', icon: Grid2X2, count: null, color: 'text-emerald-500' },
    { id: 'kanban', label: 'Kanban Board', icon: Kanban, count: null, color: 'text-indigo-500' },
    { id: 'someday', label: 'Someday', icon: Lightbulb, count: somedayCount, color: 'text-yellow-500' },
    { id: 'logbook', label: 'Logbook', icon: CheckCircle2, count: doneCount, color: 'text-stone-400' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 h-screen bg-[var(--bg-surface-l1)]/80 backdrop-blur-xl border-r border-[var(--border-hairline)] flex flex-col select-none transition-colors duration-200">
      {/* Brand Header */}
      <div className="p-4 flex items-center justify-between border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-stone-900 to-stone-700 dark:from-white dark:to-stone-200 text-white dark:text-stone-950 flex items-center justify-center font-bold text-xs tracking-wider shadow-sm card-surface">
            FT
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight flex items-center gap-1.5">
              FlowTask
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 font-medium border border-[var(--border-subtle)]">
                Zen
              </span>
            </h1>
          </div>
        </div>

        <button
          onClick={onOpenBrainDump}
          title="Multi-line Brain Dump"
          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
        >
          <Sparkles size={16} />
        </button>
      </div>

      {/* Navigation Views */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        <div className="text-[11px] font-semibold text-[var(--text-muted)] px-2.5 py-1 tracking-wider uppercase">
          Views
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.04] hover:text-[var(--text-primary)] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1 rounded-lg ${isActive ? 'bg-stone-100 dark:bg-white/10' : ''}`}>
                  <Icon size={15} className={isActive ? item.color : 'text-[var(--text-muted)]'} />
                </div>
                <span>{item.label}</span>
              </div>
              {item.count !== null && item.count > 0 && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-md font-mono border ${
                    isActive
                      ? 'bg-stone-100 dark:bg-white/10 text-[var(--text-primary)] font-semibold border-[var(--border-subtle)]'
                      : 'text-[var(--text-muted)] border-transparent'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Projects Section */}
        <div className="pt-4 pb-1 flex items-center justify-between px-2.5">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">
            Projects
          </span>
          <button
            onClick={() => setIsAddingProject(true)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors"
            title="Add Project"
          >
            <Plus size={14} />
          </button>
        </div>

        {projects
          .filter((p) => p.id !== 'inbox' && p.id !== 'ideas')
          .map((project) => {
            const isSelected = activeView === `project:${project.id}`;
            const projCount = tasks.filter(
              (t) => t.status !== 'done' && t.projectId === project.id
            ).length;

            return (
              <button
                key={project.id}
                onClick={() => setActiveView(`project:${project.id}`)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.04] hover:text-[var(--text-primary)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-stone-900/10 dark:ring-white/20"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
                </div>
                {projCount > 0 && (
                  <span className="text-[11px] px-1.5 py-0.2 rounded-md font-mono text-[var(--text-muted)]">
                    {projCount}
                  </span>
                )}
              </button>
            );
          })}

        {/* Inline Add Project Input */}
        {isAddingProject && (
          <form onSubmit={handleCreateProject} className="px-2 pt-1">
            <input
              type="text"
              autoFocus
              placeholder="Project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onBlur={() => {
                if (!newProjectName.trim()) setIsAddingProject(false);
              }}
              className="w-full text-xs px-2.5 py-1.5 bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl outline-none focus:ring-2 focus:ring-stone-400/40 dark:focus:ring-white/20 card-surface"
            />
          </form>
        )}
      </div>

      {/* Focus Timer Launch Button */}
      <div className="p-3 border-t border-[var(--border-hairline)]">
        <button
          onClick={onOpenPomodoro}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/10 hover:from-amber-500/25 hover:to-rose-500/15 text-amber-900 dark:text-amber-300 text-xs font-bold transition-all border border-amber-500/35 shadow-subtle hover:border-amber-500/55 card-surface active:scale-[0.98]"
        >
          <Timer size={15} />
          <span>Focus Mode & Timer</span>
        </button>
      </div>

      {/* Utility Footer: Sound, Theme, Shortcuts, Export */}
      <div className="p-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[var(--text-secondary)]">
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            className="p-1.5 hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            className="p-1.5 hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts (?)"
            className="p-1.5 hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Keyboard size={15} />
          </button>

          <button
            onClick={onOpenExportImport}
            title="Export / Import data"
            className="p-1.5 hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            <DownloadCloud size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};
