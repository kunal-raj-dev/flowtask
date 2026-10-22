import { useTelemetryConsent, setTelemetryConsent } from '../../hooks/useTelemetryConsent';
import { useState } from "react";
import { FeedbackForm } from "./FeedbackForm";
import { downloadFile } from "../../utils/fileExporter";
import { useTaskContext } from "../../context/TaskContext";
import { useAuth } from "../../context/AuthContext";
import { dbService } from "../../services/dbService";
import { ShieldCheck, Download, AlertTriangle, MessageSquare, ExternalLink } from "lucide-react";

export function PrivacyControls() {
  const { user, signOutUser } = useAuth();
  const ctx = useTaskContext();
  const consent = useTelemetryConsent(ctx.workspaceId);
  const profile = (ctx.workspacePreferences?.profile || {}) as {
    diagnosticsEnabled?: boolean;
  };
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [removeLocal, setRemoveLocal] = useState(false);

  const removeAccount = async () => {
    if (!user || confirmation !== "DELETE") return;
    setPending(true);
    setError("");
    try {
      const { reauthenticateWithPopup, GoogleAuthProvider } =
        await import("firebase/auth");
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      const token = await user.getIdToken(true);
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation }),
      });
      const data = await response
        .json()
        .catch(() => ({
          error:
            "The account deletion endpoint is not available on this installation.",
        }));
      if (!response.ok || !data.deleted)
        throw new Error(data.error || "Account deletion failed.");
      await signOutUser();
      if (removeLocal) await dbService.deleteWorkspace(ctx.workspaceId);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Privacy Guarantees */}
      <section className="v2-settings-section p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] space-y-4">
        <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck size={18} />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Your data, your choice</h3>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Tasks are stored on your device first. Signing in syncs tasks, projects,
          focus history, recipes and safe settings to your Firebase account.
          Personal images, audio, calendar feed URLs and scratchpad contents
          stay solely on this device.
        </p>

        {/* Diagnostics Toggle */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] space-y-2">
          <label className="v2-check flex items-center justify-between cursor-pointer">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Allow anonymous reliability diagnostics
            </span>
            <input
              type="checkbox"
              checked={consent && Boolean(profile.diagnosticsEnabled)}
              onChange={(e) => {
                setTelemetryConsent(ctx.workspaceId, e.target.checked);
                ctx.setWorkspacePreference("profile", {
                  ...profile,
                  diagnosticsEnabled: e.target.checked,
                });
                if (!e.target.checked)
                  localStorage.removeItem(
                    `flowtask-diagnostics:${ctx.workspaceId}`,
                  );
              }}
              className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
            />
          </label>
          <p className="text-[11px] text-[var(--text-muted)]">
            Diagnostics contain event counts, never task titles, notes, feed URLs
            or personal media. Event counts stay on this device. When site monitoring is enabled, consenting also sends numeric performance measurements, error counts, build version and the current view category to this site. Turning this off stops future reports and removes local counts.
          </p>
          {profile.diagnosticsEnabled && (
            <button
              type="button"
              onClick={() =>
                downloadFile(
                  localStorage.getItem(
                    `flowtask-diagnostics:${ctx.workspaceId}`,
                  ) || "{}",
                  "flowtask-diagnostics.json",
                  "application/json",
                )
              }
              className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={12} />
              <span>Export anonymous event counts</span>
            </button>
          )}
        </div>

        {/* Workspace Backup */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={ctx.downloadWorkspaceBackup}
            className="px-3.5 py-2 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] hover:border-amber-500 text-xs font-bold text-[var(--text-primary)] transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Download size={13} className="text-amber-500" />
            <span>Download complete workspace backup</span>
          </button>
          <span className="text-[11px] text-[var(--text-muted)]">
            Personal media files are exported separately in Focus Studio.
          </span>
        </div>

        {/* Legal & Credits Links */}
        <div className="pt-2 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1">
          <a href="/media/audio/CREDITS.md" target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)] underline flex items-center gap-1">
            <span>Audio credits & licenses</span>
            <ExternalLink size={10} />
          </a>
          <span>·</span>
          <a href="/media/CREDITS.md" target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)] underline flex items-center gap-1">
            <span>Background credits</span>
            <ExternalLink size={10} />
          </a>
          <span>·</span>
          <a href="/media/workspace/CREDITS.md" target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)] underline flex items-center gap-1">
            <span>Workspace image credits</span>
            <ExternalLink size={10} />
          </a>
          <span>·</span>
          <a href="/welcome#privacy" target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)] underline flex items-center gap-1">
            <span>Privacy information</span>
            <ExternalLink size={10} />
          </a>
        </div>
      </section>

      {/* Beta Feedback */}
      <details className="group p-4 rounded-2xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)]">
        <summary className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between cursor-pointer list-none">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-indigo-500" />
            <span>Help shape FlowTask (Beta Feedback)</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <div className="pt-4">
          <FeedbackForm />
        </div>
      </details>

      {/* Cloud Account Deletion Danger Zone */}
      {user && !user.isAnonymous && (
        <details className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-3">
          <summary className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 cursor-pointer">
            <AlertTriangle size={14} />
            <span>Delete cloud account</span>
          </summary>
          <div className="pt-3 space-y-3">
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              This permanently deletes your account and cloud workspace. A
              short-lived anonymous deletion marker blocks old sign-in tokens.
              Download a backup first.
            </p>
            <div className="space-y-1">
              <label htmlFor="delete-account-confirm-input" className="text-xs font-semibold text-rose-800 dark:text-rose-300 block">
                Type DELETE to confirm:
              </label>
              <input
                id="delete-account-confirm-input"
                aria-label="Type DELETE to delete account"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--bg-surface-l1)] border border-rose-300 dark:border-rose-800 text-xs text-[var(--text-primary)] outline-none font-mono"
              />
            </div>
            <label className="v2-check flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300 cursor-pointer">
              <input
                type="checkbox"
                checked={removeLocal}
                onChange={(e) => setRemoveLocal(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer"
              />
              <span>Also remove this account&apos;s workspace and personal media from this device</span>
            </label>
            <button
              type="button"
              disabled={confirmation !== "DELETE" || pending}
              onClick={() => void removeAccount()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {pending ? "Deleting…" : "Re-authenticate & delete account"}
            </button>
            {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
          </div>
        </details>
      )}
    </div>
  );
}
