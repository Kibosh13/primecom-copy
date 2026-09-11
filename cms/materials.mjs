import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parse, parseFragment, serialize} from 'parse5';
import {readJson, writeJson, withLock, digest} from './store.mjs';
import {safeUrl, editPage, applyGlobals} from './model.mjs';
import {withFavicon} from '../branding.mjs';
import {materialSections, materialSlug} from '../admin/material-config.js';

const origin='https://prime-com.ru';
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value||'';
function find(node,test) {if(test(node))return node;for(const child of node.childNodes||[]){const found=find(child,test);if(found)return found;}return null;}
function each(node,fn) {fn(node);for(const child of node.childNodes||[])each(child,fn);}
const hasClass=(node,name)=>attr(node,'class').split(/\s+/).includes(name);
function fragment(html,parent) {return parseFragment(html).childNodes.map(node=>{node.parentNode=parent;return node;});}
const sectionFor=snapshot=>materialSections.find(section=>section.id===snapshot.section);
export const materialUrl=snapshot=>sectionFor(snapshot).prefix+'/'+snapshot.slug+'.html';
const status=record=>record.archived?'archived':record.published?(record.draft?'changed':'published'):'draft';
const imageFor=snapshot=>snapshot.cover.url||snapshot.blocks.find(b=>b.type==='image'&&b.url)?.url||'';

function text(value,max,label,required=false) {
  if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new Error('Проверьте поле «'+label+'»');
  value=value.trim();if(required&&!value)throw new Error('Заполните поле «'+label+'»');return value;
}
function normalize(input,publish=false) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Некорректный материал');
  const title=text(input.title,200,'Название',true);
  if(title.length<2)throw new Error('Название должно содержать не менее двух символов');
  const section=materialSections.find(s=>s.id===input.section);
  if(!section)throw new Error('Выберите раздел сайта');
  const slug=input.slug||materialSlug(title);
  if(typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>100)throw new Error('Адрес: используйте латинские буквы, цифры и дефисы');
  const summary=text(input.summary??'',500,'Краткое описание');
  const cover={url:text(input.cover?.url??'',2500,'Обложка'),alt:text(input.cover?.alt??'',500,'Описание обложки')};
  if(!safeUrl(cover.url,{image:true}))throw new Error('Некорректный адрес обложки');
  if(!Array.isArray(input.blocks)||input.blocks.length>60)throw new Error('Добавьте не более 60 блоков');
  const blocks=input.blocks.map(block=>{
    if(!block||!['paragraph','heading','list','image','link'].includes(block.type))throw new Error('Неизвестный тип блока');
    const result={type:block.type,text:text(block.text??'',20000,'Текст блока')};
    if(block.type==='image'||block.type==='link') {
      result.url=text(block.url??'',2500,'Адрес');
      if(!safeUrl(result.url,{image:block.type==='image'})||(publish&&!result.url))throw new Error('Укажите безопасный адрес в блоке');
      if(block.type==='image')result.alt=text(block.alt??'',500,'Описание изображения');
    }
    return result;
  });
  if(publish&&!blocks.some(b=>b.type==='image'?b.url:b.text))throw new Error('Добавьте текст или изображение перед публикацией');
  const seo={};
  for(const [key,max] of Object.entries({title:200,description:500,keywords:1000,ogTitle:200,ogDescription:500,ogImage:2500}))seo[key]=text(input.seo?.[key]??'',max,'SEO');
  seo.robots=input.seo?.robots||'index, follow';
  if(!['index, follow','noindex, follow'].includes(seo.robots)||!safeUrl(seo.ogImage,{image:true}))throw new Error('Проверьте настройки SEO');
  const result={title,section:section.id,slug,summary,cover,blocks,seo};
  if(JSON.stringify(result).length>200000)throw new Error('Слишком большой материал: разделите его на несколько страниц');
  return result;
}

export class MaterialStore {
  constructor(root,dir,legacyStore) {this.root=root;this.dir=dir;this.folder=path.join(dir,'materials');this.legacy=legacyStore;}
  all() {
    if(!fs.existsSync(this.folder))return [];
    return fs.readdirSync(this.folder).filter(f=>f.endsWith('.json')&&validId.test(f.slice(0,-5))).map(f=>readJson(path.join(this.folder,f),null)).filter(Boolean);
  }
  get(id) {
    if(!validId.test(id||''))throw Object.assign(new Error('Материал не найден'),{status:404});
    const record=readJson(path.join(this.folder,id+'.json'),null);
    if(!record)throw Object.assign(new Error('Материал не найден'),{status:404});return record;
  }
  detail(record) {
    const content=record.draft||record.published;
    return {...record,content,status:status(record),url:materialUrl(content),publishedUrl:record.published?materialUrl(record.published):null,
      history:record.history.map(({snapshot,...entry})=>({...entry,title:snapshot.title}))};
  }
  list() {
    return this.all().map(record=>{
      const snapshot=record.draft||record.published;
      return {id:record.id,title:snapshot.title,section:snapshot.section,category:sectionFor(snapshot).name,url:materialUrl(snapshot),publishedUrl:record.published?materialUrl(record.published):null,status:status(record),updatedAt:record.updatedAt};
    }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  checkUrl(snapshot,id) {
    const url=materialUrl(snapshot);
    if(Object.hasOwn(this.legacy.routes,url)||fs.existsSync(path.join(this.root,'public',url)))throw Object.assign(new Error('Такой адрес уже занят существующей страницей'),{status:409});
    for(const other of this.all()) {
      if(other.id===id)continue;
      const reserved=[...other.urls,...[other.draft,other.published].filter(Boolean).map(materialUrl)];
      if(reserved.includes(url))throw Object.assign(new Error('Такой адрес уже занят другим материалом'),{status:409});
    }
  }
  save(input) {
    return withLock(this.dir,()=>{
      const now=new Date().toISOString(),create=!input.id;
      if(create&&!['draft','publish'].includes(input.action))throw new Error('Сначала создайте материал');
      const record=create?{id:randomUUID(),version:0,createdAt:now,updatedAt:now,draft:null,published:null,archived:false,history:[],urls:[]}:this.get(input.id);
      if(!create&&input.version!==record.version)throw Object.assign(new Error('Материал изменён в другой вкладке. Обновите страницу.'),{status:409});
      const remember=()=>{if(record.published)record.history.unshift({id:randomUUID(),createdAt:now,snapshot:record.published});record.history=record.history.slice(0,20);};
      if(['draft','publish'].includes(input.action)) {
        if(record.archived)throw new Error('Сначала верните материал из архива');
        const snapshot=normalize(input.content,input.action==='publish');this.checkUrl(snapshot,record.id);
        if(input.action==='publish') {
          remember();record.published=snapshot;record.draft=null;record.publishedAt ||= now;
          record.urls=[...new Set([...record.urls,materialUrl(snapshot)])];
        } else record.draft=snapshot;
      } else if(input.action==='unpublish'||input.action==='archive') {
        if(input.content){const snapshot=normalize(input.content);this.checkUrl(snapshot,record.id);record.draft=snapshot;}
        remember();record.draft ||= record.published;record.published=null;record.archived=input.action==='archive';
      } else if(input.action==='unarchive') {record.archived=false;}
      else if(input.action==='restore') {
        const previous=record.history.find(h=>h.id===input.historyId);if(!previous)throw new Error('Версия не найдена');
        this.checkUrl(previous.snapshot,record.id);record.draft=previous.snapshot;record.archived=false;
      } else if(input.action==='discard') {
        if(!record.published)throw new Error('Нельзя отменить единственный черновик. Переместите материал в архив.');record.draft=null;
      } else throw new Error('Неизвестное действие');
      record.version++;record.updatedAt=now;writeJson(path.join(this.folder,record.id+'.json'),record);
      return this.detail(record);
    });
  }
  published() {return this.all().filter(r=>r.published&&!r.archived).sort((a,b)=>(b.publishedAt||b.updatedAt).localeCompare(a.publishedAt||a.updatedAt));}
  resolve(url) {
    if(!url.endsWith('.html')||!materialSections.some(section=>url.startsWith(section.prefix+'/')))return null;
    const record=this.published().find(r=>materialUrl(r.published)===url||r.urls.includes(url));
    if(!record)return null;
    const current=materialUrl(record.published);
    return current===url?{html:this.render(record,false)}:{redirect:current};
  }
  render(record,preview=false) {
    const s=(preview?record.draft:null)||record.published;
    if(!s)throw Object.assign(new Error('Материал пока не опубликован'),{status:404});
    const section=sectionFor(s),url=materialUrl(s);
    const template=this.legacy.html(digest('pages/produktsiya/shpatlevka-epo-strong.html').slice(0,16));
    const doc=parse(template),article=find(doc,n=>hasClass(n,'item-page'));
    if(!article)throw new Error('Не найден шаблон материала');
    const paragraphs=value=>value.split(/\n\s*\n/).filter(Boolean).map(p=>'<p>'+escape(p).replaceAll('\n','<br>')+'</p>').join('');
    const blocks=s.blocks.map(b=>{
      if(b.type==='paragraph')return paragraphs(b.text);
      if(b.type==='heading')return b.text?'<h2>'+escape(b.text)+'</h2>':'';
      if(b.type==='list')return '<ul>'+b.text.split('\n').filter(x=>x.trim()).map(x=>'<li>'+escape(x)+'</li>').join('')+'</ul>';
      if(b.type==='image')return b.url?`<figure><img src="${escape(b.url)}" alt="${escape(b.alt)}" loading="lazy">${b.text?'<figcaption>'+escape(b.text)+'</figcaption>':''}</figure>`:'';
      return b.url?`<p><a class="pc-button" href="${escape(b.url)}">${escape(b.text||'Подробнее')}</a></p>`:'';
    }).join('\n');
    article.childNodes=fragment(`<div class="pc-content pc-material" id="pc-material"><nav class="pc-material-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span> / </span><a href="${section.landing}">${escape(section.name)}</a></nav><h1>${escape(s.title)}</h1>${s.summary?'<p class="pc-material-lead">'+escape(s.summary)+'</p>':''}${s.cover.url?`<figure class="pc-material-cover"><img src="${escape(s.cover.url)}" alt="${escape(s.cover.alt||s.title)}" fetchpriority="high"></figure>`:''}<div class="pc-material-body">${blocks}</div><p class="pc-material-back"><a href="${section.landing}">← ${escape(section.name)}</a></p></div>`,article);
    each(doc,node=>{
      if(node.tagName==='li'&&hasClass(node,'g-menu-item')) {
        const cls=node.attrs.find(a=>a.name==='class');cls.value=cls.value.split(/\s+/).filter(c=>c!=='active').join(' ');
        if(find(node,n=>n.tagName==='a'&&attr(n,'href')===(section.parent||section.landing)))cls.value+=' active';
      }
    });
    const head=find(doc,n=>n.tagName==='head');
    head.childNodes=head.childNodes.filter(n=>!(n.tagName==='meta'&&['author','rights','generator'].includes(attr(n,'name'))));
    head.childNodes.push(...fragment('<link rel="stylesheet" href="/styles/materials.css?v=1">',head));
    const description=s.seo.description||s.summary||s.blocks.find(b=>b.type==='paragraph')?.text.slice(0,250)||s.title;
    const html=editPage(serialize(doc),{}, {...s.seo,title:s.seo.title||s.title+' — ПраймКом',description,canonical:origin+url,ogTitle:s.seo.ogTitle||s.title,ogDescription:s.seo.ogDescription||description,ogImage:s.seo.ogImage||imageFor(s)});
    const settings=this.legacy.settings();
    return withFavicon(applyGlobals(html,settings,Object.keys(settings.mediaReplacements).length?String(settings.version):''));
  }
  decorate(html,url) {
    const homepage=url==='/',records=this.published().filter(r=>homepage||[sectionFor(r.published).landing,sectionFor(r.published).parent].includes(url));
    if(!records.length)return html;
    const shown=homepage?records.slice(0,6):records;
    const cards=shown.map(record=>{const s=record.published,img=imageFor(s);return `<article class="pc-material-card">${img?`<a href="${materialUrl(s)}" tabindex="-1" aria-hidden="true"><img src="${escape(img)}" alt="" loading="lazy"></a>`:''}<div><small>${escape(sectionFor(s).name)}</small><h3><a href="${materialUrl(s)}">${escape(s.title)}</a></h3>${s.summary?'<p>'+escape(s.summary)+'</p>':''}<a href="${materialUrl(s)}">Подробнее →</a></div></article>`;}).join('');
    const settings=this.legacy.settings();
    const sectionHtml=applyGlobals(`<section class="pc-content pc-material-list"><div class="${homepage?'g-container':''}"><h2>${homepage?'Последние материалы':'Материалы раздела'}</h2><div class="pc-material-grid">${cards}</div></div></section>`,settings);
    const doc=parse(html);
    if(homepage) {
      const hero=find(doc,n=>attr(n,'id')==='g-header');if(!hero)return html;
      const parent=hero.parentNode;parent.childNodes.splice(parent.childNodes.indexOf(hero)+1,0,...fragment(sectionHtml,parent));
    } else {
      const main=find(doc,n=>hasClass(n,'item-page'))||find(doc,n=>attr(n,'id')==='g-mainbar');if(!main)return html;
      main.childNodes.push(...fragment(sectionHtml,main));
    }
    const head=find(doc,n=>n.tagName==='head');head.childNodes.push(...fragment('<link rel="stylesheet" href="/styles/materials.css?v=1">',head));
    return serialize(doc);
  }
}
