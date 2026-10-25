import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Archive,
  BookOpen,
  Download,
  FileText,
  Link2,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useTaskContext } from "../../context/TaskContext";
import { openNote, useNotes } from "../../hooks/useNotes";
import { useTodayStr } from "../../hooks/useCurrentDate";
import { useUIStore } from "../../store/useUIStore";
import {
  createNote,
  dailyNote,
  editNote,
  importScratchpad,
  saveNoteText,
  taskFromNote,
} from "../../services/notesService";
import {
  findNotes,
  NOTE_BODY_LIMIT,
  noteReferences,
} from "../../utils/noteModel";
import { downloadMarkdown } from "../../utils/fileExporter";
import type { Note } from "../../types/note";
import { NoteMarkdown } from "../notes/NoteMarkdown";
import "../../styles/notes.css";

export function NotesView() {
  const { store, snapshot, notes } = useNotes();
  const { projects, showToast, downloadWorkspaceBackup } = useTaskContext();
  const selectedId = useUIStore((s) => s.selectedNoteId);
  const today = useTodayStr();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [project, setProject] = useState(
    () => new URLSearchParams(window.location.search).get("noteProject") || "",
  );
  const [scratchImport, setScratchImport] = useState(false);
  const [incoming, setIncoming] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const selected = notes.find((note) => note.id === selectedId);
  const pool = notes.filter((note) =>
    filter === "trash"
      ? !!note.deletedAt
      : filter === "archive"
        ? !!note.archivedAt && !note.deletedAt
        : !note.deletedAt && !note.archivedAt,
  );
  const visible = (
    filter === "trash" || filter === "archive"
      ? pool.filter((note) =>
          `${note.title} ${note.body}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
      : findNotes(pool, query)
  ).filter(
    (note) =>
      (!project || note.projectId === project) &&
      (filter !== "favorites" || note.favorite) &&
      (filter !== "daily" || note.dailyDate),
  );
  const act = (action: () => void) => {
    try {
      setError("");
      action();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const back = () => {
    useUIStore.getState().setSelectedNoteId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("note");
    window.history.replaceState({}, "", url);
  };
  useEffect(() => {
    const pop = () =>
      useUIStore
        .getState()
        .setSelectedNoteId(
          new URLSearchParams(window.location.search).get("note"),
        );
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const newNote = () =>
    act(() => {
      setFilter("all");
      setQuery("");
      openNote(createNote(store, project ? { projectId: project } : {}).id);
    });
  const openDaily = () =>
    act(() => {
      setProject("");
      setQuery("");
      const note = dailyNote(store, today);
      setFilter(
        note.deletedAt ? "trash" : note.archivedAt ? "archive" : "daily",
      );
      openNote(note.id);
    });
  return (
    <section
      className={`notes-workspace ${selected ? "notes-has-selection" : ""}`}
      aria-label="Notes workspace"
    >
      <aside className="note-library" aria-label="Note library">
        <div className="notes-library-heading">
          <div>
            <p className="desk-eyebrow">A place for your thoughts</p>
            <h1>
              Notes<span className="desk-title-dot">.</span>
            </h1>
          </div>
          <button
            className="desk-button primary"
            onClick={newNote}
            disabled={snapshot.readOnly}
            aria-label="New note"
          >
            <Plus size={17} />
          </button>
        </div>
        <label className="notes-search">
          <Search size={16} />
          <input
            aria-label="Search notes"
            placeholder="Search notes, text, tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="notes-filter-row">
          <select
            aria-label="Note collection"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              ["all", "All notes"],
              ["favorites", "Favorites"],
              ["daily", "Daily notes"],
              ["archive", "Archive"],
              ["trash", "Trash"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter notes by project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">All projects</option>
            {projects
              .filter((p) => !p.isArchived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <button
          className="notes-daily-button"
          onClick={openDaily}
          disabled={snapshot.readOnly}
        >
          <BookOpen size={17} />
          <span>
            Today's note<small>{today}</small>
          </span>
          <Plus size={15} />
        </button>
        <div className="notes-count">
          {visible.length} {visible.length === 1 ? "note" : "notes"}
        </div>
        <div className="notes-list">
          {visible.map((note) => (
            <button
              key={note.id}
              onClick={() => openNote(note.id)}
              aria-current={note.id === selectedId ? "true" : undefined}
              className={`note-list-item ${note.id === selectedId ? "selected" : ""}`}
            >
              <span className="note-list-title">
                {note.favorite ? (
                  <Star size={14} aria-label="Favorite" />
                ) : (
                  <FileText size={15} />
                )}
                <strong>{note.title}</strong>
              </span>
              <span className="note-list-excerpt">
                {note.body.replace(/[#*`]/g, "").slice(0, 110) ||
                  "A fresh page, ready for a thought."}
              </span>
              <small>
                {note.dailyDate ||
                  new Date(note.updatedAt).toLocaleDateString()}{" "}
                {note.tags.length ? `· ${note.tags.join(", ")}` : ""}
              </small>
            </button>
          ))}
          {!visible.length && (
            <div className="notes-empty-list">
              <FileText size={25} />
              <strong>
                {query ? "No notes found" : "Room for a new thought"}
              </strong>
              <p>
                {query
                  ? "Try different words or another collection."
                  : "Capture an idea, keep a reference, or start a daily note."}
              </p>
              {!query && (
                <button
                  className="desk-button"
                  onClick={newNote}
                  disabled={snapshot.readOnly}
                >
                  Write a note
                </button>
              )}
            </div>
          )}
        </div>
        <div className="notes-library-tools">
          <button onClick={() => setScratchImport(!scratchImport)}>
            Import device scratchpad
          </button>
          <button onClick={() => file.current?.click()}>Import Markdown</button>
          <button onClick={downloadWorkspaceBackup}>Back up workspace</button>
        </div>
        <input
          hidden
          ref={file}
          type="file"
          accept=".md,.markdown,.txt,text/plain,text/markdown"
          aria-label="Import Markdown file"
          onChange={async (e) => {
            const value = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (!value) return;
            try {
              if (value.size > 200000)
                throw new Error("Choose a text file smaller than 200 KB.");
              const text = await value.text();
              if (text.length > NOTE_BODY_LIMIT)
                throw new Error(
                  `A note can contain up to ${NOTE_BODY_LIMIT.toLocaleString()} characters.`,
                );
              const title = text.match(/^# (.+)\r?\n/)?.[1];
              setIncoming({
                title: (title || value.name.replace(/\.[^.]+$/, "")).slice(
                  0,
                  200,
                ),
                body: title ? text.replace(/^# .+\r?\n\r?\n?/, "") : text,
              });
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
        {scratchImport && (
          <div className="notes-import-notice">
            <strong>Choose where this writing lives</strong>
            <p>
              Import creates a note in this workspace. Signed-in workspaces sync
              notes to your account. Your device scratchpad stays unchanged.
            </p>
            <button
              className="desk-button"
              disabled={snapshot.readOnly}
              onClick={() =>
                act(() => {
                  openNote(importScratchpad(store).id);
                  setScratchImport(false);
                  setFilter("all");
                })
              }
            >
              Import as a note
            </button>
            <button
              className="desk-button"
              onClick={() => setScratchImport(false)}
            >
              Keep on this device
            </button>
          </div>
        )}
        {incoming && (
          <div className="notes-import-notice">
            <strong>{incoming.title}</strong>
            <p>
              {incoming.body.length.toLocaleString()} characters ·{" "}
              {snapshot.record.workspaceId === "local"
                ? "Saved on this device"
                : "Will sync with your account"}
            </p>
            <pre>{incoming.body.slice(0, 300)}</pre>
            <button
              className="desk-button primary"
              disabled={snapshot.readOnly}
              onClick={() =>
                act(() => {
                  const existing = notes.find(
                    (n) =>
                      n.title === incoming.title &&
                      n.body === incoming.body &&
                      !n.deletedAt,
                  );
                  openNote((existing || createNote(store, incoming)).id);
                  setIncoming(null);
                  setFilter("all");
                  showToast("Note imported.");
                })
              }
            >
              Import note
            </button>
            <button className="desk-button" onClick={() => setIncoming(null)}>
              Cancel
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="notes-error">
            {error}
          </p>
        )}
      </aside>
      {selected ? (
        <NoteEditor
          key={`${store.id}:${selected.id}`}
          note={selected}
          onBack={back}
        />
      ) : (
        <div className="notes-editor-empty">
          <div className="notes-empty-symbol">
            <FileText size={32} />
          </div>
          <p className="desk-eyebrow">Keep the context. Find the next step.</p>
          <h2>Your ideas belong here.</h2>
          <p>
            Write freely, connect your notes to projects,
            <br />
            and turn a thought into a task when you're ready.
          </p>
          <div>
            <button
              className="desk-button primary"
              onClick={newNote}
              disabled={snapshot.readOnly}
            >
              <Plus size={16} />
              New note
            </button>
            <button className="desk-button" onClick={openDaily}>
              <BookOpen size={16} />
              Today's note
            </button>
          </div>
          <small>Markdown writing · Linked tasks · Portable backups</small>
        </div>
      )}
    </section>
  );
}

function NoteEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { store, snapshot, notes } = useNotes();
  const { tasks, projects, showToast, setSelectedTaskId } = useTaskContext();
  const [draft, setDraft] = useState({ title: note.title, body: note.body });
  const base = useRef({ title: note.title, body: note.body });
  const pending = useRef<typeof draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false),
    [selection, setSelection] = useState(""),
    [error, setError] = useState(""),
    [history, setHistory] = useState(false),
    [versionId, setVersionId] = useState(""),
    [linking, setLinking] = useState(false),
    [dirty, setDirty] = useState(false);
  const [tags, setTags] = useState(note.tags.join(", "));
  const readonly = !!note.deletedAt || !!note.archivedAt || !!snapshot.readOnly;
  const act = (action: () => void) => {
    try {
      setError("");
      action();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const flush = (navigate = true) => {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return note.id;
    try {
      pending.current = null;
      setDirty(false);
      const id = saveNoteText(
        store,
        note.id,
        next.title.trim() || "Untitled note",
        next.body,
        base.current,
      );
      base.current = {
        title: next.title.trim() || "Untitled note",
        body: next.body,
      };
      if (id !== note.id) {
        showToast(
          "Another version changed. Your draft was preserved as a recovered copy.",
        );
        if (navigate) openNote(id);
      }
      setError("");
      return id;
    } catch (e) {
      pending.current = next;
      setError((e as Error).message);
      return null;
    }
  };
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => {
    const save = () => flushRef.current(false);
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      flushRef.current(false);
    };
  }, []);
  useEffect(() => {
    if (!pending.current) {
      base.current = { title: note.title, body: note.body };
      setDraft(base.current);
    }
  }, [note.title, note.body]);
  const change = (value: typeof draft) => {
    setDraft(value);
    setDirty(true);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), 500);
  };
  const insert = (value: string) => {
    const field = textarea.current;
    const start = field?.selectionStart ?? draft.body.length,
      end = field?.selectionEnd ?? start;
    const body = draft.body.slice(0, start) + value + draft.body.slice(end);
    if (body.length > NOTE_BODY_LIMIT) return;
    change({ ...draft, body });
    field?.focus();
  };

  const [autocomplete, setAutocomplete] = useState<{
    triggerIndex: number;
    query: string;
    selectedIndex: number;
  } | null>(null);

  const autocompleteCandidates = useMemo(() => {
    if (!autocomplete) return [];
    const q = autocomplete.query.toLowerCase().trim();
    const matchingNotes = notes
      .filter((n) => n.id !== note.id && !n.deletedAt && !n.archivedAt)
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((n) => ({
        type: "note" as const,
        id: n.id,
        title: n.title,
        subtitle: n.body.slice(0, 50).replace(/\n/g, " "),
      }));
    const matchingTasks = tasks
      .filter((t) => !t.deletedAt && !t.archivedAt)
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((t) => ({
        type: "task" as const,
        id: t.id,
        title: t.title,
        subtitle: t.status,
      }));
    return [...matchingNotes, ...matchingTasks].slice(0, 8);
  }, [autocomplete, notes, tasks, note.id]);

  const selectAutocompleteItem = (item: {
    type: "note" | "task";
    id: string;
    title: string;
  }) => {
    if (!autocomplete || !textarea.current) return;
    const beforeTrigger = draft.body.slice(0, autocomplete.triggerIndex);
    const afterCursor = draft.body.slice(
      autocomplete.triggerIndex + 2 + autocomplete.query.length
    );
    const token =
      item.type === "note" ? `[[note:${item.id}]]` : `[[task:${item.id}]]`;
    const newBody = `${beforeTrigger}${token} ${afterCursor}`;
    if (newBody.length > NOTE_BODY_LIMIT) return;
    change({ ...draft, body: newBody });
    if (item.type === "note") {
      editNote(store, note.id, {
        relatedNoteIds: [...new Set([...(note.relatedNoteIds || []), item.id])],
      });
    }
    setAutocomplete(null);
    setTimeout(() => {
      if (textarea.current) {
        const nextPos = beforeTrigger.length + token.length + 1;
        textarea.current.focus();
        textarea.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    change({ ...draft, body: val });
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const triggerIndex = textBefore.lastIndexOf("[[");
    if (triggerIndex !== -1) {
      const queryPart = textBefore.slice(triggerIndex + 2);
      if (!queryPart.includes("]]") && !queryPart.includes("\n")) {
        setAutocomplete({
          triggerIndex,
          query: queryPart,
          selectedIndex: 0,
        });
        return;
      }
    }
    setAutocomplete(null);
  };

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!autocomplete || autocompleteCandidates.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAutocomplete((prev) =>
        prev
          ? {
              ...prev,
              selectedIndex:
                (prev.selectedIndex + 1) % autocompleteCandidates.length,
            }
          : null,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAutocomplete((prev) =>
        prev
          ? {
              ...prev,
              selectedIndex:
                (prev.selectedIndex - 1 + autocompleteCandidates.length) %
                autocompleteCandidates.length,
            }
          : null,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const item = autocompleteCandidates[autocomplete.selectedIndex];
      if (item) selectAutocompleteItem(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAutocomplete(null);
    }
  };

  const sourceNotes = notes.filter(
    (n) =>
      !n.deletedAt &&
      n.id !== note.id &&
      [...noteReferences(n.body), ...(n.relatedNoteIds || [])].includes(
        note.id,
      ),
  );
  const linkedTasks = tasks.filter(
    (t) => t.originNoteId === note.id && !t.deletedAt,
  );
  const historical = note.versions.find((v) => v.id === versionId);
  const status = dirty
    ? "Editing…"
    : snapshot.error
      ? "Not saved · needs attention"
      : snapshot.saving
        ? "Saving…"
        : snapshot.sync === "synced"
          ? "Saved and synced"
          : store.connected
            ? "Saved on this device · sync pending"
            : "Saved on this device";
  return (
    <article className="note-editor" aria-label="Note editor">
      <header className="notes-editor-toolbar">
        <button
          className="desk-button notes-back"
          onClick={() => {
            if (flush()) onBack();
          }}
        >
          <ArrowLeft size={16} />
          Notes
        </button>
        <span role="status" className="notes-save-state">
          {status}
        </span>
        <div className="notes-editor-actions">
          <button
            className="desk-icon-button"
            aria-label={
              note.favorite ? "Remove note from favorites" : "Favorite note"
            }
            aria-pressed={note.favorite}
            disabled={readonly}
            onClick={() =>
              act(() => editNote(store, note.id, { favorite: !note.favorite }))
            }
          >
            <Star size={17} fill={note.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="desk-icon-button"
            aria-label="Download note as Markdown"
            onClick={() =>
              downloadMarkdown(
                `# ${draft.title}\n\n${draft.body}`,
                `${draft.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "note"}.md`,
              )
            }
          >
            <Download size={17} />
          </button>
          {!note.deletedAt && (
            <button
              className="desk-icon-button"
              aria-label={note.archivedAt ? "Unarchive note" : "Archive note"}
              disabled={snapshot.readOnly}
              onClick={() =>
                act(() => {
                  flush();
                  editNote(store, note.id, {
                    archivedAt: note.archivedAt ? undefined : Date.now(),
                  });
                })
              }
            >
              <Archive size={17} />
            </button>
          )}
          <button
            className="desk-icon-button"
            aria-label={
              note.deletedAt ? "Restore note from trash" : "Move note to trash"
            }
            disabled={snapshot.readOnly}
            onClick={() =>
              act(() => {
                flush();
                editNote(store, note.id, {
                  deletedAt: note.deletedAt ? undefined : Date.now(),
                });
              })
            }
          >
            <Trash2 size={17} />
          </button>
        </div>
      </header>
      <div className="note-writing-surface">
        {(note.deletedAt || note.archivedAt) && (
          <div className="notes-import-notice">
            <strong>
              {note.deletedAt
                ? "This note is in Trash."
                : "This note is archived."}
            </strong>
            <p>Restore it to continue writing.</p>
            <button
              className="desk-button"
              disabled={snapshot.readOnly}
              onClick={() =>
                act(() =>
                  editNote(store, note.id, {
                    archivedAt: undefined,
                    deletedAt: undefined,
                  }),
                )
              }
            >
              Restore note
            </button>
          </div>
        )}
        <input
          className="note-title"
          aria-label="Note title"
          maxLength={200}
          value={draft.title}
          onChange={(e) => change({ ...draft, title: e.target.value })}
          onBlur={() => flush()}
          readOnly={readonly}
        />
        <div className="note-properties">
          <label>
            Project
            <select
              aria-label="Note project"
              value={note.projectId || ""}
              disabled={readonly}
              onChange={(e) =>
                act(() =>
                  editNote(store, note.id, {
                    projectId: e.target.value || undefined,
                  }),
                )
              }
            >
              <option value="">No project</option>
              {note.projectId && !projects.some(project => project.id === note.projectId) && <option value={note.projectId}>Project unavailable</option>}
              {projects
                .filter((p) => !p.isArchived || p.id === note.projectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tags
            <input
              aria-label="Note tags"
              placeholder="ideas, personal"
              value={tags}
              maxLength={500}
              disabled={readonly}
              onChange={(e) => setTags(e.target.value)}
              onBlur={() =>
                act(() =>
                  editNote(store, note.id, {
                    tags: [
                      ...new Set(
                        tags
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      ),
                    ],
                  }),
                )
              }
            />
          </label>
          {note.dailyDate && (
            <span className="note-date">{note.dailyDate}</span>
          )}
        </div>
        <div className="note-editing-tools">
          <div role="group" aria-label="Note display">
            <button
              aria-pressed={!preview}
              onClick={() => {
                flush();
                setPreview(false);
              }}
            >
              Write
            </button>
            <button
              aria-pressed={preview}
              onClick={() => {
                flush();
                setPreview(true);
              }}
            >
              Preview
            </button>
          </div>
          {!preview && (
            <div role="group" aria-label="Insert formatting">
              <button disabled={readonly} onClick={() => insert("\n## ")}>
                Heading
              </button>
              <button disabled={readonly} onClick={() => insert("\n- ")}>
                List
              </button>
              <button disabled={readonly} onClick={() => insert("\n- [ ] ")}>
                Checklist
              </button>
              <button
                disabled={readonly}
                onClick={() => insert("\n```\n\n```\n")}
              >
                Code
              </button>
              <button disabled={readonly} onClick={() => setLinking(!linking)}>
                <Link2 size={14} />
                Link note
              </button>
            </div>
          )}
        </div>
        {linking && (
          <label className="note-link-picker">
            Link to a note
            <select
              aria-label="Link to note"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value;
                if (id)
                  act(() => {
                    flush();
                    editNote(store, note.id, {
                      relatedNoteIds: [
                        ...new Set([...(note.relatedNoteIds || []), id]),
                      ],
                    });
                  });
                setLinking(false);
              }}
            >
              <option value="">Choose a note…</option>
              {notes
                .filter(
                  (n) => n.id !== note.id && !n.deletedAt && !n.archivedAt,
                )
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        {preview ? (
          <NoteMarkdown
            body={draft.body}
            notes={notes}
            tasks={tasks}
            onNote={openNote}
            onTask={setSelectedTaskId}
          />
        ) : (
          <div className="relative w-full">
            <textarea
              ref={textarea}
              className="note-body"
              aria-label="Note body"
              placeholder="Start with a thought. The structure can come later (type [[ to link)…"
              value={draft.body}
              maxLength={NOTE_BODY_LIMIT}
              readOnly={readonly}
              onChange={handleBodyChange}
              onKeyDown={handleBodyKeyDown}
              onBlur={() => flush()}
              onSelect={(e) =>
                setSelection(
                  e.currentTarget.value
                    .slice(
                      e.currentTarget.selectionStart,
                      e.currentTarget.selectionEnd,
                    )
                    .trim(),
                )
              }
            />
            {autocomplete && autocompleteCandidates.length > 0 && (
              <div
                className="notes-autocomplete-popover"
                role="listbox"
                aria-label="Link note or task autocomplete"
              >
                {autocompleteCandidates.map((item, index) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === autocomplete.selectedIndex}
                    className={`notes-autocomplete-item ${
                      index === autocomplete.selectedIndex ? "active" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectAutocompleteItem(item);
                    }}
                  >
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="font-semibold text-xs text-[var(--text-primary)] truncate">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-[10px] text-[var(--text-muted)] truncate">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                    <span className="notes-autocomplete-badge">
                      {item.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selection && !readonly && (
          <div className="note-selection-action">
            <span>
              {selection.slice(0, 75)}
              {selection.length > 75 ? "…" : ""}
            </span>
            <button
              className="desk-button"
              onClick={() =>
                act(() => {
                  const id = flush();
                  if (!id) return;
                  const taskId = taskFromNote(store, id, selection);
                  setSelection("");
                  setSelectedTaskId(taskId);
                  showToast("Linked task is ready in your task list.");
                })
              }
            >
              <Plus size={15} />
              Create linked task
            </button>
          </div>
        )}
        <div className="note-writing-footer">
          <span>
            {draft.body.length.toLocaleString()} /{" "}
            {NOTE_BODY_LIMIT.toLocaleString()} characters
          </span>
          <button onClick={() => setHistory(!history)}>
            Version history ({note.versions.length})
          </button>
        </div>
        {history && (
          <section className="note-history" aria-label="Note version history">
            <div>
              <p>Up to four recent versions, grouped while you write.</p>
              <button
                className="desk-button"
                disabled={readonly}
                onClick={() =>
                  act(() => {
                    flush();
                    editNote(store, note.id, {}, true);
                  })
                }
              >
                Save a version now
              </button>
            </div>
            {note.versions.map((version) => (
              <button
                key={version.id}
                className="notes-history-item"
                onClick={() => setVersionId(version.id)}
              >
                {new Date(version.savedAt).toLocaleString()} · {version.title}
              </button>
            ))}
            {historical && (
              <div>
                <pre>{historical.body}</pre>
                <button
                  className="desk-button"
                  disabled={readonly}
                  onClick={() =>
                    act(() => {
                      pending.current = null;
                      clearTimeout(timer.current);
                      editNote(
                        store,
                        note.id,
                        { title: historical.title, body: historical.body },
                        true,
                      );
                      setVersionId("");
                    })
                  }
                >
                  Restore this version
                </button>
              </div>
            )}
          </section>
        )}
        {linkedTasks.length > 0 && (
          <section className="note-connections">
            <h2>Linked tasks</h2>
            {linkedTasks.map((task) => (
              <button key={task.id} onClick={() => setSelectedTaskId(task.id)}>
                <span>{task.status === "done" ? "✓" : "○"}</span>
                <span>{task.title}</span>
                <small>
                  {task.status === "done"
                    ? "Completed"
                    : task.plannedDate || "Not planned"}
                </small>
              </button>
            ))}
          </section>
        )}
        {!!note.relatedNoteIds?.length && (
          <section className="note-connections">
            <h2>Related notes</h2>
            {note.relatedNoteIds.map((id) => {
              const target = notes.find((n) => n.id === id && !n.deletedAt);
              return (
                <div key={id} className="note-related-item">
                  <button
                    disabled={!target}
                    onClick={() => target && openNote(target.id)}
                  >
                    <Link2 size={15} />
                    {target?.title || "Note unavailable or in Trash"}
                  </button>
                  <button
                    className="desk-icon-button"
                    disabled={readonly}
                    aria-label={`Unlink ${target?.title || "unavailable note"}`}
                    onClick={() =>
                      act(() =>
                        editNote(store, note.id, {
                          relatedNoteIds: note.relatedNoteIds!.filter(
                            (value) => value !== id,
                          ),
                        }),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </section>
        )}
        {sourceNotes.length > 0 && (
          <section className="note-connections">
            <h2>Referenced by</h2>
            {sourceNotes.map((source) => (
              <button key={source.id} onClick={() => openNote(source.id)}>
                <Link2 size={15} />
                {source.title}
              </button>
            ))}
          </section>
        )}
        {(error || snapshot.error) && (
          <p role="alert" className="notes-error">
            {error || snapshot.error}
          </p>
        )}
      </div>
    </article>
  );
}
