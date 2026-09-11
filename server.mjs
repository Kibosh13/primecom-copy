import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContactHandler} from './inquiries.mjs';
import {createCms} from './cms/server.mjs';
import {withYandex, sitemapXml, verificationCode} from './integrations/yandex.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const cms = createCms(root);
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.eot':'application/vnd.ms-fontobject','.pdf':'application/pdf','.mp4':'video/mp4','.webm':'video/webm','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.xls':'application/vnd.ms-excel','.zip':'application/zip'};
function normalizedRoute(url) {
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
  const params = [...url.searchParams].sort(([a,av],[b,bv]) => cmp(a,b) || cmp(av,bv));
  return url.pathname + (params.length ? '?' + new URLSearchParams(params) : '');
}
function respond(res,status,body,type='text/html; charset=utf-8') {
  res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store'});
  res.end(body);
}
function errorPage(title, message) {
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><body style="font:18px/1.6 Arial,sans-serif;max-width:760px;margin:10vh auto;padding:24px"><h1>${title}</h1><p>${message}</p><p><a href="/">На главную</a> · <a href="/o-kompanii/kontakty.html">Контакты</a></p></body></html>`;
}

const contact=createContactHandler({root,store:cms.store,respond,errorPage,withYandex});

const server=http.createServer(async (req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(await cms.handle(req,res,url))return;
    // Apache rewrites legacy .php requests to / before forwarding to Passenger.
    if (url.pathname === '/' && url.searchParams.get('option') === 'com_content') url.pathname = '/index.php';
    if(url.pathname==='/api/contact' && req.method==='POST') return await contact(req,res);
    if(!['GET','HEAD'].includes(req.method)) return respond(res,405,'Method not allowed','text/plain');
    if(url.pathname==='/sitemap.xml') return respond(res,200,req.method==='HEAD'?'':sitemapXml(cms.store),'application/xml; charset=utf-8');
    if(url.pathname===`/yandex_${verificationCode}.html`) return respond(res,200,req.method==='HEAD'?'':`<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body>Verification: ${verificationCode}</body></html>`);
    if(url.pathname==='/site-analytics.js') return respond(res,200,req.method==='HEAD'?'':fs.readFileSync(path.join(root,'integrations/site-analytics.js'),'utf8'),'text/javascript; charset=utf-8');
    if(url.pathname==='/api/health') return respond(res,200,JSON.stringify({ok:true}),'application/json');
    let pathname;
    try {pathname=decodeURIComponent(url.pathname);} catch {return respond(res,400,'Bad path','text/plain');}
    // Only public ACME proof files are allowed under a dot-directory.
    const challenge=pathname.match(/^\/\.well-known\/acme-challenge\/([A-Za-z0-9_-]{1,255})$/);
    if(challenge){const file=path.join(publicDir,'.well-known/acme-challenge',challenge[1]);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return respond(res,404,'Not found','text/plain');const value=fs.readFileSync(file);res.writeHead(200,{'Content-Type':'text/plain','Content-Length':value.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(req.method==='HEAD'?undefined:value);}
    if(pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(x=>x==='..' || x.startsWith('.'))) return respond(res,403,'Forbidden','text/plain');
    const routes=JSON.parse(fs.readFileSync(path.join(root,'routes.json'),'utf8'));
    const route=routes[normalizedRoute(url)] || routes[url.pathname];
    if(route?.redirect) {res.writeHead(301,{Location:route.redirect});return res.end();}
    let filename=route ? path.join(root,route.file) : path.join(publicDir,pathname);
    if(route){const html=cms.store.renderFile(route.file);if(html!==null){const bytes=Buffer.from(withYandex(html,req.headers.host));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});return res.end(req.method==='HEAD'?undefined:bytes);}}
    const allowedRoot=route ? path.join(root,'pages') : publicDir;
    if (!filename.startsWith(allowedRoot+path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile())
      return respond(res,404,errorPage('Страница недоступна','Эта страница пока не восстановлена.'));
    const stat=fs.statSync(filename);
    const type=route?'text/html; charset=utf-8':types[path.extname(filename).toLowerCase()] || (pathname.includes('fonts.googleapis.com')?'text/css; charset=utf-8':'application/octet-stream');
    res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Cache-Control':route?'no-cache':'public, max-age=3600','Referrer-Policy':'strict-origin-when-cross-origin'});
    if(req.method==='HEAD')return res.end();
    fs.createReadStream(filename).pipe(res);
  } catch(err) {
    console.error(err.message);
    if(!res.headersSent)respond(res,500,errorPage('Ошибка сервера','Не удалось открыть страницу.'));
    else res.end();
  }
});
server.listen(port,host,()=>console.log(`Local: http://${host}:${server.address()?.port||port}`));
