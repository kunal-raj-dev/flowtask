// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SettingsDrawer } from './SettingsDrawer';
import { DEFAULT_WORKFLOW_SETTINGS } from '../../types/settings';

const mockUpdateSettings = vi.fn();
const mockResetSettings = vi.fn();
const mockOpenModal = vi.fn();
const mockClose = vi.fn();

let mockSettings = { ...DEFAULT_WORKFLOW_SETTINGS };

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    soundEnabled: true,
    soundProfile: 'zen',
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    resetSettings: mockResetSettings,
    calendarIcsUrl: '',
    setCalendarIcsUrl: vi.fn(),
    refreshCalendarEvents: vi.fn(),
    syncStatus: 'synced',
    lastSyncedAt: 123456789,
    setIsAuthModalOpen: vi.fn(),
  }),
}));

vi.mock('../../context/ModalContext', () => ({
  useModal: () => ({
    openModal: mockOpenModal,
    closeModal: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
  }),
}));

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    playCompletionChime: vi.fn(),
    setSoundEnabled: vi.fn(),
    setSoundProfile: vi.fn(),
    getVolume: () => 0.5,
    setVolume: vi.fn(),
    playClickSound: vi.fn(),
    playToggleSound: vi.fn(),
    getCurrentAmbientType: () => 'none',
    getAmbientVolume: () => 0.1,
    setAmbientVolume: vi.fn(),
    startAmbientSound: vi.fn(),
    stopAmbientSound: vi.fn(),
    auditionSound: vi.fn(),
  },
}));

describe('SettingsDrawer Component', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
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
    mockSettings = { ...DEFAULT_WORKFLOW_SETTINGS };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all 5 tabs and defaults to Workflow & Capacity tab', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    expect(screen.getByRole('button', { name: /workflow & capacity/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /aesthetics & audio/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /calendar feeds/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /data & portability/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /account & sync/i })).toBeDefined();

    // Verify Workflow content is present
    expect(screen.getByText(/Daily Planned Capacity Target/i)).toBeDefined();
    expect(screen.getByText(/Default Task Duration/i)).toBeDefined();
    expect(screen.getByText(/Timeline Visual Canvas Hours/i)).toBeDefined();
    expect(screen.getByText(/Timeline Auto-Schedule Buffer/i)).toBeDefined();
    expect(screen.getByText(/Week Start Day/i)).toBeDefined();
  });

  it('allows user to enter custom study hours beyond 10h (e.g. 12h, 14h)', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    const customInput = screen.getByLabelText(/daily capacity hours target/i);
    expect(customInput).toBeDefined();

    // Type 12 hours for intense study session
    act(() => {
      fireEvent.change(customInput, { target: { value: '12' } });
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ targetWorkCapacityHours: 12 });
  });

  it('allows clicking quick preset chips including 12h Study Marathon', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    const marathonBtn = screen.getByRole('button', { name: /12h \(Study Marathon\)/i });
    expect(marathonBtn).toBeDefined();

    act(() => {
      fireEvent.click(marathonBtn);
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ targetWorkCapacityHours: 12 });
  });

  it('allows adjusting capacity slider and reflects study guidance', () => {
    mockSettings.targetWorkCapacityHours = 12;
    const { rerender } = render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    // Should display marathon pacing profile
    expect(screen.getByText(/exam marathon & deep study sprint mode/i)).toBeDefined();

    const slider = screen.getByRole('slider', { name: /daily planned capacity target/i });
    act(() => {
      fireEvent.change(slider, { target: { value: '14' } });
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ targetWorkCapacityHours: 14 });

    mockSettings.targetWorkCapacityHours = 14;
    rerender(<SettingsDrawer isOpen={true} onClose={mockClose} />);
    expect(screen.getByText(/exam marathon & deep study sprint mode/i)).toBeDefined();
  });

  it('allows user to select preset durations and custom task duration in minutes', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    // Click preset
    const btn45 = screen.getByRole('button', { name: /45 mins/i });
    act(() => {
      fireEvent.click(btn45);
    });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultTaskDuration: 45 });

    // Click custom duration button
    const customBtn = screen.getByRole('button', { name: /\+ custom/i });
    act(() => {
      fireEvent.click(customBtn);
    });

    const customDurationInput = screen.getByLabelText(/custom task duration in minutes/i);
    act(() => {
      fireEvent.change(customDurationInput, { target: { value: '50' } });
      fireEvent.blur(customDurationInput);
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultTaskDuration: 50 });
  });

  it('configures timeline start and end hours with auto-adjustment validation', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    const startSelect = screen.getByLabelText(/timeline start hour/i);
    const endSelect = screen.getByLabelText(/timeline end hour/i);

    // Change start to 9:00 AM
    act(() => {
      fireEvent.change(startSelect, { target: { value: '9' } });
    });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ timelineStartHour: 9 });

    // Change end to 18:00 (6:00 PM)
    act(() => {
      fireEvent.change(endSelect, { target: { value: '18' } });
    });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ timelineEndHour: 18 });

    // If user sets start hour >= end hour (e.g. 21 when end is 20), end automatically pushes
    mockSettings.timelineEndHour = 20;
    act(() => {
      fireEvent.change(startSelect, { target: { value: '21' } });
    });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ timelineStartHour: 21, timelineEndHour: 24 });
  });

  it('configures auto-slot buffer and week start day', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    // Buffer preset
    const buffer15Btn = screen.getByRole('button', { name: /set auto-slot buffer to 15 mins/i });
    act(() => {
      fireEvent.click(buffer15Btn);
    });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ autoSlotBufferMinutes: 15 });

    // Week start Sunday
    const sundayBtn = screen.getByRole('button', { name: /^sunday$/i });
    act(() => {
      fireEvent.click(sundayBtn);
    });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ weekStartDay: 'sunday' });
  });

  it('switches between tabs cleanly', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    // Switch to Aesthetics & Audio
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /aesthetics & audio/i }));
    });
    expect(screen.getByText(/Color Space & Visual Aura/i)).toBeDefined();

    // Switch to Calendar Feeds
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /calendar feeds/i }));
    });
    expect(screen.getByText(/Private \.ics Calendar Overlay/i)).toBeDefined();

    // Switch to Data & Portability
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /data & portability/i }));
    });
    expect(screen.getByText(/Local-First Data Sovereignity/i)).toBeDefined();

    // Switch to Account & Sync
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /account & sync/i }));
    });
    expect(screen.getByText(/Local-First Anonymous/i)).toBeDefined();
  });

  it('renders diurnal atmosphere controls and adjusts intensity in Aesthetics tab', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /aesthetics & audio/i }));
    });

    // Check Diurnal Atmosphere section exists with 12 atmospheres
    expect(screen.getByText('Diurnal Ambient Atmosphere')).toBeDefined();
    expect(screen.getByText('12 Atmospheres')).toBeDefined();
    expect(screen.getByText('Circadian Presets')).toBeDefined();
    expect(screen.getByText('Thematic Flow Atmospheres')).toBeDefined();

    // Check slider
    const slider = screen.getByTitle('Adjust diurnal atmosphere intensity') as HTMLInputElement;
    expect(slider).toBeDefined();

    act(() => {
      fireEvent.change(slider, { target: { value: '0.8' } });
    });
    expect(slider.value).toBe('0.8');
  });

  it('calls onClose when close button is clicked or Escape key pressed', () => {
    render(<SettingsDrawer isOpen={true} onClose={mockClose} />);

    const closeBtn = screen.getByRole('button', { name: /close settings/i });
    act(() => {
      fireEvent.click(closeBtn);
    });
    expect(mockClose).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(mockClose).toHaveBeenCalledTimes(2);
  });
});
