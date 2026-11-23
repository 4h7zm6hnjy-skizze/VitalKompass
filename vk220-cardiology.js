/* VitalKompass 2.0.21: Kardiologie. Nutzt nur den bestehenden verschluesselten lokalen Tresor. */
(function(){
'use strict';
const TESTS=[
 ['Ruhe-EKG (12-Kanal)','EKG & Rhythmus','hr,rhythm,pr,qrs,qtc'],
 ['Langzeit-EKG (24–72 Stunden)','EKG & Rhythmus','duration,avg,min,max,extras'],
 ['Ereignis-EKG / Eventrekorder','EKG & Rhythmus','duration,avg,rhythm'],
 ['Implantierbarer Loop-Rekorder','EKG & Rhythmus','min,max,rhythm'],
 ['Belastungs-EKG / Ergometrie','Belastung','watt,max,sys,dia'],
 ['Stressechokardiografie','Belastung','lvef,max'],
 ['Spiroergometrie','Belastung','vo2,watt,max'],
 ['Kipptisch-Untersuchung','Belastung','hr,sys,dia'],
 ['Herzultraschall / Echokardiografie (TTE)','Herzultraschall','lvef,lved,tapse,valve'],
 ['Schluckecho (TEE)','Herzultraschall','lvef,valve'],
 ['Doppler- / Farbduplex-Echokardiografie','Herzultraschall','lvef,valve'],
 ['Kontrast- / Stress-Echokardiografie','Herzultraschall','lvef'],
 ['24-Stunden-Blutdruckmessung','Blutdruck & Gefäße','sys24,dia24,sysNight,diaNight'],
 ['Orthostasetest / Schellong-Test','Blutdruck & Gefäße','hr,sys,dia'],
 ['Gefäß-Duplexsonografie','Blutdruck & Gefäße',''],
 ['Herz-MRT / Kardio-MRT','Bildgebung','lvef,lved'],
 ['Herz-CT / CT-Koronarangiografie','Bildgebung','agatston,stenosis'],
 ['Koronarkalk-Score (CT)','Bildgebung','agatston'],
 ['Myokardszintigrafie / SPECT','Bildgebung','lvef'],
 ['Herz-PET','Bildgebung',''],
 ['Koronarangiografie / Linksherzkatheter','Katheter & EPU','stenosis,lvef'],
 ['Rechtsherzkatheter','Katheter & EPU','pap,wedge'],
 ['Elektrophysiologische Untersuchung (EPU)','Katheter & EPU','rhythm'],
 ['Schrittmacher-Kontrolle','Geräte / Therapie','hr,rhythm'],
 ['ICD- / CRT-Kontrolle','Geräte / Therapie','hr,rhythm'],
 ['Ablation / Kardioversion / Nachkontrolle','Geräte / Therapie','hr,rhythm'],
 ['Herz-Labor (Troponin, BNP, Elektrolyte)','Labor & Allgemein','troponin,ntprobnp,potassium'],
 ['Kardiologische Basisuntersuchung','Labor & Allgemein','hr,sys,dia'],
 ['Sonstige kardiologische Untersuchung','Labor & Allgemein','']
];
const M={
hr:['Puls','/min',15,260],avg:['Mittlere Herzfrequenz','/min',15,260],min:['Niedrigste Herzfrequenz','/min',15,260],max:['Höchste Herzfrequenz','/min',15,290],
rhythm:['Herzrhythmus laut Befund','',null,null,['Sinusrhythmus','Vorhofflimmern','Vorhofflattern','Andere – siehe Freitext']],pr:['PQ-/PR-Zeit','ms',0,600],qrs:['QRS-Dauer','ms',0,500],qtc:['QTc','ms',0,800],
duration:['Aufzeichnungsdauer','Stunden',0,10000],extras:['Extrasystolen','Anzahl',0,10000000],watt:['Maximale Belastung','Watt',0,1000],vo2:['VO₂peak','ml/kg/min',0,130],
lvef:['Linksventrikuläre Ejektionsfraktion (LVEF)','%',0,100],lved:['LV-Enddiastolischer Durchmesser','mm',0,130],tapse:['TAPSE','mm',0,80],
valve:['Herzklappen laut Befund','',null,null,['Unauffällig laut Befund','Auffälligkeit – siehe Freitext']],
sys:['Systolischer Blutdruck','mmHg',30,350],dia:['Diastolischer Blutdruck','mmHg',15,250],
sys24:['24-h-Mittel systolisch','mmHg',30,350],dia24:['24-h-Mittel diastolisch','mmHg',15,250],
sysNight:['Nachtmittel systolisch','mmHg',30,350],diaNight:['Nachtmittel diastolisch','mmHg',15,250],
agatston:['Agatston-Score','',0,20000],stenosis:['Stenosegrad','%',0,100],pap:['Pulmonalarteriendruck (Mittel)','mmHg',0,150],wedge:['Verschlussdruck','mmHg',0,100],
troponin:['Troponin (Einheit im Freitext ergänzen)','',0,100000],ntprobnp:['NT-proBNP (Einheit im Freitext ergänzen)','',0,200000],potassium:['Kalium','mmol/l',0,15]
};
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function valid(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s}
function fmt(d){return valid(d)?d.slice(8)+'.'+d.slice(5,7)+'.'+d.slice(0,4):'Datum unbekannt'}
function findings(data){return (Array.isArray(data&&data.specialtyFindings)?data.specialtyFindings:[]).filter(x=>x&&x.specialty==='cardiology'&&valid(x.date)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')))}
function options(){let group='',s='';for(const [name,g] of TESTS){if(g!==group){if(group)s+='</optgroup>';group=g;s+='<optgroup label="'+esc(g)+'">'}s+='<option value="'+esc(name)+'">'+esc(name)+'</option>'}return s+'</optgroup>'}
function fieldHTML(test){
 const t=TESTS.find(x=>x[0]===test)||TESTS[0],keys=t[2].split(',').filter(Boolean);
 if(!keys.length)return '<p class="section-note">Bitte den Originalbefund im Textfeld beschreiben.</p>';
 return '<div class="vk220-grid">'+keys.map(k=>{const f=M[k];if(!f)return '';
 if(f[4])return '<label class="field"><span>'+esc(f[0])+'</span><select name="c_'+k+'"><option value="">Nicht angegeben</option>'+f[4].map(v=>'<option>'+esc(v)+'</option>').join('')+'</select></label>';
 return '<label class="field"><span>'+esc(f[0])+(f[1]?' ('+esc(f[1])+')':'')+'</span><input type="number" inputmode="decimal" step="any" min="'+f[2]+'" max="'+f[3]+'" name="c_'+k+'" placeholder="Optional"></label>';
 }).join('')+'</div><p class="section-note">Zahlen nur aus dem Originalbefund übernehmen. Keine automatische Diagnose.</p>';
}
function metricText(metrics,max){return Object.entries(metrics||{}).filter(x=>M[x[0]]).slice(0,max||6).map(x=>esc(M[x[0]][0])+': '+esc(x[1])+(M[x[0]][1]?' '+esc(M[x[0]][1]):'')).join(' · ')}
function page(data){
 const rows=findings(data),recent=rows.slice(-7).reverse();
 return '<section class="panel vk220-cardiology"><h2>Herzuntersuchungen und EKG</h2>'
 +'<p class="section-note">Ruhe-/Langzeit-/Belastungs-EKG, Echokardiografie, Langzeit-Blutdruck, Herz-MRT/CT, Herzkatheter, Schrittmacher und weitere Untersuchungen.</p>'
 +'<details class="vk216-collapse" open><summary>Neue kardiologische Untersuchung erfassen</summary>'
 +'<form id="vk220-cardio-form"><div class="vk220-grid">'
 +'<label class="field"><span>Untersuchungsdatum</span><input type="date" name="date" max="'+today()+'" required></label>'
 +'<label class="field"><span>Uhrzeit (optional)</span><input type="time" name="time"></label>'
 +'<label class="field"><span>Arzt / Praxis / Klinik</span><input name="doctor" maxlength="120"></label>'
 +'<label class="field"><span>Untersuchungsart</span><select name="test" id="vk220-test">'+options()+'</select></label></div>'
 +'<div id="vk220-fields">'+fieldHTML(TESTS[0][0])+'</div>'
 +'<label class="field"><span>Ergebnis / Beurteilung laut Befund</span><textarea name="result" maxlength="1400" rows="4" required placeholder="Bitte den ärztlichen Befund dokumentieren"></textarea></label>'
 +'<label class="vk220-checked"><input type="checkbox" name="sourceChecked"> Eingaben mit Originalbefund abgeglichen</label>'
 +'<p class="section-note">Originale unter „Originalbefunde / Scans“ → „Herz / Kreislauf“ aufbewahren. Die App liest keine EKG-Kurven automatisch aus.</p>'
 +'<button class="primary" type="submit">Kardiologischen Befund verschlüsselt speichern</button></form></details>'
 +'<details class="vk216-collapse"><summary>Bisherige kardiologische Untersuchungen ('+rows.length+')</summary><div class="vk216-rows">'
 +(recent.length?recent.map(x=>'<div><strong>'+esc(fmt(x.date))+' · '+esc(x.test||'')+'</strong><small>'+esc(x.doctor||'Arzt nicht angegeben')+' · '+(x.cardio&&x.cardio.sourceChecked?'mit Original abgeglichen':'nicht als originalgeprüft markiert')+'</small><p>'+metricText(x.cardio&&x.cardio.metrics,6)+'</p><p>'+esc(x.result||'')+'</p></div>').join(''):'<p>Keine kardiologischen Untersuchungen erfasst.</p>')
 +'</div></details><p class="section-note">Messwerte sind Dokumentation, keine medizinische Auswertung oder Diagnosestellung.</p></section>';
}
async function saveFinding(f,data,save,id){
 if(!data||!Array.isArray(data.specialtyFindings))throw Error('Tresor gesperrt oder Einträge fehlen.');
 const test=String(f.get('test')||''),t=TESTS.find(x=>x[0]===test),date=String(f.get('date')||''),time=String(f.get('time')||'');
 const result=String(f.get('result')||'').trim().slice(0,1400);
 if(!t||!valid(date)||date>today()||!result)throw Error('Untersuchung, Datum und Befundtext prüfen.');
 if(time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Uhrzeit prüfen.');
 const metrics={};
 for(const k of t[2].split(',').filter(Boolean)){const m=M[k],raw=String(f.get('c_'+k)||'').trim();if(!m||!raw)continue;
  if(m[4]){if(!m[4].includes(raw))throw Error('Auswahl ungültig: '+m[0]);metrics[k]=raw;continue}
  const x=Number(raw.replace(',','.'));if(!Number.isFinite(x)||x<m[2]||x>m[3])throw Error('Wert prüfen: '+m[0]);metrics[k]=x;
 }
 const row={id:id(),date,time,specialty:'cardiology',doctor:String(f.get('doctor')||'').trim().slice(0,120),test,result,cardio:{metrics,sourceChecked:f.get('sourceChecked')==='on'}};
 const prev=data.specialtyFindings;data.specialtyFindings=prev.concat([row]);
 try{await save()}catch(e){data.specialtyFindings=prev;throw e}
}
function reportHTML(data){
 const list=findings(data).slice(-4).reverse();
 return '<h3>Kardiologische Untersuchungen</h3>'+(list.length?list.map(x=>
 '<p><b>'+esc(fmt(x.date))+' · '+esc(x.test||'')+'</b> · '+esc(x.doctor||'ohne Arztangabe')+'<br>'
 +metricText(x.cardio&&x.cardio.metrics,5)+'<br>'+esc(String(x.result||'').slice(0,180))
 +' <small>('+(x.cardio&&x.cardio.sourceChecked?'Original abgeglichen':'nicht originalgeprüft')+')</small></p>').join(''):'<p>Keine kardiologischen Untersuchungen dokumentiert.</p>')
 +'<p><small>Keine automatische EKG-Interpretation; ärztliche Befunde sind maßgeblich.</small></p>';
}
document.addEventListener('change',function(e){if(e.target&&e.target.id==='vk220-test'){const mount=document.getElementById('vk220-fields');if(mount)mount.innerHTML=fieldHTML(e.target.value)}});
window.VK220=Object.freeze({TESTS,page,saveFinding,reportHTML});
})();