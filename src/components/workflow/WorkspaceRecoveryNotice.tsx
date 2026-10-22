import { useState } from 'react';
import { X } from 'lucide-react';

export function WorkspaceRecoveryNotice({ error, download }: { error: string; download: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return <aside className="workspace-recovery-notice" role="status" aria-label="Workspace recovery notice" style={{ alignItems: 'flex-start', gap: 8 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
      <p style={{ flex: '1 1 240px', margin: 0 }}>{error}</p>
      <button type="button" className="desk-button" onClick={download}>Download backup</button>
    </div>
    <button type="button" className="desk-icon-button" aria-label="Dismiss recovery notice" title="Dismiss notice" style={{ width: 44, height: 44, flexShrink: 0 }} onClick={() => setDismissed(true)}>
      <X size={20} aria-hidden="true" />
    </button>
  </aside>;
}
