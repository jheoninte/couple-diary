const {test}=require('node:test');
const assert=require('node:assert/strict');
const {dueReminders,occasionsOn,localParts}=require('../functions/reminders.cjs');
const {createService}=require('../functions/service.cjs');
const {render,LANGUAGES,EXTRA_KEYS}=require('../functions/push-messages.cjs');
const base={user1:'alice',user2:'bob',startDate:'2026-01-01',settings:{alice:{displayName:'지수'},bob:{displayName:'민준'}},anniversaries:[],birthdays:{}};
// 09:00 / 20:00 in Seoul (UTC+9)
const seoul=(date,hour)=>Date.UTC(+date.slice(0,4),+date.slice(5,7)-1,+date.slice(8,10),hour-9);
const kinds=events=>events.map(e=>[e.kind,e.to,e.when,e.date,e.n??e.title??e.name]);

test('100-day steps and yearly anniversaries use the app counting (start date is day 1)',()=>{
 assert.deepEqual(occasionsOn(base,'2026-04-10').map(o=>[o.kind,o.n]),[['days',100]]);
 assert.deepEqual(occasionsOn(base,'2027-01-01').map(o=>[o.kind,o.n]),[['years',1]]);
 assert.deepEqual(occasionsOn(base,'2026-01-01'),[]);
 assert.deepEqual(occasionsOn({...base,startDate:'2024-02-29'},'2025-02-28').map(o=>o.kind),['years']);
});
test('custom anniversaries: one-time on the date, recurring every year from the date',()=>{
 const c={...base,startDate:null,anniversaries:[{id:'a1',name:'첫 여행',icon:'✈️',date:'2026-05-05',recurring:true},{id:'a2',name:'이사',icon:'🏠',date:'2026-06-01',recurring:false}]};
 assert.equal(occasionsOn(c,'2025-05-05').length,0);assert.equal(occasionsOn(c,'2026-05-05').length,1);assert.equal(occasionsOn(c,'2030-05-05').length,1);
 assert.equal(occasionsOn(c,'2026-06-01').length,1);assert.equal(occasionsOn(c,'2027-06-01').length,0);
});
test('reminders fire at 20:00 the day before and 09:00 on the day, in each member time zone',()=>{
 const c={...base,timeZones:{bob:'America/New_York'}};
 assert.deepEqual(kinds(dueReminders('cid',c,seoul('2026-04-09',20))),[['days','alice','tomorrow','2026-04-10',100]]);
 // 09:00 in Seoul is 20:00 the evening before in New York: Bob gets his "tomorrow" reminder at the same moment.
 assert.deepEqual(kinds(dueReminders('cid',c,seoul('2026-04-10',9))),[['days','alice','today','2026-04-10',100],['days','bob','tomorrow','2026-04-10',100]]);
 assert.deepEqual(dueReminders('cid',c,seoul('2026-04-10',12)),[]);
 // 09:00 in New York on April 10 = 13:00 UTC
 assert.deepEqual(kinds(dueReminders('cid',c,Date.UTC(2026,3,10,13))),[['days','bob','today','2026-04-10',100]]);
});
test('a birthday is announced only to the partner, with the birthday person name',()=>{
 const c={...base,birthdays:{alice:'07-21'}};
 const events=dueReminders('cid',c,seoul('2026-07-20',20));
 assert.deepEqual(kinds(events),[['birthday','bob','tomorrow','2026-07-21','지수']]);
 assert.equal(render('birthday',events[0],'ko').title,'🎂 내일은 지수님의 생일이에요');
 assert.match(events[0].dedupe,/^cid_bob_tomorrow_2026-07-21_b-alice$/);
});
test('reminder and subscription texts exist in every language',()=>{
 for(const lang of LANGUAGES)for(const [kind,e] of [['anniversary',{title:'X',icon:'🎉'}],['days',{n:100}],['years',{n:2}],['birthday',{name:'Ana'}],['plusStarted',{name:'Ana'}],['billingIssue',{}],['plusExpiring',{at:Date.UTC(2026,10,18)}]])
  for(const when of ['today','tomorrow']){const m=render(kind,{...e,when},lang,'Asia/Seoul');assert.ok(m.title&&m.body,`${lang} ${kind}`);assert.doesNotMatch(m.title+m.body,/[{}]|undefined/,`${lang} ${kind} ${when}`);}
 assert.equal(EXTRA_KEYS.length,18);
 assert.equal(render('days',{n:1000,when:'today'},'ko').title,'💕 함께한 지 1,000일');
 assert.equal(render('diary',{name:'나',date:'2026-11-15'},'ko').title,'💌 연인의 일기가 도착했어요');
});

function fixture(){
 const docs=new Map();
 const store={async transaction(fn){const staged=new Map(docs);const result=await fn({get:async p=>structuredClone(staged.get(p)),set:(p,v)=>staged.set(p,structuredClone(v)),delete:p=>staged.delete(p)});docs.clear();for(const [k,v] of staged)docs.set(k,v);return result;}};
 return {docs,run:createService(store,{now:()=>Date.UTC(2026,10,15)}).execute};
}
const settings=(cid,extra={})=>({action:'settings',coupleId:cid,startDate:'2026-01-01',settings:{displayName:'지수',appTitle:'우리',icon:'🐶',theme:'pink'},...extra});
test('birth date stays private: the couple only keeps month-day, and it can be cleared',async()=>{
 const f=fixture(),cid=(await f.run('alice',{action:'createSpace',startDate:'2026-01-01'})).coupleId;
 await f.run('alice',settings(cid,{birthDate:'1998-07-21'}));
 assert.equal(f.docs.get('users/alice').birthDate,'1998-07-21');assert.deepEqual(f.docs.get('couples/'+cid).birthdays,{alice:'07-21'});
 await f.run('alice',settings(cid));assert.deepEqual(f.docs.get('couples/'+cid).birthdays,{alice:'07-21'});
 await assert.rejects(f.run('alice',settings(cid,{birthDate:'2030-01-01'})),{code:'invalid-argument'});
 await f.run('alice',settings(cid,{birthDate:''}));assert.deepEqual(f.docs.get('couples/'+cid).birthdays,{});assert.equal(f.docs.get('users/alice').birthDate,null);
});
test('birthday and time zone follow a user into a newly joined space',async()=>{
 const f=fixture(),cid=(await f.run('alice',{action:'createSpace',startDate:'2026-01-01'})).coupleId;
 await f.run('bob',{action:'initialize'});await f.run('bob',{action:'pushRegister',token:'c'.repeat(64),locale:'en',timeZone:'Europe/Paris'});
 f.docs.get('users/bob').birthDate='1997-03-02';
 const {code}=await f.run('alice',{action:'invite',coupleId:cid});await f.run('bob',{action:'join',code});
 const c=f.docs.get('couples/'+cid);assert.deepEqual(c.birthdays,{bob:'03-02'});assert.deepEqual(c.timeZones,{bob:'Europe/Paris'});
 await f.run('alice',{action:'pushRegister',token:'d'.repeat(64),timeZone:'Not/AZone'});assert.deepEqual(f.docs.get('couples/'+cid).timeZones,{bob:'Europe/Paris'});
 await f.run('alice',{action:'pushRegister',token:'d'.repeat(64),timeZone:'Asia/Seoul'});assert.equal(f.docs.get('couples/'+cid).timeZones.alice,'Asia/Seoul');
 await f.run('alice',{action:'pushPrefs',notify:{diary:true,reactions:true,anniversaries:false}});assert.equal(f.docs.get('users/alice').notify.anniversaries,false);
});
test('local time helper',()=>{assert.deepEqual(localParts(Date.UTC(2026,0,1,15),'Asia/Seoul'),{date:'2026-01-02',hour:0});});
