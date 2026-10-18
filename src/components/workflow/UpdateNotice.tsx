import { useTaskContext } from '../../context/TaskContext';
import { UpdateBanner } from './UpdateBanner';
export function UpdateNotice() {
  const { focusSession } = useTaskContext();
  return <UpdateBanner blocked={Boolean(focusSession)} />;
}
