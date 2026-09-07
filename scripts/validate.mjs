import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const routes=JSON.parse(fs.readFileSync(path.join(root,'routes.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'recovery-manifest.json'),'utf8'));
const problems=[];
let pageBytes=0,assetBytes=0;
for(const [route,r] of Object.entries(routes)) {
 const file=path.join(root,r.file);
 if(!fs.existsSync(file)){problems.push(`Missing page: ${route}`);continue;}
 const html=fs.readFileSync(file,'utf8');pageBytes+=Buffer.byteLength(html);
 if(!/<title>.+?<\/title>/s.test(html) || !html.includes('g-page-surround'))problems.push(`Invalid page: ${route}`);
 if(/<base\b[^>]+prime-com\.ru/i.test(html))problems.push(`Remote base: ${route}`);
 for(const match of html.matchAll(/\b(src|href|poster)\s*=\s*["']([^"']+)["']/g)) {
  const raw=match[2].replaceAll('&amp;','&');
  if(!raw.startsWith('/') || raw.startsWith('//'))continue;
  const url=new URL(raw,'http://local');
  const asset=path.join(root,'public',decodeURIComponent(url.pathname));
  if(match[1]==='src' || match[1]==='poster' || /\.(css|js|ico|woff2?|ttf)(\?|$)/i.test(raw)) {
   if(!fs.existsSync(asset))problems.push(`Missing resource: ${raw} on ${route}`);
  }
 }
}
for(const r of Object.values(manifest.assets)) {
 if(!r.ok)continue;
 const f=path.join(root,'public',r.path);
 if(!fs.existsSync(f))problems.push(`Missing downloaded asset: ${r.path}`);
 else assetBytes+=fs.statSync(f).size;
}
const missingPages=Object.entries(manifest.pages).filter(([,r])=>!r.ok && !r.resolvedBy).map(([u])=>u);
const missingAssets=Object.entries(manifest.assets).filter(([,r])=>!r.ok && !r.omitted).map(([u])=>u);
const result={checkedAt:new Date().toISOString(),routes:Object.keys(routes).length,assets:Object.values(manifest.assets).filter(r=>r.ok).length,pageBytes,assetBytes,missingPages,missingAssets,problems:[...new Set(problems)]};
fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(result,null,2));
console.log(`Validated ${result.routes} routes and ${result.assets} downloaded asset URLs (${(assetBytes/1024/1024).toFixed(1)} MB).`);
if(result.problems.length)console.error(result.problems.join('\n'));
if(missingPages.length)console.warn(`${missingPages.length} pages could not be recovered; see validation.json.`);
if(missingAssets.length)console.warn(`${missingAssets.length} assets could not be recovered; see validation.json.`);
process.exitCode=result.problems.length?1:0;
