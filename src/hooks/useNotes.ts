import { useContext } from "react";
import {
  WorkspaceStoreContext,
  useWorkspaceSelector,
} from "../services/workspaceStore";
import { useUIStore } from "../store/useUIStore";

export function openNote(id: string) {
  const ui = useUIStore.getState();
  ui.setSelectedTaskId(null);
  ui.setSelectedNoteId(id);
  ui.setActiveView("notes");
  const url = new URL(window.location.href);
  url.searchParams.delete("noteProject");
  url.searchParams.set("note", id);
  window.history.replaceState(window.history.state, "", url);
}
export function useNotes() {
  const store = useContext(WorkspaceStoreContext);
  const snapshot = useWorkspaceSelector((value) => value);
  if (!store || !snapshot) throw new Error("Notes require an open workspace.");
  return { store, snapshot, notes: snapshot.record.notes || [] };
}
