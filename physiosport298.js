'use strict';
/* PhysioSport: extension for existing local encrypted Asthma 2.9.7 application.
   Personal medical data are NOT included in this public script. */
(()=>{
  const ID='physiosport298';
  const STATUS={offen:'Offen',erledigt:'Erledigt',abgesagt:'Abgesagt',verschoben:'Verschoben'};
  const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n};
  const isDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !Number.isNaN(+d)&&d.getFullYear()===+s.slice(0,4)&&d.getMonth()+1===+s.slice(5,7)&&d.getDate()===+s.slice(8,10)};
  const isTime=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const nice=s=>isDate(s)?s.slice(8)+'.'+s.slice(5,7)+'.'+s.slice(0,4):s;
  const textSafe=(s,n)=>String(s||'').slice(0,n);
  function validateTerm(p){
    if(!p||!isDate(p.date)||!isTime(p.time)||!Number.isInteger(p.durationMinutes)||p.durationMinutes<5||p.durationMinutes>240||typeof p.therapist!=='string'||!p.therapist.trim()||p.therapist.length>90)throw Error('Ungültige Termindaten');
    const status=STATUS[p.status]?p.status:'offen';
    const o={id:textSafe(p.id||'ps-'+p.date+'-'+p.time.replace(':',''),90),date:p.date,time:p.time,durationMinutes:p.durationMinutes,therapist:p.therapist.trim(),status,notes:textSafe(p.notes,1000),physioSport:true,type:'termin'};
    o.title='PhysioSport · KG · '+o.time+' · '+o.therapist+' · '+STATUS[o.status];
    return o;
  }
  function validateLung(x){
    if(!x||!isDate(x.date)||!['vor','nach','unbekannt'].includes(x.phase))throw Error('Ungültiges Lungenfunktionsdatum / Messphase');
    for(const [k,max] of [['fev1',200],['fvc',200],['fev1Liters',15],['fvcLiters',15],['ratio',120]])if(typeof x[k]!=='number'||!Number.isFinite(x[k])||x[k]<0||x[k]>max)throw Error('Ungültiger Messwert: '+k);
    if(!x.fvcLiters||x.fev1Liters>x.fvcLiters||Math.abs(100*x.fev1Liters/x.fvcLiters-x.ratio)>1.6)throw Error('FEV₁/FVC-Werte widersprüchlich');
    const extra={};
    for(const [k,v] of Object.entries(x.extra||{})){
      if(!/^[a-zA-Z][a-zA-Z0-9]{1,24}$/.test(k)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>300)throw Error('Ungültiger Zusatzwert: '+k);
      extra[k]=v;
    }
    return {id:'physiosport-lufu-'+x.date,date:x.date,phase:x.phase,source:'befundimport',fev1:x.fev1,fvc:x.fvc,fev1Liters:x.fev1Liters,fvcLiters:x.fvcLiters,ratio:x.ratio,extra,doctor:textSafe(x.doctor,120),note:textSafe(x.note,700),createdAt:new Date().toISOString()};
  }
  function styles(){if(document.getElementById('ps298-css'))return;const s=make('style');s.id='ps298-css';s.textContent=`
    .ps298-panel{border:1px solid #c6dde4;border-radius:18px;padding:16px;margin:18px 0;background:#f6fbfd;color:#173849}
    .ps298-panel h3{font-size:1.18rem;margin:0 0 6px}.ps298-hint{font-size:.89rem;color:#506974;line-height:1.5}
    .ps298-list{display:grid;gap:12px;margin-top:15px}.ps298-card{border:1px solid #d8e5e9;background:white;border-radius:12px;padding:13px;display:grid;gap:9px}
    .ps298-card[data-status="erledigt"]{border-left:5px solid #318253}.ps298-card[data-status="abgesagt"]{border-left:5px solid #bd5965}.ps298-card[data-status="verschoben"]{border-left:5px solid #d58f2c}
    .ps298-control,.ps298-fields{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
    .ps298-fields label{display:flex;flex-direction:column;gap:4px;min-width:110px;flex:1}
    .ps298-fields label.ps298-noteinput{flex-basis:100%}.ps298-fields input,.ps298-fields select,.ps298-fields textarea,.ps298-control select{max-width:100%;box-sizing:border-box;border:1px solid #a9c1cb;border-radius:8px;padding:9px;background:#fff;color:#173849;font:inherit}
    .ps298-control label{display:flex;gap:6px;align-items:center}.ps298-control label:first-child input{width:22px;height:22px}
    .ps298-fields textarea{min-height:64px;width:100%}.ps298-message{min-height:1.5em;font-size:.91rem}.ps298-report{background:white;border:1px solid #dae5e9;padding:12px;border-radius:12px;margin:12px 0}
    .ps298-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin-top:8px}
    .ps298-metric{border-radius:8px;background:#eaf3f5;padding:9px;font-size:.88rem;font-variant-numeric:tabular-nums}
    @media(max-width:580px){.ps298-panel{padding:12px}.ps298-fields label{flex-basis:calc(50% - 7px)}.ps298-fields label.ps298-noteinput{flex-basis:100%}}
  `;document.head.append(s)}
  function mount(){
    if(document.getElementById(ID)||!document.documentElement.classList.contains('app-unlocked'))return false;
    const S=window.ASTHMA_SECURITY,calendar=document.getElementById('kalender'),lung=document.getElementById('lungenwerte');
    if(!S?.state?.().unlocked||!calendar||!lung)return false;
    styles();
    const mkPanel=(host,id,title,description)=>{const p=make('section',undefined,'ps298-panel');p.id=id;p.append(make('h3',title),make('p',description,'ps298-hint'));const h=host.querySelector('.section-heading');if(h)h.after(p);else host.prepend(p);return p};
    const panel=mkPanel(calendar,ID,'PhysioSport – Krankengymnastik','Termine abhaken, als abgesagt oder verschoben markieren und Datum, Uhrzeit sowie Notizen ändern.');
    const report=mkPanel(lung,'ps298-lung','Zusätzliche Lungenfunktionswerte','VC, FVC, TLC, RV und PEF aus bestätigten Lungenfunktionsberichten.');
    const input=make('input');input.type='file';input.accept='.json,application/json';input.hidden=true;
    const btn=make('button','Private Termine und Befund importieren','btn btn-primary');btn.type='button';
    const btn2=make('button','Private Befunddatei importieren','btn btn-outline');btn2.type='button';
    const list=make('div',undefined,'ps298-list'),message=make('p','','ps298-message'),metrics=make('div');message.setAttribute('role','status');
    panel.append(btn,input,list,message);report.append(btn2,metrics,make('p','Importdateien sind unverschlüsselt; nach dem Import sicher aufbewahren oder löschen. In der App erfolgt die Speicherung im bestehenden verschlüsselten Tresor.','ps298-hint'));
    btn.addEventListener('click',()=>input.click());btn2.addEventListener('click',()=>input.click());
    const say=t=>{message.textContent=t};
    async function refresh(){
      const [all,values]=await Promise.all([S.list('calendar'),S.list('suite')]);
      const terms=all.filter(x=>x.physioSport===true).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
      list.replaceChildren();
      if(!terms.length)list.append(make('p','Noch keine Termine gespeichert. Bitte die private JSON-Importdatei wählen.','ps298-hint'));
      else{list.append(make('p',terms.filter(x=>x.status==='erledigt').length+' von '+terms.length+' erledigt','ps298-hint'));terms.forEach(x=>list.append(card(x)))}
      const lungs=values.filter(x=>x.type==='measurements'&&x.value?.extra&&Object.keys(x.value.extra).length).map(x=>x.value).sort((a,b)=>b.date.localeCompare(a.date));
      metrics.replaceChildren();
      if(!lungs.length)metrics.append(make('p','Noch keine zusätzlichen Lungenwerte importiert.','ps298-hint'));
      for(const x of lungs){
        const a=make('article',undefined,'ps298-report');a.append(make('strong',nice(x.date)+' · '+(x.doctor||'Lungenfunktionsuntersuchung')));
        const rows=[['FEV₁',x.fev1Liters,'l',x.fev1],['FVC (Ausatmung)',x.fvcLiters,'l',x.fvc],['FEV₁/FVC',x.ratio,'%',null],['VC',x.extra.vcLiters,'l',x.extra.vcPercent],['FVC (Einatmung)',x.extra.fvcInLiters,'l',x.extra.fvcInPercent],['TLC',x.extra.tlcLiters,'l',x.extra.tlcPercent],['RV',x.extra.rvLiters,'l',x.extra.rvPercent],['RV/TLC',x.extra.rvTlcPercent,'%',null],['TGV',x.extra.tgvLiters,'l',x.extra.tgvPercent],['PEF',x.extra.pefLps,'l/s',x.extra.pefPercent]];
        const grid=make('div',undefined,'ps298-metrics');
        for(const [n,v,u,pct] of rows){if(!Number.isFinite(v))continue;grid.append(make('div',n+': '+v.toLocaleString('de-DE',{maximumFractionDigits:2})+' '+u+(Number.isFinite(pct)?' · '+pct+' % Soll':''),'ps298-metric'))}
        a.append(grid);if(x.note)a.append(make('p',x.note,'ps298-hint'));metrics.append(a);
      }
    }
    async function save(x,change){const p=validateTerm({...x,...change,id:x.id});await S.put('calendar',p);await refresh();say('Änderung verschlüsselt gespeichert.');}
    function card(p){
      const a=make('article',undefined,'ps298-card');a.dataset.status=p.status;
      a.append(make('strong',nice(p.date)+' · '+p.time+' Uhr · '+p.durationMinutes+' Minuten · '+p.therapist));
      const control=make('div',undefined,'ps298-control'),checkLabel=make('label','Erledigt'),check=make('input');check.type='checkbox';check.checked=p.status==='erledigt';checkLabel.prepend(check);
      const selLabel=make('label','Status '),sel=make('select');for(const [k,n] of Object.entries(STATUS)){const opt=make('option',n);opt.value=k;sel.append(opt)}sel.value=p.status;selLabel.append(sel);control.append(checkLabel,selLabel);a.append(control);
      const fields=make('div',undefined,'ps298-fields');
      const dl=make('label','Datum '),d=make('input');d.type='date';d.value=p.date;dl.append(d);
      const tl=make('label','Uhrzeit '),t=make('input');t.type='time';t.value=p.time;tl.append(t);
      const nl=make('label','Notizen ', 'ps298-noteinput'),n=make('textarea');n.value=p.notes||'';n.rows=2;n.maxLength=1000;n.placeholder='Behandlung, Beschwerden, Absagegrund ...';nl.append(n);
      const sb=make('button','Änderungen speichern','btn btn-outline');sb.type='button';fields.append(dl,tl,nl,sb);a.append(fields);
      const change=async value=>{check.disabled=sel.disabled=true;try{await save(p,{status:value,notes:n.value})}catch(e){say('Speichern fehlgeschlagen: '+e.message);check.disabled=sel.disabled=false;check.checked=p.status==='erledigt';sel.value=p.status}};
      check.addEventListener('change',()=>change(check.checked?'erledigt':'offen'));sel.addEventListener('change',()=>change(sel.value));
      sb.addEventListener('click',async()=>{sb.disabled=true;try{await save(p,{date:d.value,time:t.value,status:sel.value,notes:n.value})}catch(e){say('Speichern fehlgeschlagen: '+e.message);sb.disabled=false}});
      return a;
    }
    async function importJSON(file){
      if(file.size>128000)throw Error('Datei zu groß (maximal 128 KB)');
      const obj=JSON.parse(await file.text());
      if(obj?.format!=='Asthma-PhysioSport-Import'||obj.schema!==1||!Array.isArray(obj.physio)||obj.physio.length>100)throw Error('Unbekanntes Importformat');
      const terms=obj.physio.map(validateTerm),lung=obj.lungenfunktion?validateLung(obj.lungenfunktion):null;
      if(!terms.length&&!lung)throw Error('Keine Importdaten');
      if(new Set(terms.map(x=>x.id)).size!==terms.length)throw Error('Doppelte Termin-IDs');
      if(!confirm(terms.length+' Termine'+(lung?' und einen Lungenbefund':'')+' in den verschlüsselten App-Tresor übernehmen? Vorhandene Werte und Notizen bleiben erhalten.'))return;
      const [old,measurements]=await Promise.all([S.list('calendar'),S.list('suite')]);
      let added=0,addedLung=0,skipped=0;
      for(const t of terms){if(old.some(x=>x.id===t.id||(x.physioSport===true&&x.date===t.date&&x.time===t.time))){skipped++;continue}await S.put('calendar',t);added++;}
      if(lung){if(measurements.some(x=>x.type==='measurements'&&(x.value?.id===lung.id||(x.value?.date===lung.date&&x.value?.fev1Liters===lung.fev1Liters&&x.value?.fvcLiters===lung.fvcLiters))))skipped++;
        else{await S.put('suite',{key:'measurements/'+lung.id,type:'measurements',value:lung},'measurements/'+lung.id);addedLung++;}
        // Only update the quick overview when this is newer than its current value.
        const bridge=window.ASTHMA_PROFILE_BRIDGE;
        if(bridge?.get&&bridge?.setLung){const prior=bridge.get();if(!prior.lungDate||prior.lungDate<=lung.date)bridge.setLung({...prior,lungDate:lung.date,fev1:lung.fev1,fvc:lung.fvc,fev1Liters:lung.fev1Liters,fvcLiters:lung.fvcLiters});}
      }
      await refresh();say(added+' Termine und '+addedLung+' Befund neu importiert; '+skipped+' bereits vorhandene Einträge nicht überschrieben.');
    }
    input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{say('Importdatei wird geprüft ...');await importJSON(file)}catch(e){say('Import fehlgeschlagen: '+(e.message||e))}finally{input.value=''}});
    let scheduled=false;
    window.addEventListener('asthma:secure-change',event=>{if(!['calendar','suite'].includes(event.detail?.group)||scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;refresh().catch(e=>say(e.message))})});
    refresh().catch(e=>say('Daten konnten nicht gelesen werden: '+e.message));
    window.__PHYSIOSPORT298_TEST=Object.freeze({isDate,isTime,validateTerm,validateLung});
    return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  function boot(){
    if(mount())return;
    const obs=new MutationObserver(()=>{if(mount())obs.disconnect()});
    obs.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  }
})();
