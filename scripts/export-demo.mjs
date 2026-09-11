import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {withFavicon} from '../branding.mjs';
import {withInquiryForm} from '../inquiry-ui.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const base = process.env.DEMO_BASE || '/primecom-copy/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('DEMO_BASE must be an absolute directory path ending in /');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'routes.json')));
const origin = 'https://prime-com.ru';
const robots = '<meta name="robots" content="noindex, nofollow, noarchive"><meta name="googlebot" content="noindex, nofollow, noarchive">';
const demoStyle = '/* Keep embedded content usable on narrow screens. */\niframe,video{max-width:100%}img{max-width:100%;height:auto}.contact-form fieldset[disabled]{opacity:.65}#demo-form-note{font-size:1rem;line-height:1.5}\n@media(max-width:767px){#g-navigation img{margin-left:2.5rem}table{display:block;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}}\n';
const styleVersion = createHash('sha256').update(demoStyle).digest('hex').slice(0,12);
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const normalize = url => {
  const params = [...url.searchParams].sort(([a,av],[b,bv]) => a<b?-1:a>b?1:av<bv?-1:av>bv?1:0);
  return url.pathname + (params.length ? '?' + new URLSearchParams(params) : '');
};
function target(route) {
  const record = routes[route];
  if (record?.redirect) return target(record.redirect);
  if (!record) return route.replace(/^\//, '');
  return record.file.replace(/^pages\//, '');
}
function localUrl(raw, context='/') {
  const value = raw.replaceAll('&amp;', '&');
  if (!value || /^(?:#|data:|mailto:|tel:|javascript:|blob:)/i.test(value)) return raw;
  let url;
  try { url = new URL(value, origin + context); } catch { return raw; }
  if (!['prime-com.ru','www.prime-com.ru'].includes(url.hostname)) return value;
  const key = normalize(url);
  const record = routes[key] || routes[url.pathname];
  if (record) return base + target(routes[key] ? key : url.pathname) + url.hash;
  return base + url.pathname.replace(/^\//, '') + url.search + url.hash;
}
function css(text, context) {
  return text.replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi, (_,quote,url) => `url(${quote}${localUrl(url,context)}${quote})`);
}
function assetStrings(text) {
  return text.replace(/(["'])\/(images|media|templates|__assets|external)\//g, `$1${base}$2/`);
}
function page(text, context) {
  text = text.replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*name=["'](?:robots|googlebot)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
  text = text.replace(/\b(href|src|poster|action)\s*=\s*(["'])(.*?)\2/gi,
    (_,attr,quote,url) => `${attr}=${quote}${localUrl(url,context).replaceAll('&','&amp;')}${quote}`);
  text = text.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, (_,quote,value) =>
    `srcset=${quote}${value.split(',').map(item=>{const [url,...sizes]=item.trim().split(/\s+/);return [localUrl(url,context),...sizes].join(' ');}).join(', ')}${quote}`);
  text = css(text,context);
  text = text.replace(/(<script\b[^>]*class="joomla-script-options[^"\n]*"[^>]*>)(.*?)(<\/script>)/gs, (_,open,json,close) => {
    const options = JSON.parse(json);
    delete options['csrf.token']; delete options['system.keepalive'];
    options['system.paths'] = {root:base.slice(0,-1),base:base.slice(0,-1)};
    return open + JSON.stringify(options) + close;
  });
  text = text.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, form => {
    form = form.replace(/<form\b[^>]*>/i, '<form class="form-horizontal well" id="contact-form" onsubmit="return false" aria-describedby="demo-form-note"><p id="demo-form-note" role="note"><strong>Демонстрация:</strong> отправка и сохранение заявок отключены.</p><fieldset disabled>');
    return form.replace(/<\/form>/i, '</fieldset></form>');
  });
  return text.replace(/<\/head>/i, robots + '\n<link rel="stylesheet" href="'+base+'demo.css?v='+styleVersion+'">\n</head>');
}
function write(relative, content) {
  const filename = path.join(out,relative);
  fs.mkdirSync(path.dirname(filename), {recursive:true});
  fs.writeFileSync(filename, relative.endsWith('.html') ? withFavicon(withInquiryForm(content, {base, demo:true}), base) : content);
}
// Only the generated dist directory is replaced. Source files and runtime data are untouched.
fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
fs.cpSync(path.join(root,'public'),out,{recursive:true});
function walk(dir) {return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
for (const file of walk(out)) {
  const relative=path.relative(out,file).split(path.sep).join('/');
  if(file.endsWith('.css')) fs.writeFileSync(file,css(fs.readFileSync(file,'utf8'),'/'+relative));
  if(file.endsWith('.js')) fs.writeFileSync(file,assetStrings(fs.readFileSync(file,'utf8')));
}
let pages=0,redirects=0;
for(const [url,record] of Object.entries(routes)) {
  if(record.redirect) {
    const destination=base+target(record.redirect);
    write(url.slice(1),`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${robots}<meta http-equiv="refresh" content="0;url=${escape(destination)}"><title>Переход</title></head><body><a href="${escape(destination)}">Открыть страницу</a></body></html>`);
    redirects++; continue;
  }
  write(target(url),page(fs.readFileSync(path.join(root,record.file),'utf8'),url)); pages++;
}
write('.nojekyll','');
write('robots.txt','User-agent: *\nDisallow: /\n');
write('demo.css', demoStyle);
write('404.html',`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${robots}<title>Страница не найдена</title></head><body><h1>Страница не найдена</h1><p><a href="${base}">Открыть каталог ПраймКом</a></p></body></html>`);
write('README.md',`# Статическая демонстрация ПраймКом\n\nИсходники и инструкции: https://github.com/Kibosh13/primecom-copy/tree/main\n\n${pages} страниц и ${redirects} перенаправления. Формы не отправляют и не сохраняют данные. Сервер Node.js, почтовая доставка, административная панель, чат-бот и аналитика здесь не запускаются. Внешние карты и ссылки требуют интернета.\n\nВсе HTML-страницы содержат noindex, nofollow, noarchive. robots.txt запрещает обход. Это указания поисковикам, а не ограничение доступа к публичной демонстрации.\n\nОбновляйте через npm run deploy:demo из main. Не редактируйте эту ветку вручную.\n`);
console.log(`Static demo: ${pages} pages, ${redirects} redirects, base ${base}, output ${out}`);
