import { describe, it, expect } from 'vitest';
import { normalizePresentation } from './workspacePresentation';
import { createStarterDashboards } from '../services/starterDashboards';
import { isGuidedDailyDesk } from '../components/dashboard/DailyDesk';
import { normalizeDashboard, exportDashboard, importDashboard } from './dashboardModel';
import { safePreference } from '../services/workspaceEntities';
import { validateBackupExtras } from './workspaceBackup';

describe('redesigned Daily Desk compatibility',()=>{
  it('recognizes a normalized or exported new desk without modifying custom geometry',()=>{
    const desk=createStarterDashboards(1)[0], before=JSON.stringify(desk);
    expect(isGuidedDailyDesk(normalizeDashboard(desk))).toBe(true);
    expect(isGuidedDailyDesk(importDashboard(exportDashboard(desk)))).toBe(true);
    const changed=structuredClone(desk);changed.layouts.lg[0].w=6;
    expect(isGuidedDailyDesk(changed)).toBe(false);
    expect(JSON.stringify(desk)).toBe(before);
    expect(isGuidedDailyDesk(createStarterDashboards(1)[1])).toBe(false);
  });
  it('does not treat a previous seven-widget daily layout as the new arrangement',()=>{
    const desk=createStarterDashboards(1)[0];
    desk.widgets.push({id:'old-capacity',type:'capacityProgress',config:{}});
    expect(isGuidedDailyDesk(desk)).toBe(false);
  });
  it('preserves versioned opt-in metadata through safe sync and backup restore',()=>{
    const presentation={version:1,offerDismissed:true,dailyDeskId:'my-desk'};
    expect(safePreference('workspace',{presentation,privateNote:'private'})).toEqual({presentation});
    expect(validateBackupExtras({preferences:{workspace:{presentation}}})?.preferences.workspace).toEqual({presentation});
  });
  it('discards malformed or unknown presentation metadata without discarding other settings',()=>{
    expect(normalizePresentation({version:2,dailyDeskId:'bad/id'})).toBeUndefined();
    expect(normalizePresentation({version:1,dailyDeskId:'bad/id',offerDismissed:'yes',notes:'private'})).toEqual({version:1});
    expect(validateBackupExtras({preferences:{workspace:{showCovers:false,presentation:'invalid'}}})?.preferences.workspace).toEqual({showCovers:false});
  });
});
