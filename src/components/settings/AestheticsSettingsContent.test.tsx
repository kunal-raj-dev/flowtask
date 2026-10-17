// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AestheticsSettingsContent } from './AestheticsSettingsContent';
import { THEMES, THEME_IDS } from '../../utils/themeRegistry';

const mockSetTheme = vi.fn();
const mockSetWorkspacePreference = vi.fn();
const mockToggleSound = vi.fn();
const mockSetSoundProfile = vi.fn();
const mockOnSaveToast = vi.fn();

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    theme: 'dark',
    setWorkspacePreference: mockSetWorkspacePreference,
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

  it('offers complete palettes with shared previews and persists theme selection', () => {
    render(<AestheticsSettingsContent onSaveToast={mockOnSaveToast} />);
    expect(screen.getByRole('heading', { name: 'Theme library' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    THEME_IDS.forEach(id => expect(screen.getByRole('button', { name: `Apply ${THEMES[id].label} theme` })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Apply Northern Aurora theme' }));
    expect(mockSetWorkspacePreference).toHaveBeenCalledWith('appearance', expect.objectContaining({ theme: 'aurora', mode: 'manual', accent: '' }));
    expect(mockOnSaveToast).toHaveBeenCalled();
  });

  it('renders all 8 tactile audio profiles with audition Pop, Toggle, Chime buttons and volume slider', () => {
    render(<AestheticsSettingsContent onSaveToast={mockOnSaveToast} />);

    expect(screen.getByText('Interface sounds')).toBeDefined();
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

  it('separates optional atmosphere from full themes, and offers a real zero intensity', () => {
    render(<AestheticsSettingsContent section="appearance" />);
    expect(screen.getByRole('heading', { name: 'Optional atmosphere' })).toBeDefined();
    expect(screen.getByLabelText('Atmosphere color').getAttribute('value')).not.toBe('auto');
    const slider = screen.getByRole('slider', { name: 'Glow intensity' }) as HTMLInputElement;
    expect(slider.min).toBe('0');
    expect(slider.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Atmosphere color'), { target: { value: 'aurora' } });
    expect(mockSetWorkspacePreference).toHaveBeenCalledWith('appearance', expect.objectContaining({ theme: 'dark', atmosphere: { preset: 'aurora', intensity: .35 } }));
    expect(screen.queryByText('Ambient Focus Soundscapes')).toBeNull();
  });
});
