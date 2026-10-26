// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FocusAudioPanel } from './FocusAudioPanel';
import { studioAudio } from '../../services/studioAudio';
import { DEFAULT_STUDIO } from '../../types/studio';
import type { MediaCatalog, StudioPreferences } from '../../types/studio';

vi.mock('../../services/studioAudio', () => ({
  studioAudio: {
    unlock: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn(),
  },
}));

describe('FocusAudioPanel', () => {
  const mockMedia: MediaCatalog = {
    scenes: [],
    audio: [
      {
        id: 'ambient-forest',
        title: 'Morning Forest',
        category: 'ambient',
        src: '/media/audio/forest.mp3',
        license: 'CC0',
        creator: 'FlowTask',
        sourceUrl: 'https://example.com/forest',
      },
      {
        id: 'music-lofi',
        title: 'Lo-Fi Chill',
        category: 'music',
        genre: 'Lo-Fi',
        src: '/media/audio/lofi.mp3',
        license: 'CC-BY',
        creator: 'Artist A',
        sourceUrl: 'https://example.com/lofi',
      },
      {
        id: 'music-classical',
        title: 'Moonlight Sonata',
        category: 'music',
        genre: 'Classical',
        src: '/media/audio/classical.mp3',
        license: 'Public Domain',
        creator: 'Beethoven',
      },
    ],
  };

  const MockRange: React.FC<{
    label: string;
    value: number;
    onChange: (v: number) => void;
    onPreview?: (v: number) => void;
  }> = ({ label, value, onChange, onPreview }) => (
    <div data-testid={`range-${label}`}>
      <span>{label}</span>
      <input
        type="range"
        aria-label={label}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onPreview?.(v);
          onChange(v);
        }}
      />
    </div>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ambient layers, master volume and music tracks', () => {
    const preferences: StudioPreferences = {
      ...DEFAULT_STUDIO,
      masterVolume: 0.6,
      layers: [],
    };

    render(
      <FocusAudioPanel
        preferences={preferences}
        media={mockMedia}
        onUpdate={vi.fn()}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    expect(screen.getByText(/A little rain, a little rhythm/i)).toBeDefined();
    expect(screen.getByTestId('range-Master volume')).toBeDefined();
    expect(screen.getByText('Morning Forest')).toBeDefined();
    expect(screen.getByText('Brown noise')).toBeDefined();
    expect(screen.getByText('Lo-Fi Chill')).toBeDefined();
    expect(screen.getByText('Moonlight Sonata')).toBeDefined();
  });

  it('unlocks audio and toggles layer on when clicked', () => {
    const onUpdate = vi.fn();
    const preferences: StudioPreferences = {
      ...DEFAULT_STUDIO,
      layers: [],
    };

    render(
      <FocusAudioPanel
        preferences={preferences}
        media={mockMedia}
        onUpdate={onUpdate}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    const forestBtn = screen.getByRole('button', { name: /Morning Forest/i });
    fireEvent.click(forestBtn);

    expect(studioAudio.unlock).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith({
      layers: [{ id: 'ambient-forest', volume: 0.35, muted: false }],
    });
  });

  it('removes an existing layer when clicked again', () => {
    const onUpdate = vi.fn();
    const preferences: StudioPreferences = {
      ...DEFAULT_STUDIO,
      layers: [
        { id: 'ambient-forest', volume: 0.4, muted: false },
        { id: 'brown', volume: 0.3, muted: false },
      ],
    };

    render(
      <FocusAudioPanel
        preferences={preferences}
        media={mockMedia}
        onUpdate={onUpdate}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    const forestBtn = screen.getByRole('button', { name: /Morning Forest/i });
    fireEvent.click(forestBtn);

    expect(onUpdate).toHaveBeenCalledWith({
      layers: [{ id: 'brown', volume: 0.3, muted: false }],
    });
  });

  it('warns user and does not add a 5th layer when 4 layers are active', () => {
    const onUpdate = vi.fn();
    const onMessage = vi.fn();
    const preferences: StudioPreferences = {
      ...DEFAULT_STUDIO,
      layers: [
        { id: 'brown', volume: 0.3, muted: false },
        { id: 'pink', volume: 0.3, muted: false },
        { id: 'white', volume: 0.3, muted: false },
        { id: 'ambient-forest', volume: 0.4, muted: false },
      ],
    };

    render(
      <FocusAudioPanel
        preferences={preferences}
        media={mockMedia}
        onUpdate={onUpdate}
        onUpload={vi.fn()}
        onMessage={onMessage}
        Range={MockRange}
      />
    );

    // Try to click an unselected synthetic layer or asset
    // Here all 4 are selected, but let's click one that isn't selected (create a synthetic mock)
    const extraMedia: MediaCatalog = {
      ...mockMedia,
      audio: [
        ...mockMedia.audio,
        {
          id: 'ambient-rain',
          title: 'Gentle Rain',
          category: 'ambient',
          src: '/rain.mp3',
          license: 'CC0',
          creator: 'Nature',
        },
      ],
    };

    render(
      <FocusAudioPanel
        preferences={preferences}
        media={extraMedia}
        onUpdate={onUpdate}
        onUpload={vi.fn()}
        onMessage={onMessage}
        Range={MockRange}
      />
    );

    const rainBtn = screen.getByText('Gentle Rain').closest('button')!;
    fireEvent.click(rainBtn);

    expect(onMessage).toHaveBeenCalledWith(
      'You can mix up to four ambient layers. Remove a layer to add this one.'
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('handles mute and solo actions on active layers', () => {
    const onUpdate = vi.fn();
    const preferences: StudioPreferences = {
      ...DEFAULT_STUDIO,
      layers: [
        { id: 'ambient-forest', volume: 0.5, muted: false },
        { id: 'brown', volume: 0.3, muted: false },
      ],
    };

    render(
      <FocusAudioPanel
        preferences={preferences}
        media={mockMedia}
        onUpdate={onUpdate}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    // Mute ambient-forest
    const muteBtn = screen.getByLabelText('Mute ambient-forest');
    fireEvent.click(muteBtn);

    expect(onUpdate).toHaveBeenCalledWith({
      layers: [
        { id: 'ambient-forest', volume: 0.5, muted: true },
        { id: 'brown', volume: 0.3, muted: false },
      ],
    });

    // Solo brown noise
    const soloBtn = screen.getByLabelText('Solo brown');
    fireEvent.click(soloBtn);

    expect(onUpdate).toHaveBeenCalledWith({
      layers: [
        { id: 'ambient-forest', volume: 0.5, muted: true },
        { id: 'brown', volume: 0.3, muted: false },
      ],
    });
  });

  it('resets layers and music on choose silence click', () => {
    const onUpdate = vi.fn();
    const preferences: StudioPreferences = {
      ...DEFAULT_STUDIO,
      musicId: 'music-lofi',
      layers: [{ id: 'brown', volume: 0.5, muted: false }],
    };

    render(
      <FocusAudioPanel
        preferences={preferences}
        media={mockMedia}
        onUpdate={onUpdate}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    const silenceBtn = screen.getByText('Choose silence');
    fireEvent.click(silenceBtn);

    expect(onUpdate).toHaveBeenCalledWith({
      layers: [],
      musicId: null,
    });
  });

  it('selects and deselects music track on click', () => {
    const onUpdate = vi.fn();
    const preferences: StudioPreferences = {
      ...DEFAULT_STUDIO,
      musicId: null,
    };

    const { rerender } = render(
      <FocusAudioPanel
        preferences={preferences}
        media={mockMedia}
        onUpdate={onUpdate}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    const lofiBtn = screen.getByText('Lo-Fi Chill').closest('button')!;
    fireEvent.click(lofiBtn);

    expect(onUpdate).toHaveBeenCalledWith({ musicId: 'music-lofi' });

    // When clicked again while selected, it should deselect
    rerender(
      <FocusAudioPanel
        preferences={{ ...preferences, musicId: 'music-lofi' }}
        media={mockMedia}
        onUpdate={onUpdate}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    const selectedBtn = screen.getByText('Lo-Fi Chill').closest('button')!;
    fireEvent.click(selectedBtn);

    expect(onUpdate).toHaveBeenCalledWith({ musicId: null });
  });

  it('filters music tracks by genre dropdown', () => {
    const preferences: StudioPreferences = {
      ...DEFAULT_STUDIO,
    };

    render(
      <FocusAudioPanel
        preferences={preferences}
        media={mockMedia}
        onUpdate={vi.fn()}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    const select = screen.getByLabelText('Music genre') as HTMLSelectElement;
    expect(screen.getByText('Lo-Fi Chill')).toBeDefined();
    expect(screen.getByText('Moonlight Sonata')).toBeDefined();

    fireEvent.change(select, { target: { value: 'Classical' } });

    expect(screen.queryByText('Lo-Fi Chill')).toBeNull();
    expect(screen.getByText('Moonlight Sonata')).toBeDefined();
  });

  it('displays music missing notice when prop is true', () => {
    render(
      <FocusAudioPanel
        preferences={DEFAULT_STUDIO}
        media={mockMedia}
        musicMissing={true}
        onUpdate={vi.fn()}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    expect(screen.getByText(/Your personal music is only available on the device/i)).toBeDefined();
  });

  it('renders concurrent soundscapes mixer and toggles Rain, Brown/Pink Noise, and Binaural Beats', () => {
    render(
      <FocusAudioPanel
        preferences={DEFAULT_STUDIO}
        media={mockMedia}
        onUpdate={vi.fn()}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    expect(screen.getByText('Synthesized Soundscapes')).toBeDefined();

    // Toggle Rain Sound
    const rainBtn = screen.getByText('Rain Sound').closest('button')!;
    fireEvent.click(rainBtn);
    expect(screen.getByTestId('range-Rain Volume')).toBeDefined();

    // Toggle Brown Noise
    const brownBtn = screen.getByText('Brown Noise').closest('button')!;
    fireEvent.click(brownBtn);
    expect(screen.getByTestId('range-Brown Noise Volume')).toBeDefined();

    // Switch to Pink Noise
    const pinkToggle = screen.getByRole('button', { name: 'Pink' });
    fireEvent.click(pinkToggle);
    expect(screen.getByText('Pink Noise')).toBeDefined();
    expect(screen.getByTestId('range-Pink Noise Volume')).toBeDefined();

    // Toggle Binaural Beats
    const binauralBtn = screen.getByText(/Binaural Beats/i).closest('button')!;
    fireEvent.click(binauralBtn);
    expect(screen.getByTestId('range-Binaural Beats Volume')).toBeDefined();
  });
});
