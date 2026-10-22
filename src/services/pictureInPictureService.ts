/**
 * Picture-in-Picture (PiP) Window Coordinator
 *
 * Coordinates the Document Picture-in-Picture API lifecycle, injecting a dedicated
 * compact stylesheet with semantic design tokens, live theme/contrast synchronization,
 * and responsive layout (360x280px default, usable down to 320x240px).
 */

export interface PipSession {
  window: Window;
  close: () => void;
}

export interface PipService {
  isSupported(): boolean;
  isOpen(): boolean;
  requestPipWindow(options?: {
    width?: number;
    height?: number;
  }): Promise<Window>;
  closePipWindow(): void;
  subscribe(listener: (isOpen: boolean) => void): () => void;
  getPipWindow(): Window | null;
}

export function isDocumentPipSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "documentPictureInPicture" in window &&
    typeof (
      window as unknown as {
        documentPictureInPicture?: { requestWindow: unknown };
      }
    ).documentPictureInPicture?.requestWindow === "function"
  );
}

const PIP_STYLESHEET = `
:root {
  --pip-bg: #10141a;
  --pip-surface: #181d26;
  --pip-surface-hover: #232a37;
  --pip-text-primary: #f8fafc;
  --pip-text-secondary: #94a3b8;
  --pip-text-muted: #64748b;
  --pip-border: rgba(255, 255, 255, 0.12);
  --pip-amber: #f59e0b;
  --pip-amber-hover: #d97706;
  --pip-amber-surface: rgba(245, 158, 11, 0.15);
  --pip-amber-border: rgba(245, 158, 11, 0.35);
  --pip-rose: #f43f5e;
  --pip-rose-surface: rgba(244, 63, 94, 0.15);
  --pip-emerald: #10b981;
}

html[data-theme='warm_editorial'],
html:not(.dark) {
  --pip-bg: #f8fafc;
  --pip-surface: #ffffff;
  --pip-surface-hover: #f1f5f9;
  --pip-text-primary: #0f172a;
  --pip-text-secondary: #475569;
  --pip-text-muted: #94a3b8;
  --pip-border: rgba(0, 0, 0, 0.12);
  --pip-amber: #d97706;
  --pip-amber-hover: #b45309;
  --pip-amber-surface: rgba(217, 119, 6, 0.12);
  --pip-amber-border: rgba(217, 119, 6, 0.3);
}

@media (prefers-contrast: more) {
  :root {
    --pip-border: rgba(255, 255, 255, 0.35);
    --pip-text-secondary: #e2e8f0;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", system-ui, sans-serif;
  background-color: var(--pip-bg);
  color: var(--pip-text-primary);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  width: 100vw;
  height: 100vh;
}

.pip-container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 12px;
  background-color: var(--pip-bg);
}

.pip-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
}

.pip-header-info {
  flex: 1;
  min-width: 0;
}

.pip-badge-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.pip-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--pip-amber);
  flex-shrink: 0;
}

.pip-status-dot.running {
  box-shadow: 0 0 8px var(--pip-amber);
}

.pip-phase-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--pip-amber);
  white-space: nowrap;
}

.pip-cycle-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--pip-text-muted);
}

.pip-task-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--pip-text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 34px;
}

.pip-icon-button {
  min-width: 44px;
  min-height: 44px;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid var(--pip-border);
  background: var(--pip-surface);
  color: var(--pip-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.pip-icon-button:hover {
  background: var(--pip-surface-hover);
  color: var(--pip-text-primary);
}

.pip-clock-area {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  margin: 4px 0;
}

.pip-clock {
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace;
  font-size: clamp(38px, 14vw, 54px);
  font-weight: 800;
  letter-spacing: -1.5px;
  font-variant-numeric: tabular-nums;
  color: var(--pip-text-primary);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.pip-clock.running {
  color: var(--pip-amber);
}

.pip-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--pip-border);
  position: relative;
}

.pip-btn {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.pip-btn:active {
  transform: scale(0.97);
}

.pip-btn-primary {
  background: var(--pip-amber);
  color: #1c1917;
  flex: 1;
}

.pip-btn-primary:hover {
  background: var(--pip-amber-hover);
}

.pip-btn-primary.running {
  background: var(--pip-amber-surface);
  color: var(--pip-amber);
  border: 1px solid var(--pip-amber-border);
}

.pip-btn-secondary {
  background: var(--pip-surface);
  color: var(--pip-text-primary);
  border: 1px solid var(--pip-border);
}

.pip-btn-secondary:hover {
  background: var(--pip-surface-hover);
}

.pip-menu-popover {
  position: absolute;
  bottom: 54px;
  right: 0;
  width: 190px;
  background: var(--pip-surface);
  border: 1px solid var(--pip-border);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 50;
}

.pip-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--pip-text-primary);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.pip-menu-item:hover {
  background: var(--pip-surface-hover);
}

.pip-completion {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 100%;
  gap: 12px;
  padding: 16px;
}
`;

let activeThemeObserver: MutationObserver | null = null;

export function syncStylesToPipWindow(pipWindow: Window): void {
  try {
    const pipDoc = pipWindow.document;
    if (!pipDoc) return;

    // Set title safely
    try {
      pipDoc.title = "FlowTask Focus HUD";
    } catch {}

    // 1. Copy styles from main document if available
    if (typeof document !== "undefined") {
      const styleNodes = document.querySelectorAll(
        "style, link[rel=\"stylesheet\"]",
      );
      styleNodes.forEach((node) => {
        pipDoc.head?.appendChild?.(node.cloneNode(true));
      });
    }

    // 2. Inject dedicated compact PiP stylesheet
    if (typeof pipDoc.createElement === "function") {
      let styleEl =
        typeof pipDoc.getElementById === "function"
          ? (pipDoc.getElementById(
              "pip-dedicated-styles",
            ) as HTMLStyleElement | null)
          : null;
      if (!styleEl) {
        styleEl = pipDoc.createElement("style");
        styleEl.id = "pip-dedicated-styles";
        styleEl.textContent = PIP_STYLESHEET;
        pipDoc.head?.appendChild?.(styleEl);
      }
    }

    // 3. Synchronize theme attributes & classes on <html> and <body>
    const syncTheme = () => {
      if (pipWindow.closed) return;
      const mainHtml =
        typeof document !== "undefined" ? document.documentElement : null;
      if (!mainHtml || !pipDoc.documentElement) return;

      pipDoc.documentElement.className = mainHtml.className;
      const theme = mainHtml.getAttribute?.("data-theme") || "obsidian";
      pipDoc.documentElement.setAttribute?.("data-theme", theme);
      if (mainHtml.classList?.contains?.("dark")) {
        pipDoc.documentElement.classList?.add?.("dark");
      } else {
        pipDoc.documentElement.classList?.remove?.("dark");
      }
      if (mainHtml.getAttribute?.("data-contrast") === "high") {
        pipDoc.documentElement.setAttribute?.("data-contrast", "high");
      }
    };

    try {
      syncTheme();
    } catch {}

    // 4. Live theme synchronization via MutationObserver
    if (
      typeof MutationObserver !== "undefined" &&
      typeof document !== "undefined" &&
      document.documentElement
    ) {
      activeThemeObserver?.disconnect();
      activeThemeObserver = new MutationObserver(syncTheme);
      activeThemeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "data-contrast"],
      });

      const cleanup = () => {
        activeThemeObserver?.disconnect();
        activeThemeObserver = null;
      };

      pipWindow.addEventListener?.("pagehide", cleanup, { once: true });
      pipWindow.addEventListener?.("unload", cleanup, { once: true });
    }
  } catch (err) {
    console.warn("[PiP] Failed to sync styles to PiP window:", err);
  }
}

class PictureInPictureCoordinator implements PipService {
  private pipWindow: Window | null = null;
  private pending: Promise<Window> | null = null;
  private generation = 0;
  private listeners = new Set<(isOpen: boolean) => void>();

  isSupported(): boolean {
    return isDocumentPipSupported();
  }

  isOpen(): boolean {
    return this.pipWindow !== null && !this.pipWindow.closed;
  }

  getPipWindow(): Window | null {
    if (this.pipWindow && this.pipWindow.closed) {
      this.pipWindow = null;
    }
    return this.pipWindow;
  }

  async requestPipWindow(
    options: { width?: number; height?: number } = {},
  ): Promise<Window> {
    if (!this.isSupported()) {
      throw new Error(
        "Document Picture-in-Picture is not supported in this browser.",
      );
    }

    // If a window is already open, focus and return it
    if (this.isOpen() && this.pipWindow) {
      this.pipWindow.focus();
      return this.pipWindow;
    }
    if (this.pending) return this.pending;

    // Default dimensions: 340x200 (callers specify 360x280 for updated Studio popup)
    const { width = 340, height = 200 } = options;
    const pipApi = (
      window as unknown as {
        documentPictureInPicture: {
          requestWindow: (opts: {
            width: number;
            height: number;
          }) => Promise<Window>;
        };
      }
    ).documentPictureInPicture;

    const generation = this.generation;
    const request = pipApi
      .requestWindow({ width, height })
      .then((win) => {
        if (generation !== this.generation) {
          win.close();
          throw new Error("The floating timer was closed before it opened.");
        }
        this.pipWindow = win;

        syncStylesToPipWindow(win);

        win.addEventListener(
          "pagehide",
          () => {
            if (this.pipWindow === win) {
              this.pipWindow = null;
              this.notify();
            }
          },
          { once: true },
        );

        this.notify();
        return win;
      })
      .finally(() => {
        if (this.pending === request) this.pending = null;
      });
    this.pending = request;
    return request;
  }

  closePipWindow(): void {
    this.generation++;
    this.pending = null;
    activeThemeObserver?.disconnect();
    activeThemeObserver = null;
    if (this.pipWindow) {
      try {
        if (!this.pipWindow.closed) {
          this.pipWindow.close();
        }
      } catch (err) {
        console.warn("[PiP] Error closing PiP window:", err);
      } finally {
        this.pipWindow = null;
        this.notify();
      }
    }
  }

  subscribe(listener: (isOpen: boolean) => void): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.isOpen());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const open = this.isOpen();
    for (const listener of this.listeners) {
      try {
        listener(open);
      } catch (err) {
        console.error("[PiP] Listener threw error:", err);
      }
    }
  }
}

export const pictureInPictureService = new PictureInPictureCoordinator();
