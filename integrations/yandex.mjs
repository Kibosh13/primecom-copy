import { pageModel } from '../cms/model.mjs';
import { materialUrl } from '../cms/materials.mjs';

export const counterId = 112484093;
export const siteOrigin = 'https://prime-com.ru';
export const verificationCode = '781ffa2c4df60895';
const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

export function publicProduction(host, production = process.env.NODE_ENV === 'production') {
  return production && ['prime-com.ru', 'www.prime-com.ru'].includes(String(host).split(':')[0].toLowerCase());
}

// Applied after CMS rendering: editing a page cannot remove the tracking tag.
export function withYandex(html, host, {production = process.env.NODE_ENV === 'production', contactSent = false} = {}) {
  if (!publicProduction(host, production)) return html;
  html = html.replace(/<(input|textarea)\b([^>]*)>/gi, (tag, name, attrs) => {
    if (/\bclass\s*=/.test(attrs)) return tag.replace(/\bclass\s*=\s*(["'])(.*?)\1/i, (_, q, value) => `class=${q}${value} ym-disable-keys${q}`);
    return `<${name} class="ym-disable-keys"${attrs}>`;
  });
  const script = `<script defer src="/site-analytics.js?v=1"${contactSent ? ' data-contact-sent="true"' : ''}></script>`;
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, script + '</head>');
  else html = html.replace(/<body\b[^>]*>/i, '$&' + script);
  return html;
}

export function sitemapXml(store, materials) {
  const urls = new Set();
  for (const record of store.pages.values()) {
    const seo = pageModel(store.html(record.id)).seo;
    if (/(?:^|[\s,])(?:noindex|none)(?:$|[\s,])/i.test(seo.robots)) continue;
    const current = new URL(record.url, siteOrigin);
    if (seo.canonical) {
      let canonical;
      try { canonical = new URL(seo.canonical, siteOrigin); } catch { continue; }
      if (canonical.href !== current.href) continue;
    }
    urls.add(current.href);
  }
  for (const record of materials?.published() || []) {
    if (!/(?:^|[\s,])(?:noindex|none)(?:$|[\s,])/i.test(record.published.seo.robots)) urls.add(new URL(materialUrl(record.published),siteOrigin).href);
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...urls].map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n') + '\n</urlset>\n';
}
