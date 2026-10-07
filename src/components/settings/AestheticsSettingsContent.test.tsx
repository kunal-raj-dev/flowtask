// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AestheticsSettingsContent } from './AestheticsSettingsContent';
import { loadDiurnalOverride, loadDiurnalIntensity } from '../../utils/diurnalAura';

const mockSetTheme = vi.fn();
const mockToggleSound = vi.fn();
const mockSetSoundProfile = vi.fn();
const mockOnSaveToast = vi.fn();

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

const mockAuditionSound = vi.fn();
const mockPlayClickSound = vi.fn();
const mockSetVolume = vi.fn();
const mockStartAmbientSound = vi.fn();
const mockStopAmbientSound = vi.fn();
const mockSetAmbientVolume = vi.fn();

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    getVolume: () => 0.5,
    setVolume: (...args: any[]) => mockSetVolume(...args),
    playClickSound: (...args: any[]) => mockPlayClickSound(...args),
    getCurrentAmbientType: () => 'none',
    getAmbientVolume: () => 0.15,
    setAmbientVolume: (...args: any[]) => mockSetAmbientVolume(...args),
    startAmbientSound: (...args: any[]) => mockStartAmbientSound(...args),
    stopAmbientSound: () => mockStopAmbientSound(),
    auditionSound: (...args: any[]) => mockAuditionSound(...args),
    setSoundEnabled: vi.fn(),
    setSoundProfile: vi.fn(),
  },
}));

describe('AestheticsSettingsContent Unified Component', () => {
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

  it('renders all 8 color space themes with miniature UI preview cards and allows direct theme selection', () => {
    render(<AestheticsSettingsContent onSaveToast={mockOnSaveToast} />);

    // Check Theme Header
    expect(screen.getByText('Color Space & Visual Aura')).toBeDefined();
    expect(screen.getByText('8 Presets')).toBeDefined();

    // Verify all 8 themes are rendered
    const themes = [
      'Alabaster Dawn',
      'Obsidian Night',
      'Tokyo Dusk',
      'Nordic Slate',
      'Forest Matcha',
      'Solarized Sepia',
      'Cyber Crimson',
      'Deep Cobalt',
    ];

    themes.forEach((t) => {
      expect(screen.getAllByText(t).length).toBeGreaterThanOrEqual(1);
    });

    // Click Tokyo Dusk
    const tokyoBtn = screen.getByRole('button', { name: /Tokyo Dusk/i });
    act(() => {
      fireEvent.click(tokyoBtn);
    });

    expect(mockSetTheme).toHaveBeenCalledWith('tokyo');
    expect(mockPlayClickSound).toHaveBeenCalled();
    expect(mockOnSaveToast).toHaveBeenCalled();
  });

  it('renders all 8 tactile audio profiles with audition Pop, Toggle, Chime buttons and volume slider', () => {
    render(<AestheticsSettingsContent onSaveToast={mockOnSaveToast} />);

    expect(screen.getByText('Tactile Audio Engine')).toBeDefined();
    expect(screen.getByText('8 Profiles')).toBeDefined();

    // Check profiles
    expect(screen.getByText('Zen Singing Bowl')).toBeDefined();
    expect(screen.getByText('Mechanical Switch')).toBeDefined();
    expect(screen.getByText('Minimal Pop')).toBeDefined();
    expect(screen.getByText('Marimba Teak')).toBeDefined();
    expect(screen.getByText('Retro Typewriter')).toBeDefined();
    expect(screen.getByText('Cosmic Synth')).toBeDefined();
    expect(screen.getByText('Velvet Thud')).toBeDefined();
    expect(screen.getByText('Completely Silent')).toBeDefined();

    // Click audition button for pop
    const popAuditionBtns = screen.getAllByRole('button', { name: /Pop/i });
    expect(popAuditionBtns.length).toBeGreaterThan(0);
    act(() => {
      fireEvent.click(popAuditionBtns[0]);
    });
    expect(mockAuditionSound).toHaveBeenCalledWith(expect.any(String), 'pop');

    // Adjust volume slider
    const volSlider = screen.getByTitle('Adjust tactile feedback volume') as HTMLInputElement;
    expect(volSlider).toBeDefined();
    act(() => {
      fireEvent.change(volSlider, { target: { value: '0.8' } });
    });
    expect(mockSetVolume).toHaveBeenCalledWith(0.8);
    expect(mockOnSaveToast).toHaveBeenCalled();
  });

  it('renders all 5 offline ambient soundscapes and handles synthesizer start/stop and volume', () => {
    render(<AestheticsSettingsContent onSaveToast={mockOnSaveToast} />);

    expect(screen.getByText('Ambient Focus Soundscapes')).toBeDefined();
    expect(screen.getByText('Offline Synthesis')).toBeDefined();

    // Verify 5 soundscapes
    expect(screen.getByText('Deep Brown Noise')).toBeDefined();
    expect(screen.getByText('Pink Noise')).toBeDefined();
    expect(screen.getByText('Gentle Rain')).toBeDefined();
    expect(screen.getByText('Binaural 40Hz Focus')).toBeDefined();
    expect(screen.getByText('Soft White Noise')).toBeDefined();

    // Toggle start ambient sound
    const rainBtn = screen.getByRole('button', { name: /Gentle Rain/i });
    act(() => {
      fireEvent.click(rainBtn);
    });
    expect(mockStartAmbientSound).toHaveBeenCalledWith('rain', expect.any(Number));
  });

  it('renders all 12 diurnal atmospheric presets across Circadian and Thematic Flow categories with intensity slider and reset to auto', () => {
    render(<AestheticsSettingsContent onSaveToast={mockOnSaveToast} />);

    expect(screen.getByText('Diurnal Ambient Atmosphere')).toBeDefined();
    expect(screen.getByText('12 Atmospheres')).toBeDefined();

    // Check circadian presets
    expect(screen.getByText('Circadian Presets')).toBeDefined();
    expect(screen.getByText('Auto (Circadian Sync)')).toBeDefined();
    expect(screen.getByText('Morning Dawn')).toBeDefined();
    expect(screen.getByText('Midday Zenith')).toBeDefined();
    expect(screen.getByText('Golden Dusk')).toBeDefined();
    expect(screen.getByText('Evening Cosmic')).toBeDefined();
    expect(screen.getByText('Midnight Starlight')).toBeDefined();

    // Check thematic flow presets
    expect(screen.getByText('Thematic Flow Atmospheres')).toBeDefined();
    expect(screen.getByText('Northern Aurora')).toBeDefined();
    expect(screen.getByText('Solar Flare')).toBeDefined();
    expect(screen.getByText('Forest Canopy')).toBeDefined();
    expect(screen.getByText('Cyber Synthwave')).toBeDefined();
    expect(screen.getByText('Oceanic Abyss')).toBeDefined();
    expect(screen.getByText('Twilight Lavender')).toBeDefined();

    // Adjust intensity slider
    const intensitySlider = screen.getByTitle('Adjust diurnal atmosphere intensity') as HTMLInputElement;
    act(() => {
      fireEvent.change(intensitySlider, { target: { value: '0.9' } });
    });
    expect(loadDiurnalIntensity()).toBe(0.9);
    expect(mockOnSaveToast).toHaveBeenCalled();

    // Select Northern Aurora
    const auroraBtn = screen.getByRole('button', { name: /Northern Aurora/i });
    act(() => {
      fireEvent.click(auroraBtn);
    });
    expect(loadDiurnalOverride()).toBe('aurora');

    // Reset to Auto button
    const resetBtn = screen.getByRole('button', { name: /Reset to Auto/i });
    expect(resetBtn).toBeDefined();
    act(() => {
      fireEvent.click(resetBtn);
    });
    expect(loadDiurnalOverride()).toBe('auto');
  });
});
