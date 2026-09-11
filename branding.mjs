const version = 'primecom-circle-20260911';

// Apply after CMS rendering so saved page revisions receive the current icon too.
export function withFavicon(html, base = '/') {
  const links = `<link rel="icon" href="${base}favicon.ico?v=${version}" sizes="16x16 32x32 48x48 64x64" type="image/x-icon">\n<link rel="icon" href="${base}favicon-64.png?v=${version}" sizes="64x64" type="image/png">\n<link rel="apple-touch-icon" href="${base}apple-touch-icon.png?v=${version}" sizes="180x180">`;
  return html.replace(/<link\b[^>]*>/gi, tag => {
    const rel = tag.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    return rel.split(/\s+/).some(value => /^(?:icon|apple-touch-icon(?:-precomposed)?)$/i.test(value)) ? '' : tag;
  }).replace(/<\/head>/i, links + '\n</head>');
}
