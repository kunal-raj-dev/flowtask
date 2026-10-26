import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { calculateDurationMinutes, parseStudySessions, type ParsedSession, type ParsedSessionTarget } from '../../utils/sessionParser';
import { copyStudySessions, newStudySession, newStudyTarget, safeStudyUrl, studyId, type StudyTemplate } from '../../utils/studyTemplates';
import { Dialog } from '../ui/Dialog';
import '../../styles/study-planner.css';

export interface StudySessionModalProps {
  isOpen: boolean; onClose: () => void;
  onStartSprint?: (taskId: string) => void; onLaunchSprint?: (taskId: string) => void;
  initialMode?: 'build' | 'paste'; initialSessions?: ParsedSession[];
  purpose?: 'session' | 'template'; template?: StudyTemplate;
  onSaveTemplate?: (template: StudyTemplate) => void; onCreated?: (date: string) => void;
}
interface Draft { mode: 'build' | 'paste'; rawText: string; sessions: ParsedSession[]; date: string; projectId: string; name: string; description: string; }
function writeDraft(key: string, draft: Draft) {
  try { const serialized = JSON.stringify(draft); if (serialized.length > 150_000) return false; localStorage.setItem(key, serialized); return true; } catch { return false; }
}
function readDraft(key: string): Partial<Draft> | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > 150_000) return;
    const draft = JSON.parse(raw);
    if (!['build', 'paste'].includes(draft.mode) || typeof draft.rawText !== 'string' || draft.rawText.length > 50_000 || !Array.isArray(draft.sessions) || !draft.sessions.length || draft.sessions.length > 10) return;
    if (draft.sessions.some((s: ParsedSession) => !s || typeof s.id !== 'string' || typeof s.sessionTopic !== 'string' || (s.startTime !== undefined && typeof s.startTime !== 'string') || (s.endTime !== undefined && typeof s.endTime !== 'string') || !Array.isArray(s.targets) || s.targets.length > 100 || s.targets.some(t => !t || typeof t.id !== 'string' || typeof t.title !== 'string' || (t.url !== undefined && typeof t.url !== 'string') || (t.tags !== undefined && (!Array.isArray(t.tags) || t.tags.some(tag => typeof tag !== 'string')))))) return;
    return draft;
  } catch { return; }
}
export function StudySessionModal(props: StudySessionModalProps) {
  const { workspaceId = 'local' } = useTaskContext();
  return props.isOpen ? <StudyPlanEditor key={`${workspaceId}:${props.purpose || 'session'}:${props.template?.id || 'new'}`} {...props} /> : null;
}
function StudyPlanEditor({ onClose, onStartSprint, onLaunchSprint, initialMode = 'build', initialSessions, purpose = 'session', template, onSaveTemplate, onCreated }: StudySessionModalProps) {
  const { addStudySessions, projects = [], workspaceId = 'local' } = useTaskContext();
  const today = useTodayStr();
  const draftKey = `flowtask-study-draft:${workspaceId}:${purpose}:${template?.id || 'new'}`;
  const [draft] = useState(() => readDraft(draftKey));
  const [mode, setMode] = useState<'build' | 'paste'>(initialMode === 'paste' ? 'paste' : draft?.mode || initialMode);
  const [rawText, setRawText] = useState(draft?.rawText || '');
  const [sessions, setSessions] = useState<ParsedSession[]>(() => draft?.sessions || (initialSessions?.length ? copyStudySessions(initialSessions) : [newStudySession()]));
  const [date, setDate] = useState(draft?.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : today);
  const activeProjects = projects.filter(project => !project.isArchived);
  const [projectId, setProjectId] = useState(() => activeProjects.some(project => project.id === draft?.projectId) ? draft!.projectId! : activeProjects.find(project => project.id === 'inbox')?.id || activeProjects[0]?.id || 'inbox');
  const [name, setName] = useState(typeof draft?.name === 'string' ? draft.name : template?.title || '');
  const [description, setDescription] = useState(typeof draft?.description === 'string' ? draft.description : template?.description || '');
  const [error, setError] = useState('');
  const [draftStatus, setDraftStatus] = useState(draft ? 'Draft restored on this device.' : 'Your changes stay as a draft on this device.');
  const [saving, setSaving] = useState(false);
  const committing = useRef(false), completed = useRef(false);
  const latestDraft = useRef<Draft | null>(null);
  const launch = onStartSprint || onLaunchSprint;
  useEffect(() => {
    const next = { mode, rawText, sessions, date, projectId, name, description };
    latestDraft.current = next;
    if (completed.current) return;
    const timer = window.setTimeout(() => {
      if (!completed.current && !writeDraft(draftKey, next)) setDraftStatus('Draft could not be saved on this device. Keep this editor open until you finish.');
    }, 200);
    return () => window.clearTimeout(timer);
  }, [draftKey, mode, rawText, sessions, date, projectId, name, description]);
  useEffect(() => {
    const flush = () => { if (!completed.current && latestDraft.current) writeDraft(draftKey, latestDraft.current); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [draftKey]);
  const parsed = useMemo(() => {
    try { return { sessions: parseStudySessions(rawText), error: '' }; }
    catch { return { sessions: [] as ParsedSession[], error: 'This plan could not be read. Try one target per line, or build a session below.' }; }
  }, [rawText]);
  const targetCount = sessions.reduce((sum, session) => sum + session.targets.length, 0);
  const workload = sessions.reduce((sum, session) => sum + session.targets.reduce((minutes, target) => minutes + (target.estimatedMinutes || 0), 0), 0);
  const validation = (() => {
    if (purpose === 'template' && !name.trim()) return 'Give your template a name.';
    if (purpose === 'session' && (!date || !Number.isFinite(new Date(date + 'T12:00:00').getTime()))) return 'Choose a valid study date.';
    if (purpose === 'session' && !activeProjects.some(project => project.id === projectId) && projectId !== 'inbox') return 'Choose an available project.';
    for (const session of sessions) {
      if (!session.sessionTopic.trim()) return 'Give each session a name.';
      if (!session.targets.length) return 'Add at least one target to each session.';
      if (session.targets.some(target => !target.title.trim())) return 'Give each target a title, or remove the empty row.';
      if (session.targets.some(target => !Number.isFinite(target.estimatedMinutes) || (target.estimatedMinutes || 0) < 1 || (target.estimatedMinutes || 0) > 720)) return 'Set each target to between 1 and 720 minutes.';
      if (session.targets.some(target => target.url?.trim() && !safeStudyUrl(target.url))) return 'Use a full http or https link, or clear the link field.';
      if (!!session.startTime !== !!session.endTime || (session.startTime && session.startTime === session.endTime)) return 'Set both start and end times, or clear the time block.';
    }
    return '';
  })();
  const updateSession = (id: string, patch: Partial<ParsedSession>) => setSessions(current => current.map(session => session.id === id ? { ...session, ...patch } : session));
  const updateTarget = (sessionId: string, id: string, patch: Partial<ParsedSessionTarget>) => setSessions(current => current.map(session => session.id === sessionId ? { ...session, targets: session.targets.map(target => target.id === id ? { ...target, ...patch } : target) } : session));
  const moveTarget = (sessionId: string, index: number, direction: number) => setSessions(current => current.map(session => {
    if (session.id !== sessionId) return session;
    const targets = [...session.targets], destination = index + direction;
    if (destination < 0 || destination >= targets.length) return session;
    [targets[index], targets[destination]] = [targets[destination], targets[index]];
    return { ...session, targets };
  }));
  const clearDraft = () => { completed.current = true; try { localStorage.removeItem(draftKey); } catch { /* The plan can save without draft storage. */ } };
  const review = () => {
    if (!parsed.sessions.length) return;
    if (parsed.sessions.length > 10 || parsed.sessions.some(session => session.targets.length > 100)) { setError('Use up to 10 sessions and 100 targets per session. Split larger plans into smaller batches.'); return; }
    setSessions(copyStudySessions(parsed.sessions)); setMode('build'); setError('');
  };
  const commit = (start = false) => {
    if (validation || mode !== 'build' || committing.current) return;
    committing.current = true; setSaving(true); setError('');
    const ready = sessions.map((session, index) => {
      const targets = session.targets.map(target => ({ ...target, title: target.title.trim(), url: safeStudyUrl(target.url), tags: target.tags?.map(tag => tag.trim()).filter(Boolean) }));
      const work = targets.reduce((sum, target) => sum + (target.estimatedMinutes || 0), 0);
      return { ...session, sessionTopic: session.sessionTopic.trim(), sessionNumber: session.sessionNumber || index + 1, targets, durationMinutes: session.startTime && session.endTime ? calculateDurationMinutes(session.startTime, session.endTime) : work, targetPacingMinutes: Math.max(1, Math.round(work / targets.length)) };
    });
    try {
      if (purpose === 'template') {
        if (!onSaveTemplate) throw new Error('Open Templates in Study Hub to save a reusable plan.');
        onSaveTemplate({ id: template?.id || studyId(), title: name.trim(), description: description.trim(), sessions: ready });
      } else {
        const created = addStudySessions(ready, date, projectId);
        if (!created?.length) throw new Error('The sessions were not created. Your draft is still here; try again.');
        clearDraft(); onCreated?.(date); onClose();
        if (start && launch) launch(created[0].id);
        return;
      }
      clearDraft(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your plan. Your draft is still here.'); committing.current = false; setSaving(false); }
  };
  return <Dialog isOpen onClose={onClose} title={purpose === 'template' ? (template ? 'Edit study template' : 'New study template') : 'Plan a study session'} description="Edit your targets, check the plan, then save when you are ready." size="xl" className="study-planner" footer={<>
    <button type="button" className="desk-button" onClick={onClose}>Cancel</button>
    <button type="button" className="desk-button" onClick={() => { clearDraft(); onClose(); }}>Discard draft</button>
    {mode === 'build' && purpose === 'session' && launch && <button type="button" className="desk-button" disabled={!!validation || saving} onClick={() => commit(true)}>Create & start</button>}
    {mode === 'build' && <button type="button" className="desk-button primary" disabled={!!validation || saving} onClick={() => commit()}>{saving ? 'Saving…' : purpose === 'template' ? 'Save template' : `Create ${sessions.length === 1 ? 'session' : `${sessions.length} sessions`}`}</button>}
  </>}>
    <div className="study-plan-modes" role="group" aria-label="Plan input method"><button type="button" aria-pressed={mode === 'build'} onClick={() => setMode('build')}>Build session</button><button type="button" aria-pressed={mode === 'paste'} onClick={() => setMode('paste')}>Paste a plan</button></div>
    {purpose === 'template' ? <div className="study-plan-fields"><label>Template name<input aria-label="Template name" data-autofocus value={name} onChange={e => setName(e.target.value)} maxLength={200} required /></label><label>Description (optional)<input aria-label="Template description" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} /></label></div> : <div className="study-plan-fields"><label>Study date<input aria-label="Study date" type="date" value={date} onChange={e => setDate(e.target.value)} required /></label><label>Project<select aria-label="Study project" value={projectId} onChange={e => setProjectId(e.target.value)}>{!activeProjects.some(project => project.id === 'inbox') && <option value="inbox">Inbox</option>}{activeProjects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label></div>}
    {error && <p className="study-plan-error" role="alert">{error}</p>}
    {mode === 'paste' ? <section className="study-paste-plan">
      <label htmlFor="study-plan-text">Paste or type your plan</label><p>One target per line is enough. Bullets, numbered lists and estimates such as “30m” also work. Name a session with a heading ending in “:”.</p>
      <textarea id="study-plan-text" data-autofocus aria-label="Study plan text" rows={7} maxLength={50000} value={rawText} onChange={e => setRawText(e.target.value)} placeholder={'Math revision:\nReview algebra 20m\nPractice equations 30m\nCheck mistakes 10m'} />
      <div className="study-parse-result" role="status">{parsed.error || (!rawText.trim() ? 'Your targets will appear here as you type.' : parsed.sessions.length ? `${parsed.sessions.length} session${parsed.sessions.length === 1 ? '' : 's'} · ${parsed.sessions.reduce((sum, session) => sum + session.targets.length, 0)} targets found. Review and edit them before creating anything.` : 'No targets found yet. Add a topic or question on its own line.')}</div>
      {parsed.sessions.map(session => <div className="study-parse-preview" key={session.id}><strong>{session.sessionTopic}</strong><ol>{session.targets.map(target => <li key={target.id}>{target.title}<span>{target.estimatedMinutes}m</span></li>)}</ol></div>)}
      <button type="button" className="desk-button primary" disabled={!parsed.sessions.length} onClick={review}>Review & edit targets</button>
    </section> : <div className="study-edit-sessions">
      <p className="study-plan-summary" role="status">{targetCount} target{targetCount === 1 ? '' : 's'} · {workload} minutes of work. {purpose === 'session' ? 'Nothing is added until you create the session.' : 'Templates stay separate from your scheduled sessions.'}</p>
      {sessions.map((session, si) => {
        const work = session.targets.reduce((sum, target) => sum + (target.estimatedMinutes || 0), 0), windowMinutes = session.startTime && session.endTime ? calculateDurationMinutes(session.startTime, session.endTime) : 0;
        return <section className="study-session-editor" key={session.id} aria-label={`Session ${si + 1} editor`}>
          <div className="study-session-heading"><h4>Session {si + 1}</h4>{sessions.length > 1 && <button type="button" className="desk-button" onClick={() => setSessions(current => current.filter(item => item.id !== session.id))}>Remove session {si + 1}</button>}</div>
          <label>Session name<input aria-label={`Session ${si + 1} name`} data-autofocus={purpose === 'session' && si === 0 || undefined} maxLength={200} required value={session.sessionTopic} onChange={e => updateSession(session.id, { sessionTopic: e.target.value })} placeholder="What will you work on?" /></label>
          <details className="study-optional"><summary>Time block <span>{session.startTime && session.endTime ? `${session.startTime}–${session.endTime}` : '(optional)'}</span></summary><div className="study-plan-fields"><label>Start<input aria-label={`Session ${si + 1} start`} type="time" value={session.startTime || ''} onChange={e => updateSession(session.id, { startTime: e.target.value || undefined })} /></label><label>End<input aria-label={`Session ${si + 1} end`} type="time" value={session.endTime || ''} onChange={e => updateSession(session.id, { endTime: e.target.value || undefined })} /></label></div>{(session.startTime || session.endTime) && <button type="button" className="desk-button" onClick={() => updateSession(session.id, { startTime: undefined, endTime: undefined })}>Clear time block</button>}{session.startTime && session.endTime && session.endTime < session.startTime && <p>Ends on the following day.</p>}</details>
          {!!windowMinutes && work > windowMinutes && <p className="study-plan-warning" role="status">Targets need {work - windowMinutes} minutes more than this time block. Adjust the targets or allow more time.</p>}
          <ol className="study-targets">{session.targets.map((target, ti) => <li className="study-target-editor" key={target.id}>
            <div className="study-target-main"><label>Target {ti + 1}<input aria-label={`Session ${si + 1} target ${ti + 1} title`} value={target.title} maxLength={500} required onChange={e => updateTarget(session.id, target.id, { title: e.target.value })} placeholder="A question, chapter, or small task" /></label><label>Minutes<input aria-label={`Session ${si + 1} target ${ti + 1} minutes`} type="number" min={1} max={720} value={target.estimatedMinutes ?? ''} onChange={e => updateTarget(session.id, target.id, { estimatedMinutes: e.target.value === '' ? undefined : Number(e.target.value) })} /></label></div>
            <div className="study-target-tools"><details className="study-optional"><summary>Difficulty, link & tags</summary><div className="study-target-details"><label>Difficulty<select aria-label={`Session ${si + 1} target ${ti + 1} difficulty`} value={target.difficulty || ''} onChange={e => updateTarget(session.id, target.id, { difficulty: (e.target.value || undefined) as ParsedSessionTarget['difficulty'] })}><option value="">Not set</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></label><label>Link<input aria-label={`Session ${si + 1} target ${ti + 1} link`} type="url" value={target.url || ''} onChange={e => updateTarget(session.id, target.id, { url: e.target.value })} maxLength={2000} placeholder="https://…" /></label><label>Tags<input aria-label={`Session ${si + 1} target ${ti + 1} tags`} value={target.tags?.join(', ') || ''} onChange={e => updateTarget(session.id, target.id, { tags: e.target.value.split(',').slice(0, 12).map(tag => tag.trim()) })} maxLength={300} placeholder="Arrays, revision" /></label></div></details><div className="study-target-actions"><button type="button" className="desk-icon-button" aria-label={`Move target ${ti + 1} up in session ${si + 1}`} disabled={ti === 0} onClick={() => moveTarget(session.id, ti, -1)}><ArrowUp size={15} /></button><button type="button" className="desk-icon-button" aria-label={`Move target ${ti + 1} down in session ${si + 1}`} disabled={ti === session.targets.length - 1} onClick={() => moveTarget(session.id, ti, 1)}><ArrowDown size={15} /></button><button type="button" className="desk-icon-button" aria-label={`Remove target ${ti + 1} from session ${si + 1}`} onClick={() => updateSession(session.id, { targets: session.targets.filter(item => item.id !== target.id) })}><Trash2 size={15} /></button></div></div>
          </li>)}</ol><button type="button" className="desk-button" disabled={session.targets.length >= 100} onClick={() => updateSession(session.id, { targets: [...session.targets, newStudyTarget()] })}><Plus size={15} />Add target to session {si + 1}</button>
        </section>;
      })}<button type="button" className="desk-button" disabled={sessions.length >= 10} onClick={() => setSessions(current => [...current, newStudySession()])}><Plus size={15} />Add another session</button>{validation && <p className="study-plan-hint" role="status">{validation}</p>}
    </div>}<p className="study-draft-status" role="status">{draftStatus}</p>
  </Dialog>;
}
