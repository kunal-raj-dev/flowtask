import { useTaskContext } from '../../context/TaskContext';
import { UpdateBanner } from './UpdateBanner';
import { useWorkspaceSelector } from '../../services/workspaceStore';
export function UpdateNotice() {
  const { focusSession } = useTaskContext();
  const unsafeToReload = useWorkspaceSelector(snapshot => snapshot.saving || Boolean(snapshot.error));
  return <UpdateBanner blocked={Boolean(focusSession) || unsafeToReload} />;
}
