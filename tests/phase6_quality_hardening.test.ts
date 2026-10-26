// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { normalizeSettingsTab } from '../src/components/modals/SettingsDrawer';
import fs from 'fs';
import path from 'path';

describe('Phase 6 Quality, Accessibility & Security Hardening', () => {
  describe('Settings IA Normalization (Package 5.6 & 6.1)', () => {
    it('maps all legacy and canonical tabs to the 4 canonical groups', () => {
      // Canonical direct mappings
      expect(normalizeSettingsTab('workflow')).toBe('workflow');
      expect(normalizeSettingsTab('appearance')).toBe('appearance');
      expect(normalizeSettingsTab('notifications')).toBe('notifications');
      expect(normalizeSettingsTab('data')).toBe('data');

      // Legacy workflow sub-tabs mapped to workflow
      expect(normalizeSettingsTab('workspace')).toBe('workflow');
      expect(normalizeSettingsTab('focus')).toBe('workflow');
      expect(normalizeSettingsTab('calendar')).toBe('workflow');
      expect(normalizeSettingsTab('shortcuts')).toBe('workflow');

      // Legacy appearance sub-tabs mapped to appearance
      expect(normalizeSettingsTab('aesthetics')).toBe('appearance');
      expect(normalizeSettingsTab('sound')).toBe('appearance');

      // Legacy data sub-tabs mapped to data
      expect(normalizeSettingsTab('account')).toBe('data');
      expect(normalizeSettingsTab('about')).toBe('data');

      // Default fallback
      expect(normalizeSettingsTab(undefined)).toBe('workflow');
      expect(normalizeSettingsTab('unknown-tab' as any)).toBe('workflow');
    });
  });

  describe('CSS Touch Target & Reduced Motion Accessibility (Package 6.1 & 6.2)', () => {
    const workspaceCssPath = path.resolve(__dirname, '../src/styles/workspace.css');
    const workspaceCss = fs.readFileSync(workspaceCssPath, 'utf8');

    const focusStudioCssPath = path.resolve(__dirname, '../src/styles/focus-studio.css');
    const focusStudioCss = fs.readFileSync(focusStudioCssPath, 'utf8');

    it('contains .touch-target-accessible class definition with 44px minimum bounds', () => {
      expect(workspaceCss).toContain('.touch-target-accessible');
      expect(workspaceCss).toContain('min-width: 44px');
      expect(workspaceCss).toContain('min-height: 44px');
    });

    it('contains coarse pointer mobile touch target expansion for desk icon buttons and task checks', () => {
      expect(workspaceCss).toContain('@media (pointer: coarse)');
      expect(workspaceCss).toContain('.desk-icon-button');
      expect(workspaceCss).toContain('.desk-task-leading');
    });

    it('enforces 44px minimum width on mobile icon buttons without sub-44px regressions', () => {
      expect(workspaceCss).not.toContain('.flowtask-workspace .desk-icon-button { min-width: 36px; }');
      expect(workspaceCss).toContain('.flowtask-workspace .desk-icon-button { min-width: 44px; }');
    });

    it('contains universal prefers-reduced-motion media query in workspace.css', () => {
      expect(workspaceCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    });

    it('contains universal prefers-reduced-motion media query in focus-studio.css', () => {
      expect(focusStudioCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    });

    it('applies touch-target-accessible in WorkspaceTaskRow and TaskDrawerHeader', () => {
      const taskRowPath = path.resolve(__dirname, '../src/components/tasks/WorkspaceTaskRow.tsx');
      const taskRowContent = fs.readFileSync(taskRowPath, 'utf8');
      expect(taskRowContent).toContain('touch-target-accessible');

      const drawerHeaderPath = path.resolve(__dirname, '../src/components/tasks/drawer/TaskDrawerHeader.tsx');
      const drawerHeaderContent = fs.readFileSync(drawerHeaderPath, 'utf8');
      expect(drawerHeaderContent).toContain('touch-target-accessible');
    });
  });

  describe('Chrome Extension Permissions Hardening (Package 5.9)', () => {
    const manifestPath = path.resolve(__dirname, '../extension/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    it('does not contain broad wildcard https://*/* in optional_host_permissions', () => {
      const perms = manifest.optional_host_permissions || [];
      expect(perms).not.toContain('https://*/*');
      expect(perms).not.toContain('<all_urls>');
    });

    it('preserves local testing hosts for developer ergonomics', () => {
      const perms = manifest.optional_host_permissions || [];
      expect(perms).toContain('http://localhost/*');
      expect(perms).toContain('http://127.0.0.1/*');
    });
  });
});
