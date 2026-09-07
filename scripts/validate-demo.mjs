import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
const base=process.env.DEMO_BASE||'/primecom-copy/';
const origin='https://demo.invalid';
const problems=[];
const resources=new Set();
function walk(dir) {return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
function check(raw,context) {
  raw=raw.trim().replaceAll('&amp;','&');
  if(!raw || /^(?:#|data:|mailto:|tel:|javascript:|blob:)/i.test(raw)) return;
  const url=new URL(raw,origin+context);
  if(url.origin!==origin) return;
  if(!url.pathname.startsWith(base)) {problems.push(`Escapes demo base: ${raw} on ${context}`);return;}
  const relative=decodeURIComponent(url.pathname.slice(base.length))||'index.html';
  let filename=path.join(out,relative);
  if(fs.existsSync(filename) && fs.statSync(filename).isDirectory()) filename=path.join(filename,'index.html');
  if(!fs.existsSync(filename)) problems.push(`Missing ${raw} on ${context}`);
  resources.add(url.pathname);
}
const files=walk(out);let pages=0;
for(const file of files) {
  const relative=path.relative(out,file).split(path.sep).join('/');
  if(/(?:^|\/)(?:data|node_modules|\.env[^/]*|server\.mjs|.*\.(?:sql|sqlite3?|db|log|zip))$/.test(relative)) problems.push(`Private/generated file in demo: ${relative}`);
  if(!/\.(html|css)$/.test(file)) continue;
  const text=fs.readFileSync(file,'utf8');
  const context=base+relative;
  if(file.endsWith('.html')) {
    pages++;
    if(!/<meta name="robots" content="noindex, nofollow, noarchive">/.test(text)) problems.push(`Missing noindex: ${relative}`);
    if(/"csrf\.token"|"system\.keepalive"/.test(text)) problems.push(`Archived credentials/session configuration: ${relative}`);
    if(/action=["'][^"']*api\/contact/.test(text)) problems.push(`Live form action: ${relative}`);
    for(const match of text.matchAll(/\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gi)) check(match[2],context);
    for(const match of text.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)) for(const item of match[2].split(',')) check(item.trim().split(/\s+/)[0],context);
  }
  for(const match of text.matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/gi)) check(match[2],context);
}
if(!fs.existsSync(path.join(out,'.nojekyll'))) problems.push('Missing .nojekyll');
if(!/Disallow: \/\s/.test(fs.readFileSync(path.join(out,'robots.txt'),'utf8'))) problems.push('Missing crawler exclusion');
const report={htmlFiles:pages,files:files.length,localUrls:resources.size,problems:[...new Set(problems)]};
fs.writeFileSync(path.join(root,'demo-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(problems.length) process.exitCode=1;
