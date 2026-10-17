import type { FocusSession } from '../types/task';
export interface FocusCheckpoint { at: number; finished: boolean; session: FocusSession | null }
const key=(id:string)=>`flowtask-focus-checkpoint:${id}`;
export function readFocusCheckpoint(id:string):FocusCheckpoint|null {
  try {const cp=JSON.parse(localStorage.getItem(key(id)) || 'null') as FocusCheckpoint|null;
    if(!cp || !Number.isFinite(cp.at) || typeof cp.finished!=='boolean') return null;
    const s=cp.session;
    if(s && (s.workspaceId!==id || typeof s.id!=='string' || !Number.isFinite(s.accumulatedElapsedMs) || !Number.isFinite(s.startedAt) || !['running','paused','completed'].includes(s.state))) return null;
    return cp;
  }catch{return null;}
}
/** A small synchronous checkpoint protects lifecycle actions before the IndexedDB queue drains. */
export function writeFocusCheckpoint(id:string,session:FocusSession|null,finished=false):number {
  const at=Math.max(Date.now(),(readFocusCheckpoint(id)?.at || 0)+1);
  try {localStorage.setItem(key(id),JSON.stringify({at,session,finished}));}catch{/* IndexedDB and visible save errors remain the durable fallback. */}
  return at;
}
