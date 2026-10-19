import { describe, expect, it } from 'vitest';
import { commandService } from './commandService';
import { computeAutoSlotSchedule } from '../utils/autoSlotAlgorithm';
import { curateWorkspaceVisuals } from '../utils/workspaceVisuals';
import { createWorkspaceBackup } from '../utils/workspaceBackup';
import { emptyWorkspace } from './dbService';
import type { MediaAsset } from '../types/studio';

describe('release behavior boundaries', () => {
  it('keeps literal input when parsing is disabled and honors saved priority', () => {
    const { createdTask } = commandService.createTask([], 'Read tomorrow p1 ~45m', undefined, { enableParsing: false, defaultPriority: 'p2' });
    expect(createdTask).toMatchObject({ title: 'Read tomorrow p1 ~45m', priority: 'p2' });
    expect(createdTask.dueDate).toBeUndefined(); expect(createdTask.estimatedMinutes).toBeUndefined();
  });
  it('keeps explicit choices above parsed input and parsed input above defaults', () => {
    expect(commandService.createTask([], 'Read p1', { priority: 'p4' }, { defaultPriority: 'p2' }).createdTask.priority).toBe('p4');
    expect(commandService.createTask([], 'Read p1', undefined, { defaultPriority: 'p2' }).createdTask.priority).toBe('p1');
  });
  it('schedules within the remaining day, after calendar meetings', () => {
    const task = commandService.createTask([], 'Read ~30m').createdTask;
    const result = computeAutoSlotSchedule([task], [], [{ id: 'meeting', title: 'Class', startTime: '16:30', endTime: '17:00' }], { startHour: 7, endHour: 22, earliestStartMinutes: 16 * 60 + 22 });
    expect(result.slotted[0].scheduledStart).toBe('17:00');
    expect(result.message).not.toContain('Successfully');
  });
  it('leaves tasks untouched when the day is over or its work budget is exhausted', () => {
    const task = commandService.createTask([], 'Read ~30m').createdTask;
    for (const options of [{ earliestStartMinutes: 1440 }, { maxCapacityMinutes: 0 }]) {
      const result = computeAutoSlotSchedule([task], [], [], options);
      expect(result.slotted).toEqual([]); expect(result.unslotted).toEqual([task]);
      expect(task.scheduledStart).toBeUndefined();
    }
  });
  it('offers twelve diverse recommendations without dropping stable IDs', () => {
    const styles = ['flowtask-original', 'nature', 'architecture', 'space', 'illustration', 'abstract'] as const;
    const assets = styles.flatMap(style => Array.from({ length: 5 }, (_, i) => ({ id: `${style}-${i}`, title: `${style} ${i}`, visualStyle: style, category: 'planning-reflection', src: '/media/image.webp', license: 'Original', creator: 'FlowTask' } as MediaAsset)));
    const result = curateWorkspaceVisuals(assets, { kind: 'dashboard' });
    expect(result).toHaveLength(12); expect(new Set(result.map(item => item.asset.visualStyle)).size).toBe(6);
    expect(new Set(result.map(item => item.asset.id)).size).toBe(12);
  });
  it('omits imported calendar contents and runtime state from portable backups', () => {
    const record = emptyWorkspace('local');
    record.preferences._calendarFile = { name: 'private.ics', content: 'private calendar contents' };
    const backup = createWorkspaceBackup(record);
    expect(backup.schemaVersion).toBe(6); expect(JSON.stringify(backup)).not.toContain('private calendar contents');
  });
});
