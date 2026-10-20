#!/usr/bin/env python3
"""Isolated JavaScript regression test of the actual generated weight submit branch.
Uses synthetic, non-personal test measurements. Does not contact the network.
"""
from pathlib import Path
import subprocess
import sys
import tempfile

p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
a="if(form.id==='weight-form'){\n if(weightSaveInProgress)return;"
b="if(form.id==='glucose-form'){"
if s.count(a)!=1 or s.count(b)!=1:
    raise SystemExit('Weight test: expected form handler not uniquely present.')
branch=s[s.index(a):s.index(b)].rstrip()
code=r'''
'use strict';
const assert=require('node:assert/strict');
let data={weights:[],profile:{weight:''}};
let weightSaveInProgress=false;
let saveFails=false;
let delayNext=false;
let unblock=null;
let persisted=[];
let renders=0;
const today=()=> '2026-10-20';
const now=()=> '10:30';
const nval=v=>v===null||v===undefined||v===''?NaN:Number(String(v).replace(',','.'));
const dateValid=x=>/^\d{4}-\d{2}-\d{2}$/.test(x);
const timeValid=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
const bpMealLabels={before_breakfast:'Vor dem Frühstück',after_breakfast:'Nach dem Frühstück',before_lunch:'Vor dem Mittagessen',after_lunch:'Nach dem Mittagessen',before_dinner:'Vor dem Abendessen',after_dinner:'Nach dem Abendessen'};
const id=()=>String(Math.round(Math.random()*1e15));
const sortdate=(a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
const nf=(x,n)=>Number(x).toFixed(n);
function syncProfileWeight(){const last=[...data.weights].sort(sortdate).at(-1);data.profile.weight=last?String(last.kg):''}
async function save(){
 if(delayNext){await new Promise(resolve=>{unblock=resolve;})}
 if(saveFails)throw Error('simulierter IndexedDB-Speicherfehler');
 persisted.push(JSON.parse(JSON.stringify(data)));
}
function renderMain(){renders++}
function toast(){}
async function submit(values){
 const form={id:'weight-form'};
 const f={get:k=>Object.prototype.hasOwnProperty.call(values,k)?values[k]:''};
 __INSERT_HANDLER__
}
function event(kg,id=''){return {id,kg,date:'2026-10-20',time:'10:30',mealTiming:'before_breakfast',note:''}}
(async()=>{
 await submit(event('130,5'));
 assert.equal(data.weights.length,1);assert.equal(data.weights[0].kg,130.5);assert.equal(data.profile.weight,'130.5');
 await submit(event('131.2'));
 assert.equal(data.weights.length,2);assert.equal(data.weights[1].kg,131.2);
 const first=data.weights[0].id;
 await submit(event('129,8',first));
 assert.equal(data.weights.length,2);assert.equal(data.weights[0].kg,129.8);
 for (const v of ['','falsch','19,9','400,1']) {
  await assert.rejects(()=>submit(event(v)));
  assert.equal(data.weights.length,2);
 }
 await assert.rejects(()=>submit({...event('125,1'),date:'2026-10-21'}), /Datum/);
 saveFails=true;
 const prior=JSON.stringify(data);
 await assert.rejects(()=>submit(event('128,4')),/simulierter IndexedDB/);
 assert.equal(JSON.stringify(data),prior, 'Fehlgeschlagener Speicherversuch darf nur temporären Wert verändern');
 saveFails=false;
 delayNext=true;
 const inFlight=submit(event('130,0'));
 assert.equal(weightSaveInProgress,true);
 await submit(event('140,0'));
 assert.equal(data.weights.length,3,'Gleichzeitiger zweiter Klick darf keinen Duplikateintrag anlegen');
 assert.equal(data.weights[2].kg,130);
 unblock(); await inFlight;delayNext=false;
 assert.equal(weightSaveInProgress,false);
 assert.ok(persisted.length>=4);
 console.log('Gewichtsspeicherung: DE-Komma, Punkt, Bearbeiten, Validierung, Rollback und Doppeltippen OK');
})().catch(e=>{console.error(e);process.exitCode=1});
'''.replace('__INSERT_HANDLER__',branch)
with tempfile.TemporaryDirectory() as directory:
    file=Path(directory)/'weight-test.js'
    file.write_text(code,encoding='utf-8')
    subprocess.run(['node','--check',str(file)],check=True)
    subprocess.run(['node',str(file)],check=True)
