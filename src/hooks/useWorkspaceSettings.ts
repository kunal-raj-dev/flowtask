import { useState, useEffect, useCallback } from 'react';
import { type UserWorkflowSettings, DEFAULT_WORKFLOW_SETTINGS } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'flowtask_workflow_settings_v1';
const ONBOARDING_LEGACY_KEY = 'flowtask_onboarding_completed';

export function loadSettingsFromStorage(): UserWorkflowSettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_WORKFLOW_SETTINGS;
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const legacyOnboarding = localStorage.getItem(ONBOARDING_LEGACY_KEY);

    if (!raw) {
      return {
        ...DEFAULT_WORKFLOW_SETTINGS,
        onboardingCompleted: legacyOnboarding === 'true',
      };
    }

    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_WORKFLOW_SETTINGS,
      ...parsed,
      onboardingCompleted: parsed.onboardingCompleted ?? (legacyOnboarding === 'true'),
    };
  } catch (err) {
    console.warn('Failed to parse workflow settings from storage:', err);
    return DEFAULT_WORKFLOW_SETTINGS;
  }
}

export function saveSettingsToStorage(settings: UserWorkflowSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    if (settings.onboardingCompleted) {
      localStorage.setItem(ONBOARDING_LEGACY_KEY, 'true');
    }
  } catch (err) {
    console.warn('Failed to save workflow settings to storage:', err);
  }
}

export function useWorkspaceSettings() {
  const [settings, setSettings] = useState<UserWorkflowSettings>(loadSettingsFromStorage);

  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<UserWorkflowSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      saveSettingsToStorage(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_WORKFLOW_SETTINGS);
    saveSettingsToStorage(DEFAULT_WORKFLOW_SETTINGS);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
