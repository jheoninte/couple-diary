// Date reminders for a couple, evaluated once an hour in each member's own time zone:
// 20:00 local → "tomorrow" reminders, 09:00 local → "today" reminders.
// Sources: custom anniversaries, every 100 days together, yearly anniversaries of the start date, and birthdays
// (a birthday goes only to the partner). Pure functions; the scheduled job does the reads and the sending.
const DEFAULT_TIME_ZONE='Asia/Seoul';
const TODAY_HOUR=9,TOMORROW_HOUR=20;
function validTimeZone(value){
 if(typeof value!=='string'||!value||value.length>64)return false;
 try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}
}
function localParts(time,timeZone){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour)};
}
const dayNumber=date=>Date.UTC(+date.slice(0,4),+date.slice(5,7)-1,+date.slice(8,10))/86400000;
const addDays=(date,n)=>new Date((dayNumber(date)+n)*86400000).toISOString().slice(0,10);
const leap=year=>year%4===0&&(year%100!==0||year%400===0);
// Feb 29 dates are celebrated on Feb 28 in other years.
function sameMonthDay(monthDay,date){
 const target=date.slice(5);
 return monthDay===target||(monthDay==='02-29'&&target==='02-28'&&!leap(+date.slice(0,4)));
}
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);

function occasionsOn(couple,date){
 const rows=[];
 for(const a of couple.anniversaries||[]){
  if(!validDate(a?.date))continue;
  const hit=a.recurring?date>=a.date&&sameMonthDay(a.date.slice(5),date):a.date===date;
  if(hit)rows.push({kind:'anniversary',key:`a-${a.id}`,title:a.name,icon:a.icon});
 }
 if(validDate(couple.startDate)&&date>couple.startDate){
  // Same counting as the app: the start date is day 1.
  const n=dayNumber(date)-dayNumber(couple.startDate)+1;
  if(n%100===0)rows.push({kind:'days',key:`d-${n}`,n});
  const years=+date.slice(0,4)-+couple.startDate.slice(0,4);
  if(years>=1&&sameMonthDay(couple.startDate.slice(5),date))rows.push({kind:'years',key:`y-${years}`,n:years});
 }
 for(const [uid,monthDay] of Object.entries(couple.birthdays||{}))
  if(/^\d{2}-\d{2}$/.test(monthDay)&&sameMonthDay(monthDay,date))rows.push({kind:'birthday',key:`b-${uid}`,subject:uid});
 return rows;
}

function dueReminders(coupleId,couple,time){
 const events=[];
 for(const member of [couple.user1,couple.user2].filter(Boolean)){
  const timeZone=validTimeZone(couple.timeZones?.[member])?couple.timeZones[member]:DEFAULT_TIME_ZONE;
  const {date,hour}=localParts(time,timeZone);
  const when=hour===TODAY_HOUR?'today':hour===TOMORROW_HOUR?'tomorrow':null;if(!when)continue;
  const target=when==='today'?date:addDays(date,1);
  for(const o of occasionsOn(couple,target)){
   if(o.kind==='birthday'&&o.subject===member)continue;
   const {subject,key,...rest}=o;
   events.push({...rest,when,to:member,coupleId,date:target,thread:`dates-${coupleId}`,
    ...(subject?{name:couple.settings?.[subject]?.displayName}:{}),dedupe:`${coupleId}_${member}_${when}_${target}_${key}`.slice(0,1400)});
  }
 }
 return events;
}
module.exports={dueReminders,occasionsOn,localParts,validTimeZone,DEFAULT_TIME_ZONE};
