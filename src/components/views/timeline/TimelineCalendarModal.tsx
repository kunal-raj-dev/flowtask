import React, { useState, useEffect } from 'react';
import { Calendar, X, ExternalLink } from 'lucide-react';

interface TimelineCalendarModalProps {
  isOpen: boolean;
  calendarIcsUrl: string;
  onClose: () => void;
  onSave: (url: string) => Promise<void>;
  onDisconnect: () => void;
}

export const TimelineCalendarModal: React.FC<TimelineCalendarModalProps> = ({
  isOpen,
  calendarIcsUrl,
  onClose,
  onSave,
  onDisconnect,
}) => {
  const [icsUrlInput, setIcsUrlInput] = useState(calendarIcsUrl);

  useEffect(() => {
    setIcsUrlInput(calendarIcsUrl);
  }, [calendarIcsUrl]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface-l1)] border border-stone-200/90 dark:border-white/10 rounded-xl p-6 max-w-lg w-full shadow-modal space-y-4 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Private Calendar Overlay
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Sync via iCal / Webcal (.ics link)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Overlay your work or personal meetings alongside your tasks. This connection is{' '}
            <strong className="text-[var(--text-primary)]">read-only and 100% private</strong>—no OAuth permissions required, and events never leave your browser.
          </p>

          <div>
            <label htmlFor="calendar-ics-url-input" className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
              iCal / .ics Feed URL
            </label>
            <input
              type="url"
              id="calendar-ics-url-input"
              name="calendarIcsUrl"
              aria-label="iCal or .ics feed URL"
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              value={icsUrlInput}
              onChange={(e) => setIcsUrlInput(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] focus:border-[var(--color-brand)] text-[var(--text-primary)] outline-none font-mono"
            />
          </div>

          {/* Instructions Callout */}
          <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 text-[11px] text-[var(--text-secondary)] space-y-1.5">
            <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <ExternalLink size={12} />
              Where to find your private link:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-stone-600 dark:text-stone-300">
              <li><strong>Google Calendar:</strong> Settings → Click your calendar → scroll to &quot;Secret address in iCal format&quot;.</li>
              <li><strong>Outlook / Office 365:</strong> Settings → Calendar → Shared calendars → Publish a calendar → copy ICS.</li>
              <li><strong>Apple Calendar:</strong> Share Calendar → toggle Public/Webcal → copy URL.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)]">
          {calendarIcsUrl ? (
            <button
              type="button"
              onClick={() => {
                setIcsUrlInput('');
                onDisconnect();
                onClose();
              }}
              className="text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1"
            >
              Disconnect Feed
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const trimmed = icsUrlInput.trim();
                await onSave(trimmed);
                onClose();
              }}
              className="text-xs font-bold px-4 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white transition-colors shadow-sm"
            >
              Save & Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
