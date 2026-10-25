import type { Note, NoteVersion } from "../types/note";

export const NOTE_BODY_LIMIT = 40000;
export const NOTE_HISTORY_LIMIT = 4;
const validId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(v);
const timestamp = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;

export function validateNotes(raw: unknown): Note[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 10000)
    throw new Error("Notes must be a list of at most 10,000 items.");
  const ids = new Set<string>();
  return raw.map((value) => {
    if (
      !object(value) ||
      !validId(value.id) ||
      ids.has(value.id) ||
      !text(value.title, 200) ||
      !value.title.trim() ||
      !text(value.body, NOTE_BODY_LIMIT) ||
      value.formatVersion !== 1 ||
      !timestamp(value.createdAt) ||
      !timestamp(value.updatedAt)
    )
      throw new Error(
        "A note has an invalid ID, title, body, format, or date.",
      );
    ids.add(value.id);
    if (
      !Array.isArray(value.tags) ||
      value.tags.length > 20 ||
      value.tags.some((tag) => !text(tag, 50)) ||
      typeof value.favorite !== "boolean"
    )
      throw new Error("Invalid note tags or favorite state.");
    if (value.projectId !== undefined && !validId(value.projectId))
      throw new Error("Invalid note project.");
    if (
      value.dailyDate !== undefined &&
      (typeof value.dailyDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value.dailyDate) ||
        !Number.isFinite(Date.parse(`${value.dailyDate}T12:00:00Z`)) ||
        new Date(`${value.dailyDate}T12:00:00Z`).toISOString().slice(0, 10) !==
          value.dailyDate)
    )
      throw new Error("Invalid daily note date.");
    for (const key of ["archivedAt", "deletedAt", "revision"])
      if (value[key] !== undefined && !timestamp(value[key]))
        throw new Error(`Invalid note ${key}.`);
    if (
      !Array.isArray(value.versions) ||
      value.versions.length > NOTE_HISTORY_LIMIT ||
      value.versions.some(
        (v) =>
          !object(v) ||
          !validId(v.id) ||
          !text(v.title, 200) ||
          !text(v.body, NOTE_BODY_LIMIT) ||
          !timestamp(v.savedAt),
      )
    )
      throw new Error("Invalid note version history.");
    if (
      !Array.isArray(value.linkedTasks) ||
      value.linkedTasks.length > 30 ||
      value.linkedTasks.some(
        (v) => !object(v) || !validId(v.taskId) || !text(v.excerpt, 1000),
      )
    )
      throw new Error(
        "A note supports up to 30 linked task selections of at most 1,000 characters.",
      );
    if (value.importedFrom !== undefined && value.importedFrom !== "scratchpad")
      throw new Error("Invalid note origin.");
    if (
      value.relatedNoteIds !== undefined &&
      (!Array.isArray(value.relatedNoteIds) ||
        value.relatedNoteIds.length > 200 ||
        value.relatedNoteIds.some((id) => !validId(id)))
    )
      throw new Error("Invalid related note links.");
    // Pick supported fields; untrusted imports never add arbitrary payloads to cloud records.
    const {
      id,
      title,
      body,
      createdAt,
      updatedAt,
      projectId,
      dailyDate,
      favorite,
      archivedAt,
      deletedAt,
      revision,
      importedFrom,
    } = value;
    return {
      id,
      title,
      body,
      formatVersion: 1,
      createdAt,
      updatedAt,
      tags: [...value.tags],
      favorite,
      ...(projectId ? { projectId } : {}),
      ...(dailyDate ? { dailyDate } : {}),
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      ...(deletedAt !== undefined ? { deletedAt } : {}),
      ...(revision !== undefined ? { revision } : {}),
      ...(importedFrom ? { importedFrom } : {}),
      versions: value.versions.map((v) => ({
        id: v.id,
        title: v.title,
        body: v.body,
        savedAt: v.savedAt,
      })),
      linkedTasks: value.linkedTasks.map((v) => ({
        taskId: v.taskId,
        excerpt: v.excerpt,
      })),
      relatedNoteIds: [...new Set((value.relatedNoteIds || []) as string[])],
    } as Note;
  });
}

export function makeNote(
  title = "Untitled note",
  body = "",
  extras: Partial<Note> = {},
): Note {
  const now = Date.now();
  return validateNotes([
    {
      id: crypto.randomUUID(),
      title,
      body,
      createdAt: now,
      updatedAt: now,
      formatVersion: 1,
      tags: [],
      favorite: false,
      versions: [],
      linkedTasks: [],
      ...extras,
    },
  ])[0];
}

export function withNoteVersion(
  note: Note,
  patch: Partial<Note>,
  force = false,
): Note {
  const changed =
    (patch.body !== undefined && patch.body !== note.body) ||
    (patch.title !== undefined && patch.title !== note.title);
  const versions = [...note.versions];
  if (
    (changed || force) &&
    (force ||
      !versions.length ||
      Date.now() - versions[versions.length - 1].savedAt >= 60000)
  ) {
    const version: NoteVersion = {
      id: crypto.randomUUID(),
      title: note.title,
      body: note.body,
      savedAt: Date.now(),
    };
    versions.push(version);
  }
  return validateNotes([
    {
      ...note,
      ...patch,
      id: note.id,
      formatVersion: 1,
      versions: versions.slice(-NOTE_HISTORY_LIMIT),
      updatedAt: Date.now(),
    },
  ])[0];
}

export function noteReferences(body: string): string[] {
  return [
    ...new Set(
      [...body.matchAll(/\[\[note:([a-zA-Z0-9_-]{1,200})\]\]/g)].map(
        (match) => match[1],
      ),
    ),
  ];
}

export function findNotes(notes: Note[], query: string) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return notes
    .filter(
      (note) =>
        !note.deletedAt &&
        !note.archivedAt &&
        words.every((word) =>
          `${note.title}\n${note.body}\n${note.tags.join(" ")}\n${note.dailyDate || ""}`
            .toLocaleLowerCase()
            .includes(word),
        ),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

/** Keep the losing text as a separate note before a deliberate sync/import choice. */
export function recoveredNote(note: Note): Note {
  return {
    ...structuredClone(note),
    id: crypto.randomUUID(),
    title: `${note.title.slice(0, 175)} (Recovered copy)`,
    dailyDate: undefined,
    deletedAt: undefined,
    archivedAt: undefined,
    revision: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
