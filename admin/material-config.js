export const materialSections = [
  {id:'articles', name:'Новости и статьи', prefix:'/novosti-i-stati', landing:'/novosti-i-stati.html'},
  {id:'news', name:'Новости ЛКМ', prefix:'/novosti-i-stati/novosti-lkm', landing:'/novosti-i-stati/novosti-lkm.html', parent:'/novosti-i-stati.html'},
  {id:'presentations', name:'Презентации возможностей', prefix:'/novosti-i-stati/prezentatsii-vozmozhnostej', landing:'/novosti-i-stati/prezentatsii-vozmozhnostej.html', parent:'/novosti-i-stati.html'},
  {id:'products', name:'Продукция', prefix:'/produktsiya', landing:'/produktsiya.html'},
  {id:'paints', name:'Краски Micropul', prefix:'/hydrogen', landing:'/micropul.html'},
  {id:'equipment', name:'Оборудование', prefix:'/oborudovanie', landing:'/oborudovanie.html'},
  {id:'chemistry', name:'Химия для металла', prefix:'/sredstva-dlya-obrabotki-poverkhnosti', landing:'/sredstva-dlya-obrabotki-poverkhnosti.html'},
  {id:'company', name:'О компании', prefix:'/o-kompanii', landing:'/o-kompanii.html'},
];
export function materialSlug(title) {
  const letters={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
  return String(title).toLowerCase().replace(/[а-яё]/g,c=>letters[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100).replace(/-$/,'');
}
