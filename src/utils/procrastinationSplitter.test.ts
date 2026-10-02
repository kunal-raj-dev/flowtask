import { describe, it, expect } from 'vitest';
import {
  generateStarterAction,
  getAlternativeStarterActions,
} from './procrastinationSplitter';

describe('procrastinationSplitter', () => {
  it('detects coding domain and returns repository/error reproduction starter', () => {
    const result = generateStarterAction('Refactor auth service API and fix token refresh bug');
    expect(result.domain).toBe('coding');
    expect(result.suggestedMinutes).toBe(5);
    expect(result.starterAction).toContain('reproduce the issue or error log');
    expect(result.starterAction).toContain('(5m)');
  });

  it('detects writing domain and returns 3 rough bullets starter', () => {
    const result = generateStarterAction('Write quarterly product proposal and architecture spec');
    expect(result.domain).toBe('writing');
    expect(result.suggestedMinutes).toBe(5);
    expect(result.starterAction).toContain('3 rough bullet points');
  });

  it('detects communication domain and returns scratchpad draft starter', () => {
    const result = generateStarterAction('Follow up with enterprise client on Slack email contract');
    expect(result.domain).toBe('communication');
    expect(result.suggestedMinutes).toBe(5);
    expect(result.starterAction).toContain('scratchpad');
  });

  it('detects finance/admin domain and returns download statement starter', () => {
    const result = generateStarterAction('File 2025 business tax returns and organize receipts');
    expect(result.domain).toBe('finance_admin');
    expect(result.suggestedMinutes).toBe(5);
    expect(result.starterAction).toContain('PDF statement');
  });

  it('detects design domain and returns 3-box wireframe sketch starter', () => {
    const result = generateStarterAction('Design modern dark-mode landing page in Figma');
    expect(result.domain).toBe('design');
    expect(result.suggestedMinutes).toBe(5);
    expect(result.starterAction).toContain('wireframe');
  });

  it('detects research domain and returns executive summary skimming starter', () => {
    const result = generateStarterAction('Research distributed vector database benchmarks');
    expect(result.domain).toBe('research');
    expect(result.suggestedMinutes).toBe(5);
    expect(result.starterAction).toContain('executive summary');
  });

  it('detects planning domain and returns top 1 deliverable starter', () => {
    const result = generateStarterAction('Quarterly roadmap strategy and sprint planning');
    expect(result.domain).toBe('planning');
    expect(result.suggestedMinutes).toBe(5);
    expect(result.starterAction).toContain('Top 1 most critical deliverable');
  });

  it('falls back to general starter when task is ambiguous', () => {
    const result = generateStarterAction('Clean garage and organize basement');
    expect(result.domain).toBe('general');
    expect(result.suggestedMinutes).toBe(5);
    expect(result.starterAction).toContain('5-minute timer');
  });

  it('returns multiple alternative starter actions for a domain', () => {
    const alts = getAlternativeStarterActions('Code refactoring for database queries');
    expect(alts.length).toBeGreaterThanOrEqual(2);
    alts.forEach((action) => expect(action).toContain('(5m)'));
  });
});
