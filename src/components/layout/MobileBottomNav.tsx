import React from 'react';
import { Sun, Inbox, Calendar, Plus, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  activeView: string;
  onSelectView: (viewId: string) => void;
  onQuickAdd: () => void;
  onOpenMenu: () => void;
  todayCount?: number;
  inboxCount?: number;
  upcomingCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  onQuickAdd,
  onOpenMenu,
  todayCount = 0,
  inboxCount = 0,
  upcomingCount = 0,
}) => {
  const isToday = activeView === 'today';
  const isInbox = activeView === 'inbox';
  const isUpcoming = activeView === 'upcoming';
  const isMore = !isToday && !isInbox && !isUpcoming;

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-surface-l1)]/95 backdrop-blur-2xl border-t border-[var(--border-hairline)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* Tab 1: Today */}
        <button
          type="button"
          onClick={() => onSelectView('today')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-2 rounded-lg transition-all active:scale-95 ${
            isToday
              ? 'text-[var(--color-brand)] font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Today View"
        >
          <div className="relative">
            <Sun size={20} className={isToday ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
            {todayCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--color-brand)] text-white font-mono text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-surface-l1)]">
                {todayCount > 99 ? '99+' : todayCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Today</span>
        </button>

        {/* Tab 2: Inbox */}
        <button
          type="button"
          onClick={() => onSelectView('inbox')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-2 rounded-lg transition-all active:scale-95 ${
            isInbox
              ? 'text-blue-500 font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Inbox View"
        >
          <div className="relative">
            <Inbox size={20} className={isInbox ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
            {inboxCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-blue-500 text-white font-mono text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-surface-l1)]">
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Inbox</span>
        </button>

        {/* Center Elevating Quick Add (+) Button */}
        <div className="relative -top-2 flex flex-col items-center">
          <button
            type="button"
            onClick={onQuickAdd}
            className="w-12 h-12 rounded-xl bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center card-surface"
            aria-label="Quick Add Task"
          >
            <Plus size={24} className="stroke-[2.6]" />
          </button>
        </div>

        {/* Tab 3: Upcoming */}
        <button
          type="button"
          onClick={() => onSelectView('upcoming')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-2 rounded-lg transition-all active:scale-95 ${
            isUpcoming
              ? 'text-purple-500 font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Upcoming View"
        >
          <div className="relative">
            <Calendar size={20} className={isUpcoming ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
            {upcomingCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-purple-500 text-white font-mono text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-surface-l1)]">
                {upcomingCount > 99 ? '99+' : upcomingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Upcoming</span>
        </button>

        {/* Tab 4: More / Menu (opens mobile drawer with Projects, Review, Someday, All Tasks, Settings) */}
        <button
          type="button"
          onClick={onOpenMenu}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-2 rounded-lg transition-all active:scale-95 ${
            isMore
              ? 'text-[var(--color-brand)] font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="More views and projects"
          aria-current={isMore ? 'page' : undefined}
        >
          <Menu size={20} className={isMore ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
          <span className="text-[10px] mt-1 tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};
