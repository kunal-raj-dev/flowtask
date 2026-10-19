import { useState } from 'react';
import { downloadFile } from '../../utils/fileExporter';
import { BUILD_LABEL } from '../../utils/buildInfo';

export function FeedbackForm() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const report = () => `FlowTask feedback (${BUILD_LABEL})\n\n${message.trim()}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(report()); setStatus('Copied. Paste it into your group or a message to the person who shared FlowTask.'); }
    catch { setStatus('Copy is unavailable here. Select the feedback text or download the report instead.'); }
  };
  return <section className="v2-settings-section feedback-form">
    <h3>Help shape FlowTask</h3><p>What happened, and what did you expect? You choose where to share your feedback. Nothing is sent automatically.</p>
    <label>Feedback<textarea aria-label="Beta feedback" maxLength={4000} value={message} onChange={event => { setMessage(event.target.value); setStatus(''); }} placeholder="What would make your next session better?"/></label>
    <div className="first-task-actions"><button className="desk-button primary" disabled={!message.trim()} onClick={() => void copy()}>Copy feedback</button>
      {typeof navigator.share === 'function' && <button className="desk-button" disabled={!message.trim()} onClick={() => { void navigator.share({ title: 'FlowTask feedback', text: report() }).then(() => setStatus('Feedback shared.')).catch(error => { if (error?.name !== 'AbortError') setStatus('Sharing is unavailable. Copy or download your feedback instead.'); }); }}>Share feedback</button>}
      <button className="desk-button" disabled={!message.trim()} onClick={() => { downloadFile(JSON.stringify({ build: BUILD_LABEL, feedback: message.trim() }, null, 2), 'flowtask-feedback.json', 'application/json'); setStatus('Report downloaded. You choose where to share it.'); }}>Download feedback report</button>
    </div>{status && <p role="status">{status}</p>}
  </section>;
}
