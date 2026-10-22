// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { useTactileAudioClicks } from './useTactileAudioClicks';
import { audioEngine } from '../utils/audioEngine';

describe('optional tactile feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(audioEngine, 'playClickSound').mockImplementation(() => {});
  });
  afterEach(() => { cleanup(); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('lets the action paint before initializing audio and coalesces feedback', () => {
    renderHook(() => useTactileAudioClicks());
    const button = document.createElement('button');
    document.body.append(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(audioEngine.playClickSound).not.toHaveBeenCalled();
    act(() => vi.runAllTimers());
    expect(audioEngine.playClickSound).toHaveBeenCalledTimes(1);
  });

  it('cancels pending feedback when the account surface unmounts', () => {
    const { unmount } = renderHook(() => useTactileAudioClicks());
    const button = document.createElement('button');
    document.body.append(button);
    fireEvent.click(button);
    unmount();
    act(() => vi.runAllTimers());
    expect(audioEngine.playClickSound).not.toHaveBeenCalled();
  });

  it('keeps password typing silent even with keyboard sounds enabled', () => {
    renderHook(() => useTactileAudioClicks(true, true));
    const input = document.createElement('input');
    input.type = 'password';
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'a' });
    act(() => vi.runAllTimers());
    expect(audioEngine.playClickSound).not.toHaveBeenCalled();
  });
});
