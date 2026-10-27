import { useMemo, useContext } from 'react';
import type { Goal } from '../types/goal';
import { useTaskContext } from '../context/TaskContext';
import {
  WorkspaceStoreContext,
  useWorkspaceSelector,
} from '../services/workspaceStore';
import { useTodayStr } from './useCurrentDate';
import { isTodayTask } from '../utils/taskSelectors';

export interface GoalMetric {
  goal: Goal;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
}

export interface TodayAlignmentMetrics {
  totalTodayTasks: number;
  alignedTodayTasks: number;
  alignmentPercent: number;
  topAlignedGoals: Goal[];
}

export function useGoalAlignment() {
  const { tasks, projects } = useTaskContext();
  const store = useContext(WorkspaceStoreContext);
  const workspaceGoals = useWorkspaceSelector((s) => s?.record?.goals);
  const todayStr = useTodayStr();

  const goals: Goal[] = useMemo(() => {
    if (store && workspaceGoals) {
      return (workspaceGoals as Goal[]).filter((g) => !g.archivedAt);
    }
    return [];
  }, [store, workspaceGoals]);

  // Map each goal to its metrics
  const { goalMetricsMap, projectToGoalMap, taskToGoalMap } = useMemo(() => {
    const metricsMap = new Map<string, GoalMetric>();
    const projMap = new Map<string, Goal>();
    const tMap = new Map<string, Goal>();

    goals.forEach((g) => {
      (g.projectIds || []).forEach((pId) => {
        projMap.set(pId, g);
      });
    });

    goals.forEach((g) => {
      const projectSet = new Set(g.projectIds || []);
      const linked = tasks.filter(
        (t) =>
          !t.deletedAt &&
          !t.archivedAt &&
          (t.goalId === g.id || (t.projectId && projectSet.has(t.projectId)))
      );
      const done = linked.filter((t) => t.status === 'done');
      const progress =
        linked.length > 0 ? Math.round((done.length / linked.length) * 100) : 0;

      metricsMap.set(g.id, {
        goal: g,
        totalTasks: linked.length,
        completedTasks: done.length,
        progressPercent: progress,
      });

      linked.forEach((t) => {
        tMap.set(t.id, g);
      });
    });

    return {
      goalMetricsMap: metricsMap,
      projectToGoalMap: projMap,
      taskToGoalMap: tMap,
    };
  }, [goals, tasks]);

  // Calculate Today's Strategic Alignment
  const todayAlignment: TodayAlignmentMetrics = useMemo(() => {
    const todayTasks = tasks.filter(
      (t) =>
        !t.deletedAt &&
        !t.archivedAt &&
        isTodayTask(t, todayStr, { tasks, projects })
    );

    let alignedCount = 0;
    const alignedGoalsSet = new Set<Goal>();

    todayTasks.forEach((t) => {
      const parentGoal = taskToGoalMap.get(t.id);
      if (parentGoal) {
        alignedCount++;
        alignedGoalsSet.add(parentGoal);
      }
    });

    const percent =
      todayTasks.length > 0
        ? Math.round((alignedCount / todayTasks.length) * 100)
        : 100;

    return {
      totalTodayTasks: todayTasks.length,
      alignedTodayTasks: alignedCount,
      alignmentPercent: percent,
      topAlignedGoals: Array.from(alignedGoalsSet),
    };
  }, [tasks, projects, todayStr, taskToGoalMap]);

  return {
    goals,
    goalMetricsMap,
    projectToGoalMap,
    taskToGoalMap,
    todayAlignment,
  };
}
