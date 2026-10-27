import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DesktopHeader } from "../src/components/layout/DesktopHeader";
import { FocusAudioPanel } from "../src/components/focus/FocusAudioPanel";
import { DEFAULT_STUDIO } from "../src/types/studio";
import type { MediaCatalog, MediaAsset } from "../src/types/studio";

describe("DesktopHeader Frontier Upgrade", () => {
  it("renders the Focus Studio trigger button with accessible label and responds to clicks", () => {
    const handleOpenFocus = vi.fn();
    render(
      <DesktopHeader
        viewTitle="Today"
        isSidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
        onOpenFocus={handleOpenFocus}
        onOpenAuth={vi.fn()}
        onQuickAdd={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onOpenSettings={vi.fn()}
        syncStatus="synced"
        user={null}
        isAnonymous={true}
      />
    );

    const focusBtn = screen.getByRole("button", { name: "Open Focus Studio" });
    expect(focusBtn).toBeDefined();
    expect(focusBtn.textContent).toContain("Focus Studio");

    fireEvent.click(focusBtn);
    expect(handleOpenFocus).toHaveBeenCalledTimes(1);
  });

  it("renders the Command Palette search button with keyboard shortcut hint", () => {
    const handleOpenCommandPalette = vi.fn();
    render(
      <DesktopHeader
        viewTitle="Horizon"
        isSidebarCollapsed={true}
        onToggleSidebar={vi.fn()}
        onOpenFocus={vi.fn()}
        onOpenAuth={vi.fn()}
        onQuickAdd={vi.fn()}
        onOpenCommandPalette={handleOpenCommandPalette}
        onOpenSettings={vi.fn()}
        syncStatus="offline"
        user={null}
        isAnonymous={true}
      />
    );

    const searchBtn = screen.getByRole("button", { name: "Search and commands" });
    expect(searchBtn).toBeDefined();
    expect(searchBtn.textContent).toContain("Search everything…");

    fireEvent.click(searchBtn);
    expect(handleOpenCommandPalette).toHaveBeenCalledTimes(1);
  });
});

describe("FocusAudioPanel Frontier Upgrade", () => {
  const mockAudio: MediaAsset[] = [
    {
      id: "rain-ambient",
      title: "Kyoto Rain",
      category: "ambient",
      src: "/audio/rain.mp3",
      license: "CC0",
      creator: "FlowTask Studio",
      genre: "Ambient",
    },
    {
      id: "focus-music-1",
      title: "Deep Solitude",
      category: "music",
      src: "/audio/music.mp3",
      license: "CC0",
      creator: "Zen Master",
      genre: "Ambient",
    },
  ];

  const mockCatalog: MediaCatalog = {
    scenes: [],
    audio: mockAudio,
  };

  const MockRange = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div data-testid={`range-${label}`}>
      <span>{label}</span>
      <input
        type="range"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );

  it("renders soundscape synthesizer controls including concurrent mixer and master volume", () => {
    const handleUpdate = vi.fn();
    render(
      <FocusAudioPanel
        preferences={DEFAULT_STUDIO}
        media={mockCatalog}
        onUpdate={handleUpdate}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    expect(screen.getByText("Master volume")).toBeDefined();
    expect(screen.getByText("Synthesized Soundscapes")).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Rain/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /Brown/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /Binaural Beats/i })).toBeDefined();
  });

  it("renders soundwave visualizer when a music track or ambient layer is selected", () => {
    const preferencesWithLayer = {
      ...DEFAULT_STUDIO,
      musicId: "focus-music-1",
      layers: [{ id: "rain-ambient", volume: 0.4, muted: false }],
    };

    const { container } = render(
      <FocusAudioPanel
        preferences={preferencesWithLayer}
        media={mockCatalog}
        onUpdate={vi.fn()}
        onUpload={vi.fn()}
        Range={MockRange}
      />
    );

    // Assert that .studio-soundwave is rendered
    const soundwaves = container.querySelectorAll(".studio-soundwave");
    expect(soundwaves.length).toBeGreaterThan(0);
  });
});
