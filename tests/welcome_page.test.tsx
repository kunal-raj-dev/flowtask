import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { WelcomePage } from "../src/components/views/WelcomePage";

describe("WelcomePage Frontier Upgrade", () => {
  it("renders the hero, brand logo, and live product preview", () => {
    render(<WelcomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByText("A day with intention.")).toBeDefined();
    expect(screen.getByRole("group", { name: "Product preview" })).toBeDefined();
  });

  it("toggles task completion interactively in the Daily Desk preview", () => {
    render(<WelcomePage />);
    const taskButton = screen.getByRole("button", {
      name: /Toggle task: Understand one difficult concept/i,
    });
    expect(taskButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(taskButton);
    expect(taskButton.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(taskButton);
    expect(taskButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("adds a new preview task when submitted through the capture form", () => {
    render(<WelcomePage />);
    const input = screen.getByLabelText("Add a task to preview");
    fireEvent.change(input, { target: { value: "Review pull requests" } });
    fireEvent.submit(input.closest("form")!);

    expect(
      screen.getByRole("button", { name: /Toggle task: Review pull requests/i })
    ).toBeDefined();
  });

  it("switches to Focus Studio preview and allows toggling the preview timer", () => {
    vi.useFakeTimers();
    render(<WelcomePage />);

    // Click Focus tab
    const focusTab = screen.getByRole("button", { name: "Focus (Studio)" });
    fireEvent.click(focusTab);

    // Verify Focus preview content
    expect(screen.getByText("25:00")).toBeDefined();
    const timerBtn = screen.getByRole("button", { name: "Start preview timer" });
    expect(timerBtn).toBeDefined();

    // Start timer
    fireEvent.click(timerBtn);
    expect(screen.getByRole("button", { name: "Pause preview timer" })).toBeDefined();

    // Advance 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("24:57")).toBeDefined();

    // Pause timer
    const pauseBtn = screen.getByRole("button", { name: "Pause preview timer" });
    fireEvent.click(pauseBtn);
    expect(screen.getByRole("button", { name: "Start preview timer" })).toBeDefined();

    vi.useRealTimers();
  });

  it("updates the selected focus room and syncs to preview when room card is clicked", () => {
    render(<WelcomePage />);
    const roomCard = screen.getByRole("button", { name: /Preview Dolomite Dawn/i });
    expect(roomCard).toBeDefined();

    fireEvent.click(roomCard);
    expect(roomCard.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText("Dolomite Dawn").length).toBeGreaterThanOrEqual(2);
  });
});
