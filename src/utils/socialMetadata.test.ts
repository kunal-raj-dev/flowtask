import { describe, expect, it } from 'vitest';
import { applySocialOrigin } from './socialMetadata';
const html = '<head><meta property="og:image" content="/brand/social-preview.png" /><meta name="twitter:image" content="/brand/social-preview.png" /></head>';
describe('deployed social previews', () => {
  it('uses the configured origin for previews and canonical links', () => {
    const result = applySocialOrigin(html, 'https://flowtask.example.test/some/path');
    expect(result.match(/https:\/\/flowtask.example.test\/brand\/social-preview.png/g)).toHaveLength(2);
    expect(result).toContain('property="og:url" content="https://flowtask.example.test/"');
    expect(result).toContain('rel="canonical" href="https://flowtask.example.test/"');
  });
  it('never invents a production hostname during local development', () => { expect(applySocialOrigin(html)).toBe(html); });
  it('rejects unusable deployment origins', () => {
    expect(() => applySocialOrigin(html, 'file:///private')).toThrow();
    expect(() => applySocialOrigin(html, 'relative-host')).toThrow();
  });
});
