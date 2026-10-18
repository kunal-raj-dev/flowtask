import { expect, it } from "vitest";
import { emptyWorkspace } from "../services/dbService";
import { createWorkspaceBackup, validateBackupExtras } from "./workspaceBackup";

it("exports dashboards and useful preferences while excluding runtime state and sync internals", () => {
  const record = emptyWorkspace("account-a");
  record.preferences = {
    scratchpad: "Saved thought",
    focusLogs: [],
    focusSession: { state: "running" },
    focusCheckpointAt: 123,
    studioLastSession: {},
    _v5DashboardSeedNeeded: true,
  };
  record.projects.push({ id: 'course', name: 'Course', color: '#3B82F6', milestones: [{ id: 'm1', title: 'Revise', order: 0 }] });
  record.tasks.push({ id: 't1', title: 'Chapter one', status: 'todo', priority: 'p2', projectId: 'course', milestoneId: 'm1', subtasks: [], createdAt: 1 });
  const backup = createWorkspaceBackup(record);
  expect(backup.schemaVersion).toBe(6);
  expect(backup.dashboards).toHaveLength(4);
  expect(backup.projects.find(project => project.id === 'course')?.milestones?.[0].id).toBe('m1');
  expect(backup.tasks[0].milestoneId).toBe('m1');
  expect(backup.preferences).toEqual({
    scratchpad: "Saved thought",
    focusLogs: [],
  });
  expect(backup).not.toHaveProperty("pending");
  expect(backup).not.toHaveProperty("undo");
  expect(validateBackupExtras(backup)?.dashboards).toHaveLength(4);
});
