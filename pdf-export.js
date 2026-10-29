/* VitalKompass PDF export – offline; no external service or fonts.
   Generates A4 PDF 1.4 using the standard Helvetica fonts (WinAnsi encoding).
   The PDF includes textual report content and tables with page breaks.
   Charts remain in the interactive app / browser-print alternative. */
'use strict';
(() => {
  const PW=595.28, PH=841.89, LM=46, RM=46, TOP=58, BOT=53;
  const usable=PW-LM-RM;
  function safeText(s){
    return String(s??'').replace(/\u00a0/g,' ').replace(/[\u200b-\u200f\ufeff]/g,'')
      .replace(/[\u2190-\u2199]/g,' -> ').replace(/[\u2264]/g,'<=')
      .replace(/[\u2265]/g,'>=').replace(/[\u2260]/g,'!=')
      .replace(/[\u2212\u2012-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'")
      .replace(/[\u201c\u201d]/g,'"').replace(/[\u2022\u25cf\u25cb\u25a0]/g,'-')
      .replace(/\u00b5/g,'µ').replace(/[\u00b7]/g,'-')
      .replace(/[\u2026]/g,'...').replace(/[\t\r\n ]+/g,' ').trim();
  }
  const textOf=n=>safeText(n?.textContent||'');
  function collect(html){
    const doc=new DOMParser().parseFromString('<main>'+html+'</main>','text/html');
    const blocks=[];
    function add(type,value){if(value)blocks.push({type,value})}
    function walk(el){
      if(el.nodeType!==1)return;
      if(el.matches('button,script,style,svg,canvas,noscript,[aria-hidden="true"]'))return;
      const tag=el.tagName.toLowerCase();
      if(/^h[1-6]$/.test(tag)){add('heading',textOf(el));return}
      if(tag==='table'){
        const labels=[...el.querySelectorAll('thead th')].map(textOf);
        for(const row of el.querySelectorAll('tbody tr')){
          const cells=[...row.querySelectorAll('th,td')].map(textOf);
          if(!cells.length)continue;
          add('table',cells.map((c,i)=>labels[i]&&labels[i].length<40?`${labels[i]}: ${c}`:c).join('   |   '));
        }
        return;
      }
      if(el.classList.contains('chartwrap')){const svg=el.querySelector('svg');if(svg)blocks.push({type:'chart',svg:svg.outerHTML});return}
      if(el.classList.contains('legend')){add('paragraph','Legende: '+textOf(el));return}
      if(el.classList.contains('metric')){add('metric',textOf(el));return}
      if(['p','li','summary','label','strong','b'].includes(tag)){add(tag==='li'?'bullet':'paragraph',textOf(el));return}
      if(tag==='a'){add('paragraph',textOf(el));return}
      if(el.classList.contains('chip')||el.classList.contains('status-pill'))return;
      const children=[...el.children];
      if(!children.length){if(['div','section','article'].includes(tag))add('paragraph',textOf(el));return}
      for(const node of el.childNodes){if(node.nodeType===3){add('paragraph',safeText(node.textContent))}else if(node.nodeType===1)walk(node)}
    }
    for(const el of [...doc.querySelector('main').children])walk(el);
    return blocks;
  }
  // Helvetica's built-in PDF font uses WinAnsi. Normalize unsupported chars;
  // preserve German umlauts and ß as Latin-1 bytes.
  const mappings={0x20ac:128,0x201a:130,0x0192:131,0x201e:132,0x2020:134,0x2021:135,0x02c6:136,0x2030:137,0x0160:138,0x2039:139,0x0152:140,0x017d:142,0x2018:145,0x2019:146,0x201c:147,0x201d:148,0x2022:149,0x2013:150,0x2014:151,0x02dc:152,0x2122:153,0x0161:154,0x203a:155,0x0153:156,0x017e:158,0x0178:159};
  function win(s){
    let x='';for(const ch of String(s)){
      const u=ch.codePointAt(0);let v=u<256?u:mappings[u];
      if(!Number.isInteger(v)||v===0||v<32&&v!==9)v=63;
      if(v===40||v===41||v===92)x+='\\'+String.fromCharCode(v);
      else if(v<32||v>=127)x+='\\'+v.toString(8).padStart(3,'0');
      else x+=String.fromCharCode(v);
    }return x;
  }
  const widthOf=(s,font=10)=>Array.from(s).reduce((w,ch)=>w+(ch===' '?0.28:/[il\.,:;'!\|]/.test(ch)?0.27:/[MW@]/.test(ch)?0.82:0.53)*font,0);
  function wrap(text,font,limit){
    const words=safeText(text).split(/\s+/).filter(Boolean);
    const lines=[];let line='';
    for(let word of words){
      while(widthOf(word,font)>limit){let i=Math.max(1,Math.floor(limit/(font*.57)));while(i>1&&widthOf(word.slice(0,i),font)>limit)i--;
        const part=word.slice(0,i);if(line){lines.push(line);line=''}lines.push(part);word=word.slice(i);
      }
      const next=line?line+' '+word:word;
      if(widthOf(next,font)<=limit)line=next;
      else{if(line)lines.push(line);line=word}
    }
    if(line)lines.push(line);return lines.length?lines:[' '];
  }
  const pdfcolor={ink:'0.09 0.18 0.29',muted:'0.32 0.40 0.49',blue:'0.07 0.37 0.62'};
  function create(html,title){
    const entries=collect(html);const pages=[];let lines=[],y=PH-TOP;
    function newPage(){if(lines.length){pages.push(lines)}lines=[];y=PH-TOP}
    function put(txt,{size=10,bold=false,space=4,color='ink',left=LM}={}){
      const max=PW-left-RM,arr=wrap(txt,size,max),height=(size+4)*arr.length+space;
      if(y-height<BOT&&lines.length)newPage();
      for(const line of arr){if(y<size+BOT){newPage()}
        lines.push(`BT /${bold?'F2':'F1'} ${size.toFixed(2)} Tf ${pdfcolor[color]||pdfcolor.ink} rg 1 0 0 1 ${left} ${y.toFixed(2)} Tm (${win(line)}) Tj ET`);
        y-=size+4;
      }y-=space;
    }
    function drawChart(svgMarkup){
      const doc=new DOMParser().parseFromString(svgMarkup,'image/svg+xml');const svg=doc.querySelector('svg');if(!svg)return;
      const vb=(svg.getAttribute('viewBox')||'0 0 700 295').split(/[,\s]+/).map(Number);
      const vw=vb[2]||700,vh=vb[3]||295,scale=Math.min(usable/vw,0.78),height=vh*scale;
      if(y-height-12<BOT&&lines.length)newPage();
      const originX=LM+(usable-vw*scale)/2,originY=y;
      const xx=x=>originX+(Number(x)||0)*scale;
      const yy=v=>originY-(Number(v)||0)*scale;
      const rgb=color=>{const m=/^#?([0-9a-f]{6})$/i.exec(color||'');if(!m)return '0.33 0.44 0.55';return [1,3,5].map(i=>(parseInt(m[1].slice(i-1,i+1),16)/255).toFixed(3)).join(' ')};
      const stroke=(element,defaultWidth=1)=>{
        const col=rgb(element.getAttribute('stroke')||'#5f7995');
        const w=(parseFloat(element.getAttribute('stroke-width'))||defaultWidth)*scale;
        lines.push(`${col} RG ${Math.max(.5,w).toFixed(2)} w`);
        lines.push(element.hasAttribute('stroke-dasharray')?'[4 3] 0 d':'[] 0 d');
      };
      for(const el of svg.children){
        const t=el.tagName.toLowerCase();
        if(t==='line'){
          stroke(el);lines.push(`${xx(el.getAttribute('x1')).toFixed(2)} ${yy(el.getAttribute('y1')).toFixed(2)} m ${xx(el.getAttribute('x2')).toFixed(2)} ${yy(el.getAttribute('y2')).toFixed(2)} l S`);
        }else if(t==='polyline'){
          const points=(el.getAttribute('points')||'').trim().split(/\s+/).map(pair=>pair.split(',').map(Number)).filter(a=>a.length===2&&a.every(Number.isFinite));
          if(points.length){stroke(el,2);lines.push(`${xx(points[0][0]).toFixed(2)} ${yy(points[0][1]).toFixed(2)} m ${points.slice(1).map(a=>`${xx(a[0]).toFixed(2)} ${yy(a[1]).toFixed(2)} l`).join(' ')} S`)}
        }else if(t==='circle'){
          const cx=xx(el.getAttribute('cx')),cy=yy(el.getAttribute('cy')),r=(parseFloat(el.getAttribute('r'))||3)*scale,k=.552284749831;
          lines.push(`${rgb(el.getAttribute('fill')||'#185f9b')} rg ${cx+r} ${cy} m ${cx+r} ${cy+k*r} ${cx+k*r} ${cy+r} ${cx} ${cy+r} c ${cx-k*r} ${cy+r} ${cx-r} ${cy+k*r} ${cx-r} ${cy} c ${cx-r} ${cy-k*r} ${cx-k*r} ${cy-r} ${cx} ${cy-r} c ${cx+k*r} ${cy-r} ${cx+r} ${cy-k*r} ${cx+r} ${cy} c f`);
        }else if(t==='text'){
          const txt=safeText(el.textContent);if(!txt)continue;
          const svgSize=parseFloat(el.getAttribute('font-size'))||11;const fs=Math.max(8.0,Math.min(11.5,svgSize*scale+1.7));let tx=xx(el.getAttribute('x'));
          const align=el.getAttribute('text-anchor');if(align==='middle')tx-=widthOf(txt,fs)/2;else if(align==='end')tx-=widthOf(txt,fs);
          lines.push(`BT /F1 ${fs.toFixed(2)} Tf ${rgb(el.getAttribute('fill')||'#567085')} rg 1 0 0 1 ${tx.toFixed(2)} ${yy(el.getAttribute('y')).toFixed(2)} Tm (${win(txt)}) Tj ET`);
        }
      }
      lines.push('[] 0 d');y-=height+14;
    }
    put('VITALKOMPASS  |  GESUNDHEITSBERICHT',{size:10,bold:true,color:'blue',space:14});
    put(title||'Gesundheitsbericht',{size:19,bold:true,space:12});
    put('Dokumentation - keine ärztliche Diagnose. Vertraulich. Nur für den eigenen Gebrauch.',{size:9,color:'muted',space:18});
    for(const entry of entries){
      if(entry.type==='chart'){drawChart(entry.svg)}
      else if(entry.type==='heading')put(entry.value,{size:12,bold:true,color:'blue',space:9});
      else if(entry.type==='metric')put(entry.value,{size:11,bold:true,space:10});
      else if(entry.type==='table')put(entry.value,{size:9,space:6,left:LM+5});
      else if(entry.type==='bullet')put('- '+entry.value,{size:10,space:5});
      else put(entry.value,{size:10,space:8});
    }
    if(lines.length)pages.push(lines);
    // Deterministic PDF object offsets in binary Latin-1 byte strings.
    const objs=[null];const add=s=>{objs.push(s);return objs.length-1};
    const catalogId=add('');const pagesId=add('');
    const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const ids=[];
    pages.forEach((commands,i)=>{
      commands.push(`BT /F1 8 Tf ${pdfcolor.muted} rg 1 0 0 1 ${LM} 27 Tm (${win('VitalKompass - vertraulich')}) Tj ET`);
      commands.push(`BT /F1 8 Tf ${pdfcolor.muted} rg 1 0 0 1 480 27 Tm (${win(`${i+1} / ${pages.length}`)}) Tj ET`);
      const stream=commands.join('\n')+'\n';
      const contId=add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
      ids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contId} 0 R >>`));
    });
    objs[catalogId]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId]=`<< /Type /Pages /Kids [${ids.map(v=>v+' 0 R').join(' ')}] /Count ${ids.length} >>`;
    let result='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];
    for(let i=1;i<objs.length;i++){offsets.push(result.length);result+=`${i} 0 obj\n${objs[i]}\nendobj\n`}
    const xref=result.length;result+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for(let i=1;i<objs.length;i++)result+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
    result+=`trailer\n<< /Size ${objs.length} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes=new Uint8Array(result.length);for(let i=0;i<result.length;i++)bytes[i]=result.charCodeAt(i)&255;
    return new Blob([bytes],{type:'application/pdf'});
  }
  Object.defineProperty(window,'VitalPDF',{value:{create},configurable:false});
})();
