/** Build-time only: public previews need absolute URLs on the actual deployment. */
export function applySocialOrigin(html: string, configured?: string) {
  if (!configured) return html;
  const origin = new URL(configured).origin;
  if (!/^https?:/.test(origin)) throw new Error('APP_ORIGIN must be an HTTP or HTTPS origin.');
  const image = `${origin}/brand/social-preview.png`;
  return html.replace(/(property="og:image" content=")[^"]+/, `$1${image}`)
    .replace(/(name="twitter:image" content=")[^"]+/, `$1${image}`)
    .replace('</head>', `<meta property="og:url" content="${origin}/" />\n<link rel="canonical" href="${origin}/" />\n</head>`);
}
