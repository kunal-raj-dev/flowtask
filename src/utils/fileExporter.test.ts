import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportToCSV,
  exportToJSON,
  exportToMarkdown,
  downloadFile,
  downloadJson,
  downloadCsv,
  downloadMarkdown,
} from './fileExporter';
import type { Task, Project } from '../types/task';

describe('fileExporter Utility', () => {
  const mockProjects: Project[] = [
    { id: 'inbox', name: 'Inbox', color: '#6366f1' },
    { id: 'work', name: 'Work Project', color: '#3b82f6' },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Finish API Docs',
      status: 'done',
      priority: 'p1',
      projectId: 'work',
      dueDate: '2026-10-16',
      estimatedMinutes: 45,
      timeSpentMinutes: 50,
      tags: ['api', 'v1'],
      subtasks: [
        { id: 'sub-1', title: 'Write auth section', completed: true },
        { id: 'sub-2', title: 'Add schema examples', completed: false },
      ],
      createdAt: 1700000000000,
      completedAt: 1700003600000,
    },
    {
      id: 'task-2',
      title: '=HYPERLINK("http://attacker.com")',
      status: 'todo',
      priority: 'p3',
      projectId: 'inbox',
      subtasks: [],
      createdAt: 1700000000000,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportToCSV', () => {
    it('produces RFC-4180 compliant CSV headers and rows', () => {
      const csv = exportToCSV(mockTasks, mockProjects);
      expect(csv).toContain('ID,Title,Status,Priority,Project');
      expect(csv).toContain('task-1');
      expect(csv).toContain('Finish API Docs');
      expect(csv).toContain('Work Project');
    });

    it('neutralizes CSV formula injection attacks by prepending single quotes', () => {
      const csv = exportToCSV(mockTasks, mockProjects);
      expect(csv).toContain("=HYPERLINK");
      expect(csv).toContain("'=");
    });
  });

  describe('exportToJSON', () => {
    it('serializes tasks and projects with metadata', () => {
      const raw = exportToJSON(mockTasks, mockProjects, 2);
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe(2);
      expect(parsed.tasks).toHaveLength(2);
      expect(parsed.projects).toHaveLength(2);
      expect(parsed.exportedAt).toBeDefined();
    });
  });

  describe('exportToMarkdown', () => {
    it('groups tasks by project and formats checklists', () => {
      const md = exportToMarkdown(mockTasks, mockProjects);
      expect(md).toContain('# FlowTask Export');
      expect(md).toContain('## Work Project');
      expect(md).toContain('- [x] **Finish API Docs** *(Priority: P1, Due: 2026-10-16, ~45m)*');
      expect(md).toContain('  - [x] Write auth section');
      expect(md).toContain('  - [ ] Add schema examples');
      expect(md).toContain('## Inbox');
    });
  });

  describe('download utilities', () => {
    it('downloadFile invokes document.createElement and trigger click', () => {
      const mockClick = vi.fn();
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();

      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: mockClick,
      } as any);

      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();

      downloadFile('test content', 'test.txt', 'text/plain');
      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();

      downloadJson({ key: 'value' }, 'test.json');
      expect(mockClick).toHaveBeenCalledTimes(2);

      downloadCsv('a,b,c', 'test.csv');
      expect(mockClick).toHaveBeenCalledTimes(3);

      downloadMarkdown('# Heading', 'test.md');
      expect(mockClick).toHaveBeenCalledTimes(4);
    });
  });
});
