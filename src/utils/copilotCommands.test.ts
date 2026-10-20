import { describe, expect, it } from 'vitest';
import { parseCopilotCommand } from './copilotCommands';

describe('bounded copilot commands', () => {
  it('treats focus, stats and schedule words inside task titles as task text', () => {
    expect(parseCopilotCommand('add Fix background focus timer')).toEqual({ action: 'add', title: 'Fix background focus timer' });
    expect(parseCopilotCommand('decompose Build progress stats')).toEqual({ action: 'breakdown', title: 'Build progress stats' });
  });
  it('parses explicit supported commands', () => {
    expect(parseCopilotCommand('plan my day')).toEqual({ action: 'schedule', date: undefined });
    expect(parseCopilotCommand('schedule tasks for 2026-10-21')).toEqual({ action: 'schedule', date: '2026-10-21' });
    expect(parseCopilotCommand('focus 45m on Read chapter')).toEqual({ action: 'focus', minutes: 45, taskTitle: 'Read chapter' });
    expect(parseCopilotCommand('Show me my daily summary').action).toBe('summary');
  });
  it('returns help for ambiguous, unsupported and out-of-bounds requests', () => {
    for (const text of ['Fix background focus timer', 'delete all tasks', 'schedule my day and start focus', 'focus 999m', 'add', '']) expect(parseCopilotCommand(text).action).toBe('unknown');
  });
});
