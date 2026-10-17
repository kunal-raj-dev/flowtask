import { describe, expect, it } from 'vitest';
import { createStarterDashboards } from '../services/starterDashboards';
import { exportDashboard, importDashboard, normalizeDashboard, normalizeWidgetConfig, reorderDashboardWidget, validateDashboards } from './dashboardModel';

describe('dashboard document boundaries', () => {
  it('round-trips a portable layout without notes, URLs, active timers, or mobile positions', () => {
    const dashboard = createStarterDashboards(1)[0];
    dashboard.widgets[0].config = { showNextAction: true, scratchpad: 'private', calendarUrl: 'private', session: { running: true } };
    const text = exportDashboard(dashboard);
    expect(text).not.toContain('private'); expect(text).not.toContain('session'); expect(JSON.parse(text).dashboard.layouts.sm).toBeUndefined();
    expect(importDashboard(text).widgets).toHaveLength(dashboard.widgets.length);
  });
  it('rejects unsupported and duplicate widgets and duplicate dashboards before import', () => {
    const dashboard = createStarterDashboards(1)[0];
    expect(() => normalizeDashboard({ ...dashboard, widgets: [{ id: 'evil', type: 'script', config: {} }] })).toThrow(/unsupported/);
    expect(() => normalizeDashboard({ ...dashboard, widgets: [dashboard.widgets[0],dashboard.widgets[0]] })).toThrow(/duplicate/);
    expect(() => validateDashboards([dashboard,dashboard])).toThrow(/Duplicate/);
    expect(() => importDashboard('x'.repeat(1_000_001))).toThrow(/1 MB/);
  });
  it('bounds malformed coordinates and derives complete tablet/mobile layouts', () => {
    const dashboard = createStarterDashboards(1)[0];
    const normalized = normalizeDashboard({ ...dashboard, layouts: { lg: [{ i: dashboard.widgets[0].id, x: Infinity, y: -50, w: 400, h: 1_000_000 }] } });
    for (const [bp,cols] of [['lg',12],['md',6],['sm',1]] as const) {
      const items = normalized.layouts[bp]!; expect(items).toHaveLength(dashboard.widgets.length);
      for (const item of items) { expect(item.x).toBeGreaterThanOrEqual(0); expect(item.x+item.w).toBeLessThanOrEqual(cols); expect(item.h).toBeLessThanOrEqual(30); }
    }
  });
  it('moves equal-row neighbors visibly and leaves saved snapshots untouched', () => {
    const original = createStarterDashboards(1)[0];
    const previous = JSON.stringify(original);
    const moved = reorderDashboardWidget(original,original.widgets[1].id,-1);
    expect(moved.widgets[0].id).toBe(original.widgets[1].id); expect(moved.layouts.lg[0].i).toBe(original.widgets[1].id);
    expect(JSON.stringify(original)).toBe(previous);
    for (let i=0;i<moved.layouts.lg.length;i++) for (let j=i+1;j<moved.layouts.lg.length;j++) {
      const a=moved.layouts.lg[i],b=moved.layouts.lg[j];
      expect(a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y).toBe(false);
    }
  });
  it('validates filter sources, numeric recipe limits, and project IDs', () => {
    expect(normalizeWidgetConfig('taskList',{source:'script',filterId:{bad:true}})).toEqual({source:'today'});
    expect(normalizeWidgetConfig('focusLaunchpad',{maxRecipes:500})).toEqual({maxRecipes:6});
    expect(normalizeWidgetConfig('projects',{projectIds:'not an array'})).toEqual({});
  });
});
