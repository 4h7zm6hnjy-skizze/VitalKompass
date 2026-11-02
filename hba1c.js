/* VitalKompass 2.0.11 – HbA1c-Verlauf. Lokal, ohne Speicherung oder Netzwerkzugriff. */
(function () {
  'use strict';
  let activePeriod = 'month';
  let currentWindow = 90;
  const windows=[30,60,90];
  const thresholds={30:{count:14,days:7,span:14},60:{count:20,days:10,span:28},90:{count:30,days:14,span:45}};
  function windowButtons(){return `<div class="vk214-window-select" role="group" aria-label="Berechnungszeitraum">${windows.map(n=>`<button type="button" data-hb-window="${n}" aria-pressed="${currentWindow===n}">${n} Tage</button>`).join('')}</div>`;}

  let currentData = null;
  const periods = [['day','Tag'],['7d','7 Tage'],['week','Woche'],['month','Monat'],['year','Jahr'],['10y','10 Jahre']];
  function esc(x) {return String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmt(n,decimals=0) {return Number.isFinite(n)?n.toLocaleString('de-DE',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}):'–';}
  function validDate(d) {if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d)))return false;const dt=new Date(d+'T12:00:00Z');return !isNaN(dt.getTime())&&dt.toISOString().slice(0,10)===d;}
  function addDays(d,n) {return new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
  function dateDE(d) {return validDate(d)?`${d.slice(8,10)}.${d.slice(5,7)}.${d.slice(0,4)}`:'–';}
  function localToday() {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function mean(rows) {return rows.length?rows.reduce((sum,x)=>sum+x.mgdl,0)/rows.length:NaN;}
  function readings(data) {
    const today=localToday();
    return (Array.isArray(data?.measurements)?data.measurements:[])
      .filter(r=>r&&r.type==='glucose'&&r.verified===true&&validDate(r.date)&&r.date<=today&&Number.isFinite(Number(r.mgdl))&&Number(r.mgdl)>0&&Number(r.mgdl)<=999)
      .map(r=>({date:r.date,time:/^\d{2}:\d{2}$/.test(r.time||'')?r.time:'00:00',mgdl:Number(r.mgdl),period:r.period||'other'}))
      .sort((a,b)=>(a.date+'T'+a.time).localeCompare(b.date+'T'+b.time));
  }
  function rolling(all,endDate,windowDays=currentWindow) {
    if(!validDate(endDate))return {count:0,days:0,span:0,mean:NaN,est:NaN,eligible:false,start:'',end:''};
    const daysWindow=windows.includes(windowDays)?windowDays:90;
    const start=addDays(endDate,1-daysWindow);
    const selected=all.filter(r=>r.date>=start&&r.date<=endDate);
    const days=new Set(selected.map(x=>x.date)).size;
    const span=selected.length?Math.round((Date.parse(selected[selected.length-1].date+'T12:00:00Z')-Date.parse(selected[0].date+'T12:00:00Z'))/86400000)+1:0;
    const avg=mean(selected);
    // Nicht klinisch validierte, bewusst vorsichtige Mindestdatenregel.
    const rules=thresholds[daysWindow];
    const eligible=selected.length>=rules.count&&days>=rules.days&&span>=rules.span;
    return {start,end:endDate,count:selected.length,days,span,mean:avg,est:eligible?(avg+46.7)/28.7:NaN,eligible};
  }
  function classify(calc) {
    if(!calc.eligible)return {level:'gray',label:'Datenlage unzureichend'};
    if(calc.est<5.7)return {level:'green',label:'Grüner Orientierungsbereich'};
    if(calc.est<6.5)return {level:'yellow',label:'Gelber Orientierungsbereich'};
    return {level:'red',label:'Roter Orientierungsbereich'};
  }
  function latestLab(data) {
    const rows=(Array.isArray(data?.labs)?data.labs:[]).filter(l=>l&&l.verified===true&&validDate(l.date)&&l.date<=localToday()&&(l.name==='HbA1c (NGSP)'||l.name==='HbA1c (IFCC)')&&!l.comparator&&Number.isFinite(Number(String(l.value).replace(',','.'))))
      .map(l=>{const raw=Number(String(l.value).replace(',','.'));const pct=l.name==='HbA1c (IFCC)'?raw*0.09148+2.152:raw;return {date:l.date,pct,raw,kind:l.name};})
      .filter(l=>l.pct>=3&&l.pct<=20);
    rows.sort((a,b)=>a.date.localeCompare(b.date)||(a.kind==='HbA1c (NGSP)'?-1:1));
    return rows.at(-1)||null;
  }
  function homeCard(data) {
    const all=readings(data),rec=all.length?rolling(all,all.at(-1).date):rolling([],''),state=classify(rec),lab=latestLab(data);
    currentData=data;
    return `<div class="metric vk-hba-card vk-hba-${state.level}"><span>HbA1c-Äquivalent · ${currentWindow} Tage</span><strong>${rec.eligible?fmt(rec.est,1)+' %':'–'}</strong><small>Geschätzter Wert · ${all.length?dateDE(rec.start)+' – '+dateDE(rec.end):'keine bestätigten Messungen'}</small>${windowButtons()}<div class="vk-hba-status"><i aria-hidden="true"></i>${esc(state.label)}</div>${lab?`<small><b>Laborwert:</b> ${fmt(lab.pct,1)} % (${dateDE(lab.date)})</small>`:''}<button type="button" class="vk-hba-button" data-view="hba1c">Diagramm &amp; Tabelle öffnen</button></div>`;
  }
  function groups(all,period,anchor) {
    if(!all.length||!validDate(anchor))return [];
    let first=anchor;
    if(period==='7d')first=addDays(anchor,-6);
    else if(period==='week')first=addDays(anchor,-((new Date(anchor+'T12:00:00Z').getUTCDay()+6)%7));
    else if(period==='month')first=anchor.slice(0,7)+'-01';
    else if(period==='year')first=anchor.slice(0,4)+'-01-01';
    else if(period==='10y')first=(Number(anchor.slice(0,4))-9)+'-01-01';
    const selected=all.filter(r=>r.date>=first&&r.date<=anchor),map=new Map();
    for(const r of selected) {
      const key=period==='day'?r.time.slice(0,2)+':00':period==='year'?r.date.slice(0,7):period==='10y'?r.date.slice(0,4):r.date;
      const label=period==='day'?key:period==='year'?r.date.slice(5,7)+'.'+r.date.slice(0,4):period==='10y'?key:r.date.slice(8,10)+'.'+r.date.slice(5,7);
      if(!map.has(key))map.set(key,{key,label,rows:[],endDate:r.date});
      map.get(key).rows.push(r);map.get(key).endDate=r.date;
    }
    return [...map.values()].sort((a,b)=>a.key.localeCompare(b.key))
      .map(g=>({key:g.key,label:g.label,count:g.rows.length,average:mean(g.rows),rolling:rolling(all,g.endDate),endDate:g.endDate}));
  }
  function chart(groups,kind) {
    const rows=groups.filter(g=>Number.isFinite(kind==='hba'?g.rolling.est:g.average));
    if(!rows.length)return '<p class="vk-hba-empty">Keine ausreichenden Messdaten in diesem Zeitraum.</p>';
    const width=Math.max(580,rows.length*57+82),height=255,left=56,right=24,top=24,bottom=55;
    const plotW=width-left-right,plotH=height-top-bottom;
    const values=rows.map(g=>kind==='hba'?g.rolling.est:g.average);
    const min=Math.min(...values),max=Math.max(...values),pad=Math.max(kind==='hba'?0.25:8,(max-min)*0.18);
    const low=Math.max(0,min-pad),high=max+pad;
    const x=i=>left+(rows.length===1?plotW/2:i*plotW/(rows.length-1));
    const y=v=>top+(high-v)/(high-low)*plotH;
    const grid=[0,1,2,3,4].map(i=>{const yy=top+i*plotH/4,v=high-i*(high-low)/4;return `<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="#dce7ec"/><text x="${left-9}" y="${yy+4}" text-anchor="end" font-size="12" fill="#52677b">${fmt(v,kind==='hba'?1:0)}</text>`}).join('');
    const path=rows.map((r,i)=>x(i)+','+y(values[i])).join(' ');
    const labelEvery=Math.max(1,Math.ceil(rows.length/10));
    const marks=rows.map((g,i)=>{
      const value=values[i],color=kind==='hba'?({green:'#11835f',yellow:'#c1840b',red:'#c33242',gray:'#718395'})[classify(g.rolling).level]:'#14798b';
      return `<circle cx="${x(i)}" cy="${y(value)}" r="5" fill="${color}" stroke="white" stroke-width="2"><title>${esc(g.label+' · '+fmt(value,kind==='hba'?1:0)+(kind==='hba'?' % (nur geschätzt)':' mg/dl')+' · '+g.count+' Messungen')}</title></circle>${(i%labelEvery===0||i===rows.length-1)?`<text x="${x(i)}" y="${height-20}" text-anchor="middle" font-size="11" fill="#426274">${esc(g.label)}</text>`:''}`;
    }).join('');
    return `<div class="vk-hba-chart-scroll" role="region" aria-label="Diagramm horizontal scrollbar" tabindex="0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${kind==='hba'?'Geschätztes HbA1c-Äquivalent in Prozent':'Blutzuckerdurchschnitt in mg/dl'}"><rect width="${width}" height="${height}" fill="#f8fbfd" rx="12"/>${grid}<polyline points="${path}" fill="none" stroke="#14798b" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${marks}</svg></div>`;
  }
  function summary(data,all) {
    if(!all.length){const lab=latestLab(data);return '<div class="vk-hba-note">Noch keine bestätigten Blutzuckermessungen vorhanden. Ungeprüfte Importe werden erst nach Bestätigung berücksichtigt.</div>'+(lab?`<p class="vk-hba-lab">Bestätigter <strong>Labor-HbA1c</strong>: ${fmt(lab.pct,1)} % vom ${dateDE(lab.date)}. Dieser Laborwert wird nicht mit unzureichenden Einzelmessungen vermischt.</p>`:'');}
    const rec=rolling(all,all.at(-1).date),state=classify(rec),lab=latestLab(data);
    const unchecked=(Array.isArray(data?.measurements)?data.measurements:[]).filter(r=>r?.type==='glucose'&&r.verified!==true).length;
    let html=`<div class="vk-hba-summary"><div><small>Ø Blutzucker · ${currentWindow} Tage</small><strong>${fmt(rec.mean,0)} <span>mg/dl</span></strong></div><div><small>HbA1c, nur geschätzt</small><strong>${rec.eligible?fmt(rec.est,1)+' %':'–'}</strong></div><div><small>Messungen / Messtage</small><strong>${rec.count} / ${rec.days}</strong></div></div><div class="vk-hba-status vk-hba-${state.level}"><i aria-hidden="true"></i>${esc(state.label)}</div><p class="section-note">Auswertung ${dateDE(rec.start)} bis ${dateDE(rec.end)} – ${currentWindow} Kalendertage, rückwärts von der neuesten bestätigten Messung. Neue Messungen oder Laborwerte werden beim Speichern automatisch neu eingelesen.</p>`;
    if(!rec.eligible){const rule=thresholds[currentWindow];html+=`<p class="vk-hba-note">Für die ${currentWindow}-Tage-Auswertung fehlen ausreichende Daten. Technische Mindestregel: ${rule.count} bestätigte Messungen, ${rule.days} Messtage und eine Messspanne von mindestens ${rule.span} Tagen. Diese Auswahl ist kein klinisch validiertes Verfahren zur Bestimmung des HbA1c.</p>`;}
    if(unchecked)html+=`<p class="vk-hba-note">${unchecked} ungeprüfte Blutzuckerwerte ausgeschlossen – bitte mit der Originalmessung abgleichen und bestätigen.</p>`;
    html+=lab?`<p class="vk-hba-lab">Bestätigter <strong>Labor-HbA1c</strong>: ${fmt(lab.pct,1)} % vom ${dateDE(lab.date)}${lab.kind==='HbA1c (IFCC)'?' (aus mmol/mol umgerechnet)':''}.</p>`:'<p class="vk-hba-lab">Kein bestätigter Labor-HbA1c hinterlegt. Die Berechnung aus einzelnen Blutzuckerwerten ersetzt keine HbA1c-Laborbestimmung.</p>';
    return html;
  }
  function detail(data) {
    const all=readings(data),anchor=all.length?all.at(-1).date:'',items=groups(all,activePeriod,anchor);
    const buttons=periods.map(([key,label])=>`<button type="button" data-hb-period="${key}" aria-pressed="${activePeriod===key?'true':'false'}">${label}</button>`).join('');
    const rows=items.map(g=>{const st=classify(g.rolling);return `<tr><td>${esc(g.label)}</td><td>${fmt(g.average,0)} mg/dl</td><td>${g.count}</td><td>${g.rolling.eligible?fmt(g.rolling.est,1)+' %':'–'}</td><td><span class="vk-hba-table-status vk-hba-${st.level}">${esc(st.label)}</span></td></tr>`}).join('');
    return summary(data,all)+windowButtons()+`<div class="vk-hba-picker" aria-label="Diagrammzeitraum">${buttons}</div><h3>Blutzucker-Durchschnitt</h3>${chart(items,'glucose')}<h3>HbA1c-Äquivalent: rollierende ${currentWindow} Tage</h3>${chart(items,'hba')}<h3>Langzeitblutzucker-Tabelle</h3><div class="table-wrap vk-hba-table"><table><thead><tr><th>Zeitraum</th><th>Ø Blutzucker</th><th>Messungen</th><th>Grobe Schätzung (${currentWindow} T.)</th><th>Ampel</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Keine bestätigten Messwerte für den ausgewählten Zeitraum.</td></tr>'}</tbody></table></div><p class="section-note">Jeder HbA1c-Datenpunkt verwendet ausschließlich die ${currentWindow} Kalendertage vor und einschließlich des letzten Messdatums des jeweiligen Punktes. Die Einstellung Tag/7 Tage/Woche/Monat zeigt feinere Zeiträume, Jahr fasst nach Monaten und 10 Jahre nach Jahren zusammen. Keine aufgefüllten oder erfundenen Messungen.</p><p class="vk-hba-caution"><b>Medizinischer Hinweis:</b> Die grobe Umrechnung (Ø mg/dl + 46,7) / 28,7 folgt der ADAG-Gleichung. Einzelne Fingerpiksmessungen sind oft zeitlich und nach Mahlzeiten verzerrt; der Rechenwert ist <b>kein verlässlicher Labor-HbA1c und keine Diagnose</b>. Ampelbereiche: unter 5,7 % grün, 5,7 bis unter 6,5 % gelb, ab 6,5 % rot – nur allgemein, nicht für individuelle Diabetes-Therapieziele. Bei unzureichenden Daten bleibt die Ampel grau.</p>`;
  }
  function page(data) {
    currentData=data;
    return `<div class="heading-row"><div><div class="kicker">VITALKOMPASS</div><h1>HbA1c &amp; Langzeitblutzucker</h1><p class="section-note">Automatische Auswertung bestätigter Messungen, ohne Datenweitergabe.</p></div></div><section class="panel" id="vk-hba-detail">${detail(data)}</section>`;
  }
  document.addEventListener('click',e=>{
    const w=e.target.closest?.('[data-hb-window]');
    if(w&&currentData){const value=Number(w.dataset.hbWindow);if(!windows.includes(value))return;currentWindow=value;const home=document.querySelector('.vk-hba-card');if(home)home.outerHTML=homeCard(currentData);const host=document.querySelector('#vk-hba-detail');if(host)host.innerHTML=detail(currentData);return;}
    const el=e.target.closest?.('[data-hb-period]');if(!el||!currentData)return;
    const selected=el.dataset.hbPeriod;if(!periods.some(p=>p[0]===selected))return;
    activePeriod=selected;const host=document.querySelector('#vk-hba-detail');if(host)host.innerHTML=detail(currentData);
  });
  window.VK_HBA1C={homeCard,page,readings,rolling,groups,latestLab,selectWindow:(n)=>{if(windows.includes(Number(n)))currentWindow=Number(n)},getWindow:()=>currentWindow};
})();
