/**
 * Voice-to-Task Web Speech API dictation service.
 * 100% offline-capable, client-side, zero server requirements, zero API keys.
 */

export interface VoiceDictationCallbacks {
  onTranscript: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface VoiceDictationOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface VoiceDictationSession {
  start: () => boolean;
  stop: () => void;
  abort: () => void;
  isSupported: boolean;
}

function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  const scope = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!scope) return null;
  const win = scope as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/**
 * Checks whether the current environment supports the Web Speech API.
 */
export function isVoiceDictationSupported(): boolean {
  return Boolean(getSpeechRecognitionClass());
}

/**
 * Instantiates a managed speech recognition session with standard lifecycle callbacks.
 */
export function createVoiceDictationSession(
  callbacks: VoiceDictationCallbacks,
  options?: VoiceDictationOptions
): VoiceDictationSession {
  const RecognitionClass = getSpeechRecognitionClass();

  if (!RecognitionClass) {
    return {
      start: () => false,
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  let recognition: SpeechRecognitionInstance | null = null;

  try {
    recognition = new RecognitionClass();
    recognition.continuous = options?.continuous ?? false;
    recognition.interimResults = options?.interimResults ?? true;
    recognition.lang = options?.lang ?? 'en-US';

    recognition.onstart = () => {
      callbacks.onStart?.();
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const activeText = `${final}${interim}`.trim();
      const isComplete = !interim && Boolean(final);
      if (activeText) {
        callbacks.onTranscript(activeText, isComplete);
      }
    };

    recognition.onerror = (event: { error?: string }) => {
      const err = event.error || 'speech_recognition_error';
      if (err === 'no-speech') {
        callbacks.onError?.('No speech detected. Please speak clearly into your microphone.');
      } else if (err === 'not-allowed') {
        callbacks.onError?.('Microphone access was denied. Please allow microphone permissions.');
      } else {
        callbacks.onError?.(`Speech recognition error: ${err}`);
      }
    };

    recognition.onend = () => {
      callbacks.onEnd?.();
    };
  } catch (e) {
    console.warn('Failed to initialize speech recognition:', e);
    return {
      start: () => false,
      stop: () => {},
      abort: () => {},
      isSupported: false,
    };
  }

  return {
    start: () => {
      if (!recognition) return false;
      try {
        recognition.start();
        return true;
      } catch {
        return false;
      }
    },
    stop: () => {
      try {
        recognition?.stop();
      } catch {
        // already stopped
      }
    },
    abort: () => {
      try {
        recognition?.abort();
      } catch {
        // already aborted
      }
    },
    isSupported: true,
  };
}

// Minimal interface definitions for the browser Web Speech API
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}
