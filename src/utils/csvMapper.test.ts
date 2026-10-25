import { describe, it, expect } from 'vitest';
import { parseCSVToTasks, parseMarkdownToNotes, parseCSVLine } from './csvMapper';

describe('csvMapper', () => {
  it('parses CSV line with quotes and commas', () => {
    const line = '"Task with, comma",high,2026-10-31,"Note with ""escaped"" quote"';
    const parsed = parseCSVLine(line);
    expect(parsed).toEqual([
      'Task with, comma',
      'high',
      '2026-10-31',
      'Note with "escaped" quote',
    ]);
  });

  it('maps CSV columns to task fields and reports unmapped headers', () => {
    const csv = `Title,Priority,Due Date,Estimate,Notes,CustomField
Prepare presentation,High,2026-10-30,45,Draft slides for team,Random data
Buy groceries,low,2026-10-27,20,Milk and fruit,Ignore`;

    const result = parseCSVToTasks(csv);
    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(2);
    expect(result.unmappedHeaders).toEqual(['CustomField']);
    expect(result.tasks).toHaveLength(2);

    expect(result.tasks[0]).toMatchObject({
      title: 'Prepare presentation',
      priority: 'p1',
      dueDate: '2026-10-30',
      estimatedMinutes: 45,
      description: 'Draft slides for team',
    });

    expect(result.tasks[1]).toMatchObject({
      title: 'Buy groceries',
      priority: 'p3',
      dueDate: '2026-10-27',
      estimatedMinutes: 20,
      description: 'Milk and fruit',
    });
  });

  it('reports error when title column is missing', () => {
    const csv = `Priority,Due Date
High,2026-10-30`;
    const result = parseCSVToTasks(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.tasks).toHaveLength(0);
  });

  it('parses markdown text into structured notes', () => {
    const md = `# Project Strategy
Here is the core roadmap for Q4 #planning #strategy.

- Step 1: Initial research
- Step 2: Architecture
---
# Meeting Notes
Discussion with engineering lead regarding deadlines.`;

    const result = parseMarkdownToNotes(md);
    expect(result.errors).toEqual([]);
    expect(result.notes).toHaveLength(2);

    expect(result.notes[0].title).toBe('Project Strategy');
    expect(result.notes[0].body).toContain('Here is the core roadmap');
    expect(result.notes[1].title).toBe('Meeting Notes');
    expect(result.notes[1].body).toContain('Discussion with engineering lead');
  });

  it('handles multi-line quoted fields without corrupting row boundaries (RFC 4180)', () => {
    const csv = `Title,Description,Priority
"Quarterly Review","Line 1: Summary
Line 2: Financials
Line 3: Outlook",High
"Single line task","Just a note",p2`;

    const result = parseCSVToTasks(csv);
    expect(result.errors).toEqual([]);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].title).toBe('Quarterly Review');
    expect(result.tasks[0].description).toBe('Line 1: Summary\nLine 2: Financials\nLine 3: Outlook');
    expect(result.tasks[0].priority).toBe('p1');
    expect(result.tasks[1].title).toBe('Single line task');
    expect(result.tasks[1].description).toBe('Just a note');
  });

  it('correctly parses varied date formats (slash, dash, ISO)', () => {
    const csv = `Title,Due Date,Planned Date
Task 1,10/25/2026,2026/11/05
Task 2,25-10-2026,2026-12-01T09:00:00Z`;

    const result = parseCSVToTasks(csv);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].dueDate).toBe('2026-10-25');
    expect(result.tasks[0].plannedDate).toBe('2026-11-05');
    expect(result.tasks[1].dueDate).toBe('2026-10-25');
    expect(result.tasks[1].plannedDate).toBe('2026-12-01');
  });

  it('maps Todoist CSV with inverted priority (4 = p1, 1 = p4)', () => {
    const todoistCsv = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE
task,Urgent Todoist Task,Important details,4,1,user,user,2026-10-30 10:00,en,UTC
task,Normal Todoist Task,Casual thought,1,1,user,user,,en,UTC`;

    const result = parseCSVToTasks(todoistCsv);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].title).toBe('Urgent Todoist Task');
    expect(result.tasks[0].description).toBe('Important details');
    expect(result.tasks[0].priority).toBe('p1');
    expect(result.tasks[0].dueDate).toBe('2026-10-30');

    expect(result.tasks[1].title).toBe('Normal Todoist Task');
    expect(result.tasks[1].description).toBe('Casual thought');
    expect(result.tasks[1].priority).toBe('p4');
  });

  it('maps TickTick CSV where Content is description and Title is title', () => {
    const ticktickCsv = `Folder Name,List Name,Title,Tags,Content,Is Check list,Start Date,Due Date,Reminder,Repeat,Priority,Status
Work,Inbox,Prepare Q4 Budget,,Full details of budget calculations,0,,2026-11-15,,none,5,0`;

    const result = parseCSVToTasks(ticktickCsv);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Prepare Q4 Budget');
    expect(result.tasks[0].description).toBe('Full details of budget calculations');
    expect(result.tasks[0].priority).toBe('p1');
    expect(result.tasks[0].dueDate).toBe('2026-11-15');
  });
});
