import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Button, Badge, Card, SegmentedControl, Input, EmptyState, Dialog } from './index';

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

    it('renders with keyboard shortcut hint', () => {
      const html = renderToString(
        React.createElement(Button, { variant: 'primary', kbd: 'Ctrl+K' }, 'Search')
      );
      expect(html).toContain('Ctrl+K');
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

    it('supports focus variant for Rule of 3 highlights', () => {
      const html = renderToString(
        React.createElement(Card, { variant: 'focus' }, 'Focus Task')
      );
      expect(html).toContain('border-amber-500/40');
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
