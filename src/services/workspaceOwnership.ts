import type { WorkspaceStore } from './workspaceStore';

const lifetimes = new WeakMap<WorkspaceStore, Promise<void>>();

/** One writer per workspace. Followers load durable records; broadcasts contain no user content. */
export function ownWorkspace(store: WorkspaceStore) {
  const previous = lifetimes.get(store) || Promise.resolve();
  let finish!: () => void;
  lifetimes.set(store, new Promise<void>(resolve => { finish = resolve; }));
  const abort = new AbortController();
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`flowtask-workspace:${store.id}`) : null;
  let release: (() => void) | undefined;
  let owner = false;
  let closed = false;
  let acquiring = false;
  let lastSavedAt = 0;
  const changed = store.subscribe(() => {
    const saved = store.getSnapshot().lastSavedAt || 0;
    if (owner && saved !== lastSavedAt) { lastSavedAt = saved; channel?.postMessage({ type: 'changed' }); }
  });
  const hold = async () => {
    if (closed) return;
    owner = true;
    store.setReadOnly(false);
    await store.reload();
    await new Promise<void>(resolve => { release = resolve; if (closed) resolve(); });
    await store.settled().catch(() => {});
    owner = false;
    if (!closed) store.setReadOnly(true);
  };
  const acquire = async (wait: boolean) => {
    if (acquiring || closed) return;
    acquiring = true;
    try {
      if (!navigator.locks) {
        // In environments without Web Locks API, use BroadcastChannel leader election
        if (channel && !wait) {
          let otherOwnerPresent = false;
          const queryHandler = (ev: MessageEvent) => {
            if (ev.data?.type === 'owner-present') otherOwnerPresent = true;
          };
          channel.addEventListener('message', queryHandler);
          channel.postMessage({ type: 'query-owner' });
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
          channel.removeEventListener('message', queryHandler);
          if (otherOwnerPresent) {
            store.setReadOnly(true);
            await store.reload();
            return;
          }
        }
        await hold();
        return;
      }
      await navigator.locks.request(`flowtask-workspace-${store.id}`, wait ? { signal: abort.signal } : { ifAvailable: true }, async lock => {
        if (closed) return;
        if (lock) await hold();
        else { store.setReadOnly(true); await store.reload(); }
      });
    } catch (error) {
      if (!closed && !(error instanceof DOMException && error.name === 'AbortError')) {
        store.setReadOnly(true);
        await store.reload();
      }
    }
    finally { acquiring = false; }
  };
  if (channel) channel.onmessage = event => {
    if (closed) return;
    if (event.data?.type === 'changed' && !owner) void store.reload();
    if (event.data?.type === 'query-owner' && owner) {
      channel.postMessage({ type: 'owner-present' });
    }
    if (event.data?.type === 'takeover' && owner) {
      // Freeze new writes before draining the serialized durable queue.
      store.setReadOnly(true);
      void store.settled().then(() => release?.()).catch(() => {
        store.setReadOnly(false);
        channel.postMessage({ type: 'takeover-blocked' });
      });
    }
  };
  let operation = previous.then(() => acquire(false));
  return {
    isOwner: () => owner,
    isClosed: () => closed,
    async takeOver() {
      if (owner || closed) return;
      channel?.postMessage({ type: 'takeover' });
      await operation;
      if (closed) return;
      operation = acquire(true);
      const startWait = Date.now();
      while (!owner && !closed && acquiring && Date.now() - startWait < 5000) {
        await new Promise((r) => setTimeout(r, 10));
      }
    },
    close() { closed = true; abort.abort(); release?.(); changed(); channel?.close(); void operation.catch(() => {}).finally(finish); },
  };
}
