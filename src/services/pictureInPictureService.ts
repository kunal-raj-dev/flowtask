/**
 * Picture-in-Picture (PiP) Window Coordinator
 *
 * Coordinates the Document Picture-in-Picture API lifecycle, cloning application
 * styles and themes to maintain visual parity in an always-on-top HUD window.
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

export function syncStylesToPipWindow(pipWindow: Window): void {
  try {
    const pipDoc = pipWindow.document;

    // 1. Copy link[rel="stylesheet"] and style elements
    const styles = document.querySelectorAll<
      HTMLLinkElement | HTMLStyleElement
    >('style, link[rel="stylesheet"]');
    styles.forEach((el) => {
      pipDoc.head.appendChild(el.cloneNode(true));
    });

    // 2. Synchronize theme attributes & classes on <html> and <body>
    const mainHtml = document.documentElement;
    pipDoc.documentElement.className = mainHtml.className;
    const theme = mainHtml.getAttribute("data-theme") || "obsidian";
    pipDoc.documentElement.setAttribute("data-theme", theme);
    if (mainHtml.classList.contains("dark")) {
      pipDoc.documentElement.classList.add("dark");
    }

    pipDoc.body.className = `${document.body.className} bg-[var(--bg-surface-l1,#12151D)] text-[var(--text-primary,#fff)] select-none overflow-hidden m-0 p-0`;
    pipDoc.title = "FlowTask Focus HUD";
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
