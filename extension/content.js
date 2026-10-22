// Isolated-world bridge. Host access is explicitly granted for one configured origin.
if (!globalThis.flowtaskCaptureBridgeInstalled) {
  globalThis.flowtaskCaptureBridgeInstalled = true;
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'FLOWTASK_EXTERNAL_CAPTURE') return;
    void chrome.storage.local.get(['flowtask_origin']).then(({ flowtask_origin }) => {
      if (location.origin !== flowtask_origin || typeof message.task?.id !== 'string') { respond({ delivered: false }); return; }
      const receive = event => {
        if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'FLOWTASK_CAPTURE_ACK' || event.data.id !== message.task.id) return;
        clearTimeout(timeout); window.removeEventListener('message', receive); respond({ delivered: true });
      };
      const timeout = setTimeout(() => { window.removeEventListener('message', receive); respond({ delivered: false }); }, 5000);
      window.addEventListener('message', receive);
      window.postMessage(message, location.origin);
    }).catch(() => respond({ delivered: false }));
    return true;
  });
}
