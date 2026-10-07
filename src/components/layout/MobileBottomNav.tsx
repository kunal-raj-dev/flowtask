import React from 'react';
import { motion } from 'framer-motion';
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
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-surface-l1)]/95 backdrop-blur-2xl border-t border-[var(--border-hairline)] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)] px-3 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* Tab 1: Today */}
        <button
          type="button"
          onClick={() => onSelectView('today')}
          className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-2 rounded-xl transition-all active:scale-95 ${
            isToday
              ? 'text-[var(--color-brand)] font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Today View"
        >
          <div className="relative flex flex-col items-center">
            <Sun size={20} strokeWidth={1.75} className={isToday ? 'text-[var(--color-brand)]' : ''} />
            {todayCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--color-brand)] text-white font-mono tabular-nums text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-surface-l1)]">
                {todayCount > 99 ? '99+' : todayCount}
              </span>
            )}
            {isToday && (
              <motion.span
                layoutId="mobileActiveTabIndicator"
                className="absolute -bottom-1.5 w-4 h-0.5 rounded-full bg-[var(--color-brand)] shadow-[0_0_8px_rgba(217,119,6,0.6)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="text-[10px] mt-1.5 tracking-tight">Today</span>
        </button>

        {/* Tab 2: Inbox */}
        <button
          type="button"
          onClick={() => onSelectView('inbox')}
          className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-2 rounded-xl transition-all active:scale-95 ${
            isInbox
              ? 'text-blue-500 font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Inbox View"
        >
          <div className="relative flex flex-col items-center">
            <Inbox size={20} strokeWidth={1.75} className={isInbox ? 'text-blue-500' : ''} />
            {inboxCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-blue-500 text-white font-mono tabular-nums text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-surface-l1)]">
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            )}
            {isInbox && (
              <motion.span
                layoutId="mobileActiveTabIndicator"
                className="absolute -bottom-1.5 w-4 h-0.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="text-[10px] mt-1.5 tracking-tight">Inbox</span>
        </button>

        {/* Center Elevating Quick Add (+) Button */}
        <div className="relative -top-2 flex flex-col items-center">
          <button
            type="button"
            onClick={onQuickAdd}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-[0_4px_16px_rgba(217,119,6,0.35)] active:scale-90 transition-transform flex items-center justify-center cursor-pointer card-surface"
            aria-label="Quick Add Task"
          >
            <Plus size={22} strokeWidth={2.2} />
          </button>
        </div>

        {/* Tab 3: Upcoming */}
        <button
          type="button"
          onClick={() => onSelectView('upcoming')}
          className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-2 rounded-xl transition-all active:scale-95 ${
            isUpcoming
              ? 'text-purple-500 font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Upcoming View"
        >
          <div className="relative flex flex-col items-center">
            <Calendar size={20} strokeWidth={1.75} className={isUpcoming ? 'text-purple-500' : ''} />
            {upcomingCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-purple-500 text-white font-mono tabular-nums text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-surface-l1)]">
                {upcomingCount > 99 ? '99+' : upcomingCount}
              </span>
            )}
            {isUpcoming && (
              <motion.span
                layoutId="mobileActiveTabIndicator"
                className="absolute -bottom-1.5 w-4 h-0.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="text-[10px] mt-1.5 tracking-tight">Upcoming</span>
        </button>

        {/* Tab 4: More / Menu (opens mobile drawer with Projects, Review, Someday, All Tasks, Settings) */}
        <button
          type="button"
          onClick={onOpenMenu}
          className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-2 rounded-xl transition-all active:scale-95 ${
            isMore
              ? 'text-[var(--color-brand)] font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="More views and projects"
          aria-current={isMore ? 'page' : undefined}
        >
          <div className="relative flex flex-col items-center">
            <Menu size={20} strokeWidth={1.75} className={isMore ? 'text-[var(--color-brand)]' : ''} />
            {isMore && (
              <motion.span
                layoutId="mobileActiveTabIndicator"
                className="absolute -bottom-1.5 w-4 h-0.5 rounded-full bg-[var(--color-brand)] shadow-[0_0_8px_rgba(217,119,6,0.6)]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="text-[10px] mt-1.5 tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};
