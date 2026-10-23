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
    '--color-brand-border': mix(surfaces[0], color, .34),
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
    '--border-color': mix(canvas, ink, dark ? .14 : .16), '--border-hairline': mix(canvas, ink, dark ? .1 : .11),
    '--border-subtle': mix(canvas, ink, .07), '--border-strong': strong, '--border-hover': mix(canvas, ink, .28),
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
  dark: palette('Obsidian Night', 'Soft charcoal, clean layers and a warm amber highlight.', 'dark', ['#101113','#15171a','#1c1e22','#25282d','#30343b','#f1f2f4','#c0c4cd','#949ba7','#e9b968']),
  tokyo: palette('Tokyo Night', 'Inky indigo, muted periwinkle and soft silver text.', 'dark', ['#151620','#1a1c28','#212432','#2a2e40','#34394e','#e1e5f5','#bcc5e0','#9ba8c7','#b6aff0']),
  nord: palette('Nordic Slate', 'Smoky arctic slate with a quiet frost-blue accent.', 'dark', ['#242a33','#2b323d','#333c49','#3c4655','#465263','#eceff4','#d0d8e5','#afbdcf','#99c5d0']),
  matcha: palette('Forest Matcha', 'Light sage paper and grounded green details.', 'light', ['#f4f6f0','#eaefe3','#ffffff','#e3eada','#dae4ce','#1a2416','#43543d','#53664b','#3e682d']),
  sepia: palette('Solarized Sepia', 'Editorial parchment with antique terracotta accents.', 'light', ['#fbf7ee','#f4eedc','#fffdf8','#efe7d4','#e8dec5','#2c2218','#5c4a38','#6a553d','#98501b']),
  crimson: palette('Cyber Crimson', 'Smoked burgundy, rose highlights and warm porcelain text.', 'dark', ['#171315','#1e191c','#272024','#31282d','#3d3137','#f6edef','#d8c1c8','#b79da8','#ed9eaf']),
  cobalt: palette('Deep Cobalt', 'Tailored midnight blue with a crisp cornflower accent.', 'dark', ['#101723','#161f2d','#1d2939','#263348','#303f57','#edf3fc','#bdcde4','#a0b2cc','#9abbf2']),
  lavender: palette('Lavender Dusk', 'Dusty violet, soft lilac and a restful evening canvas.', 'dark', ['#1a1720','#211d29','#2a2433','#342d3f','#40374c','#f3eef8','#d2c5df','#b6a7c6','#cbb0ed']),
  rosewater: palette('Rosewater', 'Blush paper, deep rose details, gentle warmth.', 'light', ['#fcf7f8','#f6ebef','#fffbfc','#f1e1e7','#edd7df','#33202a','#624350','#755260','#963e60']),
  desert: palette('Desert Sand', 'Sunlit cream, soft sand, grounded amber-brown.', 'light', ['#f8f3e9','#f0e8d9','#fffcf5','#ebddc7','#e6d7be','#30271b','#58472f','#6d5638','#805017']),
  amoled: palette('AMOLED Black', 'True black, crisp surfaces, warm amber accents.', 'dark', ['#000000','#090909','#111111','#1a1a1a','#242424','#fafafa','#dedede','#b5b5b5','#f8b84e']),
  aurora: palette('Northern Aurora', 'Deep petrol, misty mint and gently lifted surfaces.', 'dark', ['#111c1e','#172527','#1f3033','#283c40','#32494d','#eef7f5','#c0d8d3','#9ebdb7','#9edbc7'], true),
  abyss: palette('Oceanic Abyss', 'Marine ink and sea-glass cyan, made for late focus.', 'dark', ['#101b26','#172533','#1e3041','#273d50','#32495e','#edf5fa','#bfd3e2','#9fbacb','#8dcfdc'], true),
  forest: palette('Forest Canopy', 'Deep woodland, soft sage and warm ivory text.', 'dark', ['#151d18','#1c2820','#25332a','#2f3f34','#3a4c3f','#f1f4e9','#ccd9c6','#aebeab','#bed6a5'], true),
  solar: palette('Solar Dawn', 'Ivory light with gentle terracotta and warm ink.', 'light', ['#fff8f0','#f6eadc','#fffcf7','#efdfd0','#e9d4c1','#38271f','#654a3c','#755846','#9b452c'], true),
  latte: palette('Catppuccin Latte', 'Soft light pastels with a clear mauve accent.', 'light', ['#eff1f5','#e6e9ef','#ffffff','#e0e4ed','#d6dce7','#4c4f69','#5c5f77','#6c6f85','#8839ef']),
  mocha: palette('Catppuccin Mocha', 'Cozy pastel charcoal with lavender and soft mauve.', 'dark', ['#1e1e2e','#181825','#252536','#2c2c40','#36364b','#cdd6f4','#bac2de','#a6adc8','#cba6f7'], true),
  porcelain: palette('Porcelain', 'Crisp white, cool stone and a confident ink-blue accent.', 'light', ['#f6f7f9','#eceef2','#ffffff','#e8ecf2','#dde5f0','#202a3b','#4d5c70','#627087','#365b9c'], true),
  pearl: palette('Pearl Mist', 'Luminous pearl, silver-gray layers and dusty iris.', 'light', ['#f8f7fb','#f0eef5','#fefeff','#eae7f1','#e2ddeb','#302b3e','#60586f','#746b83','#725697']),
  linen: palette('Warm Linen', 'Natural linen, warm white and a quiet olive accent.', 'light', ['#f8f5ef','#f0ece3','#fffdf9','#eae5d9','#e1dbcd','#332f25','#625b4c','#746c5c','#626b3f'], true),
  mint: palette('Mint Studio', 'Fresh mint-white, soft eucalyptus and deep jade.', 'light', ['#f2f8f5','#e8f1ec','#fcfffd','#dfede5','#d3e5dc','#233b32','#4b675b','#60796e','#276e55']),
  glacier: palette('Glacier', 'Airy blue-white, cloud surfaces and a glacial teal accent.', 'light', ['#f3f8fa','#e9f0f4','#fdfeff','#dfeaf0','#d2e2ea','#233741','#4b6572','#607b88','#28687e']),
  graphite: palette('Graphite', 'Balanced graphite, silver details and understated blue.', 'dark', ['#121416','#191c1f','#212529','#2b3035','#363c43','#f0f2f4','#c1c8cf','#9ca7b1','#a3c4ed'], true),
  espresso: palette('Espresso', 'Roasted cocoa, warm stone and a soft caramel accent.', 'dark', ['#1b1715','#231e1b','#2d2622','#38302a','#463b33','#f5eee5','#d5c5b5','#b5a390','#dfbd91'], true),
  plum: palette('Velvet Plum', 'Smoky aubergine, powder rose and soft champagne text.', 'dark', ['#1b1620','#231d29','#2e2535','#3a2f43','#483a51','#f6eef5','#d7c4d8','#baa3be','#e0b4cf']),
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
