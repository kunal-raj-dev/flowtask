import { test, expect } from '@playwright/test';

test.describe('Today Workspace Micro-Component & Responsiveness Deep Audit', () => {
  const seedTodayWorkspace = async (page: any, customTasks?: any[]) => {
    await page.goto('/');

    await page.evaluate(async (seededTasks) => {
      // Clear IndexedDB so fallback to localStorage flowtask_ws_local is immediate
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('flowtask_storage_v2');
      }

      const now = new Date().toISOString();
      const localDate = new Date();
      const y = localDate.getFullYear();
      const m = String(localDate.getMonth() + 1).padStart(2, '0');
      const d = String(localDate.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      const tasks = seededTasks || [
        {
          id: 'task-1',
          title: 'Prepare quarterly product roadmap presentation',
          description: 'Synthesize user feedback and velocity metrics.',
          priority: 'p1',
          status: 'todo',
          projectId: 'inbox',
          plannedDate: todayStr,
          dueDate: todayStr,
          estimatedMinutes: 60,
          isPinnedToday: true,
          scheduledStart: '09:00',
          createdAt: now,
          subtasks: [
            { id: 'st-1', title: 'Audit churn telemetry', completed: true },
            { id: 'st-2', title: 'Review sprint commitments', completed: false },
          ],
          tags: ['strategy', 'exec'],
        },
        {
          id: 'task-2',
          title: 'Resolve race conditions in offline IndexedDB sync worker',
          description: 'Ensure optimistic transactions rollback cleanly.',
          priority: 'p2',
          status: 'todo',
          projectId: 'inbox',
          plannedDate: todayStr,
          scheduledStart: '11:00',
          estimatedMinutes: 45,
          createdAt: now,
          subtasks: [],
          tags: ['backend', 'bug'],
        },
        {
          id: 'task-3',
          title: 'Design mobile ergonomic controls and touch targets',
          description: 'Calibrate buttons, drawers, and modal sheets.',
          priority: 'p1',
          status: 'todo',
          projectId: 'inbox',
          plannedDate: todayStr,
          scheduledStart: '14:30',
          estimatedMinutes: 90,
          createdAt: now,
          subtasks: [],
          isEvening: true,
          tags: ['mobile', 'design'],
        },
        {
          id: 'task-4',
          title: 'Completed morning standup note',
          status: 'done',
          priority: 'p4',
          projectId: 'inbox',
          plannedDate: todayStr,
          completedAt: now,
          createdAt: now,
          subtasks: [],
        },
      ];

      const projects = [
        { id: 'inbox', name: 'Inbox', color: '#6366f1', icon: 'Inbox' },
        { id: 'work', name: 'Work', color: '#3b82f6', icon: 'Briefcase' },
        { id: 'personal', name: 'Personal', color: '#10b981', icon: 'User' },
      ];

      const record = {
        schemaVersion: 3,
        workspaceId: 'local',
        tasks,
        projects,
        customViews: [],
        preferences: {},
        pending: [],
        undo: [],
        updatedAt: Date.now(),
      };

      localStorage.setItem('flowtask_ws_local', JSON.stringify(record));
      localStorage.setItem('flowtask_tasks', JSON.stringify(tasks));
      localStorage.setItem('flowtask_tasks_v1', JSON.stringify(tasks));
      localStorage.setItem('flowtask_onboarding_dismissed', 'true');
      localStorage.setItem('flowtask_onboarding_completed', 'true');
      window.location.reload();
    }, customTasks);

    await page.waitForSelector('main#main-content', { state: 'visible' });
    await page.waitForTimeout(300);
  };

  const VIEWPORTS = [
    { name: 'mobile-360', width: 360, height: 740 },
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1280', width: 1280, height: 800 },
  ];

  for (const vp of VIEWPORTS) {
    test(`Inspect Today view layout and responsiveness on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedTodayWorkspace(page);

      // Check horizontal overflow of the main container
      const hasHorizontalScrollbar = await page.evaluate(() => {
        const docElem = document.documentElement;
        return docElem.scrollWidth > docElem.clientWidth;
      });
      expect(hasHorizontalScrollbar).toBe(false);

      // Verify header and all 3 partitioned sections exist and are visible
      await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Top 3 Focus/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Daytime Tasks/i })).toBeVisible();
      await expect(page.getByRole('heading', { name: /This Evening/i })).toBeVisible();

      // Verify task cards render properly
      await expect(page.getByText('Prepare quarterly product roadmap')).toBeVisible();
      await expect(page.getByText('Resolve race conditions in offline')).toBeVisible();
      await expect(page.getByText('Design mobile ergonomic controls')).toBeVisible();
    });
  }

  test('Micro-component interaction: Calm Mode toggle and daytime reveal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedTodayWorkspace(page);

    // Both Top 3 and Daytime tasks visible initially
    await expect(page.getByText('Prepare quarterly product roadmap')).toBeVisible();
    await expect(page.getByText('Resolve race conditions in offline')).toBeVisible();

    // Toggle Calm View ON
    const calmBtn = page.getByRole('button', { name: /Calm View|Calm Mode/i });
    await calmBtn.click();

    // MIT task stays visible, Daytime task should be hidden
    await expect(page.getByText('Prepare quarterly product roadmap')).toBeVisible();
    await expect(page.getByText('Resolve race conditions in offline')).not.toBeVisible();
    await expect(page.getByText(/Calm Mode Active/i)).toBeVisible();

    // Click "Reveal Daytime Tasks"
    const revealBtn = page.getByRole('button', { name: /Reveal Daytime Tasks/i });
    await revealBtn.click();
    await expect(page.getByText('Resolve race conditions in offline')).toBeVisible();

    // Click "Tuck away"
    const tuckBtn = page.getByRole('button', { name: /Tuck away/i });
    await tuckBtn.click();
    await expect(page.getByText('Resolve race conditions in offline')).not.toBeVisible();

    // Turn Calm Mode OFF
    await calmBtn.click();
    await expect(page.getByText('Resolve race conditions in offline')).toBeVisible();
  });

  test('Micro-component interaction: TaskComposer inputs and chip controls', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedTodayWorkspace(page, []);

    // 1. Natural Language Input with auto-disclosure
    const input = page.getByPlaceholder(/What needs to be done\?/i);
    await input.fill('Deploy production hotfix tomorrow p1 ~45m');

    // Auto-disclosed chips should appear
    await expect(page.getByRole('button', { name: /P1/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /~45m/i })).toBeVisible();

    // Clear input
    await input.fill('');

    // 2. Manual Property disclosure
    const togglePropsBtn = page.getByRole('button', { name: /Set properties/i });
    await togglePropsBtn.click();

    // Project chip
    const projectSelect = page.getByLabel('Project', { exact: true });
    await expect(projectSelect).toBeVisible();

    // Planned date input
    const plannedInput = page.getByLabel('Planned date');
    await expect(plannedInput).toBeVisible();

    // Priority cycling: P4 -> P3 -> P2 -> P1
    await page.getByTitle('Click to cycle priority').click();
    await expect(page.getByRole('button', { name: /P3/i })).toBeVisible();
    await page.getByTitle('Click to cycle priority').click();
    await expect(page.getByRole('button', { name: /P2/i })).toBeVisible();
    await page.getByTitle('Click to cycle priority').click();
    await expect(page.getByRole('button', { name: /P1/i })).toBeVisible();

    // Duration cycling
    const durationBtn = page.getByTitle('Click to cycle estimated duration');
    await durationBtn.click();
    await expect(page.getByRole('button', { name: /~15m/i })).toBeVisible();

    // Recurrence cycling
    const recurBtn = page.getByTitle('Click to cycle recurrence');
    await recurBtn.click();
    await expect(page.getByRole('button', { name: /daily/i })).toBeVisible();

    // Session Chip toggle & Generator
    const sessionChip = page.getByRole('button', { name: /\+ Session/i });
    await sessionChip.click();
    await expect(page.getByText('Session Duration Generator')).toBeVisible();

    // Test session quick slots
    const middaySlot = page.getByRole('button', { name: /Midday/i });
    await middaySlot.click();
    await expect(page.getByText('2h 30m (150m)')).toBeVisible();

    // Add task
    await input.fill('Write comprehensive integration tests');
    const addBtn = page.getByRole('button', { name: 'Add', exact: true });
    await addBtn.click();

    // Check task was created
    await expect(page.getByText('Write comprehensive integration tests')).toBeVisible();
  });

  test('Micro-component interaction: TaskCard buttons, status toggle, pin, evening, timer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedTodayWorkspace(page);

    const card = page.locator('#task-task-2');
    await expect(card).toBeVisible();

    // Pin to Top 3 Focus
    await card.hover();
    const starBtn = card.getByTitle(/Pin to Top 3/i);
    await starBtn.click();

    // Verify it now has Top 3 badge
    await expect(card.getByText('Top 3')).toBeVisible();

    // Move to This Evening
    const eveningBtn = card.getByTitle(/Move to This Evening/i);
    await eveningBtn.click();
    await expect(card.getByText('Evening')).toBeVisible();

    // Start Live Stopwatch
    const timerBtn = card.getByTitle(/Start live stopwatch/i);
    await timerBtn.click();
    await expect(card.getByText(/⏱️/)).toBeVisible();

    // Pause Live Stopwatch
    const pauseBtn = card.getByTitle(/Pause tracking time/i);
    await pauseBtn.click();
    await expect(card.getByText(/⏸️/)).toBeVisible();

    // Toggle complete
    const checkbox = card.getByLabel(/Mark as complete/i);
    await checkbox.click();

    // Verify Completed Today section counter
    await expect(page.getByText('Completed Today')).toBeVisible();

    // Expand Completed Today accordion
    await page.getByRole('button', { name: /Completed Today/i }).click();

    // Uncomplete
    const completedCheckbox = card.getByLabel(/Mark as incomplete/i);
    await completedCheckbox.click();
    await expect(card.first().getByText('Resolve race conditions in offline')).toBeVisible();
  });

  test('Micro-component interaction: Snooze popover menu & Context menu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedTodayWorkspace(page);

    const card = page.locator('#task-task-1');
    await expect(card).toBeVisible();

    // 1. Test Context Menu via right click
    await card.click({ button: 'right' });
    const contextMenu = page.locator('.fixed.z-50');
    await expect(contextMenu.getByRole('button', { name: 'Duplicate Task' })).toBeVisible();
    await expect(contextMenu.getByRole('button', { name: 'Mark Complete' })).toBeVisible();
    await expect(contextMenu.getByRole('button', { name: /Delete Task/i })).toBeVisible();
    await expect(contextMenu.getByRole('button', { name: /Select for Batch/i })).toBeVisible();

    // Duplicate Task
    await contextMenu.getByRole('button', { name: 'Duplicate Task' }).click();
    await expect(page.getByText('Prepare quarterly product roadmap presentation (Copy)')).toBeVisible();

    // 2. Test Quick Snooze Popover
    const dateBadge = card.getByTitle(/Click to quickly reschedule due date/i);
    await dateBadge.click();

    // Popover menu should appear
    await expect(page.getByText('Quick Reschedule')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tomorrow' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'This Weekend' })).toBeVisible();

    // Click "Tomorrow" to snooze task-1 away
    await page.getByRole('button', { name: 'Tomorrow' }).click();
    await expect(page.getByText('Quick Reschedule')).not.toBeVisible();
  });

  test('Micro-component interaction: Multi-select & BatchActionBar scheduling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedTodayWorkspace(page);

    // Select first task via context menu or card checkbox
    const card1 = page.locator('#task-task-1');
    await card1.hover();
    const select1 = card1.getByLabel(/Select task/i);
    await select1.click();

    // Batch action bar should appear
    await expect(page.getByRole('region', { name: 'Bulk task actions' })).toBeVisible();
    await expect(page.getByText(/task.*selected/i)).toBeVisible();

    // Select second task
    const card2 = page.locator('#task-task-2');
    const select2 = card2.getByLabel(/Select task/i);
    await select2.click();
    await expect(page.getByText(/tasks.*selected/i)).toBeVisible();

    // Reschedule to Tomorrow
    const tmrwBtn = page.getByRole('button', { name: 'Tomorrow' });
    await tmrwBtn.click();

    // Deselect all
    const clearBtn = page.getByTitle(/Deselect all/i);
    await clearBtn.click();
    await expect(page.getByRole('region', { name: 'Bulk task actions' })).not.toBeVisible();
  });

  test('Micro-component interaction: BatchActionBar portaled dropdowns (Priority & Project) and Escape dismissal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedTodayWorkspace(page);

    // Select task via checkbox
    const card = page.locator('#task-task-2');
    const select = card.getByLabel(/Select task/i);
    await select.click();

    const batchBar = page.getByRole('region', { name: 'Bulk task actions' });
    await expect(batchBar).toBeVisible();

    // Open Priority dropdown
    const priorityBtn = batchBar.getByRole('button', { name: 'Priority' });
    await priorityBtn.click();

    // Verify portaled priority dropdown exists and has P1
    const p1Option = page.getByRole('button', { name: /p1/i });
    await expect(p1Option).toBeVisible();

    // Press Escape to close priority dropdown
    await page.keyboard.press('Escape');
    await expect(p1Option).not.toBeVisible();
    // Batch bar still visible
    await expect(batchBar).toBeVisible();

    // Press Escape again to clear selection and dismiss batch bar
    await page.keyboard.press('Escape');
    await expect(batchBar).not.toBeVisible();
  });

  test('Micro-component interaction: 3-dots button toggle and context menu title rename', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedTodayWorkspace(page);

    const card = page.locator('#task-task-2');
    const moreBtn = card.getByRole('button', { name: 'More options' });

    // Open context menu via 3 dots button
    await moreBtn.click();
    const contextMenu = page.locator('.fixed.z-50');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.getByRole('button', { name: 'Rename Title' })).toBeVisible();

    // Click 3 dots button again - should toggle closed cleanly
    await moreBtn.click();
    await expect(contextMenu).not.toBeVisible();

    // Reopen and click Rename Title
    await moreBtn.click();
    await contextMenu.getByRole('button', { name: 'Rename Title' }).click();

    // Verify inline title input is visible with current title
    const input = card.getByLabel('Edit task title');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('Resolve race conditions in offline IndexedDB sync worker');

    // Test Cancel button with pointer down
    const cancelBtn = card.getByLabel('Cancel editing');
    await cancelBtn.click();
    await expect(input).not.toBeVisible();
  });

  test('Micro-component interaction: Stale task "Needs Momentum" pill parks in Someday and supports Undo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const localDate = new Date();
    const y = localDate.getFullYear();
    const m = String(localDate.getMonth() + 1).padStart(2, '0');
    const d = String(localDate.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    const overdueDateStr = `${fourDaysAgo.getFullYear()}-${String(fourDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(fourDaysAgo.getDate()).padStart(2, '0')}`;

    // Seed task with staleness (overdue by 4 days, planned today)
    const staleTask = [
      {
        id: 'stale-1',
        title: 'Overdue tax filing receipts audit',
        priority: 'p2',
        status: 'todo',
        projectId: 'inbox',
        plannedDate: todayStr,
        dueDate: overdueDateStr,
        createdAt: Date.now() - 20 * 86400000,
      },
    ];

    await seedTodayWorkspace(page, staleTask);

    // Verify Needs Momentum pill is visible
    const momentumBtn = page.getByRole('button', { name: /Needs Momentum/i });
    await expect(momentumBtn).toBeVisible();

    // Click to park in Someday
    await momentumBtn.click();

    // Verify toast appears
    await expect(page.getByText(/Parked "Overdue tax filing receipts audit" in Someday backlog/i)).toBeVisible();

    // Verify task card is removed from active Today sections
    const staleCard = page.locator('#task-stale-1');
    await expect(staleCard).not.toBeVisible();

    // Click Undo
    const undoBtn = page.getByRole('button', { name: 'Undo' });
    if (await undoBtn.isVisible()) {
      await undoBtn.click();
      await expect(staleCard).toBeVisible();
    }
  });
});
