import { describe, expect, it } from 'vitest';
import { isLandingLocation, canonicalWorkspaceUrl, resolveStartView } from './entryRoute';
const destination = (url: string) => isLandingLocation(new URL(url, 'https://flowtask.example'));
describe('landing-first entry', () => {
  it.each(['/', '/?utm_source=beta', '/#studio', '/index.html', '/welcome', '/welcome/'])('opens the landing page at %s', url => expect(destination(url)).toBe(true));
  it.each(['/app', '/app/', '/app?view=projects', '/?view=today', '/?view=timeline', '/?action=quickadd', '/#snapshot=eyJ2IjoxfQ=='])('preserves workspace and legacy deep links at %s', url => expect(destination(url)).toBe(false));
});

it('canonicalizes consumed root shortcuts without dropping the selected view or snapshot', () => {
  expect(canonicalWorkspaceUrl('https://flowtask.example/?view=inbox&action=quickadd#snapshot=test').href).toBe('https://flowtask.example/app?view=inbox&action=quickadd#snapshot=test');
  expect(canonicalWorkspaceUrl('https://flowtask.example/app/?view=today').href).toBe('https://flowtask.example/app/?view=today');
});

it.each([['dashboard','today'],['inbox','inbox'],['upcoming','upcoming'],['timeline','timeline'],[undefined,'today'],['unknown','today']])('resolves the saved start view %s safely', (value, expected) => expect(resolveStartView(value)).toBe(expected));
