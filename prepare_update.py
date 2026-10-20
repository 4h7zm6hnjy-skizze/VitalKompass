#!/usr/bin/env python3
"""Create VitalKompass 1.8.4 upload files from the official public repository.
No passwords, patient data, or local browser data are read or sent.
"""
import hashlib
import json
import pathlib
import sys
import urllib.request
import zipfile

BASE = 'https://raw.githubusercontent.com/4h7zm6hnjy-skizze/VitalKompass/main/'
OUT = pathlib.Path(__file__).resolve().parent / 'GitHub_Upload_1.8.4'
EXPECTED_GIT_SHAS = {
 'app.js': '25e8975e210e8aa725855a691e9129d5954844e4',
 'style.css': '4cbf7d0126e2fa4554cd9695627075038bb9929d',
 'sw.js': '5aac4fdfedad37851695d7a02219c2dc53be2329',
 'version.json': '15aaefe964136fd09a1603a65d588d3a8556a88f',
}

def git_blob_sha(content):
    return hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()

def obtain(filename):
    local = pathlib.Path.cwd() / filename
    if local.is_file():
        content = local.read_bytes()
        print('Lokale Datei:', local)
        return content
    req=urllib.request.Request(BASE + filename, headers={'User-Agent': 'VitalKompass-update-preparer/1.8.4'})
    with urllib.request.urlopen(req, timeout=25) as response:
        content=response.read()
    print('Öffentlichen Programmcode gelesen:', filename)
    return content

def replace_once(content, old, new):
    count=content.count(old)
    if count != 1:
        raise RuntimeError(f'Sicherheitsstopp: Stelle {old[:95]!r} wurde {count}x statt genau 1x gefunden. Keine Dateien verändert.')
    return content.replace(old,new,1)

WEIGHT_CODE = r'''
/* 1.8.4: Lokal verschlüsseltes Körpergewichtstagebuch; keine externen Bibliotheken. */
let weightMealFilter='all';
function weightChart(period='month',preloaded=null,wide=720,mealFilter='all'){
 const source=preloaded===null?(data.weights||[]).filter(e=>e.date>=chartMinDate(period)&&e.date<=today()):preloaded;
 const selected=source.filter(e=>Number.isFinite(e.kg)&&(mealFilter==='all'||e.mealTiming===mealFilter)).sort(sortdate);
 if(!selected.length)return '<p class="section-note">Keine Gewichtswerte im gewählten Zeitraum vorhanden.</p>';
 let rows=selected;
 let explanation='Tägliche Messungen';
 if(period!=='day'){
  const buckets=new Map();
  for(const e of selected){
   let bucket=e.date;
   if(period==='ten')bucket=e.date.slice(0,7);
   else if(period==='year'){
    const d=new Date(e.date+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);bucket=d.toLocaleDateString('sv-SE');
   }
   if(!buckets.has(bucket))buckets.set(bucket,[]);
   buckets.get(bucket).push(e);
  }
  rows=[...buckets].map(([bucket,measurements])=>{
   if(period==='ten'||period==='year')return {...measurements.at(-1),date:period==='ten'?bucket+'-01':bucket,kg:avg(measurements.map(x=>x.kg)),_bucket:bucket,_count:measurements.length};
   const morning=measurements.filter(e=>e.mealTiming==='before_breakfast');
   return {...(morning.length?morning:measurements).at(-1),_bucket:bucket,_count:measurements.length};
  });
  explanation=period==='ten'?'Monatliche Durchschnittswerte':period==='year'?'Wöchentliche Durchschnittswerte':'Ein Tageswert (bevorzugt morgens vor dem Frühstück)';
 }
 const W=wide,H=285,L=58,R=18,T=22,B=42,P=W-L-R,Q=H-T-B;
 const values=rows.map(r=>r.kg),smallest=Math.min(...values),biggest=Math.max(...values),margin=Math.max(1,(biggest-smallest)*.15);
 let lo=Math.floor((smallest-margin)*2)/2,hi=Math.ceil((biggest+margin)*2)/2;
 if(hi<=lo)hi=lo+2;
 const x=i=>L+(rows.length===1?P/2:i*P/(rows.length-1));
 const y=v=>T+Q-(v-lo)/(hi-lo)*Q;
 const grid=Array.from({length:5},(_,i)=>{const v=lo+(hi-lo)*i/4;return `<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#dae7ec"/><text x="${L-7}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#4d6578">${nf(v,1)}</text>`}).join('');
 const path=rows.length>1?`<polyline points="${rows.map((r,i)=>`${x(i)},${y(r.kg)}`).join(' ')}" fill="none" stroke="#098879" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`:'';
 const dots=rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.kg)}" r="4.4" fill="#098879" stroke="white" stroke-width="1.4"><title>${nf(r.kg,1)} kg · ${fmtDate(r.date)} ${h(r.time)} · ${h(bpMealLabels[r.mealTiming]||'Ohne Angabe')}${r._count>1?' · '+r._count+' Einträge':''}</title></circle>`).join('');
 const indices=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
 const labels=indices.map(i=>`<text x="${x(i)}" y="${H-13}" text-anchor="middle" font-size="11" fill="#52677b">${period==='ten'?h(rows[i]._bucket):fmtDate(rows[i].date)}</text>`).join('');
 const diff=rows.length>1?rows.at(-1).kg-rows[0].kg:null;
 return `<div class="chartwrap"><svg class="chart" role="img" aria-label="Gewichtsverlauf in Kilogramm, ${rows.length} Punkte, durchgezogene Messlinie" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${grid}<line x1="${L}" x2="${L}" y1="${T}" y2="${H-B}" stroke="#7996a9"/>${path}${dots}${labels}</svg></div><div class="legend"><span><i class="solid-line" style="border-color:#098879"></i>Körpergewicht in kg</span><span>${rows.length} Punkte${diff===null?'':` · Veränderung ${diff>0?'+':''}${nf(diff,1)} kg`}</span></div><p class="section-note">${explanation}. Die Gewichtsmesslinie ist durchgezogen. Für einen verlässlichen Verlauf möglichst immer zur gleichen Tageszeit wiegen.</p>`;
}
function weightTable(){
 const rows=[...(data.weights||[])].sort(sortdate).reverse().slice(0,100);
 if(!rows.length)return '<p>Noch keine Gewichtseinträge vorhanden.</p>';
 return `<div class="table-wrap"><table><thead><tr><th>Datum und Uhrzeit</th><th>Gewicht</th><th>Messzeitpunkt</th><th>Aktion</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtDate(r.date)} ${h(r.time)}</td><td><strong>${nf(r.kg,1)} kg</strong>${r.note?`<p class="section-note">${h(r.note)}</p>`:''}</td><td>${h(bpMealLabels[r.mealTiming]||'Ohne Angabe')}</td><td><button class="secondary" type="button" data-action="edit-weight" data-id="${h(r.id)}">Bearbeiten</button> <button class="dangerbutton" type="button" data-action="remove" data-type="weight" data-id="${h(r.id)}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`;
}
function pageWeight(){
 const entries=[...(data.weights||[])].sort(sortdate),last=entries.at(-1);
 const options=Object.entries(bpMealLabels).filter(([k])=>k!=='unknown');
 return tag('Körpergewicht','Tägliches Gewichtstagebuch mit sechs Messzeitpunkten und fünf Diagrammansichten.')+
 `<div class="main-grid"><div class="metric"><span>Letzte Gewichtsmessung</span><strong>${last?nf(last.kg,1)+' kg':'–'}</strong><small>${last?fmtDate(last.date)+' · '+h(last.time):'Noch keine Messung'}</small></div><div class="metric"><span>Einträge</span><strong>${entries.length}</strong><small>Insgesamt dokumentiert</small></div></div>`+
 panel('Körpergewicht eintragen',`<form id="weight-form"><input name="id" type="hidden"><div class="form-grid"><label class="field"><span>Datum</span><input name="date" type="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input name="time" type="time" value="${nowTime()}" required></label><label class="field"><span>Körpergewicht (kg)</span><input name="kg" type="number" min="20" max="400" step="0.1" inputmode="decimal" required placeholder="z. B. 130,0"></label><label class="field"><span>Wann gewogen?</span><select name="mealTiming" required>${options.map(([k,v])=>`<option value="${k}">${h(v)}</option>`).join('')}</select></label><label class="field"><span>Notiz (optional)</span><input name="note" maxlength="300" placeholder="z. B. nach dem Aufstehen"></label></div><div class="actions"><button class="primary" type="submit">Gewicht speichern</button></div></form><p class="section-note">Mehrere Messungen pro Tag sind möglich. Gespeicherte Werte kannst du unten bearbeiten und löschen.</p>`)+
 panel('Gewichtsdiagramm',chartPicker('weight')+`<label class="field weight-filter"><span>Messzeitpunkt im Diagramm</span><select id="weight-meal-filter"><option value="all" ${weightMealFilter==='all'?'selected':''}>Alle Messzeitpunkte</option>${options.map(([k,v])=>`<option value="${k}" ${weightMealFilter===k?'selected':''}>${h(v)}</option>`).join('')}</select></label>`+weightChart(chartPeriods.weight,null,720,weightMealFilter))+
 panel('Gewichtstagebuch · letzte 100 Einträge',weightTable());
}
function syncProfileWeight(){
 const last=[...(data.weights||[])].sort(sortdate).at(-1);
 if(last)data.profile.weight=String(last.kg);
}
function weightReportBlock(entries){
 const rows=[...entries].sort(sortdate),w=groupStats(rows,'kg');
 const diff=rows.length>1?rows.at(-1).kg-rows[0].kg:null;
 return `<h3>Körpergewicht im Berichtszeitraum</h3><p>${rows.length} Messungen an ${new Set(rows.map(r=>r.date)).size} Tagen · Durchschnitt ${nf(w[1],1)} kg · Minimum ${nf(w[2],1)} kg · Maximum ${nf(w[3],1)} kg${diff===null?'':` · Veränderung von erster zu letzter Messung ${diff>0?'+':''}${nf(diff,1)} kg`}</p>${weightChart(reportPeriod,rows,700,'all')}<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Uhrzeit</th><th>Gewicht</th><th>Messzeitpunkt</th></tr></thead><tbody>${rows.slice(-120).reverse().map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${h(x.time)}</td><td>${nf(x.kg,1)} kg</td><td>${h(bpMealLabels[x.mealTiming]||'Keine Angabe')}</td></tr>`).join('')}</tbody></table></div><p class="section-note">Ab 121 Messungen zeigt diese Einzeltabelle nur die 120 letzten Einträge im Berichtszeitraum. Alle Werte bleiben gespeichert.</p>`;
}
function backupPanels(){
 return `<div class="backup-grid">${panel('Backup erstellen',`<div class="backup-card backup-save"><div class="backup-head"><span class="backup-symbol" aria-hidden="true">↓</span><div><strong>Alle Gesundheitsdaten sichern</strong><p>Verschlüsselte Datei einschließlich Körpergewicht und bisherigen Daten erstellen.</p></div></div><button type="button" data-action="backup" class="primary backup-button">1. Verschlüsseltes Backup vorbereiten</button><div id="backup-ready" class="backup-ready" ${stagedBackupFile?'':'hidden'}><strong>2. Backup auf dem iPhone speichern</strong><p>Mit „In Dateien sichern“ öffnet sich das iPhone-Teilen-Menü. Dort „In Dateien sichern“ auswählen und den gewünschten Speicherort festlegen.</p><div class="backup-save-actions"><button type="button" data-action="backup-share" class="primary backup-button">In Dateien sichern (iPhone)</button><button type="button" data-action="backup-download" class="secondary backup-button">Alternative: Datei herunterladen</button></div></div><p id="backup-save-status" class="section-note" role="status">Das aktuelle VitalKompass-Passwort wird zum Wiederherstellen benötigt. Bitte prüfen, ob die Backup-Datei in der Dateien-App vorhanden ist. Niemals private Backups bei GitHub hochladen.</p></div>`)}${panel('Backup importieren',`<div class="backup-card backup-import"><div class="backup-head"><span class="backup-symbol" aria-hidden="true">↑</span><div><strong>Alte Sicherung wiederherstellen</strong><p>Backup aus „Dateien“ auswählen und mit dem ursprünglichen Passwort öffnen.</p></div></div><form id="restore-form"><label class="field"><span>Backup aus der iPhone-App „Dateien“ wählen (.json)</span><input name="file" type="file" accept=".json,application/json" required></label><label class="field"><span>Passwort der Backup-Datei</span><input name="password" type="password" autocomplete="off" required></label><label class="backup-confirm"><input type="checkbox" name="confirmReplace" required><span>Ich weiß, dass die vorhandenen Daten vollständig ersetzt werden, und habe meinen aktuellen Datenstand gesichert.</span></label><button type="submit" class="dangerbutton backup-button">Backup importieren und Daten ersetzen</button></form><p class="section-note">Die Datei wird vor dem Import entschlüsselt und geprüft. Erst nach zusätzlicher Rückfrage erfolgt die Überschreibung. Frühere Backup-Versionen bleiben kompatibel.</p></div>`)}</div>`;
}
'''

WEIGHT_SUBMIT = r'''if(form.id==='weight-form'){
 const kg=nval(f.get('kg')),date=String(f.get('date')||''),time=String(f.get('time')||''),meal=String(f.get('mealTiming')||''),entryId=String(f.get('id')||'');
 if(!Number.isFinite(kg)||kg<20||kg>400)throw Error('Bitte ein plausibles Körpergewicht zwischen 20 und 400 kg eingeben.');
 if(!dateValid(date)||date>today()||!timeValid(time))throw Error('Datum oder Uhrzeit ungültig. Ein zukünftiges Datum ist nicht erlaubt.');
 if(meal==='unknown'||!Object.prototype.hasOwnProperty.call(bpMealLabels,meal))throw Error('Bitte den Messzeitpunkt auswählen.');
 const entry={id:entryId||id(),date,time,kg:Math.round(kg*10)/10,mealTiming:meal,note:String(f.get('note')||'').slice(0,300)};
 const at=data.weights.findIndex(x=>x.id===entryId);
 if(entryId&&at<0)throw Error('Dieser Gewichtseintrag wurde nicht gefunden.');
 if(at>=0)data.weights[at]=entry;else data.weights.push(entry);
 syncProfileWeight();await save();renderMain();toast('Gewicht verschlüsselt gespeichert.');return;
}
'''

CSS = r'''
/* VitalKompass 1.8.4: Gewichtsmessung und deutliche Backup-Karten */
.backup-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start;margin:8px 0 22px}
.backup-grid .panel{height:100%;margin:0;border-width:2px;border-radius:18px;min-width:0}
.backup-grid .panel:first-child{border-color:#a3d8bf;background:#f6fdf9}
.backup-grid .panel:last-child{border-color:#f0bb9d;background:#fff9f5}
.backup-head{display:flex;gap:13px;align-items:flex-start;margin-bottom:16px}
.backup-head strong{font-size:1.12rem;display:block;margin-bottom:4px}
.backup-head p{margin:0;color:#365268;font-size:.94rem}
.backup-symbol{display:grid;place-items:center;flex:none;width:46px;height:46px;font-size:1.65rem;font-weight:800;border-radius:13px;background:#d9f5e7;color:#116646}
.backup-import .backup-symbol{background:#ffe5d6;color:#a34d1d}
.backup-button{display:block;width:100%;min-height:56px;font-size:1rem}
.backup-ready{background:#e9f8f0;border:2px solid #8dcdb1;padding:14px;border-radius:14px;margin:16px 0}
.backup-ready[hidden]{display:none!important}
.backup-ready>strong{display:block;margin-bottom:7px;font-size:1.03rem}
.backup-ready>p{font-size:.93rem;color:#284e42}
.backup-save-actions{display:grid;gap:10px}
.backup-confirm{display:flex;gap:12px;align-items:flex-start;background:white;border:1px solid #e8c8b6;border-radius:12px;padding:13px;margin:14px 0}
.backup-confirm input{width:24px;min-width:24px;height:24px;min-height:24px;margin:0}
.backup-confirm span{line-height:1.4;font-size:.92rem}
.weight-filter{max-width:460px}
#main[data-section="weight"] .metric{border-left:4px solid #098879}
#main[data-section="weight"] .panel:first-of-type{border-top:4px solid #098879}
@media(max-width:700px){.backup-grid{grid-template-columns:1fr;gap:14px}.backup-grid .panel{padding:17px}.backup-button{min-height:58px}.backup-head{gap:10px}}
@media print{.backup-grid{display:none!important}}
'''

def patch_app(s):
    s=replace_once(s,'/* VitalKompass v1.8.3','/* VitalKompass v1.8.4')
    s=replace_once(s,"const VERSION='1.8.3'","const VERSION='1.8.4'")
    s=replace_once(s,"let lastPDFUrl=null,lastPDFBlob=null,lastPDFName='';","let lastPDFUrl=null,lastPDFBlob=null,lastPDFName='';\nlet stagedBackupFile=null;")
    s=replace_once(s,"for(const field of ['symptoms','medTakes','reminders','evidence'])","for(const field of ['symptoms','medTakes','reminders','evidence','weights'])")
    s=replace_once(s,'measurements:[],labs:[],meds:[],symptoms:[]','measurements:[],labs:[],meds:[],weights:[],symptoms:[]')
    s=replace_once(s,"['bp','Blutdruck','♥'],['labs'","['bp','Blutdruck','♥'],['weight','Körpergewicht','⚖'],['labs'")
    s=replace_once(s,'glucose:pageGlucose,bp:pageBp,labs:pageLabs','glucose:pageGlucose,bp:pageBp,weight:pageWeight,labs:pageLabs')
    s=replace_once(s,"pulse:'month',lab:'year'","pulse:'month',weight:'month',lab:'year'")
    s=replace_once(s,'function measurementTable(type)',WEIGHT_CODE+'\nfunction measurementTable(type)')
    s=replace_once(s,"const g=latest('glucose'),b=latest('bp'),thisMonth","const g=latest('glucose'),b=latest('bp'),w=[...(data.weights||[])].sort(sortdate).at(-1),thisMonth")
    s=replace_once(s,'<div class="metric"><span>Blutdruck diesen Monat</span>',"<div class=\"metric\"><span>Letztes Gewicht</span><strong>${w?nf(w.kg,1)+' kg':'–'}</strong><small>${w?fmtDate(w.date):'Noch keine Einträge'}</small></div><div class=\"metric\"><span>Blutdruck diesen Monat</span>")
    s=replace_once(s,'data-view="bp">+ Blutdruck eintragen</button>','data-view="bp">+ Blutdruck eintragen</button><button class="primary" data-view="weight">+ Gewicht eintragen</button>')
    s=replace_once(s,"${panel('Puls – Grenzlinien',chartPicker('pulse')","${panel('Körpergewicht – Verlauf',chartPicker('weight')+weightChart(chartPeriods.weight,null,500,'all'))}${panel('Puls – Grenzlinien',chartPicker('pulse')")
    s=replace_once(s,"const pendingLabs=data.labs.filter(","const w=(data.weights||[]).filter(x=>between(x,a,b)).sort(sortdate);const pendingLabs=data.labs.filter(")
    s=replace_once(s,"let gm=groupStats(g,'mgdl'),sb=","let gm=groupStats(g,'mgdl'),wm=groupStats(w,'kg'),sb=")
    s=replace_once(s,'<div class="metric"><span>Labor</span><strong>${l.length}', '<div class="metric"><span>Körpergewicht</span><strong>${w.length}</strong><small>Gewichtseinträge</small></div><div class="metric"><span>Labor</span><strong>${l.length}')
    s=replace_once(s,"['Glukose (mg/dl)',gm],['Systolisch","['Glukose (mg/dl)',gm],['Körpergewicht (kg)',wm],['Systolisch")
    s=replace_once(s,'<h3>Blutzuckerverlauf</h3>${lineChart','${weightReportBlock(w)}<h3>Blutzuckerverlauf</h3>${lineChart')
    s=replace_once(s,"panel('Interaktive Langzeitdiagramme',chartPicker('glucose')","panel('Interaktive Langzeitdiagramme',chartPicker('weight')+weightChart(chartPeriods.weight,null,700,'all')+chartPicker('glucose')")
    start="+panel('Verschlüsseltes Backup / Wiederherstellung',"
    finish="+panel('Private Patienten- und Messwerte importieren',"
    if s.count(start)!=1 or s.count(finish)!=1:raise RuntimeError('Backup-Layout nicht eindeutig gefunden.')
    a=s.index(start);b=s.index(finish,a)
    s=s[:a]+'+backupPanels()'+s[b:]
    s=replace_once(s,'Backup probeweise öffnen</button></form>','Backup probeweise öffnen</button></form><p id="backup-verify-result" class="section-note" role="status"></p>')
    s=replace_once(s,"validateStored(restored);toast('Backup-Prüfung erfolgreich. Es wurden keine Daten überschrieben.');return;","validateStored(restored);const info=$('#backup-verify-result');if(info)info.textContent=`Backup überprüft: ${restored.measurements.length} Blutdruck-/Blutzuckerwerte, ${(restored.weights||[]).length} Gewichtseinträge, ${restored.labs.length} Laborwerte. Keine Daten verändert.`;toast('Backup erfolgreich überprüft. Keine Daten überschrieben.');return;")
    s=replace_once(s,"if(form.id==='glucose-form'){",WEIGHT_SUBMIT+"if(form.id==='glucose-form'){")
    s=replace_once(s,"evidence:'evidence',measurement:'measurements'","evidence:'evidence',weight:'weights',measurement:'measurements'")
    s=replace_once(s,'data[bucket]=data[bucket].filter(x=>x.id!==idv);await save();','data[bucket]=data[bucket].filter(x=>x.id!==idv);if(bucket===\'weights\')syncProfileWeight();await save();')
    s=replace_once(s,"discardTemporaryPDF();bridgePreview=null;data=null;key=null;view='start';authPage", "discardTemporaryPDF();bridgePreview=null;stagedBackupFile=null;data=null;key=null;view='start';authPage")
    s=replace_once(s,"if(action==='edit-med'){","if(action==='edit-weight'){const entry=(data.weights||[]).find(x=>x.id===el.dataset.id),form=$('#weight-form');if(!entry||!form)return;for(const name of ['id','date','time','kg','mealTiming','note'])form.elements[name].value=entry[name]??'';form.scrollIntoView({behavior:'smooth',block:'start'});return}\nif(action==='edit-med'){")
    # Two user gestures: encrypt first, then share immediately from the next click. This preserves Safari's transient user activation for the iOS share sheet.
    s=replace_once(s, "if(action==='backup'){await saveQueue;const old=await getRec();const doc={format:'vitalkompass-backup-v1',version:VERSION,created:new Date().toISOString(),salt:old.salt,iv:old.iv,cipher:old.cipher};sendDownload(JSON.stringify(doc,null,2),`VitalKompass-Backup-${today()}.json`);toast('Verschlüsseltes Backup erzeugt. Datei sicher aufbewahren.');return}", "if(action==='backup'){await save();await saveQueue;const old=await getRec();if(!old?.salt||!old.iv||!old.cipher)throw Error('Verschlüsselte Sicherung konnte nicht vorbereitet werden.');const doc={format:'vitalkompass-backup-v1',version:VERSION,created:new Date().toISOString(),salt:old.salt,iv:old.iv,cipher:old.cipher};stagedBackupFile=new File([JSON.stringify(doc,null,2)],`VitalKompass-Backup-${today()}.json`,{type:'application/json'});const ready=$('#backup-ready');if(ready){ready.hidden=false;ready.scrollIntoView({block:'nearest'});}const status=$('#backup-save-status');if(status)status.textContent='Verschlüsselte Datei vorbereitet ('+nf(stagedBackupFile.size/1024,0)+' KB). Jetzt „In Dateien sichern“ auswählen. Keine Daten wurden hochgeladen.';toast('Backup vorbereitet. Jetzt „In Dateien sichern“ wählen.');return}\nif(action==='backup-share'){if(!stagedBackupFile)throw Error('Zuerst das Backup vorbereiten.');if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[stagedBackupFile]}))){navigator.share({files:[stagedBackupFile],title:'VitalKompass – verschlüsseltes Backup'}).then(()=>{const status=$('#backup-save-status');if(status)status.textContent='iPhone-Teilen-Menü beendet. Bitte in „Dateien“ prüfen, ob die Datei wirklich gespeichert wurde.';toast('Bitte die Sicherung in Dateien prüfen.');}).catch(err=>{if(err?.name==='AbortError')return;const status=$('#backup-save-status');if(status)status.textContent='iOS-Teilen nicht verfügbar. Bitte „Alternative: Datei herunterladen“ nutzen.';toast('iPhone-Teilen nicht verfügbar – Download-Alternative nutzen.');});}else{const status=$('#backup-save-status');if(status)status.textContent='Dieser Browser unterstützt Datei-Teilen nicht. Bitte „Alternative: Datei herunterladen“ nutzen.';toast('Dateifreigabe hier nicht unterstützt.');}return}\nif(action==='backup-download'){if(!stagedBackupFile)throw Error('Zuerst das Backup vorbereiten.');sendDownload(stagedBackupFile,stagedBackupFile.name);const status=$('#backup-save-status');if(status)status.textContent='Download gestartet. Öffne die App „Dateien“ und kontrolliere den Ordner „Downloads“.';toast('Download gestartet. In Dateien / Downloads prüfen.');return}")
    s=replace_once(s,"if(form.id==='restore-form'){const file=","if(form.id==='restore-form'){if(!f.get('confirmReplace'))throw Error('Bitte zuerst die bewusste Datenüberschreibung bestätigen.');const file=")
    s=replace_once(s,"if(!confirm('ACHTUNG: Alle aktuellen Einträge werden durch die Daten des Backups ersetzt. Fortfahren?'))return;","if(!confirm(`ACHTUNG: Das Backup enthält ${restored.measurements.length} Blutdruck-/Blutzuckerwerte und ${(restored.weights||[]).length} Gewichtseinträge. Alle aktuellen Daten werden vollständig ERSETZT, nicht zusammengeführt. Fortfahren?`))return;")
    s=replace_once(s,"if(x.measurements.length>50000||x.labs.length>50000","if((x.weights!==undefined&&(!Array.isArray(x.weights)||x.weights.length>50000))||x.measurements.length>50000||x.labs.length>50000")
    s=replace_once(s,"for(const list of [x.measurements,x.labs,x.meds,","for(const list of [x.measurements,x.labs,x.meds,x.weights||[],")
    s=replace_once(s,'if(!x.labs.every(l=>',"if(x.weights!==undefined&&!x.weights.every(w=>w&&typeof w.id==='string'&&dateValid(w.date)&&timeValid(w.time)&&Number.isFinite(w.kg)&&w.kg>=20&&w.kg<=400&&w.mealTiming!=='unknown'&&Object.prototype.hasOwnProperty.call(bpMealLabels,w.mealTiming)&&(w.note===undefined||(typeof w.note==='string'&&w.note.length<=300))))throw Error('Backup enthält ungültige Gewichtseinträge.');\n  if(!x.labs.every(l=>")
    s=replace_once(s,"root.addEventListener('change',e=>{if(e.target.matches('[data-lab-chart]'))","root.addEventListener('change',e=>{if(e.target.matches('#weight-meal-filter')){weightMealFilter=e.target.value;renderMain();return}if(e.target.matches('[data-lab-chart]'))")
    return s

def main():
    try:
        raw={name:obtain(name) for name in ('app.js','style.css','sw.js','version.json')}
        for name, content in raw.items():
            actual = git_blob_sha(content)
            if actual != EXPECTED_GIT_SHAS[name]:
                raise RuntimeError('Der GitHub-Code wurde seit Version 1.8.3 geändert: '+name+'. Sicherheitsstopp; keine Dateien verändert. SHA: '+actual)
        app=patch_app(raw['app.js'].decode('utf-8'))
        styles=raw['style.css'].decode('utf-8')+'\n'+CSS
        sw=raw['sw.js'].decode('utf-8').replace('VitalKompass 1.8.3','VitalKompass 1.8.4').replace('vital-kompass-1.8.3-messlinien','vital-kompass-1.8.4-gewicht-backup')
        if 'vital-kompass-1.8.4-gewicht-backup' not in sw:raise RuntimeError('Service-Worker Cache konnte nicht angepasst werden.')
        meta=json.loads(raw['version.json'])
        if meta.get('version')!='1.8.3':raise RuntimeError('Versionsstand wurde nachträglich geändert.')
        meta['version']='1.8.4';meta['released']='2026-10-20'
        meta['notes']='Gewichtstagebuch mit Messzeitpunkt und Tag/Woche/Monat/Jahr/10-Jahre-Diagramm; Körpergewicht in Monats- und Jahresbericht; iPhone-Backup per Teilen-Menü/Dateien, sicherer Import aus Dateien.'
        OUT.mkdir(exist_ok=True)
        files={'app.js':app,'style.css':styles,'sw.js':sw,'version.json':json.dumps(meta,ensure_ascii=False,indent=2)+'\n'}
        for name,content in files.items(): (OUT/name).write_text(content,encoding='utf-8')
        try:
            import subprocess
            test=subprocess.run(['node','--check',str(OUT/'app.js')],capture_output=True,text=True,timeout=20)
            if test.returncode:raise RuntimeError('JavaScript-Syntaxfehler: '+test.stderr)
            print('JavaScript-Syntaxprüfung bestanden.')
        except FileNotFoundError:
            print('Hinweis: Node.js fehlt, JavaScript-Syntaxprüfung wurde übersprungen.')
        bundle=OUT.parent/'VitalKompass_1.8.4_GitHub_Upload.zip'
        with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as z:
            for name in files:z.write(OUT/name,arcname=name)
        print('FERTIG:',bundle)
        print('Diese vier Dateien in GitHub hochladen und vorhandene Dateien ersetzen.')
        print('Keine Gesundheitsdaten wurden heruntergeladen oder verarbeitet.')
    except Exception as exc:
        print('FEHLER:',exc,file=sys.stderr);return 1
    return 0

if __name__=='__main__':sys.exit(main())
