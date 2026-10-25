export interface NoteVersion {
  id: string;
  title: string;
  body: string;
  savedAt: number;
}

/** Markdown is canonical. References use stable [[note:id]] / [[task:id]] tokens. */
export interface Note {
  id: string;
  title: string;
  body: string;
  formatVersion: 1;
  createdAt: number;
  updatedAt: number;
  revision?: number;
  projectId?: string;
  dailyDate?: string;
  tags: string[];
  favorite: boolean;
  archivedAt?: number;
  deletedAt?: number;
  versions: NoteVersion[];
  linkedTasks: { taskId: string; excerpt: string }[];
  relatedNoteIds?: string[];
  importedFrom?: "scratchpad";
}
