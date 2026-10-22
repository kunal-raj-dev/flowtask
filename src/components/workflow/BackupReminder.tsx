import { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import '../../styles/backup-reminder.css';

export function BackupReminder() {
  const ctx = useTaskContext();
  const [now] = useState(Date.now);
  const saved = Number(ctx.workspacePreferences._lastBackupAt || 0);
  const dismissed = Number(ctx.workspacePreferences._backupReminderDismissedAt || 0);
  if (!(ctx.focusLogs?.length || ctx.tasks.some(task => task.status === 'done')) || now - Math.max(saved, dismissed) < 7 * 86400000) return null;
  return <aside className="backup-reminder" aria-label="Keep a backup"><div><strong>Keep a separate backup.</strong><p>Device checkpoints help with mistakes; a downloaded copy protects against device loss.</p></div><button className="desk-button" aria-label="Download backup" onClick={ctx.downloadWorkspaceBackup}><span className="backup-label-full">Download backup</span><span className="backup-label-short">Back up</span></button><button className="backup-reminder-dismiss" aria-label="Remind me about backups later" onClick={() => ctx.setWorkspacePreference('_backupReminderDismissedAt', now)}>Later</button></aside>;
}
