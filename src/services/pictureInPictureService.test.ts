import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pictureInPictureService,
  isDocumentPipSupported,
  syncStylesToPipWindow,
} from './pictureInPictureService';

describe('pictureInPictureService', () => {
  let mockPipWindow: any;
  let mockPipApi: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPipWindow = {
      closed: false,
      document: {
        head: {
          appendChild: vi.fn(),
        },
        body: {
          className: '',
          style: {},
        },
        documentElement: {
          className: '',
          setAttribute: vi.fn(),
          classList: {
            add: vi.fn(),
            contains: vi.fn().mockReturnValue(false),
          },
        },
        title: '',
      },
      focus: vi.fn(),
      close: vi.fn().mockImplementation(function (this: any) {
        this.closed = true;
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockPipApi = {
      requestWindow: vi.fn().mockResolvedValue(mockPipWindow),
    };

    (window as any).documentPictureInPicture = mockPipApi;
  });

  afterEach(() => {
    pictureInPictureService.closePipWindow();
    delete (window as any).documentPictureInPicture;
  });

  it('detects Document PiP support correctly', () => {
    expect(isDocumentPipSupported()).toBe(true);
    expect(pictureInPictureService.isSupported()).toBe(true);

    delete (window as any).documentPictureInPicture;
    expect(isDocumentPipSupported()).toBe(false);
    expect(pictureInPictureService.isSupported()).toBe(false);
  });

  it('shares an in-flight window request and closes a grant arriving after unmount',async()=>{
    let grant!: (window: Window)=>void;
    mockPipApi.requestWindow.mockReturnValue(new Promise<Window>(resolve=>{grant=resolve;}));
    const first=pictureInPictureService.requestPipWindow();
    const second=pictureInPictureService.requestPipWindow();
    expect(mockPipApi.requestWindow).toHaveBeenCalledTimes(1);
    pictureInPictureService.closePipWindow();
    const rejectedFirst=expect(first).rejects.toThrow(/closed before/), rejectedSecond=expect(second).rejects.toThrow(/closed before/);
    grant(mockPipWindow);
    await Promise.all([rejectedFirst,rejectedSecond]);
    expect(mockPipWindow.close).toHaveBeenCalledTimes(1);
    expect(pictureInPictureService.isOpen()).toBe(false);
  });

  it('syncs styles and theme classes to PiP window document', () => {
    const styleEl = document.createElement('style');
    styleEl.textContent = '.custom-class { color: red; }';
    document.head.appendChild(styleEl);

    document.documentElement.className = 'dark font-sans';
    document.documentElement.setAttribute('data-theme', 'amber');

    syncStylesToPipWindow(mockPipWindow);

    expect(mockPipWindow.document.head.appendChild).toHaveBeenCalled();
    expect(mockPipWindow.document.documentElement.className).toBe('dark font-sans');
    expect(mockPipWindow.document.documentElement.setAttribute).toHaveBeenCalledWith(
      'data-theme',
      'amber'
    );
    expect(mockPipWindow.document.title).toBe('FlowTask Focus HUD');

    document.head.removeChild(styleEl);
  });

  it('requests and opens a PiP window with default dimensions', async () => {
    const subscriber = vi.fn();
    const unsubscribe = pictureInPictureService.subscribe(subscriber);

    // Initial subscriber call
    expect(subscriber).toHaveBeenCalledWith(false);

    const win = await pictureInPictureService.requestPipWindow();
    expect(win).toBe(mockPipWindow);
    expect(mockPipApi.requestWindow).toHaveBeenCalledWith({ width: 340, height: 200 });
    expect(pictureInPictureService.isOpen()).toBe(true);
    expect(pictureInPictureService.getPipWindow()).toBe(mockPipWindow);
    expect(subscriber).toHaveBeenCalledWith(true);

    unsubscribe();
  });

  it('focuses existing PiP window if already open', async () => {
    await pictureInPictureService.requestPipWindow();
    expect(mockPipApi.requestWindow).toHaveBeenCalledTimes(1);

    const secondWin = await pictureInPictureService.requestPipWindow();
    expect(secondWin).toBe(mockPipWindow);
    expect(mockPipWindow.focus).toHaveBeenCalledTimes(1);
    expect(mockPipApi.requestWindow).toHaveBeenCalledTimes(1);
  });

  it('throws an error if PiP is requested when not supported', async () => {
    delete (window as any).documentPictureInPicture;

    await expect(pictureInPictureService.requestPipWindow()).rejects.toThrow(
      'Document Picture-in-Picture is not supported in this browser.'
    );
  });

  it('closes PiP window and notifies subscribers', async () => {
    const subscriber = vi.fn();
    pictureInPictureService.subscribe(subscriber);

    await pictureInPictureService.requestPipWindow();
    expect(pictureInPictureService.isOpen()).toBe(true);

    pictureInPictureService.closePipWindow();
    expect(mockPipWindow.close).toHaveBeenCalled();
    expect(pictureInPictureService.isOpen()).toBe(false);
    expect(pictureInPictureService.getPipWindow()).toBeNull();
    expect(subscriber).toHaveBeenLastCalledWith(false);
  });

  it('handles pagehide event to clean up window state when user closes PiP', async () => {
    let pagehideListener: (() => void) | undefined;
    mockPipWindow.addEventListener.mockImplementation((event: string, handler: () => void) => {
      if (event === 'pagehide') {
        pagehideListener = handler;
      }
    });

    await pictureInPictureService.requestPipWindow();
    expect(pictureInPictureService.isOpen()).toBe(true);

    // Simulate user closing the OS window
    mockPipWindow.closed = true;
    pagehideListener?.();

    expect(pictureInPictureService.isOpen()).toBe(false);
    expect(pictureInPictureService.getPipWindow()).toBeNull();
  });
});
