import React from 'react';
import { Sun, Calendar, Plus, Grid2X2, Menu } from 'lucide-react';

interface MobileBottomNavProps {
  activeView: string;
  onSelectView: (viewId: string) => void;
  onQuickAdd: () => void;
  onOpenMenu: () => void;
  todayCount?: number;
  upcomingCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  onQuickAdd,
  onOpenMenu,
  todayCount = 0,
  upcomingCount = 0,
}) => {
  const isToday = activeView === 'today';
  const isUpcoming = activeView === 'upcoming';
  const isMatrix = activeView === 'matrix';

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--bg-surface-l1)]/95 backdrop-blur-2xl border-t border-[var(--border-hairline)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] px-3 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {/* Tab 1: Today */}
        <button
          type="button"
          onClick={() => onSelectView('today')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all ${
            isToday
              ? 'text-amber-500 font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Today View"
        >
          <div className="relative">
            <Sun size={20} className={isToday ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
            {todayCount > 0 && (
              <span className="absolute -top-1 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-white font-mono text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-surface-l1)]">
                {todayCount > 99 ? '99+' : todayCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Today</span>
        </button>

        {/* Tab 2: Upcoming */}
        <button
          type="button"
          onClick={() => onSelectView('upcoming')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all ${
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

        {/* Center Elevating Quick Add (+) Button */}
        <div className="relative -top-2 flex flex-col items-center">
          <button
            type="button"
            onClick={onQuickAdd}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/35 active:scale-95 transition-all flex items-center justify-center card-surface"
            aria-label="Quick Add Task"
          >
            <Plus size={24} className="stroke-[2.6]" />
          </button>
        </div>

        {/* Tab 3: Priority Matrix */}
        <button
          type="button"
          onClick={() => onSelectView('matrix')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all ${
            isMatrix
              ? 'text-emerald-500 font-semibold'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          aria-label="Priority Matrix"
        >
          <Grid2X2 size={20} className={isMatrix ? 'stroke-[2.4]' : 'stroke-[1.8]'} />
          <span className="text-[10px] mt-1 tracking-tight">Matrix</span>
        </button>

        {/* Tab 4: More / Menu (opens sidebar drawer with projects & settings) */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          aria-label="More views and projects"
        >
          <Menu size={20} className="stroke-[1.8]" />
          <span className="text-[10px] mt-1 tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};
