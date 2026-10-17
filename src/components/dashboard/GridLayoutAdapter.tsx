import React, { useMemo, useCallback } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import type { WorkspaceDashboard, ResponsiveLayouts, DashboardLayoutItem } from '../../types/dashboard';
import { WIDGET_REGISTRY } from '../../services/widgetRegistry';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { isFocusTask } from '../../utils/taskSelectors';
import { normalizeDashboardLayout, type DashboardBreakpoint } from '../../utils/dashboardModel';
import { GripVertical, Settings, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface GridLayoutAdapterProps {
  dashboard: WorkspaceDashboard; isEditing: boolean; previewBreakpoint?: DashboardBreakpoint;
  onLayoutChange: (layouts: ResponsiveLayouts) => void;
  onSelectTask?: (id: string) => void; onStartFocus?: (id: string) => void; onStartSprint?: (id: string) => void;
  onUpdateWidgetConfig?: (id: string, config: Record<string, unknown>) => void;
  onConfigureWidget?: (id: string) => void; onRemoveWidget?: (id: string) => void;
  onMoveWidgetEarlier?: (id: string) => void; onMoveWidgetLater?: (id: string) => void;
  onResizeWidgetPreset?: (id: string, w: number, h: number) => void;
}
const GRID_BREAKPOINTS: Record<DashboardBreakpoint, number> = { lg: 960, md: 640, sm: 0 };
const GRID_COLS: Record<DashboardBreakpoint, number> = { lg: 12, md: 6, sm: 1 };
const GRID_MARGIN: [number, number] = [20, 20];
const GRID_PADDING: [number, number] = [0, 0];

export const GridLayoutAdapter: React.FC<GridLayoutAdapterProps> = props => {
  const { dashboard, isEditing, previewBreakpoint = 'lg' } = props;
  const { tasks, focusSession } = useTaskContext();
  const today = useTodayStr();
  const priorityCount = Math.min(3, tasks.filter(task => isFocusTask(task,today)).length);
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
    initialWidth: typeof window !== 'undefined' ? window.innerWidth : 1200,
  });
  const measured = width || (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const effectiveWidth = previewBreakpoint === 'sm' ? Math.min(measured, 420) : previewBreakpoint === 'md' ? Math.min(measured, 800) : measured;
  const breakpoint: DashboardBreakpoint = effectiveWidth >= 960 ? 'lg' : effectiveWidth >= 640 ? 'md' : 'sm';
  const frameWidgets = useMemo(() => dashboard.widgets.map(widget => {
    const minimum = widget.type === 'top3' ? Math.ceil((54 + priorityCount * (widget.config.showNextAction === false ? 70 : 96) + 20) / 70)
      : widget.type === 'focusLaunchpad' ? Math.ceil((82 + Number(widget.config.maxRecipes || 3) * 65 + (focusSession ? 80 : 0) + 20) / 70) : 0;
    return minimum ? { ...widget, minH: Math.max(widget.minH || 2, minimum) } : widget;
  }), [dashboard.widgets, priorityCount, focusSession]);
  const layouts = useMemo(() => ({
    lg: normalizeDashboardLayout(frameWidgets, dashboard.layouts.lg, 'lg'),
    md: normalizeDashboardLayout(frameWidgets, dashboard.layouts.md, 'md'),
    sm: normalizeDashboardLayout(frameWidgets, dashboard.layouts.sm, 'sm'),
  }), [frameWidgets, dashboard.layouts]);
  const displayed = dashboard.widgets;
  const commit = useCallback((layout: readonly DashboardLayoutItem[]) => {
    if (!isEditing) return;
    props.onLayoutChange({ ...dashboard.layouts, [breakpoint]: normalizeDashboardLayout(frameWidgets, layout, breakpoint) });
  }, [isEditing, props, dashboard.layouts, breakpoint, frameWidgets]);
  const dragConfig = useMemo(() => ({ enabled: isEditing, handle: '.widget-drag-handle', threshold: 4, allowMobileScroll: true }), [isEditing]);
  const resizeConfig = useMemo(() => ({ enabled: isEditing, handles: ['se' as const] }), [isEditing]);

  return <div ref={containerRef} data-dashboard-grid className={isEditing ? 'desk-grid dashboard-editing' : 'desk-grid'} style={{ maxWidth: isEditing && previewBreakpoint === 'sm' ? 420 : isEditing && previewBreakpoint === 'md' ? 800 : undefined, marginInline: 'auto' }}>
    {mounted && <ResponsiveGridLayout width={effectiveWidth} breakpoints={GRID_BREAKPOINTS} cols={GRID_COLS}
      layouts={layouts} rowHeight={50} margin={GRID_MARGIN} containerPadding={GRID_PADDING}
      dragConfig={dragConfig}
      resizeConfig={resizeConfig}
      onDragStop={commit} onResizeStop={commit}>
      {displayed.map(widget => {
        const def = WIDGET_REGISTRY[widget.type];
        if (!def) return <div key={widget.id} className="widget-card"><p>This widget needs an update. Open settings to repair it.</p></div>;
        const Component = def.component, Icon = def.icon, title = widget.title || def.defaultTitle;
        const index = dashboard.widgets.findIndex(w => w.id === widget.id);
        return <section key={widget.id} className="widget-card" data-widget-id={widget.id} data-widget-type={widget.type} aria-label={title}>
          <div className="widget-header"><div className="widget-heading">{isEditing ? <span className="widget-drag-handle" aria-hidden="true"><GripVertical size={17}/></span> : <Icon size={16} aria-hidden="true"/>}<h2>{title}</h2></div>{!isEditing && widget.type === 'top3' && <span className="widget-label">Make it count</span>}</div>
          {isEditing && <div className="widget-arrange-controls" aria-label={'Arrange ' + title}>
            <button className="desk-icon-button" disabled={index === 0} aria-label={'Move ' + title + ' earlier'} onClick={() => props.onMoveWidgetEarlier?.(widget.id)}><ArrowUp size={16}/></button>
            <button className="desk-icon-button" disabled={index === dashboard.widgets.length-1} aria-label={'Move ' + title + ' later'} onClick={() => props.onMoveWidgetLater?.(widget.id)}><ArrowDown size={16}/></button>
            <select aria-label={'Resize presets for ' + title} value="" onChange={e => { const p = def.presets[Number(e.target.value)]; if (p) props.onResizeWidgetPreset?.(widget.id, p.w, p.h); }}><option value="" disabled>Size</option>{def.presets.map((p,i) => <option key={p.label} value={i}>{p.label}</option>)}</select>
            <button className="desk-icon-button" aria-label={'Configure ' + title} onClick={() => props.onConfigureWidget?.(widget.id)}><Settings size={16}/></button>
            <button className="desk-icon-button danger" aria-label={'Remove ' + title} onClick={() => props.onRemoveWidget?.(widget.id)}><Trash2 size={16}/></button>
          </div>}
          <div className="widget-body" inert={isEditing || undefined}><Component widget={widget} isEditing={isEditing} onSelectTask={props.onSelectTask} onStartFocus={props.onStartFocus} onStartSprint={props.onStartSprint}/></div>
        </section>;
      })}
    </ResponsiveGridLayout>}
  </div>;
};
