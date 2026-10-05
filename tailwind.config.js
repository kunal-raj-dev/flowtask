/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-main)',
        surface: 'var(--bg-surface-l1)',
        'surface-elevated': 'var(--bg-surface-l2)',
        'surface-hover': 'var(--bg-surface-l3)',
        'surface-active': 'var(--bg-surface-l4)',
        brand: 'var(--color-brand)',
        'brand-hover': 'var(--color-brand-hover)',
        'brand-subtle': 'var(--color-brand-subtle)',
        'brand-border': 'var(--color-brand-border)',
        border: 'var(--border-color)',
        'border-subtle': 'var(--border-subtle)',
        'border-hairline': 'var(--border-hairline)',
        'border-strong': 'var(--border-strong)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 4px 14px -2px rgba(0, 0, 0, 0.04)',
        elevated: '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        modal: '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
        drawer: '-10px 0 30px -5px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
