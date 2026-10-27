import { useTaskContext } from '../../context/TaskContext';
import { UpdateBanner } from './UpdateBanner';
import { useWorkspaceSelector } from '../../services/workspaceStore';

export function UpdateNotice() {
  const { focusSession, workspaceId } = useTaskContext();
  const unsafeToReload = useWorkspaceSelector(snapshot => snapshot.saving || Boolean(snapshot.error));
  const isSessionActive = Boolean(
    focusSession && (focusSession.state === 'running' || focusSession.state === 'paused')
  );

  return (
    <UpdateBanner
      workspaceId={workspaceId}
      focusSession={focusSession}
      isSessionActive={isSessionActive}
      unsafeToReload={unsafeToReload}
    />
  );
}
