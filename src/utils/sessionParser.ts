import type { TargetDifficulty, SubTask, Task, SessionMetadata } from '../types/task';

export interface ParsedSessionTarget {
  id: string;
  problemNumber?: number | string;
  difficulty?: TargetDifficulty;
  title: string;
  url?: string;
  tags?: string[];
  estimatedMinutes?: number;
}

export interface ParsedSession {
  id: string;
  sessionNumber?: number;
  sessionTopic: string;
  rawHeader?: string;
  startTime?: string; // HH:mm (24h)
  endTime?: string;   // HH:mm (24h)
  durationMinutes?: number;
  targets: ParsedSessionTarget[];
  targetPacingMinutes?: number;
  targetUnit?: string;
  secondaryMilestone?: string;
  contingencyGoal?: string;
  rawText: string;
}

/**
 * Normalizes strings like "8:30 am", "11:30 am", "2:30 pm", "14:00" to "HH:mm" (24h)
 */
export function normalizeTimeTo24h(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();

  // Match e.g. "8:30 am", "11:30am", "2:30 pm", "12 pm", "8 am"
  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3] === 'pm';

    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // Match e.g. "08:30", "14:30"
  const standardMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (standardMatch) {
    const hour = parseInt(standardMatch[1], 10);
    const minute = parseInt(standardMatch[2], 10);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Calculate duration in minutes between "HH:mm" and "HH:mm"
 */
export function calculateDurationMinutes(startHHmm: string, endHHmm: string): number {
  const [sH, sM] = startHHmm.split(':').map(Number);
  const [eH, eM] = endHHmm.split(':').map(Number);

  let startTotal = sH * 60 + sM;
  let endTotal = eH * 60 + eM;

  if (endTotal < startTotal) {
    // Crosses midnight
    endTotal += 24 * 60;
  }

  return Math.max(0, endTotal - startTotal);
}

/**
 * Parses a single line representing a target question, module, or task.
 * Handles messy LeetCode web copy-pastes, standard numbered lists, and generic targets.
 */
export function parseTargetLine(line: string, index = 0): ParsedSessionTarget | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Ignore Discord timestamps, dates, greetings, or study headers
  if (
    /^(?:start|end)\s+(?:study|work|session|day)/i.test(trimmed) ||
    /^(?:today|daily)\s*(?:plan|schedule|goals)/i.test(trimmed) ||
    /^(?:[a-zA-Z0-9_]+\s+\d{1,2}\/\d{1,2}\/\d{2,4}|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})/i.test(
      trimmed
    ) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(trimmed)
  ) {
    return null;
  }

  // Strip leading bullets, numbers, checkboxes, "target questions ->", "target ->"
  const cleanLine = trimmed
    .replace(/^target\s*(?:questions)?\s*->\s*/i, '')
    .replace(/^[-*•]\s*/, '')
    .trim();

  if (!cleanLine) return null;

  // 1. Check for URL anywhere in the line
  const urlMatch = cleanLine.match(/(https?:\/\/[^\s]+)/i);
  let rawUrl = urlMatch ? urlMatch[1] : undefined;
  if (rawUrl) {
    rawUrl = rawUrl.replace(/[,.)]+$/, '');
  }

  let difficulty: TargetDifficulty | undefined;
  let problemNumber: number | string | undefined;
  let title = '';
  let tags: string[] = [];

  // 2. LeetCode / Question pattern detection
  // Case A: Compact LeetCode copy: "7 HARDMedian of Two Sorted Arrays69.40.00...https://... Two Pointers"
  // Case B: "15 MEDIUM Container With Most Water..."
  // Case C: "3. Longest Substring - https://..."
  const leetcodeCompactRegex = /^(\d+)?\s*(HARD|MEDIUM|EASY)\s*(.+)$/i;
  const match = cleanLine.match(leetcodeCompactRegex);

  if (match) {
    problemNumber = match[1] ? match[1] : undefined;
    difficulty = match[2].toUpperCase() as TargetDifficulty;
    let rest = match[3];

    // If there is a URL, split text before URL and after URL
    if (rawUrl) {
      const urlIdx = rest.indexOf(rawUrl);
      const beforeUrl = rest.substring(0, urlIdx).trim();
      const afterUrl = rest.substring(urlIdx + rawUrl.length).trim();

      // Clean LeetCode acceptance rate number glued to title: e.g. "Median of Two Sorted Arrays69.40.004736972853624943"
      // Match title followed by numeric garbage at the end
      const titleCleaned = beforeUrl.replace(/\d{2,}\.?\d*.*$/, '').trim();
      title = titleCleaned || beforeUrl;

      // The part after URL often contains topic tags: "Divide and Conquer", "Array, Two Pointers, Sorting"
      if (afterUrl) {
        tags = afterUrl
          .split(/[,•|]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && !t.startsWith('http'));
      }
    } else {
      // No URL, just clean trailing numbers/tags if present
      title = rest.trim();
    }
  } else {
    // Non-LeetCode target or standard target:
    // e.g. "Day 25 -> Javascript complete module" or "1. Build auth API"
    if (rawUrl) {
      const urlIdx = cleanLine.indexOf(rawUrl);
      const beforeUrl = cleanLine.substring(0, urlIdx).trim();
      const afterUrl = cleanLine.substring(urlIdx + rawUrl.length).trim();

      // Extract problem number if line starts with digits
      const numMatch = beforeUrl.match(/^(\d+)[\.\)]?\s*(.*)$/);
      if (numMatch) {
        problemNumber = numMatch[1];
        title = numMatch[2] || beforeUrl;
      } else {
        title = beforeUrl;
      }

      if (afterUrl) {
        tags = afterUrl
          .split(/[,•|]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0 && !t.startsWith('http'));
      }
    } else {
      // General target (e.g. "Day 25 -> Javascript complete module")
      title = cleanLine;
      const numMatch = cleanLine.match(/^(\d+)[\.\)]?\s*(.*)$/);
      if (numMatch) {
        problemNumber = numMatch[1];
        title = numMatch[2] || cleanLine;
      }
    }
  }

  // Fallback title if empty
  if (!title.trim()) {
    title = cleanLine;
  }

  // Format clean problem display if problem number exists
  const finalTitle = problemNumber && !title.startsWith('#')
    ? `#${problemNumber} ${title.trim()}`
    : title.trim();

  return {
    id: `target-${index}-${Date.now().toString(36)}`,
    problemNumber,
    difficulty,
    title: finalTitle,
    url: rawUrl,
    tags: tags.length > 0 ? tags : undefined,
  };
}

/**
 * Parses raw text into one or more structured Study/Focus Sessions.
 */
export function parseStudySessions(rawText: string): ParsedSession[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n').map((l) => l.trim());
  const sessions: ParsedSession[] = [];

  let currentSession: Partial<ParsedSession> | null = null;
  let currentSessionRawLines: string[] = [];
  let sessionCounter = 0;

  const flushCurrentSession = () => {
    if (
      currentSession &&
      currentSession.targets &&
      currentSession.targets.length > 0
    ) {
      const targets = currentSession.targets;
      const duration = currentSession.durationMinutes || 0;

      // Auto-calculate pacing if not explicitly defined
      let pacing = currentSession.targetPacingMinutes;
      if (!pacing && targets.length > 0 && duration > 0) {
        pacing = Math.round(duration / targets.length);
      }

      // Assign estimates to targets if pacing is known
      if (pacing && pacing > 0) {
        targets.forEach((t) => {
          if (!t.estimatedMinutes) t.estimatedMinutes = pacing;
        });
      }

      sessions.push({
        id: `session-${currentSession.sessionNumber || ++sessionCounter}-${Date.now().toString(36)}`,
        sessionNumber: currentSession.sessionNumber || sessionCounter,
        sessionTopic: currentSession.sessionTopic || 'Focus & Study Session',
        rawHeader: currentSession.rawHeader,
        startTime: currentSession.startTime,
        endTime: currentSession.endTime,
        durationMinutes: duration,
        targets,
        targetPacingMinutes: pacing,
        targetUnit: currentSession.targetUnit || 'Q',
        secondaryMilestone: currentSession.secondaryMilestone,
        contingencyGoal: currentSession.contingencyGoal,
        rawText: currentSessionRawLines.join('\n'),
      });
    }
    currentSession = null;
    currentSessionRawLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect Session Header: e.g. "Session 01 - Time => 8:30 am to 11:30 am" or "Session 2: 12pm - 2:30pm"
    const sessionHeaderRegex = /^Session\s*(\d+)?\s*[-–:]?\s*(?:Time\s*=>\s*)?([0-9:\sapmAPM]+(?:to|-)[0-9:\sapmAPM]+)?/i;
    const isExplicitHeader = sessionHeaderRegex.test(line);
    const isDivider = /^-{4,}$/.test(line);

    if (isExplicitHeader) {
      flushCurrentSession();

      const match = line.match(sessionHeaderRegex);
      const sNum = match && match[1] ? parseInt(match[1], 10) : ++sessionCounter;
      sessionCounter = sNum;

      let startTime: string | undefined;
      let endTime: string | undefined;
      let duration: number | undefined;

      // Extract time range (e.g. "8:30 am to 11:30 am" or "12:00 pm to 2:30 pm")
      const timeRangeMatch = line.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeRangeMatch) {
        const startNorm = normalizeTimeTo24h(timeRangeMatch[1]);
        const endNorm = normalizeTimeTo24h(timeRangeMatch[2]);
        if (startNorm && endNorm) {
          startTime = startNorm;
          endTime = endNorm;
          duration = calculateDurationMinutes(startNorm, endNorm);
        }
      }

      currentSession = {
        sessionNumber: sNum,
        rawHeader: line,
        startTime,
        endTime,
        durationMinutes: duration,
        targets: [],
      };
      currentSessionRawLines.push(line);
      continue;
    }

    if (isDivider) {
      // Visual separator line
      if (currentSession) currentSessionRawLines.push(line);
      continue;
    }

    // 1. Task/Subject Line: "task -> DSA question practise" or "task: Web development"
    const taskMatch = line.match(/^(?:task|topic|subject)\s*(?:->|:)\s*(.+)$/i);
    if (taskMatch) {
      if (!currentSession) {
        sessionCounter++;
        currentSession = {
          sessionNumber: sessionCounter,
          targets: [],
        };
      }
      currentSession.sessionTopic = taskMatch[1].trim();
      currentSessionRawLines.push(line);
      continue;
    }

    // 2. Pacing calculation line: "180 minutes / 6 questions => 30 mins/Q"
    const pacingMatch = line.match(/(\d+)\s*(?:minutes|mins|m)?\s*\/\s*(\d+)\s*(?:questions|items|tasks|q)?\s*=>\s*(\d+(?:\.\d+)?)\s*(?:mins?|m)?(?:\/([a-zA-Z]+))?/i);
    if (pacingMatch) {
      if (currentSession) {
        currentSession.targetPacingMinutes = Math.round(parseFloat(pacingMatch[3]));
        if (pacingMatch[4]) {
          currentSession.targetUnit = pacingMatch[4].trim();
        }
        currentSessionRawLines.push(line);
      }
      continue;
    }

    // 3. Secondary Milestone: "finishing it then move to game activity"
    if (/^(?:finishing\s+it\s+)?then\s+move\s+to\s+(.+)$/i.test(line)) {
      if (currentSession) {
        currentSession.secondaryMilestone = line.replace(/^(?:finishing\s+it\s+)?then\s+move\s+to\s+/i, '').trim();
        currentSessionRawLines.push(line);
      }
      continue;
    }

    // 4. Contingency Goal: "revision if possible starting from js after both done"
    if (/^revision\s+if\s+possible/i.test(line) || /^stretch\s*goal[:\s]/i.test(line)) {
      if (currentSession) {
        currentSession.contingencyGoal = line.trim();
        currentSessionRawLines.push(line);
      }
      continue;
    }

    // 5. Target item or LeetCode question
    const target = parseTargetLine(line, (currentSession?.targets?.length || 0));
    if (target) {
      if (!currentSession) {
        if (target.difficulty || target.url || target.problemNumber) {
          sessionCounter++;
          currentSession = {
            sessionNumber: sessionCounter,
            sessionTopic: 'Focus & Study Session',
            targets: [],
          };
        } else {
          continue;
        }
      }
      currentSession.targets = currentSession.targets || [];
      currentSession.targets.push(target);
      currentSessionRawLines.push(line);
    }
  }

  flushCurrentSession();
  return sessions;
}

/**
 * Converts a ParsedSession into a fully compliant FlowTask Task object ready to be stored in TaskContext.
 */
export function convertSessionToTask(
  session: ParsedSession,
  dueDateStr?: string,
  projectId = 'work'
): Task {
  const subtasks: SubTask[] = session.targets.map((t, idx) => ({
    id: `sub-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: t.title,
    completed: false,
    estimatedMinutes: t.estimatedMinutes || session.targetPacingMinutes || 30,
    url: t.url,
    difficulty: t.difficulty,
    tags: t.tags,
    problemNumber: t.problemNumber,
  }));

  const sessionMetadata: SessionMetadata = {
    isSession: true,
    sessionNumber: session.sessionNumber,
    sessionTopic: session.sessionTopic,
    focusArea: session.sessionTopic,
    targetCount: session.targets.length,
    targetPacingMinutes: session.targetPacingMinutes,
    pacingMinutesPerQuestion: session.targetPacingMinutes,
    targetUnit: session.targetUnit || 'Q',
    secondaryMilestone: session.secondaryMilestone,
    contingencyGoal: session.contingencyGoal,
  };

  const title = `Session ${String(session.sessionNumber || 1).padStart(2, '0')}: ${session.sessionTopic}`;

  let description = '';
  if (session.secondaryMilestone) {
    description += `**Secondary Milestone**: ${session.secondaryMilestone}\n\n`;
  }
  if (session.contingencyGoal) {
    description += `**Contingency Goal**: ${session.contingencyGoal}\n\n`;
  }
  if (session.targetPacingMinutes) {
    description += `**Pacing**: ${session.targetPacingMinutes} mins/${session.targetUnit || 'Q'}\n`;
  }

  return {
    id: `task-session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    description: description.trim() || undefined,
    status: 'todo',
    priority: 'p1', // Study sessions are prime daily focus
    projectId,
    dueDate: dueDateStr,
    dueTime: session.endTime,
    scheduledStart: session.startTime,
    scheduledEnd: session.endTime,
    estimatedMinutes: session.durationMinutes || (subtasks.length * (session.targetPacingMinutes || 30)),
    timeSpentMinutes: 0,
    subtasks,
    isPinnedToday: true,
    sessionMetadata,
    createdAt: Date.now(),
  };
}
