import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {passwordRecord} from '../cms/auth.mjs';
import {writeJson,ContentStore} from '../cms/store.mjs';
import {MaterialStore,materialUrl} from '../cms/materials.mjs';
import {materialSlug} from '../admin/material-config.js';

const root=path.resolve(import.meta.dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'primecom-materials-'));
const password=randomBytes(24).toString('base64url');
let server,base,cookie,csrf,item;
async function start() {
  server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:'0',CMS_DATA_DIR:path.join(temp,'cms'),DATA_DIR:path.join(temp,'inquiries')},stdio:['ignore','pipe','pipe']});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),15000);server.stdout.on('data',data=>{const match=String(data).match(/Local: (http:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});server.once('error',reject);});
}
async function stop(){server.kill();await new Promise(resolve=>server.once('exit',resolve));}
async function request(route,body,{auth=true,token=true}={}) {
  return fetch(base+route,{method:body?'POST':'GET',redirect:'manual',headers:{...(cookie&&auth?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base,...(token?{'X-CSRF-Token':csrf||''}:{})}:{})},body:body?JSON.stringify(body):undefined});
}
const content=(title='Тест материала для каталога')=>({title,section:'products',slug:materialSlug(title),summary:'Описание новой продукции.',cover:{url:'/images/products/tiger-epo-strong.jpg',alt:'Обложка'},blocks:[{type:'heading',text:'Характеристики'},{type:'paragraph',text:'Полное описание материала.'},{type:'list',text:'Первый пункт\nВторой пункт'}],seo:{robots:'index, follow'}});
const save=async(action,changes={})=>{const response=await request('/api/admin/material',{id:item?.id,version:item?.version,action,...changes});assert.ok(response.ok,await response.clone().text());item=await response.json();return item;};
before(async()=>{
  writeJson(path.join(temp,'cms/admin.json'),{username:'qa',...passwordRecord(password),generation:'materials-test'});await start();
  const res=await request('/api/admin/login',{username:'qa',password});assert.equal(res.status,200);cookie=res.headers.get('set-cookie').split(';')[0];csrf=(await res.json()).csrf;
});
after(async()=>{await stop();fs.rmSync(temp,{recursive:true,force:true});});

test('new material requires authenticated CSRF request; drafts are private and preview works',async()=>{
  assert.equal((await request('/api/admin/materials',undefined,{auth:false})).status,401);
  assert.equal((await request('/api/admin/material',{action:'draft',content:content()},{token:false})).status,403);
  await save('draft',{content:content()});assert.equal(item.status,'draft');
  assert.equal((await request(item.url,undefined,{auth:false})).status,404);
  assert.ok(!(await (await request('/sitemap.xml')).text()).includes(item.url));
  assert.ok(!(await (await request('/produktsiya.html')).text()).includes(item.content.title));
  assert.equal((await request('/api/admin/material-preview?id='+item.id,undefined,{auth:false})).status,401);
  const preview=await request('/api/admin/material-preview?id='+item.id);assert.equal(preview.status,200);assert.match(preview.headers.get('content-security-policy'),/sandbox/);assert.match(preview.headers.get('x-robots-tag'),/noindex/);assert.ok((await preview.text()).includes('<h1>'+item.content.title+'</h1>'));
  await stop();await start();assert.equal((await request(item.url)).status,404);assert.equal((await (await request('/api/admin/materials')).json()).length,1);
});

test('publishing adds a real page, category/home cards and sitemap; draft updates stay private',async()=>{
  await save('publish',{content:item.content});const oldTitle=item.content.title,oldUrl=item.url;
  let page=await request(item.url);assert.equal(page.status,200);let html=await page.text();
  assert.ok(html.includes('<h1>'+oldTitle+'</h1>'));assert.ok(html.includes('href="https://prime-com.ru'+item.url+'"'));assert.ok(html.includes('favicon-64.png'));assert.ok(html.includes('/styles/materials.css'));
  for(const route of ['/','/produktsiya.html','/sitemap.xml'])assert.ok((await (await request(route)).text()).includes(oldUrl));
  const edited={...item.content,title:'Новый заголовок публикации',slug:'novyy-adres-materiala'};
  await save('draft',{content:edited});assert.equal(item.status,'changed');
  assert.ok((await (await request(oldUrl)).text()).includes('<h1>'+oldTitle+'</h1>'));assert.equal((await request(item.url)).status,404);
  await save('publish',{content:item.content});assert.equal(item.history.length,1);
  const redirect=await request(oldUrl);assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),item.url);
  page=await request(item.url);assert.equal(page.status,200);assert.ok((await page.text()).includes('<h1>Новый заголовок публикации</h1>'));
  const sitemap=await (await request('/sitemap.xml')).text();assert.ok(sitemap.includes(item.url));assert.ok(!sitemap.includes(oldUrl));
  const head=await fetch(base+item.url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  const oldVersion=item.version-1;assert.equal((await request('/api/admin/material',{id:item.id,version:oldVersion,action:'draft',content:item.content})).status,409);
});

test('restore, unpublish and archive preserve content without exposing drafts or losing redirects',async()=>{
  const publishedUrl=item.url,previous=item.history[0];await save('restore',{historyId:previous.id});assert.equal(item.status,'changed');
  assert.ok((await (await request(publishedUrl)).text()).includes('Новый заголовок публикации'));
  await save('discard');assert.equal(item.status,'published');
  await save('unpublish');assert.equal(item.status,'draft');assert.equal((await request(publishedUrl)).status,404);
  assert.ok(!(await (await request('/produktsiya.html')).text()).includes(publishedUrl));assert.ok(!(await (await request('/sitemap.xml')).text()).includes(publishedUrl));
  await save('archive',{content:{...item.content,summary:'Правки перед архивированием'}});assert.equal(item.status,'archived');await save('unarchive');assert.equal(item.status,'draft');assert.ok(item.content.blocks.length);assert.equal(item.content.summary,'Правки перед архивированием');
  await save('publish',{content:{...item.content,seo:{...item.content.seo,robots:'noindex, follow'}}});
  assert.equal((await request(item.url)).status,200);assert.ok(!(await (await request('/sitemap.xml')).text()).includes(item.url));
});

test('route reservations, validation and escaping protect existing pages and reject executable blocks',async()=>{
  for(const [overrides,status] of [[{slug:'shpatlevka-epo-strong'},409],[{slug:'../admin'},400],[{section:'admin'},400],[{slug:item.content.slug},409]]) {
    const r=await request('/api/admin/material',{action:'draft',content:{...content('Другой материал'),...overrides}});assert.equal(r.status,status);
  }
  for(const blocks of [[{type:'image',url:'javascript:alert(1)'}],[{type:'link',url:'//evil.example',text:'x'}],[{type:'html',text:'<script>alert(1)</script>'}],[]]) {
    const r=await request('/api/admin/material',{action:'publish',content:{...content('Некорректные блоки'),blocks}});assert.equal(r.status,400);
  }
  const legacy=new ContentStore(root,path.join(temp,'cms')),store=new MaterialStore(root,path.join(temp,'cms'),legacy);
  const escaped=store.save({action:'publish',content:{...content('Проверка экранирования'),blocks:[{type:'paragraph',text:'<img src=x onerror=alert(1)>'}],seo:{robots:'noindex, follow'}}});
  assert.ok(store.resolve(materialUrl(escaped.content)).html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.equal(new MaterialStore(root,path.join(temp,'cms'),legacy).list().length,2);
});

test('material cards respect global media replacements without rewriting existing asset proxies twice',async()=>{
  const legacy=new ContentStore(root,path.join(temp,'cms')),store=new MaterialStore(root,path.join(temp,'cms'),legacy);
  const settings=legacy.settings();settings.mediaReplacements['/images/products/tiger-epo-strong.jpg']='/images/banners/powder_pigment.jpg';settings.version++;
  writeJson(path.join(temp,'cms/settings.json'),settings);
  for(const route of ['/','/produktsiya.html',item.url]) {
    const response=await request(route);assert.equal(response.status,200);const html=await response.text();
    assert.ok(html.includes('/images/banners/powder_pigment.jpg'));assert.ok(!html.includes('file=%2Fcms-assets%2F'));
    assert.equal((html.match(/<head>/g)||[]).length,1);
    const styles=[...html.matchAll(/href="(\/cms-assets\/style[^\"]+)"/g)];assert.ok(styles.length);
    const style=await request(styles[0][1].replaceAll('&amp;','&'));assert.equal(style.status,200);
  }
});
