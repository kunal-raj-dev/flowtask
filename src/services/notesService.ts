import type { WorkspaceStore } from "./workspaceStore";
import type { Note } from "../types/note";
import { makeNote, recoveredNote, withNoteVersion } from "../utils/noteModel";
import { commandService } from "./commandService";

export function createNote(store: WorkspaceStore, extras: Partial<Note> = {}) {
  const note = makeNote(extras.title, extras.body, extras);
  store.run("Create note", (record) => ({
    ...record,
    notes: [...(record.notes || []), note],
  }));
  return note;
}
export function editNote(
  store: WorkspaceStore,
  id: string,
  patch: Partial<Note>,
  forceVersion = false,
) {
  store.run(
    forceVersion ? "Save note version" : "Update note",
    (record) => ({
      ...record,
      notes: (record.notes || []).map((note) =>
        note.id === id ? withNoteVersion(note, patch, forceVersion) : note,
      ),
    }),
    forceVersion,
  );
}
/** Preserve drafts when another device changed the editor's base. */
export function saveNoteText(
  store: WorkspaceStore,
  id: string,
  title: string,
  body: string,
  base: Pick<Note, "title" | "body">,
) {
  let savedId = id;
  store.run(
    "Save note text",
    (record) => {
      const note = record.notes?.find((n) => n.id === id);
      if (!note)
        throw new Error("The note is unavailable. Keep or export your draft.");
      if (note.title === title && note.body === body) return record;
      if (
        note.title !== base.title ||
        note.body !== base.body ||
        note.deletedAt
      ) {
        const copy = recoveredNote(withNoteVersion(note, { title, body }));
        savedId = copy.id;
        return { ...record, notes: [...(record.notes || []), copy] };
      }
      return {
        ...record,
        notes: record.notes!.map((n) =>
          n.id === id ? withNoteVersion(n, { title, body }) : n,
        ),
      };
    },
    false,
  );
  return savedId;
}
export function dailyNote(store: WorkspaceStore, date: string) {
  const existing = store
    .getSnapshot()
    .record.notes?.find((n) => n.id === `daily-${date}`);
  return (
    existing ||
    createNote(store, {
      id: `daily-${date}`,
      title: `Daily note · ${date}`,
      dailyDate: date,
      body: "## Today\n\n\n## Notes\n\n\n## Reflection\n\n",
    })
  );
}
export function importScratchpad(store: WorkspaceStore) {
  const record = store.getSnapshot().record;
  const body =
    typeof record.preferences.scratchpad === "string"
      ? record.preferences.scratchpad
      : "";
  if (!body.trim()) throw new Error("Your device scratchpad is empty.");
  const existing = record.notes?.find(
    (note) =>
      note.importedFrom === "scratchpad" &&
      note.body === body &&
      !note.deletedAt,
  );
  return (
    existing ||
    createNote(store, {
      title: "Imported scratchpad",
      body,
      importedFrom: "scratchpad",
    })
  );
}
export function taskFromNote(
  store: WorkspaceStore,
  noteId: string,
  text: string,
) {
  const excerpt = text.trim().slice(0, 1000);
  if (!excerpt) throw new Error("Select some note text first.");
  let taskId = "";
  store.run("Create linked task", (record) => {
    const note = record.notes?.find(
      (n) => n.id === noteId && !n.deletedAt && !n.archivedAt,
    );
    if (!note) throw new Error("Restore the note before creating a task.");
    const existing = note.linkedTasks.find(
      (link) =>
        link.excerpt === excerpt &&
        record.tasks.some((task) => task.id === link.taskId && !task.deletedAt),
    );
    if (existing) {
      taskId = existing.taskId;
      return record;
    }
    const result = commandService.createTask(
      record.tasks,
      excerpt.split("\n")[0].slice(0, 500),
      {
        originNoteId: note.id,
        description: excerpt,
        projectId: record.projects.some(
          (p) => p.id === note.projectId && !p.isArchived,
        )
          ? note.projectId
          : "inbox",
      },
      { enableParsing: false, projects: record.projects },
    );
    taskId = result.createdTask.id;
    return {
      ...record,
      tasks: result.updatedTasks,
      notes: record.notes!.map((n) =>
        n.id === note.id
          ? { ...n, linkedTasks: [...n.linkedTasks, { taskId, excerpt }] }
          : n,
      ),
    };
  });
  return taskId;
}

export function appendDailyNote(
  store: WorkspaceStore,
  date: string,
  text: string,
) {
  const content = text.trim();
  if (!content) return dailyNote(store, date);
  const note = dailyNote(store, date);
  const updatedBody = note.body.trim()
    ? `${note.body.trim()}\n\n- ${content}\n`
    : `- ${content}\n`;
  editNote(store, note.id, { body: updatedBody });
  return note;
}

export function noteFromTaskDescription(
  store: WorkspaceStore,
  taskId: string,
) {
  let createdNoteId = "";
  store.run("Convert description to note", (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error("Task not found.");
    const body = (task.description || "").trim();
    if (!body) throw new Error("Task has no description to convert.");

    const note = makeNote(task.title, body, {
      projectId: task.projectId && task.projectId !== "inbox" ? task.projectId : undefined,
      linkedTasks: [{ taskId: task.id, excerpt: task.title }],
    });
    createdNoteId = note.id;

    const summary = body.length > 120 ? `${body.slice(0, 120)}...` : body;
    const updatedTasks = record.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            originNoteId: note.id,
            description: `[Extracted to Note: ${note.title}]\n\n${summary}`,
          }
        : t,
    );

    return {
      ...record,
      tasks: updatedTasks,
      notes: [...(record.notes || []), note],
    };
  });
  return createdNoteId;
}

export function syncLinkedTaskStatusToNote(
  store: WorkspaceStore,
  taskId: string,
  isDone: boolean,
) {
  store.run('Sync linked task to note', (record) => {
    const task = record.tasks.find((t) => t.id === taskId);
    if (!task) return record;

    const matchingNotes = (record.notes || []).filter(
      (n) =>
        !n.deletedAt &&
        (n.id === task.originNoteId ||
          n.linkedTasks?.some((link) => link.taskId === taskId)),
    );

    if (matchingNotes.length === 0) return record;

    const stripCheckboxPrefix = (str: string) =>
      str.replace(/^(\s*(?:[-*+]|\d+[.)])?\s*)\[[ xX]\]\s*/, '').trim();

    let hasChange = false;
    const updatedNotes = (record.notes || []).map((note) => {
      if (!matchingNotes.some((m) => m.id === note.id)) return note;

      const targetExcerpt =
        note.linkedTasks?.find((l) => l.taskId === taskId)?.excerpt || task.title;
      const excerptFirstLine = targetExcerpt ? targetExcerpt.split('\n')[0].trim() : '';

      const cleanExcerpt = stripCheckboxPrefix(excerptFirstLine);
      const cleanTaskTitle = stripCheckboxPrefix(task.title || '');

      const lines = note.body.split('\n');
      let noteModified = false;

      // Regex matches: indentation, bullet or digit marker, checkbox, and item text
      const checkboxRegex = /^(\s*(?:[-*+]|\d+[.)])?\s*)\[([ xX])\]\s*(.*)$/;

      // First check if an exact match exists among checkbox lines
      const hasExactMatch = lines.some((line) => {
        const m = line.match(checkboxRegex);
        if (!m) return false;
        const item = m[3].trim();
        return (cleanTaskTitle && item === cleanTaskTitle) || (cleanExcerpt && item === cleanExcerpt);
      });

      const updatedLines = lines.map((line) => {
        if (noteModified) return line;

        const match = line.match(checkboxRegex);
        if (!match) return line;

        const [, prefix, checkState, itemContent] = match;
        const currentDone = checkState === 'x' || checkState === 'X';
        if (currentDone === isDone) return line;

        const cleanItem = itemContent.trim();
        const matches = hasExactMatch
          ? (cleanTaskTitle && cleanItem === cleanTaskTitle) || (cleanExcerpt && cleanItem === cleanExcerpt)
          : (cleanTaskTitle && (cleanItem === cleanTaskTitle || cleanItem.startsWith(cleanTaskTitle + ' '))) ||
            (cleanExcerpt && (cleanItem === cleanExcerpt || cleanItem.startsWith(cleanExcerpt + ' ')));

        if (!matches) return line;

        noteModified = true;
        return `${prefix}[${isDone ? 'x' : ' '}] ${itemContent}`;
      });

      if (noteModified) {
        hasChange = true;
        return withNoteVersion(note, { body: updatedLines.join('\n') });
      }
      return note;
    });

    if (!hasChange) return record;
    return {
      ...record,
      notes: updatedNotes,
    };
  });
}

