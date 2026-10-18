import type { DashboardLayoutItem, DashboardWidget, ResponsiveLayouts, WidgetType, WorkspaceDashboard } from '../types/dashboard';

export const WIDGET_TYPES: WidgetType[] = ['top3', 'taskList', 'dayAgenda', 'capacityProgress', 'focusLaunchpad', 'projects', 'studyContinuation', 'quickNotes', 'weeklyWorkload', 'recentActivity', 'resources', 'quietScene'];
export const DASHBOARD_COLUMNS = { lg: 12, md: 6, sm: 1 } as const;
export type DashboardBreakpoint = keyof typeof DASHBOARD_COLUMNS;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[^/\s]{1,200}$/.test(value);
const integer = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;

/** Keep only data a widget actually uses. Imported configuration cannot smuggle private text or executable URLs. */
export function normalizeWidgetConfig(type: WidgetType, raw: unknown): Record<string, unknown> {
  const c = object(raw) ? raw : {};
  const result: Record<string, unknown> = {};
  const bools: Partial<Record<WidgetType, string[]>> = {
    top3: ['showNextAction'], taskList: ['showCompleted', 'excludeTop3'],
    dayAgenda: ['showCalendar', 'showScheduledTasks', 'showNextBlockHighlight'], quietScene: ['showClock'],
  };
  for (const key of bools[type] || []) if (typeof c[key] === 'boolean') result[key] = c[key];
  if (type === 'taskList') {
    result.source = ['today', 'inbox', 'project', 'filter'].includes(String(c.source)) ? c.source : 'today';
    for (const key of ['projectId', 'filterId']) if (identifier(c[key])) result[key] = c[key];
  }
  if (type === 'dayAgenda' && typeof c.showCalendarEvents === 'boolean' && c.showCalendar === undefined) result.showCalendar = c.showCalendarEvents;
  if (type === 'focusLaunchpad') result.maxRecipes = integer(c.maxRecipes, 3, 1, 6);
  if (type === 'projects' && Array.isArray(c.projectIds)) result.projectIds = c.projectIds.filter(identifier).slice(0, 20);
  if (type === 'quickNotes') result.mode = ['both', 'scratchpad', 'task'].includes(String(c.mode)) ? c.mode : 'both';
  if (type === 'quietScene') {
    result.clockFormat = c.clockFormat === '24h' ? '24h' : '12h';
    if (identifier(c.sceneId) && !String(c.sceneId).startsWith('local:')) result.sceneId = c.sceneId;
  }
  return result;
}

const overlap = (a: DashboardLayoutItem, b: DashboardLayoutItem) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Pure, bounded, non-overlapping placement. Never mutate a saved layout or an undo snapshot. */
export function normalizeDashboardLayout(widgets: DashboardWidget[], raw: unknown, breakpoint: DashboardBreakpoint): DashboardLayoutItem[] {
  const cols = DASHBOARD_COLUMNS[breakpoint];
  const items = Array.isArray(raw) ? raw.filter(object) : [];
  const result: DashboardLayoutItem[] = [];
  const ordered = [...widgets].sort((a, b) => {
    const x = items.find(i => i.i === a.id), y = items.find(i => i.i === b.id);
    return Number(x?.y ?? 10000) - Number(y?.y ?? 10000) || Number(x?.x ?? 0) - Number(y?.x ?? 0);
  });
  for (const widget of ordered) {
    const item = items.find(i => i.i === widget.id);
    const minW = Math.min(cols, integer(widget.minW, 3, 1, 12));
    const minH = integer(widget.minH, 3, 2, 20);
    const w = integer(item?.w, cols, minW, cols), h = integer(item?.h, Math.max(4, minH), minH, 30);
    const placed: DashboardLayoutItem = {
      i: widget.id, x: integer(item?.x, 0, 0, cols - w),
      y: integer(item?.y, result.reduce((n, i) => Math.max(n, i.y + i.h), 0), 0, 1000), w, h, minW, minH,
      maxW: undefined, maxH: undefined, static: Boolean(item?.static),
      isDraggable: undefined, isResizable: undefined,
    };
    let collision = result.find(other => overlap(placed, other));
    while (collision) {
      placed.y = collision.y + collision.h;
      collision = result.find(other => overlap(placed, other));
    }
    while (placed.y > 0 && !result.some(other => overlap({ ...placed, y: placed.y - 1 }, other))) {
      placed.y--;
    }
    result.push(placed);
  }
  return widgets.map(w => result.find(r => r.i === w.id)!);
}

export function normalizeDashboard(raw: unknown): WorkspaceDashboard {
  if (!object(raw) || !identifier(raw.id) || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100 || !Array.isArray(raw.widgets) || raw.widgets.length > 24 || !object(raw.layouts) || !Array.isArray(raw.layouts.lg)) throw new Error('Invalid dashboard. Use a FlowTask dashboard with a name, widgets, and a desktop layout.');
  const ids = new Set<string>();
  const widgets: DashboardWidget[] = raw.widgets.map(value => {
    if (!object(value) || !identifier(value.id) || ids.has(value.id) || !WIDGET_TYPES.includes(value.type as WidgetType)) throw new Error('This dashboard contains a duplicate or unsupported widget.');
    ids.add(value.id);
    const type = value.type as WidgetType;
    return { id: value.id, type, title: typeof value.title === 'string' ? value.title.slice(0, 80) : undefined,
      config: normalizeWidgetConfig(type, value.config), minW: integer(value.minW, 3, 1, 12), minH: integer(value.minH, 3, 2, 20) };
  });
  const layouts: ResponsiveLayouts = { lg: normalizeDashboardLayout(widgets, raw.layouts.lg, 'lg') };
  for (const bp of ['md', 'sm'] as const) layouts[bp] = normalizeDashboardLayout(widgets, raw.layouts[bp], bp);
  return { id: raw.id, name: raw.name.trim(), order: integer(raw.order, 0, 0, 100), isDefault: raw.isDefault === true,
    ...(identifier(raw.icon) ? { icon: raw.icon } : {}),
    widgets, layouts, revision: integer(raw.revision, 0, 0, Number.MAX_SAFE_INTEGER),
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    ...(identifier(raw.coverImage) && !String(raw.coverImage).startsWith('local:') ? { coverImage: raw.coverImage } : {}) };
}

export function validateDashboards(raw: unknown): WorkspaceDashboard[] {
  if (!Array.isArray(raw) || raw.length > 20) throw new Error('A workspace supports up to 20 dashboards.');
  const ids = new Set<string>();
  return raw.map(value => {
    const dashboard = normalizeDashboard(value);
    if (ids.has(dashboard.id)) throw new Error('Duplicate dashboard ID.');
    ids.add(dashboard.id);
    return dashboard;
  });
}

export function reorderDashboardWidget(dashboard: WorkspaceDashboard, id: string, direction: -1 | 1): WorkspaceDashboard {
  const widgets = [...dashboard.widgets], index = widgets.findIndex(w => w.id === id), target = index + direction;
  if (index < 0 || target < 0 || target >= widgets.length) return dashboard;
  [widgets[index], widgets[target]] = [widgets[target], widgets[index]];
  const layouts = {} as ResponsiveLayouts;
  // Accessible reorder follows reading order and re-packs each row; equal-y neighbors still move visibly.
  for (const bp of ['lg', 'md', 'sm'] as const) {
    const cols = DASHBOARD_COLUMNS[bp]; let x = 0, y = 0, rowHeight = 0;
    layouts[bp] = widgets.map(widget => {
      const original = dashboard.layouts[bp]?.find(i => i.i === widget.id);
      const w = Math.min(cols, original?.w || cols), h = original?.h || 4;
      if (x + w > cols) { x = 0; y += rowHeight; rowHeight = 0; }
      const item = { i: widget.id, x, y, w, h }; x += w; rowHeight = Math.max(rowHeight, h); return item;
    });
  }
  return normalizeDashboard({ ...dashboard, widgets, layouts });
}

export function exportDashboard(dashboard: WorkspaceDashboard): string {
  const safe = normalizeDashboard(dashboard);
  const { sm: _mobile, ...layouts } = safe.layouts;
  return JSON.stringify({ format: 'flowtask-dashboard', version: 1, dashboard: { ...safe, layouts } }, null, 2);
}

export function importDashboard(text: string): WorkspaceDashboard {
  if (text.length > 1_000_000) throw new Error('Dashboard files must be smaller than 1 MB.');
  const raw: unknown = JSON.parse(text);
  if (!object(raw) || raw.format !== 'flowtask-dashboard' || raw.version !== 1) throw new Error('Choose a FlowTask dashboard JSON file.');
  return normalizeDashboard(raw.dashboard);
}
