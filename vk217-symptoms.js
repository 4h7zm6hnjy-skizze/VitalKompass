'use strict';
/* VitalKompass 2.0.17 – Symptomtagebuch aus dem PneumoPro-Konzept.
 * Alle Einträge liegen nur im bestehenden verschlüsselten VitalKompass-Tresor.
 * Automatische Vitalhinweise werden ausschließlich aus Messwerten ABGELEITET,
 * niemals als echte Symptome gespeichert. Keine Netzwerkanfragen. */
(function(){
 const GROUPS=[
  {title:'Atmung und Brust',items:[
   ['breath-light','Leichte Atemnot','green'],['breath-medium','Mittlere Atemnot','yellow'],['breath-severe','Schwere Atemnot','red'],['oxygen-low','Blutsauerstoff unter 90 %','red'],
   ['breath-effort','Atemnot bei Belastung','yellow'],['breath-night','Nächtliche Atemnot','yellow'],['wheezing','Pfeifende Atmung','yellow'],
   ['chest-tight','Brustenge / Druckgefühl','red'],['chest-pain','Brustschmerzen','red'],['dry-cough','Trockener Husten','blue'],
   ['cough-attacks','Hustenanfälle','blue'],['wet-cough','Husten mit Schleim','blue']]},
  {title:'Kreislauf und Wahrnehmung',items:[
   ['high-bp','Hoher Blutdruck','pink'],['pulse-high','Puls zu hoch','pink'],['pulse-low','Puls zu niedrig','pink'],
   ['palpitations','Herzrasen','pink'],['irregular-pulse','Unregelmäßiger Puls','pink'],['dizzy','Schwindel','violet'],
   ['confused','Verwirrt','red'],['detached','Stehe völlig neben mir','violet'],['headache','Kopfschmerzen','violet']]},
  {title:'Krämpfe und Allgemeinbefinden',items:[
   ['cramps-toe','Krämpfe in den Zehen','blue'],['cramps-leg','Krämpfe Oberschenkel / Waden','blue'],
   ['trembling','Zittern','violet'],['sweating','Schweißausbrüche','grey'],['chills','Schüttelfrost','grey'],
   ['fever','Fieber','grey'],['exhausted','Starke Erschöpfung','grey'],['nausea','Übelkeit','grey']]},
  {title:'Auswurf und Schleim',items:[
   ['sputum-white','Auswurf: weiß','blue'],['sputum-green','Auswurf: grün','blue'],['sputum-yellow','Auswurf: gelb','blue'],
   ['sputum-blood','Blutiger Auswurf','red'],['sputum-little','Wenig Auswurf','blue'],['sputum-much','Viel Auswurf','blue'],
   ['sputum-toilet','Auswurf über der Toilette','blue']]},
  {title:'Weitere Beschwerden',items:[
   ['weakness','Schwäche','grey'],['sleep','Schlafprobleme','grey'],['fall','Sturz','red'],['fainting','Ohnmacht','red'],
   ['pain','Schmerzen','grey'],['swelling','Schwellungen','grey']]}
 ];
 const LABELS=Object.freeze(Object.fromEntries(GROUPS.flatMap(g=>g.items.map(x=>[x[0],x[1]]))));
 const PERIODS={week:'Woche',month:'Monat',year:'Jahr',ten:'10 Jahre'};
 let api=null,editingId=null,busy=false,period='week',shift=0,statsOpen=false,monthShift=0,chosenDay='';
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const fmt=s=>/^\d{4}-\d\d-\d\d$/.test(String(s))?`${s.slice(8,10)}.${s.slice(5,7)}.${s.slice(0,4)}`:esc(s||'–');
 const pad=n=>String(n).padStart(2,'0');
 const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const today=()=>ymd(new Date());
 const time=()=>new Date().toTimeString().slice(0,5);
 const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const [y,m,d]=s.split('-').map(Number),v=new Date(y,m-1,d);return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d};
 const validTime=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s||'');
 const entries=data=>Array.isArray(data?.symptoms)?data.symptoms:[];
 const unique=arr=>[...new Map(arr.map(s=>[s.toLocaleLowerCase('de-DE'),s])).values()];
 function own(x){
  if(Array.isArray(x?.custom))return unique(x.custom.filter(t=>typeof t==='string').map(t=>t.trim()).filter(Boolean));
  if(Array.isArray(x?.tags)&&x.tags.length)return [];
  return x?.kind?[String(x.kind).trim()].filter(Boolean):[];
 }
 function tags(x){return Array.isArray(x?.tags)?[...new Set(x.tags.filter(t=>Object.prototype.hasOwnProperty.call(LABELS,t)))]:[]}
 function labels(x){return [...tags(x).map(t=>LABELS[t]),...own(x)];}
 function summary(x){const list=labels(x);let s=list.join(', ');if(x?.rescuePlus===true)s+=(s?', ':'')+(Number(x?.rescue)>10?'Bedarfsspray '+x.rescue+'×':'Bedarfsspray mehr als 10 Anwendungen');else if(Number(x?.rescue)>0)s+=(s?', ':'')+'Bedarfsspray '+x.rescue+'×';return s||x?.kind||'Notiz'}
 function bounds(mode=period,offset=shift){const now=new Date(),y=now.getFullYear(),m=now.getMonth();let a,b;
  if(mode==='week'){const mon=new Date(y,m,now.getDate()-(now.getDay()+6)%7+offset*7);a=ymd(mon);b=ymd(new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+6));}
  else if(mode==='month'){a=ymd(new Date(y,m+offset,1));b=ymd(new Date(y,m+offset+1,0));}
  else if(mode==='year'){a=ymd(new Date(y+offset,0,1));b=ymd(new Date(y+offset,11,31));}
  else{const end=y+offset*10;a=ymd(new Date(end-9,0,1));b=ymd(new Date(end,11,31));}
  return{from:a,to:b,label:mode==='year'?a.slice(0,4):mode==='ten'?a.slice(0,4)+'–'+b.slice(0,4):fmt(a)+' – '+fmt(b)};
 }
 function statistics(data,mode=period,offset=shift){const r=bounds(mode,offset),cnt=new Map(),sprays=new Map();let rows=0,choices=0;
  for(const x of entries(data)){if(!validDate(x?.date)||x.date<r.from||x.date>r.to)continue;const set=unique(labels(x));if(set.length)rows++;
   for(const name of set){cnt.set(name,(cnt.get(name)||0)+1);choices++;}
   let dose='';if(x?.rescuePlus===true||Number(x?.rescue)>10)dose='10+';else if(x?.rescue!==null&&x?.rescue!==undefined&&x?.rescue!==''&&Number(x.rescue)>0)dose=String(x.rescue);
   if(dose)sprays.set(dose,(sprays.get(dose)||0)+1);
  }
  const sorted=m=>[...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de'));
  return{...r,rows,choices,counts:sorted(cnt),sprays:sorted(sprays)};
 }
 function chartBars(rows){const max=Math.max(1,...rows.map(r=>r[1]));return rows.map(([name,count])=>`<div class="vk217-count"><div><span>${esc(name)}</span><strong>${count}×</strong></div><div class="vk217-track"><span style="width:${Math.round(100*count/max)}%"></span></div></div>`).join('')}
 function statsBody(data){const s=statistics(data);return `<div class="vk217-period" role="group" aria-label="Auswertungszeitraum">${Object.entries(PERIODS).map(([k,v])=>`<button type="button" data-vk217-period="${k}" aria-pressed="${period===k}">${esc(v)}</button>`).join('')}</div><div class="vk217-period-nav"><button type="button" data-vk217-shift="-1" aria-label="Vorheriger Zeitraum">‹</button><strong>${esc(s.label)}</strong><button type="button" data-vk217-shift="1" aria-label="Nächster Zeitraum">›</button></div><p class="vk217-muted">${s.rows} Einträge · ${s.counts.length} unterschiedliche Symptome · ${s.choices} Auswahlen. Nicht gewählte Symptome erscheinen nicht. Automatisch abgeleitete Messwerte werden nicht als Symptome mitgezählt.</p>${s.counts.length?chartBars(s.counts):'<p>Keine Symptome für diesen Zeitraum gewählt.</p>'}${s.sprays.length?`<h4>Bedarfsspray – separat</h4>${chartBars(s.sprays.map(([k,v])=>[(k==='10+'?'10+':k)+' Anwendungen',v]))}`:''}`}
 function statsTile(data){const s=statistics(data);return `<section class="vk217-stats"><button type="button" class="vk217-stats-toggle" data-vk217-stats-toggle aria-expanded="${statsOpen}"><span><strong>Symptom-Tagebuch-Auswertung</strong><small>${esc(PERIODS[period])} · ${s.choices} Auswahlen</small></span><b aria-hidden="true">${s.choices}</b></button><div class="vk217-stats-panel" data-vk217-stats-body ${statsOpen?'':'hidden'}>${statsBody(data)}</div></section>`}
 function editing(data){return editingId?entries(data).find(e=>e.id===editingId)||null:null}
 function groupHtml(g,n,entry){const on=new Set(tags(entry));return `<details class="vk217-group" ${n===0?'open':''}><summary>${esc(g.title)}</summary><div class="vk217-choices">${g.items.map(([id,label,color])=>`<button type="button" class="vk217-choice vk217-${color} ${on.has(id)?'is-selected':''}" data-vk217-tag="${esc(id)}" aria-pressed="${on.has(id)}">${esc(label)}</button>`).join('')}</div></details>`}
 function form(data){const old=editing(data),date=old?.date&&validDate(old.date)?old.date:today(),t=old?.time&&validTime(old.time)?old.time:time();const ownText=own(old).join('\n');
  const dose=old?.rescuePlus&&!(Number(old?.rescue)>10)?'':old?.rescue??'';
  return `<form id="vk217-symptom-form" class="vk217-form" data-vk217-plus="${old?.rescuePlus===true}"><div class="vk217-form-head"><div><span class="vk217-kicker">SYMPTOM-TAGEBUCH</span><h2>${old?'Eintrag bearbeiten':'Beschwerden schnell erfassen'}</h2><p>Mehrere Beschwerden antippen; eigene Symptome können zusätzlich in mehreren Zeilen stehen.</p></div><span class="vk217-lung" aria-hidden="true">♧</span></div>
   <div class="vk217-form-body"><div class="vk217-groups">${GROUPS.map((g,i)=>groupHtml(g,i,old)).join('')}</div>
   <label class="vk217-field"><strong>Weitere Beschwerden selbst eingeben</strong><small>Jedes eigene Symptom in eine neue Zeile schreiben – mehrere Einträge möglich (maximal 20).</small><textarea name="custom" rows="3" maxlength="2000" placeholder="z. B. Kribbeln in der Hand&#10;Druck hinter den Augen&#10;Ungewöhnliche Müdigkeit">${esc(ownText)}</textarea></label>
   <div class="vk217-spray"><strong>Bedarfsspray – Anwendungen</strong><p>1 bis 10 direkt auswählen; bei mehr als zehn „10+“ wählen und die tatsächliche Zahl nur eintragen, wenn bekannt.</p><div class="vk217-spray-grid">${[1,2,3,4,5,6,7,8,9,10,'10+'].map(v=>`<button type="button" data-vk217-spray="${v}" aria-pressed="${v==='10+'?old?.rescuePlus===true:Number(old?.rescue)===v&&old?.rescuePlus!==true}">${v}</button>`).join('')}</div><label class="vk217-field"><span>Genaue Anzahl (optional)</span><input name="rescue" type="number" inputmode="numeric" min="0" max="999" value="${esc(dose)}" placeholder="Nur wenn bekannt"></label></div>
   <div class="vk217-form-grid"><label class="vk217-field"><strong>Datum</strong><input type="date" name="date" value="${esc(date)}" required max="${today()}"></label><label class="vk217-field"><strong>Uhrzeit</strong><input type="time" name="time" value="${esc(t)}" required></label><label class="vk217-field"><strong>Stärke</strong><select name="severity">${[['leicht','Leicht'],['mittel','Mittel'],['stark','Stark']].map(([v,label])=>`<option value="${v}" ${v===(old?.severity||'mittel')?'selected':''}>${label}</option>`).join('')}</select></label></div>
   <label class="vk217-field"><strong>Notizen (optional)</strong><textarea name="notes" rows="3" maxlength="1200" placeholder="Dauer, Auslöser, Verlauf, Verbesserung …">${esc(old?.notes||'')}</textarea></label><p class="vk217-selected" data-vk217-selected aria-live="polite"></p>
   <div class="vk217-actions"><button class="vk217-save" type="submit">${old?'Änderungen verschlüsselt speichern':'Symptome jetzt speichern'}</button>${old?'<button type="button" data-vk217-cancel class="vk217-cancel">Bearbeitung abbrechen</button>':''}</div><p class="vk217-form-status" data-vk217-status role="status" aria-live="polite"></p><p class="vk217-warning"><strong>Notfall:</strong> Schwere Atemnot, akute Verwirrtheit, starke Brustschmerzen oder Ohnmacht: 112. Die App löst keinen Notruf aus.</p></div></form>`;
 }
 function recentHtml(data,all=false){const rows=[...entries(data)].filter(x=>validDate(x?.date)).sort((a,b)=>(b.date+' '+(b.time||'')).localeCompare(a.date+' '+(a.time||''))).slice(0,all?150:4);
  return `<section class="vk217-history"><h3>Gespeicherte Symptome (${entries(data).length})</h3>${rows.length?`<div class="vk217-history-list">${rows.map(x=>`<div class="vk217-history-row"><div><strong>${fmt(x.date)} ${esc(x.time||'')}</strong><p>${esc(summary(x))}</p><small>Stärke: ${esc(x.severity||'nicht angegeben')}${x.notes?' · '+esc(x.notes):''}</small></div><div class="vk217-row-actions"><button type="button" data-vk217-edit="${esc(x.id)}">Bearbeiten</button><button type="button" data-vk217-delete="${esc(x.id)}">Löschen</button></div></div>`).join('')}</div>`:'<p>Bislang keine Beschwerden eingetragen.</p>'}${!all?'<button type="button" data-view="symptoms" class="vk217-open-full">Alle Einträge und Kalender öffnen</button>':''}</section>`}
 function readingEvents(data){const values=[];
  for(const x of (data?.measurements||[])){
   if(!x||x.verified!==true||!validDate(x.date)||!validTime(x.time)||x.date>today())continue;
   if(x.type==='bp'&&Number.isFinite(Number(x.sys))&&Number.isFinite(Number(x.dia))){const sys=Number(x.sys),dia=Number(x.dia);if(sys>0&&dia>0)values.push({kind:'bp',date:x.date,time:x.time,value:sys,other:dia,source:'bestätigter Blutdruckwert'});
    const pulse=x.pulse;if(pulse!==null&&pulse!==undefined&&pulse!==''&&Number.isFinite(Number(pulse))&&Number(pulse)>0)values.push({kind:'pulse',date:x.date,time:x.time,value:Number(pulse),source:'bestätigte Pulsmessung'});
   }else if(x.type==='pulse'&&Number.isFinite(Number(x.pulse))&&Number(x.pulse)>0)values.push({kind:'pulse',date:x.date,time:x.time,value:Number(x.pulse),source:'bestätigte Pulsmessung'});
  }
  for(const x of data?.oxygenLogs||[]){if(!x||!validDate(x.date)||!validTime(x.time)||x.date>today())continue;if(Number.isInteger(x.spo2)&&x.spo2>=50&&x.spo2<=100)values.push({kind:'spo2',date:x.date,time:x.time,value:x.spo2,source:'SpO₂-Tagebuch (Messwert)'});}
  return values.sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time));
 }
 function derived(data){const prev=new Map(),out=[];for(const x of readingEvents(data)){
   const p=prev.get(x.kind),n=x.value,pn=p?.value,prevAbnormal=p&&(p.kind==='bp'?(p.value>=140||p.other>=90):p.kind==='pulse'?(p.value>100||p.value<50):p.value<90);
   const abnormal=x.kind==='bp'?(n>=140||x.other>=90):x.kind==='pulse'?(n>100||n<50):n<90;
   const improved=p&&prevAbnormal&&(x.kind==='bp'?(n<=pn&&x.other<=p.other&&(n<pn||x.other<p.other)):x.kind==='pulse'?(pn>100?n<pn:pn<50?n>pn:false):n>pn);
   const printable=v=>v.kind==='bp'?`${v.value}/${v.other} mmHg`:v.kind==='pulse'?`${v.value}/min`:`${v.value} %`;
   if(abnormal||improved){out.push({date:x.date,time:x.time,kind:x.kind,abnormal,improved:Boolean(improved),label:x.kind==='bp'?'Blutdruck':x.kind==='pulse'?'Puls':'SpO₂',description:printable(x)+(abnormal?' · auffälliger Orientierungswert':'')+(improved?` · Veränderung: ${printable(p)} (${fmt(p.date)} ${p.time}) → ${printable(x)} (${fmt(x.date)} ${x.time})`:''),source:x.source});}
   prev.set(x.kind,x);
  }return out.reverse();
 }
 function vitalPanel(data,full=false){const d=derived(data);return `<section class="vk217-vitals"><details ${full?'open':''}><summary>Automatische Vitalhinweise (${d.length})</summary><p>Nur aus tatsächlich gespeicherten Messwerten abgeleitet. Kein bestätigtes Symptom und keine Diagnose. Verbesserungen werden mit beiden Uhrzeiten angezeigt; diese Hinweise werden nicht doppelt gespeichert.</p>${d.length?d.slice(0,full?60:8).map(x=>`<div class="vk217-auto ${x.improved?'vk217-improved':''}"><strong>${fmt(x.date)} ${esc(x.time)} · ${esc(x.label)}</strong><p>${esc(x.description)}</p><small>Quelle: ${esc(x.source)}</small></div>`).join(''):'<p>Keine auffälligen oder verbesserten Messwerte vorhanden.</p>'}</details></section>`}
 function calendarMonth(){const now=new Date(),current=new Date(now.getFullYear(),now.getMonth()+monthShift,1);return{y:current.getFullYear(),m:current.getMonth()}}
 function calendarBody(data){const {y,m}=calendarMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=(first.getDay()+6)%7,dates=new Map();for(const x of entries(data)){if(validDate(x?.date))dates.set(x.date,(dates.get(x.date)||0)+1)}
  const cells=[...Array(offset)].map(()=>'<span aria-hidden="true"></span>');for(let d=1;d<=days;d++){const day=ymd(new Date(y,m,d)),n=dates.get(day)||0;cells.push(`<button type="button" class="vk217-day ${n?'has-entry':''}" data-vk217-day="${day}" aria-pressed="${chosenDay===day}" aria-label="${fmt(day)}: ${n} Symptom-Einträge">${d}${n?`<small>${n}</small>`:''}</button>`)}
  const selected=chosenDay?entries(data).filter(x=>x.date===chosenDay):[];
  return `<div class="vk217-cal-nav"><button type="button" data-vk217-month="-1" aria-label="Vorheriger Monat">‹</button><strong>${first.toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</strong><button type="button" data-vk217-month="1" aria-label="Nächster Monat">›</button></div><div class="vk217-calendar-grid">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>`<b>${w}</b>`).join('')}${cells.join('')}</div><div class="vk217-day-details">${chosenDay?`<h4>${fmt(chosenDay)} · ${selected.length} Symptomeinträge</h4>${selected.map(x=>`<p><b>${esc(x.time||'')}</b> ${esc(summary(x))}</p>`).join('')||'<p>Keine Beschwerden eingetragen.</p>'}`:'<p>Tag antippen, um die dokumentierten Symptome zu sehen.</p>'}</div>`;
 }
 function calendar(data){return `<section class="vk217-calendar panel"><h2>Symptomtagebuch im Kalender</h2><p class="vk217-muted">Die Markierungen stammen aus den bestehenden verschlüsselten Einträgen.</p><div data-vk217-calendar-body>${calendarBody(data)}</div></section>`}
 function home(data){return `<section class="vk217-home"><div class="vk217-home-head"><div><h2>Symptom-Tagebuch</h2><p>${entries(data).length} Einträge gespeichert · Mehrfachauswahl und eigene Beschwerden</p></div><button type="button" data-view="symptoms">Tagebuch öffnen</button></div><details class="vk217-home-entry" ${editingId?'open':''}><summary>Beschwerden direkt auf der Startseite erfassen</summary>${form(data)}</details>${statsTile(data)}${recentHtml(data,false)}${vitalPanel(data,false)}</section>`}
 function page(data){return `<div class="vk217-full"><div class="heading-row"><div><div class="kicker">VITALKOMPASS</div><h1>Symptomtagebuch</h1><p class="section-note">Mehrfachauswahl, eigene Beschwerden, Zeitverlauf, Arztbericht und Kalender. Alle Einträge bleiben verschlüsselt auf diesem Gerät.</p></div></div>${form(data)}${statsTile(data)}${recentHtml(data,true)}${vitalPanel(data,true)}${calendar(data)}</div>`}
 function reportHTML(data,from,to){const rows=entries(data).filter(x=>validDate(x?.date)&&x.date>=from&&x.date<=to).sort((a,b)=>(a.date+'T'+(a.time||'')).localeCompare(b.date+'T'+(b.time||''))).reverse();return `<h3>Symptomtagebuch – persönliche Angaben</h3><p>Nur manuell gespeicherte Beschwerden, keine automatischen Diagnosen. Zeitraum ${fmt(from)} – ${fmt(to)}.</p>${rows.length?`<table><thead><tr><th>Datum</th><th>Beschwerden / Anwendungen</th><th>Stärke und Notiz</th></tr></thead><tbody>${rows.slice(0,200).map(x=>`<tr><td>${fmt(x.date)} ${esc(x.time||'')}</td><td>${esc(summary(x))}</td><td>${esc(x.severity||'–')} · ${esc(x.notes||'')}</td></tr>`).join('')}</tbody></table>`:'<p>Keine Einträge in diesem Zeitraum.</p>'}`}
 function refreshStats(){document.querySelectorAll('[data-vk217-stats-body]').forEach(el=>{if(api?.getData())el.innerHTML=statsBody(api.getData())});document.querySelectorAll('[data-vk217-stats-toggle]').forEach(el=>{el.setAttribute('aria-expanded',String(statsOpen));el.querySelector('small').textContent=PERIODS[period]+' · '+statistics(api.getData()).choices+' Auswahlen';el.querySelector('b').textContent=String(statistics(api.getData()).choices)});document.querySelectorAll('[data-vk217-stats-body]').forEach(el=>el.hidden=!statsOpen)}
 function refreshCalendar(){document.querySelectorAll('[data-vk217-calendar-body]').forEach(el=>{if(api?.getData())el.innerHTML=calendarBody(api.getData())})}
 function sync(form){if(!form)return;const selected=[...form.querySelectorAll('[data-vk217-tag][aria-pressed="true"]')].map(b=>LABELS[b.dataset.vk217Tag]);const node=form.querySelector('[data-vk217-selected]');if(node)node.textContent=selected.length?`${selected.length} ausgewählt: ${selected.join(', ')}`:'Noch keine Kachel gewählt. Eigene Symptome kannst du zusätzlich eintragen.';form.querySelectorAll('[data-vk217-spray]').forEach(b=>{const n=form.elements.rescue.value,plus=form.dataset.vk217Plus==='true';b.setAttribute('aria-pressed',String(b.dataset.vk217Spray==='10+'?plus:n!==''&&String(b.dataset.vk217Spray)===n&&!plus))})}
 function attach(callbacks){api=callbacks;if(attach._done)return;attach._done=true;
  document.addEventListener('click',async event=>{if(!api?.getData())return;const b=event.target.closest?.('[data-vk217-tag],[data-vk217-spray],[data-vk217-edit],[data-vk217-delete],[data-vk217-cancel],[data-vk217-stats-toggle],[data-vk217-period],[data-vk217-shift],[data-vk217-month],[data-vk217-day]');if(!b)return;
   event.preventDefault();event.stopPropagation();const form=b.closest('#vk217-symptom-form');
   if(b.hasAttribute('data-vk217-tag')){const was=b.getAttribute('aria-pressed')==='true';if(!was&&['breath-light','breath-medium','breath-severe'].includes(b.dataset.vk217Tag))form.querySelectorAll('[data-vk217-tag="breath-light"],[data-vk217-tag="breath-medium"],[data-vk217-tag="breath-severe"]').forEach(t=>{t.setAttribute('aria-pressed','false');t.classList.remove('is-selected')});b.setAttribute('aria-pressed',String(!was));b.classList.toggle('is-selected',!was);sync(form);return}
   if(b.hasAttribute('data-vk217-spray')){const v=b.dataset.vk217Spray,i=form.elements.rescue;if(v==='10+'){form.dataset.vk217Plus=String(!(form.dataset.vk217Plus==='true'));if(form.dataset.vk217Plus==='true'&&Number(i.value)<=10)i.value='';}else{const was=i.value===v&&form.dataset.vk217Plus!=='true';form.dataset.vk217Plus='false';i.value=was?'':v;}sync(form);return}
   if(b.hasAttribute('data-vk217-stats-toggle')){statsOpen=!statsOpen;refreshStats();return}
   if(b.hasAttribute('data-vk217-period')){if(PERIODS[b.dataset.vk217Period]){period=b.dataset.vk217Period;shift=0;refreshStats()}return}
   if(b.hasAttribute('data-vk217-shift')){shift+=Number(b.dataset.vk217Shift)===-1?-1:1;shift=Math.max(-500,Math.min(500,shift));refreshStats();return}
   if(b.hasAttribute('data-vk217-month')){monthShift+=Number(b.dataset.vk217Month)===-1?-1:1;monthShift=Math.max(-600,Math.min(600,monthShift));chosenDay='';refreshCalendar();return}
   if(b.hasAttribute('data-vk217-day')){chosenDay=b.dataset.vk217Day;refreshCalendar();return}
   if(b.hasAttribute('data-vk217-cancel')){editingId=null;api.refresh();return}
   if(b.hasAttribute('data-vk217-edit')){editingId=b.dataset.vk217Edit;api.refresh();document.getElementById('vk217-symptom-form')?.scrollIntoView({block:'start'});return}
   if(b.hasAttribute('data-vk217-delete')){if(busy||!window.confirm('Diesen Symptomtagebuch-Eintrag wirklich dauerhaft löschen?'))return;const old=api.getData().symptoms,next=old.filter(x=>x.id!==b.dataset.vk217Delete);if(next.length===old.length)return;busy=true;api.getData().symptoms=next;try{await api.save();if(editingId===b.dataset.vk217Delete)editingId=null;api.refresh();api.notify('Symptomtagebuch-Eintrag gelöscht.')}catch(err){api.getData().symptoms=old;window.alert('Löschen fehlgeschlagen: '+(err?.message||err))}finally{busy=false}return}
  },true);
  document.addEventListener('input',event=>{const el=event.target,form=el.closest?.('#vk217-symptom-form');if(!form)return;if(el.name==='rescue'){form.dataset.vk217Plus=String(Number(el.value)>10);sync(form)}},true);
  document.addEventListener('submit',async event=>{const form=event.target;if(form?.id!=='vk217-symptom-form')return;event.preventDefault();event.stopPropagation();if(!api?.getData()||busy)return;
   const status=form.querySelector('[data-vk217-status]');try{const f=new FormData(form),date=String(f.get('date')||''),t=String(f.get('time')||'');if(!validDate(date)||date>today()||!validTime(t))throw Error('Datum oder Uhrzeit ist ungültig. Keine zukünftigen Daten.');if(date===today()&&t>time())throw Error('Bitte keine Uhrzeit in der Zukunft angeben.');
    const selected=[...form.querySelectorAll('[data-vk217-tag][aria-pressed="true"]')].map(b=>b.dataset.vk217Tag).filter(x=>Object.prototype.hasOwnProperty.call(LABELS,x));
    const raw=String(f.get('custom')||'');const custom=unique(raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean));if(custom.length>20||custom.some(x=>x.length>120))throw Error('Bitte höchstens 20 eigene Symptome mit jeweils maximal 120 Zeichen eingeben.');
    const plus=form.dataset.vk217Plus==='true',rescueRaw=String(f.get('rescue')||'').trim();let rescue=null;
    if(rescueRaw!==''){rescue=Number(rescueRaw);if(!Number.isInteger(rescue)||rescue<0||rescue>999)throw Error('Bedarfsspray: Bitte eine ganze Anzahl zwischen 0 und 999 eingeben.');}
    if(!selected.length&&!custom.length&&!plus&&!(rescue>0))throw Error('Bitte mindestens ein Symptom oder eine Bedarfsspray-Anwendung auswählen.');
    const severity=String(f.get('severity')||'mittel');if(!['leicht','mittel','stark'].includes(severity))throw Error('Stärke ist ungültig.');
    const prev=api.getData().symptoms,existing=editing(api.getData());if(editingId&&!existing)throw Error('Der zu bearbeitende Eintrag wurde nicht gefunden.');
    const payload={...(existing||{}),id:existing?.id||api.makeId(),date,time:t,tags:[...new Set(selected)],custom,kind:[...selected.map(k=>LABELS[k]),...custom].join(', ').slice(0,90)||(plus||rescue>0?'Bedarfsspray':'Notiz'),severity,notes:String(f.get('notes')||'').trim().slice(0,1200),rescue:rescue,rescuePlus:plus};
    api.getData().symptoms=existing?prev.map(x=>x.id===existing.id?payload:x):[...prev,payload];busy=true;const saveBtn=form.querySelector('[type="submit"]');saveBtn.disabled=true;status.textContent='Wird verschlüsselt gespeichert …';
    try{await api.save();editingId=null;api.refresh();api.notify('Symptomtagebuch verschlüsselt gespeichert.')}catch(err){api.getData().symptoms=prev;saveBtn.disabled=false;throw err}finally{busy=false}
   }catch(err){if(status)status.textContent='Nicht gespeichert: '+(err?.message||err)}
  },true);
 }
 function reset(){editingId=null;busy=false;period='week';shift=0;statsOpen=false;monthShift=0;chosenDay=''}
 window.VK217=Object.freeze({GROUPS,LABELS,home,page,calendar,reportHTML,summary,statistics,derived,attach,reset,sync});
})();
