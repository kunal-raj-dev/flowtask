/** Complete, bundled workspace palettes. Preview and runtime share these exact tokens. */
export type ThemeTokens = Record<string, string>;
export interface ThemeDefinition {
  label: string;
  description: string;
  scheme: 'light' | 'dark';
  featured: boolean;
  tokens: ThemeTokens;
}

export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function mix(a: string, b: string, amount: number): string {
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0')).join('');
}
export const onAccent = (color: string) => contrast(color, '#ffffff') >= contrast(color, '#000000') ? '#ffffff' : '#000000';
/** Text/accent roles must stay legible on every surface, including selected rows. */
export function readable(color: string, surfaces: string[], dark: boolean, ratio = 4.5): string {
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(color, dark ? '#ffffff' : '#000000', step / 100);
    if (surfaces.every(surface => contrast(candidate, surface) >= ratio)) return candidate;
  }
  return dark ? '#ffffff' : '#000000';
}
export function accentTokens(accent: string, surfaces: string[], dark: boolean): ThemeTokens {
  const color = readable(accent, surfaces, dark);
  const hover = mix(color, dark ? '#ffffff' : '#000000', .12);
  return {
    '--color-brand': color, '--color-brand-hover': hover,
    '--color-brand-subtle': mix(surfaces[0], color, dark ? .16 : .09),
    '--color-brand-border': mix(surfaces[0], color, .48),
    '--color-focus-ring': color, '--text-on-brand': onAccent(color),
    '--desk-on-accent': onAccent(color), '--desk-accent': color,
    '--desk-accent-soft': mix(surfaces[0], color, dark ? .16 : .09),
  };
}
function palette(label: string, description: string, scheme: 'light' | 'dark', colors: [string, string, string, string, string, string, string, string, string], featured = false): ThemeDefinition {
  const [canvas, sidebar, card, hover, selected, text, secondary, muted, accent] = colors;
  const dark = scheme === 'dark', surfaces = [canvas, sidebar, card, hover, selected];
  const ink = readable(text, surfaces, dark), sub = readable(secondary, surfaces, dark), quiet = readable(muted, surfaces, dark);
  const strong = readable(mix(canvas, ink, .42), surfaces, dark, 3);
  const tokens: ThemeTokens = {
    '--bg-main': canvas, '--bg-canvas': canvas, '--bg-surface': sidebar,
    '--bg-surface-l1': sidebar, '--bg-surface-l2': card, '--bg-surface-l3': hover,
    '--bg-surface-l4': selected, '--bg-surface-hover': hover,
    '--text-primary': ink, '--text-secondary': sub, '--text-muted': quiet,
    '--border-color': mix(canvas, ink, .23), '--border-hairline': mix(canvas, ink, .17),
    '--border-subtle': mix(canvas, ink, .12), '--border-strong': strong, '--border-hover': strong,
    '--shadow-subtle': `0 1px 3px ${dark ? '#00000040' : '#0000000a'}`,
    '--shadow-card': `0 2px 8px ${dark ? '#00000030' : '#00000008'}`,
    '--shadow-elevated': `0 12px 28px -8px ${dark ? '#00000080' : '#00000024'}`,
    '--shadow-modal': `0 24px 60px -12px ${dark ? '#000000bb' : '#0000003b'}`,
    '--shadow-glow-amber': 'none', '--shadow-cute-card': 'var(--shadow-card)',
    '--shadow-cute-modal': 'var(--shadow-modal)', '--shadow-cute-glow': 'none',
    ...accentTokens(accent, surfaces, dark),
  };
  const semantic = dark
    ? { amber: '#f8c56c', sage: '#8ddbaf', coral: '#ff9dab', sky: '#8fd6f2', lavender: '#c7acff' }
    : { amber: '#805017', sage: '#2e6541', coral: '#a12f43', sky: '#155e75', lavender: '#684096' };
  for (const [name, value] of Object.entries(semantic)) {
    const color = readable(value, surfaces, dark);
    tokens[`--pastel-${name}`] = color;
    tokens[`--pastel-${name}-subtle`] = mix(card, color, dark ? .13 : .08);
  }
  tokens['--desk-forest'] = tokens['--pastel-sage'];
  tokens['--desk-amber'] = tokens['--pastel-amber'];
  return { label, description, scheme, featured, tokens };
}

export const THEMES = {
  light: palette('Alabaster Dawn', 'Warm paper, amber accents, a clear everyday workspace.', 'light', ['#f8f8f3','#f1f2eb','#fffefa','#eeeee6','#e5e8dd','#24352e','#58665d','#5e6b62','#966019'], true),
  dark: palette('Obsidian Night', 'Neutral charcoal with a warm amber highlight.', 'dark', ['#0b0d12','#12161e','#191e28','#222936','#2b3443','#f8fafc','#cbd5e1','#a9b6c8','#f8b84e']),
  tokyo: palette('Tokyo Night', 'Midnight indigo with soft neon and cool blue details.', 'dark', ['#0b0f19','#111726','#182032','#1f2a40','#283652','#f1f5f9','#b9c7df','#a2b3d0','#b4a5ff']),
  nord: palette('Nordic Slate', 'Quiet arctic slate and frost-blue accents.', 'dark', ['#242933','#2e3440','#353d4c','#3b4555','#434e60','#eceff4','#d8dee9','#b4bfce','#88c0d0']),
  matcha: palette('Forest Matcha', 'Light sage paper and grounded green details.', 'light', ['#f4f6f0','#eaefe3','#ffffff','#e3eada','#dae4ce','#1a2416','#43543d','#53664b','#3e682d']),
  sepia: palette('Solarized Sepia', 'Editorial parchment with antique terracotta accents.', 'light', ['#fbf7ee','#f4eedc','#fffdf8','#efe7d4','#e8dec5','#2c2218','#5c4a38','#6a553d','#98501b']),
  crimson: palette('Cyber Crimson', 'Velvet charcoal and restrained rose-red highlights.', 'dark', ['#0d080b','#150c12','#1e121a','#291824','#351f2f','#fff1f2','#fbc5ce','#d5a2ae','#fb8ca1']),
  cobalt: palette('Deep Cobalt', 'Sapphire surfaces with bright ice-blue accents.', 'dark', ['#060b14','#0a1220','#101d33','#182846','#22375f','#f0f9ff','#bae6fd','#a7cbe2','#7dd3fc']),
  lavender: palette('Lavender Dusk', 'Quiet violet surfaces and soft lilac highlights.', 'dark', ['#141019','#1b1622','#231d2d','#2b2337','#312a43','#f5f0fc','#d5c9e4','#b8adc9','#c4a4ff']),
  rosewater: palette('Rosewater', 'Blush paper, deep rose details, gentle warmth.', 'light', ['#fcf7f8','#f6ebef','#fffbfc','#f1e1e7','#edd7df','#33202a','#624350','#755260','#963e60']),
  desert: palette('Desert Sand', 'Sunlit cream, soft sand, grounded amber-brown.', 'light', ['#f8f3e9','#f0e8d9','#fffcf5','#ebddc7','#e6d7be','#30271b','#58472f','#6d5638','#805017']),
  amoled: palette('AMOLED Black', 'True black, crisp surfaces, warm amber accents.', 'dark', ['#000000','#090909','#111111','#1a1a1a','#242424','#fafafa','#dedede','#b5b5b5','#f8b84e']),
  aurora: palette('Northern Aurora', 'Blue-green depths, mint accents, a hint of violet.', 'dark', ['#091719','#102326','#162d31','#1d383d','#234249','#effbf8','#c3dfdb','#a5c6c2','#8de3c1'], true),
  abyss: palette('Oceanic Abyss', 'Deep marine navy with calm bioluminescent cyan.', 'dark', ['#081521','#0e2030','#152b3d','#1c364a','#244256','#eff8ff','#bed8e8','#a3bfd2','#77d8e8'], true),
  forest: palette('Forest Canopy', 'Evergreen surfaces, sage highlights, warm ivory text.', 'dark', ['#101b16','#17271f','#203328','#293e31','#324a39','#f5f5e9','#d0dec9','#b3c6ab','#b6d99a'], true),
  solar: palette('Solar Dawn', 'Ivory light with gentle terracotta and warm ink.', 'light', ['#fff8f0','#f6eadc','#fffcf7','#efdfd0','#e9d4c1','#38271f','#654a3c','#755846','#9b452c'], true),
  latte: palette('Catppuccin Latte', 'Soft light pastels with a clear mauve accent.', 'light', ['#eff1f5','#e6e9ef','#ffffff','#e0e4ed','#d6dce7','#4c4f69','#5c5f77','#6c6f85','#8839ef']),
  mocha: palette('Catppuccin Mocha', 'Cozy pastel charcoal with lavender and soft mauve.', 'dark', ['#1e1e2e','#181825','#252536','#2c2c40','#36364b','#cdd6f4','#bac2de','#a6adc8','#cba6f7'], true),
} satisfies Record<string, ThemeDefinition>;

export type AppTheme = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as AppTheme[];
export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && Object.hasOwn(THEMES, value);
}

/** Called only by the appearance runtime, after workspace hydration. */
export function applyTheme(theme: AppTheme, options: { accent?: string; highContrast?: boolean } = {}) {
  const root = document.documentElement, definition = THEMES[theme], dark = definition.scheme === 'dark';
  for (const name of Array.from(root.classList)) if (name.startsWith('theme-')) root.classList.remove(name);
  root.classList.toggle('dark', dark);
  if (theme !== 'light' && theme !== 'dark') root.classList.add(`theme-${theme}`);
  root.dataset.theme = theme;
  root.style.colorScheme = definition.scheme;
  const tokens = { ...definition.tokens };
  if (options.accent && /^#[0-9a-f]{6}$/i.test(options.accent)) Object.assign(tokens, accentTokens(options.accent, [tokens['--bg-main'], ...[1,2,3,4].map(i => tokens[`--bg-surface-l${i}`])], dark));
  if (options.highContrast) {
    Object.assign(tokens, {
      '--text-primary': dark ? '#ffffff' : '#111111', '--text-secondary': dark ? '#f1f1f1' : '#252525',
      '--text-muted': dark ? '#e1e1e1' : '#333333', '--border-color': dark ? '#aaaaaa' : '#666666',
      '--border-strong': dark ? '#d4d4d4' : '#444444', '--border-hairline': dark ? '#aaaaaa' : '#666666',
      '--border-subtle': dark ? '#999999' : '#666666', '--color-focus-ring': dark ? '#ffffff' : '#111111',
    });
  }
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(key, value);
}
