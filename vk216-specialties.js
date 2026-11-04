/* VitalKompass 2.0.16 | Facharztansichten und einseitige Berichte.
   Nur Lesefunktionen; die App speichert neue Eintraege ausschliesslich im verschluesselten Tresor. */
(function(){
'use strict';
const SPECS={
 diabetology:{title:'Diabetologie',doc:'diabetes',tests:['Diabetes-Kontrolle','Therapieanpassung','Fußuntersuchung','Neuropathie','Nierenkontrolle','HbA1c-Kontrolle','Sonstiger Befund']},
 urology:{title:'Urologie',doc:'prostate',tests:['PSA-Kontrolle','IPSS','Ultraschall Prostata / Blase','Restharn','Urinuntersuchung','MRT / Biopsie','Sonstiger Befund']},
 hospital:{title:'Krankenhaus',doc:'hospital',tests:['Aufnahmebefund','Entlassungsbericht','Stationsbefund','Notaufnahme','Nachsorge','Sonstiger Befund']},
 gp:{title:'Hausarzt',doc:'gp',tests:['Allgemeine Untersuchung','Blutkontrolle','Medikamentenkontrolle','Vorsorge','Impfung','Sonstiger Befund']},
 ophthalmology:{title:'Augenarzt',doc:'ophthalmology',tests:['Diabetische Netzhautkontrolle','Retinopathiegrad','Makula / OCT','Sehschärfe','Augeninnendruck','Augenhintergrund','Sonstiger Befund']},
 pneumology:{title:'Pneumologie',doc:'pulmonologist',tests:['Lungenfunktion / Spirometrie','FEV1','Peak-Flow','Sauerstoffmessung','Diffusionsmessung','Bronchoskopie','Schlaflabor','Sonstiger Befund']}
};
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const val=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('de-DE',{maximumFractionDigits:d,minimumFractionDigits:d}):'–';
const validDate=x=>{if(typeof x!=='string'||!/^\d{4}-\d\d-\d\d$/.test(x))return false;const d=new Date(x+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x;};
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const dt=x=>validDate(x)?x.slice(8)+'.'+x.slice(5,7)+'.'+x.slice(0,4):'Datum unbekannt';
const sort=(a,b)=>(a.date+'T'+(a.time||'')).localeCompare(b.date+'T'+(b.time||''));
const rows=(arr,pred)=>Array.isArray(arr)?arr.filter(x=>x&&validDate(x.date)&&x.date<=today()&&pred(x)).sort(sort):[];
const last=a=>a.length?a[a.length-1]:null;
const stats=(rr,field)=>{const v=rr.map(x=>Number(x[field])).filter(Number.isFinite);return v.length?{n:v.length,min:Math.min(...v),max:Math.max(...v),mean:v.reduce((a,b)=>a+b,0)/v.length}:null};
const daysBack=n=>{const d=new Date(today()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)};
const recent=(r,n=30)=>r.filter(x=>x.date>=daysBack(n));
const ageAt=(birth,date)=>{if(!validDate(birth)||!validDate(date))return null;let y=Number(date.slice(0,4))-Number(birth.slice(0,4));if(date.slice(5)<birth.slice(5))y--;return y};
function psa(data){
 const all=rows(data?.labs,x=>x.verified===true&&x.name==='PSA gesamt'&&Number.isFinite(Number(x.value))&&Number(x.value)>=0&&(!x.unit||/ng\s*\/\s*ml/i.test(x.unit)));
 const x=last(all);if(!x)return {level:'gray',label:'Kein bestätigter Gesamt-PSA-Wert',value:null,date:''};
 const v=Number(x.value),birth=data?.profile?.birthday,age=ageAt(birth,x.date),previous=all.length>1?all[all.length-2]:null;
 const isInScreeningAge=age!==null&&age>=45;let level='gray',reason='Ohne individuelle ärztliche Einordnung nicht sicher bewertbar';
 const limit=Number(x.high),hasLimit=x.high!==null&&x.high!==undefined&&x.high!==''&&Number.isFinite(limit)&&limit>0;
 const prevRaised=all.slice(0,-1).some(p=>{const difference=(Date.parse(x.date)-Date.parse(p.date))/86400000;return p.date<x.date&&difference<=93&&difference>=0&&Number(p.value)>=3});
 if(isInScreeningAge){
   if(v>=3){level=(prevRaised||v>=10)?'red':'yellow';reason=prevRaised?'Wiederholt ≥ 3 ng/ml innerhalb von drei Monaten: urologisch abklären':v>=10?'Deutlich erhöht: zeitnah urologisch abklären':'≥ 3 ng/ml: Kontrollmessung innerhalb von drei Monaten, Einflussfaktoren beachten';}
   else if(v>=1.5){level='yellow';reason='Früherkennungs-Risikogruppe mittel (45+); ärztliches Kontrollintervall besprechen';}
   else{level='green';reason='Niedrigere PSA-Früherkennungs-Risikogruppe (45+), keine Entwarnung';}
 }else if(hasLimit){level=v>limit?'yellow':'green';reason=v>limit?'Über dem bestätigten Laborreferenzwert; ärztlich besprechen':'Innerhalb der hinterlegten Laborreferenz, keine Entwarnung';}
 else{reason=age!==null&&age<45?'Unter 45: kein allgemeiner altersbasierter PSA-Früherkennungs-Grenzwert':'Ohne Alter/Laborreferenz nicht sicher bewertbar';}
 if(hasLimit&&v>limit&&level==='green'){level='yellow';reason='Über dem individuellen Laborreferenzwert; ärztlich besprechen';}
 const delta=previous?Number((v-Number(previous.value)).toFixed(2)):null;
 let ratio=null;const free=rows(data?.labs,l=>l.verified===true&&l.name==='PSA frei'&&l.date===x.date&&Number.isFinite(Number(l.value))&&Number(l.value)>=0).at(-1);
 if(free&&v>0)ratio=Number(free.value)/v*100;
 return {value:v,level,label:reason,date:x.date,time:x.time||'',age,previous:previous?Number(previous.value):null,delta,ratio,all};
}
function series(data,key){
 const g=rows(data?.measurements,x=>x.verified===true&&x.type==='glucose'&&Number.isFinite(x.mgdl));
 const bp=rows(data?.measurements,x=>x.verified===true&&x.type==='bp'&&Number.isFinite(x.sys)&&Number.isFinite(x.dia));
 const w=rows(data?.weights,x=>Number.isFinite(x.kg));
 const oxygen=rows(data?.oxygenLogs,x=>Number.isFinite(x.spo2));
 const a=rows(data?.asthmaLogs,x=>Number.isFinite(x.peakFlow)||Number.isFinite(x.fev1Pct));
 const lab=rows(data?.labs,x=>x.verified===true&&Number.isFinite(Number(x.value)));
 const psaRows=lab.filter(x=>x.name==='PSA gesamt'&&(!x.unit||/ng\s*\/\s*ml/i.test(x.unit)));
 if(key==='diabetology')return [{name:'Blutzucker',list:g,field:'mgdl',unit:'mg/dl'},{name:'Gewicht',list:w,field:'kg',unit:'kg'}];
 if(key==='urology')return [{name:'Gesamt-PSA',list:psaRows.map(x=>({...x,value:Number(x.value)})),field:'value',unit:'ng/ml'}];
 if(key==='ophthalmology')return [{name:'Blutzucker',list:g,field:'mgdl',unit:'mg/dl'}];
 if(key==='pneumology')return [{name:'SpO₂',list:oxygen,field:'spo2',unit:'%'},{name:'Peak-Flow',list:a.filter(x=>Number.isFinite(x.peakFlow)),field:'peakFlow',unit:'l/min'}];
 return [{name:'Blutdruck systolisch',list:bp,field:'sys',unit:'mmHg'},{name:'SpO₂',list:oxygen,field:'spo2',unit:'%'}];
}
function graph(label,list,field,unit){
 const rr=list.slice(-24).filter(x=>Number.isFinite(Number(x[field])));if(!rr.length)return '<p class="section-note">Noch kein bestätigter Verlauf.</p>';
 const numbers=rr.map(x=>Number(x[field])),mn=Math.min(...numbers),mx=Math.max(...numbers),p=mx===mn?Math.max(2,Math.abs(mx)*0.05):Math.max(0.01,(mx-mn)*.12),lo=mn-p,hi=mx+p;
 const W=700,H=148,left=52,right=15,top=14,bottom=30,dx=(W-left-right)/Math.max(1,rr.length-1),y=v=>top+(hi-v)/(hi-lo)*(H-top-bottom),x=i=>left+(rr.length===1?(W-left-right)/2:i*dx);
 const grid=[0,.5,1].map(f=>{const v=lo+(hi-lo)*f,yv=y(v);return `<line x1="${left}" y1="${yv.toFixed(1)}" x2="${W-right}" y2="${yv.toFixed(1)}" stroke="#c6d8e6"/><text x="${left-4}" y="${(yv+4).toFixed(1)}" text-anchor="end" fill="#3a526b" font-size="11">${e(val(v,1))}</text>`}).join('');
 const points=rr.map((a,i)=>`${x(i).toFixed(1)},${y(Number(a[field])).toFixed(1)}`).join(' ');
 const circles=rr.map((a,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(Number(a[field])).toFixed(1)}" r="3.2" fill="#0c6687"/>`).join('');
 return `<div class="chartwrap vk216-chart"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(label)}" xmlns="http://www.w3.org/2000/svg">${grid}<polyline fill="none" stroke="#0c6687" stroke-width="3" points="${points}"/>${circles}<text x="${left}" y="${H-6}" fill="#3a526b" font-size="12">${e(dt(rr[0].date))}</text><text x="${W-right}" y="${H-6}" text-anchor="end" fill="#3a526b" font-size="12">${e(dt(last(rr).date))}</text></svg></div><p class="section-note">${e(label)} (${e(unit)}) · ${rr.length} dargestellte Messungen, ohne Hochrechnung.</p>`;
}
const firstRows=(r,limit=12)=>r.slice(-limit).reverse();
function docRows(data,key){const map=window.VK214?.files;if(!map)return [];
 try{return map(data).filter(d=>d.category===SPECS[key].doc)}catch{return []}
}
function apptRows(data,key){const appointments=(data.specialtyAppointments||[]).filter(x=>x.specialty===key&&validDate(x.date));
 const links=docRows(data,key).filter(d=>validDate(d.meta?.nextAppointmentDate)).map(d=>({date:d.meta.nextAppointmentDate,time:d.meta.nextAppointmentTime||'',doctor:d.meta.doctor||'',purpose:'Kontrolle laut Befund: '+d.title,source:'Befund'}));
 return [...appointments,...links].sort(sort);
}
function statLine(title,list,field,unit){const st=stats(recent(list),field),latestRow=last(list);
 return `${title}: ${latestRow&&Number.isFinite(Number(latestRow[field]))?val(Number(latestRow[field]),1)+' '+unit+' ('+dt(latestRow.date)+')':'keine Messung'}; 30 T: ${st?'Ø '+val(st.mean,1)+' / Min '+val(st.min,1)+' / Max '+val(st.max,1)+' ('+st.n+')':'keine Messungen'}`;
}
function doctorLines(data,key){const all=series(data,key),lines=all.map(s=>statLine(s.name,s.list,s.field,s.unit));
 const confirmedLabs=rows(data.labs,x=>x.verified===true&&Number.isFinite(Number(x.value)));
 const hba=window.VK_HBA1C?.latestLab?.(data);
 const p=psa(data);
 if(key==='diabetology'||key==='ophthalmology')lines.unshift('Labor-HbA1c: '+(hba?val(hba.pct,1)+' % ('+dt(hba.date)+')':'kein bestätigter Laborwert; Schätzwert ist kein Labor-HbA1c'));
 if(key==='urology')lines.unshift('PSA: '+(p.value===null?'nicht vorhanden':val(p.value,2)+' ng/ml ('+dt(p.date)+'); '+p.label));
 if(key==='urology'&&p.delta!==null)lines.push('PSA gegenüber vorher: '+(p.delta>0?'+':'')+val(p.delta,2)+' ng/ml; freies/Gesamt-PSA: '+(p.ratio===null?'nicht berechenbar':val(p.ratio,1)+' %'));
 if(key==='pneumology'){
  const rr=rows(data?.asthmaLogs,x=>Number.isFinite(x.fev1Pct));lines.push(statLine('FEV1 % Soll',rr,'fev1Pct','%'));
 }
 if(key==='gp'||key==='hospital'){const rr=rows(data.measurements,x=>x.verified===true&&x.type==='glucose'&&Number.isFinite(x.mgdl));lines.push(statLine('Blutzucker',rr,'mgdl','mg/dl'));const weights=rows(data.weights,x=>Number.isFinite(x.kg));lines.push(statLine('Gewicht',weights,'kg','kg'));}
 if(key==='diabetology'){const matches=confirmedLabs.filter(x=>/eGFR|Kreatinin|Albumin.*Urin|LDL|Cholesterin/i.test(x.name));for(const lab of firstRows(matches,2))lines.push('Labor: '+lab.name+' '+val(Number(lab.value),2)+' '+(lab.unit||'')+' ('+dt(lab.date)+')');}
 if(key==='urology'){const rr=rows(data.urologyLogs,x=>x.type==='ipss'&&Number.isFinite(x.score));if(rr.length)lines.push('Letzter IPSS: '+val(last(rr).score,0)+'/35 ('+dt(last(rr).date)+')');}
 if(key==='hospital')lines.push('Dokumentierte stationäre Aufenthalte: '+(data.hospitalStays||[]).length);
 if(key==='ophthalmology')lines.push('Augen: nur gespeicherte augenärztliche Befunde; keine automatische Retinopathie-Diagnose');
 const findings=rows(data.specialtyFindings,x=>x.specialty===key);
 if(findings.length){const f=last(findings);lines.push('Letzter eigener Untersuchungsbefund: '+String(f.test||'')+' – '+String(f.result||'').slice(0,85)+' ('+dt(f.date)+')');}
 return lines;
}
function doctorHTML(data,key){const spec=SPECS[key];if(!spec)return '';
 const p=data.profile||{},when=dt(today()),lines=doctorLines(data,key).slice(0,8),recentApp=apptRows(data,key).filter(x=>x.date>=today())[0];
 const meds=(data.meds||[]).filter(x=>x.verified!==false).map(m=>m.name).slice(0,6).join(', ');
 const symptom=data.profile?.allergies?.slice(0,4)?.join(', ')||'';
 const primary=series(data,key)[0];
 const info=lines.map(l=>`<p>${e(l.slice(0,170))}</p>`).join('');
 return `<h2>Facharzt: ${e(spec.title)}</h2><p><strong>Patient:</strong> ${e(p.name||'nicht hinterlegt')} · <strong>Geboren:</strong> ${e(dt(p.birthday))} · <strong>Stand:</strong> ${e(when)}</p><p><b>Zeitraum Mittelwerte:</b> letzte 30 Tage; ausschließlich bestätigte Messwerte, soweit eine Bestätigung vorgesehen ist.</p>${info}<h3>Messwerte im Verlauf</h3>${primary?graph(primary.name,primary.list,primary.field,primary.unit):''}<p><b>Arzneimittel (in App bestätigt):</b> ${e(meds||'keine bestätigt; Medikationsplan prüfen')}</p><p><b>Allergien:</b> ${e(symptom||'keine hinterlegt – aktiv erfragen')}</p><p><b>Nächste notierte Kontrolle:</b> ${recentApp?e(dt(recentApp.date)+' · '+(recentApp.doctor||spec.title)):'nicht erfasst'}</p><p><small>Nur dokumentierte Werte. Kein Diagnosenachweis, keine medizinische Freigabe. Originalbefunde separat abrufbar.</small></p>`;
}
function latestCard(label,content,subtitle,level,view){return `<button class="vk216-home-card vk216-status-${e(level||'gray')}" type="button" data-view="${e(view)}"><span>${e(label)}</span><strong>${e(content)}</strong><small>${e(subtitle)}</small><i aria-hidden="true" class="vk216-light"></i></button>`;}
function home(data){const g=last(rows(data.measurements,x=>x.verified===true&&x.type==='glucose'&&Number.isFinite(x.mgdl)));
 const bp=last(rows(data.measurements,x=>x.verified===true&&x.type==='bp'&&Number.isFinite(x.sys)&&Number.isFinite(x.dia)));
 const w=last(rows(data.weights,x=>Number.isFinite(x.kg)));
 const ox=last(rows(data.oxygenLogs,x=>Number.isFinite(x.spo2)));
 const hba=window.VK_HBA1C?.latestLab?.(data);
 const p=psa(data);
 const pTime=x=>x?(dt(x.date)+(x.time?' · '+x.time:'')):'Kein bestätigter Messwert';
 const classificationGlucose=g?(g.mgdl<70||g.mgdl>=250?'red':g.period==='after'&&g.mgdl>180?'yellow':g.period==='fasting'&&g.mgdl>130?'yellow':g.period==='other'?'gray':'green'):'gray';
 const bpLevel=bp?(bp.sys>=180||bp.dia>=110?'red':bp.sys>=135||bp.dia>=85||bp.sys<90||bp.dia<60?'yellow':'green'):'gray';
 const oxLevel=ox?(ox.spo2<=92?'red':ox.spo2<95?'yellow':'green'):'gray';
 const pw=Number(data.profile?.height),profileKg=Number(data.profile?.weight),weightKg=w?.kg??(Number.isFinite(profileKg)&&profileKg>0?profileKg:null),bmi=weightKg!==null&&pw>=120&&pw<=250?weightKg/Math.pow(pw/100,2):null;
 const weightLevel=bmi===null?'gray':bmi>=35||bmi<17?'red':bmi>=25||bmi<18.5?'yellow':'green';
 const hbaLab=rows(data.labs,l=>l.verified===true&&(l.name==='HbA1c (NGSP)'||l.name==='HbA1c (IFCC)'));
 const hbLast=last(hbaLab),hbVal=hbLast&&Number.isFinite(Number(hbLast.high))&&hbLast.high!==null?Number(hbLast.high):null;
 const hbLow=hbLast&&Number.isFinite(Number(hbLast.low))&&hbLast.low!==null?Number(hbLast.low):null;
 const hbaLevel=!hba?'gray':hbVal!==null&&Number(hbLast.value)>hbVal?'yellow':hbLow!==null&&Number(hbLast.value)<hbLow?'yellow':hbVal!==null||hbLow!==null?'green':'gray';
 return `<section class="vk216-home-section" aria-label="Aktuelle Gesundheitsmesswerte"><h2>Aktuelle Werte</h2><div class="vk216-home-grid">`+
 latestCard('Blutzucker',g?val(g.mgdl,0)+' mg/dl':'–',pTime(g),classificationGlucose,'glucose')+
 latestCard('Langzeitzucker (Labor)',hba?val(hba.pct,1)+' %':'–',hba?dt(hba.date):'Kein bestätigter Labor-HbA1c',hbaLevel,'hba1c')+
 latestCard('Gewicht',weightKg!==null?val(weightKg,1)+' kg':'–',w?pTime(w):weightKg!==null?'Nur Profilangabe – kein Messdatum':'Kein Gewichtseintrag',w?weightLevel:'gray','weight')+
 latestCard('Blutsauerstoff',ox?val(ox.spo2,0)+' %':'–',pTime(ox),oxLevel,'vital')+
 latestCard('PSA gesamt',p.value!==null?val(p.value,2)+' ng/ml':'–',p.date?dt(p.date)+' · '+p.label:p.label,p.level,'urology')+
 latestCard('Blutdruck',bp?val(bp.sys,0)+'/'+val(bp.dia,0)+' mmHg':'–',pTime(bp),bpLevel,'vital')+
 latestCard('Puls',bp&&Number.isFinite(bp.pulse)?val(bp.pulse,0)+'/min':'–',bp&&Number.isFinite(bp.pulse)?pTime(bp):'Kein bestätigter Pulswert',bp&&Number.isFinite(bp.pulse)?(bp.pulse<40||bp.pulse>=130?'red':bp.pulse<50||bp.pulse>100?'yellow':'green'):'gray','vital')+
 `</div><p class="section-note">Grün = innerhalb des angezeigten Orientierungsbereichs; Orange = beachten; Rot = deutlich auffällig; Grau = fehlende oder nicht sicher bewertbare Daten. Kein Ersatz für eine ärztliche Beurteilung. PSA-Risikoklassen zur Früherkennung gelten ab 45 Jahren und nur im passenden Kontext.</p></section>`;
}
function detailTable(data,key){const findings=rows(data.specialtyFindings,x=>x.specialty===key);const labs=rows(data.labs,l=>l.verified===true&&Number.isFinite(Number(l.value))&&(
 key==='diabetology'?/HbA1c|Glukose|Cholesterin|LDL|Kreatinin|eGFR|Albumin/i.test(l.name):key==='urology'?/PSA|Prostata|Urin|Testosteron|Kreatinin|eGFR/i.test(l.name):key==='ophthalmology'?/HbA1c|Glukose/i.test(l.name):key==='pneumology'?/Lunge|Eosinophil|IGE|CRP|Entzündung/i.test(l.name):key==='gp'||key==='hospital'?true:false));
 const selected=firstRows(labs,18);
 return `<details class="vk216-collapse"><summary>Einzelne Laborergebnisse (${labs.length})</summary>${selected.length?`<div class="vk216-rows">${selected.map(l=>`<div><strong>${e(l.name)}:</strong> ${e(val(Number(l.value),2))} ${e(l.unit||'')} <small>${e(dt(l.date))} ${l.verified!==true?'· ungeprüft':''}</small></div>`).join('')}</div>`:'<p>Keine passenden bestätigten Laborwerte.</p>'}</details>`+
 `<details class="vk216-collapse"><summary>Untersuchungseinträge (${findings.length})</summary>${findings.length?`<div class="vk216-rows">${firstRows(findings,20).map(x=>`<div><strong>${e(dt(x.date))} · ${e(x.test)}</strong><p>${e(x.result)}</p><small>${e(x.doctor||'Arzt nicht angegeben')}</small><button type="button" class="quiet" data-vk216-remove="finding" data-id="${e(x.id)}">Eintrag löschen</button></div>`).join('')}</div>`:'<p>Keine Untersuchungen erfasst.</p>'}</details>`;
}
function page(data,key){const spec=SPECS[key];if(!spec)return '<p>Unbekannte Fachrichtung.</p>';
 const graphs=series(data,key).slice(0,2).map(s=>`<section class="panel"><h2>${e(s.name)} – Diagramm</h2>${graph(s.name,s.list,s.field,s.unit)}${(()=>{const st=stats(recent(s.list),s.field);return `<p>Letzte 30 Tage: ${st?'Ø '+val(st.mean,1)+' · Min '+val(st.min,1)+' · Max '+val(st.max,1)+' ('+st.n+' Werte)':'keine Messungen'}</p>`})()}</section>`).join('');
 const docs=docRows(data,key),appts=apptRows(data,key),findings=rows(data.specialtyFindings,x=>x.specialty===key);
 const p=psa(data),psaPanel=key==='urology'?`<section class="panel"><h2>PSA-Auswertung</h2><div class="vk216-inline-state vk216-status-${e(p.level)}"><strong>${p.value===null?'Kein PSA-Wert':val(p.value,2)+' ng/ml'}</strong><p>${e(p.label)}</p><p>${e(p.date?dt(p.date):'')}</p>${p.delta!==null?`<p>Änderung gegenüber letzter Messung: ${e((p.delta>0?'+':'')+val(p.delta,2))} ng/ml</p>`:''}${p.ratio!==null?`<p>Freies / Gesamt-PSA: ${e(val(p.ratio,1))} % (nur ergänzende Information; Testkontext beachten)</p>`:''}</div><p class="section-note">Leitlinienbasierte Früherkennungs-Einschätzung nur ab 45 Jahren; unter 45 nur mit vorhandenem Laborreferenzwert oder ärztlichem Zielwert. Unter Therapie oder nach Prostataoperation gelten andere Maßstäbe.</p></section>`:'';
 return `<div class="vk216-specialty"><div class="heading-row"><div><div class="kicker">FACHÄRZTLICHE AKTE</div><h1>${e(spec.title)}</h1><p class="section-note">Daten werden nicht dupliziert. Vorhandene Messwerte und Befunde werden nur fachlich gefiltert dargestellt.</p></div></div><section class="panel vk216-doctor-actions"><h2>Ärztliche Informationen</h2><p>Eine kompakte DIN-A4-Arztübersicht aus den vorhandenen Daten. Minima, Mittelwerte, Maxima und Verlauf, soweit verfügbar.</p><button class="primary" type="button" data-vk216-report="${e(key)}">DIN-A4-Arztübersicht als PDF / Drucken</button></section>`+
 `${graphs}${psaPanel}<section class="panel"><h2>Ergebnisse und Befunde</h2>${detailTable(data,key)}<details class="vk216-collapse"><summary>Originalbefunde (${docs.length})</summary><div class="vk216-rows">${firstRows(docs,12).map(d=>`<div><b>${e(d.title)}</b><small>${e(d.date?dt(d.date):'Datum prüfen')} · ${e(d.meta?.doctor||'Arzt nicht angegeben')}</small></div>`).join('')||'<p>Keine zugeordneten Originale.</p>'}</div></details><button class="secondary" type="button" data-vk215-doc-cat="${e(spec.doc)}">Originalbefunde öffnen / hochladen</button></section>`+
 `<section class="panel"><h2>Termine und Kalender</h2><div class="vk216-rows">${appts.slice(0,8).map(a=>`<div><b>${e(dt(a.date))}${a.time?' · '+e(a.time):''}</b> · ${e(a.purpose||'Kontrolle')}<small>${e(a.doctor||'Arzt nicht eingetragen')}</small>${a.id?`<button class="quiet" data-vk216-remove="appointment" data-id="${e(a.id)}">Termin löschen</button>`:''}</div>`).join('')||'<p>Keine fachbezogenen Termine eingetragen.</p>'}</div><details class="vk216-collapse"><summary>Neuen Arzttermin eintragen</summary><form id="vk216-appointment-form"><input type="hidden" name="specialty" value="${e(key)}"><div class="form-grid"><label class="field"><span>Datum</span><input name="date" type="date" required></label><label class="field"><span>Uhrzeit (optional)</span><input name="time" type="time"></label><label class="field"><span>Arzt / Praxis</span><input name="doctor" maxlength="120"></label><label class="field"><span>Grund</span><input name="purpose" maxlength="140" placeholder="Kontrolle"></label></div><button class="primary" type="submit">Termin speichern</button></form></details></section>`+
 `<section class="panel"><h2>Weitere ärztliche Ergebnisse</h2><details class="vk216-collapse"><summary>Untersuchung dokumentieren</summary><form id="vk216-finding-form"><input type="hidden" name="specialty" value="${e(key)}"><div class="form-grid"><label class="field"><span>Datum der Untersuchung</span><input name="date" type="date" required></label><label class="field"><span>Untersuchung</span><select name="test">${spec.tests.map(s=>`<option>${e(s)}</option>`).join('')}</select></label><label class="field"><span>Arzt / Praxis</span><input name="doctor" maxlength="120"></label></div><label class="field"><span>Ergebnis laut Befund (keine automatisch erfundenen Werte)</span><textarea name="result" maxlength="1000" required></textarea></label><button class="primary" type="submit">Ergebnis verschlüsselt speichern</button></form></details><p class="section-note">${findings.length} Einträge. Originalfotos bitte im Originalbefund-Ordner aufbewahren.</p></section></div>`;
}
function fromDocCalendar(data){const out=[];for(const k of Object.keys(SPECS))for(const row of docRows(data,k))if(validDate(row.meta?.nextAppointmentDate))out.push({date:row.meta.nextAppointmentDate,time:row.meta.nextAppointmentTime||'',specialty:k,doctor:row.meta.doctor||'',purpose:'Folgetermin laut Befund: '+row.title});return out.sort(sort)}
window.VK216={SPECS,page,home,psa,doctorHTML,fromDocCalendar};
})();
