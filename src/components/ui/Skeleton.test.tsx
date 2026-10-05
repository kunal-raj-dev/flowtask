import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Skeleton, ViewSkeleton, ModalSkeleton } from './Skeleton';

describe('Skeleton Primitives', () => {
  it('renders default rectangular skeleton with role=status', () => {
    const html = renderToString(React.createElement(Skeleton, { id: 'sk-1' }));
    expect(html).toContain('role="status"');
    expect(html).toContain('rounded-xl');
    expect(html).toContain('animate-pulse');
  });

  it('renders circle variant properly', () => {
    const html = renderToString(React.createElement(Skeleton, { variant: 'circle' }));
    expect(html).toContain('rounded-full');
  });

  it('renders text variant with inline height', () => {
    const html = renderToString(React.createElement(Skeleton, { variant: 'text' }));
    expect(html).toContain('rounded-md');
  });

  it('renders ViewSkeleton with accessible label and children placeholders', () => {
    const html = renderToString(React.createElement(ViewSkeleton, { title: 'Loading Today View…' }));
    expect(html).toContain('aria-label="Loading Today View…"');
    expect(html).toContain('role="status"');
    expect(html).toContain('animate-pulse');
  });

  it('renders ModalSkeleton with accessible label', () => {
    const html = renderToString(React.createElement(ModalSkeleton, { label: 'Opening Task Details…' }));
    expect(html).toContain('aria-label="Opening Task Details…"');
    expect(html).toContain('role="status"');
  });
});
