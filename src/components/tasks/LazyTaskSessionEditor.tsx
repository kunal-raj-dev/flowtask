import { lazy, Suspense } from 'react';
import type { TaskSessionEditorProps } from './TaskSessionEditor';

const Editor = lazy(() => import('./TaskSessionEditor').then(module => ({ default: module.TaskSessionEditor })));

/** Keep the optional editor and its styles out of the initial planner bundle. */
export function LazyTaskSessionEditor(props: TaskSessionEditorProps) {
  return <Suspense fallback={<p role="status" className="p-4 text-xs text-[var(--text-secondary)]">Loading session editor…</p>}>
    <Editor {...props} />
  </Suspense>;
}
