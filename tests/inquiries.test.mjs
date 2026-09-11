import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {createContactHandler, listInquiries, sendInquiryEmail} from '../inquiries.mjs';

const valid = () => ({form:'assortment',name:'Тест клиента',email:'client@example.org',phone:'+7 (999) 123-45-67',message:'Нужна порошковая краска RAL 9005, 20 кг.',requestId:randomUUID()});
async function fixture(t, deliver) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'primecom-inquiry-'));
  const handler=createContactHandler({root,deliver,store:{settings:()=>({contacts:{email:'owner@example.org'}})},
    respond:(res,status,body,type)=>{res.writeHead(status,{'Content-Type':type});res.end(body);},
    errorPage:(_,message)=>message,withYandex:html=>html});
  const server=http.createServer((req,res)=>handler(req,res).catch(e=>{res.statusCode=500;res.end(e.message);}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});});
  return {root,post:(body,origin=base)=>fetch(base,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Origin:origin},body:JSON.stringify(body)})};
}

test('assortment request sends only to owner, keeps phone and deduplicates browser retries', async t=>{
  let sent=0;
  const {root,post}=await fixture(t,async(record,recipient)=>{sent++;assert.equal(recipient,'owner@example.org');assert.equal(record.phone,'+7 (999) 123-45-67');return 'queued';});
  const input={...valid(),to:'intruder@example.org'};
  const first=await post(input), second=await post(input);
  assert.equal(first.status,201);assert.equal(second.status,201);assert.equal(sent,1);
  const rows=listInquiries(path.join(root,'data'));
  assert.equal(rows.length,1);assert.equal(rows[0].emailStatus,'queued');assert.equal(rows[0].subject,'Запрос ассортимента');
  assert.equal(fs.statSync(path.join(root,'data/requests',input.requestId+'.json')).mode & 0o777,0o600);
});

test('invalid or foreign submissions do not send mail; delivery failure preserves the request', async t=>{
  let sent=0;
  const {root,post}=await fixture(t,async()=>{sent++;throw new Error('MAIL_REJECTED');});
  assert.equal((await post(valid(),'https://foreign.example')).status,403);
  for (const overrides of [{phone:''},{phone:'123'},{email:'client@example.org\r\nBcc:evil@example.org'},{website:'spam'}, {message:'a'}, {name:[]}, {requestId:'../../file',phone:'bad'}])
    assert.equal((await post({...valid(),...overrides})).status,400);
  assert.equal(sent,0);
  assert.equal((await post(valid())).status,201);
  const rows=listInquiries(path.join(root,'data'));assert.equal(rows.length,1);assert.equal(rows[0].emailStatus,'failed');
  fs.writeFileSync(path.join(root,'data/inquiries.jsonl'),JSON.stringify({id:'legacy',createdAt:'2020-01-01T00:00:00.000Z',name:'Старая заявка'})+'\n');
  assert.equal(listInquiries(path.join(root,'data')).length,2);
});

test('mail transport encodes Russian text and uses fixed envelope sender with client Reply-To', async t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'primecom-mail-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const capture=path.join(temp,'message.json'), command=path.join(temp,'sendmail');
  fs.writeFileSync(command,`#!${process.execPath}\nconst fs=require('fs');let body='';process.stdin.on('data',c=>body+=c);process.stdin.on('end',()=>fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({args:process.argv.slice(2),body})));\n`,{mode:0o700});
  const record={...valid(),id:randomUUID(),createdAt:new Date().toISOString(),subject:'Запрос ассортимента'};
  assert.equal(await sendInquiryEmail(record,'owner@example.org',{command,sender:'website@example.org'}),'queued');
  const message=JSON.parse(fs.readFileSync(capture));
  assert.deepEqual(message.args,['-oi','-t','-f','website@example.org']);
  assert.match(message.body,/To: owner@example.org\r\nReply-To: client@example.org\r\n/);
  const decoded=Buffer.from(message.body.split('\r\n\r\n')[1].replace(/\s/g,''),'base64').toString('utf8');
  assert.match(decoded,/Номер телефона: \+7 \(999\) 123-45-67/);assert.ok(decoded.includes(record.message));
  await assert.rejects(sendInquiryEmail({...record,email:'client@example.org\nBcc:bad@example.org'},'owner@example.org',{command,sender:'website@example.org'}),/MAIL_ADDRESS_INVALID/);
});
