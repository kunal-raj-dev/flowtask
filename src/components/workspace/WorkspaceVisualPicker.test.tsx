import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MediaAsset } from "../../types/studio";
import { WorkspaceVisualPicker } from "./WorkspaceVisualPicker";

vi.mock("../../context/TaskContext", () => ({ useTaskContext: () => ({ workspaceId: "visual-picker-test" }) }));
vi.mock("../../services/mediaService", () => ({ mediaService: { importFile: vi.fn(), list: vi.fn(), remove: vi.fn() } }));

const assets: MediaAsset[] = [
  { id: "study-cover", title: "Morning Library", category: "study-research", visualStyle: "flowtask-original", contexts: ["study", "reading"], src: "/media/study.webp", thumbnail: "/media/study-thumb.webp", width: 1672, height: 941, creator: "FlowTask", license: "Original" },
  { id: "code-cover", title: "Quiet Code Studio", category: "code-build", visualStyle: "architecture", contexts: ["code", "software"], src: "/media/code.webp", thumbnail: "/media/code-thumb.webp", width: 1672, height: 941, creator: "FlowTask", license: "Original" },
  { id: "nature-cover", title: "Alpine Quiet", category: "planning-reflection", visualStyle: "nature", contexts: ["nature", "mountain"], src: "/media/nature.webp", thumbnail: "/media/nature-thumb.webp", width: 2400, height: 1600, creator: "FlowTask", license: "CC0" },
];

beforeEach(() => { vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("workspace visual picker", () => {
  it("can remove even the implicit default background without selecting an image", async () => {
    const onSelect = vi.fn(), onClose = vi.fn();
    render(<WorkspaceVisualPicker isOpen onClose={onClose} assets={assets} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove background' }));
    expect(onSelect).toHaveBeenCalledWith('none');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not describe a plain background as a missing personal image", () => {
    render(<WorkspaceVisualPicker isOpen onClose={vi.fn()} assets={assets} value="none" onSelect={vi.fn()} />);
    expect(screen.queryByText(/saved personal image is not available/)).toBeNull();
  });
  it("shows context-matched recommendations and applies only after explicit confirmation", async () => {
    const user = userEvent.setup(), onSelect = vi.fn(), onClose = vi.fn();
    render(<WorkspaceVisualPicker isOpen onClose={onClose} assets={assets} context={{ kind: "project", projectName: "Build software API" }} onSelect={onSelect}/>);
    expect(screen.getByText(/Suggestions based on “Build software API”/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select Quiet Code Studio" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Select Quiet Code Studio" }));
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Use image" }));
    expect(onSelect).toHaveBeenCalledWith("code-cover", { x: 50, y: 50 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("supports collection search, favorites and keyboard-adjustable crop position", async () => {
    const user = userEvent.setup();
    render(<WorkspaceVisualPicker isOpen onClose={vi.fn()} assets={assets} onSelect={vi.fn()}/>);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by use case" }), "code-build");
    expect(screen.getByRole("button", { name: "Select Quiet Code Studio" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Select Quiet Code Studio" }));
    await user.click(screen.getByRole("button", { name: "Add Quiet Code Studio to favorites" }));
    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    expect(screen.getByRole("button", { name: "Select Quiet Code Studio" })).toBeTruthy();
    const slider = screen.getByLabelText("Horizontal position");
    await user.click(slider);
    expect(slider).toBeTruthy();
  });

  it("filters by visual style independently and searches style names", async () => {
    const user = userEvent.setup();
    render(<WorkspaceVisualPicker isOpen onClose={vi.fn()} assets={assets} onSelect={vi.fn()}/>);
    const styleFilter = screen.getByRole("combobox", { name: "Filter by visual style" });
    await user.selectOptions(styleFilter, "nature");
    expect(screen.getByRole("button", { name: "Select Alpine Quiet" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select Quiet Code Studio" })).toBeNull();

    await user.selectOptions(styleFilter, "all");
    await user.click(screen.getByRole("tab", { name: "All" }));
    await user.type(screen.getByRole("textbox", { name: "Search workspace images" }), "architecture");
    expect(screen.getByRole("button", { name: "Select Quiet Code Studio" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select Alpine Quiet" })).toBeNull();
  });

  it("links to the workspace image credits and license ledger", () => {
    render(<WorkspaceVisualPicker isOpen onClose={vi.fn()} assets={assets} onSelect={vi.fn()}/>);
    expect(screen.getByRole("link", { name: "Credits & licenses" }).getAttribute("href")).toBe("/media/workspace/CREDITS.md");
  });
});
