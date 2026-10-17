import { useState } from "react";
import { downloadFile } from "../../utils/fileExporter";
export function FeedbackForm() {
  const [message, setMessage] = useState(""),
    [saved, setSaved] = useState(false);
  return (
    <section className="v2-settings-section">
      <h3>Help shape FlowTask</h3>
      <p>
        Tell us what happened and what you expected. Download a report to share
        with the person running this installation. Nothing is sent
        automatically.
      </p>
      <label style={{ display: "block" }}>
        Feedback
        <textarea
          aria-label="Beta feedback"
          maxLength={4000}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setSaved(false);
          }}
          placeholder="What would make your next session better?"
          style={{
            display: "block",
            width: "100%",
            padding: 12,
            border: "1px solid var(--border-hairline,#c4c9bc)",
            borderRadius: 10,
            marginTop: 10,
            minHeight: 100,
          }}
        />
      </label>
      <button
        disabled={!message.trim()}
        onClick={() => {
          downloadFile(
            JSON.stringify(
              { version: "2.0.0-beta.1", feedback: message.trim() },
              null,
              2,
            ),
            "flowtask-feedback.json",
            "application/json",
          );
          setSaved(true);
        }}
      >
        Download feedback report
      </button>
      {saved && (
        <p role="status">Report downloaded. You choose where to share it.</p>
      )}
    </section>
  );
}
