import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
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

const limits = new Map();
async function contact(req,res) {
  const origin=req.headers.origin;
  if (origin) {
    try {if (new URL(origin).host !== req.headers.host) return respond(res,403,'Forbidden','text/plain');}
    catch {return respond(res,403,'Forbidden','text/plain');}
  }
  const ip=req.socket.remoteAddress || '';
  const now=Date.now();
  const recent=(limits.get(ip)||[]).filter(t=>now-t<600000);
  if (recent.length>=5) return respond(res,429,errorPage('Слишком много сообщений','Попробуйте отправить сообщение позже.'));
  let size=0, chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if(size>32768) return respond(res,413,errorPage('Сообщение слишком большое','Сократите текст сообщения.'));
    chunks.push(chunk);
  }
  let params;
  try {
    const body=Buffer.concat(chunks).toString('utf8');
    params=req.headers['content-type']?.includes('application/json') ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
  } catch {return respond(res,400,'Bad request','text/plain');}
  const name=String(params.name||params['jform[contact_name]']||'').trim().slice(0,200);
  const email=String(params.email||params['jform[contact_email]']||'').trim().slice(0,254);
  const subject=String(params.subject||params['jform[contact_subject]']||'').trim().slice(0,300);
  const message=String(params.message||params['jform[contact_message]']||'').trim().slice(0,10000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !subject || !message)
    return respond(res,400,errorPage('Проверьте сообщение','Укажите имя, корректный email, тему и текст сообщения.'));
  if (params.website) return respond(res,400,'Bad request','text/plain');
  const dataDir=process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root,'data');
  fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
  const emailCopyRequested=Boolean(params.emailCopy || params['jform[contact_email_copy]']);
  fs.appendFileSync(path.join(dataDir,'inquiries.jsonl'),JSON.stringify({id:randomUUID(),createdAt:new Date().toISOString(),name,email,subject,message,emailCopyRequested})+'\n',{mode:0o600});
  recent.push(now);limits.set(ip,recent);
  return respond(res,201,errorPage('Сообщение сохранено',process.env.NODE_ENV === 'production'
    ? 'Спасибо! Сообщение сохранено на сервере. Для оперативного ответа напишите на <a href="mailto:info@prime-com.ru">info@prime-com.ru</a> или позвоните <a href="tel:+74959680615">+7 (495) 968-06-15</a>.'
    : 'Спасибо! Сообщение сохранено. В этой локальной версии отправка по электронной почте ещё не подключена.'));
}

const server=http.createServer(async (req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    // Apache rewrites legacy .php requests to / before forwarding to Passenger.
    if (url.pathname === '/' && url.searchParams.get('option') === 'com_content') url.pathname = '/index.php';
    if(url.pathname==='/api/contact' && req.method==='POST') return await contact(req,res);
    if(!['GET','HEAD'].includes(req.method)) return respond(res,405,'Method not allowed','text/plain');
    if(url.pathname==='/api/health') return respond(res,200,JSON.stringify({ok:true}),'application/json');
    let pathname;
    try {pathname=decodeURIComponent(url.pathname);} catch {return respond(res,400,'Bad path','text/plain');}
    if(pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(x=>x==='..' || x.startsWith('.'))) return respond(res,403,'Forbidden','text/plain');
    const routes=JSON.parse(fs.readFileSync(path.join(root,'routes.json'),'utf8'));
    const route=routes[normalizedRoute(url)] || routes[url.pathname];
    if(route?.redirect) {res.writeHead(301,{Location:route.redirect});return res.end();}
    let filename=route ? path.join(root,route.file) : path.join(publicDir,pathname);
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
server.listen(port,host,()=>console.log(`Local: http://${host}:${port}`));
