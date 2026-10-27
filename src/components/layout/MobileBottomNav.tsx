import { Sun, Inbox, Calendar, Plus, Menu, Folder, TrendingUp } from 'lucide-react';

interface MobileBottomNavProps {
  activeView: string;
  onSelectView: (viewId: string) => void;
  onQuickAdd: () => void;
  onOpenMenu: () => void;
  todayCount?: number;
  inboxCount?: number;
  upcomingCount?: number;
}
export function MobileBottomNav({ activeView, onSelectView, onQuickAdd, onOpenMenu, todayCount = 0, inboxCount = 0, upcomingCount = 0 }: MobileBottomNavProps) {
  const items = [
    { id: 'today', label: 'Today', aria: 'Today View', icon: Sun, active: activeView === 'today', count: todayCount },
    { id: 'inbox', label: 'Inbox', aria: 'Inbox View', icon: Inbox, active: activeView === 'inbox', count: inboxCount },
    { id: 'upcoming', label: 'Plan', aria: 'Plan View', icon: Calendar, active: ['upcoming', 'timeline'].includes(activeView), count: upcomingCount },
    { id: 'projects', label: 'Projects', aria: 'Projects View', icon: Folder, active: activeView === 'projects' || activeView.startsWith('project:'), count: 0 },
    { id: 'review', label: 'Review', aria: 'Review View', icon: TrendingUp, active: ['review', 'insights', 'logbook'].includes(activeView), count: 0 },
  ];
  return <>
    <nav className="mobile-primary-nav" aria-label="Mobile navigation"><div>
      {items.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => onSelectView(item.id)} aria-label={item.aria} aria-current={item.active ? 'page' : undefined}><span><Icon size={19} strokeWidth={1.75} />{item.count > 0 && <span className="mobile-nav-count">{item.count > 99 ? '99+' : item.count}</span>}</span><span>{item.label}</span></button>; })}
      <button type="button" onClick={onOpenMenu} aria-label="More views and projects" aria-current={items.some(item => item.active) ? undefined : 'page'}><span><Menu size={19} strokeWidth={1.75} /></span><span>Tools</span></button>
    </div></nav>
    <button type="button" className="mobile-capture-fab" onClick={onQuickAdd} aria-label="Quick Add Task"><Plus size={22} /></button>
  </>;
}
