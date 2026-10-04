// FlowTask Quick Capture script
document.addEventListener('DOMContentLoaded', async () => {
  const titleInput = document.getElementById('task-title');
  const urlInput = document.getElementById('task-url');
  const saveBtn = document.getElementById('save-task');
  const statusMsg = document.getElementById('status-msg');
  const priorityBtns = document.querySelectorAll('.priority-btn');

  let selectedPriority = 'p2';

  // Extract current tab info
  try {
    if (chrome && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        titleInput.value = tab.title || '';
        urlInput.value = tab.url || '';
        titleInput.select();
      }
    }
  } catch (err) {
    console.warn('Tab extraction error:', err);
  }

  // Priority selection
  priorityBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      priorityBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPriority = btn.dataset.p || 'p2';
    });
  });

  document.getElementById('export-tasks').addEventListener('click', async () => {
    try {
      const stored = await chrome.storage.local.get(['flowtask_captured_tasks']);
      const payload = { version: 3, tasks: stored.flowtask_captured_tasks || [], projects: [{ id: 'inbox', name: 'Inbox', color: '#64748B' }] };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'flowtask-captures.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { statusMsg.textContent = 'Could not export captures. Retry without closing this popup.'; statusMsg.style.display = 'block'; }
  });
  // Save task
  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }

    const taskPayload = {
      id: 'ext-' + crypto.randomUUID(),
      subtasks: [],
      title,
      description: urlInput.value.trim(),
      priority: selectedPriority,
      projectId: 'inbox',
      status: 'todo',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const stored = await chrome.storage.local.get(['flowtask_captured_tasks']);
        const tasks = stored.flowtask_captured_tasks || [];
        tasks.push(taskPayload);
        await chrome.storage.local.set({ flowtask_captured_tasks: tasks });
      }

      // Real-time broadcast to active FlowTask tabs
      if (chrome && chrome.tabs && chrome.tabs.query) {
        try {
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (
              tab.id &&
              tab.url &&
              (tab.url.includes('localhost') ||
                tab.url.includes('127.0.0.1') ||
                tab.url.includes('vercel.app') ||
                tab.url.includes('flowtask'))
            ) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'FLOWTASK_EXTERNAL_CAPTURE',
                task: taskPayload,
              }).catch(() => {});
            }
          }
        } catch {
          // Non-blocking tab messaging
        }
      }
    } catch {
      statusMsg.textContent = 'Could not save capture. Keep this popup open and retry.';
      statusMsg.style.display = 'block';
      return;
    }

    statusMsg.textContent = 'Task captured to FlowTask!';
    statusMsg.style.display = 'block';
    titleInput.value = '';
    urlInput.value = '';
    titleInput.focus();

    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 2500);
  });
});
