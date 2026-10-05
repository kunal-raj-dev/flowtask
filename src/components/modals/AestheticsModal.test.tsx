// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AestheticsModal } from './AestheticsModal';
import { loadDiurnalOverride, loadDiurnalIntensity } from '../../utils/diurnalAura';

const mockSetTheme = vi.fn();
const mockToggleSound = vi.fn();
const mockSetSoundProfile = vi.fn();
const mockClose = vi.fn();

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    theme: 'dark',
    setTheme: mockSetTheme,
    soundEnabled: true,
    toggleSound: mockToggleSound,
    soundProfile: 'zen',
    setSoundProfile: mockSetSoundProfile,
  }),
}));

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    getVolume: () => 0.5,
    setVolume: vi.fn(),
    playClickSound: vi.fn(),
    getCurrentAmbientType: () => 'none',
    getAmbientVolume: () => 0.1,
    setAmbientVolume: vi.fn(),
    startAmbientSound: vi.fn(),
    stopAmbientSound: vi.fn(),
    auditionSound: vi.fn(),
  },
}));

describe('AestheticsModal', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };
    vi.stubGlobal('localStorage', mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all 12 diurnal atmospheric presets across Circadian and Thematic Flow categories', () => {
    render(<AestheticsModal isOpen={true} onClose={mockClose} />);

    // Section title & badges
    expect(screen.getByText('Diurnal Ambient Atmosphere')).toBeDefined();
    expect(screen.getByText('12 Atmospheres')).toBeDefined();

    // Circadian presets
    expect(screen.getByText('Circadian Rhythms (Time-Based)')).toBeDefined();
    expect(screen.getByText('Auto (Circadian Sync)')).toBeDefined();
    expect(screen.getByText('Morning Dawn')).toBeDefined();
    expect(screen.getByText('Midday Zenith')).toBeDefined();
    expect(screen.getByText('Golden Dusk')).toBeDefined();
    expect(screen.getByText('Evening Cosmic')).toBeDefined();
    expect(screen.getByText('Midnight Starlight')).toBeDefined();

    // Thematic Flow presets
    expect(screen.getByText('Thematic Flow Atmospheres (Focus & Mood)')).toBeDefined();
    expect(screen.getByText('Northern Aurora')).toBeDefined();
    expect(screen.getByText('Solar Flare')).toBeDefined();
    expect(screen.getByText('Forest Canopy')).toBeDefined();
    expect(screen.getByText('Cyber Synthwave')).toBeDefined();
    expect(screen.getByText('Oceanic Abyss')).toBeDefined();
    expect(screen.getByText('Twilight Lavender')).toBeDefined();
  });

  it('allows user to adjust atmosphere intensity slider and persists it', () => {
    render(<AestheticsModal isOpen={true} onClose={mockClose} />);

    const slider = screen.getByTitle('Calibrate atmospheric glow intensity') as HTMLInputElement;
    expect(slider).toBeDefined();
    expect(parseFloat(slider.value)).toBe(0.65);

    act(() => {
      fireEvent.change(slider, { target: { value: '0.85' } });
    });

    expect(loadDiurnalIntensity()).toBe(0.85);
    expect(screen.getByText('85%')).toBeDefined();
  });

  it('selects a preset, updates document attributes, and allows resetting to Auto', () => {
    render(<AestheticsModal isOpen={true} onClose={mockClose} />);

    const auroraButton = screen.getByRole('button', { name: /Northern Aurora/i });
    act(() => {
      fireEvent.click(auroraButton);
    });

    expect(loadDiurnalOverride()).toBe('aurora');
    expect(document.documentElement.getAttribute('data-diurnal')).toBe('aurora');
    expect(document.documentElement.style.getPropertyValue('--diurnal-glow-1')).toBe('#10B981');

    // Reset to Auto button should now be visible
    const resetButton = screen.getByRole('button', { name: /Reset to Auto/i });
    expect(resetButton).toBeDefined();

    act(() => {
      fireEvent.click(resetButton);
    });

    expect(loadDiurnalOverride()).toBe('auto');
  });
});
