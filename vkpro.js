/* VitalKompass 1.8.0 – reine, lokal testbare Auswertung. Keine Netzverbindung. */
'use strict';
(function(global){
const validDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&!isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const dayAt=(s,delta)=>{let x=new Date(s+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+delta);return x.toISOString().slice(0,10)};
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const round=(x,n=1)=>x===null?null:Number(x.toFixed(n));
function dataQuality(measurements,labs,now){
 const issues=[],seen=new Map(),add=(level,title,detail,id)=>issues.push({level,title,detail,id});
 for(const m of measurements||[]){if(!m||!['bp','glucose'].includes(m.type))continue;
  const moment=String(m.date||'')+' '+String(m.time||'');
  if(!validDate(m.date)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(m.time||'')){add('error','Datum oder Uhrzeit ungültig',moment,m.id);continue}
  if(m.date>now)add('review','Messung in der Zukunft',moment,m.id);
  if(m.type==='glucose'){
   if(!Number.isFinite(m.mgdl)||m.mgdl<10||m.mgdl>700)add('error','Blutzucker außerhalb plausibler Eingabegrenzen',moment,m.id);
  }else if(!Number.isFinite(m.sys)||!Number.isFinite(m.dia)||m.sys<=m.dia||m.sys<40||m.sys>320||m.dia<20||m.dia>220||(m.pulse!=null&&(!Number.isFinite(m.pulse)||m.pulse<20||m.pulse>240)))add('error','Blutdruck oder Puls unplausibel',moment,m.id);
  if(m.verified!==true)add('review','Originalmessung noch nicht bestätigt',moment,m.id);
  const sig=m.type==='bp'?`${m.sys}|${m.dia}|${m.pulse??''}`:Math.round(m.mgdl*10);
  const fp=`${m.type}|${m.date}|${m.time}|${sig}`;
  if(seen.has(fp))add('review','Möglicher doppelter Messwert',moment,m.id);else seen.set(fp,m.id);
 }
 for(const l of labs||[]){if(!l)continue; if(!validDate(l.date))add('error','Labordatum ungültig',String(l.name||''),l.id);
  if(l.verified!==true)add('review','Laborbefund noch nicht bestätigt',String(l.name||''),l.id);
  if(!Number.isFinite(l.value))add('error','Laborwert ungültig',String(l.name||''),l.id);
  if(Number.isFinite(l.low)&&Number.isFinite(l.high)&&l.low>l.high)add('error','Laborreferenz vertauscht',String(l.name||''),l.id);
 }
 return {issues,errors:issues.filter(x=>x.level==='error').length,reviews:issues.filter(x=>x.level==='review').length};
}
function bpSevenDay(rows,end){if(!validDate(end))throw Error('Enddatum ungültig');
 const start=dayAt(end,-6),valid=(rows||[]).filter(m=>m?.type==='bp'&&m.verified===true&&validDate(m.date)&&m.date>=start&&m.date<=end&&/^\d\d:\d\d$/.test(m.time||'')&&Number.isFinite(m.sys)&&Number.isFinite(m.dia)&&m.sys>m.dia).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const morning=valid.filter(m=>m.time<'12:00'),evening=valid.filter(m=>m.time>='17:00');
 const mid=valid.length-morning.length-evening.length;
 const agg=x=>({count:x.length,sys:round(mean(x.map(m=>m.sys))),dia:round(mean(x.map(m=>m.dia))),pulse:round(mean(x.filter(m=>Number.isFinite(m.pulse)).map(m=>m.pulse)))});
 const daily=Array.from({length:7},(_,i)=>{let date=dayAt(start,i);return {date,morning:agg(morning.filter(x=>x.date===date)),evening:agg(evening.filter(x=>x.date===date))}});
 const used=[...morning,...evening];return {start,end,daily,all:agg(used),morning:agg(morning),evening:agg(evening),middayExcluded:mid,coverage:daily.filter(x=>x.morning.count&&x.evening.count).length};
}
function comparePeriods(rows,type,days,end){const curr=dayAt(end,-(days-1)),prevStart=dayAt(curr,-days),prevEnd=dayAt(curr,-1);
 const relevant=(rows||[]).filter(m=>m?.type===type&&m.verified===true&&validDate(m.date));
 const field=type==='glucose'?'mgdl':'sys';const vals=(a,b)=>relevant.filter(x=>x.date>=a&&x.date<=b&&Number.isFinite(x[field])).map(x=>x[field]);
 const current=vals(curr,end),previous=vals(prevStart,prevEnd);
 const result={current:{count:current.length,mean:round(mean(current))},previous:{count:previous.length,mean:round(mean(previous))},days};
 result.delta=current.length>=3&&previous.length>=3?round(result.current.mean-result.previous.mean):null;
 return result;
}
function labChanges(labs){const by=new Map();
 for(const l of labs||[]){if(!l||l.verified!==true||!validDate(l.date)||!Number.isFinite(l.value)||l.comparator)continue;
  const k=`${l.name}|${l.unit||''}`;if(!by.has(k))by.set(k,[]);by.get(k).push(l)}
 const res=[];for(const group of by.values()){const s=group.sort((a,b)=>String(a.date).localeCompare(b.date));if(s.length<2)continue;
 const a=s.at(-2),b=s.at(-1); if(a.date===b.date)continue;
 res.push({name:b.name,unit:b.unit||'',previous:a.value,current:b.value,previousDate:a.date,currentDate:b.date,delta:round(b.value-a.value,3),low:Number.isFinite(b.low)?b.low:null,high:Number.isFinite(b.high)?b.high:null});}
 return res.sort((a,b)=>b.currentDate.localeCompare(a.currentDate)).slice(0,35);
}
function escapeICS(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;').slice(0,600)}
function makeICS(items){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//VitalKompass//Kontrolltermine//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const e of items||[]){if(!validDate(e?.date))continue;
  const begin=e.date.replaceAll('-',''),end=dayAt(e.date,1).replaceAll('-','');
  lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(String(e.id||e.kind||'termin')).slice(0,80)}-${begin}@vitalkompass.local`,`DTSTART;VALUE=DATE:${begin}`,`DTEND;VALUE=DATE:${end}`,`SUMMARY:${escapeICS(e.kind)}`,`DESCRIPTION:${escapeICS(e.notes)}`,'END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.join('\r\n')+'\r\n';}
global.VKPro=Object.freeze({dataQuality,bpSevenDay,comparePeriods,labChanges,makeICS,dayAt,validDate});
})(typeof window==='undefined'?globalThis:window);
