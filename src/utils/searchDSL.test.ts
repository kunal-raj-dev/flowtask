import { describe, it, expect } from 'vitest';
import { parseSearchDSL } from './searchDSL';

describe('searchDSL', () => {
  it('extracts priority operators p:p1, p:2, priority:high, priority:urgent', () => {
    expect(parseSearchDSL('deploy app p:p1')).toEqual({
      text: 'deploy app',
      priority: 'p1',
    });

    expect(parseSearchDSL('p:2 review pull request')).toEqual({
      text: 'review pull request',
      priority: 'p2',
    });

    expect(parseSearchDSL('priority:urgent server down')).toEqual({
      text: 'server down',
      priority: 'p1',
    });

    expect(parseSearchDSL('priority:low write tests')).toEqual({
      text: 'write tests',
      priority: 'p4',
    });
  });

  it('extracts context tags with @ syntax and context: prefix', () => {
    expect(parseSearchDSL('call client @phone')).toEqual({
      text: 'call client',
      contextTag: 'phone',
    });

    expect(parseSearchDSL('context:office review blueprints')).toEqual({
      text: 'review blueprints',
      contextTag: 'office',
    });
  });

  it('extracts tags with # syntax and tag: prefix', () => {
    expect(parseSearchDSL('prepare slides #q3-goals')).toEqual({
      text: 'prepare slides',
      tag: 'q3-goals',
    });

    expect(parseSearchDSL('tag:billing invoice customer')).toEqual({
      text: 'invoice customer',
      tag: 'billing',
    });
  });

  it('extracts status:done and status:todo operators', () => {
    expect(parseSearchDSL('status:done report')).toEqual({
      text: 'report',
      status: 'done',
    });

    expect(parseSearchDSL('status:todo audit')).toEqual({
      text: 'audit',
      status: 'todo',
    });

    expect(parseSearchDSL('status:completed sprint review')).toEqual({
      text: 'sprint review',
      status: 'done',
    });
  });

  it('extracts is:overdue, is:pinned, and is:recurring flags', () => {
    expect(parseSearchDSL('is:overdue')).toEqual({
      text: '',
      isOverdue: true,
    });

    expect(parseSearchDSL('is:pinned finish design')).toEqual({
      text: 'finish design',
      isPinned: true,
    });

    expect(parseSearchDSL('team sync is:recurring')).toEqual({
      text: 'team sync',
      isRecurring: true,
    });
  });

  it('handles multi-operator composite queries', () => {
    const res = parseSearchDSL('p:p1 @deepwork #v2 is:pinned optimize db latency');
    expect(res).toEqual({
      text: 'optimize db latency',
      priority: 'p1',
      contextTag: 'deepwork',
      tag: 'v2',
      isPinned: true,
    });
  });

  it('handles empty or pure text queries cleanly', () => {
    expect(parseSearchDSL('')).toEqual({ text: '' });
    expect(parseSearchDSL('just simple keywords')).toEqual({ text: 'just simple keywords' });
  });
});
