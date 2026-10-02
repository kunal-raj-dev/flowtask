import { describe, it, expect } from 'vitest';
import {
  generateSnapshotShareUrl,
  parseSnapshotFromUrl,
  safeBase64Encode,
  safeBase64Decode,
} from './snapshotShare';
import type { Task } from '../types/task';

describe('snapshotShare', () => {
  it('correctly encodes and decodes unicode text in base64', () => {
    const text = 'FlowTask ✨ 🚀 — Testing Japanese: 日本語, Accents: café';
    const encoded = safeBase64Encode(text);
    const decoded = safeBase64Decode(encoded);
    expect(decoded).toBe(text);
  });

  it('generates a valid share URL with encoded payload and parses it back', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Launch MVP ✨',
        priority: 'p1',
        estimatedMinutes: 45,
        dueDate: '2026-10-02',
        subtasks: [{ id: 's-1', title: 'Write tests', completed: true }],
        status: 'todo',
        createdAt: Date.now(),
        projectId: 'inbox',
      },
      {
        id: '2',
        title: 'Verify audit checklist',
        priority: 'p2',
        estimatedMinutes: 30,
        subtasks: [],
        status: 'todo',
        createdAt: Date.now(),
        projectId: 'inbox',
      },
    ];

    const url = generateSnapshotShareUrl(tasks, 'Product Launch Checklist', 'https://flowtask.app/');
    expect(url).toContain('https://flowtask.app/#snapshot=');

    const parsed = parseSnapshotFromUrl(url);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe('Product Launch Checklist');
    expect(parsed?.v).toBe(1);
    expect(parsed?.tasks).toHaveLength(2);
    expect(parsed?.tasks[0].title).toBe('Launch MVP ✨');
    expect(parsed?.tasks[0].priority).toBe('p1');
    expect(parsed?.tasks[0].subtasks).toHaveLength(1);
  });

  it('returns null for invalid or corrupted snapshot URLs', () => {
    expect(parseSnapshotFromUrl('')).toBeNull();
    expect(parseSnapshotFromUrl('https://flowtask.app/')).toBeNull();
    expect(parseSnapshotFromUrl('https://flowtask.app/#snapshot=invalid-gibberish')).toBeNull();
  });
});
