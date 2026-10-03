import type { Task, Project } from '../types/task';

export interface FuzzyMatchResult {
  isMatch: boolean;
  score: number;
}

/**
 * High-performance, zero-dependency fuzzy scorer inspired by FZF and VS Code.
 * Evaluates exact substrings, word boundaries, camelCase transitions, and sequential character proximity.
 */
export function calculateFuzzyScore(query: string, target: string): FuzzyMatchResult {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();

  if (!q) {
    return { isMatch: true, score: 1 };
  }

  if (q.length > t.length) {
    return { isMatch: false, score: 0 };
  }

  // 1. Exact match bonus
  if (t === q) {
    return { isMatch: true, score: 1000 };
  }

  // 2. Exact prefix match bonus
  if (t.startsWith(q)) {
    return { isMatch: true, score: 800 + Math.round((q.length / t.length) * 100) };
  }

  // 3. Exact substring match
  const substringIndex = t.indexOf(q);
  if (substringIndex !== -1) {
    const boundaryBonus =
      substringIndex === 0 || /[\s\-_/@#]/.test(t[substringIndex - 1]) ? 300 : 150;
    return {
      isMatch: true,
      score: 500 + boundaryBonus - substringIndex * 5 + Math.round((q.length / t.length) * 50),
    };
  }

  // 4. Sequential subsequence match (FZF-style)
  let qIdx = 0;
  let tIdx = 0;
  let score = 0;
  let consecutiveMatches = 0;

  while (qIdx < q.length && tIdx < t.length) {
    const qChar = q[qIdx];
    const tChar = t[tIdx];

    if (qChar === tChar) {
      score += 20;

      // Bonus for consecutive runs
      if (consecutiveMatches > 0) {
        score += consecutiveMatches * 15;
      }
      consecutiveMatches++;

      // Word boundary bonus
      if (tIdx === 0 || /[\s\-_/@#]/.test(t[tIdx - 1])) {
        score += 40;
      }

      qIdx++;
    } else {
      consecutiveMatches = 0;
    }

    tIdx++;
  }

  // If all query characters were matched sequentially
  if (qIdx === q.length) {
    // Penalty for long trailing targets
    const lengthPenalty = Math.min(50, Math.round(((t.length - q.length) / t.length) * 30));
    return {
      isMatch: true,
      score: Math.max(10, score - lengthPenalty),
    };
  }

  // 5. Typo tolerance: if query has >= 4 chars, check Levenshtein distance on words
  if (q.length >= 4) {
    const words = t.split(/[\s\-_/]+/);
    for (const word of words) {
      if (Math.abs(word.length - q.length) <= 2) {
        const dist = levenshteinDistance(q, word.slice(0, q.length + 1));
        if (dist <= 1) {
          return { isMatch: true, score: 180 - dist * 40 };
        }
      }
    }
  }

  return { isMatch: false, score: 0 };
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

export interface FuzzySearchResult {
  task: Task;
  score: number;
  matchedField: 'title' | 'description' | 'tag' | 'context' | 'project' | 'subtask';
  projectName?: string;
}

/**
 * Searches across all task fields with weighted field prioritization:
 * Title (1.0x) > Context Tags (0.9x) > Project Name (0.8x) > Tags (0.75x) > Description (0.6x) > Subtasks (0.6x)
 */
export function searchTasksFuzzy(
  tasks: Task[],
  query: string,
  projects: Project[] = [],
  limit = 10
): FuzzySearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results: FuzzySearchResult[] = [];
  const projectMap = new Map<string, string>();
  projects.forEach((p) => projectMap.set(p.id, p.name));

  for (const task of tasks) {
    if (task.deletedAt || task.archivedAt) continue;

    const projName = projectMap.get(task.projectId);
    let bestScore = 0;
    let bestField: FuzzySearchResult['matchedField'] = 'title';

    // 1. Title match
    const titleResult = calculateFuzzyScore(trimmed, task.title);
    if (titleResult.isMatch && titleResult.score > bestScore) {
      bestScore = titleResult.score;
      bestField = 'title';
    }

    // 2. Context tags match (@deepwork, @calls)
    if (task.contextTags) {
      for (const ctx of task.contextTags) {
        const ctxResult = calculateFuzzyScore(trimmed, ctx);
        const weightedScore = Math.round(ctxResult.score * 0.9);
        if (ctxResult.isMatch && weightedScore > bestScore) {
          bestScore = weightedScore;
          bestField = 'context';
        }
      }
    }

    // 3. Project name match
    if (projName) {
      const projResult = calculateFuzzyScore(trimmed, projName);
      const weightedScore = Math.round(projResult.score * 0.85);
      if (projResult.isMatch && weightedScore > bestScore) {
        bestScore = weightedScore;
        bestField = 'project';
      }
    }

    // 4. Tags match (#marketing, #bug)
    if (task.tags) {
      for (const tag of task.tags) {
        const tagResult = calculateFuzzyScore(trimmed, tag);
        const weightedScore = Math.round(tagResult.score * 0.8);
        if (tagResult.isMatch && weightedScore > bestScore) {
          bestScore = weightedScore;
          bestField = 'tag';
        }
      }
    }

    // 5. Description match
    if (task.description) {
      const descResult = calculateFuzzyScore(trimmed, task.description);
      const weightedScore = Math.round(descResult.score * 0.6);
      if (descResult.isMatch && weightedScore > bestScore) {
        bestScore = weightedScore;
        bestField = 'description';
      }
    }

    // 6. Subtask match
    if (task.subtasks) {
      for (const sub of task.subtasks) {
        const subResult = calculateFuzzyScore(trimmed, sub.title);
        const weightedScore = Math.round(subResult.score * 0.65);
        if (subResult.isMatch && weightedScore > bestScore) {
          bestScore = weightedScore;
          bestField = 'subtask';
        }
      }
    }

    if (bestScore > 0) {
      results.push({
        task,
        score: bestScore,
        matchedField: bestField,
        projectName: projName,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}
