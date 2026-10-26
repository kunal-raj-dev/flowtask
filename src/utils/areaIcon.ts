/** Older workspaces saved icon names; keep those readable alongside custom emoji. */
export function areaIcon(icon?: string) {
  const icons: Record<string, string> = { briefcase: '💼', home: '🏠', heart: '❤️', book: '📚', user: '👤', wallet: '💰', compass: '🧭', star: '⭐' };
  return icon ? icons[icon] || icon : '📁';
}
