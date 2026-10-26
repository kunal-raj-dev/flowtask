import { describe, expect, it, vi } from "vitest";
import { WorkspaceStore } from "./workspaceStore";
import { dbService, emptyWorkspace } from "./dbService";
import {
  createNote,
  dailyNote,
  editNote,
  importScratchpad,
  saveNoteText,
  taskFromNote,
  appendDailyNote,
  noteFromTaskDescription,
  syncLinkedTaskStatusToNote,
} from "./notesService";
import {
  findNotes,
  makeNote,
  noteReferences,
  validateNotes,
  withNoteVersion,
} from "../utils/noteModel";
import {
  createWorkspaceBackup,
  mergeBackupExtras,
  validateBackupExtras,
} from "../utils/workspaceBackup";
import { workspaceEntities } from "./workspaceEntities";
import { useTaskStore } from '../store/useTaskStore';

async function harness(connected = false) {
  let disk = emptyWorkspace("notes-test");
  const persistence = {
    ...dbService,
    ensureLegacyMigrated: async () => structuredClone(disk),
    saveWorkspace: vi.fn(async (_id: string, value: typeof disk) => {
      disk = structuredClone(value);
    }),
  };
  const store = new WorkspaceStore("notes-test", connected, persistence);
  await store.load();
  return { store, persistence, disk: () => disk };
}

describe("connected notes", () => {
  it('restores notes and source links through the existing workspace import command', async () => {
    const source = await harness();
    const note = createNote(source.store, { title: 'Restore me', body: 'Useful context' });
    const taskId = taskFromNote(source.store, note.id, 'Next action');
    const backup = createWorkspaceBackup(source.store.getSnapshot().record);
    const destination = await harness();
    useTaskStore.getState().setWorkspaceStore(destination.store);
    await useTaskStore.getState().importTasks(backup.tasks, backup.projects, true, validateBackupExtras(backup));
    expect(destination.disk().notes?.[0].id).toBe(note.id);
    expect(destination.disk().notes?.[0].linkedTasks[0].taskId).toBe(taskId);
    expect(destination.disk().tasks[0].originNoteId).toBe(note.id);
    await source.store.settled();
  });
  it("persists individual notes through the workspace and outbox", async () => {
    const { store, disk } = await harness(true);
    const note = createNote(store, { title: "Trip", body: "Book train" });
    await store.settled();
    expect(disk().notes?.[0].body).toBe("Book train");
    expect(disk().pending[0].changes[0]).toMatchObject({
      collection: "notes",
      id: note.id,
      before: null,
      after: { revision: 1 },
    });
    store.receive("notes", []);
    expect(store.getSnapshot().record.notes).toHaveLength(1);
    await store.settled();
  });
  it("keeps failed writes visible and recoverable without claiming a durable save", async () => {
    const { store, persistence } = await harness();
    persistence.saveWorkspace.mockRejectedValueOnce(new Error("quota"));
    createNote(store, { body: "Do not lose this" });
    await expect(store.settled()).rejects.toThrow(/not saved/);
    expect(store.getSnapshot().record.notes?.[0].body).toBe("Do not lose this");
    await store.retry();
    expect(store.getSnapshot().error).toBeNull();
  });
  it("does not create duplicate tasks when a selection is captured twice", async () => {
    const { store } = await harness();
    const note = createNote(store, { title: "Preparation" });
    const first = taskFromNote(store, note.id, "Read the brief tomorrow");
    const second = taskFromNote(store, note.id, "Read the brief tomorrow");
    expect(first).toBe(second);
    const record = store.getSnapshot().record;
    expect(record.tasks).toHaveLength(1);
    expect(record.tasks[0]).toMatchObject({
      originNoteId: note.id,
      title: "Read the brief tomorrow",
    });
    expect(record.tasks[0].plannedDate).toBeUndefined(); // Quoted note content is not silently reinterpreted by NLP.
    expect(record.notes?.[0].linkedTasks).toHaveLength(1);
    store.undo();
    expect(store.getSnapshot().record.tasks).toHaveLength(0);
    expect(store.getSnapshot().record.notes?.[0].linkedTasks).toHaveLength(0);
    await store.settled();
  });
  it("creates a stable daily identity and validates real calendar dates", async () => {
    const { store } = await harness();
    expect(dailyNote(store, "2026-10-25").id).toBe(
      dailyNote(store, "2026-10-25").id,
    );
    expect(() => dailyNote(store, "2026-02-30")).toThrow(/date/);
    expect(store.getSnapshot().record.notes).toHaveLength(1);
    await store.settled();
  });
  it("keeps scratchpad local until an explicit import and preserves its original", async () => {
    const { store } = await harness(true);
    store.run("Write private scratchpad", (r) => ({
      ...r,
      preferences: { ...r.preferences, scratchpad: "Private thought" },
    }));
    expect(
      workspaceEntities(store.getSnapshot().record, "preferences"),
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "scratchpad" })]),
    );
    const imported = importScratchpad(store);
    expect(importScratchpad(store).id).toBe(imported.id);
    expect(store.getSnapshot().record.preferences.scratchpad).toBe(
      "Private thought",
    );
    expect(store.getSnapshot().record.notes).toHaveLength(1);
    await store.settled();
  });
  it("preserves a competing text edit as a recovered copy", async () => {
    const { store } = await harness();
    const note = createNote(store, { title: "Draft", body: "Original" });
    editNote(store, note.id, { body: "Another device" });
    const saved = saveNoteText(
      store,
      note.id,
      "Draft",
      "My unsaved text",
      note,
    );
    expect(saved).not.toBe(note.id);
    expect(store.getSnapshot().record.notes?.map((n) => n.body)).toEqual([
      "Another device",
      "My unsaved text",
    ]);
    await store.settled();
  });
  it.each(["local", "remote"] as const)(
    "keeps both note versions when choosing %s during a cloud conflict",
    async (choice) => {
      const { store } = await harness(true);
      const remote = makeNote("Text", "Account text", {
        id: "shared-note",
        revision: 2,
      });
      store.receive("notes", [remote]);
      await store.settled();
      editNote(store, remote.id, { body: "Device text" });
      await store.settled();
      const conflict = new Error("Conflict");
      conflict.name = "SyncConflict";
      store.connect({
        apply: vi
          .fn()
          .mockRejectedValueOnce(conflict)
          .mockResolvedValue(undefined),
        read: async () => ({
          tasks: [],
          projects: emptyWorkspace("notes-test").projects,
          notes: [remote],
        }),
      });
      await vi.waitFor(() => expect(store.getSnapshot().sync).toBe("conflict"));
      await store.resolveConflict(choice);
      await store.settled();
      expect(
        new Set(store.getSnapshot().record.notes?.map((n) => n.body)),
      ).toEqual(new Set(["Account text", "Device text"]));
      store.disconnect();
    },
  );
  it("round-trips notes and linked task IDs through portable backups", async () => {
    const { store } = await harness();
    const note = createNote(store, {
      title: "Reference",
      body: "Keep context",
    });
    const taskId = taskFromNote(store, note.id, "One next action");
    const backup = JSON.parse(
      JSON.stringify(createWorkspaceBackup(store.getSnapshot().record)),
    );
    const extra = validateBackupExtras(backup)!;
    expect(extra.notes?.[0].linkedTasks[0].taskId).toBe(taskId);
    expect(extra.notes?.[0].id).toBe(note.id);
    expect(backup.tasks[0].originNoteId).toBe(note.id);
    expect(
      validateBackupExtras({ version: 6, preferences: {} })?.notes,
    ).toEqual([]);
    expect(backup).not.toHaveProperty("pending");
    await store.settled();
  });
  it("preserves conflicting import text and avoids repeat-import duplication", () => {
    const local = makeNote("Idea", "Local", { id: "same-id" });
    const incoming = makeNote("Idea", "Imported", { id: local.id });
    const first = mergeBackupExtras(
      { preferences: {}, notes: [local] },
      { preferences: {}, notes: [incoming] },
      false,
    );
    const again = mergeBackupExtras(
      first,
      { preferences: {}, notes: [incoming] },
      false,
    );
    expect(again.notes?.map((n) => n.body)).toEqual(["Local", "Imported"]);
  });
  it("groups and bounds history, and resolves links independently of titles", () => {
    let note = makeNote("Before", "One");
    note = withNoteVersion(note, { title: "After", body: "Two" });
    expect(note.versions[0].body).toBe("One");
    for (let i = 0; i < 8; i++)
      note = withNoteVersion(note, { body: `Text ${i}` }, true);
    expect(note.versions).toHaveLength(4);
    expect(
      noteReferences("[[note:stable-id]] [[note:stable-id]] [[task:one]]"),
    ).toEqual(["stable-id"]);
  });
  it("searches note bodies and tags while excluding archive and trash", () => {
    const note = makeNote("Trip", "Packing checklist", { tags: ["holiday"] });
    expect(findNotes([note], "packing holiday")).toHaveLength(1);
    expect(
      findNotes(
        [
          { ...note, archivedAt: 1 },
          { ...note, id: "trash", deletedAt: 1 },
        ],
        "packing",
      ),
    ).toEqual([]);
  });
  it("rejects oversized, malformed, duplicate, and unsupported note data", () => {
    const note = makeNote();
    expect(() => validateNotes([note, note])).toThrow();
    expect(() =>
      validateNotes([{ ...note, body: "x".repeat(40001) }]),
    ).toThrow();
    expect(() =>
      validateNotes([
        {
          ...note,
          versions: Array(5).fill({ id: "v", title: "", body: "", savedAt: 1 }),
        },
      ]),
    ).toThrow();
    expect(() =>
      validateNotes([
        { ...note, linkedTasks: [{ taskId: "../other", excerpt: "" }] },
      ]),
    ).toThrow();
    expect(
      validateNotes([{ ...note, unexpected: "not persisted" }])[0],
    ).not.toHaveProperty("unexpected");
  });
  it("appends reflections to daily note cleanly", async () => {
    const { store } = await harness();
    const date = "2026-10-25";
    const note = appendDailyNote(store, date, "First evening reflection");
    expect(note.id).toBe(`daily-${date}`);
    expect(store.getSnapshot().record.notes?.find((n) => n.id === `daily-${date}`)?.body).toContain("First evening reflection");

    appendDailyNote(store, date, "Second evening reflection");
    const updated = store.getSnapshot().record.notes?.find((n) => n.id === `daily-${date}`);
    expect(updated?.body).toContain("First evening reflection");
    expect(updated?.body).toContain("Second evening reflection");
  });
  it("converts a task description to a linked standalone note bidirectionally", async () => {
    const { store } = await harness();
    store.run("Seed task", (record) => ({
      ...record,
      tasks: [
        {
          id: "task-101",
          title: "Comprehensive Architecture Audit",
          description: "Detailed system design specifications and notes across multiple paragraphs.",
          status: "todo",
          priority: "p2",
          projectId: "work",
          createdAt: Date.now(),
          subtasks: [],
        },
      ],
    }));

    const noteId = noteFromTaskDescription(store, "task-101");
    expect(noteId).toBeTruthy();

    const snapshot = store.getSnapshot().record;
    const task = snapshot.tasks.find((t) => t.id === "task-101");
    const note = snapshot.notes?.find((n) => n.id === noteId);

    expect(task?.originNoteId).toBe(noteId);
    expect(task?.description).toContain(`[Extracted to Note: ${note?.title}]`);
    expect(note?.title).toBe("Comprehensive Architecture Audit");
    expect(note?.body).toBe("Detailed system design specifications and notes across multiple paragraphs.");
    expect(note?.linkedTasks).toEqual([
      { taskId: "task-101", excerpt: "Comprehensive Architecture Audit" },
    ]);
  });
  it("syncs linked task completion status bidirectionally to note checkboxes", async () => {
    const { store } = await harness();
    const note = createNote(store, {
      title: "Sprint Checklist",
      body: "## Tasks\n- [ ] Review PR\n- [ ] Deploy to staging\n",
    });

    const taskId = taskFromNote(store, note.id, "Review PR");
    expect(taskId).toBeTruthy();

    // Toggle to completed
    syncLinkedTaskStatusToNote(store, taskId, true);
    let updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    expect(updatedNote?.body).toContain("- [x] Review PR");
    expect(updatedNote?.body).toContain("- [ ] Deploy to staging");

    // Toggle back to incomplete
    syncLinkedTaskStatusToNote(store, taskId, false);
    updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    expect(updatedNote?.body).toContain("- [ ] Review PR");
    expect(updatedNote?.body).toContain("- [ ] Deploy to staging");
  });
  it("automatically updates linked note when task is toggled via useTaskStore", async () => {
    const { store } = await harness();
    useTaskStore.getState().setWorkspaceStore(store);

    const note = createNote(store, {
      title: "Weekly Plan",
      body: "- [ ] Send weekly report\n",
    });

    const taskId = taskFromNote(store, note.id, "Send weekly report");

    // Complete task via store action
    useTaskStore.getState().toggleTaskStatus(taskId);
    let updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    expect(updatedNote?.body).toContain("- [x] Send weekly report");

    // Uncomplete task via store action
    useTaskStore.getState().toggleTaskStatus(taskId);
    updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    expect(updatedNote?.body).toContain("- [ ] Send weekly report");
  });

  it("syncs numbered checklists (1. [ ], 2. [ ]) bidirectionally", async () => {
    const { store } = await harness();
    const note = createNote(store, {
      title: "Release Steps",
      body: "1. [ ] Run migrations\n2. [ ] Health check\n",
    });

    const taskId = taskFromNote(store, note.id, "Run migrations");
    syncLinkedTaskStatusToNote(store, taskId, true);

    let updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    expect(updatedNote?.body).toContain("1. [x] Run migrations");
    expect(updatedNote?.body).toContain("2. [ ] Health check");

    syncLinkedTaskStatusToNote(store, taskId, false);
    updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    expect(updatedNote?.body).toContain("1. [ ] Run migrations");
  });

  it("handles tasks created with leading checkbox in title (- [ ] Task)", async () => {
    const { store } = await harness();
    const note = createNote(store, {
      title: "Checklist",
      body: "- [ ] Backup DB\n",
    });

    // Excerpt includes "- [ ] Backup DB"
    const taskId = taskFromNote(store, note.id, "- [ ] Backup DB");
    syncLinkedTaskStatusToNote(store, taskId, true);

    let updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    expect(updatedNote?.body).toContain("- [x] Backup DB");

    // Toggling back to incomplete succeeds even though original title had "- [ ]"
    syncLinkedTaskStatusToNote(store, taskId, false);
    updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    expect(updatedNote?.body).toContain("- [ ] Backup DB");
  });

  it("modifies only exact matching line and does not corrupt substring lines", async () => {
    const { store } = await harness();
    const note = createNote(store, {
      title: "Deployment Plan",
      body: "- [ ] Deploy\n- [ ] Deploy to production\n",
    });

    const taskId = taskFromNote(store, note.id, "Deploy");
    syncLinkedTaskStatusToNote(store, taskId, true);

    const updatedNote = store.getSnapshot().record.notes?.find((n) => n.id === note.id);
    // Only "Deploy" should be marked done, NOT "Deploy to production"
    expect(updatedNote?.body).toContain("- [x] Deploy\n- [ ] Deploy to production");
  });
});



