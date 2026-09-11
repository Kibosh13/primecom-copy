import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

const emailPattern = /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoded = value => '=?UTF-8?B?' + Buffer.from(value).toString('base64') + '?=';

export function listInquiries(dir) {
  const legacy = path.join(dir, 'inquiries.jsonl');
  const rows = fs.existsSync(legacy) ? fs.readFileSync(legacy,'utf8').trim().split('\n').filter(Boolean).slice(-200).map(line=>JSON.parse(line)) : [];
  const requests = path.join(dir,'requests');
  if (fs.existsSync(requests)) {
    for (const file of fs.readdirSync(requests)) {
      if (file.endsWith('.json') && uuidPattern.test(file.slice(0,-5))) rows.push(JSON.parse(fs.readFileSync(path.join(requests,file),'utf8')));
    }
  }
  return rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,200);
}

export async function sendInquiryEmail(record, recipient, {
  command = process.env.MAIL_SENDMAIL,
  sender = process.env.MAIL_FROM,
} = {}) {
  if (!command) return 'disabled';
  if (!emailPattern.test(recipient) || !emailPattern.test(sender || '') || !emailPattern.test(record.email)) throw new Error('MAIL_ADDRESS_INVALID');
  const content = `Новый запрос с сайта https://prime-com.ru/\n\nИмя: ${record.name}\nПочта: ${record.email}\nНомер телефона: ${record.phone || 'Не указан'}\nТема: ${record.subject}\n\nЗапрос:\n${record.message}\n\nНомер заявки: ${record.id}\nДата: ${new Date(record.createdAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} (Москва)\n\nОтветьте на это письмо, чтобы написать клиенту.\n`;
  const body = Buffer.from(content).toString('base64').match(/.{1,76}/g).join('\r\n');
  const message = [
    `From: ${encoded('Сайт ПраймКом')} <${sender}>`, `To: ${recipient}`, `Reply-To: ${record.email}`,
    `Subject: ${encoded('Запрос с сайта ПраймКом')}`, `Date: ${new Date(record.createdAt).toUTCString()}`,
    `Message-ID: <${record.id}@${sender.split('@')[1]}>`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', body, '',
  ].join('\r\n');
  await new Promise((resolve,reject)=>{
    const child = spawn(command, ['-oi','-t','-f',sender], {stdio:['pipe','ignore','ignore']});
    const timer = setTimeout(()=>{child.kill('SIGKILL');reject(new Error('MAIL_TIMEOUT'));},15000);
    child.once('error',()=>{clearTimeout(timer);reject(new Error('MAIL_UNAVAILABLE'));});
    child.stdin.on('error',()=>{});
    child.once('close',code=>{clearTimeout(timer);code===0 ? resolve() : reject(new Error('MAIL_REJECTED'));});
    child.stdin.end(message);
  });
  return 'queued';
}

export function createContactHandler({root, store, respond, errorPage, withYandex, deliver = sendInquiryEmail}) {
  const attempts = new Map();
  function limited(key, max, now) {
    const times = (attempts.get(key)||[]).filter(time=>time>now-600000);
    if (times.length >= max) return true;
    attempts.set(key,[...times,now]);
    return false;
  }
  return async (req,res) => {
    const json = req.headers.accept?.includes('application/json');
    const reply = (status, message, data={}) => json
      ? respond(res,status,JSON.stringify(status < 400 ? {ok:true,...data} : {ok:false,error:message}),'application/json; charset=utf-8')
      : respond(res,status,withYandex(errorPage(status < 400 ? 'Запрос принят' : 'Проверьте сообщение',message),req.headers.host,{contactSent:status < 400}));
    try {
      const origin = new URL(req.headers.origin);
      if (origin.host !== req.headers.host || !['http:','https:'].includes(origin.protocol)) return reply(403,'Обновите страницу сайта и попробуйте ещё раз.');
    } catch { return reply(403,'Обновите страницу сайта и попробуйте ещё раз.'); }
    let size=0, chunks=[];
    for await (const chunk of req) {
      size += chunk.length;
      if (size>32768) return reply(413,'Сократите текст запроса.');
      chunks.push(chunk);
    }
    let input;
    try {
      const raw=Buffer.concat(chunks).toString('utf8');
      input=req.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
      if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error();
    } catch {return reply(400,'Не удалось прочитать запрос. Попробуйте ещё раз.');}
    const text = (key,legacy) => typeof (input[key] ?? input[legacy]) === 'string' ? (input[key] ?? input[legacy]).trim() : '';
    const assortment=input.form==='assortment';
    const name=text('name','jform[contact_name]'), email=text('email','jform[contact_email]'), phone=text('phone'),
      message=text('message','jform[contact_message]'), subject=assortment ? 'Запрос ассортимента' : text('subject','jform[contact_subject]');
    const phoneDigits=phone.replace(/\D/g,'');
    if (input.website || name.length<2 || name.length>100 || /[\r\n\x00-\x1f]/.test(name) || email.length>254 || !emailPattern.test(email)
      || !subject || subject.length>300 || /[\r\n\x00-\x1f]/.test(subject) || message.length<(assortment?10:1) || message.length>5000
      || (assortment && !phone) || (phone && (phone.length>40 || !/^[+\d\s().-]+$/.test(phone) || phoneDigits.length<10 || phoneDigits.length>15)))
      return reply(400,'Проверьте имя, почту, номер телефона и текст запроса.');
    const now=Date.now();
    for (const [key,times] of attempts) if (!times.some(t=>t>now-600000)) attempts.delete(key);
    const dataDir=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
    const dir=path.join(dataDir,'requests');
    const id=uuidPattern.test(input.requestId || '') ? input.requestId : randomUUID();
    const file=path.join(dir,id+'.json');
    // Persist before sending; the same browser retry never sends a second email.
    if (fs.existsSync(file)) return reply(201,'Спасибо! Ваш запрос принят. Мы свяжемся с вами по указанным контактам.',{id});
    if (attempts.size>5000 || limited('email:'+email.toLowerCase(),5,now) || limited('ip:'+(req.socket.remoteAddress||''),30,now))
      return reply(429,'Слишком много запросов. Попробуйте через 10 минут.');
    const record={id,createdAt:new Date(now).toISOString(),name,email,phone,subject,message,source:assortment?'assortment':'contacts',emailCopyRequested:Boolean(input.emailCopy||input['jform[contact_email_copy]']),emailStatus:'pending'};
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    fs.writeFileSync(file,JSON.stringify(record),{flag:'wx',mode:0o600});
    try {
      record.emailStatus=await deliver(record,store.settings().contacts.email);
    } catch(error) {
      record.emailStatus='failed';
      console.error('Inquiry email failed:',id,error.message);
    }
    record.emailUpdatedAt=new Date().toISOString();
    const temporary=file+'.tmp';
    fs.writeFileSync(temporary,JSON.stringify(record),{mode:0o600});fs.renameSync(temporary,file);
    return reply(201,'Спасибо! Ваш запрос принят. Мы свяжемся с вами по указанным контактам.',{id});
  };
}
