// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownWorkspace } from './workspaceOwnership';
import type { WorkspaceStore } from './workspaceStore';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  let busy = false;
  const request = vi.fn(async (_name: string, options: { ifAvailable?: boolean }, callback: (lock: object | null) => Promise<void>) => {
    if (busy && options.ifAvailable) return callback(null);
    busy = true;
    try { await callback({ name: 'local' }); } finally { busy = false; }
  });
  vi.stubGlobal('navigator', { locks: { request } });
  vi.stubGlobal('BroadcastChannel', undefined);
  const create = () => {
    let readOnly = false;
    const store = { id: 'local', subscribe: vi.fn(() => vi.fn()),
      getSnapshot: () => ({ lastSavedAt: 0 }), reload: vi.fn(async () => {}), settled: vi.fn(async () => {}),
      setReadOnly: vi.fn((value: boolean) => { readOnly = value; }),
    };
    return { store: store as unknown as WorkspaceStore, readOnly: () => readOnly, spy: store };
  };
  return { create, request };
}

describe('workspace ownership lifecycle', () => {
  it('drains and releases the old lock before StrictMode re-entry on the same store', async () => {
    const { create } = setup();
    const { store, readOnly, spy } = create();
    let drain!: () => void;
    spy.settled.mockImplementationOnce(() => new Promise<void>(resolve => { drain = resolve; }));
    const first = ownWorkspace(store);
    await vi.waitFor(() => expect(spy.reload).toHaveBeenCalledTimes(1));
    first.close();
    const second = ownWorkspace(store);
    await vi.waitFor(() => expect(spy.settled).toHaveBeenCalledTimes(1));
    expect(spy.reload).toHaveBeenCalledTimes(1);
    drain();
    await vi.waitFor(() => expect(spy.reload).toHaveBeenCalledTimes(2));
    expect(readOnly()).toBe(false);
    expect(spy.setReadOnly).not.toHaveBeenCalledWith(true);
    second.close();
  });

  it('still makes a genuinely different tab a read-only follower', async () => {
    const { create } = setup();
    const writer = create(), follower = create();
    const first = ownWorkspace(writer.store);
    await vi.waitFor(() => expect(writer.spy.reload).toHaveBeenCalled());
    const second = ownWorkspace(follower.store);
    await vi.waitFor(() => expect(follower.spy.reload).toHaveBeenCalled());
    expect(writer.readOnly()).toBe(false);
    expect(follower.readOnly()).toBe(true);
    first.close(); second.close();
  });
});
