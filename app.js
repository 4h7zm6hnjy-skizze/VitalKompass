/* VitalKompass v1.9.7 — lokal, keine externen Bibliotheken, keine Analytics */
'use strict';
(() => {
const VERSION='2.0.8', DB='vitalkompass-secure-v1', STORE='safe', KEY='vault';
const root=document.getElementById('root');
const $=(q,scope=document)=>scope.querySelector(q);
const $$=(q,scope=document)=>Array.from(scope.querySelectorAll(q));
const today=()=>new Date().toLocaleDateString('sv-SE');
const nowTime=()=>new Date().toTimeString().slice(0,5);
const id=()=>globalThis.crypto?.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>{if(!v)return '–';const str=String(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(str))return h(str);const [y,m,d]=str.split('-');return `${d}.${m}.${y}`};
const nval=v=>{if(v===null||v===undefined||v==='')return NaN;return Number(String(v).replace(',','.'))};
const nf=(v,d=0)=>Number.isFinite(v)?Number(v).toLocaleString('de-DE',{maximumFractionDigits:d,minimumFractionDigits:0}):'–';
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
const sortdate=(a,b)=>`${a.date||''}T${a.time||''}`.localeCompare(`${b.date||''}T${b.time||''}`);
const clone=v=>JSON.parse(JSON.stringify(v));
const canUseCrypto=!!(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
let data=null, key=null, db=null, view='start', chartWindow='month', reportPeriod='month', reportMonth=today().slice(0,7), reportYear=Number(today().slice(0,4)), analysisDays='90', pendingUpdate=false, labQuery='', labDraft={}, labDate='', labPlace='';
let saveQueue=Promise.resolve();
let bridgePreview=null;
let lastPDFUrl=null,lastPDFBlob=null,lastPDFName='';
let stagedBackupFile=null;
let vkApprovedUpdateReload=false; // Nur nach ausdruecklichem Tippen auf Update installieren.
const colors={fasting:'#1b6fb3',before:'#7c53a5',after:'#de672f',other:'#12876e',sys:'#bd293e',dia:'#245dba',pulse:'#ba7b0b'};
const gLabels={fasting:'Nüchtern',before:'Vor dem Essen',after:'Nach dem Essen',other:'Sonstige'};
const levelColors={low:'#3667c8',good:'#16805d',high:'#cb821c',critical:'#c22842'};
const bpMealLabels={unknown:'Keine Angabe',before_breakfast:'Vor dem Frühstück',after_breakfast:'Nach dem Frühstück',before_lunch:'Vor dem Mittagessen',after_lunch:'Nach dem Mittagessen',before_dinner:'Vor dem Abendessen',after_dinner:'Nach dem Abendessen'};
const LABS=[
 ['Blutzucker & Diabetes', [['Glukose nüchtern','mg/dl'],['Glukose im Serum (Nüchternstatus unklar)','mg/dl'],['Glukose nach dem Essen','mg/dl'],['HbA1c (NGSP)','%'],['HbA1c (IFCC)','mmol/mol'],['Fruktosamin','µmol/l'],['Insulin nüchtern','µIU/ml'],['C-Peptid','ng/ml'],['HOMA-IR',''],['Ketone (Blut)','mmol/l'],['Beta-Hydroxybutyrat','mmol/l']]],
 ['Prostata & Urologie', [['PSA gesamt','ng/ml'],['PSA frei','ng/ml'],['PSA frei/gesamt','%'],['PAP (prostataspezifische saure Phosphatase)','U/l'],['Testosteron gesamt','ng/ml'],['Testosteron frei','pg/ml'],['SHBG','nmol/l'],['Kreatinin (Urin)','mg/dl'],['Albumin (Urin)','mg/l'],['Albumin/Kreatinin-Quotient','mg/g']]],
 ['Eisen, Vitamine & Spurenelemente', [['Eisen','µg/dl'],['Ferritin','ng/ml'],['Transferrin','g/l'],['Transferrinsättigung','%'],['Löslicher Transferrinrezeptor','mg/l'],['Vitamin B12','pg/ml'],['Holo-Transcobalamin','pmol/l'],['Folat','ng/ml'],['Vitamin D (25-OH)','ng/ml'],['Magnesium','mmol/l'],['Zink','µg/dl'],['Kupfer','µg/dl'],['Selen','µg/l']]],
 ['Kleines & großes Blutbild', [['Hämoglobin','g/dl'],['Hämatokrit','%'],['Erythrozyten','Mio./µl'],['Leukozyten','/nl'],['Thrombozyten','/nl'],['MCV','fl'],['MCH','pg'],['MCHC','g/dl'],['RDW','%'],['Retikulozyten','%'],['Neutrophile','%'],['Lymphozyten','%'],['Monozyten','%'],['Eosinophile','%'],['Basophile','%']]],
 ['Nieren, Harnsäure & Elektrolyte', [['Kreatinin','mg/dl'],['eGFR (CKD-EPI)','ml/min/1,73m²'],['Harnstoff','mg/dl'],['Harnsäure','mg/dl'],['Natrium','mmol/l'],['Kalium','mmol/l'],['Chlorid','mmol/l'],['Calcium gesamt','mmol/l'],['Calcium ionisiert','mmol/l'],['Phosphat','mmol/l'],['Bicarbonat','mmol/l'],['Cystatin C','mg/l']]],
 ['Fettstoffwechsel & Herz', [['Gesamtcholesterin','mg/dl'],['LDL-Cholesterin','mg/dl'],['HDL-Cholesterin','mg/dl'],['Non-HDL-Cholesterin','mg/dl'],['Triglyzeride','mg/dl'],['Lipoprotein(a)','nmol/l'],['Apolipoprotein B','mg/dl'],['NT-proBNP','pg/ml'],['Troponin','ng/l']]],
 ['Leber, Pankreas & Eiweiß', [['GOT (AST)','U/l'],['GPT (ALT)','U/l'],['Gamma-GT','U/l'],['Alkalische Phosphatase','U/l'],['Bilirubin gesamt','mg/dl'],['Bilirubin direkt','mg/dl'],['Albumin','g/dl'],['Gesamteiweiß','g/dl'],['Lipase','U/l'],['Amylase','U/l'],['LDH','U/l'],['CK','U/l'],['Cholinesterase','kU/l']]],
 ['Schilddrüse & Hormone', [['TSH','mIU/l'],['fT3','pg/ml'],['fT4','ng/dl'],['TPO-Antikörper','IU/ml'],['TRAK','IU/l'],['Cortisol','µg/dl'],['PTH','pg/ml']]],
 ['Entzündung, Gerinnung & Sonstiges', [['CRP','mg/l'],['hs-CRP','mg/l'],['BSG nach 1 h','mm'],['Procalcitonin','ng/ml'],['Rheumafaktor (RF-IgM)','IU/ml'],['Borrelia burgdorferi IgG','U/ml'],['Borrelia burgdorferi IgM','Index'],['INR',''],['Quick','%'],['aPTT','s'],['Fibrinogen','g/l'],['D-Dimere','mg/l FEU'],['Homocystein','µmol/l'],['HIV-Test',''],['Hepatitis-B-Oberflächenantigen','']]],
 ['Urinstatus', [['Glukose (Urin)','mg/dl'],['Ketone (Urin)','mg/dl'],['Protein (Urin)','mg/dl'],['pH (Urin)',''],['Spezifisches Gewicht (Urin)',''],['Leukozyten (Urin)','/µl'],['Erythrozyten (Urin)','/µl'],['Nitrit (Urin)',''],['Urin-Albumin/Kreatinin','mg/g']]]
];
const LABCATALOG=LABS.flatMap(([g,items])=>items.map(([name,unit])=>({group:g,name,unit})));
const RISKS=[
 {level:'danger',title:'Dokumentierte Allergien / Unverträglichkeiten',text:'Vor jeder Arzneimittelgabe die im privaten Notfallpass gespeicherten Allergien und Unverträglichkeiten prüfen. Nicht eigenständig Medikamente einnehmen, die dort als unverträglich dokumentiert sind. Stoffliste medizinisch abklären.',link:''},
 {level:'danger',title:'Allopurinol mit Azathioprin / Mercaptopurin',text:'Die Kombination kann zu lebensbedrohlicher Knochenmarksuppression führen; in der Fachinformation wird die gleichzeitige Anwendung grundsätzlich zu vermeiden empfohlen. Ausnahmen nur mit ärztlich festgelegter, stark reduzierter Dosis und strenger Blutbildkontrolle.',link:'https://www.fachinfo.de/fi/pdf/000521/allopurinol-abz-100-300-mg-tabletten'},
 {level:'warn',title:'Metformin + Torasemid',text:'Bei Austrocknung oder nachlassender Nierenfunktion erhöht sich das Risiko einer Metformin-Anreicherung bis zur seltenen Laktatazidose. Nierenwerte/eGFR kontrollieren; bei Erbrechen, Durchfall, Fieber oder Flüssigkeitsmangel ärztliche Sick-Day-Regeln erfragen.',link:'https://www.fachinfo.de/fi/detail/023514/siofor-xr-750-mg-retardtabletten'},
 {level:'warn',title:'Torasemid + Foster/Salbutamol',text:'Torasemid und Beta-2-Sympathomimetika können einen niedrigen Kaliumwert begünstigen. Bei Herzrasen, Muskelschwäche oder Krämpfen ärztlich prüfen; Kaliumwerte kontrollieren.',link:'https://www.fachinfo.de/fi/detail/020889/foster-r-nexthaler-r-200-mikrogramm-6-mikrogramm-pro-inhalation'},
 {level:'warn',title:'Torasemid + Alfuzosin',text:'Beide Mittel können einen Blutdruckabfall oder Schwindel begünstigen. Besonders beim Aufstehen auf Sturzrisiko achten; Medikation ärztlich prüfen.',link:''},
 {level:'warn',title:'Metformin + jodhaltiges Kontrastmittel',text:'Bei bestimmten Untersuchungen kann eine zeitweise Metformin-Pause erforderlich sein; das entscheidet das Behandlungsteam je nach Nierenfunktion und Untersuchungsart. Vor CT/Angiografie Metformin ausdrücklich angeben.',link:'https://www.fachinfo.de/fi/detail/023514/siofor-xr-750-mg-retardtabletten'},
 {level:'warn',title:'Formoline L112 und andere Arzneimittel',text:'Bei gleichzeitig eingenommenen Medikamenten mögliche Beeinträchtigung der Aufnahme berücksichtigen; zeitlichen Abstand mit Apotheke oder Herstellerhinweisen abklären. Exakte Mindestabstände sind hier nicht verifiziert.',link:''}
];
const MEDINFO=[
 ['Metformin','Magen-Darm-Beschwerden, Übelkeit, Durchfall; langfristig Vitamin-B12-Mangel möglich. Selten: Laktatazidose vor allem bei akuter Nierenstörung / schwerer Dehydrierung.','https://www.fachinfo.de/fi/detail/023514/siofor-xr-750-mg-retardtabletten'],
 ['Torasemid','Häufigeres Wasserlassen, Flüssigkeitsmangel, Elektrolytverluste (z. B. Kalium/Natrium), niedriger Blutdruck, Schwindel.',''],
 ['Alfuzosin','Schwindel, Kopfschmerz, Blutdruckabfall vor allem beim Aufstehen; selten Ohnmacht. Bei zusätzlichen Blutdrucksenkern Vorsicht.',''],
 ['Formoline L112','Magen-Darm-Beschwerden möglich; mögliche Beeinflussung der Aufnahme anderer Stoffe/Arzneien beachten. Herstellerangaben prüfen.',''],
 ['Foster NEXThaler','Heiserkeit, Pilzbefall im Mund, Zittern/Herzklopfen; möglich: erhöhter Blutzucker und erniedrigtes Kalium. Nach Gebrauch Mund ausspülen.','https://www.fachinfo.de/fi/detail/020889/foster-r-nexthaler-r-200-mikrogramm-6-mikrogramm-pro-inhalation'],
 ['Allopurinol','Hautausschlag, Übelkeit; selten schwere lebensbedrohliche Hautreaktionen. Bei neuem Hautausschlag unverzüglich medizinisch abklären.','https://www.fachinfo.de/fi/pdf/000521/allopurinol-abz-100-300-mg-tabletten'],
 ['Salbutamol','Zittern, Herzrasen, Nervosität, Kopfschmerz; möglich: erniedrigtes Kalium. Häufiger Bedarf sollte ärztlich besprochen werden.','']
];
const SOURCES=[
 ['DMP für chronische Krankheiten (G-BA)','https://www.g-ba.de/themen/disease-management-programme/'],
 ['GKV-Gesundheits-Check-up (G-BA)','https://www.g-ba.de/themen/methodenbewertung/erwachsene/gesundheitsuntersuchungen/'],
 ['PSA-Test: Nutzen, Risiken & Kosten (IQWiG)','https://www.gesundheitsinformation.de/der-psa-test-zur-frueherkennung-von-prostatakrebs.html'],
 ['Über-/Unterzuckerung (IQWiG)','https://www.gesundheitsinformation.de/ueber-und-unterzuckerung-bei-typ-2-diabetes.html'],
 ['Metformin Fachinformation','https://www.fachinfo.de/fi/detail/023514/siofor-xr-750-mg-retardtabletten'],
 ['Foster NEXThaler Fachinformation','https://www.fachinfo.de/fi/detail/020889/foster-r-nexthaler-r-200-mikrogramm-6-mikrogramm-pro-inhalation']
];
const BENEFITS=[
 ['DMP Diabetes Typ 2','Gesetzliche Krankenkassen bieten strukturierte Behandlungsprogramme mit Verlaufskontrollen, Schulungen und abgestimmter Therapie. Anmeldung in einer teilnehmenden Arztpraxis; bei Kasse nachfragen.','https://www.g-ba.de/themen/disease-management-programme/','GKV-Leistung bei Einschreibevoraussetzungen'],
 ['GKV-Gesundheits-Check-up','Ab 35 Jahren grundsätzlich alle drei Jahre; darunter einmalig (18–34). Blutdruck sowie bestimmte Blut-/Urinuntersuchungen gehören zum geregelten Leistungsumfang.','https://www.g-ba.de/themen/methodenbewertung/erwachsene/gesundheitsuntersuchungen/','Anspruch bei GKV und Altersvorgaben'],
 ['Diabetes-Schulung / Ernährungsberatung','Schulungen können im Rahmen ärztlicher Versorgung / DMP möglich sein. Ernährungstherapie und Zuschüsse hängen von Verordnung, Indikation und Kassenangebot ab.','https://www.g-ba.de/themen/disease-management-programme/','Leistungsumfang individuell klären'],
 ['Augen-, Fuß- und Nierenkontrollen','Bei Diabetes sind regelmäßige risikobezogene Kontrollen medizinisch wichtig und im DMP vorgesehen; Intervalle richten sich nach Befund und Therapie.','https://www.g-ba.de/richtlinien/83/','Ärztliche Planung statt fester Universalintervalle'],
 ['Blutzucker-Messgerät / Teststreifen','Verordnungsfähigkeit hängt insbesondere von Insulintherapie, instabiler Stoffwechsellage, Therapieänderung und medizinischer Notwendigkeit ab; nicht jede Person mit Typ-2-Diabetes erhält sie pauschal.','https://www.g-ba.de/richtlinien/13/','Verordnung und Kassenbewilligung prüfen'],
 ['Zuzahlungsbefreiung','Bei Überschreiten der persönlichen Belastungsgrenze kann eine Befreiung möglich sein. Für anerkannte schwerwiegend chronisch Erkrankte können besondere Voraussetzungen und eine niedrigere Grenze gelten.','https://gesund.bund.de/zuzahlungen-und-zuzahlungsbefreiung','Antrag bei eigener Krankenkasse'],
 ['PSA / Prostata','PSA ausschließlich zur Früherkennung ohne Beschwerden ist in der Regel IGeL/Selbstzahler. Bei medizinischem Verdacht kann Diagnostik zulasten der Kasse möglich sein.','https://www.gesundheitsinformation.de/der-psa-test-zur-frueherkennung-von-prostatakrebs.html','Kostenübernahme vorab klären'],
 ['Hilfsmittel / Reha / Pflegegrad','Bei ärztlich festgestelltem Bedarf können geeignete Hilfsmittel oder Reha beantragt werden; Voraussetzungen variieren. Pflegeleistungen setzen einen anerkannten Pflegegrad voraus.','https://gesund.bund.de/hilfsmittel','Individuelle Anspruchsprüfung']
];
function migrateData(){
 if(!data||!data.profile||!data.settings)return;
 const d=defaults();for(const [k,v] of Object.entries(d.profile)){const current=data.profile[k];if(current===undefined||current===null||(Array.isArray(v)?!Array.isArray(current):typeof current!=='string'))data.profile[k]=clone(v);}
 for(const [k,v] of Object.entries(d.settings))if(data.settings[k]===undefined)data.settings[k]=v;
 if(!data.medStocks||typeof data.medStocks!=='object'||Array.isArray(data.medStocks))data.medStocks={}; data.checks=data.checks||{}; data.checks.gdb=data.checks.gdb||{};data.checks.emergencyPlan=data.checks.emergencyPlan||{actions:'',doctorNotes:'',lastReviewed:''}; for(const field of ['symptoms','medTakes','reminders','evidence','weights','asthmaLogs','urologyLogs','oxygenLogs','hospitalStays'])if(!Array.isArray(data[field]))data[field]=[];
}
function defaults(){return {schema:1,created:new Date().toISOString(),profile:{name:'',birthday:'',bloodGroup:'',height:'',weight:'',street:'',postalCode:'',city:'',phone:'',insurance:'',gp:'',notes:'',conditions:[],allergies:[],intolerances:[],foods:[],pollen:[],contact:[],history:[],medHistory:'',source:''},measurements:[],labs:[],meds:[],weights:[],asthmaLogs:[],urologyLogs:[],oxygenLogs:[],hospitalStays:[],medStocks:{},symptoms:[],medTakes:[],reminders:[],evidence:[],settings:{glucoseFastingLow:80,glucoseFastingHigh:130,glucoseAfterHigh:180,glucoseOtherHigh:180,bpHighSys:135,bpHighDia:85,bpLowSys:90,bpLowDia:60,bpCriticalSys:180,bpCriticalDia:110,glucoseCriticalHigh:250,pulseLow:50,pulseHigh:100,pulseCriticalLow:40,pulseCriticalHigh:130,language:'de',seniorMode:false},checks:{}}}
function dbopen(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function getRec(){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readonly');const q=t.objectStore(STORE).get(KEY);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
function putRec(v){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(v,KEY);t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}
// Gewichts-Zwischensicherung: nur ein kleines, AES-GCM-verschlüsseltes Objekt.
// Bei iOS-Neustarts kann die begonnene Messung nach erneuter Anmeldung gerettet werden.
const WEIGHT_DRAFT_KEY='weight-draft-v1';
/* VK194 JOURNAL BEGIN: Separat verschlüsselter Gewichtsspeicher. */
const WEIGHT_JOURNAL_KEY='weight-journal-v1';
let weightJournalReadOnly=false; // Sperrt Schreiben, falls ein vorhandenes Tagebuch nicht lesbar ist.
function getWeightJournalRec(){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readonly');const q=t.objectStore(STORE).get(WEIGHT_JOURNAL_KEY);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}

/* VK196 BEGIN: Tresor und Gewichtstagebuch nur zusammen ersetzen. */
async function persistRestoredVault(restored){
 if(!key)throw Error('App ist gesperrt.');
 const existing=await getRec();
 if(!existing?.salt)throw Error('Vorhandener Passwort-Tresor ist nicht erreichbar.');
 const vaultEnvelope=await pack(restored,key);
 const journalEnvelope=await pack({format:'vk-weight-journal-v1',rows:restored.weights||[]},key);
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  const items=tx.objectStore(STORE);
  items.put({...existing,...vaultEnvelope,modified:new Date().toISOString()},KEY);
  items.put(journalEnvelope,WEIGHT_JOURNAL_KEY);
  items.delete(WEIGHT_DRAFT_KEY);
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(tx.error||Error('Gemeinsame Backup-Wiederherstellung fehlgeschlagen.'));
  tx.onabort=()=>reject(tx.error||Error('Backup-Wiederherstellung abgebrochen, bestehende Daten erhalten.'));
 });
}
/* VK196 END */

async function storeWeightJournal(rows){
 if(weightJournalReadOnly)throw Error('Gewichtstagebuch ist nicht lesbar: Schreiben zum Schutz bestehender Messwerte gesperrt. Nicht löschen, zuerst Daten sichern bzw. Speicherproblem prüfen.');
 if(!key||!Array.isArray(rows)||rows.length>50000)throw Error('Gewichtsspeicher nicht verfügbar.');
 const envelope=await pack({format:'vk-weight-journal-v1',rows},key);
 await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(envelope,WEIGHT_JOURNAL_KEY);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});
 const saved=await getWeightJournalRec();
 if(!saved?.cipher||!saved?.iv)throw Error('Gewichtsspeicher konnte nicht bestätigt werden.');
 const restored=await unpack(saved,key);
 if(restored?.format!=='vk-weight-journal-v1'||!Array.isArray(restored.rows)||restored.rows.length!==rows.length||!restored.rows.every((r,i)=>r.id===rows[i].id&&r.kg===rows[i].kg&&r.date===rows[i].date&&r.time===rows[i].time))throw Error('Gewichtsspeicherprüfung fehlgeschlagen.');
}
async function loadWeightJournal(){
 const saved=await getWeightJournalRec();if(!saved)return false;
 const restored=await unpack(saved,key);
 if(restored?.format!=='vk-weight-journal-v1'||!Array.isArray(restored.rows)||restored.rows.length>50000||!restored.rows.every(r=>r&&typeof r.id==='string'&&dateValid(r.date)&&timeValid(r.time)&&Number.isFinite(r.kg)&&r.kg>=20&&r.kg<=400&&Object.prototype.hasOwnProperty.call(bpMealLabels,r.mealTiming)&&r.mealTiming!=='unknown'&&(r.note===undefined||typeof r.note==='string')))throw Error('Gewichtsspeicher enthält ungültige Daten.');
 data.weights=restored.rows;
 syncProfileWeight();weightJournalReadOnly=false;return true;
}
/* VK194 JOURNAL END */

function readWeightDraft(){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readonly');const q=t.objectStore(STORE).get(WEIGHT_DRAFT_KEY);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);})}
function writeWeightDraft(entry){return pack({format:'vk-weight-draft-v1',entry},key).then(envelope=>new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(envelope,WEIGHT_DRAFT_KEY);t.oncomplete=resolve;t.onerror=()=>reject(t.error)}))}
function clearWeightDraft(){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(WEIGHT_DRAFT_KEY);t.oncomplete=resolve;t.onerror=()=>reject(t.error)})}
async function recoverWeightDraft(){
 const envelope=await readWeightDraft();if(!envelope)return false;
 let draft;try{draft=await unpack(envelope,key)}catch{toast('Eine ältere Gewichtszwischensicherung konnte nicht entschlüsselt werden. Bitte bestehende Einträge prüfen.');return false}
 const e=draft?.entry;
 if(draft.format!=='vk-weight-draft-v1'||!e||typeof e.id!=='string'||!dateValid(e.date)||!timeValid(e.time)||!Number.isFinite(e.kg)||e.kg<20||e.kg>400||!Object.prototype.hasOwnProperty.call(bpMealLabels,e.mealTiming)||e.mealTiming==='unknown'||typeof e.note!=='string'||e.note.length>300){toast('Eine unvollständige Zwischensicherung wurde nicht übernommen.');return false}
 const pos=data.weights.findIndex(w=>w.id===e.id);
 const changed=pos<0||['date','time','kg','mealTiming','note'].some(field=>data.weights[pos][field]!==e[field]);
 if(changed){
  const savedWeights=data.weights.map(w=>({...w})),savedWeight=data.profile.weight;
  if(pos<0)data.weights.push(e);else data.weights[pos]=e;
  syncProfileWeight();
  try{await storeWeightJournal(data.weights)}catch(err){data.weights=savedWeights;data.profile.weight=savedWeight;throw err}
 }
 try{await clearWeightDraft()}catch{}
 return changed;
}

const b64=a=>{const bytes=new Uint8Array(a),chunks=[],size=16384;for(let i=0;i<bytes.length;i+=size)chunks.push(String.fromCharCode(...bytes.subarray(i,i+size)));return btoa(chunks.join(''))};
const unb64=s=>{const binary=atob(s),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out};
async function passKey(pass,salt){const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:270000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function pack(val,passkey){const iv=crypto.getRandomValues(new Uint8Array(12));const raw=new TextEncoder().encode(JSON.stringify(val));return {iv:b64(iv),cipher:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},passkey,raw))}}
async function unpack(o,passkey){const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},passkey,unb64(o.cipher));return JSON.parse(new TextDecoder().decode(bytes))}
function save(){if(!data||!key)return Promise.reject(Error('App ist gesperrt'));stagedBackupFile=null;const snapshot=clone(data),writeKey=key;saveQueue=saveQueue.catch(()=>{}).then(async()=>{const existing=await getRec();const encrypted=await pack(snapshot,writeKey);await putRec({...existing,...encrypted,modified:new Date().toISOString()})});return saveQueue}
function toast(message){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';document.body.append(el)}el.textContent=message;el.style.display='block';clearTimeout(toast._timer);toast._timer=setTimeout(()=>el.style.display='none',3800)}
function tag(title,description){return `<div class="heading-row"><div><div class="kicker">VITALKOMPASS</div><h1>${h(title)}</h1>${description?`<p class="section-note">${h(description)}</p>`:''}</div></div>`}
/* VitalKompass 2.0.3: Navigation und Körpermaße – keine Änderungen am Datenspeicher. */
const VK203_MENU=[
 ['Übersicht',[['start','Startseite','⌂'],['profile','Persönliche Daten','♙']]],
 ['Messwerte',[['glucose','Diabetes & Blutzucker','◆'],['bp','Blutdruck & Puls','♥'],['weight','Gewicht, BMI & Körperoberfläche','⚖'],['urology','Prostata & Urologie','◈'],['asthma','Asthma-Tagebuch','♧'],['oxygen','Blutsauerstoff & Durchblutung (PI)','◉'],['labs','Laborwerte','⊕'],['symptoms','Symptomtagebuch','☷']]],
 ['Medikamente & Vorsorge',[['meds','Medikamentenplan','✚'],['medlog','Medikamenteneinnahmen','◷'],['reminders','Kontrollen & Termine','◷'],['hospital','Krankenhausaufenthalte & Scans','▤'],['prevention','Vorsorge & Notfallplan','✚'],['emergency','Notfallpass','!']]],
 ['Auswertung & Berichte',[['analysis','Gesundheitsanalyse','▣'],['pro','Analyse Pro','◈'],['stats','Monats- & Jahresstatistik','▤'],['doctor','Arztbericht / PDF','▤']]],
 ['Anträge & Nachweise',[['gdb','GdB & Teilhabe','§'],['evidence','GdB-Nachweise','▤'],['benefits','Krankenkasse & Leistungen','§']]],
 ['Einstellungen',[['settings','Backup & Updates','⚙']]]
];
function vk203OpenDrawer(){
 const shell=$('#vk203-drawer-shell'),drawer=$('#vk203-drawer'),button=$('[data-vk203-open]');
 if(!shell||!drawer||!button)return;
 drawer.inert=false;drawer.removeAttribute('inert');drawer.setAttribute('aria-hidden','false');
 shell.classList.add('is-open');document.body.classList.add('vk203-drawer-open');button.setAttribute('aria-expanded','true');
 const close=$('[data-vk203-close-inside]',drawer);if(close)close.focus();
}
function vk203CloseDrawer(restore=true){
 const shell=$('#vk203-drawer-shell'),drawer=$('#vk203-drawer'),button=$('[data-vk203-open]');
 shell?.classList.remove('is-open');document.body.classList.remove('vk203-drawer-open');
 if(drawer){drawer.inert=true;drawer.setAttribute('aria-hidden','true')}
 if(button){button.setAttribute('aria-expanded','false');if(restore)button.focus()}
}
function vk203SearchMenu(value){
 const term=String(value||'').trim().toLocaleLowerCase('de'),sections=$$('.vk203-group');
 let count=0;
 for(const section of sections){let shown=0;
  for(const button of $$('.vk203-menu-item',section)){
   const match=!term||button.textContent.toLocaleLowerCase('de').includes(term);
   button.hidden=!match;if(match){count++;shown++}
  }
  section.hidden=shown===0;
 }
 const empty=$('#vk203-menu-empty');if(empty)empty.hidden=count!==0;
}
function vk203LatestWeight(){
 const measured=(data?.weights||[]).filter(x=>Number.isFinite(x.kg)&&x.kg>0&&dateValid(x.date)&&x.date<=today()).sort(sortdate).at(-1);
 if(measured)return {weight:measured.kg,source:'Letzte gespeicherte Gewichtsmessung vom '+fmtDate(measured.date)};
 const profile=nval(data?.profile?.weight);
 return {weight:Number.isFinite(profile)&&profile>0?profile:null,source:'Gewicht aus den persönlichen Daten (noch keine Messung gespeichert)'};
}
function vk203Calculate(weightKg,heightCm){
 const w=Number(String(weightKg??'').replace(',','.')),height=Number(String(heightCm??'').replace(',','.'));
 if(!Number.isFinite(w)||!Number.isFinite(height)||w<2||w>400||height<100||height>250)return null;
 return {bmi:w/((height/100)**2),bsa:Math.sqrt((height*w)/3600)};
}
function vk203MetricsOutput(weight,height){
 const r=vk203Calculate(weight,height);
 if(!r)return '<p class="vk203-metric-wait">Bitte gültige Körpergröße und Gewicht eintragen, um BMI und Körperoberfläche zu berechnen.</p>';
 return `<div class="vk203-metric-result-grid"><div class="vk203-metric-number"><span>BMI</span><strong>${nf(r.bmi,1)}</strong><small>kg/m²</small></div><div class="vk203-metric-number"><span>Körperoberfläche</span><strong>${nf(r.bsa,2)}</strong><small>m² · Mosteller</small></div></div>`;
}
function vk203MetricPanel(){
 const entry=vk203LatestWeight(),height=data?.profile?.height||'',weight=entry.weight??'';
 return panel('BMI & Körperoberfläche',`<p class="section-note">Automatisch berechnet mit der gespeicherten Körpergröße und der neuesten Gewichtsmessung. Neue Messungen aktualisieren die Werte beim Speichern.</p><div class="vk203-metric-fields"><label class="field"><span>Körpergröße (cm)</span><input id="vk203-height" inputmode="decimal" type="text" value="${h(height)}" aria-label="Körpergröße für BMI und Körperoberfläche"></label><label class="field"><span>Gewicht (kg)</span><input id="vk203-weight" inputmode="decimal" type="text" value="${h(weight)}" aria-label="Gewicht für BMI und Körperoberfläche"></label></div><div class="vk203-metric-result" id="vk203-metric-output" role="status" aria-live="polite">${vk203MetricsOutput(weight,height)}</div><p class="section-note">${h(entry.source)}. Du kannst beide Werte im Rechner testweise ändern. Diese Vorschau speichert nichts; zum dauerhaften Ändern die persönlichen Daten oder das Gewichtstagebuch verwenden. Der BMI ist nur ein grober Orientierungswert und keine Diagnose.</p>`);
}
function vk203Recalculate(){const output=$('#vk203-metric-output');if(output)output.innerHTML=vk203MetricsOutput($('#vk203-weight')?.value,$('#vk203-height')?.value)}
function vk203MetricMini(){
 const entry=vk203LatestWeight(),calc=vk203Calculate(entry.weight,data?.profile?.height);
 return `<div class="vk203-home-metric"><div><strong>Körpermaße</strong><span>${calc?'BMI '+nf(calc.bmi,1)+' · Körperoberfläche '+nf(calc.bsa,2)+' m²':'Größe und Gewicht ergänzen'}</span></div><button type="button" data-view="weight">Rechner öffnen</button></div>`;
}
function vk203HomeQuick(){
 return `<section class="vk203-home-quick" aria-label="Häufig verwendet"><h2>Schnell erfassen</h2><div class="vk203-home-grid">${[['glucose','Blutzucker'],['bp','Blutdruck'],['weight','Gewicht / BMI'],['labs','Laborwerte'],['stats','Statistiken'],['doctor','Arztbericht']].map(([v,t])=>`<button type="button" data-view="${v}">${t}</button>`).join('')}</div><p class="section-note">Alle weiteren Bereiche findest du über „Menü“ oben.</p></section>`;
}
function nav(){return `<div class="vk203-drawer-shell" id="vk203-drawer-shell"><button class="vk203-backdrop" type="button" data-vk203-close aria-label="Menü schließen" tabindex="-1"></button><aside id="vk203-drawer" class="vk203-drawer" role="dialog" aria-modal="true" aria-label="VitalKompass Hauptmenü" aria-hidden="true" inert><header class="vk203-drawer-header"><div><strong>VitalKompass</strong><small>Alle Bereiche</small></div><button type="button" class="vk203-drawer-x" data-vk203-close-inside aria-label="Menü schließen">✕</button></header><label class="vk203-search-label" for="vk203-search">Bereich suchen</label><input id="vk203-search" type="search" autocomplete="off" placeholder="z. B. Labor, Prostata, GdB"><nav class="vk203-menu-list" aria-label="App-Bereiche">${VK203_MENU.map(([group,items])=>`<section class="vk203-group"><h3>${h(group)}</h3>${items.map(([id,label,symbol])=>`<button class="vk203-menu-item" type="button" data-view="${id}" aria-current="${view===id?'page':'false'}"><span class="vk203-menu-symbol" aria-hidden="true">${symbol}</span><span>${h(label)}</span></button>`).join('')}</section>`).join('')}</nav><p class="vk203-menu-empty" id="vk203-menu-empty" hidden>Keinen passenden Bereich gefunden.</p><p class="vk203-menu-footer">Gesundheitsdaten bleiben lokal verschlüsselt gespeichert.</p></aside></div>`}
function common(){document.body.classList.remove('vk203-drawer-open');document.body.classList.toggle('senior-mode',data?.settings?.seniorMode===true);root.innerHTML=`<header class="topbar vk203-topbar"><button class="vk203-menu-trigger" type="button" data-vk203-open aria-controls="vk203-drawer" aria-expanded="false"><span aria-hidden="true">☰</span><span>Menü</span></button><div class="brand"><img src="icon-192.png" alt="VitalKompass Logo"><div><strong>VitalKompass</strong><small>Mein Gesundheitsjournal</small></div></div><span class="version">Version ${VERSION}</span><button class="quiet" data-action="lock" type="button">Sperren</button></header><div class="layout">${nav()}<main id="main"></main><nav class="vk-bottom-nav" aria-label="Schnellnavigation"><button type="button" data-view="glucose" aria-current="${view==='glucose'?'page':'false'}">Diabetes</button><button type="button" data-view="urology" aria-current="${view==='urology'?'page':'false'}">Prostata</button><button type="button" data-view="bp" aria-current="${view==='bp'?'page':'false'}">Blutdruck</button></nav><footer class="foot">Daten ausschließlich auf diesem Gerät · Passwortgeschützt · Keine automatische ärztliche Diagnose oder Medikamentenprüfung · <b>Version ${VERSION}</b></footer></div>`;renderMain()}
function renderMain(){if(!data){return}const main=$('#main');main.dataset.section=view;const content={start:pageStart,profile:pageProfile,gdb:pageGdb,analysis:pageAnalysis,pro:pagePro,prevention:pagePrevention,symptoms:pageSymptoms,medlog:pageMedLog,reminders:pageReminders,hospital:pageHospital,evidence:pageEvidence,glucose:pageGlucose,bp:pageBp,weight:pageWeight,urology:pageUrology,asthma:pageAsthma,oxygen:pageOxygen,doctor:pageReportPlus,labs:pageLabs,meds:pageMeds,emergency:pageEmergency,stats:pageStats,benefits:pageBenefits,settings:pageSettings};$('#main').innerHTML=(content[view]||pageStart)();formatMobileTables($('#main'));vk207EnhanceCharts()}
function formatMobileTables(scope){for(const table of scope.querySelectorAll('.table-wrap table')){const labels=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());for(const tr of table.querySelectorAll('tbody tr')){[...tr.children].forEach((cell,i)=>{cell.dataset.label=labels[i]||'Wert'})}}}
function authPage(hasVault){root.innerHTML=`<div class="authwrap"><section class="authbox"><div class="authlogo"><img src="icon-192.png" alt=""><div><h1>VitalKompass</h1><small>Privates Gesundheitsjournal · Version ${VERSION}</small></div></div>${canUseCrypto?'':`<div class="notice danger">Dieser Browser bietet hier keine sichere Verschlüsselung. Öffne die App unter HTTPS (z. B. GitHub Pages) oder auf localhost. Keine Daten werden unverschlüsselt gespeichert.</div>`}<h2>${hasVault?'Mit Passwort entsperren':'Privaten Speicher anlegen'}</h2><p>${hasVault?'Deine Gesundheitsdaten sind verschlüsselt auf diesem Gerät gespeichert.':'Lege ein starkes Passwort mit mindestens 10 Zeichen fest. Nur du kennst es. Ohne Passwort kann niemand – auch die App nicht – deine Daten wiederherstellen.'}</p><form id="auth-form"><label class="field"><span>Passwort</span><input name="password" type="password" autocomplete="${hasVault?'current-password':'new-password'}" required minlength="10"></label>${hasVault?'':`<label class="field"><span>Passwort wiederholen</span><input name="confirm" type="password" required minlength="10" autocomplete="new-password"></label>`}<button type="submit" ${!canUseCrypto?'disabled':''} class="primary">${hasVault?'Entsperren':'Speicher sicher anlegen'}</button></form><hr class="divider"><p class="section-note">Wichtig: Für einen Gerätewechsel vorher ein verschlüsseltes Backup erstellen. Bei gelöschtem Browser-Speicher sind lokale Daten sonst verloren.</p></section></div>`}
async function init(){if(!('indexedDB' in window)){root.textContent='IndexedDB wird in diesem Browser nicht unterstützt.';return}try{db=await dbopen();const old=await getRec();authPage(!!old);const p=new URLSearchParams(location.search);if(p.has('demo'))toast('Es gibt keine öffentliche Demo mit persönlichen Patientendaten.')}catch(e){root.textContent=`Speicher nicht verfügbar: ${e.message}. Bitte privaten Modus deaktivieren bzw. HTTPS verwenden.`}}
function pctTag(verified){return verified!==true?'<span class="chip amber">Foto: noch prüfen</span>':'<span class="chip green">Bestätigt</span>'}
function filtered(type){return data.measurements.filter(x=>x.type===type).sort(sortdate)}
function glucoseWarnings(e){if(e.verified!==true)return [];const v=e.mgdl;const s=data.settings;let msg=[];if(v<54)msg.push('Stark erniedrigter Blutzucker (<54 mg/dl): unverzüglich behandeln. Bei Verwirrtheit, Bewusstlosigkeit oder Schluckstörung 112!');else if(v<70)msg.push('Unterzuckerung (<70 mg/dl): sofort nach persönlichem Hypoglykämie-Plan handeln und erneut messen.');let high=e.period==='fasting'?s.glucoseFastingHigh:e.period==='after'?s.glucoseAfterHigh:s.glucoseOtherHigh;
if(e.period==='fasting'&&v>=70&&v<s.glucoseFastingLow)msg.push(`Unter der eingestellten nüchternen Ziel-Untergrenze (${s.glucoseFastingLow} mg/dl). Messung und Zielbereich ärztlich besprechen.`);if(v>high)msg.push(`Über individuellem eingestelltem Orientierungswert (${high} mg/dl). Wert kontrollieren, Verlauf besprechen.`);if(v>=300)msg.push('Sehr hoher Blutzucker (≥300 mg/dl): bei Symptomen wie Erbrechen, starker Schwäche, Atemproblemen oder Bewusstseinsstörung dringend medizinische Hilfe; sonst zeitnah ärztlich abklären.');return msg}
function bpWarnings(e){if(e.verified!==true)return [];const s=data.settings;const out=[];if(e.sys>=180||e.dia>=110)out.push('Sehr hoher Blutdruck (≥180 systolisch oder ≥110 diastolisch): nach Ruhe erneut messen. Bei Brustschmerzen, Atemnot, neurologischen Symptomen: 112. Auch ohne Symptome umgehend ärztlich klären.');else if(e.sys>=s.bpHighSys||e.dia>=s.bpHighDia)out.push(`Über deinem eingestellten Heim-Mess-Orientierungswert (${s.bpHighSys}/${s.bpHighDia}). Wiederholte Messungen ärztlich besprechen.`);if(e.sys<data.settings.bpLowSys||e.dia<data.settings.bpLowDia)out.push('Niedriger Blutdruck. Bei Ohnmacht, Brustschmerz, ausgeprägtem Schwindel oder Beschwerden zeitnah medizinisch klären.');if(Number.isFinite(e.pulse)){const st=classification(e,'pulse');if(st.level==='critical')out.push('Puls deutlich außerhalb des Orientierungsbereichs. In Ruhe wiederholen und mit Beschwerden / Medikamenten ärztlich abklären. Bei Ohnmacht, Brustschmerzen oder starker Atemnot 112.');else if(st.level==='low'||st.level==='high')out.push('Puls außerhalb des eingestellten Orientierungsbereichs; Ruhe, Medikamente und Beschwerden berücksichtigen.');}return out}
function latest(type){return [...filtered(type)].filter(x=>x.verified===true).at(-1)}
function panel(txt,inner,klass=''){return `<section class="panel ${klass}"><h2>${h(txt)}</h2>${inner}</section>`}
function warningBox(msg,level='warn'){return `<div class="notice ${level==='danger'?'danger':''}" role="status">${h(msg)}</div>`}
function photoNote(){return `<div class="notice info"><strong>Wichtiger Import-Hinweis:</strong> Die handschriftliche Tabelle trägt „mmol/l“, enthält aber Zahlen wie 124 und 196 (wahrscheinlich mg/dl). Außerdem stehen Uhrzeiten offenbar in der Insulin-Spalte. Fotowerte werden deshalb <strong>nicht als gesichert</strong> eingestuft. Bitte anhand des Messgeräts kontrollieren und bestätigen.</div>`}
function ageYears(){const b=data.profile.birthday;if(!/^\d{4}-\d{2}-\d{2}$/.test(b||''))return null;let a=new Date().getFullYear()-Number(b.slice(0,4));const md=new Date().toISOString().slice(5,10);if(md<b.slice(5,10))a--;return a>=0&&a<125?a:null}
function profileCard(){const p=data.profile, loc=[p.street,p.postalCode,p.city].filter(Boolean).join(' · ');return `<section class="profile-highlight"><div><span class="profile-eyebrow">PATIENTENPROFIL</span><h2>${h(p.name||'Bitte Name eintragen')}</h2><p>${h(p.birthday?fmtDate(p.birthday):'Geburtsdatum ergänzen')}${ageYears()!==null?' · '+ageYears()+' Jahre':''}${loc?' · '+h(loc):''}</p><p>${p.phone?'Telefon: '+h(p.phone)+' · ':''}${p.gp?'Hausarzt: '+h(p.gp):'Weitere persönliche Angaben ergänzen'}</p></div><button data-view="profile" type="button" class="primary">Profil bearbeiten</button></section>`}
function pageProfile(){const p=data.profile;return tag('Persönliche Daten','Sichtbares und jederzeit änderbares Patientenprofil. Alle Angaben liegen ausschließlich verschlüsselt in deinem Browser.')+profileCard()+vk203MetricPanel()+panel('Angaben ändern',`<form id="personal-form"><div class="form-grid">
<label class="field"><span>Vollständiger Name</span><input name="name" autocomplete="name" value="${h(p.name)}" required></label>
<label class="field"><span>Geburtsdatum</span><input name="birthday" type="date" value="${h(p.birthday)}"></label>
<label class="field"><span>Straße und Hausnummer</span><input name="street" autocomplete="street-address" value="${h(p.street)}"></label>
<label class="field"><span>Postleitzahl</span><input name="postalCode" inputmode="numeric" autocomplete="postal-code" value="${h(p.postalCode)}"></label>
<label class="field"><span>Ort</span><input name="city" autocomplete="address-level2" value="${h(p.city)}"></label>
<label class="field"><span>Telefonnummer</span><input name="phone" type="tel" autocomplete="tel" value="${h(p.phone)}"></label>
<label class="field"><span>Krankenkasse</span><input name="insurance" value="${h(p.insurance)}"></label>
<label class="field"><span>Hausarzt / Praxis</span><input name="gp" value="${h(p.gp)}"></label>
<label class="field"><span>Größe (cm)</span><input name="height" type="number" min="50" max="250" value="${h(p.height)}"></label>
<label class="field"><span>Gewicht (kg)</span><input name="weight" type="number" step="0.1" min="1" max="400" value="${h(p.weight)}"></label>
<label class="field"><span>Blutgruppe (nur dokumentarisch)</span><input name="bloodGroup" value="${h(p.bloodGroup)}"></label>
</div><p class="section-note">Änderst du den Namen oder das Geburtsdatum, müssen künftige private Importdateien auf die neue Identität passen. Vor Änderungen sicherheitshalber ein Backup speichern.</p><button class="primary">Persönliche Daten speichern</button></form>`)+panel('Weitere medizinische Angaben',`<p>Diagnosen, Allergien, Operationen und Notfallkontakte bearbeitest du im Notfallpass.</p><button class="secondary" data-view="emergency">Notfallpass öffnen</button>`)}
function gdbReport(){const g=data.checks?.gdb||{},bp=filtered('bp').filter(x=>x.verified===true),bg=filtered('glucose').filter(x=>x.verified===true);const bpHigh=bp.filter(x=>x.sys>=data.settings.bpHighSys||x.dia>=data.settings.bpHighDia).length;let lines=[];
if(g.existing==='yes')lines.push(`Bereits anerkannt: GdB ${h(g.value||'nicht eingetragen')}. Bescheid und berücksichtigte Gesundheitsstörungen prüfen.`);
else if(g.existing==='no')lines.push('Bisher kein GdB anerkannt: Erstantrag prüfen, falls längerfristige erhebliche Teilhabeeinschränkungen bestehen.');else lines.push('Bitte zuerst angeben, ob bereits ein GdB besteht.');
if(g.diabetes==='tablets')lines.push('Diabetes mit nicht hypoglykämieauslösender Behandlung: Ohne erhebliche Teilhabeeinschränkung nach Teil B 15.1 oft GdB 0; die Diagnose oder ein hoher Messwert allein begründen keinen höheren GdB.');
if(g.diabetes==='risk')lines.push('Diabetes mit möglicher Unterzuckerung und Einschränkungen: Therapieaufwand, dokumentierte Messungen und Auswirkungen auf die Lebensführung sind für eine Bewertung (je nach Voraussetzungen 20 bis 40) wichtig.');
if(g.diabetes==='intensive')lines.push('Intensive Insulintherapie: GdB 50 kommt nach Teil B 15.1 nur infrage, wenn sämtliche Kriterien einschließlich mindestens vier täglicher Injektionen/gleichwertiger Pumpentherapie, selbstständiger Dosisanpassung, Dokumentation und gravierender Einschnitte erfüllt sind.');
if(g.apnea==='cpap')lines.push('Schlafapnoe mit nachgewiesener notwendiger dauernder nasaler Überdruckbeatmung: Einzel-GdB 20 nach Teil B 8.7 als Orientierung; Schlaflabor und Verordnung vorlegen.');
if(g.apnea==='no')lines.push('Schlafapnoe ohne notwendige Überdruckbeatmung: Teil B 8.7 sieht regelmäßig 0–10 vor, sofern die Diagnose im Schlaflabor gesichert ist.');
if(g.organ==='yes')lines.push('Organbeteiligung angegeben: Berichte zu Herz, Niere und Augen sind besonders relevant; die versorgungsmedizinische Bewertung hängt von nachgewiesenen Funktionsstörungen ab.');
if(g.function==='yes')lines.push('Alltag erheblich eingeschränkt: konkrete Beispiele, Häufigkeit, Dauer, Hilfebedarf und ärztliche Nachweise zusammenstellen.');
lines.push(`Bestätigte Heim-Blutdruckmessungen: ${bp.length}, davon ${bpHigh} mit ≥${data.settings.bpHighSys}/${data.settings.bpHighDia} mmHg in mindestens einer Komponente. Bestätigte Blutzuckerwerte: ${bg.length}. Ungeprüfte Fotoeinträge sind ausgeschlossen.`);
lines.push('Keine automatische GdB-Zahl: Einzel-GdB dürfen nicht addiert werden. Die Behörde beurteilt dauerhaft bestehende Teilhabeeinschränkungen und ihr Zusammenwirken.');
if(g.existing==='yes')lines.push('Bei neuen oder wesentlich verschlechterten dauerhaften Beeinträchtigungen: Änderungsantrag prüfen. Eine Neufeststellung bewertet den Gesamtzustand neu und kann den GdB auch senken.');
else lines.push('Bei hinreichenden Nachweisen: Feststellungsantrag prüfen.');
return lines;}

// --- Version 1.5.0: nachvollziehbare Auswertung. Nur verifizierte Werte fließen in das Ergebnis ein. ---
const ANALYSIS_SOURCES=[
 ['Heimmessung 135/85 – Deutsche Hochdruckliga','https://www.hochdruckliga.de/betroffene/bluthochdruck/bluthochdruck-bei-erwachsenen'],
 ['Diabetes-Standards 2026 (Unterzuckerung)','https://pmc.ncbi.nlm.nih.gov/articles/PMC12690178/'],
 ['GdB: Versorgungsmedizin-Verordnung','https://www.gesetze-im-internet.de/versmedv/anlage.html']
];
const dateValid=x=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(x||''))return false;const d=new Date(x+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x};
const timeValid=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x||'');
const datetimeMs=x=>Date.parse((x.date||'')+'T'+(x.time||'00:00')+':00');
const getWindowDate=days=>days==='all'?'0000-00-00':new Date(Date.now()-(Math.max(1,Number(days))-1)*86400000).toLocaleDateString('sv-SE');

/* 2.0.2 Ampel: Orientierungswerte und vorhandene eigene Referenzen, keine Diagnose. */
const VK_TRAFFIC_COLORS={green:'#16805d',yellow:'#b87910',red:'#c22842',gray:'#748392'};
function chartTraffic(type,r,field=''){
 const answer=(level,label)=>({level,label});
 const gray=()=>answer('gray','Ohne sichere Einordnung');
 const valid=k=>Number.isFinite(r?.[k]);
 const limit=(name,fallback)=>Number.isFinite(Number(data?.settings?.[name]))?Number(data.settings[name]):fallback;
 if(type==='glucose'){
   if(!valid('mgdl'))return gray();
   const v=r.mgdl,kind=r.period||'other';
   const high=kind==='after'?limit('glucoseAfterHigh',180):(kind==='fasting'||kind==='before')?limit('glucoseFastingHigh',130):limit('glucoseOtherHigh',180);
   if(v<70||v>=limit('glucoseCriticalHigh',250))return answer('red','Kritisch auffälliger Blutzucker – Wert prüfen und medizinisch abklären');
   if(v>high||((kind==='fasting'||kind==='before')&&v<limit('glucoseFastingLow',80)))return answer('yellow','Außerhalb des eingestellten Blutzucker-Zielbereichs');
   return answer('green','Im eingestellten Blutzucker-Orientierungsbereich');
 }
 if(['bp','bp-sys','bp-dia'].includes(type)){
   const sys=(type==='bp'||type==='bp-sys')&&valid('sys')?r.sys:null;
   const dia=(type==='bp'||type==='bp-dia')&&valid('dia')?r.dia:null;
   if(sys===null&&dia===null)return gray();
   if((sys!==null&&sys>=limit('bpCriticalSys',180))||(dia!==null&&dia>=limit('bpCriticalDia',110)))return answer('red','Sehr hoher Blutdruck – umgehend ärztlich abklären');
   if((sys!==null&&(sys>=limit('bpHighSys',135)||sys<limit('bpLowSys',90)))||(dia!==null&&(dia>=limit('bpHighDia',85)||dia<limit('bpLowDia',60))))return answer('yellow','Außerhalb des eingestellten Blutdruck-Orientierungsbereichs');
   return answer('green','Im eingestellten Blutdruck-Orientierungsbereich');
 }
 if(type==='pulse'){
   if(!valid('pulse'))return gray();
   const v=r.pulse;
   if(v<limit('pulseCriticalLow',40)||v>=limit('pulseCriticalHigh',130))return answer('red','Sehr auffälliger Puls – Situation und Beschwerden prüfen');
   if(v<limit('pulseLow',50)||v>limit('pulseHigh',100))return answer('yellow','Puls außerhalb des eingestellten Bereichs (Ruhe/Belastung beachten)');
   return answer('green','Puls im eingestellten Orientierungsbereich');
 }
 if(type==='weight'){
   const height=Number(data?.profile?.height),age=ageYears();
   if(!valid('kg')||!Number.isFinite(height)||height<120||height>250||age===null||age<18)return gray();
   const bmi=r.kg/((height/100)**2);
   if(bmi<17||bmi>=35)return answer('red','BMI '+nf(bmi,1)+': deutlich außerhalb des allgemeinen Erwachsenen-Orientierungsbereichs');
   if(bmi<18.5||bmi>=25)return answer('yellow','BMI '+nf(bmi,1)+': außerhalb des allgemeinen Erwachsenen-Orientierungsbereichs');
   return answer('green','BMI '+nf(bmi,1)+': innerhalb des allgemeinen Erwachsenen-Orientierungsbereichs');
 }
 if(type==='breathlessness'){
   if(!valid('breathlessness'))return gray();
   return r.breathlessness>=7?answer('red','Stark angegebene Atemnot'):r.breathlessness>=3?answer('yellow','Mäßig angegebene Atemnot'):answer('green','Geringe oder keine angegebene Atemnot');
 }
 if(type==='fev1Pct'){
   if(!valid('fev1Pct'))return gray();
   return r.fev1Pct<50?answer('red','FEV1-Prozentwert deutlich vermindert – ärztlich einordnen'):r.fev1Pct<80?answer('yellow','FEV1-Prozentwert vermindert – ärztlich einordnen'):answer('green','FEV1-Prozentwert mindestens 80 % – keine Entwarnung ohne Kontext');
 }
 if(type==='lab'){
   if(!valid('value')||r.comparator)return gray();
   const lo=Number.isFinite(r?.low)?r.low:null,hi=Number.isFinite(r?.high)?r.high:null;
   if(lo===null&&hi===null)return gray();
   if((lo!==null&&r.value<lo)||(hi!==null&&r.value>hi))return answer('yellow','Außerhalb der zum Befund eingetragenen Laborreferenz');
   return answer('green','Innerhalb der zum Befund eingetragenen Laborreferenz');
 }
 return gray();
}
function chartTrafficLegend(){
 return '<div class="vk-traffic-legend" aria-label="Ampel zur Orientierung">'+
 ['green','yellow','red','gray'].map((c,i)=>'<span><i class="vk-traffic-indicator vk-traffic-'+c+'"></i>'+['Im Orientierungsbereich','Auffällig / beachten','Deutlich auffällig','Nicht bewertbar'][i]+'</span>').join('')+
 '</div><p class="vk-traffic-disclaimer">Ampelfarben dienen der Orientierung, sind keine Diagnose und keine Entwarnung. Gruppierte Werte sind Durchschnittswerte; auffällige Einzelwerte können darin verborgen bleiben. Maßgeblich sind ärztlich vereinbarte Grenzen und Beschwerden.</p>';
}

const CHART_PERIODS=[['day','Tag'],['last7','Letzte 7 Tage'],['week','Woche'],['month','Monat'],['year','Jahr'],['ten','10 Jahre']];
let chartPeriods={glucose:'month',bp:'month','bp-sys':'month','bp-dia':'month',pulse:'month',weight:'month',asthma:'month',oxygen:'month',lab:'year'};
function chartPicker(type){const active=chartPeriods[type]||'month';return `<div class="subnav chart-periods" role="group" aria-label="Ansichtszeitraum für ${h(type)}">${CHART_PERIODS.map(([v,label])=>`<button type="button" data-chart-period="${v}" data-chart-type="${type}" aria-pressed="${v===active}" class="${v===active?'active':''}">${label}</button>`).join('')}</div>`+(type==='glucose'?vk207GlucosePicker():'')}
function chartMinDate(period){const d=new Date(), y=d.getFullYear(),m=d.getMonth(),day=d.getDate(), fmt=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
 if(period==='day')return fmt(d);
 if(period==='last7'){const x=new Date(y,m,day);x.setDate(x.getDate()-6);return fmt(x)}
 if(period==='week'){const x=new Date(y,m,day);x.setDate(x.getDate()-((x.getDay()+6)%7));return fmt(x)}
 if(period==='month')return fmt(new Date(y,m,1));
 if(period==='year')return fmt(new Date(y,0,1));
 if(period==='ten')return fmt(new Date(y-10,m,day));
 return '0000-00-00';}
function chartBucket(e,period){if(period==='ten')return e.date.slice(0,7);if(period==='year'){const date=new Date(e.date+'T12:00:00');date.setDate(date.getDate()-(date.getDay()+6)%7);return date.toLocaleDateString('sv-SE')}
 if(period==='day')return e.date+' '+(e.time||'00:00');return e.date;}
function chartAggregate(rows,type,period){
 // Nur tatsaechlich gespeicherte Werte, unveraendert und chronologisch.
 return [...rows].filter(r=>r&&typeof r.date==='string').sort(sortdate);
}
const recentItems=(rows,days)=>rows.filter(x=>x.date>=getWindowDate(days));
const confirmed=x=>x.verified===true;
const levelOrder={ok:0,watch:1,high:2,urgent:3};
function measureAnalysis(days='90'){
 const bp=data.measurements.filter(x=>x.type==='bp'&&confirmed(x)&&dateValid(x.date)&&Number.isFinite(x.sys)&&Number.isFinite(x.dia)),
       glu=data.measurements.filter(x=>x.type==='glucose'&&confirmed(x)&&dateValid(x.date)&&Number.isFinite(x.mgdl)),
       unverified=data.measurements.filter(x=>x.verified!==true),
       labUnverified=data.labs.filter(x=>x.verified!==true),
       windowBP=recentItems(bp,days),windowGlucose=recentItems(glu,days),
       pulse=windowBP.filter(x=>Number.isFinite(x.pulse)),
       s=data.settings;
 const flags=[], add=(level,title,reason,action)=>flags.push({level,title,reason,action});
 const avgSys=avg(windowBP.map(x=>x.sys)),avgDia=avg(windowBP.map(x=>x.dia)),avgPulse=avg(pulse.map(x=>x.pulse)),avgGlu=avg(windowGlucose.map(x=>x.mgdl));
 let bpElevated=windowBP.filter(x=>x.sys>=s.bpHighSys||x.dia>=s.bpHighDia).length;
 let bpVeryHigh=windowBP.filter(x=>x.sys>=180||x.dia>=110).length;
 let bpLow=windowBP.filter(x=>x.sys<s.bpLowSys||x.dia<s.bpLowDia).length;
 let pulseLow=pulse.filter(x=>x.pulse<s.pulseLow).length;
 let pulseHigh=pulse.filter(x=>x.pulse>s.pulseHigh).length;
 let pulseVery=pulse.filter(x=>x.pulse<s.pulseCriticalLow||x.pulse>=s.pulseCriticalHigh).length;
 let sugarLow=windowGlucose.filter(x=>x.mgdl<70).length,sugarVeryLow=windowGlucose.filter(x=>x.mgdl<54).length,
     sugarHigh=windowGlucose.filter(x=>x.mgdl>(x.period==='after'?s.glucoseAfterHigh:x.period==='fasting'||x.period==='before'?s.glucoseFastingHigh:s.glucoseOtherHigh)).length,
     sugarVeryHigh=windowGlucose.filter(x=>x.mgdl>=300).length;
 if(bpVeryHigh)add('urgent','Sehr hoher Blutdruck',`${bpVeryHigh} bestätigte Messung(en) mit mindestens 180 mmHg systolisch oder 110 mmHg diastolisch im gewählten Zeitraum.`, 'Bei aktuellen sehr hohen Werten nach Ruhe erneut messen und dringend medizinisch abklären. Bei Brustschmerzen, Atemnot, Lähmung oder neurologischen Ausfällen: 112.');
 if(sugarVeryLow)add('urgent','Starke Unterzuckerung',`${sugarVeryLow} bestätigte Messung(en) unter 54 mg/dl.`, 'Unterzuckerung unmittelbar nach individuellem Behandlungsplan behandeln; bei Bewusstlosigkeit oder Schluckstörung 112.');
 if(sugarVeryHigh)add('urgent','Sehr hoher Blutzucker',`${sugarVeryHigh} bestätigte Messung(en) ab 300 mg/dl.`, 'Bei Übelkeit, Erbrechen, schneller Atmung, Bewusstseinsstörung oder Ketonen dringend medizinische Hilfe. Ursachen ärztlich prüfen.');
 if(pulseVery)add('high','Stark auffälliger Puls',`${pulseVery} bestätigte Pulsmessung(en) außerhalb der eingestellten deutlichen Abweichungen.`, 'Messbedingungen und Medikamente ärztlich prüfen. Bei Ohnmacht, Brustschmerz oder schwerer Atemnot: 112.');
 if(windowBP.length>=3&&(avgSys>=s.bpHighSys||avgDia>=s.bpHighDia))add('high','Blutdruck im Durchschnitt erhöht',`Ø ${nf(avgSys,1)}/${nf(avgDia,1)} mmHg bei ${windowBP.length} Messungen; individueller Orientierungswert ${s.bpHighSys}/${s.bpHighDia}.`, 'Sieben-Tage-Messprotokoll nach ärztlicher Anleitung und ggf. 24-h-Blutdruckmessung besprechen. Keine eigenständige Dosisänderung.');
 else if(bpElevated)add('watch','Einzelne erhöhte Blutdruckwerte',`${bpElevated} von ${windowBP.length} Messungen über dem eingestellten Orientierungswert.`, 'Weiter dokumentieren und bei wiederholten Abweichungen Hausarzt kontaktieren.');
 if(bpLow)add('watch','Niedriger Blutdruck',`${bpLow} Messung(en) unter der persönlichen Untergrenze.`, 'Bei Schwindel, Stürzen oder Schwäche mit Arzt und Medikamentenplan abgleichen.');
 if(pulseLow||pulseHigh)add('watch','Puls außerhalb des Zielbereichs',`${pulseLow} niedrige und ${pulseHigh} hohe Pulswerte in ${pulse.length} Messungen.`, 'Ruhepuls, Symptome, Belastung und medikamentöse Ursachen im Arzttermin prüfen.');
 if(sugarLow>sugarVeryLow)add('high','Unterzuckerung',`${sugarLow} bestätigte Werte unter 70 mg/dl, davon ${sugarVeryLow} unter 54 mg/dl.`, 'Sofort nach individuellem Unterzuckerungsplan handeln; wiederkehrende Episoden mit der behandelnden Praxis besprechen.');
 if(sugarHigh)add('watch','Blutzucker über Orientierungswert',`${sugarHigh} von ${windowGlucose.length} bestätigten Blutzuckerwerten oberhalb der situativ eingestellten Grenze.`, 'Nüchternwerte getrennt von Nach-dem-Essen-Werten dokumentieren; HbA1c und Behandlung prüfen lassen.');
 const latestLab=new Map();for(const x of [...data.labs].filter(x=>confirmed(x)&&dateValid(x.date)&&Number.isFinite(x.value)).sort((a,b)=>a.date.localeCompare(b.date))){latestLab.set(x.name+'|'+x.unit,x)}
 const labs=[...latestLab.values()];
 const labOutside=labs.filter(x=>!x.comparator&&(Number.isFinite(x.low)&&x.value<x.low||Number.isFinite(x.high)&&x.value>x.high));
 const labWithReference=labs.filter(x=>Number.isFinite(x.low)||Number.isFinite(x.high));
 if(labOutside.length)add('watch','Laborwerte außerhalb des Befundbereichs',`${labOutside.length} der zuletzt bestätigten Laborwerte weichen vom eingetragenen Laborreferenzbereich ab.`, 'Mit Datum, Befund und Beschwerden ärztlich besprechen. Keine Diagnose aus einzelnen Laborwerten.');
 const psa=labs.filter(x=>/^PSA (gesamt|frei|frei\/gesamt)$/.test(x.name));
 const labWithoutReference=labs.length-labWithReference.length;
 let qualifiedCount=windowBP.length+windowGlucose.length+labs.length;
 let level=flags.reduce((a,x)=>levelOrder[x.level]>levelOrder[a]?x.level:a,'ok');
 if(qualifiedCount===0)level='none';
 const dates=[...windowBP,...windowGlucose].map(x=>x.date).sort();
 const lastDate=dates.at(-1)||null;
 return {days,bp:windowBP,glu:windowGlucose,pulse,labs,flags,labOutside,psa,labWithReference,labWithoutReference,unverified,labUnverified,avgSys,avgDia,avgPulse,avgGlu,bpElevated,bpVeryHigh,pulseLow,pulseHigh,pulseVery,sugarLow,sugarVeryLow,sugarHigh,sugarVeryHigh,level,qualifiedCount,lastDate};
}
const RESULT_LABELS={none:'Noch keine belastbare Gesamtauswertung',ok:'Keine Überschreitung der eingestellten Grenzen erkannt',watch:'Verlauf und Kontrolltermine prüfen',high:'Ärztliche Überprüfung empfohlen',urgent:'Dringende Auffälligkeiten im dokumentierten Verlauf'};
function preliminaryPhotoSummary(){
 const bp=data.measurements.filter(x=>x.type==='bp'&&x.verified!==true&&Number.isFinite(x.sys)&&Number.isFinite(x.dia));
 const gl=data.measurements.filter(x=>x.type==='glucose'&&x.verified!==true&&Number.isFinite(x.mgdl));
 if(!bp.length&&!gl.length)return '<p>Keine ungeprüften Messungen vorhanden.</p>';
 const pulse=bp.filter(x=>Number.isFinite(x.pulse));
 const summary=bp.length?`<p><b>${bp.length} ungeprüfte Blutdruckwerte:</b> Ø ${nf(avg(bp.map(x=>x.sys)),1)} / ${nf(avg(bp.map(x=>x.dia)),1)} mmHg, systolisch ${nf(Math.min(...bp.map(x=>x.sys)))}–${nf(Math.max(...bp.map(x=>x.sys)))}, diastolisch ${nf(Math.min(...bp.map(x=>x.dia)))}–${nf(Math.max(...bp.map(x=>x.dia)))}. ${pulse.length?`Puls Ø ${nf(avg(pulse.map(x=>x.pulse)),1)}/min (${pulse.length} Werte).`:''}</p>`:'';
 const glTxt=gl.length?`<p><b>${gl.length} ungeprüfte Blutzuckerwerte:</b> rechnerischer Durchschnitt ${nf(avg(gl.map(x=>x.mgdl)),1)} mg/dl (Messsituationen gemischt, teils unklare Originaleinheit).</p>`:'';
 return `<div class="notice info"><b>Nur vorläufige Foto-Auswertung – keine medizinische Bewertung.</b>${summary}${glTxt}<p>Ungeprüfte Werte werden nicht als sicherer Patientenbefund verwendet. Bitte in der jeweiligen Messwertliste über „Prüfen“ bestätigen oder korrigieren.</p></div>`;
}
function healthSummaryHtml(compact=false){const r=measureAnalysis(compact?'90':analysisDays);const recent=compact?r.flags.slice(0,3):r.flags;
 const status=r.level==='none'?'info':r.level==='urgent'?'danger':r.level==='high'?'warn':'info';
 const heading=`<div class="analysis-result status-${r.level}"><strong>${h(RESULT_LABELS[r.level])}</strong><p>${r.qualifiedCount} bestätigte Mess-/Laborwerte in der Auswertung · ${r.unverified.length} ungeprüfte Messungen · ${r.labUnverified.length} ungeprüfte Laboreinträge.</p><p class="section-note">Letzter bestätigter Messwert im Zeitraum: ${r.lastDate?fmtDate(r.lastDate):'keiner'}. Messwerte: gewählter Zeitraum. Laborwerte: jeweils der letzte bestätigte Befund pro Laborparameter, unabhängig vom Zeitraum.</p></div>`;
 const flags=recent.length?recent.map(f=>`<article class="analysis-flag"><strong>${h(f.title)}</strong><p>${h(f.reason)}</p><p><b>Empfehlung:</b> ${h(f.action)}</p></article>`).join(''):`<p>${r.qualifiedCount?'In den bestätigten Daten wurden keine Abweichungen der hier hinterlegten Regeln erkannt. Dies beweist nicht, dass alle Werte medizinisch unauffällig sind.':'Bitte Befunde und Fotoimporte prüfen und bestätigen. Ohne bestätigte Werte ist eine belastbare Gesamteinschätzung nicht möglich.'}</p>`;
 const go=compact?'<button type="button" class="primary" data-view="analysis">Gesamte Analyse & Arztbericht öffnen</button>':'';
 const missingRefs=r.labWithoutReference?`<p class="section-note"><strong>Eingeschränkte Laborbewertung:</strong> Für ${r.labWithoutReference} bestätigte Laborparameter fehlt ein Referenzbereich aus dem Originalbefund. Daraus kann die App keine Aussage „normal“ ableiten.</p>`:'';
 return heading+flags+missingRefs+`<p class="section-note">Kein diagnostischer Score. Eine alte kritische Messung bedeutet nicht automatisch einen aktuellen Notfall. Aktuelle Symptome haben immer Vorrang: Brustschmerz, schwere Atemnot, Lähmung, Bewusstseinsstörung → 112.</p>${go}`;
}
function analysisMetrics(r){return `<div class="main-grid">
 <div class="metric"><span>Blutdruck Ø</span><strong>${Number.isFinite(r.avgSys)?nf(r.avgSys,1)+' / '+nf(r.avgDia,1):'–'}</strong><small>mmHg · ${r.bp.length} bestätigt</small></div>
 <div class="metric"><span>Puls Ø</span><strong>${nf(r.avgPulse,1)}</strong><small>/min · ${r.pulse.length} bestätigt</small></div>
 <div class="metric"><span>Blutzucker Ø</span><strong>${nf(r.avgGlu,1)}</strong><small>mg/dl · ${r.glu.length} bestätigt; nüchtern / nach Essen gemischt</small></div>
 <div class="metric"><span>Letzte Laborwerte</span><strong>${r.labs.length}</strong><small>${r.labOutside.length} außerhalb eingegebener Referenz</small></div>
 </div>`}
function laboratoryReview(r){return r.labs.length?`<div class="table-wrap"><table><thead><tr><th>Laborwert (letzter bestätigter Befund)</th><th>Ergebnis</th><th>Datum</th><th>Einordnung</th></tr></thead><tbody>${r.labs.sort((a,b)=>a.name.localeCompare(b.name,'de')).map(x=>`<tr><td>${h(x.name)}</td><td>${labLabel(x)}</td><td>${fmtDate(x.date)}</td><td>${x.comparator?'Vergleichswert: ärztlich interpretieren':(Number.isFinite(x.low)||Number.isFinite(x.high))?(labIsOutside(x)?'<span class="status-pill status-high">Außerhalb Laborreferenz</span>':'Innerhalb eingetragener Laborreferenz'):'Kein Referenzbereich angegeben'}</td></tr>`).join('')}</tbody></table></div><p class="section-note">PSA, HbA1c, eGFR und andere Werte benötigen eine ärztliche Gesamteinordnung. Ein Wert im Referenzbereich schließt Erkrankungen nicht aus; unbekannte Bereiche werden nicht geschätzt.</p>`:'<p>Keine bestätigten Laborwerte vorhanden. Laborbefunde bitte zuerst anhand des Originals überprüfen.</p>'}
function medicineComparison(){const takes=data.medTakes.filter(x=>x.medId&&data.meds.some(m=>m.id===x.medId));if(!takes.length)return '<p>Keine dokumentierten Einnahmen. Bitte im Einnahmeprotokoll Datum, Uhrzeit und Medikament erfassen. Geplante Einnahmen allein werden nicht als tatsächlich eingenommen behandelt.</p>';
 const measurements=data.measurements.filter(x=>confirmed(x)&&['bp','glucose'].includes(x.type));
 const compare=takes.map(t=>{const tms=datetimeMs(t);const before=measurements.filter(x=>{const d=datetimeMs(x)-tms;return Number.isFinite(d)&&d>=-4*3600000&&d<0});const after=measurements.filter(x=>{const d=datetimeMs(x)-tms;return Number.isFinite(d)&&d>=0&&d<=4*3600000});const med=data.meds.find(m=>m.id===t.medId);return {t,med,before,after};});
 return `<p class="section-note">Vier-Stunden-Fenster vor/nach dokumentierten Einnahmen – reine zeitliche Darstellung, keine Aussage über Wirksamkeit oder Nebenwirkungen. Bei geplanter, aber nicht bestätigter Einnahme gibt es keinen Vergleich.</p><div class="table-wrap"><table><thead><tr><th>Einnahme</th><th>Blutdruck vorher / nachher</th><th>Puls vorher / nachher</th><th>Blutzucker vorher / nachher</th></tr></thead><tbody>${compare.slice(-35).reverse().map(v=>{const fmt=(type,field)=>{const a=v.before.filter(x=>x.type===type&&Number.isFinite(x[field])),b=v.after.filter(x=>x.type===type&&Number.isFinite(x[field]));return `${nf(avg(a.map(x=>x[field])),0)} (${a.length}) → ${nf(avg(b.map(x=>x[field])),0)} (${b.length})`};return `<tr><td><b>${h(v.med?.name||'Medikament')}</b><br>${fmtDate(v.t.date)} ${h(v.t.time)}</td><td>${fmt('bp','sys')} syst.<br>${fmt('bp','dia')} diast.</td><td>${fmt('bp','pulse')}</td><td>${fmt('glucose','mgdl')}</td></tr>`}).join('')}</tbody></table></div><p class="section-note">Eine Einnahme ohne begleitende Messungen liefert keine verwertbare Vergleichsbasis. Mahlzeiten, Belastung, Beschwerden und andere Medikamente beeinflussen die Werte ebenfalls.</p>`;
}
function reportFullHtml(){const r=measureAnalysis(analysisDays),s=data.symptoms.filter(x=>x.date>=getWindowDate(analysisDays)).sort(sortdate).reverse();return `<h2>${h(data.profile.name||'Patient nicht benannt')}</h2><p>Zeitraum für Messwerte: ${analysisDays==='all'?'gesamter Verlauf':analysisDays+' Tage'} · erstellt ${fmtDate(today())}. Nur bestätigte Messungen.</p>${healthSummaryHtml()}${analysisMetrics(r)}<h2>Symptome</h2>${s.length?s.slice(0,40).map(x=>`<p>${fmtDate(x.date)} ${h(x.time||'')} · ${h(x.kind)} (${h(x.severity)}) – ${h(x.notes||'')}</p>`).join(''):'<p>Keine Symptome eingetragen.</p>'}<h2>Letzte Laborwerte</h2>${laboratoryReview(r)}<h2>Medikamentenplan (bitte aktuell bestätigen)</h2>${data.meds.length?data.meds.map(x=>`<p>${h(x.name)} · ${h(x.dose)} · ${h(x.schedule)}</p>`).join(''):'<p>Keine Medikamente dokumentiert.</p>'}<h2>Medikamenten-Messwert-Zeitfenster</h2>${medicineComparison()}<h2>Qualitäts- und Trendbericht</h2>${proReportHtml()}<h2>GdB-/Teilhabe-Dokumentation</h2>${gdbReport().map(x=>`<p>${h(x)}</p>`).join('')}<p class="section-note">Ungeprüfte Daten: ${r.unverified.length} Messungen, ${r.labUnverified.length} Laborwerte. Medizinische Einschätzung, Dosisentscheidung und GdB-Feststellung bleiben zuständigen Fachpersonen vorbehalten.</p>`;}
function pageAnalysisOld(){const r=measureAnalysis(analysisDays);return tag('Gesundheitsanalyse & Ergebnis','Messwerte, Labor, Symptome und Medikamente nachvollziehbar auswerten. Kein automatischer medizinischer Befund.')+
 `<div class="subnav" aria-label="Analysezeitraum">${[['30','30 Tage'],['90','90 Tage'],['365','12 Monate'],['all','Alle Jahre']].map(([v,l])=>`<button type="button" class="${analysisDays===v?'active':''}" data-analysis-days="${v}">${l}</button>`).join('')}</div>`+
 panel('1 · Zusammenfassung & Handlung',healthSummaryHtml())+
 panel('2 · Zahlen im Überblick',analysisMetrics(r)+`<p><b>Hochdruck-Messungen:</b> ${r.bpElevated} von ${r.bp.length} · <b>Unterzuckerungen:</b> ${r.sugarLow} · <b>Ungeprüfte Daten:</b> ${r.unverified.length+r.labUnverified.length}</p>`)+
 panel('3 · Diagramme',chartPicker('bp')+lineChart('bp',chartPeriods['bp'],700)+chartPicker('pulse')+lineChart('pulse',chartPeriods['pulse'],700)+chartPicker('glucose')+lineChart('glucose',chartPeriods['glucose'],700))+
 panel('4 · Ungeprüfte Foto-Importe',preliminaryPhotoSummary())+
 panel('5 · Laborwerte im Detail',laboratoryReview(r))+
 panel('6 · Medikamente & Messwerte',medicineComparison())+
 panel('7 · Symptome & Arzttermin',`<p>${data.symptoms.length} Symptomeinträge insgesamt. ${data.reminders.filter(x=>!x.done&&x.date<=today()).length} offene / fällige Erinnerungen.</p><div class="actions"><button type="button" class="primary" data-view="symptoms">Symptome eintragen</button><button type="button" class="secondary" data-view="reminders">Kontrollen planen</button><button type="button" class="secondary" data-view="medlog">Einnahme eintragen</button></div>`)+
 panel('8 · Arztbericht / PDF',`<p>Der Arztbericht enthält Zahlen, Diagramme und Text zu ausgewählten Auswertungen, Symptomen, Laborwerten und Medikamenten. Auf iPhone: PDF erstellen, dann „Teilen / In Dateien sichern“.</p><button class="primary" type="button" data-action="print-full">Arztbericht drucken / als PDF speichern</button>`)+
 panel('Nachprüfbare Grundlagen',ANALYSIS_SOURCES.map(([title,url])=>`<p><a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(title)}</a></p>`).join(''));
}
function pageSymptoms(){const rows=[...data.symptoms].sort(sortdate).reverse();return tag('Symptomtagebuch','Beschwerden mit Datum, Uhrzeit und Intensität dokumentieren. Bei schweren Akutsymptomen sofort medizinische Hilfe holen.')+
 panel('Neues Symptom',`<form id="symptom-form"><div class="form-grid"><label class="field"><span>Datum</span><input type="date" name="date" required value="${today()}"></label><label class="field"><span>Uhrzeit</span><input type="time" name="time" required value="${nowTime()}"></label><label class="field"><span>Beschwerde</span><select name="kind"><option>Schwindel</option><option>Schwäche</option><option>Kopfschmerz</option><option>Atemnot</option><option>Herzrasen</option><option>Brustschmerz</option><option>Schwitzen / Zittern</option><option>Übelkeit</option><option>Schlafprobleme</option><option>Sturz / Ohnmacht</option><option>Sonstiges</option></select></label><label class="field"><span>Stärke</span><select name="severity"><option value="leicht">Leicht</option><option value="mittel">Mittel</option><option value="stark">Stark</option></select></label></div><label class="field"><span>Notizen: Situation, Dauer, Zusammenhang (optional)</span><textarea name="notes" maxlength="1200" placeholder="z. B. Schwindel beim Aufstehen, 5 Minuten"></textarea></label><button class="primary">Symptom speichern</button></form><p class="section-note">Bei akutem Brustschmerz, schwerer Atemnot, Schlaganfallzeichen, Bewusstlosigkeit: 112. Die App sendet keinen Notruf.</p>`)+
 panel(`Einträge (${rows.length})`,rows.length?`<div class="table-wrap"><table><thead><tr><th>Zeit</th><th>Symptom</th><th>Notiz</th><th></th></tr></thead><tbody>${rows.slice(0,100).map(x=>`<tr><td>${fmtDate(x.date)} ${h(x.time)}</td><td>${h(x.kind)} · ${h(x.severity)}</td><td>${h(x.notes)}</td><td><button type="button" class="dangerbutton" data-action="remove" data-type="symptom" data-id="${h(x.id)}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`:'<p>Noch keine Symptome.</p>');
}
function pageMedLog(){const rows=[...data.medTakes].sort(sortdate).reverse();return tag('Medikamenteneinnahmen','Tatsächliche Einnahmen erfassen; geplante Einnahmen werden nicht automatisch als genommen angenommen.')+
 panel('Einnahme dokumentieren',data.meds.length?`<form id="medtake-form"><div class="form-grid"><label class="field"><span>Medikament</span><select name="medId" required>${data.meds.map(x=>`<option value="${h(x.id)}">${h(x.name)} ${h(x.dose)}</option>`).join('')}</select></label><label class="field"><span>Datum</span><input type="date" name="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input type="time" name="time" value="${nowTime()}" required></label><label class="field"><span>Eingenommene Menge (optional)</span><input name="dose" maxlength="90" placeholder="z. B. 1 Tablette"></label></div><label class="field"><span>Hinweise</span><input name="notes" maxlength="350" placeholder="z. B. nach dem Frühstück"></label><button class="primary">Einnahme speichern</button></form>`:'<p>Bitte erst unter „Medikamente“ den Medikamentenplan anlegen.</p>')+
 panel('Zeitlicher Messwertvergleich',medicineComparison())+
 panel('Einnahmeverlauf',rows.length?`<div class="table-wrap"><table><thead><tr><th>Zeit</th><th>Medikament</th><th>Notiz</th><th></th></tr></thead><tbody>${rows.slice(0,100).map(x=>`<tr><td>${fmtDate(x.date)} ${h(x.time)}</td><td>${h(data.meds.find(m=>m.id===x.medId)?.name||'(Medikament gelöscht)')} ${h(x.dose||'')}</td><td>${h(x.notes||'')}</td><td><button class="dangerbutton" data-action="remove" data-type="medtake" data-id="${h(x.id)}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`:'<p>Noch keine dokumentierten Einnahmen.</p>')+
 panel('Sicherheit','<p>Die App erkennt keine vollständigen Arzneimittelwechselwirkungen und bewertet keine Therapie selbstständig. Auffällige Verläufe immer mit dem Medikamentenplan und der Praxis/Apotheke besprechen.</p>');
}
function pageRemindersOld(){const rows=[...data.reminders].sort((a,b)=>a.date.localeCompare(b.date));const due=rows.filter(x=>!x.done&&x.date<=today());return tag('Kontrollen & Erinnerungen','Kontrolltermine selbst festlegen. Erinnerungen erscheinen nur beim Öffnen der App; keine zuverlässigen Hintergrund-Benachrichtigungen.')+
 (due.length?warningBox(`${due.length} Kontrolle(n) sind fällig oder überfällig. Bitte Termine prüfen.`):'')+
 panel('Neue Kontrolle planen',`<form id="reminder-form"><div class="form-grid"><label class="field"><span>Art der Kontrolle</span><select name="kind"><option>Blutdruckkontrolle</option><option>Blutzucker / HbA1c</option><option>Nierenwerte & Elektrolyte</option><option>PSA / Urologie</option><option>Augenarzt</option><option>Fußuntersuchung</option><option>Hausarzttermin</option><option>Medikamentencheck</option><option>GdB / Bescheid</option><option>Sonstige Kontrolle</option></select></label><label class="field"><span>Fällig am</span><input type="date" name="date" value="${today()}" required></label></div><label class="field"><span>Notiz / ärztliches Intervall</span><input name="notes" maxlength="500" placeholder="Individuell von der Praxis festlegen"></label><button class="primary">Kontrolle speichern</button></form>`)+
 panel('Termine',rows.length?`<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Kontrolle</th><th>Status</th><th></th></tr></thead><tbody>${rows.slice(0,150).map(x=>`<tr><td>${fmtDate(x.date)}</td><td><b>${h(x.kind)}</b><br>${h(x.notes||'')}</td><td>${x.done?'Erledigt':x.date<=today()?'Fällig':'Geplant'}</td><td><button class="secondary" data-action="toggle-reminder" data-id="${h(x.id)}">${x.done?'Wieder öffnen':'Erledigt'}</button><button class="dangerbutton" data-action="remove" data-type="reminder" data-id="${h(x.id)}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`:'<p>Keine Kontrollen geplant.</p>');
}
const evidenceKinds=['GdB-Bescheid','Arztbericht','Schlaflabor/CPAP','Diabetes-Therapieplan','Laborbefund','Reha-Bericht','Bescheid Krankenkasse','Sonstiger Nachweis'];
function pageEvidence(){const rows=[...data.evidence].sort((a,b)=>String(b.date).localeCompare(String(a.date)));return tag('GdB-Nachweisordner','Arztberichte und Bescheide im verschlüsselten App-Speicher sammeln. Vor dem Import eines Dokuments ein Backup anlegen.')+
 panel('Neuen Nachweis hinzufügen',`<form id="evidence-form"><div class="form-grid"><label class="field"><span>Dokumentart</span><select name="kind">${evidenceKinds.map(x=>`<option>${h(x)}</option>`).join('')}</select></label><label class="field"><span>Datum des Dokuments</span><input name="date" type="date" value="${today()}" required></label></div><label class="field"><span>Kurzbeschreibung</span><input name="notes" maxlength="500" placeholder="z. B. schlafmedizinischer Befund"></label><label class="field"><span>Datei optional: PDF/JPG/PNG/TXT, maximal 1,5 MB</span><input type="file" name="document" accept=".pdf,.jpg,.jpeg,.png,.txt,application/pdf,image/jpeg,image/png,text/plain"></label><p class="section-note">Die Datei wird vollständig im Passwort-Tresor gespeichert und in verschlüsselte Backups aufgenommen. Bei vielen großen Dateien kann der Gerätespeicher volllaufen. Keine Cloud-Synchronisation.</p><button class="primary">Nachweis speichern</button></form>`)+
 panel(`Gespeicherte Nachweise (${rows.length})`,rows.length?`<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Art</th><th>Datei</th><th>Aktion</th></tr></thead><tbody>${rows.slice(0,100).map(x=>`<tr><td>${fmtDate(x.date)}</td><td><b>${h(x.kind)}</b><br>${h(x.notes||'')}</td><td>${h(x.filename||'Nur Notiz')}</td><td>${x.base64?`<button class="secondary" data-action="download-evidence" data-id="${h(x.id)}">Datei sichern</button>`:''}<button class="dangerbutton" data-action="remove" data-type="evidence" data-id="${h(x.id)}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`:'<p>Keine Nachweise vorhanden.</p>')+
 panel('GdB-Begründung & Antrag',`<p>Eine GdB-Höhe wird durch die zuständige Stelle nach der Versorgungsmedizin-Verordnung festgestellt. Messwerte allein reichen nicht. Wichtige Nachweise sind dauerhafte funktionelle Einschränkungen und ärztliche Berichte.</p><button class="secondary" data-view="gdb">GdB-Fragebogen öffnen</button>`);
}

function pageGdb(){const g=data.checks?.gdb||{};const opt=(v,label,current)=>`<option value="${v}" ${current===v?'selected':''}>${label}</option>`;return tag('GdB & Teilhabe – Orientierung','Keine automatische amtliche Einstufung. Fragebogen, individuelle Unterlagen und konkrete nächste Schritte.')+
warningBox('Blutzucker, Blutdruck und Puls allein erlauben keine verlässliche Berechnung eines GdB. Entscheidend sind Behandlung, dauerhafte Funktionsbeeinträchtigungen und ärztlich dokumentierte Folgen.')+
panel('1 · Gibt es schon einen Grad der Behinderung?',`<form id="gdb-form"><div class="form-grid"><label class="field"><span>GdB bereits anerkannt?</span><select name="existing">${opt('unknown','Bitte auswählen',g.existing)}${opt('yes','Ja',g.existing)}${opt('no','Nein',g.existing)}</select></label><label class="field"><span>Vorhandener GdB (falls ja)</span><input name="value" type="number" min="0" max="100" step="10" value="${h(g.value??'')}" placeholder="z. B. 30"></label><label class="field"><span>Gleichstellung</span><select name="equal">${opt('unknown','Unbekannt / keine Angabe',g.equal)}${opt('yes','Ja',g.equal)}${opt('no','Nein',g.equal)}</select></label><label class="field"><span>Diabetesbehandlung</span><select name="diabetes">${opt('unknown','Bitte wählen',g.diabetes)}${opt('tablets','Tabletten / Therapie ohne übliche Unterzuckerungsgefahr',g.diabetes)}${opt('risk','Unterzuckerungsgefährdende Therapie',g.diabetes)}${opt('intensive','Intensive Insulintherapie mit variabler Dosis',g.diabetes)}</select></label><label class="field"><span>Schlafapnoe (Schlaflabor)</span><select name="apnea">${opt('unknown','Bitte wählen',g.apnea)}${opt('cpap','CPAP / Überdruckbeatmung notwendig',g.apnea)}${opt('no','Keine Überdruckbeatmung notwendig',g.apnea)}${opt('notConfirmed','Nicht im Schlaflabor bestätigt',g.apnea)}</select></label><label class="field"><span>Organschäden ärztlich bestätigt?</span><select name="organ">${opt('unknown','Noch nicht bekannt',g.organ)}${opt('yes','Ja',g.organ)}${opt('no','Nein',g.organ)}</select></label><label class="field"><span>Deutliche dauerhafte Einschränkungen im Alltag?</span><select name="function">${opt('unknown','Bitte wählen',g.function)}${opt('yes','Ja',g.function)}${opt('no','Nein',g.function)}</select></label></div><label class="field"><span>Konkrete Einschränkungen und Befunde</span><textarea name="notes" maxlength="2000" placeholder="z. B. Schlaf, Atemnot, Stürze, Arztberichte, Unterzuckerungen, Einschränkungen beim Gehen">${h(g.notes||'')}</textarea></label><button class="primary">Angaben speichern und Einschätzung aktualisieren</button></form>`)+
panel('2 · Orientierung anhand deiner Angaben',`<div class="gdb-report">${gdbReport().map(x=>`<p>• ${x}</p>`).join('')}</div><div class="actions"><button class="primary" data-action="print-gdb">Einschätzung als PDF / Drucken</button></div>`)+
panel('Dokumentierte Nachweise',`<p>${data.evidence.length} Dokument(e) im verschlüsselten Nachweisordner gespeichert. <button class="secondary" data-view="evidence">Nachweise öffnen</button></p>`)+panel('3 · Antrag & Unterlagen',`<p><b>Empfohlene Nachweise:</b> aktueller GdB-Bescheid, ärztliche Berichte, Diabetes-Behandlungsplan und Hypoglykämieprotokolle, Schlaflaborbericht und CPAP-Verordnung, nachgewiesene Organfolgen sowie konkrete Einschränkungen.</p><p><a class="source" href="https://www.elsa.nrw.de/elsa/cgi-bin/elsa.php" target="_blank" rel="noopener noreferrer">NRW: Erst- oder Änderungsantrag (ELSA)</a></p><p class="section-note">Eine bloße GdB-Prognose ist keine Zusage. Die Entscheidung trifft die zuständige Stelle nach § 152 SGB IX und der Versorgungsmedizin-Verordnung.</p>`)}
function pageStartOld(){const g=latest('glucose'),b=latest('bp'),w=[...(data.weights||[])].sort(sortdate).at(-1),thisMonth=today().slice(0,7),gm=filtered('glucose').filter(x=>x.date.startsWith(thisMonth)),bm=filtered('bp').filter(x=>x.date.startsWith(thisMonth));let alerts=[];if(g)alerts.push(...glucoseWarnings(g));if(b)alerts.push(...bpWarnings(b));return tag('Guten Tag'+(data.profile.name?`, ${data.profile.name}`:''),'Die wichtigsten Werte auf einen Blick – große Schaltflächen für einen schnellen Eintrag.')+`<div class="main-grid"><div class="metric"><span>Letzter Blutzucker</span><strong>${g?nf(g.mgdl):'–'} <small>mg/dl</small></strong><small>${g?fmtDate(g.date):'Noch kein bestätigter Wert'}</small></div><div class="metric"><span>Letzter Blutdruck</span><strong>${b?`${nf(b.sys)}/${nf(b.dia)}`:'–'}</strong><small>${b?`${fmtDate(b.date)} · mmHg`:'Noch kein Wert'}</small></div><div class="metric"><span>Blutzucker diesen Monat</span><strong>${gm.length}</strong><small>Messungen inkl. ungeprüfter Importe</small></div><div class="metric"><span>Letztes Gewicht</span><strong>${w?nf(w.kg,1)+' kg':'–'}</strong><small>${w?fmtDate(w.date):'Noch keine Einträge'}</small></div><div class="metric"><span>Blutdruck diesen Monat</span><strong>${bm.length}</strong><small>Messungen</small></div></div><div class="biglinks" style="margin:16px 0"><button class="primary" data-view="glucose">+ Blutzucker eintragen</button><button class="primary" data-view="bp">+ Blutdruck eintragen</button><button class="primary" data-view="weight">+ Gewicht eintragen</button><button class="secondary" data-view="labs">+ Laboruntersuchung</button><button class="secondary" data-view="profile">Persönliche Daten ändern</button><button class="primary" data-view="analysis">Gesundheitsanalyse & Ergebnis</button><button class="primary" data-view="pro">Analyse Pro 1.8</button><button class="secondary" data-view="prevention">Vorsorge & Notfallplan</button><button class="secondary" data-view="symptoms">Symptomtagebuch</button><button class="secondary" data-view="medlog">Medikamenteneinnahme</button><button class="secondary" data-view="reminders">Kontrolltermine</button><button class="secondary" data-view="evidence">GdB-Nachweise</button><button class="secondary" data-view="gdb">GdB-Analyse</button><button class="secondary" data-view="emergency">Notfallpass öffnen</button></div>${alerts.map(a=>warningBox(a,a.includes('112')?'danger':'warn')).join('')}${profileCard()}${panel('Aktuelle Gesamteinschätzung',healthSummaryHtml(true))}${photoNote()}${panel('Blutzucker – letzter Verlauf',chartPicker('glucose')+lineChart('glucose',chartPeriods['glucose'],500))}${panel('Blutdruck – letzter Verlauf',chartPicker('bp')+lineChart('bp',chartPeriods['bp'],500))}${panel('Körpergewicht – Verlauf',chartPicker('weight')+weightChart(chartPeriods.weight,null,500,'all'))}${panel('Puls – Grenzlinien',chartPicker('pulse')+lineChart('pulse',chartPeriods['pulse'],500))}${panel('Wichtige Erinnerung','<p>Alle Ziel- und Grenzwerte sind nur allgemeine Orientierung und müssen mit der behandelnden Praxis an Alter, Diabetesverlauf und Begleiterkrankungen angepasst werden. Warnungen ersetzen keine ärztliche Versorgung. Bei akuten Beschwerden gilt 112.</p>')}`}

/* 1.8.4: Lokal verschlüsseltes Körpergewichtstagebuch; keine externen Bibliotheken. */
let weightMealFilter='all';
let weightSaveInProgress=false;
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
 const dots=rows.map((r,i)=>{const t=chartTraffic('weight',r,'kg');const desc=nf(r.kg,1)+' kg · '+fmtDate(r.date)+' '+(r.time||'')+' · '+t.label;return `<circle cx="${x(i)}" cy="${y(r.kg)}" r="5.1" tabindex="0" role="button" class="vk-chart-point" data-chart-info="${h(desc)}" fill="${VK_TRAFFIC_COLORS[t.level]}" stroke="white" stroke-width="1.6"><title>${h(desc)}${r._count>1?' · '+r._count+' Einträge':''}</title></circle>`}).join('');
 const indices=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
 const labels=indices.map(i=>`<text x="${x(i)}" y="${H-13}" text-anchor="middle" font-size="11" fill="#52677b">${period==='ten'?h(rows[i]._bucket):fmtDate(rows[i].date)}</text>`).join('');
 const diff=rows.length>1?rows.at(-1).kg-rows[0].kg:null;
 return `<div class="chartwrap"><svg class="chart" role="img" aria-label="Gewichtsverlauf in Kilogramm, ${rows.length} Punkte, durchgezogene Messlinie" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${grid}<line x1="${L}" x2="${L}" y1="${T}" y2="${H-B}" stroke="#7996a9"/>${path}${dots}${vk205PointLabels(rows.map((r,i)=>({x:x(i),y:y(r.kg),v:r.kg})),W,H,L,R,T,B,1)}${labels}</svg></div>${chartTrafficLegend()}<div class="legend"><span><i class="solid-line" style="border-color:#098879"></i>Körpergewicht in kg</span><span>${rows.length} Punkte${diff===null?'':` · Veränderung ${diff>0?'+':''}${nf(diff,1)} kg`}</span></div><p class="section-note">${explanation}. Die Gewichtsmesslinie ist durchgezogen; die Punkte haben BMI-Orientierungsfarben (nur bei vollständigen Erwachsenendaten). Für einen verlässlichen Verlauf möglichst immer zur gleichen Tageszeit wiegen.</p>`;
}
function weightTable(){
 const rows=[...(data.weights||[])].sort(sortdate).reverse().slice(0,100);
 if(!rows.length)return '<p>Noch keine Gewichtseinträge vorhanden.</p>';
 return `<div class="table-wrap"><table><thead><tr><th>Datum und Uhrzeit</th><th>Gewicht</th><th>Messzeitpunkt</th><th>Aktion</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtDate(r.date)} ${h(r.time)}</td><td><strong>${nf(r.kg,1)} kg</strong>${r.note?`<p class="section-note">${h(r.note)}</p>`:''}${vk201Files(r).length?`<small> · ${vk201Files(r).length} Anhang/Anhänge</small>`:''}</td><td>${h(bpMealLabels[r.mealTiming]||'Ohne Angabe')}</td><td><button class="secondary" type="button" data-action="vk201-edit" data-vk201-type="weight" data-id="${h(r.id)}">Bearbeiten</button> <button class="dangerbutton" type="button" data-action="remove" data-type="weight" data-id="${h(r.id)}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`;
}
function pageWeightOld(){
 const entries=[...(data.weights||[])].sort(sortdate),last=entries.at(-1);
 const options=Object.entries(bpMealLabels).filter(([k])=>k!=='unknown');
 return tag('Körpergewicht','Tägliches Gewichtstagebuch mit sechs Messzeitpunkten und sechs Diagrammansichten.')+
 `<div class="main-grid"><div class="metric"><span>Letzte Gewichtsmessung</span><strong>${last?nf(last.kg,1)+' kg':'–'}</strong><small>${last?fmtDate(last.date)+' · '+h(last.time):'Noch keine Messung'}</small></div><div class="metric"><span>Einträge</span><strong>${entries.length}</strong><small>Insgesamt dokumentiert</small></div></div>`+
 panel('Körpergewicht eintragen',`<form id="weight-form" novalidate><input name="id" type="hidden"><div class="form-grid"><label class="field"><span>Datum</span><input name="date" type="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input name="time" type="time" value="${nowTime()}" required></label><label class="field"><span>Körpergewicht (kg)</span><input name="kg" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" required placeholder="z. B. 130,5" aria-describedby="weight-input-help"></label><label class="field"><span>Wann gewogen?</span><select name="mealTiming" required>${options.map(([k,v])=>`<option value="${k}">${h(v)}</option>`).join('')}</select></label><label class="field"><span>Notiz (optional)</span><input name="note" maxlength="300" placeholder="z. B. nach dem Aufstehen"></label></div><p id="weight-input-help" class="section-note">Eingabe mit Komma oder Punkt möglich, z. B. 130,5 oder 130.5 kg.</p><div class="actions"><button class="primary" type="button" data-action="save-weight">Gewicht speichern</button></div><p id="weight-save-feedback" class="vk-save-feedback" role="status" aria-live="polite"></p></form><p class="section-note">Mehrere Messungen pro Tag sind möglich. Gespeicherte Werte kannst du unten bearbeiten und löschen.</p>`)+
 panel('Gewichtsdiagramm',chartPicker('weight')+`<label class="field weight-filter"><span>Messzeitpunkt im Diagramm</span><select id="weight-meal-filter"><option value="all" ${weightMealFilter==='all'?'selected':''}>Alle Messzeitpunkte</option>${options.map(([k,v])=>`<option value="${k}" ${weightMealFilter===k?'selected':''}>${h(v)}</option>`).join('')}</select></label>`+weightChart(chartPeriods.weight,null,720,weightMealFilter))+
 panel('Gewichtstagebuch · letzte 100 Einträge',weightTable());
}
function syncProfileWeight(){
 const last=[...(data.weights||[])].sort(sortdate).at(-1);
 data.profile.weight=last?String(last.kg):'';
}
function weightReportBlock(entries){
 const rows=[...entries].sort(sortdate),w=groupStats(rows,'kg');
 const diff=rows.length>1?rows.at(-1).kg-rows[0].kg:null;
 return `<h3>Körpergewicht im Berichtszeitraum</h3><p>${rows.length} Messungen an ${new Set(rows.map(r=>r.date)).size} Tagen · Durchschnitt ${nf(w[1],1)} kg · Minimum ${nf(w[2],1)} kg · Maximum ${nf(w[3],1)} kg${diff===null?'':` · Veränderung von erster zu letzter Messung ${diff>0?'+':''}${nf(diff,1)} kg`}</p>${weightChart(reportPeriod,rows,700,'all')}<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Uhrzeit</th><th>Gewicht</th><th>Messzeitpunkt</th></tr></thead><tbody>${rows.slice(-120).reverse().map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${h(x.time)}</td><td>${nf(x.kg,1)} kg</td><td>${h(bpMealLabels[x.mealTiming]||'Keine Angabe')}</td></tr>`).join('')}</tbody></table></div><p class="section-note">Ab 121 Messungen zeigt diese Einzeltabelle nur die 120 letzten Einträge im Berichtszeitraum. Alle Werte bleiben gespeichert.</p>`;
}
function backupPanels(){
 return `<div class="backup-grid">${panel('Backup erstellen',`<div class="backup-card backup-save"><div class="backup-head"><span class="backup-symbol" aria-hidden="true">↓</span><div><strong>Alle Gesundheitsdaten sichern</strong><p>Verschlüsselte Datei einschließlich Körpergewicht und bisherigen Daten erstellen.</p></div></div><button type="button" data-action="backup" class="primary backup-button">1. Verschlüsseltes Backup vorbereiten</button><div id="backup-ready" class="backup-ready" ${stagedBackupFile?'':'hidden'}><strong>2. Backup auf dem iPhone speichern</strong><p>Mit „In Dateien sichern“ öffnet sich das iPhone-Teilen-Menü. Dort „In Dateien sichern“ auswählen und den gewünschten Speicherort festlegen.</p><div class="backup-save-actions"><button type="button" data-action="backup-share" class="primary backup-button">In Dateien sichern (iPhone)</button><button type="button" data-action="backup-download" class="secondary backup-button">Alternative: Datei herunterladen</button></div></div><p id="backup-save-status" class="section-note" role="status">Das aktuelle VitalKompass-Passwort wird zum Wiederherstellen benötigt. Bitte prüfen, ob die Backup-Datei in der Dateien-App vorhanden ist. Niemals private Backups bei GitHub hochladen.</p></div>`)}${panel('Backup importieren',`<div class="backup-card backup-import"><div class="backup-head"><span class="backup-symbol" aria-hidden="true">↑</span><div><strong>Alte Sicherung wiederherstellen</strong><p>Backup aus „Dateien“ auswählen und mit dem ursprünglichen Passwort öffnen.</p></div></div><form id="restore-form"><label class="field"><span>Backup aus der iPhone-App „Dateien“ wählen (.json)</span><input name="file" type="file" accept=".json,application/json" required></label><label class="field"><span>Passwort der Backup-Datei</span><input name="password" type="password" autocomplete="off" required></label><label class="backup-confirm"><input type="checkbox" name="confirmReplace" required><span>Ich weiß, dass die vorhandenen Daten vollständig ersetzt werden, und habe meinen aktuellen Datenstand gesichert.</span></label><button type="submit" class="dangerbutton backup-button">Backup importieren und Daten ersetzen</button></form><p class="section-note">Die Datei wird vor dem Import entschlüsselt und geprüft (bis 32 MB). Erst nach zusätzlicher Rückfrage erfolgt die Überschreibung. Frühere Backup-Versionen bleiben kompatibel.</p></div>`)}</div>`;
}

/* VitalKompass 1.9.0 — Zusatzfunktionen, keine externe Verbindung, keine automatische Sperre. */
let reportChoice={bp:true,glucose:true,weight:true,asthma:true,labs:true,meds:true};
const ASTHMA_TRIGGERS={heat:'Hitze',cold:'Kälte',pollen:'Pollen',effort:'Belastung',dust:'Staub',infection:'Infekt',other:'Sonstiges'};
const rangeDays=(d)=>{let v=new Date(today()+'T12:00:00');v.setDate(v.getDate()-(d-1));return v.toLocaleDateString('sv-SE')};
function vkStats(rows,key){const vals=rows.map(x=>x[key]).filter(Number.isFinite);return {n:vals.length,mean:avg(vals),min:vals.length?Math.min(...vals):NaN,max:vals.length?Math.max(...vals):NaN};}
function vkLastWeight(){return [...(data.weights||[])].sort(sortdate).at(-1)}
function vkWeightGoal(){const last=vkLastWeight(),goal=nval(data.settings.goalWeightKg),start=nval(data.settings.goalStartWeightKg),goalDate=data.settings.goalDate||'';
 if(!Number.isFinite(goal)||goal<20||goal>400)return '<p class="section-note">Noch kein Gewichtsziel festgelegt. Das ist freiwillig.</p>';
 const diff=last?last.kg-goal:null;
 let p='';if(last&&Number.isFinite(start)&&start!==goal){let done=Math.max(0,Math.min(100,Math.round(100*(start-last.kg)/(start-goal))));p=`<div class="vk-progress" role="progressbar" aria-label="Gewichtsziel Fortschritt" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="100"><span style="width:${done}%"></span></div><p>${done}% des Weges vom gewählten Startgewicht zum Ziel erreicht.</p>`}
 return `<p><strong>Ziel: ${nf(goal,1)} kg</strong>${goalDate?' · Wunschdatum: '+fmtDate(goalDate):''}</p><p>${last?'Letzter Eintrag: '+nf(last.kg,1)+' kg · Abstand zum Ziel: '+nf(Math.abs(diff),1)+' kg':'Noch keine Gewichtsmessung gespeichert.'}</p>${p}<p class="section-note">Eine Zielgewichtseinstellung ist keine medizinische Empfehlung. Veränderungen über längere Zeit betrachten.</p>`;
}
function vkWeightGoalPanel(){return panel('Persönliches Gewichtsziel',`${vkWeightGoal()}<form id="weight-goal-form"><div class="form-grid"><label class="field"><span>Startgewicht (kg, optional)</span><input name="goalStartWeightKg" type="text" inputmode="decimal" autocomplete="off" value="${h(data.settings.goalStartWeightKg??'')}"></label><label class="field"><span>Zielgewicht (kg, optional)</span><input name="goalWeightKg" type="text" inputmode="decimal" autocomplete="off" value="${h(data.settings.goalWeightKg??'')}"></label><label class="field"><span>Wunschdatum (optional)</span><input name="goalDate" type="date" value="${h(data.settings.goalDate||'')}"></label></div><button type="submit" class="secondary">Gewichtsziel speichern</button></form>`)}
function vkMiniTrend(rows,value,label,unit,period='month',wide=700){
 let arr=rows.filter(r=>Number.isFinite(r[value])).sort(sortdate);
 if(!arr.length)return `<p class="section-note">Keine ${h(label)}-Werte im ausgewählten Zeitraum.</p>`;
 let buckets=new Map();for(const r of arr){let k=r.date;if(period==='year'){let d=new Date(k+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);k=d.toLocaleDateString('sv-SE')}if(period==='ten')k=k.slice(0,7);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r[value]);}
 if(period!=='day')arr=[...buckets].map(([k,vs])=>({date:k.length===7?k+'-01':k,time:'',[value]:avg(vs)}));
 const W=wide,H=230,L=50,R=14,T=20,B=38,P=W-L-R,Q=H-T-B;const vals=arr.map(x=>x[value]);const low=Math.min(...vals)-Math.max(1,(Math.max(...vals)-Math.min(...vals))*.15),high=Math.max(...vals)+Math.max(1,(Math.max(...vals)-Math.min(...vals))*.15);
 const x=i=>L+(arr.length===1?P/2:P*i/(arr.length-1)),y=v=>T+Q-(v-low)/(high-low)*Q;
 const path=arr.length>1?`<polyline fill="none" stroke="#1764a9" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" points="${arr.map((r,i)=>x(i)+','+y(r[value])).join(' ')}"/>`:'';
 const dots=arr.map((r,i)=>{const kind=value==='pulse'?'pulse':value==='breathlessness'?'breathlessness':value==='fev1Pct'?'fev1Pct':'peakFlow';const t=chartTraffic(kind,r,value);const desc=label+': '+nf(r[value],1)+' '+unit+' · '+fmtDate(r.date)+' · '+t.label;return `<circle class="vk-chart-point" tabindex="0" role="button" data-chart-info="${h(desc)}" cx="${x(i)}" cy="${y(r[value])}" r="5.2" fill="${VK_TRAFFIC_COLORS[t.level]}" stroke="#fff" stroke-width="1.4"><title>${h(desc)}</title></circle>`}).join('');
 return `<div class="chartwrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${h(label)} in ${h(unit)}"><line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#8da4b7"/><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#8da4b7"/>${path}${dots}${vk205PointLabels(arr.map((r,i)=>({x:x(i),y:y(r[value]),v:r[value]})),W,H,L,R,T,B,1)}<text x="${L}" y="${H-10}" fill="#52677b" font-size="11">${fmtDate(arr[0].date)}</text><text x="${W-R}" y="${H-10}" text-anchor="end" fill="#52677b" font-size="11">${fmtDate(arr.at(-1).date)}</text></svg></div>${chartTrafficLegend()}<p class="section-note">${h(label)} · ${arr.length} Punkte · Mittel ${nf(avg(vals),1)} ${h(unit)}. Messpunkte antippen, um Werte anzuzeigen.</p>`;
}
function vkAsthmaRows(period='month'){return (data.asthmaLogs||[]).filter(x=>x.date>=chartMinDate(period)&&x.date<=today()).sort(sortdate)}
function vkAsthmaTable(rows){if(!rows.length)return '<p>Keine Asthma-Einträge vorhanden.</p>';
 return `<div class="table-wrap"><table><thead><tr><th>Zeitpunkt</th><th>Atemnot (0–10)</th><th>Bedarf</th><th>Peak-Flow</th><th>FEV1</th><th>Auslöser / Notiz</th><th>Aktion</th></tr></thead><tbody>${[...rows].sort(sortdate).reverse().slice(0,120).map(r=>`<tr><td>${fmtDate(r.date)} ${h(r.time)}</td><td>${nf(r.breathlessness)}</td><td>${nf(r.rescueUses)} Anwendungen</td><td>${Number.isFinite(r.peakFlow)?nf(r.peakFlow)+' l/min':'–'}</td><td>${Number.isFinite(r.fev1Pct)?nf(r.fev1Pct,1)+' %':'–'}</td><td>${h((r.triggers||[]).map(k=>ASTHMA_TRIGGERS[k]||'').filter(Boolean).join(', '))}${r.note?' · '+h(r.note):''}</td><td><button data-action="edit-asthma" data-id="${h(r.id)}" class="secondary" type="button">Auslöser bearbeiten</button> <button data-action="vk201-edit" data-vk201-type="asthma" data-id="${h(r.id)}" class="secondary" type="button">Werte / Anhänge</button><button data-action="remove" data-type="asthma" data-id="${h(r.id)}" type="button" class="dangerbutton">Löschen</button></td></tr>`).join('')}</tbody></table></div>`;
}
function vkAsthmaStats(rows){let rescue=vkStats(rows,'rescueUses'),sym=vkStats(rows,'breathlessness'),pef=vkStats(rows,'peakFlow');return `<div class="main-grid"><div class="metric"><span>Dokumentierte Tage</span><strong>${new Set(rows.map(x=>x.date)).size}</strong></div><div class="metric"><span>Bedarf insgesamt</span><strong>${rows.reduce((n,r)=>n+r.rescueUses,0)}</strong><small>Anwendungen laut Eingabe</small></div><div class="metric"><span>Atemnot-Mittel</span><strong>${nf(sym.mean,1)}/10</strong><small>${sym.n} Einträge</small></div><div class="metric"><span>Peak-Flow-Mittel</span><strong>${nf(pef.mean,0)}</strong><small>l/min, ${pef.n} Messungen</small></div></div><p class="section-note">Der Durchschnitt ersetzt keine ärztliche Bewertung. Fehlende Einträge bedeuten nicht Beschwerdefreiheit.</p>`}
function pageAsthma(){const rows=vkAsthmaRows(chartPeriods.asthma||'month');return tag('Asthma-Tagebuch','Beschwerden, Bedarfsmedikation, Peak-Flow und Lungenfunktion freiwillig dokumentieren.')+
 '<div class="notice info"><strong>Wichtig:</strong> Bei akuter schwerer Atemnot medizinische Notfallhilfe (112) holen. Die App berechnet keine Medikamentendosis und ersetzt keinen ärztlichen Asthma-Aktionsplan.</div>'+
 panel('Asthma-Eintrag',`<form id="asthma-form"><input name="id" type="hidden"><div class="form-grid"><label class="field"><span>Datum</span><input type="date" name="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input type="time" name="time" value="${nowTime()}" required></label><label class="field"><span>Atemnot (0 = keine, 10 = maximal)</span><input type="number" name="breathlessness" min="0" max="10" step="1" required></label><label class="field"><span>Anwendungen Bedarfsmedikament seit letztem Eintrag</span><input type="number" name="rescueUses" min="0" max="50" step="1" required value="0"></label><label class="field"><span>Peak-Flow (l/min, optional)</span><input type="number" name="peakFlow" min="50" max="1000" step="1" inputmode="numeric"></label><label class="field"><span>FEV1 (% Soll, optional)</span><input type="number" name="fev1Pct" min="5" max="140" step="0.1" inputmode="decimal"></label></div><fieldset class="vk-fieldset"><legend>Mögliche Auslöser (Mehrfachauswahl)</legend>${Object.entries(ASTHMA_TRIGGERS).map(([v,t])=>`<label><input type="checkbox" name="trigger" value="${v}"> ${h(t)}</label>`).join('')}</fieldset><label class="field"><span>Weitere Notizen (optional)</span><textarea name="note" maxlength="1000" rows="3" placeholder="Bewegung, Beschwerden, ärztlich besprochene Maßnahmen"></textarea></label><button class="primary" type="submit">Asthma-Eintrag speichern</button></form>`)+
 panel('Asthma-Auswertung',chartPicker('asthma')+vkAsthmaStats(rows)+`<h3>Peak-Flow</h3>${vkMiniTrend(rows,'peakFlow','Peak-Flow','l/min',chartPeriods.asthma||'month')}<h3>Atemnot</h3>${vkMiniTrend(rows,'breathlessness','Atemnot','/10',chartPeriods.asthma||'month')}`)+panel('Asthma-Verlauf',vkAsthmaTable(data.asthmaLogs||[]));}
function vkMedStockPanel(){const medicines=data.meds||[],stocks=data.medStocks||{};
 if(!medicines.length)return panel('Medikamentenvorrat','<p>Bitte zuerst Medikamente im Medikamentenplan erfassen.</p>');
 const rows=medicines.map(m=>{const s=stocks[m.id]||{},n=nval(s.count),min=nval(s.min),low=Number.isFinite(n)&&Number.isFinite(min)&&n<=min;return `<tr><td>${h(m.name)}</td><td>${Number.isFinite(n)?nf(n,0):'–'} ${h(s.unit||'Einheiten')}</td><td>${Number.isFinite(min)?nf(min,0):'–'}</td><td>${low?'<span class="chip amber">Bestand prüfen</span>':'–'}</td></tr>`});
 return panel('Medikamentenvorrat – manuell gepflegt',`<p class="section-note">Keine automatische Abbuchung oder Berechnung der verbleibenden Tage: Einnahmen können unterschiedlich dosiert sein.</p><form id="med-stock-form"><div class="form-grid"><label class="field"><span>Medikament</span><select name="medId" required>${medicines.map(m=>`<option value="${h(m.id)}">${h(m.name)}</option>`).join('')}</select></label><label class="field"><span>Vorhandene Einheiten</span><input type="number" name="count" min="0" max="100000" step="1" required></label><label class="field"><span>Hinweis ab Stückzahl</span><input type="number" name="min" min="0" max="100000" step="1" required value="5"></label><label class="field"><span>Einheit</span><select name="unit"><option>Tabletten</option><option>Hübe</option><option>Ampullen</option><option>Stück</option></select></label></div><button class="secondary" type="submit">Vorrat aktualisieren</button></form><div class="table-wrap"><table><thead><tr><th>Medikament</th><th>Vorrat</th><th>Hinweisgrenze</th><th>Status</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`)}
function vkReminderPanel(){return panel('Erinnerungen für Messungen',`<p class="section-note">Erinnerungen erscheinen beim Öffnen von VitalKompass. Offene Termine lassen sich über den vorhandenen Kalenderexport in den iPhone-Kalender übernehmen. Automatische Hintergrund-Pushs werden nicht versprochen.</p><form id="measurement-reminder-form"><div class="form-grid"><label class="field"><span>Was soll gemessen werden?</span><select name="kind"><option value="Gewichtskontrolle">Gewicht</option><option value="Blutdruckkontrolle">Blutdruck</option><option value="Blutzuckerkontrolle">Blutzucker</option><option value="Asthmakontrolle">Asthma / Peak-Flow</option></select></label><label class="field"><span>Datum</span><input name="date" type="date" value="${today()}" required></label><label class="field"><span>Notiz (optional)</span><input name="notes" maxlength="300"></label></div><button class="secondary" type="submit">Erinnerung hinzufügen</button></form>`)}
function vkDashboard(){const w=vkLastWeight(),start=rangeDays(30),asthma=(data.asthmaLogs||[]).filter(x=>x.date>=start).sort(sortdate),a=asthma.at(-1);let stocks=(data.meds||[]).map(m=>(data.medStocks||{})[m.id]).filter(s=>s&&Number.isFinite(Number(s.count))&&Number.isFinite(Number(s.min))&&Number(s.count)<=Number(s.min));const old=(data.weights||[]).filter(x=>x.date>=start).sort(sortdate),delta=old.length>1?old.at(-1).kg-old[0].kg:null;
 return panel('Mein Gesundheitsüberblick · 30 Tage',`<div class="main-grid"><div class="metric"><span>Gewicht</span><strong>${w?nf(w.kg,1)+' kg':'–'}</strong><small>${delta===null?'Noch keine Verlaufsaussage':(delta>0?'+':'')+nf(delta,1)+' kg seit erstem Eintrag im Zeitraum'}</small></div><div class="metric"><span>Asthma-Einträge</span><strong>${asthma.length}</strong><small>${a?'Zuletzt Atemnot '+nf(a.breathlessness)+'/10':'Noch keine Einträge'}</small></div><div class="metric"><span>Dokumentierter Bedarf</span><strong>${asthma.reduce((n,r)=>n+r.rescueUses,0)}</strong><small>Bedarfsanwendungen in erfassten Asthma-Einträgen</small></div><div class="metric"><span>Bestand prüfen</span><strong>${stocks.length}</strong><small>Medikamente an/unter Hinweisgrenze</small></div></div><p class="section-note">Keine Diagnostik. Unterschiedliche Messzeiten, fehlende Tage und Medikamente beeinflussen die Vergleichbarkeit.</p>`)}
function vkPeriodComparison(){
 const categories=[['Körpergewicht','kg',data.weights||[],'kg'],['Systolischer Blutdruck','mmHg',filtered('bp').filter(x=>x.verified===true),'sys'],['Blutzucker','mg/dl',filtered('glucose').filter(x=>x.verified===true),'mgdl'],['Atemnot','/10',data.asthmaLogs||[],'breathlessness']];
 const section=days=>{
  const recent=rangeDays(days),prior=rangeDays(days*2);
  return `<h3>Vergleich über ${days} Tage</h3><div class="table-wrap"><table><thead><tr><th>Messwert</th><th>Vorherige ${days} Tage</th><th>Letzte ${days} Tage</th><th>Veränderung</th></tr></thead><tbody>${categories.map(([title,unit,all,key])=>{const a=vkStats(all.filter(x=>x.date>=prior&&x.date<recent),key),b=vkStats(all.filter(x=>x.date>=recent&&x.date<=today()),key),diff=a.n&&b.n?b.mean-a.mean:null;return `<tr><td>${h(title)}</td><td>${nf(a.mean,1)} ${h(unit)} (${a.n})</td><td>${nf(b.mean,1)} ${h(unit)} (${b.n})</td><td>${diff===null?'–':(diff>0?'+':'')+nf(diff,1)+' '+h(unit)}</td></tr>`}).join('')}</tbody></table></div>`;
 };
 return panel('Messwerte vergleichen – 30 und 90 Tage',section(30)+section(90)+'<p class="section-note">Rein deskriptiver Vergleich dokumentierter Werte. Fehlende Messungen, Wiegezeit und Medikamente können den Vergleich beeinflussen; aus Trends allein lässt sich keine Ursache oder Diagnose ableiten.</p>');
}
function vkDocRows(from,to){return {weight:(data.weights||[]).filter(x=>between(x,from,to)),asthma:(data.asthmaLogs||[]).filter(x=>between(x,from,to)),glucose:filtered('glucose').filter(x=>between(x,from,to)&&x.verified===true),bp:filtered('bp').filter(x=>between(x,from,to)&&x.verified===true),labs:(data.labs||[]).filter(x=>between(x,from,to)&&x.verified===true)}}
function vkDoctorHtml(from,to,choice){const r=vkDocRows(from,to),name=h(data.profile.name||'Nicht angegeben');let out=`<h2>Gesundheitsbericht · ${name}</h2><p>Dokumentierter Zeitraum ${fmtDate(from)} bis ${fmtDate(to)}. Erstellt am ${fmtDate(today())}. Nur ausgewählte Bereiche. Kein medizinischer Befund.</p>`;
 if(choice.weight){const q=vkStats(r.weight,'kg');out+=`<h3>Körpergewicht</h3><p>${q.n} Einträge · Durchschnitt ${nf(q.mean,1)} kg · Min ${nf(q.min,1)} kg · Max ${nf(q.max,1)} kg</p>${vkMiniTrend(r.weight,'kg','Gewicht','kg','month')}`}
 if(choice.asthma){out+='<h3>Asthma-Dokumentation</h3>'+vkAsthmaStats(r.asthma)+vkAsthmaTable(r.asthma)}
 if(choice.bp){const q=vkStats(r.bp,'sys');out+=`<h3>Blutdruck</h3><p>${q.n} bestätigte Messungen · mittlerer systolischer Wert ${nf(q.mean,1)} mmHg</p>`}
 if(choice.glucose){const q=vkStats(r.glucose,'mgdl');out+=`<h3>Blutzucker</h3><p>${q.n} bestätigte Messungen · mittlerer Wert ${nf(q.mean,1)} mg/dl</p>`}
 if(choice.labs){out+=`<h3>Laborwerte</h3><div class="table-wrap"><table><thead><tr><th>Datum</th><th>Parameter</th><th>Wert</th></tr></thead><tbody>${r.labs.slice(-100).map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${h(x.name)}</td><td>${labLabel(x)}</td></tr>`).join('')}</tbody></table></div>`}
 if(choice.meds){out+='<h3>Medikamentenplan – aktueller dokumentierter Stand</h3><p>'+data.meds.map(m=>`${h(m.name)} · ${h(m.dose||'')} · ${h(m.schedule||'')}`).join('; ')+'</p>'}
 return out+'<p class="section-note">Die Datei enthält sensible Gesundheitsdaten, ist unverschlüsselt und sollte nur an berechtigte Empfänger weitergegeben werden. Medizinische Entscheidungen nur durch Fachpersonal.</p>';
}
/* VK200 MODULE BEGIN - Urologie, Nüchtern-Erklärungen und Einzel-/Sammelberichte. */
const VK_URO_KINDS={
 prostate:'Prostata / gutartige Vergrößerung', prostatitis:'Prostataentzündung / Beckenschmerz', psa:'PSA-Besprechung / Vorsorge', cancer:'Prostatakrebs / Nachsorge',
 urgency:'Starker Harndrang', frequency:'Häufiges Wasserlassen', nocturia:'Nächtliches Wasserlassen', stream:'Schwacher / unterbrochener Harnstrahl', residual:'Restharngefühl / Restharn',
 pain:'Brennen / Schmerzen beim Wasserlassen', urine_blood:'Sichtbares Blut im Urin', infection:'Harnwegsinfekt', incontinence:'Ungewollter Urinverlust', retention:'Harnverhalt / Entleerungsstörung',
 bladder:'Harnblase / Blasenspiegelung', kidney:'Niere / Nierenwerte', stone:'Nieren- oder Harnleiterstein', urethra:'Harnröhre', sexual:'Sexualfunktion / Erektion',
 testis:'Hoden / Nebenhoden', exam:'Urologischer Befund / Untersuchung', therapy:'Behandlung / Medikament / Operation', other:'Sonstige Urologie'
};
const VK_IPSS_FIELDS=[
 'Gefühl, die Blase nicht vollständig zu entleeren', 'Erneutes Wasserlassen in weniger als zwei Stunden',
 'Unterbrechungen des Harnstrahls', 'Schwer aufschiebbarer Harndrang', 'Schwacher Harnstrahl',
 'Pressen, um das Wasserlassen zu beginnen', 'Nächtliche Toilettengänge'
];
const VK_REPORT_TOPICS=[
 ['glucose','Blutzucker','Messwerte und Diagramm'],['bp','Blutdruck','Systolisch und diastolisch mit Diagramm'],['pulse','Puls','Verlauf mit Diagramm'],
 ['weight','Körpergewicht','Gewichtstagebuch und Diagramm'],['oxygen','Blutsauerstoff & PI','SpO₂- und PI-Diagramme mit Statistik'],['hospital','Krankenhausaufenthalte','Aufenthalte und dokumentierte Befunde'],['asthma','Asthma','Symptome, Peak-Flow und FEV1-Verlauf'],['urology','Urologie & Prostata','PSA-Verlauf, IPSS und Befunde'],
 ['labs','Laborwerte','Messwerte und Referenzangaben'],['meds','Medikamentenplan','Aktueller Medikamentenstand'],['medlog','Medikamenteneinnahmen','Dokumentierte Einnahmen'],
 ['symptoms','Symptomtagebuch','Beschwerden und Verlauf'],['reminders','Kontrollen & Termine','Termine und Status'],['profile','Persönliche Daten','Patientenstammdaten'],
 ['emergency','Notfallpass','Wichtige Kontaktdaten'],['prevention','Vorsorge & Notfallplan','Individuell hinterlegte Maßnahmen'],['evidence','Nachweise','Dokumentenübersicht ohne Dateianhänge'],
 ['gdb','GdB & Teilhabe','Dokumentierte Angaben'],['analysis','Gesundheitsanalyse','Überblick und Messwertzahlen'],['pro','Analyse Pro','Erweiterte medizinische Auswertung'],['stats','Statistiken','Zusammenfassung im Zeitraum'],
 ['benefits','Leistungen','Orientierung zu möglichen Leistungen']
];
const VK_REPORT_KEYS=new Set(VK_REPORT_TOPICS.map(x=>x[0]));
function vkFastingInfo(context){
 const head=context==='uro'?'Vorbereitung auf PSA und urologische Untersuchungen':context==='labs'?'Nüchtern zur Blutabnahme – was heißt das?':'Wann ist eine Blutzuckermessung nüchtern?';
 const main=`<p><strong>Nüchtern-Blutzucker:</strong> Normalerweise mindestens <b>8 Stunden ohne Kalorien</b>; bei einer angeordneten Nüchtern-Blutentnahme sind häufig <b>8 bis 12 Stunden</b> vorgesehen. Wasser ist im Regelfall erlaubt. Die konkrete Anweisung der Arztpraxis geht vor.</p>
 <p><strong>Nicht nüchtern</strong> nach Essen, Saft, Milch oder gesüßten Getränken. Für eine verlässlich vergleichbare Untersuchung am besten vorab klären, ob Kaffee, Tee, Kaugummi oder Sport vermieden werden sollen. Ein Wert „vor dem Essen“ ist nicht automatisch nüchtern, wenn vorher bereits gegessen wurde.</p>
 <p><strong>Medikamente:</strong> Nicht eigenständig absetzen oder verschieben, besonders nicht Diabetes-Medikamente oder Insulin. Die Einnahme mit der Praxis abstimmen. „Medikament nüchtern nehmen“ hat möglicherweise eine andere Zeitvorgabe als „nüchtern zur Blutabnahme kommen“.</p>
 <p><strong>Beispiel:</strong> Letzte kalorienhaltige Mahlzeit um 20:00 Uhr, Nüchternmessung ab 04:00 Uhr; bei einer 12-Stunden-Anweisung erst ab 08:00 Uhr. Das ist keine Empfehlung, Mahlzeiten oder Medikamente ohne ärztliche Abstimmung auszulassen.</p>`;
 const psa=`<p><strong>PSA-Test:</strong> Für die PSA-Blutabnahme ist Nüchternsein üblicherweise nicht nötig. Samenerguss, Druck auf die Prostata (z. B. längeres Radfahren, Untersuchungen) und Harnwegs-/Prostataentzündungen können den Wert beeinflussen. Solche Umstände vor dem Test mitteilen und Vorbereitung beziehungsweise Wartezeit mit der Urologie klären.</p>
 <p><strong>Urinprobe oder Ultraschall:</strong> Ob eine erste Morgenurinprobe, Mittelstrahlurin oder eine gefüllte Blase erforderlich ist, hängt von der konkreten Untersuchung ab. Nicht pauschal vor jedem Termin viel trinken oder nüchtern bleiben.</p>`;
 return panel(head,`<details class="vk-fast-info" ${context==='glucose'?'open':''}><summary>Erklärung öffnen: Essen, Trinken, Medikamente und Untersuchungen</summary>${main}${psa}<p class="section-note">Quellen: <a href="https://www.gesundheitsinformation.de/was-bedeutet-nuechtern-sein.html" target="_blank" rel="noopener noreferrer">IQWiG – Nüchtern sein</a> · <a href="https://www.gesundheitsinformation.de/der-psa-test-zur-frueherkennung-von-prostatakrebs.html" target="_blank" rel="noopener noreferrer">IQWiG – PSA-Test</a>. Bei Unsicherheit immer die durchführende Praxis fragen.</p></details>`);
}
function vkUroValidate(row){
 if(!row||typeof row.id!=='string'||row.id.length>120||!dateValid(row.date)||!timeValid(row.time)||!['entry','ipss'].includes(row.type))return false;
 if(row.type==='ipss')return Array.isArray(row.ipss)&&row.ipss.length===7&&row.ipss.every(x=>Number.isInteger(x)&&x>=0&&x<=5)&&Number.isInteger(row.score)&&row.score===row.ipss.reduce((a,b)=>a+b,0)&&Number.isInteger(row.qol)&&row.qol>=0&&row.qol<=6;
 return Object.prototype.hasOwnProperty.call(VK_URO_KINDS,row.kind)&&['none','mild','moderate','severe'].includes(row.severity)&&
 (row.day===null||(Number.isInteger(row.day)&&row.day>=0&&row.day<=60))&&(row.night===null||(Number.isInteger(row.night)&&row.night>=0&&row.night<=30))&&typeof row.note==='string'&&row.note.length<=2000&&typeof row.finding==='string'&&row.finding.length<=1200;
}
function vkUroIPSSLabel(score){return score<=7?'gering':score<=19?'mittelgradig':'ausgeprägt'}
function vkUroIPSSChart(rows){const ipss=rows.filter(r=>r.type==='ipss').map(r=>({date:r.date,time:r.time,score:r.score}));return vkMiniTrend(ipss,'score','IPSS-Beschwerdewert','Punkte','day')}
function vkUroPsaChart(rows){const psa=rows.filter(x=>x.name==='PSA gesamt'&&Number.isFinite(x.value)&&x.verified===true).sort((a,b)=>a.date.localeCompare(b.date));return psa.length?vkMiniTrend(psa,'value','Gesamt-PSA','ng/ml','day'):'<p class="section-note">Noch kein bestätigter Gesamt-PSA-Laborwert vorhanden.</p>'}
function vkUroEntriesTable(rows,printing=false){
 if(!rows.length)return '<p class="section-note">Noch keine urologischen Einträge erfasst.</p>';
 return `<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Thema / IPSS</th><th>Angaben / Befund</th>${printing?'':'<th>Aktion</th>'}</tr></thead><tbody>${[...rows].sort(sortdate).reverse().slice(0,150).map(r=>`<tr><td>${fmtDate(r.date)} ${h(r.time)}</td><td>${r.type==='ipss'?'IPSS '+r.score+'/35 · '+vkUroIPSSLabel(r.score):h(VK_URO_KINDS[r.kind]||r.kind)}</td><td>${r.type==='ipss'?'Lebensqualität: '+r.qol+'/6':h([r.severity==='none'?'Keine Beschwerden':r.severity==='mild'?'Leicht':r.severity==='moderate'?'Mittel':r.severity==='severe'?'Stark':'',r.day===null?'':'Tagsüber: '+r.day,r.night===null?'':'Nachts: '+r.night,r.finding||'',r.note||''].filter(Boolean).join(' · '))}</td>${printing?'':`<td><button type="button" class="secondary" data-action="edit-uro" data-id="${h(r.id)}">IPSS / Details</button> <button type="button" class="secondary" data-action="vk201-edit" data-vk201-type="urology" data-id="${h(r.id)}">Datum / Anhänge</button> <button type="button" class="dangerbutton" data-action="remove-uro" data-id="${h(r.id)}">Löschen</button></td>`}</tr>`).join('')}</tbody></table></div>`;
}
function pageUrology(){
 const rows=(data.urologyLogs||[]),psa=data.labs.filter(x=>x.name==='PSA gesamt'||x.name==='PSA frei'||x.name==='PSA frei/gesamt');
 const categories=Object.entries(VK_URO_KINDS).map(([k,v])=>`<option value="${k}">${h(v)}</option>`).join('');
 const scoreQuestions=VK_IPSS_FIELDS.map((text,i)=>`<label class="field"><span>${i+1}. ${h(text)} (letzte vier Wochen)</span><select name="i${i}" required><option value="">Bitte auswählen</option>${[0,1,2,3,4,5].map(x=>`<option value="${x}">${x} Punkte</option>`).join('')}</select></label>`).join('');
 const summary=[['Prostata','Gutartige Prostatavergrößerung (BPH/BPS), Prostatitis, PSA-Früherkennung und Prostatakrebs-Nachsorge. PSA allein stellt keine Krebsdiagnose dar.'],
 ['Harnblase','Häufiger Harndrang, überaktive Blase, Restharn, Inkontinenz, Blasenentzündung und Blasentumoren. Sichtbares Blut im Urin muss untersucht werden.'],
 ['Nieren & Harnleiter','Nierensteine, Nierenfunktionswerte, Entzündungen, Abflussstörungen und Ultraschallkontrollen.'],
 ['Harnröhre & Beckenboden','Schwacher Harnstrahl, Harnröhrenenge, Harnverhalt, Beckenbodenprobleme und chronische Beckenschmerzen.'],
 ['Männergesundheit','Hoden, Nebenhoden, Erektionsprobleme, Fertilität, Hormone und Beschwerden nach Eingriffen.'],
 ['Urologische Untersuchungen','Urinstatus und Urinkultur, PSA / freies PSA, Tastuntersuchung, Sonografie, Restharn, Harnstrahlmessung, MRT, ggf. Biopsie oder Blasenspiegelung.'],
 ['Behandlung','Verlaufsbeobachtung, Medikamente (z. B. Alpha-Blocker oder 5-alpha-Reduktase-Hemmer), Beckenbodentraining und operative Verfahren – je nach ärztlicher Diagnose.']];
 return tag('Urologie & Prostata','Prostata, Harnblase, Nieren, Harnwege, Beschwerden und ärztliche Befunde – alles im lokalen Gesundheitsjournal.')+
 `<div class="notice danger"><strong>Sofort Hilfe holen:</strong> Bei plötzlich vollständigem Harnverhalt, starken Flankenschmerzen mit Fieber/Schüttelfrost oder starken akuten Hodenschmerzen rasch notfallmedizinisch abklären lassen. Bei schwerer akuter Erkrankung 112.</div>`+
 panel('Urologische Themen – erklärt',`<div class="vk-uro-topics">${summary.map(([title,desc])=>`<details><summary>${h(title)}</summary><p>${h(desc)}</p></details>`).join('')}</div><p class="section-note">Alle Informationen dienen der Orientierung. Kein einzelner PSA-Wert, IPSS-Wert oder Symptom reicht für eine Diagnose.</p>`)+
 vkFastingInfo('uro')+pagePSAFast()+
 panel('PSA-Werte und Verlauf',`<p>PSA-Werte kommen automatisch aus „Laborwerte“ und werden nicht doppelt gespeichert.</p>${vkUroPsaChart(psa)}${psa.length?`<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Laborwert</th><th>Wert</th></tr></thead><tbody>${[...psa].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40).map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${h(r.name)}</td><td>${labLabel(r)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Noch keine PSA-Werte vorhanden.</p>'}`)+
 panel('Beschwerden / Befunde eintragen',`<form id="uro-log-form"><input type="hidden" name="id"><div class="form-grid"><label class="field"><span>Datum</span><input type="date" name="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input type="time" name="time" value="${nowTime()}" required></label><label class="field"><span>Bereich / Thema</span><select name="kind" required>${categories}</select></label><label class="field"><span>Beschwerdestärke</span><select name="severity"><option value="none">Keine Beschwerden / nur Befund</option><option value="mild">Leicht</option><option value="moderate">Mittel</option><option value="severe">Stark</option></select></label><label class="field"><span>Wasserlassen tagsüber (optional)</span><input type="number" name="day" min="0" max="60" step="1" placeholder="Anzahl"></label><label class="field"><span>Nachts (optional)</span><input type="number" name="night" min="0" max="30" step="1" placeholder="Anzahl"></label></div><label class="field"><span>Untersuchung / ärztlicher Befund (optional)</span><textarea name="finding" rows="2" maxlength="1200" placeholder="z. B. Ultraschall, Restharn, Harnstrahlmessung, Diagnosen aus Befunden"></textarea></label><label class="field"><span>Eigene Notizen, Auslöser, Behandlung (optional)</span><textarea name="note" rows="3" maxlength="2000"></textarea></label><button class="primary" type="submit">Urologischen Eintrag verschlüsselt speichern</button></form>`)+
 panel('IPSS – Beschwerden beim Wasserlassen',`<p>Sieben Fragen für die <strong>letzten vier Wochen</strong> ergeben 0–35 Punkte (0–7 gering, 8–19 mittelgradig, 20–35 ausgeprägt). Die Lebensqualität wird getrennt bewertet. Der IPSS beschreibt Symptome, nicht deren Ursache.</p><form id="uro-ipss-form"><input name="id" type="hidden"><div class="form-grid"><label class="field"><span>Datum</span><input type="date" name="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input type="time" name="time" value="${nowTime()}" required></label>${scoreQuestions}<label class="field"><span>Belastung der Lebensqualität durch Beschwerden (0 = sehr zufrieden, 6 = sehr unzufrieden)</span><select name="qol" required><option value="">Bitte auswählen</option>${[0,1,2,3,4,5,6].map(v=>`<option value="${v}">${v}</option>`).join('')}</select></label></div><button type="submit" class="primary">IPSS-Auswertung speichern</button></form>${vkUroIPSSChart(rows)}`)+
 panel(`Urologisches Tagebuch (${rows.length})`,vkUroEntriesTable(rows));
}
function pageReportPlus(){
 const groups=VK_REPORT_TOPICS.map(([k,label,desc])=>`<div class="vk-report-topic"><label><input type="checkbox" name="part" value="${k}" ${reportChoice[k]?'checked':''}><span><strong>${h(label)}</strong><small>${h(desc)}</small></span></label><button type="button" data-action="print-topic" data-topic="${k}" class="secondary">Nur dieses Thema als PDF</button></div>`).join('');
 return tag('Berichte – einzeln oder gemeinsam','Alle Bereiche auswählen und jeweils mit passenden Diagrammen oder Tabellen als PDF speichern und ausdrucken.')+
 panel('Themenauswahl und Zeitraum',`<form id="doctor-report-form"><div class="form-grid"><label class="field"><span>Zeitraum von</span><input name="from" type="date" value="${rangeDays(30)}" required></label><label class="field"><span>Zeitraum bis</span><input name="to" type="date" value="${today()}" required></label></div><div class="actions"><button type="button" data-action="report-all" class="secondary">Alle Themen auswählen</button><button type="button" data-action="report-none" class="secondary">Auswahl aufheben</button></div><div class="vk-report-list">${groups}</div><button class="primary" type="submit">Ausgewählte Themen als PDF erstellen</button></form><p class="section-note">Jede Zeile hat einen separaten PDF-Knopf. Messwertdiagramme werden direkt in der lokal erstellten PDF gezeichnet. PDFs sind nach dem Export <strong>nicht verschlüsselt</strong>: nur sicher speichern oder gezielt teilen.</p>`);
}
function vkReportDateRange(form){const f=form?new FormData(form):null,from=String(f?.get('from')||rangeDays(30)),to=String(f?.get('to')||today());if(!dateValid(from)||!dateValid(to)||from>to||to>today())throw Error('Bitte einen gültigen Berichtszeitraum bis heute wählen.');return [from,to]}
function vkReportTable(headings,rows){if(!rows.length)return '<p>Für den Zeitraum keine Einträge vorhanden.</p>';return `<div class="table-wrap"><table><thead><tr>${headings.map(t=>`<th>${h(t)}</th>`).join('')}</tr></thead><tbody>${rows.slice(-140).map(items=>`<tr>${items.map(x=>`<td>${h(x??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function vkAllTopicHtml(from,to,choice){
 const r=vkDocRows(from,to),sel=k=>choice[k]===true,name=h(data.profile.name||'Nicht angegeben'),period='day';
 const ur=(data.urologyLogs||[]).filter(x=>between(x,from,to)),labs=(data.labs||[]).filter(x=>between(x,from,to));
 let out=`<h2>Gesundheitsbericht · ${name}</h2><p>Dokumentierter Zeitraum: ${fmtDate(from)} bis ${fmtDate(to)}. Die Diagramme zeigen dokumentierte Messungen; fehlende Werte bedeuten nicht Beschwerdefreiheit. Keine Diagnose.</p>`;
 
 if(sel('glucose')){out+='<h3>Blutzucker</h3>'+vk205Summary('Glukose',r.glucose,'mgdl','mg/dl',1)+lineChart('glucose',period,700,r.glucose)}
 if(sel('bp')){out+='<h3>Blutdruck</h3>'+vk205Summary('Systolisch',r.bp,'sys','mmHg',0)+vk205Summary('Diastolisch',r.bp,'dia','mmHg',0)+lineChart('bp',period,700,r.bp)}
 if(sel('pulse')){out+='<h3>Puls</h3>'+vk205Summary('Puls',r.bp,'pulse','/min',0)+lineChart('pulse',period,700,r.bp)}
 if(sel('weight')){out+='<h3>Körpergewicht</h3>'+vk205Summary('Gewicht',r.weight,'kg','kg',1)+weightChart(period,r.weight,700,'all')}
 if(sel('oxygen')){const oxy=vk204OxygenRows().filter(x=>between(x,from,to));out+='<h3>Blutsauerstoff & Perfusionsindex</h3>'+vk205Summary('SpO₂',oxy,'spo2','%',1)+vk204OxygenChart('spo2',period,oxy)+vk205Summary('PI',oxy,'pi','%',2)+vk204OxygenChart('pi',period,oxy)}
 if(sel('asthma')){out+='<h3>Asthma</h3>'+vk205Summary('Peak-Flow',r.asthma,'peakFlow','l/min',0)+vkMiniTrend(r.asthma,'peakFlow','Peak-Flow','l/min',period)+vk205Summary('FEV1',r.asthma,'fev1Pct','%',1)+vkMiniTrend(r.asthma,'fev1Pct','FEV1','%',period)+vk205Summary('Atemnot',r.asthma,'breathlessness','/10',1)+vkMiniTrend(r.asthma,'breathlessness','Atemnot','/10',period)}
 if(sel('hospital'))out+='<h3>Krankenhausaufenthalte</h3>'+vk205HospitalReport(from,to,true);


 if(sel('urology')){const psa=labs.filter(x=>x.name==='PSA gesamt'&&x.verified===true);out+=`<h3>Urologie & Prostata</h3><p>PSA-Verlauf und dokumentierte urologische Beschwerden/Befunde. PSA ist kein Krebsnachweis, IPSS keine Diagnose.</p>${vkUroPsaChart(psa)}${vkUroIPSSChart(ur)}${vkUroEntriesTable(ur,true)}${vkReportTable(['Datum','PSA / Urinwert','Wert'],labs.filter(x=>/PSA|Testosteron|Kreatinin \(Urin\)|Albumin \(Urin\)|Urinstatus|Urin-Albumin|Urinkultur/.test(x.name)).map(x=>[fmtDate(x.date),x.name,nf(x.value,3)+' '+(x.unit||'')]))}`}
 if(sel('labs')){out+=`<h3>Laborwerte</h3>${vkReportTable(['Datum','Parameter','Wert'],r.labs.map(x=>[fmtDate(x.date),x.name,nf(x.value,3)+' '+(x.unit||'')]))}`}
 if(sel('meds'))out+=`<h3>Medikamente – aktueller dokumentierter Stand</h3>${vkReportTable(['Medikament','Dosierung','Einnahmeplan'],data.meds.map(x=>[x.name,x.dose||'',x.schedule||'']))}`;
 if(sel('medlog'))out+=`<h3>Dokumentierte Medikamenteneinnahmen</h3>${vkReportTable(['Datum','Medikament','Menge'],(data.medTakes||[]).filter(x=>between(x,from,to)).map(x=>[fmtDate(x.date)+' '+x.time,data.meds.find(m=>m.id===x.medId)?.name||'Unbekannt',x.dose||'']))}`;
 if(sel('symptoms'))out+=`<h3>Symptomtagebuch</h3>${vkReportTable(['Datum','Symptom','Schwere'],(data.symptoms||[]).filter(x=>between(x,from,to)).map(x=>[fmtDate(x.date)+' '+x.time,x.kind,x.severity]))}`;
 if(sel('reminders'))out+=`<h3>Kontrollen und Termine</h3>${vkReportTable(['Datum','Art','Stand'],(data.reminders||[]).filter(x=>between(x,from,to)).map(x=>[fmtDate(x.date),x.kind,x.done?'Erledigt':'Offen']))}`;
 if(sel('profile'))out+=`<h3>Persönliche Daten</h3><p>Name: ${h(data.profile.name||'–')} · Geburtsdatum: ${h(data.profile.birthday||'–')} · Größe: ${h(data.profile.height||'–')} cm. Weitere Profildaten nur gezielt weitergeben.</p>`;
 if(sel('emergency'))out+=`<h3>Notfallpass</h3><p>Erkrankungen: ${h((data.profile.conditions||[]).join(', '))} · Allergien: ${h((data.profile.allergies||[]).join(', '))} · Notfallkontakte: ${h((data.profile.contact||[]).map(x=>x.name+' '+x.phone).join('; '))}</p>`;
 if(sel('prevention')){const e=data.checks?.emergencyPlan||{};out+=`<h3>Vorsorge & Notfallplan</h3><p>Ärztlich vereinbarte Maßnahmen: ${h(e.actions||'Keine Angaben')} · Hinweise: ${h(e.doctorNotes||'Keine Angaben')}</p>`}
 if(sel('evidence'))out+=`<h3>Nachweise (nur Metadaten, keine Dateianhänge)</h3>${vkReportTable(['Datum','Art','Notiz'],(data.evidence||[]).filter(x=>between(x,from,to)).map(x=>[fmtDate(x.date),x.kind,x.notes||'']))}`;
 if(sel('gdb')){const g=data.checks?.gdb||{};out+=`<h3>GdB und Teilhabe</h3><p>Vorhandener GdB: ${h(g.value??'nicht eingetragen')} · Gleichstellung: ${h(g.equalization||'nicht angegeben')}. Individuelle rechtliche Prüfung erforderlich.</p>`}
 if(sel('analysis'))out+=`<h3>Gesundheitsanalyse</h3><p>Im Zeitraum ${r.glucose.length} bestätigte Blutzuckerwerte, ${r.bp.length} Blutdruckwerte, ${r.weight.length} Gewichtseinträge, ${r.asthma.length} Asthmaeinträge und ${r.labs.length} bestätigte Laborwerte.</p>`;
 if(sel('pro'))out+='<h3>Analyse Pro</h3>'+proReportHtml();
 if(sel('stats'))out+=`<h3>Statistiken im Berichtszeitraum</h3><p>Blutzucker: Mittel ${nf(vkStats(r.glucose,'mgdl').mean,1)} mg/dl · Blutdruck systolisch: Mittel ${nf(vkStats(r.bp,'sys').mean,1)} mmHg · Gewicht: Mittel ${nf(vkStats(r.weight,'kg').mean,1)} kg.</p>`;
 if(sel('benefits'))out+=`<h3>Krankenkasse & Leistungen</h3><p>Ansprüche sind abhängig von Befunden, Versicherungsstatus und konkreten Voraussetzungen. Für individuelle Anträge die offiziellen Stellen oder die Krankenkasse kontaktieren. Diese PDF enthält keine Leistungszusage.</p>`;
 return out+'<p>Vertraulich: PDF-Dateien sind nicht automatisch verschlüsselt. Bericht ist eine selbst erfasste Dokumentation und ersetzt keine ärztliche Beurteilung.</p>';
}
/* VK200 MODULE END */

/* VK201 EDIT MODULE BEGIN – local encrypted entry correction and attachments. */
const VK201_LIMIT=1536*1024, VK201_TOTAL=12*1024*1024, VK201_PER_ENTRY=4;
const VK201_MIME=new Set(['application/pdf','image/jpeg','image/png','text/plain']);
let vk201Busy=false;
function vk201Bucket(type){return ({glucose:'measurements',bp:'measurements',weight:'weights',lab:'labs',asthma:'asthmaLogs',urology:'urologyLogs'})[type]||''}
function vk201Lookup(type,entryId){const bucket=vk201Bucket(type);if(!bucket||!data)return null;const index=(data[bucket]||[]).findIndex(x=>x.id===entryId&&(bucket!=='measurements'||x.type===type));return index>=0?{bucket,index,entry:data[bucket][index]}:null}
function vk201Files(record){return Array.isArray(record?.attachments)?record.attachments:[]}
function vk201ValidateFile(item){return item&&typeof item.name==='string'&&item.name.length>0&&item.name.length<=120&&VK201_MIME.has(item.mime)&&typeof item.base64==='string'&&item.base64.length<=Math.ceil(VK201_LIMIT/3)*4+8&&item.base64.length>0&&item.base64.length%4===0&&/^[a-zA-Z0-9+/]*={0,2}$/.test(item.base64)&&Number.isInteger(item.size)&&item.size>0&&item.size<=VK201_LIMIT&&Math.floor(item.base64.length*3/4)-(item.base64.endsWith('==')?2:item.base64.endsWith('=')?1:0)===item.size}
function vk201ValidateAll(files){return Array.isArray(files)&&files.length<=VK201_PER_ENTRY&&files.every(vk201ValidateFile)}
function vk201BackupWithinLimit(vault){let used=(vault.evidence||[]).reduce((n,x)=>n+(x.base64?.length||0)*.75,0);for(const bucket of ['measurements','weights','labs','asthmaLogs','urologyLogs'])for(const row of vault[bucket]||[])used+=vk201Files(row).reduce((n,a)=>n+a.size,0);for(const stay of vault.hospitalStays||[])used+=(stay.files||[]).reduce((n,f)=>n+f.size,0);return used<=VK201_TOTAL}
function vk201UsedBytes(skip){const buckets=['measurements','weights','labs','asthmaLogs','urologyLogs'];let used=(data.evidence||[]).reduce((n,x)=>n+(x.base64?.length||0)*.75,0);for(const bucket of buckets){for(const r of data[bucket]||[]){if(r===skip||r.id===skip?.id)continue;used+=vk201Files(r).reduce((n,a)=>n+a.size,0)}}for(const stay of data.hospitalStays||[])used+=(stay.files||[]).reduce((n,f)=>n+f.size,0);return used}
function vk201Close(){document.getElementById('vk201-editor')?.remove()}
function vk201OptionSet(dict,value){return Object.entries(dict).map(([key,name])=>`<option value="${h(key)}" ${key===value?'selected':''}>${h(name)}</option>`).join('')}
function vk201Field(label,name,value,extra=''){return `<label class="field"><span>${h(label)}</span><input name="${h(name)}" value="${h(value??'')}" ${extra}></label>`}
function vk201AttachmentsHtml(entry){const files=vk201Files(entry);return `<fieldset class="vk201-files"><legend>Anhänge / Befunde</legend><p class="section-note">PDF, JPG, PNG oder TXT – maximal 1,5 MB je Datei, vier Anhänge je Eintrag und 12 MB insgesamt einschließlich der Nachweise. Dateien werden verschlüsselt gespeichert und in verschlüsselte Backups aufgenommen.</p>${files.length?files.map((a,i)=>`<label class="vk201-attachment-row"><input type="checkbox" name="remove-file" value="${i}"><span><strong>${h(a.name)}</strong><small> · ${Math.round(a.size/1024)} KB · durch Häkchen entfernen</small></span><button type="button" class="secondary" data-vk201-download="${i}">Öffnen / sichern</button></label>`).join(''):'<p class="muted">Noch kein Anhang vorhanden.</p>'}<label class="field"><span>Neue Datei(en) hinzufügen</span><input type="file" name="newFiles" accept=".pdf,.jpg,.jpeg,.png,.txt,application/pdf,image/jpeg,image/png,text/plain" multiple></label></fieldset>`}
function vk201Open(type,entryId){if(vk201Busy)throw Error('Ein Speichervorgang läuft noch.');const found=vk201Lookup(type,entryId);if(!found)throw Error('Eintrag wurde nicht gefunden.');if(type==='weight'&&weightJournalReadOnly)throw Error('Das Gewichtstagebuch ist schreibgeschützt.');
 const x=found.entry;let fields='';
 const shared=`<div class="form-grid">${vk201Field('Datum','date',x.date,'type="date" required')}${vk201Field('Uhrzeit','time',x.time||'00:00','type="time" required')}</div>`;
 if(type==='glucose')fields=shared+`<div class="form-grid">${vk201Field('Blutzucker','glucoseValue',nf(x.mgdl,1),'type="text" inputmode="decimal" required')}<label class="field"><span>Einheit</span><select name="glucoseUnit"><option value="mgdl">mg/dl</option><option value="mmol">mmol/l</option></select></label><label class="field"><span>Messsituation</span><select name="period">${vk201OptionSet(gLabels,x.period)}</select></label></div>`+vk201Field('Notiz','note',x.note||'','maxlength="400"');
 else if(type==='bp')fields=shared+`<div class="form-grid">${vk201Field('Systolisch (mmHg)','sys',x.sys,'type="number" min="40" max="320" required')}${vk201Field('Diastolisch (mmHg)','dia',x.dia,'type="number" min="20" max="220" required')}${vk201Field('Puls (/min, optional)','pulse',x.pulse??'','type="number" min="20" max="240"')}<label class="field"><span>Bezug zu Mahlzeiten</span><select name="mealTiming">${vk201OptionSet(bpMealLabels,x.mealTiming||'unknown')}</select></label></div>`+vk201Field('Notiz','note',x.note||'','maxlength="400"');
 else if(type==='weight')fields=shared+`<div class="form-grid">${vk201Field('Gewicht (kg)','kg',String(x.kg).replace('.',','),'type="text" inputmode="decimal" required')}<label class="field"><span>Wann gewogen?</span><select name="mealTiming">${vk201OptionSet(Object.fromEntries(Object.entries(bpMealLabels).filter(([k])=>k!=='unknown')),x.mealTiming)}</select></label></div>`+vk201Field('Notiz','note',x.note||'','maxlength="300"');
 else if(type==='lab')fields=shared+`<div class="form-grid">${vk201Field('Laborparameter','name',x.name,'maxlength="150" required')}${vk201Field('Wert','value',x.value,'type="text" inputmode="decimal" required')}${vk201Field('Einheit','unit',x.unit||'','maxlength="40"')}${vk201Field('Labor / Arzt','place',x.place||'','maxlength="150"')}${vk201Field('Referenz von (optional)','low',x.low??'','type="text" inputmode="decimal"')}${vk201Field('Referenz bis (optional)','high',x.high??'','type="text" inputmode="decimal"')}</div>`+vk201Field('Notiz','note',x.note||'','maxlength="500"');
 else if(type==='asthma')fields=shared+`<div class="form-grid">${vk201Field('Atemnot (0–10)','breathlessness',x.breathlessness,'type="number" min="0" max="10" required')}${vk201Field('Bedarfsanwendungen (0–50)','rescueUses',x.rescueUses,'type="number" min="0" max="50" required')}${vk201Field('Peak-Flow (optional)','peakFlow',x.peakFlow??'','type="number" min="50" max="1000"')}${vk201Field('FEV1 (%, optional)','fev1Pct',x.fev1Pct??'','type="text" inputmode="decimal"')}</div>`+vk201Field('Notiz','note',x.note||'','maxlength="1000"')+'<p class="section-note">Bereits erfasste Auslöser bleiben erhalten. Auslöser können im Asthma-Formular geändert werden.</p>';
 else if(type==='urology')fields=shared+(x.type==='ipss'?'<p>Die sieben IPSS-Fragen und die Lebensqualität bearbeitest du weiterhin im IPSS-Formular. Hier lassen sich Datum, Uhrzeit und Anhänge korrigieren.</p>':`<div class="form-grid"><label class="field"><span>Urologisches Thema</span><select name="kind">${vk201OptionSet(VK_URO_KINDS,x.kind)}</select></label><label class="field"><span>Schwere</span><select name="severity">${vk201OptionSet({none:'Keine Beschwerden',mild:'Leicht',moderate:'Mittel',severe:'Stark'},x.severity)}</select></label>${vk201Field('Toilettengänge tagsüber','day',x.day??'','type="number" min="0" max="60"')}${vk201Field('Nächtliche Toilettengänge','night',x.night??'','type="number" min="0" max="30"')}</div>${vk201Field('Befund','finding',x.finding||'','maxlength="1200"')}${vk201Field('Notiz','note',x.note||'','maxlength="2000"')}`);
 vk201Close();const d=document.createElement('div');d.id='vk201-editor';d.className='vk201-overlay';d.innerHTML=`<section class="vk201-sheet" role="dialog" aria-modal="true" aria-label="Eintrag bearbeiten"><header><h2>Eintrag bearbeiten – ${h(({bp:'Blutdruck',glucose:'Blutzucker',weight:'Gewicht',lab:'Labor',asthma:'Asthma',urology:'Urologie'})[type])}</h2><button type="button" class="secondary" data-vk201-close="1">Schließen</button></header><form id="vk201-entry-form" novalidate data-vk201-type="${h(type)}" data-vk201-id="${h(entryId)}"><p class="section-note">Korrekturen ändern denselben Eintrag. Bisherige Einträge und Diagrammverläufe bleiben erhalten.</p>${fields}${vk201AttachmentsHtml(x)}<div class="vk201-actions"><button type="submit" class="primary">Änderungen speichern</button><button type="button" class="secondary" data-vk201-close="1">Abbrechen</button></div><p role="status" aria-live="polite" class="vk201-feedback"></p></form></section>`;document.body.append(d);d.querySelector('input,select,button')?.focus();}
function vk201Num(f,name,optional=false){let raw=String(f.get(name)??'').trim();return optional&&raw===''?null:nval(raw)}
function vk201NewValue(type,old,f){const o={...old,date:String(f.get('date')||''),time:String(f.get('time')||'')};if(!dateValid(o.date)||o.date>today()||!timeValid(o.time))throw Error('Datum und Uhrzeit prüfen.');
 if(type==='glucose'){const u=f.get('glucoseUnit');if(!['mgdl','mmol'].includes(u)||!Object.hasOwn(gLabels,String(f.get('period'))))throw Error('Messsituation oder Einheit ungültig.');const input=vk201Num(f,'glucoseValue');const mgdl=u==='mmol'?input*18.0182:input;if(!Number.isFinite(mgdl)||mgdl<10||mgdl>700)throw Error('Blutzuckerwert außerhalb der Eingabegrenzen.');o.mgdl=Math.round(mgdl*10)/10;o.period=String(f.get('period'));o.note=String(f.get('note')||'').slice(0,400)}
 else if(type==='bp'){o.sys=vk201Num(f,'sys');o.dia=vk201Num(f,'dia');o.pulse=vk201Num(f,'pulse',true);o.mealTiming=String(f.get('mealTiming'));o.note=String(f.get('note')||'').slice(0,400);if(!Number.isFinite(o.sys)||!Number.isFinite(o.dia)||o.sys<=o.dia||o.sys<40||o.sys>320||o.dia<20||o.dia>220||(o.pulse!==null&&(!Number.isFinite(o.pulse)||o.pulse<20||o.pulse>240))||!Object.hasOwn(bpMealLabels,o.mealTiming))throw Error('Blutdruck und Puls überprüfen.')}
 else if(type==='weight'){o.kg=vk201Num(f,'kg');o.mealTiming=String(f.get('mealTiming'));o.note=String(f.get('note')||'').slice(0,300);if(!Number.isFinite(o.kg)||o.kg<20||o.kg>400||o.mealTiming==='unknown'||!Object.hasOwn(bpMealLabels,o.mealTiming))throw Error('Gewicht und Messzeitpunkt überprüfen.');o.kg=Math.round(o.kg*10)/10}
 else if(type==='lab'){o.name=String(f.get('name')||'').trim();o.value=vk201Num(f,'value');o.unit=String(f.get('unit')||'').slice(0,40);o.place=String(f.get('place')||'').slice(0,150);o.low=vk201Num(f,'low',true);o.high=vk201Num(f,'high',true);o.note=String(f.get('note')||'').slice(0,500);if(!o.name||o.name.length>150||!Number.isFinite(o.value)||(o.low!==null&&!Number.isFinite(o.low))||(o.high!==null&&!Number.isFinite(o.high))||(o.low!==null&&o.high!==null&&o.high<o.low))throw Error('Laborangaben und Referenzbereiche prüfen.')}
 else if(type==='asthma'){o.breathlessness=vk201Num(f,'breathlessness');o.rescueUses=vk201Num(f,'rescueUses');o.peakFlow=vk201Num(f,'peakFlow',true);o.fev1Pct=vk201Num(f,'fev1Pct',true);o.note=String(f.get('note')||'').slice(0,1000);if(!Number.isInteger(o.breathlessness)||o.breathlessness<0||o.breathlessness>10||!Number.isInteger(o.rescueUses)||o.rescueUses<0||o.rescueUses>50||(o.peakFlow!==null&&(!Number.isFinite(o.peakFlow)||o.peakFlow<50||o.peakFlow>1000))||(o.fev1Pct!==null&&(!Number.isFinite(o.fev1Pct)||o.fev1Pct<5||o.fev1Pct>140)))throw Error('Asthma-Werte überprüfen.')}
 else if(type==='urology'){if(o.type==='entry'){o.kind=String(f.get('kind'));o.severity=String(f.get('severity'));const day=vk201Num(f,'day',true),night=vk201Num(f,'night',true);o.day=day;o.night=night;o.finding=String(f.get('finding')||'').slice(0,1200);o.note=String(f.get('note')||'').slice(0,2000)}if(!vkUroValidate(o))throw Error('Urologische Angaben prüfen.')}
 return o;
}
async function vk201ReadNew(files){const out=[];for(const file of files){if(!(file instanceof File)||file.size===0)continue;let mime=file.type;if(mime==='application/octet-stream'||!mime){const lower=file.name.toLowerCase();mime=lower.endsWith('.pdf')?'application/pdf':/\.jpe?g$/.test(lower)?'image/jpeg':lower.endsWith('.png')?'image/png':lower.endsWith('.txt')?'text/plain':'';}if(!VK201_MIME.has(mime)||file.size>VK201_LIMIT||file.size<=0)throw Error('Nur PDF, JPG, PNG oder TXT bis 1,5 MB je Anhang erlaubt.');const bytes=new Uint8Array(await file.arrayBuffer());const sig=Array.from(bytes.slice(0,8));if(mime==='application/pdf'&&String.fromCharCode(...sig.slice(0,4))!=='%PDF'||mime==='image/jpeg'&&!(sig[0]===255&&sig[1]===216&&sig[2]===255)||mime==='image/png'&&sig.slice(0,4).join(',')!=='137,80,78,71')throw Error('Dateiformat und Dateiinhalt stimmen nicht überein.');out.push({name:file.name.replace(/[\\/\x00-\x1f]/g,'_').slice(0,120)||'Anhang',mime,size:bytes.byteLength,base64:b64(bytes)})}return out}
async function vk201SaveEditor(form){if(vk201Busy)throw Error('Speichern läuft bereits.');if(weightSaveInProgress)throw Error('Gewichtsspeicherung läuft noch.');const type=form.dataset.vk201Type,entryId=form.dataset.vk201Id,found=vk201Lookup(type,entryId);if(!found)throw Error('Eintrag wurde nicht gefunden.');if(found.bucket==='weights'&&weightJournalReadOnly)throw Error('Gewichtstagebuch ist nicht lesbar; Änderungen gesperrt.');
 const submit=form.querySelector('[type="submit"]');vk201Busy=true;if(submit)submit.disabled=true;try{
 const f=new FormData(form),fresh=vk201NewValue(type,found.entry,f),previous=vk201Files(found.entry);if(!vk201ValidateAll(previous))throw Error('Gespeicherte Anhänge sind ungültig. Bitte nichts löschen und den Speicher prüfen.');
 const removals=new Set(f.getAll('remove-file').map(String));if([...removals].some(i=>!/^(0|[1-9]\d*)$/.test(i)||Number(i)>=previous.length))throw Error('Anhangsauswahl ungültig.');const keep=previous.filter((_,i)=>!removals.has(String(i)));const candidates=[...form.querySelectorAll('input[name="newFiles"]')].flatMap(e=>[...e.files]);if(candidates.filter(file=>file?.size>0).length+keep.length>VK201_PER_ENTRY)throw Error('Maximal vier Anhänge je Eintrag.');const added=await vk201ReadNew(candidates);fresh.attachments=[...keep,...added];if(!vk201ValidateAll(fresh.attachments))throw Error('Maximal vier Anhänge je Eintrag und jeweils höchstens 1,5 MB.');if(vk201UsedBytes(found.entry)+fresh.attachments.reduce((n,a)=>n+a.size,0)>VK201_TOTAL)throw Error('Dokumentenspeicher 12 MB insgesamt überschritten. Bitte ältere Anhänge auslagern.');
 if(found.bucket==='weights'){
   weightSaveInProgress=true;try{const next=[...data.weights];next[found.index]=fresh;await writeWeightDraft(fresh);await storeWeightJournal(next);data.weights=next;syncProfileWeight();try{await clearWeightDraft()}catch{}}
   finally{weightSaveInProgress=false}
  }else{const before=data[found.bucket],next=[...before];next[found.index]=fresh;data[found.bucket]=next;try{await save()}catch(e){data[found.bucket]=before;throw e}}
  vk201Close();renderMain();toast('Änderungen und Anhänge verschlüsselt gespeichert.');
 }finally{vk201Busy=false;if(submit?.isConnected)submit.disabled=false}
}
document.addEventListener('click',ev=>{const close=ev.target.closest('[data-vk201-close]');if(close){if(!vk201Busy)vk201Close();return}const a=ev.target.closest('[data-vk201-download]');if(a){const form=a.closest('#vk201-entry-form'),r=form&&vk201Lookup(form.dataset.vk201Type,form.dataset.vk201Id),file=r&&vk201Files(r.entry)[Number(a.dataset.vk201Download)];if(!file||!vk201ValidateFile(file))return;sendDownload(unb64(file.base64),file.name,'application/octet-stream');toast('Anhang wurde zum Sichern bereitgestellt. Exportierte Dateien sind nicht verschlüsselt.')}});
document.addEventListener('submit',async ev=>{if(ev.target.id!=='vk201-entry-form')return;ev.preventDefault();const f=ev.target;try{await vk201SaveEditor(f)}catch(e){const t=f.querySelector('.vk201-feedback');if(t)t.textContent=e.message||'Speichern fehlgeschlagen.';alert(e.message||'Bearbeitung fehlgeschlagen.')}});
/* VK201 EDIT MODULE END */

function pageDoctorReport(){const choices=[['bp','Blutdruck'],['glucose','Blutzucker'],['weight','Körpergewicht'],['asthma','Asthma'],['labs','Laborwerte'],['meds','Medikamente']];return tag('Arztbericht erstellen','Zeitraum und Gesundheitsbereiche auswählen; PDF wird lokal auf dem iPhone erzeugt.')+panel('Berichtsoptionen',`<form id="doctor-report-form"><div class="form-grid"><label class="field"><span>Von</span><input name="from" type="date" value="${rangeDays(30)}" required></label><label class="field"><span>Bis</span><input name="to" type="date" value="${today()}" required></label></div><fieldset class="vk-fieldset"><legend>Inhalt für den Bericht</legend>${choices.map(([key,label])=>`<label><input name="part" type="checkbox" value="${key}" ${reportChoice[key]?'checked':''}> ${label}</label>`).join('')}</fieldset><button class="primary" type="submit">Bericht als PDF erstellen</button></form><p class="section-note">PDFs sind im Gegensatz zum verschlüsselten App-Speicher nicht automatisch verschlüsselt. Nach dem Export sicher speichern und nur bei Bedarf teilen.</p>`)}


function pageWeight(){let interrupted=false;try{interrupted=sessionStorage.getItem('vk-weight-save-pending')==='1'}catch{};return (weightJournalReadOnly?'<div class=\"notice danger\" role=\"alert\">Gewichtstagebuch konnte nicht geladen werden. Neue Gewichte sind zum Schutz vorhandener Einträge gesperrt. Bitte nichts löschen; eine Datensicherung der übrigen Gesundheitsdaten ist mit ausdrücklicher Warnung möglich.</div>':'')+(interrupted?'<div class=\"notice warn\" role=\"status\">Ein früherer Speichervorgang wurde möglicherweise unterbrochen. Prüfe zuerst die Eintragsliste, bevor du erneut speicherst.</div>':'')+vk203MetricPanel()+pageWeightOld()+vkWeightGoalPanel()}
function pageStart(){let old=pageStartOld();const start='<div class="biglinks" style="margin:16px 0">';const i=old.indexOf(start);if(i>=0){const end=old.indexOf('</div>',i);if(end>=0)old=old.slice(0,i)+vk203HomeQuick()+old.slice(end+6)}const point='<div class="main-grid">';return old.includes(point)?old.replace(point,vkDashboard()+vk203MetricMini()+point):old+vkDashboard()+vk203MetricMini()}
function pageMeds(){return pageMedsOld()+vkMedStockPanel()}
function pageReminders(){return pageRemindersOld()+vkReminderPanel()}
function pageAnalysis(){return pageAnalysisOld()+vkPeriodComparison()}
function pageStats(){return pageStatsOld()+panel('Ausgewählte PDF-Berichte','<p>Einzelne Themen oder mehrere Bereiche gezielt als PDF ausgeben.</p><button type="button" class="primary" data-view="doctor">Berichte auswählen / drucken</button>')}
function measurementTable(type){const rows=filtered(type).slice(-75).reverse();if(!rows.length)return '<p class="muted">Noch keine Messwerte vorhanden.</p>';return `<div class="table-wrap"><table><thead><tr><th>Datum / Zeit</th><th>Werte</th><th>Hinweis</th><th>Aktion</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtDate(r.date)} ${h(r.time)}</td><td><strong>${type==='glucose'?`${nf(r.mgdl,1)} mg/dl · ${h(gLabels[r.period]||'Sonstige')}`:`${nf(r.sys)}/${nf(r.dia)} mmHg · Puls ${nf(r.pulse)}`}</strong><br>${pctTag(r.verified)} <span class="status-pill status-${classification(r,type).level}">${h(classification(r,type).label)}</span>${type==='bp'&&Number.isFinite(r.pulse)?`<br><span class="status-pill status-${classification(r,'pulse').level}">Puls: ${h(classification(r,'pulse').label)}</span>`:''}</td><td>${type==='bp'&&r.mealTiming&&r.mealTiming!=='unknown'?`<span class="chip">${h(bpMealLabels[r.mealTiming]||'')}</span> `:''}${h(r.note||'')} ${vk201Files(r).length?`<span class="chip">${vk201Files(r).length} Anhang/Anhänge</span>`:''} ${type==='glucose'?glucoseWarnings(r).map(x=>`<span class="chip red">${h(x)}</span>`).join(''):bpWarnings(r).map(x=>`<span class="chip red">${h(x)}</span>`).join('')}</td><td>${r.verified!==true?`<button data-action="verify" data-type="measurement" data-id="${h(r.id)}" type="button" class="secondary">Prüfen</button>`:''}<button data-action="vk201-edit" data-vk201-type="${type}" data-id="${h(r.id)}" type="button" class="secondary">Bearbeiten / Anhang</button> <button data-action="remove" data-type="measurement" data-id="${h(r.id)}" type="button" class="dangerbutton">Löschen</button></td></tr>`).join('')}</tbody></table></div>`}
function bridgeBase64(str){
  if(typeof str!=='string'||str.length>1500000||!/^[A-Za-z0-9+/]*={0,2}$/.test(str)||str.length%4!==0)throw Error('Ungültige Base64-Daten.');
  return Uint8Array.from(atob(str),ch=>ch.charCodeAt(0));
}
function hexBytes(hex){
  if(!/^[0-9a-fA-F]{64}$/.test(hex))throw Error('Transfer-Schlüssel muss genau 64 Hex-Zeichen haben.');
  return Uint8Array.from({length:32},(_,i)=>parseInt(hex.slice(2*i,2*i+2),16));
}
async function decodeBridgeExport(envelope,hex){
  if(envelope?.format!=='vitalkompass-ble-bridge-encrypted-v1'||envelope.alg!=='AES-256-GCM')throw Error('Kein kompatibler ESP32-Export.');
  const iv=bridgeBase64(envelope.iv),ciphertext=bridgeBase64(envelope.ciphertext);
  if(iv.length!==12||ciphertext.length<17||ciphertext.length>800000)throw Error('Ungültige oder zu große verschlüsselte Datei.');
  const k=await crypto.subtle.importKey('raw',hexBytes(hex),{name:'AES-GCM'},false,['decrypt']);
  let plain;
  try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,tagLength:128},k,ciphertext)}
  catch{throw Error('Entschlüsselung gescheitert: falscher Schlüssel oder Datei beschädigt.');}
  const b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));
  if(b?.format!=='vitalkompass-ble-bridge-v1'||b.complete!==true||b.unit!=='mg/dl'||b.device_id!==envelope.device_id||typeof b.device_id!=='string'||!/^[A-Za-z0-9-]{5,40}$/.test(b.device_id)||!Array.isArray(b.records)||b.records.length>720)throw Error('Messgerätedaten unvollständig oder unpassend.');
  const seen=new Set(),records=[];
  for(const r of b.records){
    if(!Number.isInteger(r.seq)||r.seq<0||r.seq>65535||!dateValid(r.date)||!timeValid(r.time)||!Number.isFinite(r.mgdl)||r.mgdl<10||r.mgdl>700)throw Error('Ein Messwert ist beschädigt oder unplausibel. Import abgebrochen.');
    const k=String(r.seq);if(seen.has(k))throw Error('Doppelte Sequenznummer im Export.');seen.add(k);
    records.push({seq:r.seq,date:r.date,time:r.time,mgdl:Math.round(r.mgdl*10)/10});
  }
  return {deviceId:b.device_id,records};
}
function bridgePreviewHtml(b){
  const name=(data?.profile?.name||'').trim();
  const entries=b.records.slice(0,8).map(r=>`<tr><td>${fmtDate(r.date)} · ${h(r.time)}</td><td>${nf(r.mgdl,1)} mg/dl</td><td>${r.seq}</td></tr>`).join('');
  return `<section class="softbox"><h3>Vorschau: ${b.records.length} Messwerte</h3><p>ESP32-Kennung: ${h(b.deviceId)}. Messwerte sind <strong>nicht automatisch bestätigt</strong>. Bitte Datum, Einheit und Patient prüfen.</p><div class="table-wrap"><table><thead><tr><th>Messzeit</th><th>Wert</th><th>Nr.</th></tr></thead><tbody>${entries||'<tr><td colspan="3">Keine Messwerte</td></tr>'}</tbody></table></div><form id="meter-bridge-confirm-form"><label class="field"><span>Patient bestätigen (genau wie im Profil)</span><input name="patient" autocomplete="off" required placeholder="${h(name||'Profil zuerst ausfüllen')}"></label><label class="field"><input type="checkbox" name="confirm" value="yes" required> Ich habe Patient und Originalmessgerät abgeglichen.</label><button type="submit" class="primary">${b.records.length} Werte privat übernehmen</button></form></section>`;
}
async function importBridgeConfirm(f){
  if(!bridgePreview)throw Error('Bitte zuerst eine verschlüsselte ESP32-Datei laden.');
  const patient=(data?.profile?.name||'').trim().replace(/\s+/g,' ');
  if(!patient)throw Error('Bitte zuerst das Patientenprofil mit Vor- und Nachnamen ausfüllen.');
  if(String(f.get('patient')||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE')!==patient.toLocaleLowerCase('de-DE')||f.get('confirm')!=='yes')throw Error('Bitte die richtige Person und das Messgerät bestätigen.');
  const entries=bridgePreview.records;
  // Deduplicate across repeated exports and manual input: same timestamp and concentration.
  const existing=new Set(data.measurements.filter(x=>x.type==='glucose').map(x=>`${x.date}|${x.time}|${Math.round(x.mgdl*10)}`));
  let count=0;
  for(const r of entries){const fingerprint=`${r.date}|${r.time}|${Math.round(r.mgdl*10)}`;
    if(existing.has(fingerprint))continue;
    data.measurements.push({id:id(),type:'glucose',date:r.date,time:r.time,mgdl:r.mgdl,period:'other',source:'ESP32-C6 Accu-Chek Instant',bridgeId:bridgePreview.deviceId,meterSeq:r.seq,note:'Automatischer Geräteexport; Messgerät prüfen',verified:false});
    count++;existing.add(fingerprint);
  }
  bridgePreview=null;await save();renderMain();toast(`${count} neue ESP32-Messwerte importiert (noch zu prüfen).`);
}


function fmtPro(v,d=1){return v===null||v===undefined?'–':nf(v,d)}
function proQualityHtml(){const q=VKPro.dataQuality(data.measurements,data.labs,today());
 const rows=q.issues.slice(0,45).map(x=>`<tr><td>${h(x.level==='error'?'Ungültig':'Prüfen')}</td><td>${h(x.title)}</td><td>${h(x.detail)}</td></tr>`).join('');
 return `<div class="main-grid"><div class="metric"><span>Zu prüfende Hinweise</span><strong>${q.reviews}</strong></div><div class="metric"><span>Ungültige Angaben</span><strong>${q.errors}</strong></div></div><p class="section-note">Mögliche Duplikate werden nicht automatisch gelöscht. Bestätigte und unbestätigte Messungen bleiben getrennt. Alle Hinweise beziehen sich auf die vorhandenen Datensätze und ersetzen keine ärztliche Kontrolle.</p>`+(q.issues.length?`<div class="table-wrap"><table><thead><tr><th>Status</th><th>Grund</th><th>Eintrag</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<p>Keine formalen Datenprobleme erkannt; dies bestätigt nicht die medizinische Richtigkeit.</p>')+(q.issues.length>45?'<p>Weitere Hinweise vorhanden. Bitte die einzelnen Messwertlisten prüfen.</p>':'');}
function bpProtocolHtml(){const z=VKPro.bpSevenDay(data.measurements,today());const val=x=>x.count?`${fmtPro(x.sys)}/${fmtPro(x.dia)} mmHg (${x.count})`:'–';
 return `<p><b>Zeitraum:</b> ${fmtDate(z.start)} bis ${fmtDate(z.end)}. Nur bestätigte Messungen. Morgen: vor 12:00 Uhr; Abend: ab 17:00 Uhr. Dazwischen liegende ${z.middayExcluded} Messung(en) sind hier nicht enthalten.</p><div class="main-grid"><div class="metric"><span>Mittelwert Morgen & Abend</span><strong>${z.all.count?`${fmtPro(z.all.sys)}/${fmtPro(z.all.dia)}`:'–'}</strong><small>mmHg · ${z.all.count} Einzelmessungen</small></div><div class="metric"><span>Tage mit beiden Zeitfenstern</span><strong>${z.coverage}/7</strong><small>Kein vollständiger Messplan erzwungen</small></div></div><div class="table-wrap"><table><thead><tr><th>Tag</th><th>Morgens</th><th>Abends</th></tr></thead><tbody>${z.daily.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${val(x.morning)}</td><td>${val(x.evening)}</td></tr>`).join('')}</tbody></table></div><p class="section-note">Die Uhrzeitzuordnung ist eine vereinfachte Dokumentationsregel, keine medizinische Messvorschrift. Ein ärztlich vorgegebenes Messschema sowie Ruhe und Wiederholungsmessungen haben Vorrang.</p>`;}
function proChangesHtml(){const b=VKPro.comparePeriods(data.measurements,'bp',30,today()),g=VKPro.comparePeriods(data.measurements,'glucose',30,today());
 const line=(name,x,unit)=>`<tr><td>${h(name)}</td><td>${fmtPro(x.previous.mean)} (${x.previous.count})</td><td>${fmtPro(x.current.mean)} (${x.current.count})</td><td>${x.delta===null?'Zu wenige Daten':(x.delta>0?'+':'')+fmtPro(x.delta)+' '+h(unit)}</td></tr>`;
 return `<p>Letzte 30 Tage gegenüber den vorangegangenen 30 Tagen. Nur bestätigte Messungen; Vergleiche nur bei mindestens drei Werten in beiden Zeiträumen. Unterschiedliche Messbedingungen können die Mittelwerte verzerren.</p><div class="table-wrap"><table><thead><tr><th>Messgröße</th><th>Vorher Ø</th><th>Aktuell Ø</th><th>Veränderung</th></tr></thead><tbody>${line('Blutdruck systolisch',b,'mmHg')}${line('Blutzucker',g,'mg/dl')}</tbody></table></div>`;}
function proLabHtml(){const items=VKPro.labChanges(data.labs);return items.length?`<p>Jeweils zwei letzte bestätigte Befunde desselben Laborparameters mit identischer Einheit. Vergleichende Beschreibung, keine automatische Diagnose. Neue Referenzbereiche sind ausschließlich die Werte aus dem Originalbefund.</p><div class="table-wrap"><table><thead><tr><th>Wert</th><th>Vorher</th><th>Aktuell</th><th>Differenz</th></tr></thead><tbody>${items.map(v=>`<tr><td><b>${h(v.name)}</b> (${h(v.unit)})</td><td>${fmtPro(v.previous,2)} · ${fmtDate(v.previousDate)}</td><td>${fmtPro(v.current,2)} · ${fmtDate(v.currentDate)}</td><td>${v.delta>0?'+':''}${fmtPro(v.delta,3)}</td></tr>`).join('')}</tbody></table></div>`:'<p>Für einen Laborvergleich werden mindestens zwei bestätigte Ergebnisse desselben Parameters mit gleicher Einheit und unterschiedlichen Abnahmetagen benötigt.</p>'}
function proMedHtml(){const meds=data.meds||[],a=[...(data.profile.allergies||[]),...(data.profile.intolerances||[])].filter(Boolean);let overlaps=[];
 for(const med of meds){const name=String(med.name||'').toLocaleLowerCase('de-DE');for(const t of a){const term=String(t).trim().toLocaleLowerCase('de-DE');if(term.length>=4&&name.includes(term))overlaps.push({med:med.name,term:t})}}
 return `<p>Die Liste erfasst auch Bedarfsmedikamente, frei verkäufliche Mittel und Nahrungsergänzungen. Die automatische Kontrolle auf Wechselwirkungen ist <b>nicht vollständig</b> und ersetzt keine Apothekenprüfung.</p>`+
 (overlaps.length?warningBox(`Textliche Überschneidung von Allergie/Unverträglichkeit und Medikamentenname (${overlaps.length}). Bitte unbedingt fachlich abklären.`,'danger'):'<p>Kein einfacher Namensabgleich aufgefallen. Das schließt Allergien und Wechselwirkungen ausdrücklich nicht aus.</p>')+
 `<p><strong>Vor ärztlichen Terminen prüfen:</strong> Aktuelle Einnahme, Stärke, Änderungen, Selbstmedikation, Allergien und Nierenwerte.</p><button class="secondary" data-view="meds">Medikamentenplan prüfen</button>`;}
function proReportHtml(){return `<h2>7-Tage-Blutdruckprofil</h2>${bpProtocolHtml()}<h2>Messwert-Qualität</h2>${proQualityHtml()}<h2>30-Tage-Veränderungen</h2>${proChangesHtml()}<h2>Laborwert-Trends</h2>${proLabHtml()}<h2>Medikamenten-Sicherheitsprüfung</h2>${proMedHtml()}<p>Alle medizinischen Entscheidungen erfolgen durch behandelnde Fachpersonen.</p>`;}
function pagePro(){return tag('Gesundheitsanalyse Pro · 1.8.0','Zusatzfunktionen aus Version 1.6 bis 1.8. Keine automatische Diagnose, keine automatische Medikamentendosierung.')+
 panel('Messwertprüfung',proQualityHtml())+panel('7-Tage-Blutdruckprotokoll',bpProtocolHtml())+panel('30-Tage-Veränderungen',proChangesHtml())+panel('Laborwerte im Vergleich',proLabHtml())+panel('Medikamenten-Sicherheit',proMedHtml())+
 panel('Arztbericht erweitern',`<p>Dieser Export enthält zusätzlich die neuen Verlaufs- und Qualitätsangaben. Achtung: Der PDF-Export ist nicht verschlüsselt.</p><button class="primary" data-action="print-pro">Gesamtauswertung als PDF</button>`);}
function pagePrevention(){const e=data.checks.emergencyPlan||{};return tag('Vorsorge & persönlicher Notfallplan','Kontrollen, Kalenderexport und selbst hinterlegte ärztliche Anweisungen – lokal verschlüsselt.')+
 panel('Persönlicher Notfallplan (nur nach Entsperren)',`<div class="notice danger">Bei Lebensgefahr oder schweren akuten Symptomen 112 rufen. Die hier gespeicherten Anweisungen gelten nur, wenn sie individuell ärztlich festgelegt und aktuell sind.</div><form id="emergency-plan-form"><label class="field"><span>Ärztlich vereinbarte Maßnahmen</span><textarea name="actions" rows="5" maxlength="2500" placeholder="Nur tatsächlich mit der Praxis vereinbarte Maßnahmen">${h(e.actions||'')}</textarea></label><label class="field"><span>Weitere ärztliche Hinweise / Behandlungsteam</span><textarea name="doctorNotes" rows="3" maxlength="1200">${h(e.doctorNotes||'')}</textarea></label><p>Zuletzt überprüft: ${e.lastReviewed?fmtDate(e.lastReviewed):'Noch nie'}</p><button class="primary">Notfallplan lokal speichern</button></form><div class="actions"><button type="button" class="secondary" data-action="print-personal-emergency">Notfallplan als PDF</button><button type="button" class="secondary" data-view="emergency">Medizinischen Notfallpass öffnen</button></div>`)+
 panel('Kontrollen & Kalender',`<p>Alle bereits angelegten Kontrolltermine können als Kalenderdatei exportiert werden. Sie enthält Termine und Notizen im Klartext; deshalb vertraulich behandeln. Erinnerungen bei geschlossener Webapp werden nicht zuverlässig zugestellt.</p><button class="primary" data-action="export-ics">Kontrollen als .ics exportieren</button> <button class="secondary" data-view="reminders">Kontrolltermine verwalten</button>`)+
 panel('Vorsorge-Checkliste',`<p>Kontrollintervalle sind individuell zu vereinbaren – nicht jeder Untersuchungspunkt ist für jede Person erforderlich.</p><ul><li>Verordnung und Einnahmeplan regelmäßig abgleichen</li><li>Blutdruck, Blutzucker und Laborbefunde zum Arzttermin mitnehmen</li><li>Augen-, Nieren- und Fußkontrollen bei entsprechender Diabetesdiagnose ärztlich abstimmen</li><li>Vorsorgeuntersuchungen nach Alter und Risikofaktoren mit der Praxis besprechen</li><li>Impfstatus und bisherige Reaktionen gemeinsam prüfen</li></ul><button class="secondary" data-view="reminders">Kontrolle eintragen</button>`);}

/* VitalKompass 2.0.5: SpO₂ und Perfusionsindex im gemeinsamen Bereich. */
function vk204OxygenValid(r){
 return !!r&&typeof r.id==='string'&&r.id.length>0&&dateValid(r.date)&&r.date<=today()&&timeValid(r.time)&&
 Number.isInteger(r.spo2)&&r.spo2>=50&&r.spo2<=100&&
 (r.pi===null||(Number.isFinite(r.pi)&&r.pi>=0.01&&r.pi<=30))&&
 ['room','oxygen','unknown'].includes(r.situation)&&typeof r.note==='string'&&r.note.length<=400;
}
function vk204SpO2Level(value){
 if(!Number.isFinite(value))return {level:'gray',label:'Kein Messwert'};
 if(value<93)return {level:'red',label:'Niedriger Messwert – erneut prüfen und medizinisch abklären'};
 if(value<95)return {level:'yellow',label:'Unter üblichem Orientierungsbereich – Verlauf und Symptome beachten'};
 return {level:'green',label:'Im üblichen Erwachsenen-Orientierungsbereich (keine Entwarnung)'};
}
function vk204OxygenRows(){return [...(data.oxygenLogs||[])].filter(vk204OxygenValid).sort(sortdate)}
function vk204OxygenSituation(value){return ({room:'Raumluft',oxygen:'Mit Sauerstoffgabe',unknown:'Nicht angegeben'})[value]||'Nicht angegeben'}
function vk204OxygenStatsSection(rows,heading=true){
 const values=rows.map(r=>r.spo2).filter(Number.isFinite),pis=rows.map(r=>r.pi).filter(Number.isFinite);
 const s=values.length?{min:Math.min(...values),max:Math.max(...values),mean:avg(values)}:null;
 const p=pis.length?{min:Math.min(...pis),max:Math.max(...pis),mean:avg(pis)}:null;
 const counters={green:0,yellow:0,red:0};values.forEach(v=>{const c=vk204SpO2Level(v).level;if(c in counters)counters[c]++});
 return `${heading?'<h3>Blutsauerstoff & Perfusionsindex (PI)</h3>':''}<div class="vk204-stat-grid"><div class="vk204-stat"><span>SpO₂-Messungen</span><strong>${values.length}</strong><small>Min ${s?nf(s.min):'–'} % · Mittel ${s?nf(s.mean,1):'–'} % · Max ${s?nf(s.max):'–'} %</small></div><div class="vk204-stat"><span>PI-Messungen</span><strong>${pis.length}</strong><small>Min ${p?nf(p.min,2):'–'} % · Mittel ${p?nf(p.mean,2):'–'} % · Max ${p?nf(p.max,2):'–'} %</small></div></div><p class="section-note">SpO₂-Ampel: ${counters.green} im allgemeinen Orientierungsbereich, ${counters.yellow} grenzwertig, ${counters.red} niedrig. Der PI erhält keine pauschale Ampelbewertung. Einzelwerte sind keine Diagnosen; Messfehler und individuelle ärztliche Zielwerte beachten.</p>`;
}
function vk204OxygenChart(field,period='month',override=null){
 const oxygen=override||vk204OxygenRows();
 const all=override?oxygen:oxygen.filter(r=>r.date>=chartMinDate(period)&&r.date<=today());
 const keyOf=r=>chartBucket(r,period), buckets=new Map();
 for(const r of all){const k=keyOf(r);if(!buckets.has(k))buckets.set(k,{date:r.date,time:r.time,_bucket:k,values:[]});const v=r[field];if(Number.isFinite(v))buckets.get(k).values.push(v)}
 const rows=[...buckets.values()].filter(g=>g.values.length).map(g=>({...g,value:avg(g.values),count:g.values.length})).sort((a,b)=>a._bucket.localeCompare(b._bucket));
 const isSp=field==='spo2',title=isSp?'Blutsauerstoff (SpO₂)':'Perfusionsindex (PI)',unit='%';
 if(!rows.length)return `<p class="section-note">${title}: Für den gewählten Zeitraum liegen keine Messungen vor.</p>`;
 const W=700,H=275,L=50,R=18,T=18,B=47,plotW=W-L-R,plotH=H-T-B;
 const vals=rows.map(r=>r.value),lo=isSp?Math.max(50,Math.floor(Math.min(90,...vals)-4)):0;
 const hi=isSp?100:Math.max(1,Math.ceil(Math.max(...vals)*1.2*10)/10);
 const xx=i=>L+(rows.length===1?plotW/2:i*plotW/(rows.length-1));
 const yy=v=>T+plotH-(v-lo)/(hi-lo)*plotH;
 const grid=Array.from({length:5},(_,i)=>{const v=lo+(hi-lo)*i/4;return `<line x1="${L}" y1="${yy(v)}" x2="${W-R}" y2="${yy(v)}" stroke="#d8e4ef"/><text x="${L-6}" y="${yy(v)+4}" text-anchor="end" font-size="12" fill="#3d6077">${nf(v,isSp?0:2)}</text>`}).join('');
 const thresholds=isSp?[93,95].filter(v=>v>=lo).map(v=>`<line x1="${L}" x2="${W-R}" y1="${yy(v)}" y2="${yy(v)}" stroke="${v===93?'#c22842':'#b87910'}" stroke-dasharray="6 5" stroke-width="2" opacity=".8"><title>Orientierung ${v}%</title></line>`).join(''):'';
 const path=rows.length>1?`<polyline fill="none" stroke="${isSp?'#178377':'#2466a6'}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" points="${rows.map((r,i)=>xx(i)+','+yy(r.value)).join(' ')}"/>`:'';
 const dots=rows.map((r,i)=>{const level=isSp?vk204SpO2Level(r.value):{level:'blue',label:'PI: keine universelle medizinische Schwelle'};const col=isSp?VK_TRAFFIC_COLORS[level.level]:'#2466a6';const label=`${title} ${nf(r.value,2)} ${unit} · ${fmtDate(r.date)} · ${level.label}${r.count>1?' · Mittel aus '+r.count+' Messungen':''}`;return `<circle cx="${xx(i)}" cy="${yy(r.value)}" r="5.4" stroke="white" stroke-width="1.8" fill="${col}" tabindex="0" role="button" class="vk-chart-point" data-chart-info="${h(label)}"><title>${h(label)}</title></circle>`}).join('');
 const tickPos=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
 const ticks=tickPos.map(i=>`<text x="${xx(i)}" y="${H-15}" text-anchor="middle" font-size="12" fill="#365c70">${period==='ten'?h(rows[i]._bucket):fmtDate(rows[i].date)}</text>`).join('');
 return `<div class="chartwrap"><svg class="chart" role="img" aria-label="${title}, ${rows.length} Messpunkte" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${grid}${thresholds}${path}${dots}${vk205PointLabels(rows.map((r,i)=>({x:xx(i),y:yy(r.value),v:r.value})),W,H,L,R,T,B,isSp?0:2)}${ticks}</svg></div>${isSp?chartTrafficLegend():'<p class="section-note">PI in Prozent: Signalstärke der Durchblutung an der Messstelle. Keine allgemeingültigen Ampel-Grenzen; Gerät, Finger, Temperatur und Bewegung beeinflussen den Wert.</p>'}<p class="section-note">${title}: ${rows.length} Zeitpunkte${period==='day'?'':'; mehrere Messungen pro Zeitraum werden gemittelt'}. Für Trends Einzelwerte und Messumstände berücksichtigen.</p>`;
}
function vk204OxygenTable(rows,actions=true){
 if(!rows.length)return '<p class="section-note">Noch keine SpO₂-/PI-Messungen vorhanden.</p>';
 return `<div class="table-wrap"><table><thead><tr><th>Datum</th><th>SpO₂</th><th>PI</th><th>Messsituation / Notiz</th>${actions?'<th>Aktionen</th>':''}</tr></thead><tbody>${[...rows].reverse().slice(0,150).map(r=>`<tr><td>${fmtDate(r.date)} ${h(r.time)}</td><td><strong><span class="vk204-level vk204-${vk204SpO2Level(r.spo2).level}">${nf(r.spo2)} %</span></strong></td><td>${Number.isFinite(r.pi)?nf(r.pi,2)+' %':'–'}</td><td>${h(vk204OxygenSituation(r.situation))}${r.note?' · '+h(r.note):''}</td>${actions?`<td><button type="button" class="secondary" data-action="oxygen-edit" data-id="${h(r.id)}">Bearbeiten</button> <button type="button" class="dangerbutton" data-action="oxygen-remove" data-id="${h(r.id)}">Löschen</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function pageOxygen(){
 const rows=vk204OxygenRows(),latest=rows.at(-1),level=latest?vk204SpO2Level(latest.spo2):null;
 const quick=latest?`<div class="vk204-last"><div><span>Letzter Blutsauerstoff</span><strong class="vk204-level vk204-${level.level}">${latest.spo2} %</strong><small>${h(level.label)}</small></div><div><span>Perfusionsindex (PI)</span><strong>${Number.isFinite(latest.pi)?nf(latest.pi,2)+' %':'Nicht angegeben'}</strong><small>${fmtDate(latest.date)} · ${h(latest.time)}</small></div></div>`:'<p class="section-note">Noch keine Messung eingetragen.</p>';
 return tag('Blutsauerstoff & Durchblutung (PI)','SpO₂ und Perfusionsindex gemeinsam erfassen, getrennt auswerten und als PDF dokumentieren.')+
 panel('Aktuelle Messung',quick)+
 panel('Neue Messung eintragen',`<form id="oxygen-form"><input type="hidden" name="id" value=""><div class="form-grid"><label class="field"><span>Datum</span><input type="date" name="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input type="time" name="time" value="${nowTime()}" required></label><label class="field"><span>Blutsauerstoff SpO₂ (%)</span><input type="number" inputmode="numeric" name="spo2" min="50" max="100" step="1" required placeholder="z. B. 96"></label><label class="field"><span>Perfusionsindex PI (%) – optional</span><input type="number" inputmode="decimal" name="pi" min="0.01" max="30" step="0.01" placeholder="z. B. 3,20"></label><label class="field"><span>Messsituation</span><select name="situation"><option value="room">Raumluft</option><option value="oxygen">Mit Sauerstoffgabe</option><option value="unknown">Nicht angegeben</option></select></label><label class="field"><span>Messgerät, Beschwerden oder Notiz (optional)</span><input name="note" maxlength="400" placeholder="z. B. Ruhe, kalte Finger, nach Bewegung"></label></div><div class="actions"><button class="primary" type="submit" id="vk204-save">Messung speichern</button><button class="secondary" type="button" data-action="oxygen-reset">Bearbeitung abbrechen</button></div><p class="section-note">Die gespeicherten Werte werden ausschließlich lokal verschlüsselt abgelegt. Optionaler PI-Wert kann später ergänzt werden.</p></form>`)+
 panel('Blutsauerstoff – Diagramm',chartPicker('oxygen')+vk204OxygenChart('spo2',chartPeriods.oxygen))+
 panel('Durchblutungssignal PI – Diagramm',vk204OxygenChart('pi',chartPeriods.oxygen))+
 panel('Statistik',vk204OxygenStatsSection(rows,false)+`<p class="section-note">Für Monats- und Jahresberichte „Statistiken“ öffnen. Über „Arztbericht / PDF“ lässt sich dieser Bereich auch einzeln auswählen und exportieren.</p>`)+
 panel('Gespeicherte Messungen',vk204OxygenTable(rows))+
 panel('Wie sind die Werte einzuordnen?',`<p><strong>SpO₂:</strong> Die Ampel nutzt allgemeine Orientierungsbereiche für Erwachsene (grün ≥95 %, gelb 93–94 %, rot ≤92 %). Bei chronischen Lungenerkrankungen können ärztlich festgelegte Zielwerte abweichen. Bei deutlich niedriger Messung in Ruhe erneut messen und zeitnah medizinisch abklären; bei schwerer Atemnot, Brustschmerz, Verwirrtheit oder blauen Lippen <strong>112</strong> rufen.</p><p><strong>PI:</strong> Der Perfusionsindex zeigt die relative Puls-Signalstärke an der Messstelle, keine direkte Messung der Durchblutung im ganzen Körper. Dafür gibt es keine universell gültigen Ampelgrenzen. Kalte Finger, Bewegung, Nagellack und Gerätequalität können beide Werte beeinflussen. Die App ersetzt kein Pulsoximeter und keine ärztliche Beurteilung.</p>`);
}
async function vk204OxygenSubmit(f){
 const date=String(f.get('date')||''),time=String(f.get('time')||''),rawPi=String(f.get('pi')??'').trim();
 const spo2=Number(f.get('spo2')),pi=rawPi===''?null:nval(rawPi),entryId=String(f.get('id')||'');
 const item={id:entryId||id(),date,time,spo2,pi:pi===null?null:Math.round(pi*100)/100,situation:String(f.get('situation')||''),note:String(f.get('note')||'').slice(0,400)};
 if(!vk204OxygenValid(item))throw Error('Datum, Uhrzeit, SpO₂ (50–100 %) und PI (0,01–30 %, optional) überprüfen.');
 const before=data.oxygenLogs,existing=before.findIndex(r=>r.id===entryId);
 if(entryId&&existing<0)throw Error('Der zu bearbeitende Messwert wurde nicht gefunden.');
 const next=[...before];if(existing>=0)next[existing]=item;else next.push(item);
 data.oxygenLogs=next;try{await save()}catch(e){data.oxygenLogs=before;throw e}
 renderMain();toast('Blutsauerstoff und PI sicher gespeichert.');
 if(spo2<=92)alert('SpO₂ niedrig: nach kurzer Ruhe und mit warmen Fingern erneut messen. Bei erneut niedrigem Wert medizinische Hilfe holen. Bei schwerer Atemnot, Brustschmerz, Verwirrtheit oder blauen Lippen 112. Ärztliche Zielbereiche können individuell abweichen.');
}
function vk204OxygenEdit(entryId){
 const r=(data.oxygenLogs||[]).find(o=>o.id===entryId),form=$('#oxygen-form');if(!r||!form)throw Error('Messung oder Eingabeformular nicht gefunden.');
 for(const name of ['id','date','time','spo2','situation','note'])form.elements[name].value=r[name]??'';
 form.elements.pi.value=r.pi??'';
 const save=$('#vk204-save');if(save)save.textContent='Änderungen speichern';
 form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.spo2.focus();
}
async function vk204OxygenRemove(entryId){
 const before=data.oxygenLogs;if(!before.some(r=>r.id===entryId))throw Error('Messung nicht gefunden.');
 if(!confirm('Diese SpO₂-/PI-Messung dauerhaft löschen?'))return;
 data.oxygenLogs=before.filter(r=>r.id!==entryId);
 try{await save()}catch(e){data.oxygenLogs=before;throw e}
 renderMain();toast('Messung gelöscht.');
}


/* VitalKompass 2.0.5: gut lesbare Berichte und Krankenhausaufenthalte. */
function vk205Summary(title,rows,field,unit='',decimals=1){
 const values=rows.map(r=>r[field]).filter(Number.isFinite);
 if(!values.length)return `<p class="vk205-summary"><strong>${h(title)}</strong>: Keine Messungen im Zeitraum.</p>`;
 return `<p class="vk205-summary"><strong>${h(title)}</strong> · Minimum ${nf(Math.min(...values),decimals)} ${h(unit)} · Durchschnitt ${nf(avg(values),decimals)} ${h(unit)} · Maximum ${nf(Math.max(...values),decimals)} ${h(unit)}</p>`;
}
/* Zahl direkt am Messpunkt. Bei Platzmangel ist die Beschriftung ausgedünnt,
   nicht überlagert; jeder Einzelwert bleibt per Antippen des Punktes erreichbar. */
function vk205PointLabels(points,W,H,L,R,T,B,decimals=1){
 const clean=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.v));
 if(!clean.length)return '';
 const occupied=[];let output='';const maxCount=clean.length;
 const stride=Math.max(1,Math.ceil(maxCount/24));
 for(let index=0;index<clean.length;index++){
  const p=clean[index];if(index%stride!==0&&index!==clean.length-1)continue;
  const label=nf(p.v,decimals),width=Math.max(28,label.length*8.2+8),height=16;
  const cx=Math.max(L+width/2+2,Math.min(W-R-width/2-2,p.x));
  const candidates=[p.y-21,p.y+25,p.y-36,p.y+40];let chosen=null;
  for(const cy of candidates){
   const box={x:cx-width/2-4,y:cy-height+2,w:width+8,h:height+5};
   if(box.y<T+2||box.y+box.h>H-B-4)continue;
   if(occupied.some(b=>!(box.x+box.w+5<b.x||b.x+b.w+5<box.x||box.y+box.h+3<b.y||b.y+b.h+3<box.y)))continue;
   chosen={cy,box};break;
  }
  if(!chosen)continue;occupied.push(chosen.box);
  output+=`<text class="vk205-point-value" x="${cx}" y="${chosen.cy}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#12344e" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${h(label)}</text>`;
 }
 return output;
}
function vk205HospitalValid(s){
 if(!s||typeof s.id!=='string'||s.id.length<1||s.id.length>130||!dateValid(s.admitted)||s.admitted>today()||s.discharged!==''&&(!dateValid(s.discharged)||s.discharged<s.admitted||s.discharged>today()))return false;
 for(const field of ['hospital','department','diagnosis','treatment','notes'])if(typeof s[field]!=='string'||s[field].length>(field==='notes'?2500:field==='hospital'||field==='department'?150:1000))return false;
 if(!s.hospital.trim()||!Array.isArray(s.files)||s.files.length>4)return false;
 return s.files.every(vk201ValidateFile);
}
function vk205Stays(){return [...(data.hospitalStays||[])].filter(vk205HospitalValid).sort((a,b)=>b.admitted.localeCompare(a.admitted))}
function vk205HospitalOverlap(s,from,to){return s.admitted<=to&&(!s.discharged||s.discharged>=from)}
function vk205HospitalDays(s,from,to){const start=[s.admitted,from].sort().at(-1),end=[s.discharged||today(),to].sort()[0];if(start>end)return 0;return Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1}
function vk205HospitalReport(from,to,showList=true){
 const stays=vk205Stays().filter(s=>vk205HospitalOverlap(s,from,to));
 const days=stays.reduce((n,s)=>n+vk205HospitalDays(s,from,to),0);
 const intro=`<p class="vk205-summary"><strong>Krankenhausaufenthalte:</strong> ${stays.length} · dokumentierte Aufenthaltstage im Zeitraum: ${days}. ${stays.some(s=>!s.discharged)?'Mindestens ein Aufenthalt ohne Entlassungsdatum.':''}</p>`;
 if(!showList||!stays.length)return intro;
 return intro+vkReportTable(['Aufnahme / Entlassung','Krankenhaus / Fachbereich','Diagnosen / Behandlung','Befunde'],stays.map(s=>[fmtDate(s.admitted)+' – '+(s.discharged?fmtDate(s.discharged):'noch offen'),s.hospital+' / '+s.department,[s.diagnosis,s.treatment,s.notes].filter(Boolean).join(' · '),s.files.length+' Scan(s) gespeichert (nicht im PDF enthalten)']));
}
function vk205HospitalFilesHtml(s){
 const files=s?.files||[];
 return files.length?`<div class="vk205-file-list">${files.map((file,index)=>`<div class="vk205-file-row"><span>${h(file.name)} · ${nf(file.size/1024,0)} KB</span><button type="button" class="secondary" data-action="hospital-view-file" data-id="${h(s.id)}" data-index="${index}">Ansehen</button><label><input type="checkbox" name="removeFile" value="${index}"> Entfernen</label></div>`).join('')}</div>`:'<p class="section-note">Noch kein Dokument gespeichert.</p>';
}
function pageHospital(){
 const stays=vk205Stays(),[from,to]=statsRange(),existing=stays.filter(s=>vk205HospitalOverlap(s,from,to));
 return tag('Krankenhausaufenthalte & Scans','Aufenthalte, Arztbriefe und Befunde in einem verschlüsselten Bereich dokumentieren.')+
 panel('Aufenthalt erfassen oder ändern',`<form id="hospital-form" novalidate><input type="hidden" name="id" value=""><div class="form-grid"><label class="field"><span>Aufnahmedatum</span><input name="admitted" type="date" required value="${today()}"></label><label class="field"><span>Entlassungsdatum (leer = noch stationär)</span><input name="discharged" type="date"></label><label class="field"><span>Krankenhaus / Klinik</span><input name="hospital" maxlength="150" required placeholder="Name der Klinik"></label><label class="field"><span>Station / Fachabteilung</span><input name="department" maxlength="150" placeholder="z. B. Pneumologie"></label></div><label class="field"><span>Diagnosen / Aufnahmegrund</span><textarea name="diagnosis" rows="3" maxlength="1000"></textarea></label><label class="field"><span>Untersuchungen und Behandlung</span><textarea name="treatment" rows="3" maxlength="1000"></textarea></label><label class="field"><span>Notizen / Nachsorgetermin</span><textarea name="notes" rows="3" maxlength="2500"></textarea></label><div class="vk205-scans"><h3>Arztbriefe und Befunde scannen</h3><p class="section-note">Die iPhone-Kamera kann ein Foto eines Dokuments aufnehmen. Alternativ vorhandene Bilder/PDFs wählen. Fotos werden vor dem Verschlüsseln verkleinert; OCR/Texterkennung erfolgt nicht automatisch.</p><label class="field"><span>Mit Kamera aufnehmen</span><input name="scan" type="file" accept="image/*" capture="environment"></label><label class="field"><span>Vorhandene Bilder, PDFs oder Textdateien hinzufügen</span><input name="files" type="file" accept=".jpg,.jpeg,.png,.pdf,.txt,image/jpeg,image/png,application/pdf,text/plain" multiple></label><p class="section-note">Maximal vier Anhänge je Aufenthalt, je höchstens 1,5 MB nach Bildoptimierung. Gespeicherte Anhänge werden beim Bearbeiten angezeigt.</p><div id="vk205-existing-files"></div></div><div class="actions"><button class="primary" type="submit">Aufenthalt verschlüsselt speichern</button><button type="button" class="secondary" data-action="hospital-reset">Neue Eingabe / Abbrechen</button></div><p class="section-note" id="vk205-hospital-status" role="status"></p></form>`)+
 panel('Aufenthaltsstatistik',vk205HospitalReport(from,to,false)+`<p class="section-note">Für die Monats-/Jahresstatistik werden alle Aufenthalte berücksichtigt, die den ausgewählten Zeitraum schneiden.</p>`)+
 panel('Gespeicherte Aufenthalte',stays.length?stays.map(s=>`<article class="vk205-stay"><h3>${h(s.hospital)}</h3><p><strong>${fmtDate(s.admitted)} – ${s.discharged?fmtDate(s.discharged):'noch stationär'}</strong>${s.department?' · '+h(s.department):''}</p>${s.diagnosis?`<p><b>Diagnosen:</b> ${h(s.diagnosis)}</p>`:''}${s.treatment?`<p><b>Behandlung:</b> ${h(s.treatment)}</p>`:''}${s.notes?`<p>${h(s.notes)}</p>`:''}<p>${s.files.length} gespeicherte Dokumente</p><div class="actions"><button type="button" class="secondary" data-action="hospital-edit" data-id="${h(s.id)}">Bearbeiten / Scans</button><button type="button" class="dangerbutton" data-action="hospital-remove" data-id="${h(s.id)}">Aufenthalt löschen</button></div></article>`).join(''):'<p class="section-note">Noch kein Krankenhausaufenthalt dokumentiert.</p>');
}
function vk205HospitalEdit(entryId){
 const s=vk205Stays().find(v=>v.id===entryId),form=$('#hospital-form');if(!s||!form)throw Error('Aufenthalt nicht gefunden.');
 for(const field of ['id','admitted','discharged','hospital','department','diagnosis','treatment','notes'])form.elements[field].value=s[field]??'';
 $('#vk205-existing-files').innerHTML=vk205HospitalFilesHtml(s);
 form.scrollIntoView({behavior:'smooth',block:'start'});form.elements.hospital.focus();
}
async function vk205HospitalFile(file){
 if(!(file instanceof File)||!file.size)return null;
 let source=file;
 const isImage=/^image\/(jpeg|png|heic|heif)$/.test(file.type)||/\.(jpe?g|png|heic)$/i.test(file.name);
 if(isImage){
  try{
   const image=await createImageBitmap(file),long=Math.max(image.width,image.height),scale=Math.min(1,1600/long),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
   canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
   for(const q of [.82,.68,.53]){
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',q));if(blob&&blob.size<=VK201_LIMIT){source=new File([blob],file.name.replace(/\.[^.]+$/, '')+'.jpg',{type:'image/jpeg'});break}
   }
  }catch{/* Originaldatei wird danach auf Dateigröße geprüft. */}
 }
 if(source.size>VK201_LIMIT)throw Error('Scan zu groß. Bitte ein gut lesbares Foto oder ein PDF unter 1,5 MB auswählen.');
 const list=await vk201ReadNew([source]);if(list.length!==1)throw Error('Das Dokument konnte nicht gelesen werden.');return list[0];
}
async function vk205HospitalSave(form){
 const f=new FormData(form),entryId=String(f.get('id')||''),before=data.hospitalStays||[],existing=entryId?before.find(s=>s.id===entryId):null;
 if(entryId&&!existing)throw Error('Der bisherige Aufenthalt wurde nicht gefunden.');
 const files=[...(existing?.files||[])],removed=new Set(f.getAll('removeFile').map(String));
 if([...removed].some(v=>!/^(0|[1-9]\d*)$/.test(v)||Number(v)>=files.length))throw Error('Anhangsauswahl ungültig.');
 const keep=files.filter((_,i)=>!removed.has(String(i))),newFiles=[...form.querySelectorAll('input[type=file]')].flatMap(el=>[...el.files]).filter(f=>f.size>0);
 if(keep.length+newFiles.length>4)throw Error('Pro Aufenthalt sind insgesamt höchstens vier Scans erlaubt.');
 const added=[];for(const file of newFiles)added.push(await vk205HospitalFile(file));
 const s={id:entryId||id(),admitted:String(f.get('admitted')||''),discharged:String(f.get('discharged')||''),hospital:String(f.get('hospital')||'').trim(),department:String(f.get('department')||'').trim(),diagnosis:String(f.get('diagnosis')||'').trim(),treatment:String(f.get('treatment')||'').trim(),notes:String(f.get('notes')||'').trim(),files:[...keep,...added]};
 if(!vk205HospitalValid(s))throw Error('Aufnahme/Entlassung, Krankenhaus oder Dokumente überprüfen.');
 const next=entryId?before.map(x=>x.id===entryId?s:x):[...before,s];
 if(!vk201BackupWithinLimit({...data,hospitalStays:next}))throw Error('Verschlüsselter Dokumentenspeicher über 12 MB. Bitte weniger oder kleinere Scans speichern.');
 data.hospitalStays=next;try{await save()}catch(e){data.hospitalStays=before;throw e}
 renderMain();toast('Krankenhausaufenthalt und Scans verschlüsselt gespeichert.');
}
async function vk205HospitalRemove(entryId){
 const previous=data.hospitalStays||[];if(!previous.some(x=>x.id===entryId))throw Error('Aufenthalt nicht gefunden.');
 if(!confirm('Aufenthalt und zugehörige Scans dauerhaft löschen?'))return;
 data.hospitalStays=previous.filter(x=>x.id!==entryId);try{await save()}catch(e){data.hospitalStays=previous;throw e}
 renderMain();toast('Aufenthalt gelöscht.');
}
function vk205HospitalView(entryId,index){
 const s=vk205Stays().find(x=>x.id===entryId),a=s?.files[Number(index)];if(!a||!vk201ValidateFile(a))throw Error('Dokument nicht gefunden oder ungültig.');
 const bytes=unb64(a.base64),blob=new Blob([bytes],{type:a.mime}),url=URL.createObjectURL(blob);
 const dialog=document.createElement('div');dialog.id='vk205-document-preview';dialog.className='vk205-preview';
 const filename=document.createElement('strong');filename.textContent=a.name;
 const btn=document.createElement('button');btn.textContent='Schließen';btn.type='button';btn.className='secondary';btn.onclick=()=>{dialog.remove();URL.revokeObjectURL(url)};
 const bar=document.createElement('div');bar.append(filename,btn);dialog.append(bar);
 const preview=document.createElement(a.mime.startsWith('image/')?'img':a.mime==='application/pdf'?'iframe':'pre');
 if(preview.tagName==='PRE'){preview.textContent=new TextDecoder().decode(bytes)}else{preview.src=url;preview.setAttribute('title',a.name)}
 dialog.append(preview);document.getElementById('vk205-document-preview')?.remove();document.body.append(dialog);
}


function pageGlucose(){return tag('Blutzucker','Werte in mg/dl oder mmol/l eintragen; Diagramme unterscheiden die Messsituationen durch Farben.')+photoNote()+vkFastingInfo('glucose')+panel('Accu-Chek Instant über ESP32-C6 · Hardware-Beta',`<p><strong>Ohne externe Diabetes-App und ohne Cloud:</strong> Accu-Chek Instant → ESP32-C6 → lokal verschlüsselte JSON-Datei → VitalKompass.</p><p>Den ESP32 nur mit der eigenen, separat installierten Firmware verwenden. Seine lokale WLAN-Seite unter <b>http://192.168.4.1</b> öffnest du getrennt von VitalKompass. Die Messwertdatei muss mit dem privaten Transfer-Schlüssel verschlüsselt sein. <strong>Das Gerät wurde noch nicht mit unserer Firmware real getestet; kein automatischer Hintergrundabgleich.</strong></p><form id="meter-bridge-form"><label class="field"><span>Verschlüsselte ESP32-Datei (.json)</span><input type="file" name="file" accept=".json,application/json" required></label><label class="field"><span>Privater Transfersschlüssel (64 Hex-Zeichen)</span><input type="password" name="secret" autocomplete="off" autocapitalize="off" spellcheck="false" minlength="64" maxlength="64" required></label><button class="primary">Datei entschlüsseln und Vorschau prüfen</button></form><div id="bridge-preview"></div><p class="section-note">Nur Daten des richtigen Patienten übernehmen. Importierte Werte bleiben zunächst ungeprüft. Alle Daten bleiben im verschlüsselten VitalKompass-Speicher.</p>`)+panel('Neuen Blutzucker messen' ,`<form id="glucose-form"><div class="form-grid"><label class="field"><span>Datum</span><input type="date" name="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input type="time" name="time" value="${nowTime()}" required></label><label class="field"><span>Messsituation</span><select name="period"><option value="fasting">Nüchtern</option><option value="before">Vor dem Essen</option><option value="after">Nach dem Essen</option><option value="other">Sonstige</option></select></label><label class="field"><span>Wert</span><input type="number" name="value" step="0.1" min="0.1" max="999" inputmode="decimal" required></label><label class="field"><span>Einheit</span><select name="unit"><option value="mgdl">mg/dl</option><option value="mmol">mmol/l</option></select></label><label class="field"><span>Notiz (optional)</span><input name="note" maxlength="400" placeholder="Essen, Aktivität, Beschwerden ..."></label></div><div class="actions"><button class="primary" type="submit">Blutzucker speichern</button></div></form>`)+panel('Blutzuckerverlauf',`${chartPicker('glucose')}${lineChart('glucose',chartPeriods.glucose,720)}<p class="section-note">Orientierungswerte für die Warnanzeige sind unter Einstellungen anpassbar. Aus Fotos stammende Werte zählen erst nach Prüfung als bestätigt.</p>`)+panel('Alle Blutzuckerwerte',measurementTable('glucose'))}
function pageBp(){return tag('Blutdruck','Systolischer, diastolischer Wert und Puls sind einzeln farbig dargestellt.')+panel('Neue Blutdruckmessung',`<form id="bp-form"><div class="form-grid"><label class="field"><span>Datum</span><input name="date" type="date" value="${today()}" required></label><label class="field"><span>Uhrzeit</span><input name="time" type="time" value="${nowTime()}" required></label><label class="field"><span>Systolisch (mmHg)</span><input name="sys" type="number" min="40" max="320" required></label><label class="field"><span>Diastolisch (mmHg)</span><input name="dia" type="number" min="20" max="220" required></label><label class="field"><span>Puls (pro Min., optional)</span><input name="pulse" type="number" min="20" max="240"></label><label class="field"><span>Bezug zur Mahlzeit</span><select name="mealTiming">${Object.entries(bpMealLabels).map(([k,v])=>`<option value="${k}">${h(v)}</option>`).join('')}</select></label><label class="field"><span>Notiz</span><input name="note" maxlength="400" placeholder="Ruhe, Bewegung, Beschwerden"></label></div><div class="actions"><button class="primary">Blutdruck speichern</button></div></form>`)+panel('Blutdruck gemeinsam – Trend',chartPicker('bp')+lineChart('bp',chartPeriods['bp'],720))+panel('Systolisch mit Warnlinien',chartPicker('bp-sys')+lineChart('bp-sys',chartPeriods['bp-sys'],720))+panel('Diastolisch mit Warnlinien',chartPicker('bp-dia')+lineChart('bp-dia',chartPeriods['bp-dia'],720))+panel('Puls mit Warnlinien',chartPicker('pulse')+lineChart('pulse',chartPeriods['pulse'],720))+panel('Messwertverlauf',measurementTable('bp'))}
function thresholdDefs(type){const s=data.settings;return type==='bp-sys'?[[s.bpLowSys,'Zu niedrig',levelColors.low],[s.bpHighSys,'Erhöht',levelColors.high],[Math.min(s.bpCriticalSys,180),'Sehr hoch: Arzt',levelColors.critical]]:type==='bp-dia'?[[s.bpLowDia,'Zu niedrig',levelColors.low],[s.bpHighDia,'Erhöht',levelColors.high],[Math.min(s.bpCriticalDia,110),'Sehr hoch: Arzt',levelColors.critical]]:type==='pulse'?[[s.pulseCriticalLow,'Sehr niedrig',levelColors.critical],[s.pulseLow,'Niedrig',levelColors.low],[s.pulseHigh,'Erhöht',levelColors.high],[s.pulseCriticalHigh,'Sehr hoch',levelColors.critical]]:type==='glucose'?[[54,'Starke Unterzuckerung',levelColors.critical],[70,'Unterzuckerung',levelColors.low],[s.glucoseFastingHigh,'Vor Essen: Obergrenze',levelColors.good],[s.glucoseAfterHigh,'Nach Essen: Obergrenze',levelColors.high],[Math.min(s.glucoseCriticalHigh,300),'Sehr hoch: kontrollieren',levelColors.critical]]:[];}
function classification(e,type){const s=data.settings;if(e.verified!==true)return {label:'Noch nicht bestätigt',level:'pending'};
if(type==='glucose'){const v=e.mgdl,hi=e.period==='after'?s.glucoseAfterHigh:e.period==='fasting'||e.period==='before'?s.glucoseFastingHigh:s.glucoseOtherHigh;if(v<54)return {label:'Kritisch niedrig – sofort handeln',level:'critical'};if(v<70)return {label:'Zu niedrig – sofort handeln',level:'low'};if(v>=Math.min(s.glucoseCriticalHigh,300))return {label:'Sehr hoch – zeitnah abklären',level:'critical'};if((e.period==='fasting'||e.period==='before')&&v<s.glucoseFastingLow)return {label:'Unter dem eingestellten Nüchtern-Ziel',level:'low'};return v>hi?{label:'Über Zielbereich',level:'high'}:{label:'Im Orientierungsbereich',level:'good'};}
if(type==='bp'){if(e.sys>=180||e.dia>=110||e.sys>=s.bpCriticalSys||e.dia>=s.bpCriticalDia)return {label:'Sehr hoch – umgehend abklären',level:'critical'};if(e.sys<s.bpLowSys||e.dia<s.bpLowDia)return {label:'Niedrig – Beschwerden beachten',level:'low'};if(e.sys>=s.bpHighSys||e.dia>=s.bpHighDia)return {label:'Erhöht',level:'high'};return {label:'Im Orientierungsbereich',level:'good'};}
if(type==='pulse'){if(!Number.isFinite(e.pulse))return {label:'Puls fehlt',level:'pending'};if(e.pulse<s.pulseCriticalLow||e.pulse>=s.pulseCriticalHigh)return {label:'Sehr auffällig – abklären',level:'critical'};if(e.pulse<s.pulseLow)return {label:'Niedrig – Symptome prüfen',level:'low'};if(e.pulse>s.pulseHigh)return {label:'Erhöht – Ruhe/Belastung prüfen',level:'high'};return {label:'Im Orientierungsbereich',level:'good'};}
return {label:'',level:'pending'};}

/* VitalKompass 2.0.6: Diagramme zeigen ausschliesslich gespeicherte Originalmessungen. */
/* VitalKompass 2.0.7 – echte Einzelwerte, Essensfilter, groessere Achsen und zoomfaehige SVG-Ansicht. */
let vk207GlucoseFilter='all';
function vk207GlucosePicker(){
 const options=[['all','Alle zusammen'],['fasting','Nüchtern'],['before','Vor dem Essen'],['after','Nach dem Essen']];
 return `<div class="vk207-filter" role="group" aria-label="Blutzuckermessungen nach Essenszeitpunkt filtern"><span class="vk207-filter-title">Messwerte anzeigen</span><div class="vk207-filter-buttons">${options.map(([key,label])=>`<button type="button" data-vk207-glucose="${key}" class="${vk207GlucoseFilter===key?'active':''}" aria-pressed="${vk207GlucoseFilter===key}">${label}</button>`).join('')}</div><small>Nüchtern ist separat auswählbar. Sonstige Messungen erscheinen bei „Alle zusammen“. Keine Messwerte werden geändert oder gelöscht.</small></div>`;
}
function vk207GlucoseChart(days='month',wide=720,preloaded=null){
 const period=preloaded!==null?(reportPeriod==='year'?'year':'month'):(CHART_PERIODS.some(x=>x[0]===days)?days:(chartPeriods.glucose||'month'));
 const minDate=chartMinDate(period),source=preloaded!==null?preloaded:filtered('glucose');
 const showFilter=preloaded===null,selection=showFilter?vk207GlucoseFilter:'all';
 // Der Filter beeinflusst ausschliesslich die Darstellung. Keine Datenveraenderung, keine Mittelwerte.
 const rows=[...source].filter(r=>r&&
  (r.type===undefined||r.type==='glucose')&&
  typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&
  Number.isFinite(r.mgdl)&&r.mgdl>0&&r.mgdl<=999&&
  (preloaded!==null||(r.date>=minDate&&r.date<=today()))&&
  (selection==='all'||r.period===selection)
 ).sort(sortdate);
 const legend=`<div class="vk207-chart-legend"><span><i style="background:#184f83"></i>Chronologischer Verlauf</span>${Object.keys(gLabels).filter(k=>selection==='all'||k===selection).map(k=>`<span><i style="background:${colors[k]}"></i>${h(gLabels[k])}</span>`).join('')}<span><i class="vk207-open-dot"></i>Offen = noch nicht bestätigt</span></div>`;
 if(!rows.length)return `<div class="vk207-no-values" role="status">Für diese Auswahl sind keine gespeicherten Messwerte vorhanden.</div>${legend}`;
 // Eine hohe Diagrammflaeche und dynamische, sichtbare Skala mit 9 waagerechten Hilfslinien.
 // Bei PDF-Berichten bleiben die breiteren A4-Masse erhalten.
 const W=preloaded!==null?720:460,H=preloaded!==null?350:410,L=49,R=14,T=29,B=58;
 const plotW=W-L-R,plotH=H-T-B,values=rows.map(r=>r.mgdl),vmin=Math.min(...values),vmax=Math.max(...values);
 let lo=Math.max(0,Math.floor((vmin-8)/10)*10),hi=Math.ceil((vmax+8)/10)*10;
 if(hi-lo<40){const mid=(lo+hi)/2;lo=Math.max(0,Math.floor((mid-20)/10)*10);hi=Math.ceil((mid+20)/10)*10}
 if(hi<=lo)hi=lo+40;
 const y=v=>T+plotH-((v-lo)/(hi-lo))*plotH;
 const times=rows.map(r=>Date.parse(`${r.date}T${/^\d{2}:\d{2}$/.test(r.time||'')?r.time:'12:00'}:00`));
 const useTime=times.every(Number.isFinite)&&times.length>1&&times.at(-1)>times[0];
 const x=i=>L+(rows.length===1?plotW/2:useTime?plotW*(times[i]-times[0])/(times.at(-1)-times[0]):plotW*i/(rows.length-1));
 const count=9;
 const grid=Array.from({length:count},(_,i)=>{const v=lo+(hi-lo)*i/(count-1),py=y(v);return `<line x1="${L}" y1="${py}" x2="${W-R}" y2="${py}" stroke="#dde9f0"/><text x="${L-6}" y="${py+4.5}" font-size="13" text-anchor="end" fill="#365366">${nf(v,0)}</text>`}).join('');
 const guides=thresholdDefs('glucose').filter(([v])=>v>=lo&&v<=hi).map(([v,label,col])=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="${col}" stroke-dasharray="6 5" stroke-width="1.6" opacity=".8"><title>${h(label)}: ${nf(v)} mg/dl</title></line>`).join('');
 const points=rows.length>1?`<polyline points="${rows.map((r,i)=>`${x(i)},${y(r.mgdl)}`).join(' ')}" fill="none" stroke="#184f83" stroke-width="3.1" stroke-linejoin="round" stroke-linecap="round"/>`:'';
 const dots=rows.map((r,i)=>{
  const kind=Object.prototype.hasOwnProperty.call(gLabels,r.period)?r.period:'other';
  const color=colors[kind];
  const classificationText=chartTraffic('glucose',r,kind).label;
  const label=`${gLabels[kind]} · ${nf(r.mgdl,1)} mg/dl · ${fmtDate(r.date)} ${r.time||''} · ${classificationText} · ${r.verified===true?'bestätigt':'noch unbestätigt'}${r.note?' · '+r.note:''}`;
  return `<circle cx="${x(i)}" cy="${y(r.mgdl)}" r="5.4" fill="${r.verified===true?color:'#fff'}" stroke="${color}" stroke-width="${r.verified===true?'1.5':'2.7'}" class="vk-chart-point" role="button" tabindex="0" data-chart-info="${h(label)}"><title>${h(label)}</title></circle>`;
 }).join('');
 // 9 Skalenmarken plus bis zu 18 abstandsgesicherte Originalwert-Beschriftungen.
 const labelRows=rows.map((r,i)=>({x:x(i),y:y(r.mgdl),v:r.mgdl}));
 const labels=vk205PointLabels(labelRows,W,H,L,R,T,B,1);
 const indices=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
 const ticks=indices.map(i=>`<text x="${x(i)}" y="${H-23}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}" font-size="12.5" fill="#365366">${fmtDate(rows[i].date)}</text>`).join('');
 const unverified=rows.filter(r=>r.verified!==true).length;
 return `<div class="chartwrap vk207-glucose-wrap"><svg class="chart" role="img" aria-label="Blutzucker: ${rows.length} echte Einzelmessungen, Auswahl ${h(selection)}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${grid}${guides}<line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#708da0"/>${points}${dots}${labels}${ticks}<text x="${L}" y="${H-7}" font-size="12" fill="#395b70">mg/dl · ${rows.length} Messung${rows.length===1?'':'en'}</text></svg></div>${legend}<p class="section-note">${rows.length} gespeicherte Einzelmessung${rows.length===1?'':'en'} · ${unverified} noch nicht bestätigt. Nur echte Messwerte, keine Mittelwerte. Tippe auf einen Messpunkt für Datum, Uhrzeit und Details. Zum Vergrößern „Diagramm groß ansehen“ wählen.</p>`;
}

/* Gemeinsamer lokaler Diagramm-Zoom – fuer Blutzucker, Blutdruck, Gewicht, Puls, SpO2 usw. */
function vk207EnhanceCharts(){
 const main=document.getElementById('main');if(!main)return;
 main.querySelectorAll('.chartwrap').forEach(wrap=>{
  if(!wrap.querySelector('svg.chart')||wrap.dataset.vk207ZoomInstalled)return;
  wrap.dataset.vk207ZoomInstalled='yes';
  const toolbar=document.createElement('div');toolbar.className='vk207-chart-toolbar';
  const button=document.createElement('button');button.type='button';button.className='secondary vk207-open-zoom';button.setAttribute('data-vk207-open','');
  button.textContent='Diagramm groß ansehen / zoomen';
  toolbar.appendChild(button);wrap.before(toolbar);
 });
}
function vk207CloseZoom(){
 const modal=document.getElementById('vk207-zoom');if(!modal)return;
 modal.remove();document.body.classList.remove('vk207-zoom-active');
 if(typeof vk207ZoomReturnFocus?.focus==='function'&&vk207ZoomReturnFocus.isConnected)vk207ZoomReturnFocus.focus();
 vk207ZoomReturnFocus=null;
}
let vk207ZoomReturnFocus=null;
function vk207OpenZoom(button){
 const wrap=button.closest('.vk207-chart-toolbar')?.nextElementSibling;
 const source=wrap?.querySelector('svg.chart');if(!source)return;
 vk207CloseZoom();vk207ZoomReturnFocus=button;
 const modal=document.createElement('div');modal.id='vk207-zoom';modal.className='vk207-modal';
 modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Diagrammvergrößerung');
 const heading=wrap.closest('.panel')?.querySelector('h2')?.textContent?.trim()||'Diagramm';
 modal.innerHTML=`<div class="vk207-dialog"><div class="vk207-dialog-header"><strong></strong><div class="vk207-dialog-actions"><button type="button" data-vk207-minus aria-label="Verkleinern">−</button><span class="vk207-percent" aria-live="polite">100 %</span><button type="button" data-vk207-plus aria-label="Vergrößern">+</button><button type="button" data-vk207-reset>100 %</button><button type="button" data-vk207-close>Schließen</button></div></div><p class="vk207-zoom-hint">Mit + und − vergrößern oder verkleinern, mit dem Finger im Diagramm verschieben. Zwei Finger zum Zoomen möglich. Auf einen Punkt tippen zeigt den Originalwert.</p><div class="vk207-zoom-viewport" tabindex="0" aria-label="Vergrößertes Diagramm, horizontal und vertikal verschiebbar"><div class="vk207-zoom-canvas"></div></div></div>`;
 modal.querySelector('strong').textContent=heading;
 const canvas=modal.querySelector('.vk207-zoom-canvas'),viewport=modal.querySelector('.vk207-zoom-viewport');
 canvas.appendChild(source.cloneNode(true));
 document.body.appendChild(modal);document.body.classList.add('vk207-zoom-active');
 let scale=1;
 function setScale(next){
  const n=Math.min(5,Math.max(1,Math.round(next*20)/20));
  const old=scale,centerX=viewport.scrollLeft+viewport.clientWidth/2,centerY=viewport.scrollTop+viewport.clientHeight/2;
  scale=n;canvas.style.width=`${scale*100}%`;
  viewport.scrollLeft=Math.max(0,centerX*scale/old-viewport.clientWidth/2);
  viewport.scrollTop=Math.max(0,centerY*scale/old-viewport.clientHeight/2);
  modal.querySelector('.vk207-percent').textContent=`${Math.round(scale*100)} %`;
  modal.querySelector('[data-vk207-minus]').disabled=scale<=1;
  modal.querySelector('[data-vk207-plus]').disabled=scale>=5;
 }
 setScale(1);
 modal.addEventListener('click',e=>{
  if(e.target.closest('[data-vk207-close]')){vk207CloseZoom();return}
  if(e.target.closest('[data-vk207-plus]')){setScale(scale+.5);return}
  if(e.target.closest('[data-vk207-minus]')){setScale(scale-.5);return}
  if(e.target.closest('[data-vk207-reset]')){setScale(1);viewport.scrollTo(0,0);return}
  const pt=e.target.closest('[data-chart-info]');if(pt){toast(pt.dataset.chartInfo||'Messwert');return}
  if(e.target===modal)vk207CloseZoom();
 });
 modal.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();vk207CloseZoom();return}
  if(e.key==='+'||e.key==='='){e.preventDefault();setScale(scale+.5)}
  if(e.key==='-'){e.preventDefault();setScale(scale-.5)}
 });
 let pinchDistance=0,pinchScale=1;
 viewport.addEventListener('touchstart',e=>{
  if(e.touches.length===2){pinchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);pinchScale=scale}
 },{passive:true});
 viewport.addEventListener('touchmove',e=>{
  if(e.touches.length===2&&pinchDistance>5){e.preventDefault();const distance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);setScale(pinchScale*distance/pinchDistance)}
 },{passive:false});
 viewport.addEventListener('touchend',e=>{if(e.touches.length<2)pinchDistance=0},{passive:true});
 modal.querySelector('[data-vk207-close]').focus();
}

function lineChart(type,days='90',wide=700,preloaded=null){if(type==='glucose')return vk207GlucoseChart(days,wide,preloaded);const source=preloaded||filtered(['pulse','bp-sys','bp-dia'].includes(type)?'bp':type);const period=preloaded?(reportPeriod==='year'?'year':'month'):(CHART_PERIODS.some(x=>x[0]===days)?days:(chartPeriods[type]||'month'));const minDate=chartMinDate(period);const relevant=preloaded?source:source.filter(x=>x.date>=minDate&&x.date<=today());const rows=chartAggregate(relevant,type,period);let series=type==='bp-sys'?[['sys','Systolisch',colors.sys,e=>e.sys]]:type==='bp-dia'?[['dia','Diastolisch',colors.dia,e=>e.dia]]:type==='glucose'?[['fasting',gLabels.fasting,colors.fasting,e=>e.period==='fasting'?e.mgdl:null],['before',gLabels.before,colors.before,e=>e.period==='before'?e.mgdl:null],['after',gLabels.after,colors.after,e=>e.period==='after'?e.mgdl:null],['other',gLabels.other,colors.other,e=>e.period==='other'?e.mgdl:null]]:type==='bp'?[['sys','Systolisch (mmHg)',colors.sys,e=>e.sys],['dia','Diastolisch (mmHg)',colors.dia,e=>e.dia]]:[['pulse','Puls (/Min.)',colors.pulse,e=>e.pulse]];
const title=type==='glucose'?'Blutzucker in mg/dl':type==='bp'?'Blutdruck in mmHg':type==='bp-sys'?'Systolischer Blutdruck in mmHg':type==='bp-dia'?'Diastolischer Blutdruck in mmHg':'Puls pro Minute';const thresholds=thresholdDefs(type);const legend=`<div class="legend" aria-label="Farblegende: Messwerte durchgezogen, Referenzlinien gestrichelt">${series.map(([code,label,col])=>`<span><i class="solid-line" style="border-color:${col}"></i>${h(label)} (Messwerte)</span>`).join('')}${thresholds.map(([v,label,col])=>`<span><i class="dash" style="border-color:${col}"></i>${h(label)}: ${nf(v)} (Referenz)</span>`).join('')}${rows.some(r=>r.verified!==true)?'<span><i class="open-dot"></i>Offener Punkt: noch ungeprüft</span>':''}</div>`;
if(!rows.length)return `<p class="section-note">Noch keine Messungen für diesen Zeitraum.</p>${legend}${chartTrafficLegend()}`;
const W=wide,H=295,L=50,R=18,T=20,B=42,plotW=W-L-R,plotH=H-T-B,values=rows.flatMap(e=>series.map(s=>s[3](e)).filter(Number.isFinite));if(!values.length)return `<p>Keine gültigen Werte verfügbar.</p>${legend}${chartTrafficLegend()}`;
let allValues=[...values,...thresholds.map(x=>x[0])];let lo=Math.max(0,Math.floor((Math.min(...allValues)-15)/10)*10),hi=Math.ceil((Math.max(...allValues)+15)/10)*10;if(hi<=lo)hi=lo+20;
const x=i=>L+(rows.length===1?plotW/2:plotW*i/(rows.length-1));const y=v=>T+plotH-((v-lo)/(hi-lo))*plotH;
const grid=Array.from({length:5},(_,i)=>{let v=lo+(hi-lo)*i/4,py=y(v);return `<line x1="${L}" y1="${py}" x2="${W-R}" y2="${py}" stroke="#d8e5ee"/><text x="${L-7}" y="${py+4}" font-size="11" text-anchor="end" fill="#587184">${nf(v,0)}</text>`}).join('');
const guidelineLines=thresholds.map(([v,label,col])=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" stroke="${col}" stroke-width="2" stroke-dasharray="7 5" opacity="0.85"><title>${h(label)}: ${nf(v)}</title></line>`).join('');
// All real measurements use a continuous solid path. Unverified points remain identifiable by hollow markers.
 const lines=series.map(([code,label,col,getv])=>{const points=rows.map((e,i)=>({e,i,v:getv(e)})).filter(o=>Number.isFinite(o.v));const path=points.length>1?`<polyline points="${points.map(o=>`${x(o.i)},${y(o.v)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>`:'';const dots=points.map(o=>{const t=chartTraffic(type,o.e,code);const desc=label+' '+nf(o.v,1)+' · '+fmtDate(o.e.date)+' '+(o.e.time||'')+' · '+t.label+(o.e.verified!==true?' · noch ungeprüft':'');return `<circle cx="${x(o.i)}" cy="${y(o.v)}" r="5.2" tabindex="0" role="button" class="vk-chart-point" data-chart-info="${h(desc)}" fill="${o.e.verified===true?VK_TRAFFIC_COLORS[t.level]:'#fff'}" stroke="${o.e.verified===true?'#fff':VK_TRAFFIC_COLORS[t.level]}" stroke-width="${o.e.verified===true?'1.7':'2.9'}"><title>${h(desc)}</title></circle>`}).join('');return path+dots}).join('');
const ticks=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=>`<text x="${x(i)}" y="${H-13}" text-anchor="middle" font-size="11" fill="#587184">${period==='ten'?h(rows[i]._bucket||rows[i].date.slice(0,7)):fmtDate(rows[i].date)}</text>`).join('');
return `<div class="chartwrap"><svg class="chart" role="img" aria-label="${h(title)}: ${rows.length} Messwerte, Farblegende unter der Kurve" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${grid}${guidelineLines}<line x1="${L}" x2="${L}" y1="${T}" y2="${H-B}" stroke="#7996a9"/>${lines}${vk205PointLabels(rows.flatMap((r,i)=>series.map(s=>({x:x(i),y:y(s[3](r)),v:s[3](r)}))).filter(p=>Number.isFinite(p.v)),W,H,L,R,T,B,type==='glucose'?1:0)}${ticks}</svg></div>${legend}${chartTrafficLegend()}<p class="section-note">${rows.filter(r=>r.verified!==true).length?'Offene Messpunkte kennzeichnen ungeprüfte Einträge (siehe Tabelle). ':''}Messwertlinien sind durchgezogen; Referenzlinien sind gestrichelt. Kurven dienen der Dokumentation; Grenzwerte sind individuell zu vereinbaren.</p>`}
function labLabel(x){return `${h(x.comparator==='<'?'<':x.comparator==='>'?'>':'')}${nf(x.value,3)} ${h(x.unit||'')}`}
function labIsOutside(x){if(x.comparator)return false;return (Number.isFinite(x.low)&&x.value<x.low)||(Number.isFinite(x.high)&&x.value>x.high)}
function labReference(x){return `${Number.isFinite(x.low)?'ab '+nf(x.low,3):''}${Number.isFinite(x.low)&&Number.isFinite(x.high)?' bis ':''}${Number.isFinite(x.high)?(Number.isFinite(x.low)?nf(x.high,3):'bis '+nf(x.high,3)):''}`||'Keine feste Referenz im Befund'}
function pagePSAFast(){return panel('PSA / Prostata – Schnelleingabe',`<p>Gesamt-PSA und freies PSA können direkt erfasst werden. Das Verhältnis wird berechnet, wenn beide Werte vorliegen. Es gibt <strong>keinen pauschal sicheren PSA-Grenzwert</strong>; Alter, Beschwerden, Prostatagröße, Medikamente und Verlauf sind wichtig.</p><form id="psa-form"><div class="form-grid"><label class="field"><span>Datum der Blutentnahme</span><input name="date" type="date" value="${today()}" required></label><label class="field"><span>Gesamt-PSA (ng/ml)</span><input name="total" type="number" min="0" max="500" step="any" inputmode="decimal" placeholder="z. B. 2,5" required></label><label class="field"><span>Freies PSA (ng/ml, optional)</span><input name="free" type="number" min="0" max="500" step="any" inputmode="decimal" placeholder="z. B. 0,7"></label><label class="field"><span>Labor / Arzt (optional)</span><input name="place" maxlength="120" placeholder="Praxis oder Labor"></label></div><label class="field"><span>Notiz (optional)</span><input name="notes" maxlength="300" placeholder="Beschwerden oder ärztliche Fragestellung"></label><button class="primary" type="submit">PSA-Werte speichern</button></form><p class="section-note">Ein einzelner PSA-Wert ist kein Krebsnachweis. Wiederholungsmessungen und Abklärung nur in Abstimmung mit der Urologie.</p>`)}
let chosenLabTrend='';
function labTrend(){const available=[...new Set(data.labs.map(x=>String(x.name||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));if(!available.length)return '<p class="section-note">Noch keine Laborwerte für einen Verlauf vorhanden.</p>';
 if(!available.includes(chosenLabTrend))chosenLabTrend=available.includes('HbA1c')?'HbA1c':available[0];const period=chartPeriods.lab||'year', since=chartMinDate(period);
 const labs=data.labs.filter(x=>x.name===chosenLabTrend&&x.date>=since&&x.date<=today()&&Number.isFinite(x.value)).sort((a,b)=>a.date.localeCompare(b.date));
 const header=`<label class="field"><span>Laborparameter auswählen</span><select data-lab-chart="1">${available.map(x=>`<option value="${h(x)}" ${chosenLabTrend===x?'selected':''}>${h(x)}</option>`).join('')}</select></label>${chartPicker('lab')}`;
 if(!labs.length)return header+'<p class="section-note">Keine Werte dieses Laborparameters im gewählten Zeitraum.</p>';
 // visualise on independent scale, never imply a universal medical reference interval
 const W=700,H=255,L=65,R=20,T=22,B=48,values=labs.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),gap=Math.max(0.5,(max-min)*0.2),lo=min-gap,hi=max+gap;
 const xx=i=>L+(labs.length===1?(W-L-R)/2:i*(W-L-R)/(labs.length-1)), yy=v=>T+(hi-v)/(hi-lo)*(H-T-B);
 const pts=labs.slice(-1000).map((o,i)=>`${xx(i)},${yy(o.value)}`).join(' ');
 const lines=labs.length>1?`<polyline points="${pts}" fill="none" stroke="#1c68ab" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`:'';
 const dots=labs.slice(-1000).map((o,i)=>{const t=chartTraffic('lab',o,'value');const desc=fmtDate(o.date)+': '+nf(o.value,2)+' '+(o.unit||'')+' · '+t.label+(o.verified===true?'':' · noch ungeprüft');return `<circle cx="${xx(i)}" cy="${yy(o.value)}" r="5.1" fill="${o.verified===true?VK_TRAFFIC_COLORS[t.level]:'#fff'}" stroke="${o.verified===true?'#fff':VK_TRAFFIC_COLORS[t.level]}" stroke-width="${o.verified===true?'1.4':'2.6'}"><title>${h(desc)}</title></circle>`}).join('');
 return header+`<div class="chartwrap"><svg class="chart" role="img" aria-label="Labortrend ${h(chosenLabTrend)} mit ${labs.length} Messungen" viewBox="0 0 ${W} ${H}"><line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#718898"/>${lines}${dots}<text x="${L}" y="${H-9}" font-size="12">${fmtDate(labs[0].date)}</text><text x="${W-R}" y="${H-9}" text-anchor="end" font-size="12">${fmtDate(labs.at(-1).date)}</text><text x="${L}" y="14" font-size="12">${nf(max,2)} ${h(labs[0].unit||'')}</text></svg></div>${chartTrafficLegend()}<div class="legend" aria-label="Laborwertlinie durchgezogen"><span><i class="solid-line" style="border-color:#1c68ab"></i>Laborwerte (durchgezogen)</span>${labs.some(x=>x.verified!==true)?'<span><i class="open-dot"></i>Offener Punkt: noch ungeprüft</span>':''}</div><p class="section-note">${labs.length} Messungen, darunter ${labs.filter(x=>x.verified!==true).length} ungeprüft. Laborwert-Ampel: grün nur innerhalb eingetragener Laborreferenz, gelb außerhalb, grau ohne Referenz; keine erfundenen Grenzlinien und keine automatische Diagnose.</p>`;}
function pageLabs(){const filteredLabs=LABS.map(([group,items])=>[group,items.filter(([name])=>!labQuery||name.toLowerCase().includes(labQuery.toLowerCase())||group.toLowerCase().includes(labQuery.toLowerCase()))]).filter(x=>x[1].length);const forms=filteredLabs.map(([group,items])=>`<details class="labdetails" ${/Blutzucker|Prostata/.test(group)?'open':''}><summary class="labgroup">${h(group)} (${items.length})</summary><div class="labrow labrow-head"><strong>Laborparameter</strong><strong>Messwert</strong><strong>Ref. min.</strong><strong>Ref. max.</strong></div>${items.map(([name,unit])=>`<div class="labrow"><label class="labtitle" for="lab-${h(name)}">${h(name)}<small> · ${h(unit||'ohne Einheit')}</small></label><input id="lab-${h(name)}" name="v:${h(name)}" type="text" inputmode="decimal" maxlength="32" step="any" value="${h(labDraft["v:"+name]||'')}" placeholder="Wert" aria-label="${h(name)} Messwert"><input name="l:${h(name)}" type="text" inputmode="decimal" maxlength="32" step="any" value="${h(labDraft["l:"+name]||'')}" placeholder="min" aria-label="${h(name)} Referenzminimum"><input name="u:${h(name)}" type="text" inputmode="decimal" maxlength="32" step="any" value="${h(labDraft["u:"+name]||'')}" placeholder="max" aria-label="${h(name)} Referenzmaximum"></div>`).join('')}</details>`).join('');let recent=[...data.labs].sort(sortdate).reverse().slice(0,60);return tag('Laborwerte','Umfangreicher Labor-Katalog mit Diabetes-, PSA-/Prostata-, Eisen-, Nieren-, Leber- und weiteren Werten.')+vkFastingInfo('labs')+warningBox('Labor-Normalbereiche unterscheiden sich je nach Verfahren, Alter und Labor. Bitte die Referenzbereiche genau vom Befund übernehmen; ohne diese erfolgt keine Einstufung.')+panel('Laborverläufe',labTrend())+pagePSAFast()+panel('Blutuntersuchung eingeben',`<form id="lab-form"><div class="form-grid"><label class="field"><span>Datum der Blutentnahme</span><input name="date" type="date" value="${h(labDate||today())}" required></label><label class="field"><span>Labor / Arzt (optional)</span><input name="place" maxlength="120" value="${h(labPlace)}" placeholder="z. B. Hausarzt"></label></div><label class="field"><span>In der Liste suchen (optional)</span><input id="lab-search" type="search" placeholder="z. B. PSA, Eisen, HbA1c" value="${h(labQuery)}"></label>${forms||'<p>Keine Übereinstimmung.</p>'}<div class="actions"><button class="primary" type="submit">Alle ausgefüllten Laborwerte speichern</button></div><p class="section-note">Nur ausgefüllte Messwerte werden gespeichert. Die Referenzgrenzen sind optional; leere Grenzen bleiben unbekannt. PSA-Werte dürfen nicht ohne medizinischen Kontext beurteilt werden.</p></form>`)+panel('Gespeicherte Laborwerte',!recent.length?'<p>Noch kein Laborbefund.</p>':`<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Parameter</th><th>Wert</th><th>Referenz / Hinweis</th><th></th></tr></thead><tbody>${recent.map(x=>{let bad=labIsOutside(x);return `<tr><td>${fmtDate(x.date)}</td><td>${h(x.name)}${x.note?`<br><small>${h(x.note)}</small>`:''}${vk201Files(x).length?`<br><small>${vk201Files(x).length} Anhang/Anhänge</small>`:''}</td><td><b>${labLabel(x)}</b>${x.verified!==true?'<br><span class="chip amber">Noch nicht bestätigt</span>':''}</td><td>${labReference(x)} ${bad?'<span class="chip red">Außerhalb Laborreferenz</span>':''}</td><td>${x.verified!==true?`<button data-action="verify-lab" data-id="${h(x.id)}" class="secondary">Prüfen</button> `:''}<button data-action="vk201-edit" data-vk201-type="lab" data-id="${h(x.id)}" type="button" class="secondary">Bearbeiten / Anhang</button> <button data-action="remove" data-type="lab" data-id="${h(x.id)}" class="dangerbutton">Löschen</button></td></tr>`}).join('')}</tbody></table></div>`)}
function medsTable(){return data.meds.length?`<div class="table-wrap"><table><thead><tr><th>Medikament</th><th>Plan / Zweck</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${data.meds.map(m=>`<tr><td><strong>${h(m.name)}</strong><br>${h(m.dose)}</td><td>${h(m.schedule)}<br><small>${h(m.indication||'')}</small></td><td>${m.verified===false?'<span class="chip amber">Historischer Stand – überprüfen</span>':'<span class="chip green">Vom Nutzer bestätigt</span>'}</td><td><button type="button" class="secondary" data-action="edit-med" data-id="${h(m.id)}">Bearbeiten</button> <button type="button" class="dangerbutton" data-action="remove" data-type="med" data-id="${h(m.id)}">Löschen</button></td></tr>`).join('')}</tbody></table></div>`:'<p>Noch kein Medikament eingetragen. Privaten Notfallpass importieren oder manuell ergänzen.</p>'}
function pageMedsOld(){return tag('Medikamente & Sicherheit','Medikamentenplan, bekannte Nebenwirkungen und ausgewählte wichtige Risiken – kein vollständiger automatischer Interaktionscheck.')+panel('Allergien und Unverträglichkeiten aus dem privaten Notfallpass',`<p>${[...(Array.isArray(data.profile.allergies)?data.profile.allergies:[]),...(Array.isArray(data.profile.intolerances)?data.profile.intolerances:[])].length?h([...data.profile.allergies,...data.profile.intolerances].join('; ')):'Noch keine bestätigten Angaben im privaten Notfallpass hinterlegt.'}</p>`)+warningBox('Der Notfallpass enthält einen möglicherweise älteren Medikamentenstand. Verordnungen, Dosierungen und sämtliche Mittel einschließlich Bedarfs- und rezeptfreier Medikamente mit Arzt oder Apotheke abgleichen. Medikamente nicht eigenmächtig absetzen.', 'danger')+panel('Aktueller Medikamentenplan',medsTable())+panel('Medikament hinzufügen / ändern',`<form id="med-form"><input name="id" type="hidden"><div class="form-grid"><label class="field"><span>Medikament</span><input name="name" required maxlength="150"></label><label class="field"><span>Stärke / Darreichung</span><input name="dose" maxlength="100" placeholder="z. B. 750 mg Retard"></label><label class="field"><span>Einnahme</span><input name="schedule" maxlength="100" placeholder="z. B. 0-0-1"></label><label class="field"><span>Grund</span><input name="indication" maxlength="100"></label><label class="field"><span>Art</span><select name="kind"><option value="prescription">Verordnet</option><option value="otc">Rezeptfrei / Selbstmedikation</option><option value="supplement">Nahrungsergänzung</option><option value="asneeded">Bedarf</option></select></label></div><label class="field"><span>Weitere Hinweise</span><input name="notes" maxlength="500"></label><div class="actions"><button class="primary" type="submit">Medikament speichern</button><button class="quiet" type="reset">Eingabe löschen</button></div></form>`)+panel('Dokumentierte wichtige Wechselwirkungen / zu meidende Mittel',`<p>Die Hinweise gelten für die im Notfallpass genannten Mittel. Neue oder geänderte Arzneimittel werden <strong>nicht</strong> automatisch umfassend geprüft.</p><div class="alertlist">${RISKS.map(r=>`<div class="alertitem ${r.level==='warn'?'warn':''}"><strong>${h(r.title)}</strong><p>${h(r.text)}</p>${r.link?`<a href="${h(r.link)}" target="_blank" rel="noopener noreferrer">Fachinformation öffnen</a>`:''}</div>`).join('')}</div>`)+panel('Arzneimittel-Informationen (Auswahl, unabhängig vom aktuellen Medikamentenplan)',MEDINFO.map(([name,description,url])=>`<details class="item"><summary><strong>${h(name)}</strong></summary><p>${h(description)}</p>${url?`<a href="${h(url)}" target="_blank" rel="noopener noreferrer">Fachinformation</a>`:''}</details>`).join(''))}
function pageEmergency(){const p=data.profile;const rows=[['Name',p.name],['Adresse',[p.street,p.postalCode,p.city].filter(Boolean).join(', ')],['Telefon',p.phone||''],['Krankenkasse',p.insurance||''],['Hausarzt',p.gp||''],['Geburtsdatum',p.birthday?fmtDate(p.birthday):''],['Blutgruppe',p.bloodGroup?`${p.bloodGroup} (Angabe aus Dokument, nicht für Transfusion geeignet)`:''],['Größe / Gewicht',[p.height?`${p.height} cm`:'',p.weight?`${p.weight} kg`:''].filter(Boolean).join(' · ')],['Vorerkrankungen',p.conditions.join('; ')],['Medikamenten-/Wirkstoff-Allergien',p.allergies.join('; ')],['Analgetika-Unverträglichkeiten',p.intolerances.join('; ')],['Lebensmittel',p.foods.join('; ')],['Weitere Allergene / Pollen',p.pollen.join('; ')],['Notfallkontakte',p.contact.map(x=>`${x.name}: ${x.phone}`).join(' | ')],['Operationen / Vorgeschichte',p.history.join('; ')],['Weitere medizinische Hinweise',p.notes],['Quelle / Aktualität',p.source]];return tag('Notfallpass','Gesundheitsdaten und Allergien für medizinische Notfälle – Angaben bitte vor Einsatz überprüfen.')+warningBox('Bei einem echten medizinischen Notfall 112 wählen. Der digitalisierte Pass ist keine ärztlich validierte Akte; insbesondere Medikamentenstand, Allergien und Blutgruppe müssen geprüft werden.','danger')+panel('Persönliche Notfalldaten',`<div class="table-wrap"><table><tbody>${rows.map(([a,b])=>`<tr><th style="width:190px">${h(a)}</th><td>${h(b||'Noch nicht hinterlegt')}</td></tr>`).join('')}</tbody></table></div><div class="actions"><button class="secondary" data-action="print-emergency">Notfallpass drucken / PDF</button></div>`)+panel('Personendaten bearbeiten',`<form id="profile-form"><div class="form-grid"><label class="field"><span>Name</span><input name="name" value="${h(p.name)}"></label><label class="field"><span>Geburtsdatum</span><input name="birthday" type="date" value="${h(p.birthday)}"></label><label class="field"><span>Blutgruppe (unbestätigt)</span><input name="bloodGroup" value="${h(p.bloodGroup)}"></label><label class="field"><span>Größe (cm)</span><input name="height" type="number" step="1" value="${h(p.height)}"></label><label class="field"><span>Gewicht (kg)</span><input name="weight" type="number" step="0.1" value="${h(p.weight)}"></label></div><label class="field"><span>Erkrankungen (jeweils neue Zeile)</span><textarea name="conditions">${h(p.conditions.join('\n'))}</textarea></label><label class="field"><span>Arzneimittel-Allergien (jeweils neue Zeile)</span><textarea name="allergies">${h(p.allergies.join('\n'))}</textarea></label><label class="field"><span>Unverträglichkeiten (jeweils neue Zeile)</span><textarea name="intolerances">${h(p.intolerances.join('\n'))}</textarea></label><label class="field"><span>Lebensmittel (jeweils neue Zeile)</span><textarea name="foods">${h(p.foods.join('\n'))}</textarea></label><label class="field"><span>Weitere Allergene (jeweils neue Zeile)</span><textarea name="pollen">${h(p.pollen.join('\n'))}</textarea></label><label class="field"><span>Operationen / Vorgeschichte (jeweils neue Zeile)</span><textarea name="history">${h(p.history.join('\n'))}</textarea></label><label class="field"><span>Notfallkontakte (Format: Name | Telefon, je Zeile)</span><textarea name="contacts">${h(p.contact.map(x=>`${x.name} | ${x.phone}`).join('\n'))}</textarea></label><label class="field"><span>Weitere Hinweise</span><textarea name="notes">${h(p.notes)}</textarea></label><button class="primary">Notfallpass speichern</button></form>`)}
function between(e,a,b){return e.date>=a&&e.date<=b}
function groupStats(list,field){const nums=list.map(x=>x[field]).filter(Number.isFinite);return [nums.length,avg(nums),nums.length?Math.min(...nums):NaN,nums.length?Math.max(...nums):NaN]}
function statsRange(){if(reportPeriod==='year'){const y=reportYear;return [`${y}-01-01`,`${y}-12-31`,`${y} (Jahr)`]}const m=reportMonth;return [`${m}-01`,`${m}-31`,`${m.slice(5)}/${m.slice(0,4)} (Monat)`]}

/* 2.0.5: pro Diagramm nur Minimum, Durchschnitt und Maximum, keine Messwert-Doppeltabellen. */
function statsHtml(){
 const [from,to,label]=statsRange();
 const glucose=filtered('glucose').filter(r=>between(r,from,to)&&r.verified===true);
 const bp=filtered('bp').filter(r=>between(r,from,to)&&r.verified===true);
 const weight=(data.weights||[]).filter(r=>between(r,from,to));
 const oxygen=vk204OxygenRows().filter(r=>between(r,from,to));
 const asthma=(data.asthmaLogs||[]).filter(r=>between(r,from,to));
 const labs=(data.labs||[]).filter(r=>between(r,from,to)&&r.verified===true);
 const chartPeriod=reportPeriod==='year'?'year':'month';
 let result=`<p>Berichtszeitraum: <strong>${h(label)}</strong>. Bestätigte Messungen werden dargestellt; fehlende Einträge bedeuten nicht normale Werte. Bei vielen Messpunkten werden Wertetiketten zur besseren Lesbarkeit ausgedünnt. Einzeldaten bleiben im jeweiligen Tagebuch erhalten.</p>`;
 result+='<h3>Körpergewicht</h3>'+vk205Summary('Gewicht',weight,'kg','kg',1)+weightChart(chartPeriod,weight,700,'all');
 result+='<h3>Blutzucker</h3>'+vk205Summary('Glukose',glucose,'mgdl','mg/dl',1)+lineChart('glucose',chartPeriod,700,glucose);
 result+='<h3>Blutdruck</h3>'+vk205Summary('Systolisch',bp,'sys','mmHg',0)+vk205Summary('Diastolisch',bp,'dia','mmHg',0)+lineChart('bp',chartPeriod,700,bp);
 result+='<h3>Puls</h3>'+vk205Summary('Puls',bp,'pulse','/min',0)+lineChart('pulse',chartPeriod,700,bp);
 result+='<h3>Blutsauerstoff und Perfusionsindex</h3>'+vk205Summary('SpO₂',oxygen,'spo2','%',1)+vk204OxygenChart('spo2',chartPeriod,oxygen)+vk205Summary('PI',oxygen,'pi','%',2)+vk204OxygenChart('pi',chartPeriod,oxygen);
 result+='<h3>Asthma und Lungenfunktion</h3>'+vk205Summary('Peak-Flow',asthma,'peakFlow','l/min',0)+vkMiniTrend(asthma,'peakFlow','Peak-Flow','l/min',chartPeriod)+vk205Summary('FEV1',asthma,'fev1Pct','%',1)+vkMiniTrend(asthma,'fev1Pct','FEV1','%',chartPeriod)+vk205Summary('Atemnot',asthma,'breathlessness','/10',1)+vkMiniTrend(asthma,'breathlessness','Atemnot','/10',chartPeriod);
 result+='<h3>Krankenhausaufenthalte</h3>'+vk205HospitalReport(from,to,true);
 result+='<h3>Laborbefunde</h3>'+(labs.length?vkReportTable(['Datum','Laborwert','Ergebnis / Einheit','Referenz'],labs.map(r=>[fmtDate(r.date),r.name,nf(r.value,3)+' '+(r.unit||''),labReference(r)])):'<p>Keine bestätigten Laborbefunde im Zeitraum.</p>');
 result+='<h3>Medikamentenplan (dokumentierter Stand)</h3>'+(data.meds.length?'<p>'+data.meds.map(r=>h(r.name+' '+(r.dose||'')+' '+(r.schedule||''))).join('; ')+'</p>':'<p>Keine Medikamente dokumentiert.</p>');
 return result+'<p class="section-note">Die Berechnungen beruhen auf gespeicherten Einzelmessungen (nicht auf Tages- oder Wochenmitteln). Diagramme können gemittelte Messpunkte darstellen. Keine medizinische Diagnose. Exportierte PDF-Dateien sind nicht automatisch verschlüsselt.</p>';
}


function pageStatsOld(){return tag('Monats- und Jahresstatistik','Auswertung mit Zahlen, individuellen Warnungen und Kurven; als PDF speicherbar und ausdruckbar.')+`<div class="subnav"><button data-report="month" class="${reportPeriod==='month'?'active':''}">Monat</button><button data-report="year" class="${reportPeriod==='year'?'active':''}">Jahr</button></div><div class="form-grid"><label class="field"><span>Monat auswählen</span><input id="report-month" type="month" value="${reportMonth}"></label><label class="field"><span>Jahr auswählen</span><input id="report-year" type="number" min="1990" max="2100" value="${reportYear}"></label></div>`+panel('Gesundheitsbericht',statsHtml()+`<div class="actions"><button data-action="print-report" class="primary">PDF speichern / Drucken</button></div><p class="section-note">Die App erstellt jetzt selbst eine PDF-Datei. Auf dem iPhone „Teilen / In Dateien sichern“ nutzen; Drucken ist auch über die PDF-Vorschau möglich.</p>`)}
function pageBenefits(){return tag('Krankenkasse & Leistungen','Ansprüche und Anlaufstellen in Deutschland. Keine pauschale Zusage; entscheidend sind Versicherung, Befund und Verordnung.')+panel('Mögliche Ansprüche / Anträge',`<div class="listgrid">${BENEFITS.map(([name,desc,url,tag])=>`<article class="item"><strong>${h(name)}</strong><span class="chip">${h(tag)}</span><p>${h(desc)}</p><a class="source" href="${h(url)}" target="_blank" rel="noopener noreferrer">Offizielle Informationen / Voraussetzungen</a></article>`).join('')}</div>`)+panel('Anfrage an die Krankenkasse vorbereiten',`<p>Hier wird lediglich ein Musterbrief vorbereitet, kein rechtsverbindlicher Originalantrag und keine automatische Übermittlung.</p><form id="benefits-form"><div class="form-grid"><label class="field"><span>Krankenkasse</span><input name="insurer" placeholder="Name der Krankenkasse"></label><label class="field"><span>Gewünschte Leistung</span><select name="benefit">${BENEFITS.map(x=>`<option>${h(x[0])}</option>`).join('')}</select></label></div><label class="field"><span>Begründung / ärztliche Empfehlung (optional)</span><textarea name="reason"></textarea></label><div class="actions"><button class="primary">Anschreiben erstellen</button></div></form><div id="letter-result"></div>`)+panel('Informationsquellen',SOURCES.map(([name,url])=>`<p><a href="${h(url)}" rel="noopener noreferrer" target="_blank">${h(name)}</a></p>`).join(''))}
function pageSettings(){const s=data.settings;return tag('Backup, Datenschutz & Updates','Version stets sichtbar oben. Alles wird lokal im Browser verschlüsselt gespeichert.')+backupPanels()+panel('Private Patienten- und Messwerte importieren',`<p>Die <strong>separat bereitgestellte private Importdatei</strong> enthält vertrauliche Angaben aus Dokumenten. Auch Blutdruckwerte mit Mahlzeitenbezug können importiert werden. Sie muss ausdrücklich zum richtigen Patienten gehören und darf <strong>niemals</strong> auf eine öffentliche Website oder zu GitHub hochgeladen werden.</p><form id="import-form"><label class="field"><span>Privater Import (JSON)</span><input type="file" accept=".json,application/json" name="file" required></label><button class="primary">Datensatz importieren</button></form>`)+panel('Persönliche Warnschwellen',`<p>Vorbelegt mit allgemeinen Orientierungswerten für Selbstmessungen. Zielbereiche insbesondere bei Diabetes können hiervon abweichen; mit behandelnder Praxis abstimmen.</p><form id="threshold-form"><div class="form-grid"><label class="field"><span>Nüchtern unter (mg/dl)</span><input name="glucoseFastingLow" type="number" min="50" max="150" value="${s.glucoseFastingLow}"></label><label class="field"><span>Nüchtern über (mg/dl)</span><input name="glucoseFastingHigh" type="number" min="80" max="350" value="${s.glucoseFastingHigh}"></label><label class="field"><span>Nach Essen über (mg/dl)</span><input name="glucoseAfterHigh" type="number" min="90" max="350" value="${s.glucoseAfterHigh}"></label><label class="field"><span>Sonstige über (mg/dl)</span><input name="glucoseOtherHigh" type="number" min="90" max="350" value="${s.glucoseOtherHigh}"></label><label class="field"><span>Blutdruck systolisch über</span><input name="bpHighSys" type="number" min="100" max="180" value="${s.bpHighSys}"></label><label class="field"><span>Blutdruck diastolisch über</span><input name="bpHighDia" type="number" min="65" max="120" value="${s.bpHighDia}"></label><label class="field"><span>Niedrig systolisch unter</span><input name="bpLowSys" type="number" min="60" max="120" value="${s.bpLowSys}"></label><label class="field"><span>Niedrig diastolisch unter</span><input name="bpLowDia" type="number" min="30" max="75" value="${s.bpLowDia}"></label><label class="field"><span>Sehr hoch systolisch ab</span><input name="bpCriticalSys" type="number" min="150" max="180" value="${s.bpCriticalSys}"></label><label class="field"><span>Sehr hoch diastolisch ab</span><input name="bpCriticalDia" type="number" min="95" max="110" value="${s.bpCriticalDia}"></label><label class="field"><span>Blutzucker sehr hoch ab (mg/dl)</span><input name="glucoseCriticalHigh" type="number" min="200" max="400" value="${s.glucoseCriticalHigh}"></label><label class="field"><span>Puls niedrig unter (/min)</span><input name="pulseLow" type="number" min="40" max="70" value="${s.pulseLow}"></label><label class="field"><span>Puls hoch über (/min)</span><input name="pulseHigh" type="number" min="85" max="120" value="${s.pulseHigh}"></label><label class="field"><span>Puls sehr niedrig unter (/min)</span><input name="pulseCriticalLow" type="number" min="30" max="55" value="${s.pulseCriticalLow}"></label><label class="field"><span>Puls sehr hoch ab (/min)</span><input name="pulseCriticalHigh" type="number" min="110" max="180" value="${s.pulseCriticalHigh}"></label></div><p class="section-note">Allgemeine Alarmhinweise bei akuten Beschwerden gelten unabhängig von geänderten persönlichen Schwellen. Ärztliche Zielbereiche eintragen; keine eigenmächtige Medikamentenanpassung.</p><button class="primary">Grenzwerte speichern</button></form>`)+panel('Bedienung & Lesbarkeit',`<p>Große Schaltflächen und Schrift für eine einfachere Bedienung. Die App lässt sich weiterhin ausschließlich scrollen.</p><button type="button" class="primary" data-action="toggle-senior">${s.seniorMode?'Einfach-Modus ausschalten':'Einfach-Modus einschalten'}</button>`)+panel('Backup-Datei überprüfen',`<p>Eine bereits gespeicherte verschlüsselte Sicherungsdatei wird probeweise entschlüsselt und auf das Datenformat geprüft. Es werden <strong>keine</strong> Daten wiederhergestellt oder überschrieben.</p><form id="verify-backup-form"><label class="field"><span>Verschlüsselte Sicherung</span><input name="file" type="file" accept=".json,application/json" required></label><label class="field"><span>Backup-Passwort</span><input name="password" type="password" required></label><button class="primary">Backup probeweise öffnen</button></form><p id="backup-verify-result" class="section-note" role="status"></p>`)+panel('Update suchen und installieren',`<p><strong>Installierte Version: ${VERSION}</strong></p><p>Mit „Update suchen“ wird die Versionsdatei der veröffentlichten Website geprüft. Installation neuer Programmdateien erfolgt nach Veröffentlichung über den Browser/Service Worker. Ohne neue veröffentlichte Dateien kann die App kein Update erzeugen.</p><div class="actions"><button class="primary" data-action="check-update">Jetzt nach Update suchen</button><button class="secondary" data-action="install-update">Vorhandenes Update installieren</button></div><p id="update-status" class="section-note">Noch nicht geprüft.</p>`)+panel('Analyse und Dokumentation 1.5.0',`<p>Gesundheitsanalyse, Symptomtagebuch, Einnahmeprotokoll, Kontrollen und GdB-Nachweise liegen im selben verschlüsselten Speicher und werden im Backup berücksichtigt.</p><button class="secondary" data-view="analysis">Analyse öffnen</button>`)+panel('Sicherheit & Daten auf diesem Gerät',`<p>Keine Cloud-Synchronisation, keine Analytics, kein Tracking. Die Daten liegen verschlüsselt in IndexedDB. Beim Löschen von Browserdaten können sie verloren gehen. Ein öffentliches Hosting der App darf niemals private Import- oder Backupdateien enthalten.</p><div class="actions"><button class="dangerbutton" data-action="wipe">Alle gespeicherten Gesundheitsdaten endgültig löschen</button></div>`)}
function discardTemporaryPDF(){document.getElementById('printroot')?.remove();document.getElementById('pdf-dialog')?.remove();if(lastPDFUrl)URL.revokeObjectURL(lastPDFUrl);lastPDFUrl=null;lastPDFBlob=null;lastPDFName='';}
function makePrint(title,html){
 if(!window.VitalPDF?.create)throw Error('PDF-Modul noch nicht geladen. Bitte App online neu öffnen und Update installieren.');
 let p=document.getElementById('printroot');if(!p){p=document.createElement('div');p.id='printroot';document.body.append(p)}
 p.innerHTML=`<article class="print-page"><h1>VitalKompass · ${h(title)}</h1><p>Erstellt: ${fmtDate(today())} · Dokumentation, keine medizinische Diagnose</p>${html}</article>`;
 // All processing stays on the local device; never transfer patient information to a PDF service.
 let blob;
 try{blob=window.VitalPDF.create(p.innerHTML,'VitalKompass – '+title)}finally{p.remove()}
 if(!(blob instanceof Blob)||blob.size<300)throw Error('PDF konnte nicht erstellt werden.');
 if(lastPDFUrl)URL.revokeObjectURL(lastPDFUrl);
 lastPDFBlob=blob;lastPDFName='VitalKompass-'+String(title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-')+'-'+today()+'.pdf';
 lastPDFUrl=URL.createObjectURL(blob);
 document.getElementById('pdf-dialog')?.remove();
 const aside=document.createElement('section');aside.id='pdf-dialog';aside.className='pdf-dialog';aside.setAttribute('role','dialog');aside.setAttribute('aria-modal','true');aside.setAttribute('aria-label','PDF speichern und drucken');
 aside.innerHTML=`<div class="pdf-card"><h2>PDF wurde erstellt</h2><p>Der Bericht wurde nur auf diesem Gerät erzeugt. <b>Die PDF-Datei ist nicht verschlüsselt.</b> Für das iPhone am besten <b>Teilen / In Dateien sichern</b> wählen. Alternativ PDF öffnen und im PDF-Betrachter drucken.</p><div class="pdf-buttons"><button type="button" class="primary" data-pdf="share">Teilen / In Dateien sichern</button><a class="secondary" href="${lastPDFUrl}" target="_blank" rel="noopener">PDF öffnen</a><a class="secondary" href="${lastPDFUrl}" download="${lastPDFName}">PDF herunterladen</a><button type="button" class="secondary" data-pdf="print">Drucken (Browser)</button><button type="button" class="quiet" data-pdf="close">Schließen</button></div><small>Bei iPhone-Webapps kann der Browser-Druckdialog blockiert sein. Öffnen oder Teilen der PDF-Datei funktioniert unabhängig davon.</small></div>`;
 document.body.append(aside);aside.querySelector('button').focus();
}
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-pdf]');if(!b)return;
 if(b.dataset.pdf==='close'){discardTemporaryPDF();return}
 if(b.dataset.pdf==='print'){const w=lastPDFUrl&&window.open(lastPDFUrl,'_blank');if(w)w.opener=null;else alert('Bitte „PDF öffnen“ wählen und danach über das PDF-Menü drucken.');return}
 if(b.dataset.pdf==='share'){
  if(!lastPDFBlob)return;
  const file=new File([lastPDFBlob],lastPDFName,{type:'application/pdf'});
  if(navigator.share && (!navigator.canShare||navigator.canShare({files:[file]}))){try{await navigator.share({files:[file],title:'VitalKompass Gesundheitsbericht'});return}catch(err){if(err?.name==='AbortError')return}}
  alert('Die Teilen-Funktion ist hier nicht verfügbar. Bitte stattdessen „PDF öffnen“ wählen und über das Browser-Menü teilen / sichern.');
 }
});
function sendDownload(contents,name,mime='application/json'){const url=URL.createObjectURL(new Blob([contents],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function letter(form){let name=data.profile.name||'[Vor- und Nachname]',insurer=form.get('insurer')||'[Krankenkasse]',benefit=form.get('benefit')||'',reason=form.get('reason')||'';return `${name}\nAn ${insurer}\n\n${fmtDate(today())}\n\nBetreff: Anfrage / Prüfung einer Leistung – ${benefit}\n\nSehr geehrte Damen und Herren,\n\nich bitte um Prüfung, ob und unter welchen Voraussetzungen ich folgende Leistung erhalten kann: ${benefit}.\n${reason?'\nBegründung: '+reason+'\n':''}\nBitte teilen Sie mir die erforderlichen Antragsformulare, Nachweise und gegebenenfalls die Rechtsgrundlage sowie einen schriftlichen Bescheid bei Ablehnung mit.\n\nMit freundlichen Grüßen\n${name}`}
async function importPrivate(incoming){
const full=incoming?.format==='vitalkompass-private-seed-v1';
const labsOnly=incoming?.format==='vitalkompass-lab-import-v1';
const bpOnly=incoming?.format==='vitalkompass-bp-import-v1';
// A lab-only import must name a patient; reject anonymous/mismatching data.
const identity=full?incoming?.profile:(typeof incoming?.patient==='string'?{name:incoming.patient}:incoming?.patient);
const identityName=String(identity?.name||'').trim().replace(/\s+/g,' ');
const existingName=(data.profile.name||'').trim().replace(/\s+/g,' ');
if(!identityName)throw Error('Import ohne eindeutig benannten Patienten abgelehnt. Bitte eine patientengebundene Importdatei verwenden.');
if(existingName&&identityName.toLocaleLowerCase('de-DE')!==existingName.toLocaleLowerCase('de-DE'))throw Error(`Patient stimmt nicht überein. App: ${existingName}; Datei: ${identityName}. Es wurden keine Daten übernommen.`);
if(existingName&&identity?.birthday&&data.profile.birthday&&identity.birthday!==data.profile.birthday)throw Error('Geburtsdatum stimmt nicht überein. Es wurden keine Daten übernommen.');
if((labsOnly||bpOnly)&&!existingName)throw Error('Zuerst den privaten Notfallpass dieses Patienten importieren oder den Namen im Notfallpass anlegen.');
if((!full&&!labsOnly&&!bpOnly)||(labsOnly&&!Array.isArray(incoming.labs))||(bpOnly&&!Array.isArray(incoming.measurements))||(full&&(!incoming.profile||!Array.isArray(incoming.measurements)||!Array.isArray(incoming.meds))))throw Error('Keine kompatible Importdatei.');
if(!confirm(`Import für ${identityName}${identity?.birthday?' ('+fmtDate(identity.birthday)+')':''}?\n\nDie Angaben wurden aus Dokumenten übernommen und müssen kontrolliert werden. Es werden keine Daten einer anderen Person hinzugefügt.`))return;
const beforeImport=data;data=clone(data);let importCommitted=false;
 try{
if(full){
 // Erneuter Import darf nachträglich bearbeitete Profildaten nicht überschreiben.
 for(const [field,value] of Object.entries(incoming.profile)){
   const expected=defaults().profile[field];if(expected===undefined)continue;
   if(Array.isArray(expected)&&!Array.isArray(value))continue;
   if(typeof expected==='string'&&typeof value!=='string')continue;
   if(Array.isArray(value)&&(field==='contact'?!value.every(c=>c&&typeof c.name==='string'&&typeof c.phone==='string'):!value.every(v=>typeof v==='string')))continue;
   const current=data.profile[field];if((current===undefined||current===null||current===''||(Array.isArray(current)&&current.length===0))&&value!==undefined&&value!==null&&value!==''){
    data.profile[field]=clone(value);
   }
  }
  for(const m of incoming.meds){if(!m||typeof m.name!=='string'||!m.name.trim()||m.name.length>150)continue;if(!data.meds.some(y=>String(y.name||'').toLowerCase()===m.name.toLowerCase()))data.meds.push({id:id(),name:m.name.trim(),dose:String(m.dose||'').slice(0,100),schedule:String(m.schedule||'').slice(0,100),indication:String(m.indication||'').slice(0,100),notes:String(m.notes||'').slice(0,500),verified:false})}
}
let importedBp=0,importedGlucose=0;
if(full||bpOnly){
  const measureKey=x=>`${x.type}|${x.date}|${x.time}|${x.type==='bp'?`${x.sys}|${x.dia}|${x.pulse??''}`:x.mgdl}`;
  const have=new Set(data.measurements.map(measureKey));
  for(const x of incoming.measurements){
    if(!x||!['glucose','bp'].includes(x.type)||!dateValid(x.date)||!timeValid(x.time))continue;
    if(x.type==='glucose'&&(!Number.isFinite(x.mgdl)||x.mgdl<10||x.mgdl>700))continue;
    if(x.type==='bp'&&(!Number.isFinite(x.sys)||!Number.isFinite(x.dia)||x.sys<=x.dia||x.sys>320||x.sys<40||x.dia<20||x.dia>220||!(x.pulse===null||x.pulse===undefined||(Number.isFinite(x.pulse)&&x.pulse>=20&&x.pulse<=240))))continue;
    const k=measureKey(x);if(have.has(k))continue;
    const mealTiming=x.type==='bp'&&Object.prototype.hasOwnProperty.call(bpMealLabels,x.mealTiming)?x.mealTiming:'unknown';
    data.measurements.push(x.type==='bp'?{id:id(),type:'bp',date:x.date,time:x.time,sys:x.sys,dia:x.dia,pulse:Number.isFinite(x.pulse)?x.pulse:null,mealTiming,note:String(x.note||'').slice(0,400),verified:false}:{id:id(),type:'glucose',date:x.date,time:x.time,mgdl:x.mgdl,period:Object.hasOwn(gLabels,x.period)?x.period:'other',note:String(x.note||'').slice(0,400),verified:false});have.add(k);
    if(x.type==='bp')importedBp++;else importedGlucose++;
  }
}
let count=0;const existing=new Set(data.labs.map(x=>`${x.date}|${x.name}|${x.value}|${x.comparator||''}`));
for(const x of incoming.labs||[]){if(!x||x.type!=='lab'||!dateValid(x.date)||typeof x.name!=='string'||x.name.length>130||!Number.isFinite(x.value)||!LABCATALOG.some(y=>y.name===x.name)||!['','<','>'].includes(x.comparator||''))continue;
 const k=`${x.date}|${x.name}|${x.value}|${x.comparator||''}`;
 if(!existing.has(k)){data.labs.push({id:id(),type:'lab',date:x.date,time:'',name:x.name,unit:String(x.unit||'').slice(0,40),value:x.value,comparator:x.comparator||'',place:String(x.place||'').slice(0,150),note:String(x.note||'').slice(0,500),verified:false,low:Number.isFinite(x.low)?x.low:null,high:Number.isFinite(x.high)?x.high:null});existing.add(k);count++}
}
await save();importCommitted=true;view=importedBp>0?'bp':count>0?'labs':'glucose';common();toast(`Import: ${importedBp} Blutdruckwerte, ${importedGlucose} Blutzuckerwerte, ${count} Laborwerte neu. Bitte anhand der Originalunterlagen prüfen.`);
}catch(error){if(!importCommitted)data=beforeImport;throw error}
}
/* VK194 SAVE BEGIN: Kein HTML-Submit und keine Komplettverschlüsselung beim Wiegen. */
async function saveWeightDedicated(form){
 if(weightSaveInProgress)return;
 if(!form||form.getAttribute('id')!=='weight-form')throw Error('Gewichtsformular nicht gefunden.');
 if(weightJournalReadOnly)throw Error('Gewichtstagebuch ist nicht lesbar. Weitere Eingaben wurden zum Schutz vorhandener Daten gesperrt.');
 const f=new FormData(form),kg=nval(f.get('kg')),date=String(f.get('date')||''),time=String(f.get('time')||''),meal=String(f.get('mealTiming')||''),entryId=String(f.get('id')||'');
 if(!Number.isFinite(kg)||kg<20||kg>400)throw Error('Bitte ein Gewicht zwischen 20 und 400 kg eingeben (z. B. 130,5).');
 if(!dateValid(date)||date>today()||!timeValid(time))throw Error('Datum und Uhrzeit prüfen.');
 if(meal==='unknown'||!Object.prototype.hasOwnProperty.call(bpMealLabels,meal))throw Error('Bitte einen Messzeitpunkt wählen.');
 const entry={id:entryId||id(),date,time,kg:Math.round(kg*10)/10,mealTiming:meal,note:String(f.get('note')||'').slice(0,300)};
 const at=data.weights.findIndex(x=>x.id===entryId);
 if(entryId&&at<0)throw Error('Der ursprüngliche Gewichtseintrag wurde nicht gefunden.');
 if(at>=0)entry.attachments=vk201Files(data.weights[at]);
 const next=data.weights.map(x=>({...x}));if(at>=0)next[at]=entry;else next.push(entry);
 const feedback=$('#weight-save-feedback'),button=form.querySelector('[data-action="save-weight"]');
 weightSaveInProgress=true;
 if(feedback){feedback.textContent='Gewicht wird sicher gespeichert …';feedback.classList.remove('vk-save-error')}
 if(button){button.disabled=true;button.textContent='Speichert …'}
 try{
  await writeWeightDraft(entry);
  await storeWeightJournal(next);
  data.weights=next;syncProfileWeight();
  try{await clearWeightDraft()}catch{}
  renderMain();toast('Gewicht verschlüsselt gespeichert: '+nf(entry.kg,1)+' kg.');
 }finally{
  weightSaveInProgress=false;
  if(button?.isConnected){button.disabled=false;button.textContent='Gewicht speichern'}
 }
}
/* VK194 SAVE END */

async function handleSubmit(ev){const form=ev.target;if(!form.getAttribute('id')||!form.getAttribute('id').endsWith('-form'))return;ev.preventDefault();const f=new FormData(form);try{
if(form.getAttribute('id')==='auth-form'){if(!canUseCrypto)throw Error('Keine sichere Verschlüsselung verfügbar.');const pass=f.get('password');const old=await getRec();if(!old){if(pass!==f.get('confirm'))throw Error('Passwörter stimmen nicht überein.');if(pass.length<10)throw Error('Passwort muss mindestens 10 Zeichen haben.');const salt=crypto.getRandomValues(new Uint8Array(16));key=await passKey(pass,salt);data=defaults();await putRec({salt:b64(salt),...await pack(data,key),modified:new Date().toISOString()})}else{key=await passKey(pass,unb64(old.salt));try{data=await unpack(old,key)}catch{key=null;throw Error('Passwort falsch oder gespeicherte Daten beschädigt.')}}migrateData();weightJournalReadOnly=false;try{await loadWeightJournal()}catch(err){weightJournalReadOnly=true;toast('ACHTUNG: Gewichtstagebuch unlesbar. Zum Datenschutz ist Speichern von Gewichten vorläufig gesperrt; keine Einträge wurden gelöscht.')}let weightRecovered=false;if(!weightJournalReadOnly){try{weightRecovered=await recoverWeightDraft()}catch(err){toast('Gewichtszwischensicherung konnte nicht wiederhergestellt werden. Bitte Speicherplatz prüfen.')}}common();if(weightRecovered)toast('Unterbrochene Gewichtsmessung wiederhergestellt.');return}
if(!data)return;
if(form.getAttribute('id')==='oxygen-form'){await vk204OxygenSubmit(f);return}
if(form.getAttribute('id')==='hospital-form'){await vk205HospitalSave(form);return}
if(form.getAttribute('id')==='weight-goal-form'){
 const goal=String(f.get('goalWeightKg')||'').trim(),start=String(f.get('goalStartWeightKg')||'').trim(),date=String(f.get('goalDate')||'');
 for(const [name,raw] of [['Zielgewicht',goal],['Startgewicht',start]])if(raw!==''&&(!Number.isFinite(nval(raw))||nval(raw)<20||nval(raw)>400))throw Error(name+' muss zwischen 20 und 400 kg liegen.');
 if(date&&!dateValid(date))throw Error('Ungültiges Wunschdatum.');
 data.settings.goalWeightKg=goal;data.settings.goalStartWeightKg=start;data.settings.goalDate=date;await save();renderMain();toast('Gewichtsziel gespeichert.');return;
}
if(form.getAttribute('id')==='asthma-form'){
 const date=String(f.get('date')||''),time=String(f.get('time')||''),entryId=String(f.get('id')||''),breathlessness=nval(f.get('breathlessness')),rescueUses=nval(f.get('rescueUses'));
 const pefRaw=String(f.get('peakFlow')||'').trim(),fevRaw=String(f.get('fev1Pct')||'').trim();
 const peakFlow=pefRaw===''?null:nval(pefRaw),fev1Pct=fevRaw===''?null:nval(fevRaw);
 if(!dateValid(date)||date>today()||!timeValid(time))throw Error('Datum oder Uhrzeit prüfen.');
 if(!Number.isInteger(breathlessness)||breathlessness<0||breathlessness>10||!Number.isInteger(rescueUses)||rescueUses<0||rescueUses>50)throw Error('Atemnot 0–10 und Bedarfsanwendungen 0–50 angeben.');
 if((peakFlow!==null&&(!Number.isInteger(peakFlow)||peakFlow<50||peakFlow>1000))||(fev1Pct!==null&&(!Number.isFinite(fev1Pct)||fev1Pct<5||fev1Pct>140)))throw Error('Peak-Flow bzw. FEV1 prüfen.');
 const triggers=f.getAll('trigger').map(String);if(!triggers.every(x=>Object.prototype.hasOwnProperty.call(ASTHMA_TRIGGERS,x)))throw Error('Ungültige Auslöserauswahl.');
 const entry={id:entryId||id(),date,time,breathlessness,rescueUses,peakFlow,fev1Pct,triggers:[...new Set(triggers)],note:String(f.get('note')||'').slice(0,1000)};
 const at=data.asthmaLogs.findIndex(x=>x.id===entryId);if(entryId&&at<0)throw Error('Asthma-Eintrag nicht gefunden.');
 if(at>=0)entry.attachments=vk201Files(data.asthmaLogs[at]);
 const previousAsthma=data.asthmaLogs;data.asthmaLogs=previousAsthma.map(x=>({...x}));if(at>=0)data.asthmaLogs[at]=entry;else data.asthmaLogs.push(entry);
 try{await save()}catch(error){data.asthmaLogs=previousAsthma;throw error}renderMain();toast('Asthma-Eintrag gespeichert.');return;
}
if(form.getAttribute('id')==='med-stock-form'){
 const medId=String(f.get('medId')||''),count=nval(f.get('count')),min=nval(f.get('min')),unit=String(f.get('unit')||'');
 if(!data.meds.some(m=>m.id===medId))throw Error('Medikament nicht gefunden.');
 if(!Number.isInteger(count)||count<0||count>100000||!Number.isInteger(min)||min<0||min>100000||!['Tabletten','Hübe','Ampullen','Stück'].includes(unit))throw Error('Vorrat und Grenzwert prüfen.');
 data.medStocks[medId]={count,min,unit,checkedAt:today()};await save();renderMain();toast('Medikamentenvorrat gespeichert.');return;
}
if(form.getAttribute('id')==='measurement-reminder-form'){
 const date=String(f.get('date')||''),kind=String(f.get('kind')||''),valid=['Gewichtskontrolle','Blutdruckkontrolle','Blutzuckerkontrolle','Asthmakontrolle'];
 if(!dateValid(date)||!valid.includes(kind))throw Error('Datum und Art der Messung prüfen.');
 data.reminders.push({id:id(),date,kind,notes:String(f.get('notes')||'').slice(0,300),done:false});await save();renderMain();toast('Erinnerung eingetragen. iPhone-Kalenderexport ist im Erinnerungsbereich verfügbar.');return;
}
/* VK200 FORM SAVE BEGIN */
if(form.getAttribute('id')==='uro-log-form'){
 const entryId=String(f.get('id')||''), date=String(f.get('date')||''),time=String(f.get('time')||''),kind=String(f.get('kind')||''),severity=String(f.get('severity')||'');
 const rawDay=String(f.get('day')||'').trim(),rawNight=String(f.get('night')||'').trim();
 const day=rawDay===''?null:nval(rawDay),night=rawNight===''?null:nval(rawNight);
 const entry={id:entryId||id(),type:'entry',date,time,kind,severity,day,night,finding:String(f.get('finding')||'').slice(0,1200),note:String(f.get('note')||'').slice(0,2000)};
 if(date>today()||!vkUroValidate(entry))throw Error('Bitte die urologischen Angaben, das Datum und die Zählwerte überprüfen.');
 const before=data.urologyLogs,at=before.findIndex(x=>x.id===entryId);
 if(entryId&&at<0)throw Error('Zu bearbeitender Eintrag nicht gefunden.');
 if(at>=0)entry.attachments=vk201Files(before[at]);
 data.urologyLogs=before.map(x=>({...x}));if(at<0)data.urologyLogs.push(entry);else data.urologyLogs[at]=entry;
 try{await save()}catch(e){data.urologyLogs=before;throw e}
 renderMain();toast('Urologischer Eintrag lokal verschlüsselt gespeichert.');return;
}
if(form.getAttribute('id')==='uro-ipss-form'){
 const entryId=String(f.get('id')||''),date=String(f.get('date')||''),time=String(f.get('time')||'');
 const vals=Array.from({length:7},(_,i)=>String(f.get('i'+i)||'')).map(s=>s===''?NaN:Number(s));
 const qolText=String(f.get('qol')||''),qol=qolText===''?NaN:Number(qolText);
 const entry={id:entryId||id(),type:'ipss',date,time,ipss:vals,score:vals.reduce((a,b)=>a+b,0),qol};
 if(date>today()||!vkUroValidate(entry))throw Error('Bitte alle sieben IPSS-Fragen und die Lebensqualität beantworten.');
 const before=data.urologyLogs,at=before.findIndex(x=>x.id===entryId);
 if(entryId&&at<0)throw Error('Die bisherige IPSS-Auswertung wurde nicht gefunden.');
 if(at>=0)entry.attachments=vk201Files(before[at]);
 data.urologyLogs=before.map(x=>({...x}));if(at<0)data.urologyLogs.push(entry);else data.urologyLogs[at]=entry;
 try{await save()}catch(e){data.urologyLogs=before;throw e}
 renderMain();toast('IPSS '+entry.score+'/35 ('+vkUroIPSSLabel(entry.score)+') gespeichert. Keine Diagnose.');return;
}
/* VK200 FORM SAVE END */

if(form.getAttribute('id')==='doctor-report-form'){
 const [from,to]=vkReportDateRange(form),parts=f.getAll('part').map(String);const allowed=VK_REPORT_TOPICS.map(x=>x[0]);
 if(!dateValid(from)||!dateValid(to)||from>to)throw Error('Berichtszeitraum prüfen.');
 if(!parts.length||!parts.every(x=>allowed.includes(x)))throw Error('Mindestens einen gültigen Berichtsteil auswählen.');
 reportChoice=Object.fromEntries(allowed.map(x=>[x,parts.includes(x)]));
 makePrint('Individueller Arztbericht',vkAllTopicHtml(from,to,reportChoice));return;
}
if(form.getAttribute('id')==='meter-bridge-form'){
 const file=f.get('file');if(!(file instanceof File)||file.size<30||file.size>1024*1024)throw Error('ESP32-Datei fehlt oder ist zu groß (max. 1 MB).');
 const payload=JSON.parse(await file.text());bridgePreview=await decodeBridgeExport(payload,String(f.get('secret')||''));
 const box=$('#bridge-preview');if(box){box.innerHTML=bridgePreviewHtml(bridgePreview);formatMobileTables(box);box.scrollIntoView({block:'nearest'});}form.reset();return;
}
if(form.getAttribute('id')==='meter-bridge-confirm-form'){await importBridgeConfirm(f);return;}

if(form.getAttribute('id')==='emergency-plan-form'){
 const actions=String(f.get('actions')||'').slice(0,2500),doctorNotes=String(f.get('doctorNotes')||'').slice(0,1200);
 data.checks.emergencyPlan={actions,doctorNotes,lastReviewed:today()};await save();renderMain();toast('Persönlicher Notfallplan verschlüsselt gespeichert.');return;
}
if(form.getAttribute('id')==='verify-backup-form'){
 const file=f.get('file'),pass=f.get('password');if(!(file instanceof File)||!file.size||file.size>32*1024*1024)throw Error('Verschlüsselte Backup-Datei bis 32 MB wählen.');
 const v=JSON.parse(await file.text());if(v.format!=='vitalkompass-backup-v1'||!v.salt||!v.iv||!v.cipher)throw Error('Keine gültige VitalKompass-Backup-Datei.');
 const testKey=await passKey(pass,unb64(v.salt));let restored;
 try{restored=await unpack(v,testKey)}catch{throw Error('Prüfung fehlgeschlagen: Passwort falsch oder Backup beschädigt.');}
 validateStored(restored);const info=$('#backup-verify-result');if(info)info.textContent=`Backup überprüft: ${restored.measurements.length} Blutdruck-/Blutzuckerwerte, ${(restored.weights||[]).length} Gewichtseinträge, ${(restored.asthmaLogs||[]).length} Asthma-Einträge, ${restored.labs.length} Laborwerte. Keine Daten verändert.`;toast('Backup erfolgreich überprüft. Keine Daten überschrieben.');return;
}
if(form.getAttribute('id')==='symptom-form'){
 const o={id:id(),date:String(f.get('date')||''),time:String(f.get('time')||''),kind:String(f.get('kind')||'Sonstiges').slice(0,90),severity:String(f.get('severity')||'leicht'),notes:String(f.get('notes')||'').slice(0,1200)};
 if(!dateValid(o.date)||!timeValid(o.time)||!['leicht','mittel','stark'].includes(o.severity))throw Error('Bitte Datum, Uhrzeit und Stärke prüfen.');
 data.symptoms.push(o);await save();renderMain();toast('Symptom gespeichert.');return;
}
if(form.getAttribute('id')==='medtake-form'){
 const medId=String(f.get('medId')||'');if(!data.meds.some(m=>m.id===medId))throw Error('Bitte ein gültiges Medikament wählen.');
 const o={id:id(),medId,date:String(f.get('date')||''),time:String(f.get('time')||''),dose:String(f.get('dose')||'').slice(0,90),notes:String(f.get('notes')||'').slice(0,350)};
 if(!dateValid(o.date)||!timeValid(o.time))throw Error('Datum und Uhrzeit überprüfen.');
 data.medTakes.push(o);await save();renderMain();toast('Einnahme dokumentiert.');return;
}
if(form.getAttribute('id')==='reminder-form'){
 const o={id:id(),date:String(f.get('date')||''),kind:String(f.get('kind')||'Kontrolle').slice(0,100),notes:String(f.get('notes')||'').slice(0,500),done:false};
 if(!dateValid(o.date))throw Error('Ungültiges Datum.');data.reminders.push(o);await save();renderMain();toast('Kontrolle geplant – Hinweis erscheint beim Öffnen der App.');return;
}
if(form.getAttribute('id')==='evidence-form'){
 const file=f.get('document');let base64='',filename='',mime='';
 if(file instanceof File&&file.size){const max=1.5*1024*1024;if(file.size>max)throw Error('Datei größer als 1,5 MB.');if(!['application/pdf','image/jpeg','image/png','text/plain'].includes(file.type))throw Error('Nur PDF, JPG, PNG oder TXT erlaubt.');
 const total=data.evidence.reduce((sum,x)=>sum+(x.base64?.length||0)*0.75,0);if(total+file.size>6*1024*1024)throw Error('Dokumentenspeicher maximal 6 MB. Bitte ältere Dokumente auslagern.');
 filename=file.name.slice(0,120);mime=file.type;
 const bytes=new Uint8Array(await file.arrayBuffer());let chunks=[];for(let i=0;i<bytes.length;i+=24576){chunks.push(String.fromCharCode(...bytes.subarray(i,i+24576)));}base64=btoa(chunks.join(''));
 }
 const o={id:id(),date:String(f.get('date')||''),kind:String(f.get('kind')||''),notes:String(f.get('notes')||'').slice(0,500),filename,mime,base64};
 if(!dateValid(o.date)||!evidenceKinds.includes(o.kind))throw Error('Dokumentangaben prüfen.');data.evidence.push(o);await save();renderMain();toast('Nachweis verschlüsselt gespeichert.');return;
}
if(form.getAttribute('id')==='weight-form'){await saveWeightDedicated(form);return}
if(form.getAttribute('id')==='glucose-form'){const raw=nval(f.get('value')),mgdl=f.get('unit')==='mmol'?raw*18.0182:raw;if(!Number.isFinite(mgdl)||mgdl<10||mgdl>700)throw Error('Plausiblen Blutzuckerwert eingeben (10–700 mg/dl).');if(!dateValid(f.get('date'))||!timeValid(f.get('time')))throw Error('Datum und Uhrzeit prüfen.');const item={id:id(),type:'glucose',date:f.get('date'),time:f.get('time'),mgdl:Math.round(mgdl*10)/10,period:f.get('period'),note:f.get('note')||'',verified:true};const previousMeasurements=data.measurements;data.measurements=[...previousMeasurements,item];try{await save()}catch(error){data.measurements=previousMeasurements;throw error}renderMain();toast('Blutzucker gespeichert.');const w=glucoseWarnings(item);if(w.length)alert('Blutzucker-Warnhinweis:\n'+w.join('\n'));return}
if(form.getAttribute('id')==='bp-form'){const sys=nval(f.get('sys')),dia=nval(f.get('dia')),pulseText=String(f.get('pulse')??'').trim(),pulse=pulseText===''?null:nval(pulseText);if(!Number.isFinite(sys)||!Number.isFinite(dia)||sys<=dia||sys<40||sys>320||dia<20||dia>220||(pulse!==null&&(!Number.isFinite(pulse)||pulse<20||pulse>240)))throw Error('Bitte den systolischen, diastolischen Wert und Puls prüfen.');if(!dateValid(f.get('date'))||!timeValid(f.get('time')))throw Error('Datum und Uhrzeit prüfen.');const mealTiming=String(f.get('mealTiming')||'unknown');if(!Object.prototype.hasOwnProperty.call(bpMealLabels,mealTiming))throw Error('Ungültige Mahlzeitenauswahl.');const item={id:id(),type:'bp',date:f.get('date'),time:f.get('time'),sys,dia,pulse,mealTiming,note:f.get('note')||'',verified:true};const previousMeasurements=data.measurements;data.measurements=[...previousMeasurements,item];try{await save()}catch(error){data.measurements=previousMeasurements;throw error}renderMain();toast('Blutdruck gespeichert.');const w=bpWarnings(item);if(w.length)alert('Blutdruck-Warnhinweis:\n'+w.join('\n'));return}
if(form.getAttribute('id')==='psa-form'){const total=nval(f.get('total')),freeRaw=String(f.get('free')??'').trim(),free=freeRaw===''?NaN:nval(freeRaw),date=f.get('date');if(!dateValid(date))throw Error('Datum ungültig.');if(!Number.isFinite(total)||total<0||total>500)throw Error('Gesamt-PSA prüfen.');if(freeRaw!==''&&(!Number.isFinite(free)||free<0||free>total))throw Error('Freies PSA darf nicht größer als Gesamt-PSA sein.');const note=String(f.get('notes')||'').slice(0,300),place=String(f.get('place')||'').slice(0,120);const items=[{name:'PSA gesamt',unit:'ng/ml',value:total}];if(Number.isFinite(free)){items.push({name:'PSA frei',unit:'ng/ml',value:free});if(total>0)items.push({name:'PSA frei/gesamt',unit:'%',value:Math.round(free/total*10000)/100});}const oldLabs=data.labs;data.labs=[...oldLabs];for(const t of items)data.labs.push({id:id(),type:'lab',date,time:'',name:t.name,unit:t.unit,value:t.value,low:null,high:null,place,note,verified:true});try{await save()}catch(error){data.labs=oldLabs;throw error}renderMain();toast(`${items.length} PSA-Laborwerte gespeichert. Für die Bewertung den Urologen einbeziehen.`);return}
if(form.getAttribute('id')==='lab-form'){const date=f.get('date'),place=f.get('place')||'';for(const [k,v] of f.entries())if(/^[vlu]:/.test(k))labDraft[k]=String(v);let newitems=[];for(const lab of LABCATALOG){const raw=labDraft['v:'+lab.name];if(raw===undefined||String(raw).trim()==='')continue;const value=nval(raw),lo=nval(labDraft['l:'+lab.name]),hi=nval(labDraft['u:'+lab.name]);if(!Number.isFinite(value))throw Error(`Ungültiger Wert: ${lab.name}`);if(Number.isFinite(lo)&&Number.isFinite(hi)&&hi<lo)throw Error(`Referenzgrenzen vertauscht bei ${lab.name}`);newitems.push({id:id(),type:'lab',date,time:'',verified:true,name:lab.name,unit:lab.unit,value,low:Number.isFinite(lo)?lo:null,high:Number.isFinite(hi)?hi:null,place})}if(!dateValid(date))throw Error('Bitte ein gültiges Labor-Abnahmedatum angeben.');if(!newitems.length)throw Error('Bitte mindestens einen Laborwert eingeben.');const oldLabs=data.labs;data.labs=[...oldLabs,...newitems];try{await save()}catch(error){data.labs=oldLabs;throw error}labDraft={};labQuery='';labDate='';labPlace='';renderMain();toast(`${newitems.length} Laborwerte gespeichert.`);return}
if(form.getAttribute('id')==='med-form'){const oldId=f.get('id');const med={id:oldId||id(),name:(f.get('name')||'').trim(),dose:f.get('dose')||'',schedule:f.get('schedule')||'',indication:f.get('indication')||'',notes:f.get('notes')||'',kind:['otc','supplement','asneeded','prescription'].includes(f.get('kind'))?f.get('kind'):'prescription',verified:true};if(!med.name)throw Error('Medikamentenname fehlt.');const oldMeds=data.meds;data.meds=[...oldMeds];if(oldId){const i=data.meds.findIndex(x=>x.id===oldId);if(i>=0)data.meds[i]=med;else data.meds.push(med)}else data.meds.push(med);try{await save()}catch(error){data.meds=oldMeds;throw error}renderMain();toast('Medikament gespeichert. Wechselwirkungen bitte fachlich überprüfen.');return}
if(form.getAttribute('id')==='personal-form'){
 const oldName=String(data.profile.name||'').trim(),name=String(f.get('name')||'').trim();if(!name||name.length>100)throw Error('Bitte einen Namen mit maximal 100 Zeichen eingeben.');
 if(oldName&&oldName!==name&&!confirm('Patientenname ändern? Bestehende Daten bleiben erhalten, private Importe müssen zum neuen Namen passen.'))return;
 for(const k of ['name','birthday','street','postalCode','city','phone','insurance','gp','height','weight','bloodGroup'])data.profile[k]=String(f.get(k)||'').trim().slice(0,150);
 await save();renderMain();toast('Persönliche Daten gespeichert.');return;
}
if(form.getAttribute('id')==='gdb-form'){
 const allowed={existing:['unknown','yes','no'],equal:['unknown','yes','no'],diabetes:['unknown','tablets','risk','intensive'],apnea:['unknown','cpap','no','notConfirmed'],organ:['unknown','yes','no'],function:['unknown','yes','no']};const o={};
 for(const [k,values] of Object.entries(allowed)){const v=String(f.get(k)||'unknown');if(!values.includes(v))throw Error('Ungültige Auswahl.');o[k]=v;}
 const v=String(f.get('value')||'').trim();if(v&&!(/^(0|[1-9]0|100)$/.test(v)))throw Error('GdB nur in Zehnerschritten zwischen 0 und 100 eingeben.');o.value=v;o.notes=String(f.get('notes')||'').slice(0,2000);data.checks=data.checks||{};data.checks.gdb=o;await save();renderMain();toast('GdB-Angaben gespeichert. Die Einschätzung ist keine amtliche Feststellung.');return;
}
if(form.getAttribute('id')==='profile-form'){const props=['name','birthday','bloodGroup','height','weight','notes'];for(const x of props)data.profile[x]=(f.get(x)||'').trim();for(const x of ['conditions','allergies','intolerances','foods','pollen','history'])data.profile[x]=(f.get(x)||'').split('\n').map(x=>x.trim()).filter(Boolean);data.profile.contact=(f.get('contacts')||'').split('\n').map(x=>{const [name,...tel]=x.split('|');return {name:(name||'').trim(),phone:tel.join('|').trim()}}).filter(x=>x.name);await save();renderMain();toast('Notfallpass gespeichert.');return}
if(form.getAttribute('id')==='threshold-form'){const changes={...data.settings};for(const k of Object.keys(changes)){if(!f.has(k))continue;const v=nval(f.get(k));if(Number.isFinite(v))changes[k]=v}if(changes.glucoseFastingLow>=changes.glucoseFastingHigh)throw Error('Nüchtern-Untergrenze darf nicht über der Obergrenze liegen.');if(changes.bpLowSys>=changes.bpHighSys||changes.bpHighSys>=changes.bpCriticalSys||changes.bpLowDia>=changes.bpHighDia||changes.bpHighDia>=changes.bpCriticalDia)throw Error('Blutdruck-Grenzen müssen aufsteigend sein.');if(changes.pulseCriticalLow>=changes.pulseLow||changes.pulseLow>=changes.pulseHigh||changes.pulseHigh>=changes.pulseCriticalHigh)throw Error('Puls-Grenzen müssen aufsteigend sein.');if(changes.glucoseCriticalHigh<=changes.glucoseAfterHigh||changes.glucoseCriticalHigh<=changes.glucoseFastingHigh)throw Error('Kritische Blutzucker-Obergrenze muss oberhalb der Zielwerte liegen.');if(changes.bpCriticalSys>180||changes.bpCriticalDia>110)throw Error('Die medizinische Sofortabklärungsschwelle 180/110 darf nicht heraufgesetzt werden.');data.settings=changes;await save();renderMain();toast('Warnschwellen gespeichert.');return}
if(form.getAttribute('id')==='benefits-form'){const result=letter(f);const out=$('#letter-result');out.innerHTML=`<label class="field"><span>Vorlage zum Kopieren</span><textarea id="letter-text" rows="14">${h(result)}</textarea></label><button data-action="copy-letter" class="secondary" type="button">Text kopieren</button>`;return}
if(form.getAttribute('id')==='restore-form'){if(weightSaveInProgress)throw Error('Die Gewichtsmessung wird noch gespeichert. Bitte warten und die Aktion anschließend wiederholen.');if(!f.get('confirmReplace'))throw Error('Bitte zuerst die bewusste Datenüberschreibung bestätigen.');const file=f.get('file'),pass=f.get('password');if(!(file instanceof File)||!file.size)throw Error('Backup-Datei wählen.');if(file.size>32*1024*1024)throw Error('Backup zu groß.');const v=JSON.parse(await file.text());if(v.format!=='vitalkompass-backup-v1'||!v.salt||!v.iv||!v.cipher)throw Error('Unbekanntes Backup-Format.');const tempkey=await passKey(pass,unb64(v.salt));let restored;try{restored=await unpack(v,tempkey)}catch{throw Error('Backup-Passwort falsch oder Datei beschädigt.')}validateStored(restored);const priorName=String(data.profile.name||'').trim(),backupName=String(restored.profile.name||'').trim();if(priorName&&backupName&&priorName.toLocaleLowerCase('de-DE')!==backupName.toLocaleLowerCase('de-DE'))throw Error('Das Backup gehört zu einem anderen Patienten. Bitte zuerst die vorhandenen Daten separat sichern und einen neuen Speicher anlegen.');if(data.profile.birthday&&restored.profile.birthday&&data.profile.birthday!==restored.profile.birthday)throw Error('Geburtsdatum im Backup stimmt nicht mit dem vorhandenen Patienten überein.');if(!confirm(`ACHTUNG: Das Backup enthält ${restored.measurements.length} Blutdruck-/Blutzuckerwerte und ${(restored.weights||[]).length} Gewichtseinträge. Alle aktuellen Daten werden vollständig ERSETZT, nicht zusammengeführt. Fortfahren?`))return;const previousData=data;data=restored;migrateData();try{await saveQueue;await persistRestoredVault(data)}catch(e){data=previousData;throw e}weightJournalReadOnly=false;stagedBackupFile=null;view='start';common();toast('Backup und Gewichtstagebuch gemeinsam wiederhergestellt.');return}
if(form.getAttribute('id')==='import-form'){const file=f.get('file');if(!(file instanceof File)||!file.size)throw Error('Datei auswählen.');if(file.size>1024*1024)throw Error('Importdatei zu groß.');const obj=JSON.parse(await file.text());await importPrivate(obj);return}
}catch(err){const message=err.message||'Fehler beim Speichern';if(form.getAttribute('id')==='weight-form'){const target=$('#weight-save-feedback');if(target){target.textContent=message;target.classList.add('vk-save-error');target.scrollIntoView({block:'nearest'});}}alert(message)}}
function validateStored(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||!x.profile||typeof x.profile!=='object'||Array.isArray(x.profile)||!Array.isArray(x.measurements)||!Array.isArray(x.labs)||!Array.isArray(x.meds)||!x.settings||typeof x.settings!=='object'||Array.isArray(x.settings))throw Error('Inhalt des Backups ist nicht kompatibel.');
 if((x.asthmaLogs!==undefined&&(!Array.isArray(x.asthmaLogs)||x.asthmaLogs.length>50000))||(x.weights!==undefined&&(!Array.isArray(x.weights)||x.weights.length>50000))||x.measurements.length>50000||x.labs.length>50000||x.meds.length>5000||['symptoms','medTakes','reminders','evidence'].some(k=>x[k]!==undefined&&(!Array.isArray(x[k])||x[k].length>10000)))throw Error('Backup enthält zu viele Einträge.');
 if(x.oxygenLogs!==undefined&&(!Array.isArray(x.oxygenLogs)||x.oxygenLogs.length>50000||!x.oxygenLogs.every(vk204OxygenValid)))throw Error('Backup enthält ungültige SpO₂/PI-Messungen.');
 if(x.hospitalStays!==undefined&&(!Array.isArray(x.hospitalStays)||x.hospitalStays.length>5000||!x.hospitalStays.every(vk205HospitalValid)))throw Error('Backup enthält ungültige Krankenhausaufenthalte oder Scans.');
 if(x.urologyLogs!==undefined&&(!Array.isArray(x.urologyLogs)||x.urologyLogs.length>50000||!x.urologyLogs.every(vkUroValidate)))throw Error('Backup enthält ungültige urologische Einträge.');
 const basic=defaults().profile;for(const [field,empty] of Object.entries(basic)){const value=x.profile[field];if(value===undefined)continue;
  if(Array.isArray(empty)){if(!Array.isArray(value)||value.length>1000)throw Error('Backup enthält ungültige Profilangaben: '+field);if(field==='contact'?!value.every(c=>c&&typeof c.name==='string'&&typeof c.phone==='string'):!value.every(c=>typeof c==='string'))throw Error('Backup enthält ungültige Kontakt-/Allergieangaben.')}
  else if(typeof value!=='string')throw Error('Backup enthält ungültige Profildaten: '+field);
 }
 for(const list of [x.measurements,x.labs,x.meds,x.weights||[],x.asthmaLogs||[],...['symptoms','medTakes','reminders','evidence'].map(k=>x[k]||[])])if(!list.every(v=>v&&typeof v==='object'&&!Array.isArray(v)))throw Error('Backup enthält ungültige Mess-/Dokumenteinträge.');
 for(const bucket of ['measurements','weights','labs','asthmaLogs','urologyLogs'])for(const entry of x[bucket]||[]){if(entry.attachments!==undefined&&!vk201ValidateAll(entry.attachments))throw Error('Backup enthält ungültige Anhänge.');}
 if(!vk201BackupWithinLimit(x))throw Error('Backup: Anhangsspeicher zu groß.');
 if(!x.measurements.every(m=>['bp','glucose'].includes(m.type)&&dateValid(m.date)&&timeValid(m.time)&&(m.type==='glucose'?Number.isFinite(m.mgdl)&&m.mgdl>=10&&m.mgdl<=700:Number.isFinite(m.sys)&&Number.isFinite(m.dia)&&m.sys>m.dia&&m.sys>=40&&m.sys<=320&&m.dia>=20&&m.dia<=220&&(m.pulse===null||m.pulse===undefined||(Number.isFinite(m.pulse)&&m.pulse>=20&&m.pulse<=240)))))throw Error('Backup enthält beschädigte oder nicht plausible Messwerte.');
 if(x.weights!==undefined&&!x.weights.every(w=>w&&typeof w.id==='string'&&dateValid(w.date)&&timeValid(w.time)&&Number.isFinite(w.kg)&&w.kg>=20&&w.kg<=400&&w.mealTiming!=='unknown'&&Object.prototype.hasOwnProperty.call(bpMealLabels,w.mealTiming)&&(w.note===undefined||(typeof w.note==='string'&&w.note.length<=300))))throw Error('Backup enthält ungültige Gewichtseinträge.');
  if(!x.labs.every(l=>typeof l.name==='string'&&l.name.length>0&&l.name.length<=150&&dateValid(l.date)&&Number.isFinite(l.value)&&(!l.comparator||['<','>'].includes(l.comparator))))throw Error('Backup enthält ungültige Laborwerte.');
 if(!x.meds.every(m=>typeof m.name==='string'&&m.name.trim()&&m.name.length<=150))throw Error('Backup enthält ungültige Medikamente.');
 if(x.asthmaLogs!==undefined&&!x.asthmaLogs.every(a=>a&&typeof a.id==='string'&&dateValid(a.date)&&timeValid(a.time)&&Number.isInteger(a.breathlessness)&&a.breathlessness>=0&&a.breathlessness<=10&&Number.isInteger(a.rescueUses)&&a.rescueUses>=0&&a.rescueUses<=50&&(a.peakFlow===null||(Number.isFinite(a.peakFlow)&&a.peakFlow>=50&&a.peakFlow<=1000))&&(a.fev1Pct===null||(Number.isFinite(a.fev1Pct)&&a.fev1Pct>=5&&a.fev1Pct<=140))&&Array.isArray(a.triggers)&&a.triggers.length<=7&&a.triggers.every(t=>Object.prototype.hasOwnProperty.call(ASTHMA_TRIGGERS,t))&&typeof a.note==='string'&&a.note.length<=1000))throw Error('Backup enthält ungültige Asthma-Einträge.');
 if(x.medStocks!==undefined&&(x.medStocks===null||typeof x.medStocks!=='object'||Array.isArray(x.medStocks)||Object.keys(x.medStocks).length>5000||!Object.values(x.medStocks).every(v=>v&&typeof v==='object'&&!Array.isArray(v)&&Number.isInteger(v.count)&&v.count>=0&&v.count<=100000&&Number.isInteger(v.min)&&v.min>=0&&v.min<=100000&&['Tabletten','Hübe','Ampullen','Stück'].includes(v.unit))))throw Error('Backup enthält ungültige Medikamentenvorräte.');
 if(x.checks!==undefined&&(x.checks===null||typeof x.checks!=='object'||Array.isArray(x.checks)))throw Error('Backup enthält beschädigte Verwaltungsangaben.');
}
async function checkUpdate(){const status=$('#update-status');if(!('serviceWorker' in navigator)){status.textContent='Service Worker in diesem Browser nicht verfügbar. Webseite ggf. neu laden.';return}try{const r=await fetch('./version.json?check='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Versionsdatei nicht erreichbar');const v=await r.json();const reg=await navigator.serviceWorker.getRegistration();await reg?.update();const latest=v.version||'unbekannt';pendingUpdate=!!reg?.waiting;if(latest===VERSION&&!pendingUpdate){status.textContent=`Aktuell: ${VERSION}. Kein neuer veröffentlichter Stand vorhanden.`}else if(pendingUpdate){status.textContent=`Update ${latest} verfügbar. „Vorhandenes Update installieren“ wählen.`}else{status.textContent=`Serverversion ${latest}; installierte Version ${VERSION}. Nach vollständiger Veröffentlichung bitte neu laden.`;pendingUpdate=latest!==VERSION}}catch(e){status.textContent='Update-Prüfung derzeit nicht möglich (offline oder Server nicht erreichbar).'}}
async function doAction(el){const action=el.dataset.action;try{
if(action==='oxygen-edit'){vk204OxygenEdit(el.dataset.id);return}
if(action==='oxygen-remove'){await vk204OxygenRemove(el.dataset.id);return}
if(action==='oxygen-reset'){renderMain();return}
if(action==='hospital-edit'){vk205HospitalEdit(el.dataset.id);return}
if(action==='hospital-remove'){await vk205HospitalRemove(el.dataset.id);return}
if(action==='hospital-view-file'){vk205HospitalView(el.dataset.id,el.dataset.index);return}
if(action==='hospital-reset'){renderMain();return}
/* VK200 ACTION BEGIN */
if(action==='report-all'||action==='report-none'){
 const form=$('#doctor-report-form');if(form)form.querySelectorAll('input[name="part"]').forEach(el=>{el.checked=action==='report-all'});return;
}
if(action==='print-topic'){
 const topic=String(el.dataset.topic||'');if(!VK_REPORT_KEYS.has(topic))throw Error('Berichtsthema nicht bekannt.');
 if(weightSaveInProgress)throw Error('Eine Gewichtsspeicherung läuft noch. Bitte warten.');
 const [from,to]=vkReportDateRange($('#doctor-report-form'));
 makePrint('Einzelbericht – '+(VK_REPORT_TOPICS.find(t=>t[0]===topic)?.[1]||topic),vkAllTopicHtml(from,to,{[topic]:true}));return;
}
if(action==='edit-uro'){
 const entry=(data.urologyLogs||[]).find(x=>x.id===el.dataset.id);if(!entry)return;
 const form=$('#'+(entry.type==='ipss'?'uro-ipss-form':'uro-log-form'));if(!form)return;
 for(const name of ['id','date','time'])form.elements[name].value=entry[name];
 if(entry.type==='ipss'){entry.ipss.forEach((v,i)=>{form.elements['i'+i].value=String(v)});form.elements.qol.value=String(entry.qol)}
 else{for(const name of ['kind','severity','day','night','finding','note'])form.elements[name].value=entry[name]??''}
 form.scrollIntoView({behavior:'smooth',block:'start'});return;
}
if(action==='remove-uro'){
 if(weightSaveInProgress)throw Error('Eine Gewichtsmessung wird noch gespeichert. Bitte warten.');
 if(!confirm('Diesen urologischen Eintrag endgültig löschen?'))return;
 const before=data.urologyLogs,next=before.filter(x=>x.id!==el.dataset.id);
 if(next.length===before.length)throw Error('Eintrag nicht gefunden.');
 data.urologyLogs=next;
 try{await save()}catch(e){data.urologyLogs=before;throw e}
 renderMain();toast('Urologischer Eintrag gelöscht.');return;
}
/* VK200 ACTION END */

if(action==='vk201-edit'){vk201Open(String(el.dataset.vk201Type||''),String(el.dataset.id||''));return}
if(action==='save-weight'){try{await saveWeightDedicated(el.closest('form') || $('#weight-form'))}catch(error){const target=$('#weight-save-feedback');if(target){target.textContent=error.message||'Gewicht konnte nicht gespeichert werden.';target.classList.add('vk-save-error')}alert(error.message||'Gewicht konnte nicht gespeichert werden.')}return}
if(action==='lock'){if(vk201Busy)throw Error('Ein Bearbeitungsvorgang läuft noch.');vk201Close();if(weightSaveInProgress)throw Error('Die Gewichtsmessung wird noch gespeichert. Bitte warten und die Aktion anschließend wiederholen.');await saveQueue;discardTemporaryPDF();bridgePreview=null;stagedBackupFile=null;data=null;key=null;view='start';authPage(!!(await getRec()));document.body.classList.remove('senior-mode');return}
if(action==='remove'){if(weightSaveInProgress)throw Error('Die Gewichtsmessung wird noch gespeichert. Bitte warten und die Aktion anschließend wiederholen.');if(!confirm('Diesen Eintrag endgültig löschen?'))return;const idv=el.dataset.id;const bucket=({lab:'labs',med:'meds',symptom:'symptoms',medtake:'medTakes',reminder:'reminders',evidence:'evidence',weight:'weights',asthma:'asthmaLogs',measurement:'measurements'})[el.dataset.type]||'measurements';if(bucket==='weights'){const next=data.weights.filter(x=>x.id!==idv);await storeWeightJournal(next);data.weights=next;syncProfileWeight();renderMain();toast('Gewichtseintrag gelöscht.');return}const originalBucket=data[bucket];data[bucket]=originalBucket.filter(x=>x.id!==idv);try{await save()}catch(error){data[bucket]=originalBucket;throw error}renderMain();toast('Eintrag gelöscht.');return}
if(action==='verify'){
 const m=data.measurements.find(x=>x.id===el.dataset.id);if(!m)return;
 if(m.type==='bp'){
  const sysText=prompt(`Blutdruck vom Original prüfen: ${fmtDate(m.date)} ${m.time}\nSystolischer Wert (mmHg):`,m.sys);if(sysText===null)return;
  const diaText=prompt('Diastolischer Wert (mmHg):',m.dia);if(diaText===null)return;
  const pulseText=prompt('Puls (/min; leer lassen wenn nicht angegeben):',m.pulse??'');if(pulseText===null)return;
  const sys=nval(sysText),dia=nval(diaText),pulse=pulseText.trim()===''?null:nval(pulseText);
  if(!Number.isFinite(sys)||!Number.isFinite(dia)||sys<=dia||sys<40||sys>320||dia<20||dia>220||(pulse!==null&&(!Number.isFinite(pulse)||pulse<20||pulse>240)))throw Error('Blutdruck oder Puls unplausibel.');
  if(!confirm(`Original kontrolliert? Datum: ${fmtDate(m.date)} ${m.time}\nBlutdruck: ${sys}/${dia} mmHg\nPuls: ${pulse??'nicht gemessen'}\nNur bestätigen, wenn Patient, Datum, Uhrzeit und Werte übereinstimmen.`))return;
  Object.assign(m,{sys,dia,pulse,verified:true});await save();renderMain();toast('Blutdruck-Fotoeintrag bestätigt.');return;
 }
 if(m.type==='glucose'){
  let newValue=prompt('Messwert aus dem Foto bestätigen oder korrigieren (mg/dl):',m.mgdl);if(newValue===null)return;newValue=nval(newValue);
  if(!Number.isFinite(newValue)||newValue<10||newValue>700)throw Error('Ungültiger Blutzuckerwert.');
  if(!confirm('Sind Patient, Datum und Messwert korrekt, und ist die Original-Einheit tatsächlich mg/dl (nicht mmol/l)? Nur dann bestätigen.'))return;
  m.mgdl=newValue;m.verified=true;await save();renderMain();toast('Blutzucker-Fotowert bestätigt.');return;
 }
 return;
}
if(action==='verify-lab'){const m=data.labs.find(x=>x.id===el.dataset.id);if(!m)return;const reply=prompt(`Laborwert vom Originalbefund prüfen: ${m.name} (${m.unit})\nWert bestätigen oder korrigieren:`,String(m.value));if(reply===null)return;const corrected=nval(reply);if(!Number.isFinite(corrected))throw Error('Ungültiger Laborwert.');if(!confirm(`Stimmen Patient, Datum ${fmtDate(m.date)}, Test ${m.name}, Einheit ${m.unit} und der korrigierte Wert ${corrected} mit dem Originalbefund überein?`))return;m.value=corrected;m.verified=true;await save();renderMain();toast('Laborwert anhand Original bestätigt.');return}
if(action==='edit-asthma'){
 const entry=(data.asthmaLogs||[]).find(x=>x.id===el.dataset.id),form=$('#asthma-form');if(!entry||!form)return;
 for(const name of ['id','date','time','breathlessness','rescueUses','peakFlow','fev1Pct','note'])form.elements[name].value=entry[name]??'';
 form.querySelectorAll('[name="trigger"]').forEach(c=>{c.checked=(entry.triggers||[]).includes(c.value)});
 form.scrollIntoView({behavior:'smooth',block:'start'});return;
}
if(action==='edit-weight'){const entry=(data.weights||[]).find(x=>x.id===el.dataset.id),form=$('#weight-form');if(!entry||!form)return;for(const name of ['id','date','time','kg','mealTiming','note'])form.elements[name].value=entry[name]??'';form.scrollIntoView({behavior:'smooth',block:'start'});return}
if(action==='edit-med'){const m=data.meds.find(x=>x.id===el.dataset.id);if(!m)return;const f=$('#med-form');for(const k of ['id','name','dose','schedule','indication','notes'])f.elements[k].value=m[k]||'';if(f.elements.kind)f.elements.kind.value=m.kind||'prescription';f.scrollIntoView({behavior:'smooth',block:'center'});return}
if(action==='toggle-senior'){data.settings.seniorMode=!data.settings.seniorMode;await save();common();toast('Ansichtseinstellung gespeichert.');return}
if(action==='print-pro'){makePrint('Gesundheitsanalyse Pro',proReportHtml());return}
if(action==='print-personal-emergency'){const e=data.checks.emergencyPlan||{};makePrint('Persönlicher Notfallplan',`<h2>${h(data.profile.name||'Patient')}</h2><p>Geprüft am: ${h(e.lastReviewed||'nicht dokumentiert')}</p><h2>Individuell ärztlich abgestimmte Maßnahmen</h2><p>${h(e.actions||'Keine Angaben dokumentiert.').replace(/\n/g,'<br>')}</p><h2>Weitere Hinweise</h2><p>${h(e.doctorNotes||'').replace(/\n/g,'<br>')}</p><p>Bei schweren Notfallsymptomen 112 wählen. Nur dokumentierte Maßnahmen, keine automatisch generierte Therapie.</p>`);return}
if(action==='export-ics'){const entries=data.reminders.filter(x=>!x.done);if(!entries.length)throw Error('Noch keine offenen Kontrolltermine angelegt.');sendDownload(VKPro.makeICS(entries),'VitalKompass-Kontrolltermine.ics','text/calendar;charset=utf-8');toast('Kalenderdatei erstellt. Achtung: Datei ist unverschlüsselt.');return}
if(action==='backup'){if(weightSaveInProgress)throw Error('Die Gewichtsmessung wird noch gespeichert. Bitte warten und die Aktion anschließend wiederholen.');if(weightJournalReadOnly&&!confirm('WARNUNG: Das separate Gewichtstagebuch konnte nicht gelesen werden. Diese Sicherung könnte ältere Gewichtswerte NICHT enthalten. Trotzdem eine Sicherung der übrigen Gesundheitsdaten erstellen?'))return;await save();await saveQueue;const old=await getRec();if(!old?.salt||!old.iv||!old.cipher)throw Error('Verschlüsselte Sicherung konnte nicht vorbereitet werden.');const doc={format:'vitalkompass-backup-v1',version:VERSION,created:new Date().toISOString(),salt:old.salt,iv:old.iv,cipher:old.cipher};stagedBackupFile=new File([JSON.stringify(doc,null,2)],`VitalKompass-Backup-${today()}.json`,{type:'application/json'});const ready=$('#backup-ready');if(ready){ready.hidden=false;ready.scrollIntoView({block:'nearest'});}const status=$('#backup-save-status');if(status)status.textContent='Verschlüsselte Datei vorbereitet ('+nf(stagedBackupFile.size/1024,0)+' KB). Jetzt „In Dateien sichern“ auswählen. Keine Daten wurden hochgeladen.';toast('Backup vorbereitet. Jetzt „In Dateien sichern“ wählen.');return}
if(action==='backup-share'){if(!stagedBackupFile)throw Error('Zuerst das Backup vorbereiten.');if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[stagedBackupFile]}))){navigator.share({files:[stagedBackupFile],title:'VitalKompass – verschlüsseltes Backup'}).then(()=>{const status=$('#backup-save-status');if(status)status.textContent='iPhone-Teilen-Menü beendet. Bitte in „Dateien“ prüfen, ob die Datei wirklich gespeichert wurde.';toast('Bitte die Sicherung in Dateien prüfen.');}).catch(err=>{if(err?.name==='AbortError')return;const status=$('#backup-save-status');if(status)status.textContent='iOS-Teilen nicht verfügbar. Bitte „Alternative: Datei herunterladen“ nutzen.';toast('iPhone-Teilen nicht verfügbar – Download-Alternative nutzen.');});}else{const status=$('#backup-save-status');if(status)status.textContent='Dieser Browser unterstützt Datei-Teilen nicht. Bitte „Alternative: Datei herunterladen“ nutzen.';toast('Dateifreigabe hier nicht unterstützt.');}return}
if(action==='backup-download'){if(!stagedBackupFile)throw Error('Zuerst das Backup vorbereiten.');sendDownload(stagedBackupFile,stagedBackupFile.name);const status=$('#backup-save-status');if(status)status.textContent='Download gestartet. Öffne die App „Dateien“ und kontrolliere den Ordner „Downloads“.';toast('Download gestartet. In Dateien / Downloads prüfen.');return}
if(action==='toggle-reminder'){const t=data.reminders.find(x=>x.id===el.dataset.id);if(t){const old=t.done;t.done=!t.done;try{await save()}catch(error){t.done=old;throw error}renderMain();}return}
if(action==='download-evidence'){const t=data.evidence.find(x=>x.id===el.dataset.id);if(!t?.base64)return;const bin=atob(t.base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);sendDownload(bytes,t.filename||'Nachweis',t.mime||'application/octet-stream');return}
if(action==='print-full'){makePrint('Gesundheitsanalyse · Arztbericht',reportFullHtml());return}
if(action==='print-gdb'){makePrint('GdB-Orientierung',`<h2>${h(data.profile.name||'Patient')}</h2><p>${fmtDate(today())}</p>${gdbReport().map(x=>`<p>• ${h(x)}</p>`).join('')}<p>Offizielle Grundlage: § 152 SGB IX und Versorgungsmedizin-Verordnung, Anlage Teil B 8.7, 9.3 und 15.1.</p>`);return}
if(action==='print-report'){makePrint('Gesundheitsbericht',statsHtml());return}
if(action==='print-emergency'){const p=data.profile;makePrint('Notfallpass',`<div class="notice danger"><b>ACHTUNG:</b> Angaben aus altem Dokument – bitte ärztlich prüfen. Notruf: 112.</div><h2>${h(p.name)}</h2><p>Adresse: ${h([p.street,p.postalCode,p.city].filter(Boolean).join(', '))} · Telefon: ${h(p.phone||'–')}</p><p>Geboren: ${h(p.birthday?fmtDate(p.birthday):'')} · Blutgruppe: ${h(p.bloodGroup)} (unbestätigt)</p><h3>Allergien / Unverträglichkeiten</h3><p>${h([...p.allergies,...p.intolerances].join('; '))}</p><h3>Erkrankungen</h3><p>${h(p.conditions.join('; '))}</p><h3>Medikamente (Stand überprüfen)</h3><p>${data.meds.map(m=>h(m.name+' '+m.dose+' '+m.schedule)).join('; ')}</p><h3>Notfallkontakte</h3><p>${p.contact.map(c=>h(c.name+': '+c.phone)).join('; ')}</p><h3>Weitere medizinische Hinweise</h3><p>${h(p.notes)}</p><p>Dieses Dokument ersetzt keinen medizinisch bestätigten Notfallausweis.</p>`);return}
if(action==='copy-letter'){const txt=$('#letter-text')?.value||'';if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(txt)}else{$('#letter-text').select();throw Error('Automatisches Kopieren nicht möglich. Bitte Textfeld markieren und manuell kopieren.')}toast('Anschreiben kopiert.');return}
if(action==='check-update'){await checkUpdate();return}
if(action==='install-update'){await saveQueue;let reg=await navigator.serviceWorker?.getRegistration();if(!reg?.waiting){await checkUpdate();reg=await navigator.serviceWorker?.getRegistration();}if(reg?.waiting){vkApprovedUpdateReload=true;reg.waiting.postMessage('SKIP_WAITING');const label=$('#update-status');if(label)label.textContent='Update wird nach abgeschlossenen Speichervorgängen aktiviert.';}else toast('Kein Update wartet auf Installation.');return}
if(action==='wipe'){if(weightSaveInProgress)throw Error('Die Gewichtsmessung wird noch gespeichert. Bitte warten und die Aktion anschließend wiederholen.');if(!confirm('ALLE GESUNDHEITSDATEN dieses Geräts endgültig löschen? Nur mit einem externen Backup wiederherstellbar.'))return;if(!confirm('Wirklich alle Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden.'))return;await saveQueue;discardTemporaryPDF();bridgePreview=null;await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(KEY);t.objectStore(STORE).delete(WEIGHT_DRAFT_KEY);t.objectStore(STORE).delete(WEIGHT_JOURNAL_KEY);t.oncomplete=resolve;t.onerror=()=>reject(t.error)});data=null;key=null;authPage(false);return}
}catch(e){alert(e.message||'Aktion fehlgeschlagen')}}
root.addEventListener('click',e=>{if(e.target.closest('[data-vk203-open]')){vk203OpenDrawer();return}if(e.target.closest('[data-vk203-close]')||e.target.closest('[data-vk203-close-inside]')){vk203CloseDrawer();return}const openZoom=e.target.closest('[data-vk207-open]');if(openZoom){vk207OpenZoom(openZoom);return}const gf=e.target.closest('[data-vk207-glucose]');if(gf){const choice=gf.dataset.vk207Glucose;if(['all','before','after'].includes(choice)){vk207GlucoseFilter=choice;renderMain()}return}const point=e.target.closest('[data-chart-info]');if(point){toast(point.dataset.chartInfo||'Messwert');return}const navButton=e.target.closest('[data-view]');if(navButton){vk203CloseDrawer(false);view=navButton.dataset.view;labQuery='';common();window.scrollTo(0,0);return}const period=e.target.closest('[data-report]');if(period){reportPeriod=period.dataset.report;renderMain();return}const periodAnalysis=e.target.closest('[data-analysis-days]');if(periodAnalysis){analysisDays=periodAnalysis.dataset.analysisDays;renderMain();return}const chartPeriod=e.target.closest('[data-chart-period]');if(chartPeriod){const t=chartPeriod.dataset.chartType,period=chartPeriod.dataset.chartPeriod;if(Object.prototype.hasOwnProperty.call(chartPeriods,t)&&CHART_PERIODS.some(x=>x[0]===period)){chartPeriods[t]=period;renderMain()}return}const chart=e.target.closest('[data-chart-days]');if(chart){chartWindow=chart.dataset.chartDays;renderMain();return}const action=e.target.closest('[data-action]');if(action)doAction(action)});
root.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target?.matches?.('[data-chart-info]')){e.preventDefault();toast(e.target.dataset.chartInfo||'Messwert')}});
document.addEventListener('keydown',e=>{if(!document.body.classList.contains('vk203-drawer-open'))return;if(e.key==='Escape'){e.preventDefault();vk203CloseDrawer();return}if(e.key!=='Tab')return;const drawer=$('#vk203-drawer');if(!drawer)return;const focusable=$$('button:not([hidden]):not(:disabled), input:not([hidden]):not(:disabled)',drawer).filter(x=>!x.closest('[hidden]'));if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
root.addEventListener('submit',handleSubmit);
root.addEventListener('change',e=>{if(e.target.matches('#weight-meal-filter')){weightMealFilter=e.target.value;renderMain();return}if(e.target.matches('[data-lab-chart]')){chosenLabTrend=e.target.value;renderMain()}});
root.addEventListener('input',e=>{
const el=e.target;
if(el.id==='vk203-search'){vk203SearchMenu(el.value);return}
if(el.id==='vk203-height'||el.id==='vk203-weight'){vk203Recalculate();return}
if(el.closest('#weight-form')&&el.name==='kg'){const w=$('#vk203-weight');if(w){w.value=el.value;vk203Recalculate()}return}
if(el.closest('#personal-form')&&(el.name==='height'||el.name==='weight')){const target=$(el.name==='height'?'#vk203-height':'#vk203-weight');if(target){if(el.name==='height'||!(data.weights||[]).length)target.value=el.value;vk203Recalculate()}return}
if(el.closest('#lab-form')){
 if(el.name==='date')labDate=el.value;
 if(el.name==='place')labPlace=el.value;
 if(/^[vlu]:/.test(el.name||''))labDraft[el.name]=el.value;
 if(el.id==='lab-search'){
   labQuery=el.value;
   renderMain();
   const search=$('#lab-search');if(search){search.focus();search.setSelectionRange(search.value.length,search.value.length)}
 }
}
});
/* VK198 FIXED_VIEW_BEGIN: iPhone-Ansicht ohne Pinch-Zoom, normale Einzelberuehrung bleibt. */
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  for (const type of ['gesturestart', 'gesturechange']) {
    document.addEventListener(type, ev => ev.preventDefault(), {passive:false});
  }
  for (const type of ['touchstart', 'touchmove']) {
    document.addEventListener(type, ev => {
      if (ev.touches && ev.touches.length > 1) ev.preventDefault();
    }, {passive:false});
  }
}
document.addEventListener('dblclick', ev => {
  if (!ev.target?.closest?.('input,textarea,select,[contenteditable="true"]')) ev.preventDefault();
}, {passive:false});
/* VK198 FIXED_VIEW_END */
window.addEventListener('pagehide',()=>{ /* Daten sind nach jeder Eingabe verschlüsselt gespeichert. */ });
if('serviceWorker' in navigator && location.protocol==='https:'){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!vkApprovedUpdateReload){/* Kein automatischer Reload während Eingabe oder Verschlüsselung. */return;}saveQueue.then(()=>location.reload()).catch(()=>toast('Update aufgeschoben: letzter Speichervorgang fehlgeschlagen.'));})}
init();
})();
