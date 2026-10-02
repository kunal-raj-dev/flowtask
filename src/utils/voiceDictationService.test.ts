import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isVoiceDictationSupported,
  createVoiceDictationSession,
} from './voiceDictationService';

describe('voiceDictationService', () => {
  const originalSpeech = (globalThis as any).SpeechRecognition;
  const originalWebkitSpeech = (globalThis as any).webkitSpeechRecognition;

  afterEach(() => {
    (globalThis as any).SpeechRecognition = originalSpeech;
    (globalThis as any).webkitSpeechRecognition = originalWebkitSpeech;
    vi.restoreAllMocks();
  });

  it('detects unsupported environment gracefully when APIs are absent', () => {
    delete (globalThis as any).SpeechRecognition;
    delete (globalThis as any).webkitSpeechRecognition;

    expect(isVoiceDictationSupported()).toBe(false);

    const callbacks = { onTranscript: vi.fn() };
    const session = createVoiceDictationSession(callbacks);

    expect(session.isSupported).toBe(false);
    expect(session.start()).toBe(false);
  });

  it('initializes and executes speech recognition session when supported', () => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onstart: (() => void) | null = null;
      onresult: ((e: any) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
    }

    (globalThis as any).SpeechRecognition = MockSpeechRecognition;

    expect(isVoiceDictationSupported()).toBe(true);

    const onTranscript = vi.fn();
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onError = vi.fn();

    const session = createVoiceDictationSession({
      onTranscript,
      onStart,
      onEnd,
      onError,
    });

    expect(session.isSupported).toBe(true);
    const started = session.start();
    expect(started).toBe(true);

    // Call stop and abort
    session.stop();
    session.abort();
  });

  it('aggregates final and interim speech transcripts correctly', () => {
    let instance: any = null;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onstart: (() => void) | null = null;
      onresult: ((e: any) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        instance = this;
      }
      stop = vi.fn();
      abort = vi.fn();
    }

    (globalThis as any).webkitSpeechRecognition = MockSpeechRecognition;

    const onTranscript = vi.fn();
    const session = createVoiceDictationSession({ onTranscript });
    session.start();

    expect(instance).not.toBeNull();

    // Simulate speech event
    const mockEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Finish roadmap tomorrow ' }], { isFinal: true }),
        Object.assign([{ transcript: 'at 2pm' }], { isFinal: false }),
      ],
    };

    instance.onresult(mockEvent);

    expect(onTranscript).toHaveBeenCalledWith('Finish roadmap tomorrow at 2pm', false);

    // Simulate final speech event
    const finalEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'Finish roadmap tomorrow at 2pm' }], { isFinal: true }),
      ],
    };
    instance.onresult(finalEvent);
    expect(onTranscript).toHaveBeenCalledWith('Finish roadmap tomorrow at 2pm', true);
  });
});
