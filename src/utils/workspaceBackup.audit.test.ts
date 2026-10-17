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
  const backup = createWorkspaceBackup(record);
  expect(backup.schemaVersion).toBe(5);
  expect(backup.dashboards).toHaveLength(4);
  expect(backup.preferences).toEqual({
    scratchpad: "Saved thought",
    focusLogs: [],
  });
  expect(backup).not.toHaveProperty("pending");
  expect(backup).not.toHaveProperty("undo");
  expect(validateBackupExtras(backup)?.dashboards).toHaveLength(4);
});
