import { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';

export function BackupReminder() {
  const ctx = useTaskContext();
  const [now] = useState(Date.now);
  const saved = Number(ctx.workspacePreferences._lastBackupAt || 0);
  const dismissed = Number(ctx.workspacePreferences._backupReminderDismissedAt || 0);
  if (!(ctx.focusLogs?.length || ctx.tasks.some(task => task.status === 'done')) || now - Math.max(saved, dismissed) < 7 * 86400000) return null;
  return <aside className="desk-notice backup-reminder" aria-label="Keep a backup"><div><strong>A little peace of mind.</strong><p>Your work is saved on this device. Download a backup to keep a separate copy.</p></div><button className="desk-button" onClick={ctx.downloadWorkspaceBackup}>Download backup</button><button className="desk-text-action" onClick={() => ctx.setWorkspacePreference('_backupReminderDismissedAt', now)}>Later</button></aside>;
}
