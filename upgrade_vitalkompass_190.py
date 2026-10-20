#!/usr/bin/env python3
"""VitalKompass 1.9.0 update: strictly patches existing 1.8.4, never reads patient data.
Runs locally/on GitHub Actions. No external dependencies. Always stops before writing on a patch mismatch.
"""
from pathlib import Path
import json
import hashlib
import sys
import subprocess

HERE=Path(__file__).resolve().parent
BASE=Path.cwd()
OUT=BASE/'GitHub_Upload_1.9.0'
EXPECTED={
 'app.js':'d6341de322c7a9be61ae45046946ff8368016220',
 'style.css':'a6f593ef770ac4f0a99db0871da924318271423c',
 'sw.js':'2d408f038515d708cec735dcfa5acbc3b75d0408',
 'version.json':'34c95ae566581ad1abd4f947d45e1aa1585a9ec4',
}

def blobsha(contents):
 return hashlib.sha1(b'blob '+str(len(contents)).encode()+b'\0'+contents).hexdigest()

def patch_once(text,old,new,label=''):
 n=text.count(old)
 if n!=1:raise RuntimeError(f'Sicherheitsstopp bei {label or old[:70]!r}: erwartet eine Fundstelle, gefunden {n}. Keine App-Datei geändert.')
 return text.replace(old,new,1)

def inject_before(s,needle,block):return patch_once(s,needle,block+'\n'+needle,'Code-Insertion')

def make():
 source={}
 for name,sha in EXPECTED.items():
  p=BASE/name
  if not p.exists():raise RuntimeError(f'Bitte zunächst die aktuelle GitHub-App-Datei bereitstellen: {name}')
  b=p.read_bytes()
  if blobsha(b)!=sha:raise RuntimeError(f'Datei {name} weicht von geprüfter Version 1.8.4 ab. Änderungen bitte erst prüfen; kein Überschreiben.')
  source[name]=b.decode('utf-8')
 feature=(BASE/'vk190_features.js').read_text('utf-8')
 app=source['app.js']
 app=patch_once(app,'/* VitalKompass v1.8.4','/* VitalKompass v1.9.0','App-Kopf')
 app=patch_once(app,"const VERSION='1.8.4'","const VERSION='1.9.0'",'Versionsnummer')
 app=patch_once(app,"for(const field of ['symptoms','medTakes','reminders','evidence','weights'])","for(const field of ['symptoms','medTakes','reminders','evidence','weights','asthmaLogs'])",'Migration Listen')
 app=patch_once(app,"data.checks=data.checks||{}; data.checks.gdb=","if(!data.medStocks||typeof data.medStocks!=='object'||Array.isArray(data.medStocks))data.medStocks={}; data.checks=data.checks||{}; data.checks.gdb=",'Migration Vorrat')
 app=patch_once(app,"meds:[],weights:[],symptoms:[]","meds:[],weights:[],asthmaLogs:[],medStocks:{},symptoms:[]",'Schema Erweiterung')
 app=patch_once(app,"['weight','Körpergewicht','⚖'],['labs'","['weight','Körpergewicht','⚖'],['asthma','Asthma-Tagebuch','♧'],['doctor','Arztbericht','▤'],['labs'",'Hauptnavigation')
 app=patch_once(app,'weight:pageWeight,labs:pageLabs','weight:pageWeight,asthma:pageAsthma,doctor:pageDoctorReport,labs:pageLabs','Ansichts-Routing')
 app=patch_once(app,"weight:'month',lab:'year'","weight:'month',asthma:'month',lab:'year'",'Asthma Zeiträume')
 app=patch_once(app,'function pageWeight(){','function pageWeightOld(){','Gewichtseite Wrapper')
 app=patch_once(app,'function pageStart(){','function pageStartOld(){','Startseite Wrapper')
 app=patch_once(app,'function pageMeds(){','function pageMedsOld(){','Medikamente Wrapper')
 app=patch_once(app,'function pageReminders(){','function pageRemindersOld(){','Erinnerungen Wrapper')
 app=patch_once(app,'function pageAnalysis(){','function pageAnalysisOld(){','Analyse Wrapper')
 app=patch_once(app,'function pageStats(){','function pageStatsOld(){','Statistik Wrapper')
 app=patch_once(app,'function measurementTable(type)',feature+'\n'+'''\nfunction pageWeight(){return pageWeightOld()+vkWeightGoalPanel()}\nfunction pageStart(){const old=pageStartOld();const point='<div class="main-grid">';return old.includes(point)?old.replace(point,vkDashboard()+point):old+vkDashboard()}\nfunction pageMeds(){return pageMedsOld()+vkMedStockPanel()}\nfunction pageReminders(){return pageRemindersOld()+vkReminderPanel()}\nfunction pageAnalysis(){return pageAnalysisOld()+vkPeriodComparison()}\nfunction pageStats(){const [a,b]=statsRange();const rows=(data.asthmaLogs||[]).filter(x=>between(x,a,b));return pageStatsOld()+panel('Asthma im Berichtszeitraum',vkAsthmaStats(rows)+vkMiniTrend(rows,'peakFlow','Peak-Flow','l/min',reportPeriod))+panel('Ausgewählter Arztbericht','<p>Du kannst einen gezielten Arztbericht mit nur den gewünschten Gesundheitsbereichen erstellen.</p><button data-view="doctor" type="button" class="primary">Arztbericht zusammenstellen</button>')}\n'''+ 'function measurementTable(type)','Neue Seiten')
 # Do not add an inactivity or automatic lock: existing manual lock unchanged.
 app=patch_once(app,'const snapshot=clone(data),writeKey=key;','stagedBackupFile=null;const snapshot=clone(data),writeKey=key;','Ungültige ältere Backup-Vorschau verwerfen')
 app=patch_once(app,'if(last)data.profile.weight=String(last.kg);',"data.profile.weight=last?String(last.kg):'';",'Letztes Gewicht entfernen')
 if app.count('10*1024*1024')!=2:raise RuntimeError('Erwartete zwei Backup-Größenprüfungen fehlen.')
 app=app.replace('10*1024*1024','32*1024*1024')
 app=patch_once(app,'bis 10 MB wählen.','bis 32 MB wählen.','Backup Hinweis')
 app=patch_once(app,"evidence:'evidence',weight:'weights',measurement:'measurements'","evidence:'evidence',weight:'weights',asthma:'asthmaLogs',measurement:'measurements'",'Löschen Asthma')
 app=patch_once(app,"for(const list of [x.measurements,x.labs,x.meds,x.weights||[],","for(const list of [x.measurements,x.labs,x.meds,x.weights||[],x.asthmaLogs||[],",'Backuptypen')
 app=patch_once(app,"if((x.weights!==undefined&&(!Array.isArray(x.weights)||x.weights.length>50000))","if((x.asthmaLogs!==undefined&&(!Array.isArray(x.asthmaLogs)||x.asthmaLogs.length>50000))||(x.weights!==undefined&&(!Array.isArray(x.weights)||x.weights.length>50000))",'Asthma Backup-Limit')
 validate="""if(x.asthmaLogs!==undefined&&!x.asthmaLogs.every(a=>a&&typeof a.id==='string'&&dateValid(a.date)&&timeValid(a.time)&&Number.isInteger(a.breathlessness)&&a.breathlessness>=0&&a.breathlessness<=10&&Number.isInteger(a.rescueUses)&&a.rescueUses>=0&&a.rescueUses<=50&&(a.peakFlow===null||(Number.isFinite(a.peakFlow)&&a.peakFlow>=50&&a.peakFlow<=1000))&&(a.fev1Pct===null||(Number.isFinite(a.fev1Pct)&&a.fev1Pct>=5&&a.fev1Pct<=140))&&Array.isArray(a.triggers)&&a.triggers.length<=7&&a.triggers.every(t=>Object.prototype.hasOwnProperty.call(ASTHMA_TRIGGERS,t))&&typeof a.note==='string'&&a.note.length<=1000))throw Error('Backup enthält ungültige Asthma-Einträge.');
 if(x.medStocks!==undefined&&(x.medStocks===null||typeof x.medStocks!=='object'||Array.isArray(x.medStocks)||Object.keys(x.medStocks).length>5000||!Object.values(x.medStocks).every(v=>v&&typeof v==='object'&&!Array.isArray(v)&&Number.isInteger(v.count)&&v.count>=0&&v.count<=100000&&Number.isInteger(v.min)&&v.min>=0&&v.min<=100000&&['Tabletten','Hübe','Ampullen','Stück'].includes(v.unit))))throw Error('Backup enthält ungültige Medikamentenvorräte.');
 """
 app=patch_once(app,"if(x.checks!==undefined&&(x.checks===null||typeof x.checks!=='object'||Array.isArray(x.checks)))",validate+"if(x.checks!==undefined&&(x.checks===null||typeof x.checks!=='object'||Array.isArray(x.checks)))",'Backup Datenvalidierung')
 submit="""if(form.id==='weight-goal-form'){
 const goal=String(f.get('goalWeightKg')||'').trim(),start=String(f.get('goalStartWeightKg')||'').trim(),date=String(f.get('goalDate')||'');
 for(const [name,raw] of [['Zielgewicht',goal],['Startgewicht',start]])if(raw!==''&&(!Number.isFinite(nval(raw))||nval(raw)<20||nval(raw)>400))throw Error(name+' muss zwischen 20 und 400 kg liegen.');
 if(date&&!dateValid(date))throw Error('Ungültiges Wunschdatum.');
 data.settings.goalWeightKg=goal;data.settings.goalStartWeightKg=start;data.settings.goalDate=date;await save();renderMain();toast('Gewichtsziel gespeichert.');return;
}
if(form.id==='asthma-form'){
 const date=String(f.get('date')||''),time=String(f.get('time')||''),entryId=String(f.get('id')||''),breathlessness=nval(f.get('breathlessness')),rescueUses=nval(f.get('rescueUses'));
 const pefRaw=String(f.get('peakFlow')||'').trim(),fevRaw=String(f.get('fev1Pct')||'').trim();
 const peakFlow=pefRaw===''?null:nval(pefRaw),fev1Pct=fevRaw===''?null:nval(fevRaw);
 if(!dateValid(date)||date>today()||!timeValid(time))throw Error('Datum oder Uhrzeit prüfen.');
 if(!Number.isInteger(breathlessness)||breathlessness<0||breathlessness>10||!Number.isInteger(rescueUses)||rescueUses<0||rescueUses>50)throw Error('Atemnot 0–10 und Bedarfsanwendungen 0–50 angeben.');
 if((peakFlow!==null&&(!Number.isInteger(peakFlow)||peakFlow<50||peakFlow>1000))||(fev1Pct!==null&&(!Number.isFinite(fev1Pct)||fev1Pct<5||fev1Pct>140)))throw Error('Peak-Flow bzw. FEV1 prüfen.');
 const triggers=f.getAll('trigger').map(String);if(!triggers.every(x=>Object.prototype.hasOwnProperty.call(ASTHMA_TRIGGERS,x)))throw Error('Ungültige Auslöserauswahl.');
 const entry={id:entryId||id(),date,time,breathlessness,rescueUses,peakFlow,fev1Pct,triggers:[...new Set(triggers)],note:String(f.get('note')||'').slice(0,1000)};
 const at=data.asthmaLogs.findIndex(x=>x.id===entryId);if(entryId&&at<0)throw Error('Asthma-Eintrag nicht gefunden.');
 if(at>=0)data.asthmaLogs[at]=entry;else data.asthmaLogs.push(entry);
 await save();renderMain();toast('Asthma-Eintrag gespeichert.');return;
}
if(form.id==='med-stock-form'){
 const medId=String(f.get('medId')||''),count=nval(f.get('count')),min=nval(f.get('min')),unit=String(f.get('unit')||'');
 if(!data.meds.some(m=>m.id===medId))throw Error('Medikament nicht gefunden.');
 if(!Number.isInteger(count)||count<0||count>100000||!Number.isInteger(min)||min<0||min>100000||!['Tabletten','Hübe','Ampullen','Stück'].includes(unit))throw Error('Vorrat und Grenzwert prüfen.');
 data.medStocks[medId]={count,min,unit,checkedAt:today()};await save();renderMain();toast('Medikamentenvorrat gespeichert.');return;
}
if(form.id==='measurement-reminder-form'){
 const date=String(f.get('date')||''),kind=String(f.get('kind')||''),valid=['Gewichtskontrolle','Blutdruckkontrolle','Blutzuckerkontrolle','Asthmakontrolle'];
 if(!dateValid(date)||!valid.includes(kind))throw Error('Datum und Art der Messung prüfen.');
 data.reminders.push({id:id(),date,kind,notes:String(f.get('notes')||'').slice(0,300),done:false});await save();renderMain();toast('Erinnerung eingetragen. iPhone-Kalenderexport ist im Erinnerungsbereich verfügbar.');return;
}
if(form.id==='doctor-report-form'){
 const from=String(f.get('from')||''),to=String(f.get('to')||''),parts=f.getAll('part').map(String);const allowed=['bp','glucose','weight','asthma','labs','meds'];
 if(!dateValid(from)||!dateValid(to)||from>to)throw Error('Berichtszeitraum prüfen.');
 if(!parts.length||!parts.every(x=>allowed.includes(x)))throw Error('Mindestens einen gültigen Berichtsteil auswählen.');
 reportChoice=Object.fromEntries(allowed.map(x=>[x,parts.includes(x)]));
 makePrint('Individueller Arztbericht',vkDoctorHtml(from,to,reportChoice));return;
}
"""
 app=patch_once(app,"if(!data)return;\n", "if(!data)return;\n"+submit, 'Neue Formulare')
 edits="""if(action==='edit-asthma'){
 const entry=(data.asthmaLogs||[]).find(x=>x.id===el.dataset.id),form=$('#asthma-form');if(!entry||!form)return;
 for(const name of ['id','date','time','breathlessness','rescueUses','peakFlow','fev1Pct','note'])form.elements[name].value=entry[name]??'';
 form.querySelectorAll('[name="trigger"]').forEach(c=>{c.checked=(entry.triggers||[]).includes(c.value)});
 form.scrollIntoView({behavior:'smooth',block:'start'});return;
}
"""
 app=patch_once(app,"if(action==='edit-weight'){",edits+"if(action==='edit-weight'){",'Bearbeiten Asthma')
 app=patch_once(app,"root.addEventListener('click',e=>{const navButton", "root.addEventListener('click',e=>{const point=e.target.closest('[data-chart-info]');if(point){toast(point.dataset.chartInfo||'Messwert');return}const navButton",'Interaktive Messpunkte')
 app=patch_once(app,"root.addEventListener('submit',handleSubmit);", "root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target?.matches?.('[data-chart-info]')){e.preventDefault();toast(e.target.dataset.chartInfo||'Messwert')}});\nroot.addEventListener('submit',handleSubmit);",'Diagramm Tastatur')
 app=patch_once(app,'r="4.4" fill="#098879"', 'r="4.4" tabindex="0" role="button" class="vk-chart-point" data-chart-info="${h(nf(r.kg,1)+\' kg · \'+fmtDate(r.date)+\' \'+r.time+\' · \'+(bpMealLabels[r.mealTiming]||\'\'))}" fill="#098879"','Gewicht Messpunkte')
 app=patch_once(app,'r="4.8" fill="${o.e.verified', 'r="4.8" tabindex="0" role="button" class="vk-chart-point" data-chart-info="${h(label+\' \'+nf(o.v,1)+\' · \'+fmtDate(o.e.date)+\' \'+o.e.time)}" fill="${o.e.verified','Übrige Diagrammpunkte')
 nav_html = """</main><nav class="vk-bottom-nav" aria-label="Schnellnavigation"><button type="button" data-view="start" aria-current="${view==='start'?'page':'false'}">Start</button><button type="button" data-view="weight" aria-current="${view==='weight'?'page':'false'}">Gewicht</button><button type="button" data-view="asthma" aria-current="${view==='asthma'?'page':'false'}">Asthma</button><button type="button" data-view="meds" aria-current="${view==='meds'?'page':'false'}">Medikamente</button><button type="button" data-view="stats" aria-current="${view==='stats'?'page':'false'}">Statistik</button></nav><footer class="foot">"""
 app=patch_once(app,'</main><footer class="foot">',nav_html,'iPhone Navigation')
 app=patch_once(app,"<h3>Blutzuckerverlauf</h3>${lineChart('glucose'", "<h3>Asthma-Dokumentation</h3>${vkAsthmaStats((data.asthmaLogs||[]).filter(x=>between(x,a,b)))}<h3>Blutzuckerverlauf</h3>${lineChart('glucose'",'Asthma Monats-Jahresbericht')
 app=patch_once(app,'Backup überprüft: ${restored.measurements.length} Blutdruck-/Blutzuckerwerte, ${(restored.weights||[]).length} Gewichtseinträge, ${restored.labs.length} Laborwerte.', 'Backup überprüft: ${restored.measurements.length} Blutdruck-/Blutzuckerwerte, ${(restored.weights||[]).length} Gewichtseinträge, ${(restored.asthmaLogs||[]).length} Asthma-Einträge, ${restored.labs.length} Laborwerte.','Backup-Status')
 app=patch_once(app,'Die Datei wird vor dem Import entschlüsselt und geprüft.', 'Die Datei wird vor dem Import entschlüsselt und geprüft (bis 32 MB).','Backup-Anzeige')
 # New sections are additive; no automatic app lock is added or altered.
 css=source['style.css']+'\n'+(BASE/'vk190_styles.css').read_text('utf-8')
 sw=source['sw.js'].replace('VitalKompass 1.8.4','VitalKompass 1.9.0').replace('vital-kompass-1.8.4-gewicht-backup','vital-kompass-1.9.0-komplett')
 ver=json.dumps({'version':'1.9.0','released':'2026-10-20','notes':'Gemeinsames Update aus 1.8.5 und 1.9.0: Backup-Reparatur, iPhone-Navigation, interaktive Messpunkte, Gewichtsziel, Asthma-Tagebuch, Messungserinnerungen/Kalender, Medikamentenvorrat, Zeitvergleich und Arztbericht. Keine automatische Sperre.'},ensure_ascii=False,indent=2)+'\n'
 # Strong guarantees: syntax and essential module checks performed before any output.
 if 'autoLock' in app or 'automaticLock' in app: raise RuntimeError('Unerwünschte automatische Sperre gefunden.')
 if 'function pageAsthma' not in app or 'function vkDoctorHtml' not in app:raise RuntimeError('Neue Module fehlen.')
 if sw==source['sw.js']:raise RuntimeError('Service-Worker-Cache nicht aktualisiert.')
 OUT.mkdir(parents=True,exist_ok=True)
 for name,content in [('app.js',app),('style.css',css),('sw.js',sw),('version.json',ver)]:
  (OUT/name).write_text(content,encoding='utf-8')
 subprocess.run(['node','--check',str(OUT/'app.js')],check=True)
 subprocess.run(['node','--check',str(OUT/'sw.js')],check=True)
 subprocess.run(['python3','-m','json.tool',str(OUT/'version.json')],check=True,stdout=subprocess.DEVNULL)
 print('VitalKompass 1.9.0 erfolgreich gebaut und auf JavaScript-Syntax geprüft:',OUT)

if __name__=='__main__':
 try:make()
 except Exception as e:
  print('UPDATE ABGEBROCHEN:',e,file=sys.stderr)
  raise SystemExit(1)
