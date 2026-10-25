import type { Task, Priority } from '../types/task';

export interface CSVParseResult {
  tasks: Array<Partial<Task> & { title: string }>;
  unmappedHeaders: string[];
  totalRows: number;
  errors: string[];
}

export interface MarkdownParseResult {
  notes: Array<{ title: string; body: string; tags?: string[] }>;
  errors: string[];
}

/**
 * Robust CSV Line Parser supporting RFC 4180 quotes, escaped quotes, and commas.
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSVRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function parseCSVDate(raw: string): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const s = raw.trim();

  // 1. Matches YYYY-MM-DD
  const isoMatch = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // 2. Matches YYYY/MM/DD
  const slashYMD = s.match(/\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/);
  if (slashYMD) {
    const m = slashYMD[2].padStart(2, '0');
    const d = slashYMD[3].padStart(2, '0');
    return `${slashYMD[1]}-${m}-${d}`;
  }

  // 3. Matches MM/DD/YYYY or M/D/YYYY
  const slashMDY = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMDY) {
    const m = slashMDY[1].padStart(2, '0');
    const d = slashMDY[2].padStart(2, '0');
    return `${slashMDY[3]}-${m}-${d}`;
  }

  // 4. Matches DD-MM-YYYY
  const dashDMY = s.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/);
  if (dashDMY) {
    const d = dashDMY[1].padStart(2, '0');
    const m = dashDMY[2].padStart(2, '0');
    return `${dashDMY[3]}-${m}-${d}`;
  }

  // 5. Fallback via Date.parse
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return undefined;
}

export function parseCSVToTasks(csvText: string): CSVParseResult {
  const allRows = parseCSVRows(csvText);

  if (allRows.length === 0) {
    return { tasks: [], unmappedHeaders: [], totalRows: 0, errors: ['CSV file is empty.'] };
  }

  const rawHeaders = allRows[0];
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const unmappedHeaders: string[] = [];

  const isTodoist = headers.includes('content') && (headers.includes('indent') || headers.includes('datelang') || headers.includes('author'));
  const isTickTick = headers.includes('listname') || headers.includes('foldername') || (headers.includes('title') && headers.includes('content'));

  // Determine column indexes
  let titleIdx = -1;
  let descIdx = -1;
  let priorityIdx = -1;
  let dueIdx = -1;
  let plannedIdx = -1;
  let estimateIdx = -1;
  let statusIdx = -1;
  let tagsIdx = -1;

  rawHeaders.forEach((originalHeader, idx) => {
    const h = headers[idx];
    if (['title', 'name', 'task', 'summary', 'cardname'].includes(h) || (!isTickTick && h === 'content')) {
      if (titleIdx === -1) titleIdx = idx;
    } else if (['description', 'notes', 'details', 'memo', 'carddescription'].includes(h) || (isTickTick && h === 'content')) {
      if (descIdx === -1) descIdx = idx;
    } else if (['priority', 'p', 'urgency'].includes(h)) {
      if (priorityIdx === -1) priorityIdx = idx;
    } else if (['due', 'duedate', 'deadline', 'date'].includes(h)) {
      if (dueIdx === -1) dueIdx = idx;
    } else if (['planned', 'planneddate', 'schedule', 'scheduledate', 'when', 'startdate'].includes(h)) {
      if (plannedIdx === -1) plannedIdx = idx;
    } else if (['estimate', 'estimatedminutes', 'minutes', 'duration'].includes(h)) {
      if (estimateIdx === -1) estimateIdx = idx;
    } else if (['status', 'completed', 'done', 'state'].includes(h)) {
      if (statusIdx === -1) statusIdx = idx;
    } else if (['tags', 'tag', 'context', 'labels'].includes(h)) {
      if (tagsIdx === -1) tagsIdx = idx;
    } else {
      unmappedHeaders.push(originalHeader);
    }
  });

  if (titleIdx === -1) {
    return {
      tasks: [],
      unmappedHeaders,
      totalRows: allRows.length - 1,
      errors: ['No title or task name column recognized in CSV headers.'],
    };
  }

  const tasks: Array<Partial<Task> & { title: string }> = [];
  const errors: string[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    const title = row[titleIdx]?.trim();
    if (!title) continue;

    const task: Partial<Task> & { title: string } = {
      title,
    };

    if (descIdx !== -1 && row[descIdx]) {
      task.description = row[descIdx];
    }

    if (priorityIdx !== -1 && row[priorityIdx]) {
      const p = row[priorityIdx].toLowerCase().trim();
      if (isTodoist) {
        if (p === '4') task.priority = 'p1';
        else if (p === '3') task.priority = 'p2';
        else if (p === '2') task.priority = 'p3';
        else task.priority = 'p4';
      } else if (isTickTick) {
        if (p === '5') task.priority = 'p1';
        else if (p === '3') task.priority = 'p2';
        else if (p === '1') task.priority = 'p3';
        else task.priority = 'p4';
      } else {
        if (p.includes('1') || p.includes('high') || p === 'urgent') task.priority = 'p1' as Priority;
        else if (p.includes('2') || p.includes('med')) task.priority = 'p2' as Priority;
        else if (p.includes('3') || p.includes('low')) task.priority = 'p3' as Priority;
        else task.priority = 'p4' as Priority;
      }
    }

    if (dueIdx !== -1 && row[dueIdx]) {
      const parsedDate = parseCSVDate(row[dueIdx]);
      if (parsedDate) task.dueDate = parsedDate;
    }

    if (plannedIdx !== -1 && row[plannedIdx]) {
      const parsedDate = parseCSVDate(row[plannedIdx]);
      if (parsedDate) task.plannedDate = parsedDate;
    }

    if (estimateIdx !== -1 && row[estimateIdx]) {
      const num = parseInt(row[estimateIdx], 10);
      if (!isNaN(num) && num > 0) task.estimatedMinutes = num;
    }

    if (statusIdx !== -1 && row[statusIdx]) {
      const s = row[statusIdx].toLowerCase();
      if (s === 'done' || s === 'completed' || s === 'true' || s === 'yes') {
        task.status = 'done';
      } else {
        task.status = 'todo';
      }
    }

    if (tagsIdx !== -1 && row[tagsIdx]) {
      task.tags = row[tagsIdx]
        .split(/[;,]/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
    }

    tasks.push(task);
  }

  return {
    tasks,
    unmappedHeaders,
    totalRows: allRows.length - 1,
    errors,
  };
}

export function parseMarkdownToNotes(markdownText: string): MarkdownParseResult {
  const content = markdownText.trim();
  if (!content) {
    return { notes: [], errors: ['Markdown content is empty.'] };
  }

  // Check if content has multiple notes separated by horizontal rules '---'
  const sections = content
    .split(/\n---\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const notes: Array<{ title: string; body: string; tags?: string[] }> = [];

  for (const sec of sections) {
    const lines = sec.split('\n');
    let title = 'Untitled Note';
    let bodyStartIndex = 0;

    // Check if first non-empty line is a heading # Title
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      if (!line) continue;
      if (line.startsWith('#')) {
        title = line.replace(/^#+\s*/, '').trim();
        bodyStartIndex = idx + 1;
      } else {
        title = line.slice(0, 50);
        bodyStartIndex = idx + 1;
      }
      break;
    }

    const body = lines.slice(bodyStartIndex).join('\n').trim();

    // Extract #tags
    const tagMatches = body.match(/#([a-zA-Z0-9_-]+)/g);
    const tags = tagMatches ? [...new Set(tagMatches.map((t) => t.slice(1)))] : undefined;

    notes.push({
      title,
      body,
      tags,
    });
  }

  return {
    notes,
    errors: [],
  };
}
