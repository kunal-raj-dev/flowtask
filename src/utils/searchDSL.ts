import type { Priority } from '../types/task';

export interface ParsedQueryDSL {
  text: string;
  priority?: Priority;
  contextTag?: string;
  tag?: string;
  status?: 'todo' | 'done';
  isOverdue?: boolean;
  isPinned?: boolean;
  isRecurring?: boolean;
}

/**
 * Parses user input for DSL operators:
 * - Priority: p:p1, p:p2, p:1, priority:p1, priority:high, urgent
 * - Context: @context, context:calls
 * - Tag: #tag, tag:work
 * - Status: status:done, status:completed, status:todo, status:open
 * - Boolean flags: is:overdue, is:pinned, is:recurring
 * - Text: remainder after operators stripped
 */
export const parseSearchDSL = (rawQuery: string): ParsedQueryDSL => {
  let q = rawQuery;
  const result: ParsedQueryDSL = { text: '' };

  // 1. Priority: p:p1, p:p2, p:1, priority:p1, priority:high, etc.
  const pMatch = q.match(/\b(?:p|priority):(p[1-4]|[1-4]|high|medium|low|urgent)\b/i);
  if (pMatch) {
    const val = pMatch[1].toLowerCase();
    if (val === 'p1' || val === '1' || val === 'urgent') result.priority = 'p1';
    else if (val === 'p2' || val === '2' || val === 'high') result.priority = 'p2';
    else if (val === 'p3' || val === '3' || val === 'medium') result.priority = 'p3';
    else if (val === 'p4' || val === '4' || val === 'low') result.priority = 'p4';
    q = q.replace(pMatch[0], '');
  }

  // 2. Context: @context or context:val
  const ctxMatch = q.match(/(?:@|context:)([a-zA-Z0-9_\-]+)/i);
  if (ctxMatch) {
    result.contextTag = ctxMatch[1].toLowerCase();
    q = q.replace(ctxMatch[0], '');
  }

  // 3. Tag: #tag or tag:val
  const tagMatch = q.match(/(?:#|tag:)([a-zA-Z0-9_\-]+)/i);
  if (tagMatch) {
    result.tag = tagMatch[1].toLowerCase();
    q = q.replace(tagMatch[0], '');
  }

  // 4. Status: status:done, status:completed, status:todo, status:open
  const statusMatch = q.match(/\bstatus:(done|completed|todo|open)\b/i);
  if (statusMatch) {
    const val = statusMatch[1].toLowerCase();
    result.status = val === 'done' || val === 'completed' ? 'done' : 'todo';
    q = q.replace(statusMatch[0], '');
  }

  // 5. is:overdue, is:pinned, is:recurring
  if (/\bis:overdue\b/i.test(q)) {
    result.isOverdue = true;
    q = q.replace(/\bis:overdue\b/i, '');
  }

  if (/\bis:pinned\b/i.test(q)) {
    result.isPinned = true;
    q = q.replace(/\bis:pinned\b/i, '');
  }

  if (/\bis:recurring\b/i.test(q)) {
    result.isRecurring = true;
    q = q.replace(/\bis:recurring\b/i, '');
  }

  result.text = q.replace(/\s+/g, ' ').trim();
  return result;
};
