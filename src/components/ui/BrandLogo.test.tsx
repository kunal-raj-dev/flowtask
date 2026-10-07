import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BrandLogo } from './BrandLogo';

describe('BrandLogo Component', () => {
  it('renders brand icon SVG with gradient definitions', () => {
    const html = renderToString(React.createElement(BrandLogo, { size: 32 }));
    expect(html).toContain('<svg');
    expect(html).toContain('ft-brand-flow');
    expect(html).toContain('ft-brand-glow');
  });

  it('renders wordmark and Zen badge when showWordmark is true', () => {
    const html = renderToString(React.createElement(BrandLogo, { size: 32, showWordmark: true }));
    expect(html).toContain('FlowTask');
    expect(html).toContain('Zen');
    expect(html).toContain('Local-First OS');
  });

  it('omits wordmark text when showWordmark is false', () => {
    const html = renderToString(React.createElement(BrandLogo, { size: 28, showWordmark: false }));
    expect(html).toContain('<svg');
    expect(html).not.toContain('FlowTask</span>');
    expect(html).not.toContain('Local-First OS');
  });

  it('applies custom className and custom sizes correctly', () => {
    const html = renderToString(React.createElement(BrandLogo, { size: 40, className: 'my-custom-brand-class' }));
    expect(html).toContain('my-custom-brand-class');
    expect(html).toContain('width:40px');
    expect(html).toContain('height:40px');
  });
});
