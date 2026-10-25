import React, { useContext, useEffect, useRef, useState } from 'react';
import { Copy, Check, ArrowUpRight, Plus } from 'lucide-react';
import { useTaskContext } from '../../../context/TaskContext';
import { WorkspaceStoreContext } from '../../../services/workspaceStore';
import { dailyNote, editNote } from '../../../services/notesService';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import type { WidgetComponentProps } from '../../../types/dashboard';

/** Flush to the original owner on navigation; a delayed write must never cross accounts or tasks. */
function useNoteDraft(key: string, external: string, commit: (value: string) => void) {
  const [draft, setDraft] = useState({ key, value: external, dirty: false });
  const pending = useRef<{ key: string; value: string; save: (value: string) => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    clearTimeout(timer.current);
    const value = pending.current;
    pending.current = null;
    value?.save(value.value);
    if (value) setDraft(previous => previous.key === value.key ? { ...previous, dirty: false } : previous);
  };
  useEffect(() => () => flush(), [key]);
  useEffect(() => {
    const save = () => flush();
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [key]);
  return [
    draft.key === key && draft.dirty ? draft.value : external,
    (value: string) => {
      setDraft({ key, value, dirty: true });
      clearTimeout(timer.current);
      pending.current = { key, value, save: commit };
      timer.current = setTimeout(flush, 350);
    },
    flush,
  ] as const;
}

export const QuickNotesWidget: React.FC<WidgetComponentProps> = ({ widget }) => {
  const {
    workspaceId = 'local',
    workspacePreferences = {},
    setWorkspacePreference,
    selectedTaskId,
    tasks,
    updateTask,
    addTask,
    showToast,
  } = useTaskContext();
  const store = useContext(WorkspaceStoreContext);
  const todayStr = useTodayStr();

  const task = tasks.find(t => t.id === selectedTaskId);
  const [tab, setTab] = useState<'scratchpad' | 'task' | 'daily'>('scratchpad');
  const [copied, setCopied] = useState(false);

  const scopeKey = `${workspaceId}:${tab}:${selectedTaskId || ''}`;
  const [selectionState, setSelectionState] = useState({ text: '', scopeKey });
  const selection = selectionState.scopeKey === scopeKey ? selectionState.text : '';
  const setSelection = (text: string) => setSelectionState({ text, scopeKey });

  const [scratch, setScratch, flushScratch] = useNoteDraft(
    workspaceId + ':scratchpad',
    String(workspacePreferences.scratchpad || ''),
    value => setWorkspacePreference('scratchpad', value)
  );

  const [notes, setNotes, flushNotes] = useNoteDraft(
    workspaceId + ':task:' + (task?.id || ''),
    task?.description || '',
    value => { if (task) updateTask(task.id, { description: value }); }
  );

  const todayDailyNote = store?.getSnapshot()?.record?.notes?.find(n => n.id === 'daily-' + todayStr);
  const [daily, setDaily, flushDaily] = useNoteDraft(
    workspaceId + ':daily:' + todayStr,
    todayDailyNote?.body || '',
    value => {
      if (store) {
        const n = dailyNote(store, todayStr);
        editNote(store, n.id, { body: value });
      }
    }
  );

  const textarea = useRef<HTMLTextAreaElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const useTask = Boolean(task) && (widget.config.mode === 'task' || tab === 'task');
  const value = useTask ? notes : tab === 'daily' ? daily : scratch;

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  if (widget.config.mode === 'task' && !task) {
    return (
      <div className="desk-widget-empty">
        <h3>Choose a task for your notes</h3>
        <p>Open a task to see and edit its notes here. Your scratchpad is available in Quick Notes.</p>
      </div>
    );
  }

  const ariaLabel = useTask && task
    ? 'Notes for ' + task.title
    : tab === 'daily'
      ? 'Daily note for ' + todayStr
      : 'Workspace scratchpad';

  return (
    <div className="desk-notepad">
      <div className="desk-notepad-tabs">
        <div role="group" aria-label="Note source">
          <button aria-pressed={!useTask && tab === 'scratchpad'} onClick={() => setTab('scratchpad')}>
            Scratchpad
          </button>
          <button aria-pressed={!useTask && tab === 'daily'} onClick={() => setTab('daily')}>
            Daily Note
          </button>
          {task && widget.config.mode !== 'scratchpad' && (
            <button aria-pressed={useTask} onClick={() => setTab('task')}>
              Task notes
            </button>
          )}
        </div>
        <button
          className="desk-icon-button"
          aria-label="Copy notes"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              clearTimeout(copiedTimer.current);
              copiedTimer.current = setTimeout(() => setCopied(false), 2000);
            } catch {
              showToast('Could not copy notes. Select the text and copy it with your keyboard.');
            }
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>

      {useTask && task && <p className="desk-muted desk-note-task">{task.title}</p>}
      {tab === 'daily' && !useTask && <p className="desk-muted desk-note-task">Today's Reflection & Notes ({todayStr})</p>}


      <textarea
        ref={textarea}
        aria-label={ariaLabel}
        value={value}
        onChange={e => {
          if (useTask) setNotes(e.target.value);
          else if (tab === 'daily') setDaily(e.target.value);
          else setScratch(e.target.value);
        }}
        onBlur={() => {
          flushScratch();
          flushNotes();
          flushDaily();
        }}
        onSelect={() => {
          const element = textarea.current;
          setSelection(element ? value.slice(element.selectionStart, element.selectionEnd).trim() : '');
        }}
        placeholder="A thought, a reminder, a place to pick up later…"
      />

      {selection && (
        <div className="desk-note-convert">
          <span>Turn this thought into action</span>
          <button
            onClick={() => {
              addTask(selection.slice(0, 10000), { projectId: 'inbox' });
              setSelection('');
              showToast('Task captured in Inbox.');
            }}
          >
            <ArrowUpRight size={14} />
            New task
          </button>
          {task && (
            <button
              onClick={() => {
                updateTask(task.id, {
                  subtasks: [
                    ...task.subtasks,
                    { id: crypto.randomUUID(), title: selection.slice(0, 10000), completed: false },
                  ],
                });
                setSelection('');
                showToast('Subtask added.');
              }}
            >
              <Plus size={14} />
              Subtask
            </button>
          )}
        </div>
      )}

      <p className="desk-note-footer">
        {useTask ? 'Saved with this task' : tab === 'daily' ? 'Saved in Daily Note · Synced' : 'Saved on this device'} · Select text to create a task
      </p>
    </div>
  );
};
