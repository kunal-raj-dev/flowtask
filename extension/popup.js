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

  // Save task
  saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }

    const taskPayload = {
      id: 'ext-' + Date.now(),
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
    } catch (e) {
      console.warn('Storage save error:', e);
    }

    statusMsg.style.display = 'block';
    setTimeout(() => {
      window.close();
    }, 600);
  });
});
