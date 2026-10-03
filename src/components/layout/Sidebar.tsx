import { isTodayTask } from '../../utils/taskSelectors';
import React, { useState, useEffect } from 'react';
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
  Timer,
  Sparkles,
  TrendingUp,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Brain,
  Flame,
  Archive,
  Filter,
  Trash2,
  FileEdit,
  Compass,
  Clock,
  Folder,
  Settings,
  Keyboard,
  DownloadCloud,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';
import { filterTasksByPredicate } from '../../utils/smartViewUtils';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui';

interface SidebarProps {
  onOpenPomodoro: () => void;
  onOpenShortcuts?: () => void;
  onOpenExportImport: () => void;
  onOpenBrainDump: () => void;
  onOpenAesthetics?: () => void;
  onOpenScratchpad?: () => void;
  onOpenStudySession?: () => void;
  onOpenSettings?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onItemClick?: () => void;
  isMobileDrawer?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenPomodoro,
  onOpenShortcuts,
  onOpenExportImport,
  onOpenBrainDump,
  onOpenAesthetics,
  onOpenScratchpad,
  onOpenStudySession,
  onOpenSettings,
  isCollapsed = false,
  onToggleCollapse,
  onItemClick,
  isMobileDrawer = false,
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
    syncStatus,
    setIsAuthModalOpen,
    smartViews,
    deleteSmartView,
    setIsSmartFilterModalOpen,
    setIsWeeklyReviewOpen,
  } = useTaskContext();

  const { user, isAnonymous } = useAuth();

  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [isMoreCollapsed, setIsMoreCollapsed] = useState<boolean>(
    () => localStorage.getItem('flowtask_sidebar_more_collapsed') === 'true'
  );
  const [isPerspectivesCollapsed, setIsPerspectivesCollapsed] = useState<boolean>(
    () => localStorage.getItem('flowtask_sidebar_perspectives_collapsed') !== 'false'
  );
  const [isSmartViewsCollapsed, setIsSmartViewsCollapsed] = useState<boolean>(
    () => localStorage.getItem('flowtask_sidebar_smartviews_collapsed') !== 'false'
  );
  const [isProjectsCollapsed, setIsProjectsCollapsed] = useState<boolean>(
    () => localStorage.getItem('flowtask_sidebar_projects_collapsed') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('flowtask_sidebar_more_collapsed', String(isMoreCollapsed));
  }, [isMoreCollapsed]);
  useEffect(() => {
    localStorage.setItem('flowtask_sidebar_perspectives_collapsed', String(isPerspectivesCollapsed));
  }, [isPerspectivesCollapsed]);
  useEffect(() => {
    localStorage.setItem('flowtask_sidebar_smartviews_collapsed', String(isSmartViewsCollapsed));
  }, [isSmartViewsCollapsed]);
  useEffect(() => {
    localStorage.setItem('flowtask_sidebar_projects_collapsed', String(isProjectsCollapsed));
  }, [isProjectsCollapsed]);

  // Ensure current activeView section is expanded so user never loses their position
  useEffect(() => {
    if (['review', 'all', 'someday'].includes(activeView)) {
      setIsMoreCollapsed(false);
    } else if (['timeline', 'kanban', 'matrix'].includes(activeView)) {
      setIsPerspectivesCollapsed(false);
    } else if (activeView.startsWith('smart:')) {
      setIsSmartViewsCollapsed(false);
    } else if (activeView.startsWith('project:')) {
      setIsProjectsCollapsed(false);
    }
  }, [activeView]);

  const todayStr = formatLocalDate(new Date());

  // Count active tasks for views with strict view-selector parity
  const todayCount = tasks.filter(t => isTodayTask(t, todayStr)).length;

  const inboxCount = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      !t.deletedAt &&
      !t.archivedAt &&
      t.projectId === 'inbox' &&
      !t.dueDate &&
      !t.plannedDate &&
      !t.isSomeday
  ).length;

  const upcomingCount = tasks.filter((t) => {
    if (t.status === 'done' || t.deletedAt || t.archivedAt) return false;
    const taskDate = t.plannedDate || t.dueDate;
    return taskDate && taskDate > todayStr;
  }).length;

  const somedayCount = tasks.filter((t) => {
    if (t.status === 'done' || t.deletedAt || t.archivedAt) return false;
    return Boolean(
      t.isSomeday ||
        (!t.dueDate && !t.plannedDate && t.projectId === 'ideas')
    );
  }).length;

  const allCount = tasks.filter(
    (t) => t.status !== 'done' && !t.deletedAt && !t.archivedAt
  ).length;

  const activeProjectCount = projects.filter(
    (p) => p.id !== 'inbox' && p.id !== 'ideas' && !p.isArchived
  ).length;

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

  interface SidebarNavItem {
    id: string;
    label: string;
    icon: any;
    count: number | null;
    color: string;
    isNew?: boolean;
  }

  // 4 Primary destinations
  const primaryNavItems: SidebarNavItem[] = [
    { id: 'today', label: 'Today', icon: Sun, count: todayCount, color: 'text-amber-500' },
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: inboxCount, color: 'text-blue-500' },
    { id: 'upcoming', label: 'Upcoming', icon: Calendar, count: upcomingCount, color: 'text-purple-500' },
    { id: 'projects', label: 'Projects', icon: Folder, count: activeProjectCount, color: 'text-indigo-500' },
  ];

  // Secondary "More" Hub
  const secondaryNavItems: SidebarNavItem[] = [
    { id: 'trash', label: 'Trash', icon: Trash2, count: null, color: 'text-stone-400' },
    { id: 'archive', label: 'Archive', icon: Archive, count: null, color: 'text-stone-400' },
    { id: 'review', label: 'Review', icon: TrendingUp, count: null, color: 'text-teal-500' },
    { id: 'all', label: 'All Tasks', icon: CheckCircle2, count: allCount, color: 'text-stone-400' },
    { id: 'someday', label: 'Someday', icon: Lightbulb, count: somedayCount, color: 'text-amber-500' },
  ];

  // Perspectives
  const perspectiveNavItems: SidebarNavItem[] = [
    { id: 'timeline', label: 'Timeline', icon: Clock, count: null, color: 'text-teal-500' },
    { id: 'kanban', label: 'Kanban Board', icon: Kanban, count: null, color: 'text-indigo-500' },
    { id: 'matrix', label: 'Priority Matrix', icon: Grid2X2, count: null, color: 'text-emerald-500' },
    { id: 'study_sessions', label: 'Study Sessions', icon: Sparkles, count: null, color: 'text-amber-500', isNew: true },
  ];

  const allNavItems: SidebarNavItem[] = [...primaryNavItems, ...secondaryNavItems, ...perspectiveNavItems];

  const getSmartViewIcon = (iconName: string) => {
    switch (iconName) {
      case 'zap': return Zap;
      case 'brain': return Brain;
      case 'flame': return Flame;
      case 'archive': return Archive;
      case 'moon': return Moon;
      case 'coffee': return Lightbulb;
      default: return Filter;
    }
  };

  if (isCollapsed) {
    return (
      <aside className="w-16 flex-shrink-0 h-screen bg-[var(--bg-surface-l1)]/90 backdrop-blur-xl border-r border-[var(--border-hairline)] flex flex-col items-center select-none transition-all duration-200 py-3 justify-between">
        {/* Top: Workspace Avatar & Expand Toggle */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <button
              onClick={() => {
                setIsAuthModalOpen(true);
                onItemClick?.();
              }}
              title={`Cloud Sync & Account: ${syncStatus === 'synced' ? (user?.displayName || user?.email || 'Synced') : syncStatus}. Click for account.`}
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-stone-900 to-stone-700 dark:from-white dark:to-stone-200 text-white dark:text-stone-950 flex items-center justify-center font-bold text-xs tracking-wider shadow-sm card-surface hover:scale-105 transition-transform"
            >
              {user && !isAnonymous ? (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase() : 'FT'}
            </button>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bg-surface-l1)] ${
                syncStatus === 'synced'
                  ? 'bg-emerald-500'
                  : syncStatus === 'syncing'
                  ? 'bg-amber-500 animate-spin'
                  : syncStatus === 'offline'
                  ? 'bg-amber-500'
                  : 'bg-stone-400'
              }`}
            />
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Expand Sidebar ([)"
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
        </div>

        {/* Center: Nav Views */}
        <div className="flex flex-col items-center gap-1.5 my-auto overflow-y-auto max-h-[60vh] py-1 px-1">
          {allNavItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            const isSectionDivider = idx === 4 || idx === 7;
            return (
              <React.Fragment key={item.id}>
                {isSectionDivider && (
                  <div className="w-5 h-[1px] bg-[var(--border-hairline)] my-1" />
                )}
                <button
                  onClick={() => {
                    if (item.id === 'study_sessions') {
                      onOpenStudySession?.();
                    } else {
                      setActiveView(item.id as any);
                    }
                  }}
                  title={`${item.label}${item.count !== null && item.count > 0 ? ` (${item.count})` : ''}`}
                  className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon size={16} className={isActive ? item.color : 'text-[var(--text-muted)]'} />
                  {item.count !== null && item.count > 0 && !isActive && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-[var(--bg-surface-l1)]" />
                  )}
                  {item.isNew && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[var(--bg-surface-l1)]" />
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Bottom Utility Icons */}
        <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-[var(--border-hairline)] w-full px-2">
          {onOpenPomodoro && (
            <button
              onClick={onOpenPomodoro}
              title="Focus Mode & Pomodoro Timer"
              className="p-1.5 text-[var(--text-secondary)] hover:text-amber-500 rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Timer size={16} />
            </button>
          )}
          <button
            onClick={() => {
              setIsWeeklyReviewOpen(true);
              onItemClick?.();
            }}
            title="Weekly Review & Retrospective (Ctrl+Shift+W)"
            className="p-1.5 text-[var(--text-secondary)] hover:text-indigo-500 rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Compass size={16} />
          </button>
          {onOpenAesthetics && (
            <button
              onClick={onOpenAesthetics}
              title="Aesthetics & Sounds"
              className="p-1.5 text-[var(--text-secondary)] hover:text-purple-500 rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Palette size={16} />
            </button>
          )}
          {onOpenScratchpad && (
            <button
              onClick={onOpenScratchpad}
              title="Sticky Scratchpad (Alt+N)"
              className="p-1.5 text-[var(--text-secondary)] hover:text-amber-500 rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              <FileEdit size={16} />
            </button>
          )}
          <button
            onClick={() => {
              onOpenExportImport();
              onItemClick?.();
            }}
            title="Export / Import Data (Backup & Restore)"
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            <DownloadCloud size={16} />
          </button>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => {
              if (onOpenSettings) {
                onOpenSettings();
              } else {
                onOpenExportImport();
              }
              onItemClick?.();
            }}
            title="Preferences & Settings (Ctrl+,)"
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </aside>
    );
  }

  const renderNavItem = (item: {
    id: string;
    label: string;
    icon: any;
    count: number | null;
    color: string;
    isNew?: boolean;
  }) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    return (
      <button
        key={item.id}
        onClick={() => {
          if (item.id === 'study_sessions') {
            onOpenStudySession?.();
          } else {
            setActiveView(item.id as any);
          }
          onItemClick?.();
        }}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
          isActive
            ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface font-semibold'
            : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.04] hover:text-[var(--text-primary)] border border-transparent'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1 rounded-lg ${isActive ? 'bg-stone-100 dark:bg-white/10' : ''}`}>
            <Icon size={14} className={isActive ? item.color : 'text-[var(--text-muted)]'} />
          </div>
          <span>{item.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {item.count !== null && item.count > 0 && (
            <Badge
              size="xs"
              variant={isActive ? 'brand' : 'neutral'}
              className="font-mono text-[10px]"
            >
              {item.count}
            </Badge>
          )}
          {item.isNew && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold border border-emerald-500/20">
              New
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <aside className="w-64 flex-shrink-0 h-screen bg-[var(--bg-surface-l1)]/80 backdrop-blur-xl border-r border-[var(--border-hairline)] flex flex-col select-none transition-colors duration-200">
      {/* Workspace & Account Header */}
      <div className="p-3 border-b border-[var(--border-hairline)] flex items-center justify-between gap-1.5">
        <button
          onClick={() => {
            setIsAuthModalOpen(true);
            onItemClick?.();
          }}
          title={`Cloud Sync & Account: ${syncStatus === 'synced' ? (user?.displayName || user?.email || 'Synced') : syncStatus}. Click for account.`}
          className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-all text-left min-w-0 group cursor-pointer"
        >
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-stone-900 to-stone-700 dark:from-white dark:to-stone-200 text-white dark:text-stone-950 flex items-center justify-center font-bold text-xs tracking-wider shadow-sm card-surface">
              {user && !isAnonymous ? (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase() : 'FT'}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--bg-surface-l1)] ${
                syncStatus === 'synced'
                  ? 'bg-emerald-500 ring-emerald-500/20'
                  : syncStatus === 'syncing'
                  ? 'bg-amber-500 animate-spin'
                  : syncStatus === 'offline'
                  ? 'bg-amber-500'
                  : 'bg-stone-400'
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
              {user && !isAnonymous
                ? user.displayName || user.email?.split('@')[0]
                : 'FlowTask Zen'}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                {syncStatus === 'synced'
                  ? 'Cloud Synced'
                  : syncStatus === 'syncing'
                  ? 'Syncing...'
                  : syncStatus === 'offline'
                  ? 'Offline (Queued)'
                  : 'Local Mode'}
              </span>
              <span className="text-[9px] text-[var(--text-muted)] font-mono px-1 py-0.2 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shrink-0">
                {user && !isAnonymous ? 'Account' : 'Cloud'}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => {
              onOpenBrainDump();
              onItemClick?.();
            }}
            title="Multi-line Brain Dump"
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Zap size={15} />
          </button>
          {onToggleCollapse && !isMobileDrawer && (
            <button
              onClick={onToggleCollapse}
              title="Collapse Sidebar ([)"
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Views */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3.5">
        {/* 4 Primary Destinations */}
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold text-[var(--text-muted)] px-2.5 py-1 tracking-wider uppercase">
            Primary
          </div>
          {primaryNavItems.map(renderNavItem)}
        </div>

        {/* More Hub */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
            <span>More</span>
            <button
              type="button"
              onClick={() => setIsMoreCollapsed((prev) => !prev)}
              className="p-0.5 rounded hover:text-[var(--text-primary)] transition-colors"
              title={isMoreCollapsed ? 'Expand More' : 'Collapse More'}
            >
              {isMoreCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          {!isMoreCollapsed && secondaryNavItems.map(renderNavItem)}
        </div>

        {/* Perspectives Section */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
            <span>Perspectives</span>
            <button
              type="button"
              onClick={() => setIsPerspectivesCollapsed((prev) => !prev)}
              className="p-0.5 rounded hover:text-[var(--text-primary)] transition-colors"
              title={isPerspectivesCollapsed ? 'Expand Perspectives' : 'Collapse Perspectives'}
            >
              {isPerspectivesCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          {!isPerspectivesCollapsed && perspectiveNavItems.map(renderNavItem)}
        </div>

        {/* Smart Filter Views Section */}
        <div className="pt-2 pb-0.5 flex items-center justify-between px-2.5">
          <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase flex items-center gap-1.5">
            Smart Views
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSmartFilterModalOpen(true)}
              className="text-[var(--text-muted)] hover:text-indigo-500 p-0.5 rounded transition-colors"
              title="Create Smart Filter View"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              onClick={() => setIsSmartViewsCollapsed((prev) => !prev)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors"
              title={isSmartViewsCollapsed ? 'Expand Smart Views' : 'Collapse Smart Views'}
            >
              {isSmartViewsCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {!isSmartViewsCollapsed &&
          smartViews.map((sv) => {
            const isSelected = activeView === `smart:${sv.id}`;
            const count = filterTasksByPredicate(tasks, sv.predicate).length;
            const Icon = getSmartViewIcon(sv.icon);

            return (
              <div
                key={sv.id}
                className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.04] hover:text-[var(--text-primary)] border border-transparent'
                }`}
              >
                <button
                  onClick={() => {
                    setActiveView(`smart:${sv.id}` as any);
                    onItemClick?.();
                  }}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                >
                  <div className={`p-1 rounded-lg ${isSelected ? 'bg-stone-100 dark:bg-white/10' : ''}`}>
                    <Icon size={14} className={sv.color || 'text-indigo-500'} />
                  </div>
                  <span className="truncate">{sv.name}</span>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {count > 0 && (
                    <Badge
                      size="xs"
                      variant={isSelected ? 'brand' : 'neutral'}
                      className="font-mono text-[10px]"
                    >
                      {count}
                    </Badge>
                  )}
                  {!sv.isBuiltIn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSmartView(sv.id);
                      }}
                      title="Delete Smart View"
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-rose-500 text-[var(--text-muted)] transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        {/* Projects Section */}
        <div className="pt-2 pb-0.5 flex items-center justify-between px-2.5">
          <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
            Projects ({activeProjectCount})
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsAddingProject(true)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors"
              title="Add Project"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              onClick={() => setIsProjectsCollapsed((prev) => !prev)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors"
              title={isProjectsCollapsed ? 'Expand Projects' : 'Collapse Projects'}
            >
              {isProjectsCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {!isProjectsCollapsed &&
          projects
            .filter((p) => p.id !== 'inbox' && p.id !== 'ideas')
            .map((project) => {
              const isSelected = activeView === `project:${project.id}`;
              const projCount = tasks.filter(
                (t) => t.status !== 'done' && t.projectId === project.id
              ).length;

              return (
                <button
                  key={project.id}
                  onClick={() => {
                    setActiveView(`project:${project.id}`);
                    onItemClick?.();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-subtle border border-[var(--border-hairline)] card-surface font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.04] hover:text-[var(--text-primary)] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-stone-900/10 dark:ring-white/20"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                  </div>
                  {projCount > 0 && (
                    <Badge
                      size="xs"
                      variant={isSelected ? 'brand' : 'neutral'}
                      className="font-mono text-[10px]"
                    >
                      {projCount}
                    </Badge>
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

      {/* Utility Footer: Quick Preferences & System Settings */}
      <div className="p-2.5 border-t border-[var(--border-hairline)] space-y-2 text-[var(--text-secondary)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Row 1: Workspace Utilities with Labels */}
        <div className="flex items-center justify-between px-1 text-[11px]">
          {onOpenScratchpad && (
            <button
              onClick={() => {
                onOpenScratchpad();
                onItemClick?.();
              }}
              title="Sticky Scratchpad (Alt+N)"
              aria-label="Sticky Scratchpad"
              className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-amber-500 p-1 rounded-md hover:bg-stone-200/50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <FileEdit size={13} />
              <span>Scratchpad</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsWeeklyReviewOpen(true);
              onItemClick?.();
            }}
            title="Weekly Review & Retrospective (Ctrl+Shift+W)"
            aria-label="Weekly Review & Retrospective"
            className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-teal-500 p-1 rounded-md hover:bg-stone-200/50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Compass size={13} />
            <span>Review</span>
          </button>

          <button
            onClick={() => {
              onOpenExportImport();
              onItemClick?.();
            }}
            title="Export / Import Data (Backup & Restore)"
            aria-label="Export or import data"
            className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-stone-200/50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <DownloadCloud size={13} />
            <span>Backup</span>
          </button>
        </div>

        {/* Row 2: Unified Settings Bar with Quick Toggles */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-[var(--bg-surface-l2)]/70 border border-[var(--border-subtle)] card-surface">
          <button
            onClick={() => {
              if (onOpenSettings) {
                onOpenSettings();
              } else {
                onOpenExportImport();
              }
              onItemClick?.();
            }}
            title="Preferences & Settings (Ctrl+,)"
            aria-label="Preferences and Settings"
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-0.5"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>

          <div className="flex items-center gap-0.5">
            {onOpenAesthetics && (
              <button
                onClick={() => {
                  onOpenAesthetics();
                  onItemClick?.();
                }}
                title="Aesthetics & Sound Profiles"
                aria-label="Aesthetics & Sound Profiles"
                className="p-1.5 text-[var(--text-muted)] hover:text-purple-500 rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
              >
                <Palette size={14} />
              </button>
            )}

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              aria-label={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            {onOpenShortcuts && !isMobileDrawer && (
              <button
                onClick={() => {
                  onOpenShortcuts();
                  onItemClick?.();
                }}
                title="Keyboard Shortcuts (?)"
                aria-label="Keyboard Shortcuts"
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
              >
                <Keyboard size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
