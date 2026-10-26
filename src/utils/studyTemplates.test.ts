import { describe, it, expect } from 'vitest';
import { copyStudySessions, normalizeStudyTemplates, STARTER_STUDY_TEMPLATES } from './studyTemplates';
import { safePreference } from '../services/workspaceEntities';
import { validateBackupExtras } from './workspaceBackup';

describe('reusable study plans', () => {
  it('keeps an intentionally empty library and preserves templates in sync and backups', () => {
    expect(safePreference('workspace', { studyTemplates: [] })).toEqual({ studyTemplates: [] });
    const templates = normalizeStudyTemplates(STARTER_STUDY_TEMPLATES);
    expect(templates).toHaveLength(4);
    expect(safePreference('workspace', { studyTemplates: templates, scratchpad: 'private' })).toEqual({ studyTemplates: templates });
    const restored = validateBackupExtras({ preferences: { workspace: { studyTemplates: templates } } })!;
    expect((restored.preferences.workspace as any).studyTemplates).toEqual(templates);
  });
  it('copies targets independently and strips unsafe links from synced templates', () => {
    const copy = copyStudySessions(STARTER_STUDY_TEMPLATES[0].sessions);
    copy[0].targets[0].title = 'A personal exercise';
    copy[0].targets[0].url = 'javascript:alert(1)';
    expect(STARTER_STUDY_TEMPLATES[0].sessions[0].targets[0].title).not.toBe('A personal exercise');
    expect(normalizeStudyTemplates([{ ...STARTER_STUDY_TEMPLATES[0], sessions: copy }])[0].sessions[0].targets[0].url).toBeUndefined();
    expect(() => validateBackupExtras({ preferences: { workspace: { studyTemplates: [{ id: 'broken' }] } } })).toThrow(/study templates/);
  });
});
