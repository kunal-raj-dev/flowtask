import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusSession } from "../../types/task";
import { writeFocusCheckpoint } from "../../services/focusCheckpoint";

export function LandingUpdateNotice() {
  return <UpdateBanner landing />;
}

export function UpdateBanner({
  blocked,
  landing = false,
  isSessionActive = false,
  unsafeToReload = false,
  workspaceId = "local",
  focusSession = null,
}: {
  blocked?: boolean;
  landing?: boolean;
  isSessionActive?: boolean;
  unsafeToReload?: boolean;
  workspaceId?: string;
  focusSession?: FocusSession | null;
}) {
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const isBlocked = blocked !== undefined ? blocked : (isSessionActive || unsafeToReload);
  const wasActiveRef = useRef(isSessionActive);

  useEffect(() => {
    const notify = () => setAvailable(true);
    window.addEventListener("flowtask:update-available", notify);
    void navigator.serviceWorker?.getRegistration().then((r) => {
      if (r?.waiting && navigator.serviceWorker.controller) notify();
    });
    return () =>
      window.removeEventListener("flowtask:update-available", notify);
  }, []);

  const apply = useCallback(async (forceWithCheckpoint = false) => {
    if ((isBlocked && !forceWithCheckpoint) || landing) return;
    try {
      if (forceWithCheckpoint && focusSession) {
        writeFocusCheckpoint(workspaceId, focusSession);
      }
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg?.waiting) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => location.reload(),
          { once: true },
        );
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } else {
        location.reload();
      }
    } catch {
      setError("Update could not start. Try again after saving your work.");
    }
  }, [isBlocked, landing, focusSession, workspaceId]);

  // Auto-update automatically as soon as an active focus session finishes
  useEffect(() => {
    if (wasActiveRef.current && !isSessionActive && available && !unsafeToReload && !landing) {
      void apply();
    }
    wasActiveRef.current = isSessionActive;
  }, [isSessionActive, available, unsafeToReload, landing, apply]);

  if (!available) return null;

  return (
    <aside className="v2-update" role="status">
      <span>
        {isSessionActive
          ? "An update is ready. FlowTask will automatically update when your focus session completes."
          : isBlocked
            ? "An update is ready. Finish your focus session and save pending changes before updating."
            : "A fresh FlowTask is ready."}
        {error ? ` · ${error}` : ""}
      </span>
      {landing ? (
        <a href="/app">Open workspace to update</a>
      ) : isSessionActive ? (
        <button
          type="button"
          onClick={() => void apply(true)}
          title="Save session state and update now"
        >
          Update now (save & reload)
        </button>
      ) : (
        <button
          type="button"
          disabled={isBlocked}
          onClick={() => void apply()}
        >
          Update now
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss update notice"
        onClick={() => setAvailable(false)}
      >
        ×
      </button>
    </aside>
  );
}
