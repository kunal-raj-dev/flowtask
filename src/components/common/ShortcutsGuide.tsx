import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import {
  SHORTCUT_REGISTRY,
  SHORTCUT_CATEGORIES,
  searchShortcuts,
  SMART_SYNTAX_ITEMS,
  type ShortcutCategory,
  MOD_KEY,
} from '../../services/shortcutRegistry';

export interface ShortcutsGuideProps {
  showMasterToggle?: boolean;
  keyboardShortcutsEnabled?: boolean;
  showShortcutHints?: boolean;
  onToggleMasterShortcuts?: (enabled: boolean) => void;
  onToggleShortcutHints?: (enabled: boolean) => void;
}

export const ShortcutsGuide: React.FC<ShortcutsGuideProps> = ({
  showMasterToggle = false,
  keyboardShortcutsEnabled = true,
  showShortcutHints = true,
  onToggleMasterShortcuts,
  onToggleShortcutHints,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | 'all'>('all');

  const filteredShortcuts = useMemo(() => {
    let items = searchShortcuts(searchQuery);
    if (selectedCategory !== 'all') {
      items = items.filter((s) => s.category === selectedCategory);
    }
    return items;
  }, [searchQuery, selectedCategory]);

  const filteredSyntax = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SMART_SYNTAX_ITEMS;
    return SMART_SYNTAX_ITEMS.filter(
      (item) =>
        item.token.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.example.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      {/* Optional Master & Hint Toggles */}
      {showMasterToggle && (
        <div className="space-y-3 pb-3 border-b border-[var(--border-hairline)]">
          <div
            id="s-shortcuts"
            className="p-3.5 rounded-xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4 card-surface"
          >
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">
                Enable Keyboard Shortcuts
              </span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Enable keyboard shortcuts across navigation, tasks, focus studio, and dashboards.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="Enable Keyboard Shortcuts"
              aria-checked={keyboardShortcutsEnabled}
              onClick={() => onToggleMasterShortcuts?.(!keyboardShortcutsEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                keyboardShortcutsEnabled ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  keyboardShortcutsEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div
            id="s-hints"
            className={`p-3.5 rounded-xl bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)] flex items-center justify-between gap-4 card-surface transition-opacity ${
              !keyboardShortcutsEnabled ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <div>
              <span className="text-xs font-bold text-[var(--text-primary)] block">
                Show Shortcut Hints
              </span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Display shortcut helper badges in tooltips and task lists.
                {!keyboardShortcutsEnabled && ' (Hidden while shortcuts are disabled)'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              disabled={!keyboardShortcutsEnabled}
              aria-label="Show Shortcut Hints"
              aria-checked={keyboardShortcutsEnabled && showShortcutHints}
              onClick={() => onToggleShortcutHints?.(!showShortcutHints)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                keyboardShortcutsEnabled && showShortcutHints ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  keyboardShortcutsEnabled && showShortcutHints ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-secondary)]">{keyboardShortcutsEnabled ? "App shortcuts are on." : "App shortcuts are off."} Tab, menu navigation, Enter/Space on focused buttons, Escape and text editing remain available.</p>
      {/* Search & Category Filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            aria-label="Search shortcuts"
            placeholder={`Search shortcuts (e.g. "${MOD_KEY} + K", "today", "focus", "undo")…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--color-brand)] card-surface"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[var(--color-brand)] text-[var(--text-on-brand)] shadow-xs'
                : 'bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-800 text-[var(--text-secondary)] border border-[var(--border-hairline)]'
            }`}
          >
            All ({SHORTCUT_REGISTRY.length})
          </button>
          {SHORTCUT_CATEGORIES.map((cat) => {
            const count = SHORTCUT_REGISTRY.filter((s) => s.category === cat.key).length;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat.key
                    ? 'bg-[var(--color-brand)] text-[var(--text-on-brand)] shadow-xs'
                    : 'bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-800 text-[var(--text-secondary)] border border-[var(--border-hairline)]'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Shortcuts List / Table */}
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
        {filteredShortcuts.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)]">
            No keyboard shortcuts matching "{searchQuery}"
          </div>
        ) : (
          filteredShortcuts.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-[var(--bg-surface-l1)]/70 border border-[var(--border-hairline)] hover:border-[var(--color-brand-border)] flex items-center justify-between gap-3 text-xs transition-colors card-surface"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--text-primary)] break-words">
                    {item.action}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-stone-200/60 dark:bg-stone-800 text-[var(--text-secondary)] shrink-0">
                    {item.context}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 break-words">
                  {item.description}
                </p>
              </div>

              <div className="shrink-0 flex items-center">
                <kbd className="px-2 py-1 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] font-mono text-[11px] font-bold text-[var(--text-primary)] shadow-xs whitespace-nowrap">
                  {item.displayKey}
                </kbd>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Smart Task Syntax Section */}
      {selectedCategory === 'all' && filteredSyntax.length > 0 && (
        <div className="space-y-2 mt-4 pt-4 border-t border-[var(--border-hairline)]">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
            <span>Smart Task Syntax</span>
            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
              Inline Parser
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredSyntax.map((item) => (
              <div
                key={item.token}
                className="p-2.5 rounded-xl bg-[var(--bg-surface-l1)]/70 border border-[var(--border-hairline)] text-xs flex flex-col justify-between gap-1 card-surface"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                    {item.token}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                    {item.example}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
