(() => {
  if (!['prime-com.ru', 'www.prime-com.ru'].includes(location.hostname) || location.protocol !== 'https:' || /^\/(admin|api\/admin)(\/|$)/.test(location.pathname) || window.top !== window) return;
  const counter = 112484093;
  const script = document.currentScript;
  if (window.primecomAnalyticsLoaded) return;
  window.primecomAnalyticsLoaded = true;
  // Official asynchronous loader provided by the Metrica Management API.
  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r)return;}
    k=e.createElement(t);a=e.getElementsByTagName(t)[0];k.async=1;k.src=r;a.parentNode.insertBefore(k,a);
  })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=112484093','ym');
  // Only known campaign and legacy-routing parameters are sent with page URLs.
  function publicUrl(raw) {
    try {
      const url = new URL(raw);
      const allowed = /^(utm_(source|medium|campaign|term|content)|yclid|ysclid|gclid|Itemid|id|option|view)$/;
      for (const key of [...url.searchParams.keys()]) if (!allowed.test(key)) url.searchParams.delete(key);
      url.hash = '';
      return url.href;
    } catch { return ''; }
  }
  ym(counter, 'init', {ssr:true, webvisor:true, clickmap:true, referrer:publicUrl(document.referrer), url:publicUrl(location.href), accurateTrackBounce:true, trackLinks:true});
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    let goal;
    const href = link.getAttribute('href');
    if (/^tel:/i.test(href)) goal = 'phone_click';
    else if (/^mailto:/i.test(href)) goal = 'email_click';
    else {
      let url;
      try { url = new URL(href, location.href); } catch { return; }
      if (['t.me','telegram.me'].includes(url.hostname)) goal = 'telegram_click';
      else if (['vk.com','www.vk.com','vk.ru','www.vk.ru'].includes(url.hostname)) goal = 'vk_click';
      else if (/прайс|price/i.test(link.textContent + ' ' + (link.title || ''))) goal = 'price_open';
    }
    if (goal) ym(counter, 'reachGoal', goal);
  });
  if (script?.dataset.contactSent === 'true') ym(counter, 'reachGoal', 'contact_sent');
})();
