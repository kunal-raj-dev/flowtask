import { useContext } from "react";
import { BookOpen } from "lucide-react";
import { WorkspaceStoreContext } from "../../services/workspaceStore";
import { dailyNote } from "../../services/notesService";
import { openNote } from "../../hooks/useNotes";
import { useTodayStr } from "../../hooks/useCurrentDate";
import { useUIStore } from "../../store/useUIStore";

export function DailyNoteButton() {
  const store = useContext(WorkspaceStoreContext);
  const today = useTodayStr();
  if (!store) return null;
  return (
    <button
      className="desk-button daily-note-entry"
      onClick={() => {
        try {
          openNote(dailyNote(store, today).id);
        } catch (error) {
          useUIStore.getState().showToast((error as Error).message);
        }
      }}
    >
      <BookOpen size={15} />
      Daily note
    </button>
  );
}
