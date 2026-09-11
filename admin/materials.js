import {materialSections, materialSlug} from './material-config.js';

const labels={draft:'Черновик',changed:'Есть изменения',published:'На сайте',archived:'В архиве'};
const blockLabels={paragraph:'Текст',heading:'Заголовок',list:'Список',image:'Изображение',link:'Ссылка-кнопка'};
export function createMaterialsUi({api,$,$$,e,field,head,icon,toast,task,pickMedia,state,dirty,date,navigateSaved}) {
  let record=null,content=null,tab='content',slugEdited=false;
  const section=()=>materialSections.find(s=>s.id===content.section)||materialSections[0];
  const url=()=>section().prefix+'/'+(content.slug||materialSlug(content.title)||'adres-materiala')+'.html';
  const changed=()=>dirty();
  const badge=value=>`<span class="badge ${value==='draft'||value==='changed'?'draft':value==='archived'?'neutral':''}">${labels[value]}</span>`;
  const blank=()=>({title:'',section:'articles',slug:'',summary:'',cover:{url:'',alt:''},blocks:[{type:'paragraph',text:''}],seo:{title:'',description:'',keywords:'',robots:'index, follow',ogTitle:'',ogDescription:'',ogImage:''}});

  async function list() {
    state.materials=await api('materials');
    $('#content').innerHTML=head('Материалы','Создавайте статьи, товары и другие страницы. Опубликованные материалы появляются в выбранном разделе сайта.',`<a class="button primary" href="#new-material">+ Добавить материал</a>`)+`<div class="card"><div class="toolbar"><input id="material-search" type="search" placeholder="Название или адрес" aria-label="Поиск материалов"><select id="material-section" aria-label="Раздел материалов"><option value="">Все разделы</option>${materialSections.map(s=>`<option value="${s.id}">${e(s.name)}</option>`).join('')}</select><select id="material-status" aria-label="Статус материалов"><option value="active">Активные материалы</option><option value="draft">Черновики</option><option value="published">Опубликованные</option><option value="archived">Архив</option></select></div><div id="material-list"></div></div>`;
    const draw=()=>{
      const query=$('#material-search').value.toLowerCase(),group=$('#material-section').value,filter=$('#material-status').value;
      const rows=state.materials.filter(r=>(!group||r.section===group)&&(r.title+' '+r.url).toLowerCase().includes(query)&&(filter==='active'?r.status!=='archived':filter==='published'?['published','changed'].includes(r.status):filter==='draft'?['draft','changed'].includes(r.status):r.status==='archived'));
      $('#material-list').innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Материал</th><th>Статус</th><th>Обновлён</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td class="title-cell"><strong>${e(r.title)}</strong><small>${e(r.category)} · ${e(r.url)}</small></td><td>${badge(r.status)}</td><td><small>${date(r.updatedAt)}</small></td><td><a class="button small" href="#material=${r.id}">Открыть</a></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty"><strong>${filter==='archived'?'Архив пуст':'Материалы пока не найдены'}</strong><p>${state.materials.length?'Измените фильтр или поисковый запрос.':'Добавьте первый материал, сохраните черновик и проверьте его перед публикацией.'}</p><a class="button primary" href="#new-material">Добавить материал</a></div>`;
    };
    $('#material-search').oninput=draw;$('#material-section').onchange=draw;$('#material-status').onchange=draw;draw();
  }

  async function editor(id,initialTab='content') {
    record=id?await api('material?id='+encodeURIComponent(id)):null;
    content=record?structuredClone(record.content):blank();tab=initialTab;slugEdited=!!record;state.dirty=false;render();
  }
  async function save(action,redraw=true,extra={}) {
    record=await api('material',{id:record?.id,version:record?.version,action,content,...extra});
    content=structuredClone(record.content);state.dirty=false;slugEdited=true;navigateSaved(record.id);
    state.materials=await api('materials');
    if(redraw)render();
    toast(action==='publish'?'Материал опубликован':action==='archive'?'Материал перемещён в архив':action==='unpublish'?'Материал снят с публикации':action==='unarchive'?'Материал возвращён в черновики':action==='restore'?'Версия восстановлена в черновик':action==='discard'?'Изменения черновика отменены':'Черновик сохранён');
    return record;
  }
  function render() {
    const archived=record?.status==='archived';
    $('#content').innerHTML=`<a class="crumb" href="#materials">← Все материалы</a><div class="page-head editor-head"><div><h1>${record?'Редактирование материала':'Новый материал'}</h1><div class="edit-state ${state.dirty?'dirty':''}" id="edit-state">${state.dirty?'Есть несохранённые изменения':record?labels[record.status]:'Заполните название, выберите раздел и добавьте содержимое.'}</div></div><div class="actions editor-actions">${archived?'<button class="primary" id="material-unarchive">Вернуть в черновики</button>':'<button id="material-preview">Предпросмотр</button><button id="material-save">'+icon('save')+' Сохранить черновик</button><button class="primary" id="material-publish">Опубликовать</button>'}</div></div><div class="material-editor-layout" id="material-editor"><div class="material-editor-main"><div class="tabs" role="tablist">${[['content','Содержимое'],['cover','Обложка'],['seo','SEO'],['history','История']].map(([id,label])=>`<button type="button" role="tab" aria-selected="${tab===id}" data-material-tab="${id}" class="${tab===id?'active':''}">${label}</button>`).join('')}</div><section id="material-panel"></section></div><aside class="card card-pad material-options"><h2>Размещение на сайте</h2><label class="field"><span class="field-label">Раздел сайта</span><select name="section" ${archived?'disabled':''}>${materialSections.map(s=>`<option value="${s.id}" ${s.id===content.section?'selected':''}>${e(s.name)}</option>`).join('')}</select></label>${field('Адрес страницы','slug',content.slug,{max:100,note:'Латинские буквы, цифры и дефисы. Адрес предлагается по названию.'})}<p class="material-url" id="material-url">${e(url())}</p><p class="field-note">После публикации карточка появится в разделе «<span id="material-section-name">${e(section().name)}</span>» и среди последних материалов на главной.</p>${record?`<hr><p>${badge(record.status)}</p>${record.publishedUrl?`<a class="button small" href="${e(record.publishedUrl)}" target="_blank" rel="noopener">Открыть на сайте ↗</a>`:''}<div class="material-lifecycle">${record.publishedUrl?'<button class="small" id="material-unpublish">Снять с публикации</button>':''}${!archived?'<button class="small danger" id="material-archive">В архив</button>':''}</div>`:''}<p class="footer-help">Черновик виден только в панели. Публикации и изображения сохраняются при обновлении сайта.</p></aside></div>`;
    $$('[data-material-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.materialTab;render();});
    if(archived)$('#material-unarchive').onclick=ev=>task(ev.currentTarget,()=>save('unarchive'));
    else {
      $('#material-save').onclick=ev=>task(ev.currentTarget,()=>save('draft'));
      $('#material-publish').onclick=ev=>task(ev.currentTarget,()=>save('publish'));
      $('#material-preview').onclick=ev=>task(ev.currentTarget,async()=>{
        if(!record||state.dirty)await save('draft',false);
        $('#material-panel').innerHTML=`<div class="note">Предпросмотр сохранённого материала. <button class="small" id="material-back">Вернуться к редактированию</button></div><iframe class="preview-frame" sandbox="allow-same-origin" title="Предпросмотр материала" src="/api/admin/material-preview?id=${record.id}&v=${record.version}#pc-material"></iframe>`;
        $('#material-back').onclick=render;
      });
    }
    if($('#material-unpublish'))$('#material-unpublish').onclick=ev=>task(ev.currentTarget,()=>save('unpublish'));
    if($('#material-archive'))$('#material-archive').onclick=ev=>task(ev.currentTarget,()=>save('archive'));
    panel();bindFields();
    if(archived)$$('#material-panel input,#material-panel textarea,#material-panel select,#material-panel button,#material-editor [name="slug"]').forEach(el=>el.disabled=true);
  }
  function bindFields() {
    $$('#material-editor [name]').forEach(input=>{
      input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>{
        const keys=input.name.split('.');let target=content;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=input.value;
        if(input.name==='slug')slugEdited=true;
        if(input.name==='title'&&!slugEdited){content.slug=materialSlug(input.value);$('[name="slug"]').value=content.slug;}
        $('#material-url').textContent=url();$('#material-section-name').textContent=section().name;changed();
        if(tab==='seo')updateSeoPreview();
      });
    });
  }
  function panel() {
    const box=$('#material-panel');
    if(tab==='content') {
      box.innerHTML=`<section class="card card-pad form-section">${field('Название материала','title',content.title,{max:200,note:'Заголовок на странице и в карточке раздела.'})}${field('Краткое описание','summary',content.summary,{area:true,max:500,note:'Небольшой анонс для карточки и начала страницы.'})}</section><div id="material-blocks">${content.blocks.map((block,i)=>blockForm(block,i)).join('')}</div><div class="card card-pad material-add-block"><strong>Добавить блок</strong><div class="actions">${Object.entries(blockLabels).map(([type,label])=>`<button type="button" class="small" data-add-block="${type}">+ ${label}</button>`).join('')}</div></div>`;
      $$('[data-block]').forEach(input=>input.oninput=()=>{content.blocks[Number(input.dataset.block)][input.dataset.key]=input.value;changed();});
      $$('[data-add-block]').forEach(button=>button.onclick=()=>{content.blocks.push({type:button.dataset.addBlock,text:'',...(['image','link'].includes(button.dataset.addBlock)?{url:'',alt:''}:{})});changed();render();});
      $$('[data-remove-block]').forEach(button=>button.onclick=()=>{content.blocks.splice(Number(button.dataset.removeBlock),1);changed();render();});
      $$('[data-move-block]').forEach(button=>button.onclick=()=>{const i=Number(button.dataset.moveBlock),next=i+Number(button.dataset.direction);[content.blocks[i],content.blocks[next]]=[content.blocks[next],content.blocks[i]];changed();render();});
      $$('[data-block-image]').forEach(button=>button.onclick=()=>pickMedia(asset=>{const block=content.blocks[Number(button.dataset.blockImage)];block.url=asset.url;block.alt ||= asset.name;changed();render();}));
    } else if(tab==='cover') {
      box.innerHTML=`<section class="card card-pad"><h2>Обложка материала</h2><p class="muted">Изображение появится в карточке раздела и в начале страницы.</p><div class="material-cover-preview">${content.cover.url?`<img src="${e(encodeURI(content.cover.url))}" alt="${e(content.cover.alt)}">`:'<span>Обложка не выбрана</span>'}</div><div class="actions material-cover-actions"><button id="material-cover-pick">Выбрать или загрузить изображение</button>${content.cover.url?'<button class="quiet" id="material-cover-remove">Убрать обложку</button>':''}</div>${field('Адрес изображения','cover.url',content.cover.url,{max:2500})}${field('Описание изображения (alt)','cover.alt',content.cover.alt,{max:500,note:'Опишите, что изображено на фотографии.'})}</section>`;
      $('#material-cover-pick').onclick=()=>pickMedia(asset=>{content.cover={url:asset.url,alt:content.cover.alt||asset.name};changed();render();});
      if($('#material-cover-remove'))$('#material-cover-remove').onclick=()=>{content.cover={url:'',alt:''};changed();render();};
    } else if(tab==='seo') {
      box.innerHTML=`<div class="card card-pad form-section"><h2>В поиске</h2>${field('Заголовок в поиске (title)','seo.title',content.seo.title,{max:200,note:'Если оставить пустым, используется название материала.'})}${field('Описание в поиске (description)','seo.description',content.seo.description,{area:true,max:500,note:'Если оставить пустым, используется краткое описание.'})}${field('Ключевые слова','seo.keywords',content.seo.keywords,{max:1000})}<label class="field"><span class="field-label">Индексация</span><select name="seo.robots"><option value="index, follow" ${content.seo.robots==='index, follow'?'selected':''}>Разрешить поисковым системам</option><option value="noindex, follow" ${content.seo.robots==='noindex, follow'?'selected':''}>Не показывать в поиске</option></select></label><p class="field-note">Canonical соответствует адресу материала. При смене адреса после публикации старый адрес автоматически перенаправляет на новый.</p></div><div class="search-preview form-section"><span class="domain" id="material-seo-url"></span><h3 id="material-seo-title"></h3><p id="material-seo-description"></p></div><section class="card card-pad"><h2>В социальных сетях</h2>${field('Заголовок карточки','seo.ogTitle',content.seo.ogTitle,{max:200})}${field('Описание карточки','seo.ogDescription',content.seo.ogDescription,{area:true,max:500})}${field('Изображение карточки','seo.ogImage',content.seo.ogImage,{max:2500,note:'По умолчанию используется обложка.'})}<button id="material-og-pick">Выбрать изображение</button></section>`;
      $('#material-og-pick').onclick=()=>pickMedia(asset=>{content.seo.ogImage=asset.url;changed();render();});updateSeoPreview();
    } else {
      box.innerHTML=`${record?.status==='changed'?'<div class="note">Есть неопубликованные изменения. <button class="small" id="material-discard">Отменить изменения черновика</button></div>':''}<section class="card">${record?.history.length?record.history.map(h=>`<div class="history-row"><div><strong>${e(h.title)}</strong><small>${date(h.createdAt)}</small></div><button class="small" data-restore-material="${h.id}">Восстановить в черновик</button></div>`).join(''):'<div class="empty"><strong>Предыдущих публикаций пока нет</strong>История появится после обновления опубликованного материала.</div>'}</section>`;
      $$('[data-restore-material]').forEach(button=>button.onclick=()=>task(button,()=>save('restore',true,{historyId:button.dataset.restoreMaterial})));
      if($('#material-discard'))$('#material-discard').onclick=ev=>task(ev.currentTarget,()=>save('discard'));
    }
  }
  function blockForm(block,i) {
    const control=(label,key,area=false)=>`<label class="field"><span class="field-label">${label}</span>${area?`<textarea data-block="${i}" data-key="${key}" maxlength="20000">${e(block[key]||'')}</textarea>`:`<input data-block="${i}" data-key="${key}" value="${e(block[key]||'')}" maxlength="${key==='url'?2500:500}">`}</label>`;
    return `<section class="card material-block"><div class="material-block-head"><strong>${i+1}. ${blockLabels[block.type]}</strong><div class="actions"><button class="small quiet" data-move-block="${i}" data-direction="-1" aria-label="Поднять блок ${i+1}" ${i===0?'disabled':''}>↑</button><button class="small quiet" data-move-block="${i}" data-direction="1" aria-label="Опустить блок ${i+1}" ${i===content.blocks.length-1?'disabled':''}>↓</button><button class="small quiet danger" data-remove-block="${i}" aria-label="Удалить блок ${i+1}">Убрать</button></div></div><div class="card-pad">${block.type==='image'?`${block.url?`<img class="material-block-image" src="${e(encodeURI(block.url))}" alt="">`:''}<button class="small material-block-pick" data-block-image="${i}">Выбрать или загрузить изображение</button>${control('Адрес изображения','url')}${control('Описание изображения (alt)','alt')}${control('Подпись под изображением','text')}`:block.type==='link'?control('Текст кнопки','text')+control('Адрес ссылки','url'):control(block.type==='list'?'Пункты списка — каждый с новой строки':block.type==='heading'?'Заголовок':'Текст','text',block.type!=='heading')}</div></section>`;
  }
  function updateSeoPreview() {
    $('#material-seo-url').textContent='prime-com.ru'+url();
    $('#material-seo-title').textContent=content.seo.title||content.title||'Название материала';
    $('#material-seo-description').textContent=content.seo.description||content.summary||'Краткое описание материала';
  }
  return {list,editor};
}
