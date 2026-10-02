import type { Task, Priority } from '../types/task';

export interface SnapshotPayload {
  v: 1;
  title: string;
  exportedAt: number;
  tasks: Array<{
    title: string;
    priority?: Priority;
    estimatedMinutes?: number;
    dueDate?: string;
    description?: string;
    subtasks?: Array<{ id: string; title: string; completed: boolean }>;
  }>;
}

/**
 * Encodes a Unicode string to base64 safely
 */
export function safeBase64Encode(str: string): string {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
  } catch {
    return '';
  }
}

/**
 * Decodes a base64 string to a Unicode string safely
 */
export function safeBase64Decode(str: string): string {
  try {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(str), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return '';
  }
}

/**
 * Generates a self-contained, serverless share URL with embedded task payload
 */
export function generateSnapshotShareUrl(
  tasks: Task[],
  title: string = 'FlowTask Shared Tasks',
  origin?: string
): string {
  const minimalTasks = tasks.map((t) => ({
    title: t.title,
    priority: t.priority,
    estimatedMinutes: t.estimatedMinutes,
    dueDate: t.dueDate,
    description: t.description,
    subtasks: t.subtasks,
  }));

  const payload: SnapshotPayload = {
    v: 1,
    title,
    exportedAt: Date.now(),
    tasks: minimalTasks,
  };

  const encoded = safeBase64Encode(JSON.stringify(payload));
  const base = origin || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://flowtask.app');
  return `${base}#snapshot=${encoded}`;
}

/**
 * Parses and validates a snapshot payload from a URL or hash string
 */
export function parseSnapshotFromUrl(urlOrHash: string): SnapshotPayload | null {
  if (!urlOrHash) return null;

  const match = urlOrHash.match(/#snapshot=([A-Za-z0-9+/=]+)/);
  const hashVal = match ? match[1] : urlOrHash.startsWith('#snapshot=') ? urlOrHash.slice(10) : null;
  if (!hashVal) return null;

  const decoded = safeBase64Decode(hashVal);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded) as SnapshotPayload;
    if (parsed && parsed.v === 1 && typeof parsed.title === 'string' && Array.isArray(parsed.tasks)) {
      // Validate tasks
      const validTasks = parsed.tasks.filter((t) => typeof t?.title === 'string' && t.title.trim().length > 0);
      if (validTasks.length > 0) {
        return {
          ...parsed,
          tasks: validTasks,
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}
