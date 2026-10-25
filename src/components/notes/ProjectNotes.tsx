import { useWorkspaceSelector } from "../../services/workspaceStore";
import { openNote } from "../../hooks/useNotes";
import { useUIStore } from "../../store/useUIStore";

export function ProjectNotes({ projectId }: { projectId: string }) {
  const notes = useWorkspaceSelector((snapshot) => snapshot.record.notes);
  const visible = (notes || []).filter(
    (note) =>
      note.projectId === projectId && !note.deletedAt && !note.archivedAt,
  );
  return (
    <section className="desk-notice" aria-label="Project notes">
      <div className="flex w-full items-center justify-between gap-3">
        <strong>Notes & context</strong>
        <button
          className="desk-button"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("noteProject", projectId);
            window.history.replaceState({}, "", url);
            useUIStore.getState().setSelectedNoteId(null);
            useUIStore.getState().setActiveView("notes");
          }}
        >
          Open project notes
        </button>
      </div>
      {visible.slice(0, 5).map((note) => (
        <button
          key={note.id}
          className="desk-button"
          onClick={() => openNote(note.id)}
        >
          {note.title}
        </button>
      ))}
    </section>
  );
}
