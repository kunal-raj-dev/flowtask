import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BrandLogo } from './BrandLogo';

describe('BrandLogo Component', () => {
  it('renders the accessible ribbon F icon', () => {
    const html = renderToString(React.createElement(BrandLogo, { size: 32 }));
    expect(html).toContain('<svg');
    expect(html).toContain('ft-ribbon-');
    expect(html).toContain('aria-label="FlowTask"');
    expect(html).not.toContain('animate-pulse');
  });

  it('renders the wordmark and updated tagline', () => {
    const html = renderToString(React.createElement(BrandLogo, { showWordmark: true }));
    expect(html).toContain('FlowTask');
    expect(html).toContain('Plan your day. Enter your flow.');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('Zen');
  });

  it('supports custom subtitles and an empty subtitle', () => {
    expect(renderToString(React.createElement(BrandLogo, { showWordmark: true, subtitle: 'Your workspace' })))
      .toContain('Your workspace');
    expect(renderToString(React.createElement(BrandLogo, { showWordmark: true, subtitle: '' })))
      .not.toContain('Plan your day. Enter your flow.');
  });

  it('omits wordmark text when showWordmark is false', () => {
    const html = renderToString(React.createElement(BrandLogo, { size: 28 }));
    expect(html).not.toContain('Plan your day. Enter your flow.');
  });

  it('applies custom className and custom sizes correctly', () => {
    const html = renderToString(React.createElement(BrandLogo, { size: 40, className: 'my-custom-brand-class' }));
    expect(html).toContain('my-custom-brand-class');
    expect(html).toContain('width:40px');
    expect(html).toContain('height:40px');
  });

  it('uses unique gradient IDs when multiple logos share a document', () => {
    const html = renderToString(React.createElement('div', null,
      React.createElement(BrandLogo), React.createElement(BrandLogo)));
    const ids = Array.from(html.matchAll(/<linearGradient id="([^"]+)"/g), match => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`url(#${id})`);
  });
});
