document.addEventListener('DOMContentLoaded', async () => {
  const title = document.getElementById('task-title');
  const notes = document.getElementById('task-url');
  const originInput = document.getElementById('app-origin');
  const save = document.getElementById('save-task');
  const status = document.getElementById('status-msg');
  let priority = 'p2';
  const notice = text => { status.textContent = text; status.style.display = 'block'; };
  const stored = await chrome.storage.local.get(['flowtask_origin']);
  originInput.value = stored.flowtask_origin || '';
  try { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); title.value = tab?.title || ''; notes.value = tab?.url || ''; } catch { /* manual capture remains available */ }
  document.querySelectorAll('.priority-btn').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.priority-btn').forEach(value => value.classList.remove('active'));
    button.classList.add('active'); priority = button.dataset.p;
  }));
  document.getElementById('connect-origin').addEventListener('click', async () => {
    try {
      const url = new URL(originInput.value.trim());
      if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Enter an HTTPS origin, without a path. Local HTTP is allowed only for localhost.');
      const pattern = `${url.origin}/*`;
      if (!await chrome.permissions.request({ origins: [pattern] })) { notice('Website access was not granted. Captures remain on this device.'); return; }
      const previous = await chrome.storage.local.get(['flowtask_origin']);
      await chrome.scripting.unregisterContentScripts({ ids: ['flowtask-capture-bridge'] }).catch(() => {});
      await chrome.scripting.registerContentScripts([{ id: 'flowtask-capture-bridge', matches: [pattern], js: ['content.js'], runAt: 'document_start' }]);
      await chrome.storage.local.set({ flowtask_origin: url.origin });
      if (previous.flowtask_origin && previous.flowtask_origin !== url.origin) await chrome.permissions.remove({ origins: [`${previous.flowtask_origin}/*`] });
      originInput.value = url.origin; notice('Website connected. Open your FlowTask workspace before capturing.');
    } catch (error) { notice(error.message || 'Could not connect this website.'); }
  });
  document.getElementById('export-tasks').addEventListener('click', async () => {
    const saved = await chrome.storage.local.get(['flowtask_captured_tasks']);
    const data = { version: 3, tasks: saved.flowtask_captured_tasks || [], projects: [{ id: 'inbox', name: 'Inbox', color: '#64748B' }] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'flowtask-captures.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  save.addEventListener('click', async () => {
    if (!title.value.trim()) { title.focus(); return; }
    if (title.value.length > 10000 || notes.value.length > 20000) { notice('Shorten the title or notes before capturing.'); return; }
    save.disabled = true;
    try {
      const state = await chrome.storage.local.get(['flowtask_origin','flowtask_captured_tasks']);
      const queue = state.flowtask_captured_tasks || [];
      if (queue.length >= 1000) throw new Error('Capture queue is full. Export your saved captures before adding more.');
      const task = { id: 'ext-' + crypto.randomUUID(), title: title.value.trim(), description: notes.value.trim(), priority, projectId: 'inbox', status: 'todo', subtasks: [], tags: ['web-capture'], createdAt: Date.now(), updatedAt: Date.now() };
      await chrome.storage.local.set({ flowtask_captured_tasks: [...queue, task] });
      let delivered = false;
      if (state.flowtask_origin) {
        const tabs = await chrome.tabs.query({ url: `${state.flowtask_origin}/*` });
        for (const tab of tabs) {
          if (!tab.id || new URL(tab.url).origin !== state.flowtask_origin) continue;
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).catch(() => {});
          const acknowledgement = await chrome.tabs.sendMessage(tab.id, { type: 'FLOWTASK_EXTERNAL_CAPTURE', task }).catch(() => null);
          if (acknowledgement?.delivered) { delivered = true; break; }
        }
      }
      if (delivered) {
        const latest = await chrome.storage.local.get(['flowtask_captured_tasks']);
        await chrome.storage.local.set({ flowtask_captured_tasks: (latest.flowtask_captured_tasks || []).filter(value => value.id !== task.id) });
      }
      notice(delivered ? 'Task saved in your connected workspace.' : 'Saved in this extension. Export captures to import them into FlowTask.');
      title.value = ''; notes.value = '';
    } catch (error) { notice(error.message || 'Could not save capture. Keep this popup open and retry.'); }
    finally { save.disabled = false; }
  });
});
