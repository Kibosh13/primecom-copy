import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { withYandex, sitemapXml } from '../integrations/yandex.mjs';
import { ContentStore } from '../cms/store.mjs';

const root = path.resolve(import.meta.dirname, '..');
test('analytics is added after CMS rendering only for production domains and masks form fields', () => {
  const html = '<html><head></head><body><input class="name"><textarea></textarea></body></html>';
  for (const host of ['localhost:4173','kibosh13.github.io','prime-com.ru.evil.invalid']) assert.equal(withYandex(html,host,{production:true}),html);
  assert.equal(withYandex(html,'prime-com.ru',{production:false}),html);
  const result = withYandex(html,'prime-com.ru',{production:true});
  assert.match(result, /site-analytics.js/);
  assert.equal((result.match(/ym-disable-keys/g)||[]).length,2);
  assert.doesNotMatch(result,/data-contact-sent/);
  assert.match(withYandex('<html><body>Спасибо</body></html>','www.prime-com.ru',{production:true,contactSent:true}),/data-contact-sent="true"/);
});

test('sitemap uses published pages and excludes redirects, noindex and canonical duplicates', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'primecom-sitemap-'));
  try {
    fs.mkdirSync(path.join(temp,'pages'));
    fs.writeFileSync(path.join(temp,'routes.json'),JSON.stringify({'/':{file:'pages/index.html'},'/other?x=1&y=2':{file:'pages/other.html'},'/old':{file:'pages/index.html',redirect:'/'}}));
    for (const name of ['index','other']) fs.writeFileSync(path.join(temp,'pages',name+'.html'),'<html><head><title>Test</title></head><body><p>Text</p></body></html>');
    const store = new ContentStore(temp,path.join(temp,'private'));
    const record = [...store.pages.values()].find(p=>p.url==='/other?x=1&y=2');
    assert.match(sitemapXml(store),/other\?x=1&amp;y=2/);
    assert.doesNotMatch(sitemapXml(store),/\/old/);
    let page = store.save(record.id,{version:0,seo:{robots:'noindex, follow'},action:'draft'});
    assert.match(sitemapXml(store),/other/);
    page = store.save(record.id,{version:page.version,action:'publish'});
    assert.doesNotMatch(sitemapXml(store),/other/);
    page = store.save(record.id,{version:page.version,seo:{robots:'index, follow',canonical:'https://prime-com.ru/'},action:'publish'});
    assert.doesNotMatch(sitemapXml(store),/other/);
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('browser tracking queues click and successful-contact goals without form content', () => {
  const source = fs.readFileSync(path.join(root,'integrations/site-analytics.js'),'utf8');
  function load({hostname='prime-com.ru',pathname='/',sent=false}={}) {
    const events = {}, scripts = [], context = {URL,Element:class {},location:{hostname,protocol:'https:',pathname,href:`https://${hostname}${pathname}?email=private%40example.invalid&utm_source=test#secret`}};
    context.window=context;context.top=context;
    context.document={currentScript:{dataset:{contactSent:sent?'true':undefined}},scripts:[],referrer:'https://example.invalid/?email=private%40example.invalid',createElement:()=>({}),getElementsByTagName:()=>[{parentNode:{insertBefore:s=>scripts.push(s)}}],addEventListener:(name,fn)=>events[name]=fn};
    vm.runInNewContext(source,context);
    return {context,scripts,click(href,text='') {const link={getAttribute:()=>href,textContent:text,title:''}; const target=new context.Element();target.closest=()=>link;events.click({target});}};
  }
  const normal=load();
  assert.equal(normal.scripts.length,1);
  assert.equal(normal.context.ym.a[0][1],'init');
  assert.doesNotMatch(normal.context.ym.a[0][2].url,/email|secret/);
  assert.match(normal.context.ym.a[0][2].url,/utm_source=test/);
  normal.click('tel:+74950000000');normal.click('mailto:info@prime-com.ru');normal.click('https://t.me/example');normal.click('https://vk.com/example');normal.click('https://disk.yandex.ru/i/example','Прайс лист');
  assert.deepEqual(Array.from(normal.context.ym.a.slice(1),a=>a[2]),['phone_click','email_click','telegram_click','vk_click','price_open']);
  assert.equal(load({sent:true}).context.ym.a[1][2],'contact_sent');
  assert.equal(load({hostname:'localhost'}).scripts.length,0);
  assert.equal(load({hostname:'kibosh13.github.io'}).scripts.length,0);
  assert.equal(load({pathname:'/admin/'}).scripts.length,0);
});
