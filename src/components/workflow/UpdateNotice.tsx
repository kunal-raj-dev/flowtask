import { useEffect, useState } from "react";
import { useTaskContext } from "../../context/TaskContext";
export function UpdateNotice() {
  const { focusSession } = useTaskContext();
  const [available, setAvailable] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const notify = () => setAvailable(true);
    window.addEventListener("flowtask:update-available", notify);
    void navigator.serviceWorker?.getRegistration().then((r) => {
      if (r?.waiting && navigator.serviceWorker.controller) notify();
    });
    return () =>
      window.removeEventListener("flowtask:update-available", notify);
  }, []);
  const apply = async () => {
    if (focusSession) return;
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg?.waiting) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => location.reload(),
          { once: true },
        );
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } else location.reload();
    } catch {
      setError("Update could not start. Try again after saving your work.");
    }
  };
  if (!available) return null;
  return (
    <aside className="v2-update" role="status">
      <span>
        {focusSession
          ? "An update is ready. It will wait until your session finishes."
          : "A fresh FlowTask is ready."}
        {error}
      </span>
      <button disabled={Boolean(focusSession)} onClick={() => void apply()}>
        Update now
      </button>
      <button
        aria-label="Dismiss update notice"
        onClick={() => setAvailable(false)}
      >
        ×
      </button>
    </aside>
  );
}
