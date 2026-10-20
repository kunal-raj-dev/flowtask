import { describe, expect, it } from 'vitest';
import { resolveActiveDashboard } from './activeDashboard';
import { STARTER_DASHBOARDS } from '../services/starterDashboards';

describe('shared dashboard selection', () => {
  it('uses the valid active desk, then the workspace default, then its default desk', () => {
    const desks = STARTER_DASHBOARDS;
    expect(resolveActiveDashboard(desks, desks[1].id).id).toBe(desks[1].id);
    expect(resolveActiveDashboard(desks, 'missing', { defaultDashboardId: desks[1].id }).id).toBe(desks[1].id);
    expect(resolveActiveDashboard(desks, 'missing').id).toBe(desks[0].id);
  });
  it('uses the same bundled fallback when the saved collection is empty', () => {
    expect(resolveActiveDashboard([]).id).toBe(STARTER_DASHBOARDS[0].id);
  });
});
