import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Button,
  Badge,
  Card,
  SegmentedControl,
  Input,
  EmptyState,
  Dialog,
  Kbd,
  Switch,
  Popover,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Drawer,
} from './index';

describe('Enterprise UI Component Primitives', () => {
  describe('Button primitive', () => {
    it('renders with default secondary variant and accessible attributes', () => {
      const html = renderToString(React.createElement(Button, { id: 'btn-1' }, 'Click me'));
      expect(html).toContain('Click me');
      expect(html).toContain('type="button"');
      expect(html).toContain('focus-ring');
    });

    it('renders with brand variant and loading indicator', () => {
      const html = renderToString(
        React.createElement(Button, { variant: 'brand', isLoading: true }, 'Saving')
      );
      expect(html).toContain('Saving');
      expect(html).toContain('disabled=""');
      expect(html).toContain('animate-spin');
    });

    it('renders with keyboard shortcut hint using Kbd primitive', () => {
      const html = renderToString(
        React.createElement(Button, { variant: 'primary', kbd: 'Ctrl+K' }, 'Search')
      );
      expect(html).toContain('Ctrl+K');
      expect(html).toContain('<kbd');
      expect(html).toContain('font-mono');
    });
  });

  describe('Badge primitive', () => {
    it('renders semantic variants and count accurately', () => {
      const html = renderToString(
        React.createElement(Badge, { variant: 'focus', dot: true, count: 3 }, 'Top Focus')
      );
      expect(html).toContain('Top Focus');
      expect(html).toContain('3');
      expect(html).toContain('bg-amber-500');
    });

    it('renders success and danger badges', () => {
      const successHtml = renderToString(
        React.createElement(Badge, { variant: 'success' }, 'Completed')
      );
      expect(successHtml).toContain('Completed');
      expect(successHtml).toContain('text-emerald-800');

      const dangerHtml = renderToString(
        React.createElement(Badge, { variant: 'danger' }, 'Blocked')
      );
      expect(dangerHtml).toContain('Blocked');
      expect(dangerHtml).toContain('text-rose-700');
    });

    it('renders priority and status variants correctly', () => {
      const p1Html = renderToString(
        React.createElement(Badge, { variant: 'p1', dot: true }, 'Urgent')
      );
      expect(p1Html).toContain('Urgent');
      expect(p1Html).toContain('bg-rose-500');

      const inProgressHtml = renderToString(
        React.createElement(Badge, { variant: 'in_progress', dot: true }, 'In Progress')
      );
      expect(inProgressHtml).toContain('In Progress');
      expect(inProgressHtml).toContain('bg-sky-500');
    });
  });

  describe('Card primitive', () => {
    it('renders with surface ladder default styling', () => {
      const html = renderToString(
        React.createElement(Card, { padding: 'md' }, 'Card Content')
      );
      expect(html).toContain('Card Content');
      expect(html).toContain('card-surface');
      expect(html).toContain('rounded-2xl');
    });

    it('supports focus, surface, and elevated variants', () => {
      const focusHtml = renderToString(
        React.createElement(Card, { variant: 'focus' }, 'Focus Task')
      );
      expect(focusHtml).toContain('border-amber-500/40');

      const surfaceHtml = renderToString(
        React.createElement(Card, { variant: 'surface' }, 'Surface Card')
      );
      expect(surfaceHtml).toContain('card-surface');

      const elevatedHtml = renderToString(
        React.createElement(Card, { variant: 'elevated' }, 'Elevated Card')
      );
      expect(elevatedHtml).toContain('shadow-modal');
    });
  });

  describe('Kbd primitive', () => {
    it('renders semantic keyboard shortcut keycaps', () => {
      const html = renderToString(React.createElement(Kbd, { size: 'sm' }, '⌘K'));
      expect(html).toContain('⌘K');
      expect(html).toContain('<kbd');
      expect(html).toContain('font-mono');
      expect(html).toContain('uppercase');
    });
  });

  describe('Switch primitive', () => {
    it('renders accessible switch role and aria-checked', () => {
      const html = renderToString(
        React.createElement(Switch, {
          checked: true,
          onChange: () => {},
          label: 'Sound Effects',
          description: 'Synthesized tactile click and focus audio',
        })
      );
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('Sound Effects');
      expect(html).toContain('Synthesized tactile click and focus audio');
    });

    it('reflects unchecked state correctly', () => {
      const html = renderToString(
        React.createElement(Switch, {
          checked: false,
          onChange: () => {},
        })
      );
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-checked="false"');
    });
  });

  describe('Popover primitive', () => {
    it('renders trigger always and content when open', () => {
      const closedHtml = renderToString(
        React.createElement(
          Popover,
          {
            isOpen: false,
            onClose: () => {},
            trigger: React.createElement('button', null, 'Trigger'),
          },
          'Popup Content'
        )
      );
      expect(closedHtml).toContain('Trigger');
      expect(closedHtml).not.toContain('Popup Content');

      const openHtml = renderToString(
        React.createElement(
          Popover,
          {
            isOpen: true,
            onClose: () => {},
            trigger: React.createElement('button', null, 'Trigger'),
          },
          'Popup Content'
        )
      );
      expect(openHtml).toContain('Trigger');
      expect(openHtml).toContain('Popup Content');
      expect(openHtml).toContain('role="dialog"');
    });
  });

  describe('DropdownMenu primitive', () => {
    it('renders full accessible menu structure when open', () => {
      const html = renderToString(
        React.createElement(
          DropdownMenu,
          {
            isOpen: true,
            onClose: () => {},
            trigger: React.createElement('button', null, 'Actions'),
          },
          React.createElement(DropdownMenuLabel, null, 'Task Options'),
          React.createElement(DropdownMenuItem, { kbd: 'E' }, 'Edit task'),
          React.createElement(DropdownMenuSeparator),
          React.createElement(DropdownMenuItem, { destructive: true }, 'Delete task')
        )
      );
      expect(html).toContain('role="menu"');
      expect(html).toContain('Task Options');
      expect(html).toContain('Edit task');
      expect(html).toContain('role="separator"');
      expect(html).toContain('Delete task');
      expect(html).toContain('role="menuitem"');
    });
  });

  describe('Drawer primitive', () => {
    it('renders nothing when closed', () => {
      const html = renderToString(
        React.createElement(Drawer, { isOpen: false, onClose: () => {} }, 'Hidden Drawer')
      );
      expect(html).toBe('');
    });

    it('renders accessible slide-over container when open', () => {
      const html = renderToString(
        React.createElement(
          Drawer,
          {
            isOpen: true,
            onClose: () => {},
            title: 'Task Details',
            description: 'Edit properties and subtasks',
            footer: React.createElement(Button, { variant: 'brand' }, 'Save Changes'),
          },
          'Drawer Main Body'
        )
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Task Details');
      expect(html).toContain('Edit properties and subtasks');
      expect(html).toContain('Drawer Main Body');
      expect(html).toContain('Save Changes');
    });
  });

  describe('SegmentedControl primitive', () => {
    it('renders accessible tablist and tabs with correct aria-selected', () => {
      const items = [
        { id: 'list', label: 'List View' },
        { id: 'timeline', label: 'Timeline View' },
      ];
      const html = renderToString(
        React.createElement(SegmentedControl, {
          items,
          value: 'list',
          onChange: () => {},
        })
      );
      expect(html).toContain('role="tablist"');
      expect(html).toContain('List View');
      expect(html).toContain('Timeline View');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-selected="false"');
    });
  });

  describe('Input primitive', () => {
    it('renders with clean container and shortcut hint', () => {
      const html = renderToString(
        React.createElement(Input, {
          placeholder: 'Search tasks...',
          kbd: '/',
          value: 'Meeting',
          onChange: () => {},
        })
      );
      expect(html).toContain('placeholder="Search tasks..."');
      expect(html).toContain('value="Meeting"');
      expect(html).toContain('/');
    });

    it('renders error state and message when provided', () => {
      const html = renderToString(
        React.createElement(Input, {
          error: 'Title is required',
          value: '',
          onChange: () => {},
        })
      );
      expect(html).toContain('border-rose-500/80');
      expect(html).toContain('Title is required');
    });
  });

  describe('EmptyState primitive', () => {
    it('renders title, description, and action button', () => {
      const html = renderToString(
        React.createElement(EmptyState, {
          title: 'No tasks scheduled',
          description: 'Take a break or schedule something new.',
          action: React.createElement(Button, { variant: 'brand' }, 'Add Task'),
        })
      );
      expect(html).toContain('No tasks scheduled');
      expect(html).toContain('Take a break or schedule something new.');
      expect(html).toContain('Add Task');
    });
  });

  describe('Dialog primitive', () => {
    it('renders nothing when closed', () => {
      const html = renderToString(
        React.createElement(Dialog, { isOpen: false, onClose: () => {} }, 'Hidden')
      );
      expect(html).toBe('');
    });

    it('renders accessible dialog container with title and footer when open', () => {
      const html = renderToString(
        React.createElement(
          Dialog,
          {
            isOpen: true,
            onClose: () => {},
            title: 'Confirm Action',
            footer: React.createElement(Button, { variant: 'primary' }, 'Confirm'),
          },
          'Are you sure?'
        )
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Confirm Action');
      expect(html).toContain('Are you sure?');
      expect(html).toContain('Confirm');
    });
  });
});
