// @ts-nocheck
'use client';
import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from "recharts";

const C0="#0d1117",C1="#161b22",C2="#21262d",CT="#cdd9e5";
const GRN="#00CC00",RED="#CC0000",ORG="#ffa500",BLU="#58a6ff";
const POWER=["11:00","12:30","13:15","13:30","15:00"];
const AVOID=["9:45","10:15","10:30","10:45","11:45","14:45"];
const clrN=n=>n>0?GRN:n<0?RED:"#888";
const fmt=(n,d=0)=>n==null||isNaN(n)?"—":(+n).toFixed(d);
const pct=n=>n==null||isNaN(n)?"—":(n*100).toFixed(1)+"%";
const nz=(v,d=0)=>v==null||isNaN(v)?d:v;

function calcEMA(src,p){
  const k=2/(p+1),o=src.map(()=>NaN);let pv=NaN;
  src.forEach((v,i)=>{if(isNaN(v))return;o[i]=isNaN(pv)?v:v*k+pv*(1-k);pv=o[i];});
  return o;
}
function calcRMA(src,p){
  const o=src.map(()=>NaN);let st=false,pv=NaN,cnt=0,s=0;
  for(let i=0;i<src.length;i++){
    if(isNaN(src[i]))continue;
    if(!st){s+=src[i];cnt++;if(cnt===p){st=true;pv=s/p;o[i]=pv;}}
    else{o[i]=(pv*(p-1)+src[i])/p;pv=o[i];}
  }return o;
}
function calcST(H,L,C,p=21,m=1){
  const n=C.length;
  const tr=C.map((_,i)=>i===0?H[i]-L[i]:Math.max(H[i]-L[i],Math.abs(H[i]-C[i-1]),Math.abs(L[i]-C[i-1])));
  const atr=calcRMA(tr,p);
  const fU=Array(n).fill(NaN),fL=Array(n).fill(NaN),dir=Array(n).fill(1),st=Array(n).fill(NaN);
  for(let i=1;i<n;i++){
    if(isNaN(atr[i]))continue;
    const hl2=(H[i]+L[i])/2,bU=hl2+m*atr[i],bL=hl2-m*atr[i];
    fU[i]=(isNaN(fU[i-1])||bU<fU[i-1]||C[i-1]>fU[i-1])?bU:fU[i-1];
    fL[i]=(isNaN(fL[i-1])||bL>fL[i-1]||C[i-1]<fL[i-1])?bL:fL[i-1];
    if(isNaN(st[i-1]))dir[i]=1;
    else if(st[i-1]===fU[i-1])dir[i]=C[i]<=fU[i]?1:-1;
    else dir[i]=C[i]>=fL[i]?-1:1;
    st[i]=dir[i]===1?fU[i]:fL[i];
  }
  return{st,dir};
}
function calcSaha(hlc3,tr){
  const o=Array(hlc3.length).fill(NaN);
  let v1=0,v2=0,v3=nz(hlc3[0]);o[0]=v3;
  for(let i=1;i<hlc3.length;i++){
    v1=0.2*(hlc3[i]-hlc3[i-1])+0.8*v1;
    v2=0.1*nz(tr[i])+0.8*v2;
    const lam=v2?Math.abs(v1/v2):0;
    const alp=(-lam*lam+Math.sqrt(Math.pow(lam,4)+16*lam*lam))/8;
    v3=alp*hlc3[i]+(1-alp)*v3;o[i]=v3;
  }return o;
}
function calcShema(src,p){
  const lag=Math.round((p-1)/2);
  const ed=src.map((v,i)=>i>=lag&&!isNaN(v)&&!isNaN(src[i-lag])?v+(v-src[i-lag]):NaN);
  return calcEMA(ed,p);
}
function buildBars(raw){
  const H=raw.map(b=>b.high),L=raw.map(b=>b.low),C=raw.map(b=>b.close);
  const hlc3=raw.map(b=>(b.high+b.low+b.close)/3);
  const tr=C.map((_,i)=>i===0?H[i]-L[i]:Math.max(H[i]-L[i],Math.abs(H[i]-C[i-1]),Math.abs(L[i]-C[i-1])));
  const e5=calcEMA(C,5),saha=calcShema(calcSaha(hlc3,tr),5);
  const{st,dir}=calcST(H,L,C,21,1);
  return raw.map((b,i)=>({...b,e5:e5[i],saha:saha[i],st:st[i],dir:dir[i],isBull:dir[i]<0,isBear:dir[i]>0,chg:i>0&&dir[i]!==dir[i-1]}));
}
function runSM(bars){
  let state="INIT",prevST=NaN,bkH=NaN,bkL=NaN,lBFH=NaN,lBFL=NaN,lSFH=NaN,lSFL=NaN;
  return bars.map((b,i)=>{
    if(i===0)return{...b,col:"GREY",sig:0,sd:null};
    const{high:H,low:L,close:C,isBull,isBear,chg,e5,saha}=b;
    let col="GREY",dBull=false,dBear=false,tH=H,tL=L;
    if(chg){prevST=bars[i-1].st;if(isBear){lBFH=H;lBFL=L;}if(isBull){lSFH=H;lSFL=L;}}
    if(state==="INIT"){
      if(isBull&&e5>saha){state="BULL";col="GREEN";}
      else if(isBear&&e5<saha){state="BEAR";col="RED";}
    }else if(state==="BULL"){
      col="GREEN";
      if(isBear){bkH=chg?H:nz(lBFH,H);bkL=chg?L:nz(lBFL,L);state="BREAK_B";col="GREY";}
    }else if(state==="BREAK_B"){
      if(isBull){bkH=chg?H:nz(lSFH,H);bkL=chg?L:nz(lSFL,L);state="BREAK_S";}
      else if(C<bkL&&e5<saha&&!isNaN(prevST)&&e5<prevST){state="BEAR";col="RED";dBear=true;tH=bkH;tL=bkL;}
    }else if(state==="BEAR"){
      col="RED";
      if(isBull){bkH=chg?H:nz(lSFH,H);bkL=chg?L:nz(lSFL,L);state="BREAK_S";col="GREY";}
    }else if(state==="BREAK_S"){
      if(isBear){bkH=chg?H:nz(lBFH,H);bkL=chg?L:nz(lBFL,L);state="BREAK_B";}
      else if(C>bkH&&e5>saha&&!isNaN(prevST)&&e5>prevST){state="BULL";col="GREEN";dBull=true;tH=bkH;tL=bkL;}
    }
    if(!chg){
      if(col==="GREEN"&&!isNaN(bars[i-1].low)&&bars[i-1].low>C)col="ORANGE";
      if(col==="RED"&&!isNaN(bars[i-1].high)&&bars[i-1].high<C)col="BLUE";
    }
    let sd=null;
    if(dBull||dBear){
      const rng=tH-tL,risk=1.618*rng,d=dBull?1:-1;
      const entry=dBull?tH:tL,sl=dBull?entry-risk:entry+risk;
      const t1=dBull?entry+0.76*risk:entry-0.76*risk;
      const t2=dBull?entry+1.2*risk:entry-1.2*risk;
      const t3=dBull?entry+1.6*risk:entry-1.6*risk;
      const t4=dBull?entry+2.6*risk:entry-2.6*risk;
      const dt=new Date(b.time);
      sd={d,entry,sl,t1,t2,t3,t4,rng,risk,hr:dt.getHours(),mn:dt.getMinutes()};
    }
    return{...b,col,sig:dBull?1:dBear?-1:0,sd};
  });
}
function simulate(bars){
  const trades=[];
  for(let i=0;i<bars.length-1;i++){
    const b=bars[i];if(!b.sd)continue;
    const{d,entry,sl,t1,t2,t3,t4,hr,mn}=b.sd;
    const ae=bars[i+1].open;
    const d2t1=Math.abs(t1-entry)||1;
    const distRatio=d===1?(ae-entry)/d2t1:(entry-ae)/d2t1;
    let tHit=0,tsl=sl,exitP=NaN,exitR="",exitI=-1;
    for(let j=i+1;j<bars.length&&j<i+300;j++){
      const bb=bars[j];
      if(d===1){
        if(bb.low<=tsl){exitP=tsl;exitR=tHit>0?`Trail-T${tHit}`:"SL";exitI=j;break;}
        if(tHit===0&&bb.high>=t1){tHit=1;tsl=ae;}
        if(tHit===1&&bb.high>=t2){tHit=2;tsl=t1;}
        if(tHit===2&&bb.high>=t3){tHit=3;tsl=t2;}
        if(tHit===3&&bb.high>=t4){tHit=4;exitP=t4;exitR="T4";exitI=j;break;}
      }else{
        if(bb.high>=tsl){exitP=tsl;exitR=tHit>0?`Trail-T${tHit}`:"SL";exitI=j;break;}
        if(tHit===0&&bb.low<=t1){tHit=1;tsl=ae;}
        if(tHit===1&&bb.low<=t2){tHit=2;tsl=t1;}
        if(tHit===2&&bb.low<=t3){tHit=3;tsl=t2;}
        if(tHit===3&&bb.low<=t4){tHit=4;exitP=t4;exitR="T4";exitI=j;break;}
      }
    }
    if(isNaN(exitP)){const li=Math.min(i+299,bars.length-1);exitP=bars[li].close;exitR="Time";exitI=li;}
    const pnl=d===1?exitP-ae:ae-exitP,riskPts=Math.abs(ae-sl);
    const dt=new Date(b.time);
    trades.push({
      i,d,entry,sl,t1,t2,t3,t4,ae,exitP,exitR,exitI,tHit,pnl,
      rr:riskPts>0?pnl/riskPts:0,distRatio,hr,mn,win:pnl>0,
      timeStr:`${hr}:${String(mn).padStart(2,"0")}`,
      dl:d===1?"BULL":"BEAR",
      date:new Date(b.time).toLocaleDateString("en-IN"),
      mk:`${dt.getMonth()+1}/${dt.getFullYear()}`,
    });
  }
  return trades;
}
function calcStats(t){
  if(!t||!t.length)return null;
  const W=t.filter(x=>x.win),L=t.filter(x=>!x.win);
  const sum=a=>a.reduce((s,x)=>s+x.pnl,0);
  let peak=0,dd=0,cum=0;
  t.forEach(x=>{cum+=x.pnl;if(cum>peak)peak=cum;dd=Math.min(dd,cum-peak);});
  return{n:t.length,W:W.length,L:L.length,wr:W.length/t.length,
    tot:sum(t),avg:sum(t)/t.length,avgW:W.length?sum(W)/W.length:0,avgL:L.length?sum(L)/L.length:0,
    rr:t.reduce((s,x)=>s+x.rr,0)/t.length,
    tH:[0,1,2,3,4].map(n=>t.filter(x=>x.tHit>=n).length),dd,data:t};
}
function applyFilt(trades,f){
  let t=[...trades];
  if(f.dist!=null)t=t.filter(x=>x.distRatio<=f.dist);
  if(f.h0!=null)t=t.filter(x=>x.hr>=f.h0);
  if(f.h1!=null)t=t.filter(x=>x.hr<=f.h1);
  if(f.dir&&f.dir!=="ALL")t=t.filter(x=>x.dl===f.dir);
  return t;
}
function parseCSV(txt){
  const lines=txt.trim().split("\n").map(l=>l.replace(/\r/g,""));
  const hdr=lines[0].toLowerCase().split(",").map(h=>h.trim().replace(/['"]/g,""));
  const fi=(...ns)=>{for(const n of ns){const i=hdr.findIndex(h=>h.includes(n));if(i>=0)return i;}return -1;};
  const tI=fi("time","date"),oI=fi("open"),hI=fi("high"),lI=fi("low"),cI=fi("close");
  if([oI,hI,lI,cI].some(x=>x<0))throw new Error("Cannot find OHLC columns.");
  const bars=[];
  for(let i=1;i<lines.length;i++){
    const c=lines[i].split(",");if(c.length<4)continue;
    const[o,h,l,cl]=[oI,hI,lI,cI].map(x=>parseFloat(c[x]));
    if([o,h,l,cl].some(isNaN))continue;
    let ts=i*900000;
    if(tI>=0){const tv=c[tI].trim().replace(/['"]/g,"");
      if(/^\d{10}$/.test(tv))ts=+tv*1000;
      else if(/^\d{13}$/.test(tv))ts=+tv;
      else{const d=new Date(tv);if(!isNaN(d.getTime()))ts=d.getTime();}
    }
    bars.push({time:ts,open:o,high:h,low:l,close:cl});
  }
  return bars.sort((a,b)=>a.time-b.time);
}

/* ── shared UI ── */
const Card=({label,val,sub,c=CT})=>(
  <div style={{background:C1,borderRadius:8,padding:"11px 13px",border:`1px solid ${C2}`}}>
    <div style={{color:"#888",fontSize:10,marginBottom:3}}>{label}</div>
    <div style={{color:c,fontSize:17,fontWeight:"bold"}}>{val}</div>
    {sub&&<div style={{color:"#888",fontSize:10,marginTop:3}}>{sub}</div>}
  </div>
);
const TT=props=><Tooltip contentStyle={{background:C1,border:`1px solid ${C2}`,fontSize:10,color:CT}} {...props}/>;
const StatsRow=({s})=>!s?null:(
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:6,marginBottom:12}}>
    <Card label="TRADES" val={s.n} sub={`${s.W}W / ${s.L}L`}/>
    <Card label="WIN RATE" val={pct(s.wr)} c={s.wr>=0.5?GRN:RED}/>
    <Card label="TOTAL P&L" val={`${fmt(s.tot,0)} pts`} c={clrN(s.tot)}/>
    <Card label="AVG P&L" val={`${fmt(s.avg,0)} pts`} c={clrN(s.avg)}/>
    <Card label="AVG WIN" val={`${fmt(s.avgW,0)} pts`} c={GRN}/>
    <Card label="AVG LOSS" val={`${fmt(s.avgL,0)} pts`} c={RED}/>
    <Card label="AVG R:R" val={fmt(s.rr,2)} c={s.rr>=1?GRN:ORG}/>
    <Card label="MAX DD" val={`${fmt(s.dd,0)} pts`} c={RED}/>
  </div>
);

/* ── Trades Tab ── */
function TradesTab({trades}){
  const[tDir,setTDir]=useState("ALL");
  const[tExit,setTExit]=useState("ALL");
  const[tDist,setTDist]=useState("ALL");
  const[tTime,setTTime]=useState("ALL");
  const[sKey,setSKey]=useState("i");
  const[sAsc,setSAsc]=useState(true);
  const[showCSV,setShowCSV]=useState(false);
  const[copied,setCopied]=useState(false);

  const filtered=useMemo(()=>{
    let t=[...trades];
    if(tDir!=="ALL")t=t.filter(x=>x.dl===tDir);
    if(tExit==="SL")t=t.filter(x=>x.exitR==="SL");
    else if(tExit==="Trail-T1")t=t.filter(x=>x.exitR==="Trail-T1");
    else if(tExit==="Trail-T2")t=t.filter(x=>x.exitR==="Trail-T2");
    else if(tExit==="Trail-T3")t=t.filter(x=>x.exitR==="Trail-T3");
    else if(tExit==="T4")t=t.filter(x=>x.exitR==="T4");
    else if(tExit==="Time")t=t.filter(x=>x.exitR==="Time");
    if(tDist==="0-25")t=t.filter(x=>x.distRatio<0.25);
    else if(tDist==="25-50")t=t.filter(x=>x.distRatio>=0.25&&x.distRatio<0.5);
    else if(tDist==="50-75")t=t.filter(x=>x.distRatio>=0.5&&x.distRatio<0.75);
    else if(tDist==="75-100")t=t.filter(x=>x.distRatio>=0.75&&x.distRatio<1.0);
    else if(tDist==="100+")t=t.filter(x=>x.distRatio>=1.0);
    if(tTime==="POWER")t=t.filter(x=>POWER.includes(x.timeStr));
    else if(tTime==="AVOID")t=t.filter(x=>AVOID.includes(x.timeStr));
    else if(tTime==="OPEN")t=t.filter(x=>x.hr>=9&&x.hr<10);
    else if(tTime==="MID")t=t.filter(x=>x.hr>=11&&x.hr<14);
    else if(tTime==="CLOSE")t=t.filter(x=>x.hr>=14);
    t.sort((a,b)=>sAsc?(a[sKey]>b[sKey]?1:-1):(a[sKey]<b[sKey]?1:-1));
    return t;
  },[trades,tDir,tExit,tDist,tTime,sKey,sAsc]);

  const fS=useMemo(()=>{try{return calcStats(filtered);}catch(e){return null;}},[filtered]);

  const csvText=useMemo(()=>{
    const h=["No","Dir","Date","Time","Sig_Entry","Act_Entry","SL","T1","T2","T3","T4","Exit","T_Hit","PnL","RR","Dist_pct","Exit_Reason","Result"];
    const r=filtered.map((t,i)=>[i+1,t.dl,t.date,t.timeStr,
      t.entry.toFixed(0),t.ae.toFixed(0),t.sl.toFixed(0),
      t.t1.toFixed(0),t.t2.toFixed(0),t.t3.toFixed(0),t.t4.toFixed(0),
      t.exitP.toFixed(0),"T"+t.tHit,t.pnl.toFixed(0),t.rr.toFixed(2),
      (t.distRatio*100).toFixed(0),t.exitR,t.win?"WIN":"LOSS"]);
    return[h,...r].map(x=>x.join(",")).join("\n");
  },[filtered]);

  const copyAll=useCallback(()=>{
    navigator.clipboard.writeText(csvText).then(()=>{
      setCopied(true);setTimeout(()=>setCopied(false),2500);
    }).catch(()=>{
      const el=document.getElementById("csvTA");
      if(el){el.select();document.execCommand("copy");setCopied(true);setTimeout(()=>setCopied(false),2500);}
    });
  },[csvText]);

  const FILTERS=[
    {label:"Direction",opts:[["ALL","ALL"],["BULL","▲ BULL"],["BEAR","▼ BEAR"]],val:tDir,set:setTDir,ac:v=>v==="BULL"?GRN:v==="BEAR"?RED:GRN},
    {label:"Exit Type",opts:[["ALL","All"],["SL","SL Hit"],["Trail-T1","Trail-T1"],["Trail-T2","Trail-T2"],["Trail-T3","Trail-T3"],["T4","T4 Full"],["Time","Time"]],val:tExit,set:setTExit,ac:v=>v==="SL"?RED:v==="T4"?GRN:ORG},
    {label:"Entry Dist",opts:[["ALL","All"],["0-25","0-25%"],["25-50","25-50%"],["50-75","50-75%"],["75-100","75-100%"],["100+",">100%"]],val:tDist,set:setTDist,ac:()=>ORG},
    {label:"Time",opts:[["ALL","All"],["POWER","Power⭐"],["AVOID","Avoid🚫"],["OPEN","Opening"],["MID","Mid-day"],["CLOSE","Closing"]],val:tTime,set:setTTime,ac:v=>v==="POWER"?GRN:v==="AVOID"?RED:ORG},
  ];
  const COLS=[["i","#"],["dl","Dir"],["date","Date"],["timeStr","Time"],["entry","Sig.Ent"],["ae","Act.Ent"],["sl","SL"],["t1","T1"],["exitP","Exit"],["tHit","T-Hit"],["pnl","P&L"],["rr","R:R"],["distRatio","Dist%"],["exitR","Reason"]];

  return(
    <div style={{padding:14}}>
      {showCSV&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",flexDirection:"column",padding:10}}>
          <div style={{background:C1,borderRadius:10,border:`1px solid ${C2}`,display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${C2}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{color:GRN,fontWeight:"bold"}}>📋 CSV Export — {filtered.length} trades</span>
              <span style={{color:"#666",fontSize:10,flex:1}}>Copy → Notepad → Save as trades.csv → Open Excel</span>
              <button onClick={copyAll} style={{background:copied?GRN:BLU,color:"#000",border:"none",padding:"6px 14px",borderRadius:5,cursor:"pointer",fontSize:11,fontWeight:"bold",fontFamily:"monospace"}}>{copied?"✅ Copied!":"📋 Copy All"}</button>
              <button onClick={()=>setShowCSV(false)} style={{background:RED,color:"#fff",border:"none",padding:"6px 12px",borderRadius:5,cursor:"pointer",fontSize:12,fontWeight:"bold",fontFamily:"monospace"}}>✕ Close</button>
            </div>
            <div style={{padding:"7px 14px",background:"#0a1220",borderBottom:`1px solid ${C2}`,fontSize:10,color:"#888"}}>
              <span style={{color:ORG,fontWeight:"bold"}}>Steps: </span>
              1. <span style={{color:BLU,fontWeight:"bold"}}>Copy All</span> → 2. Open <span style={{color:CT}}>Notepad</span> → Ctrl+V → 3. Save As <span style={{color:GRN}}>trades.csv</span> → 4. Open in <span style={{color:CT}}>Excel</span> → Data → Filter
            </div>
            <textarea id="csvTA" value={csvText} readOnly style={{flex:1,background:"#0d1117",color:"#8b9db0",border:"none",padding:12,fontSize:9,fontFamily:"monospace",resize:"none",outline:"none",lineHeight:1.5}}/>
          </div>
        </div>
      )}
      <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`,marginBottom:12}}>
        <div style={{color:BLU,fontWeight:"bold",fontSize:11,marginBottom:10}}>🔽 FILTERS</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {FILTERS.map(({label,opts,val,set,ac})=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <span style={{color:"#888",fontSize:10,minWidth:80}}>{label}:</span>
              {opts.map(([v,l])=>(
                <button key={v} onClick={()=>set(v)} style={{padding:"3px 9px",borderRadius:10,border:"none",cursor:"pointer",fontSize:10,fontFamily:"monospace",whiteSpace:"nowrap",background:val===v?ac(v):C2,color:val===v?"#000":CT,fontWeight:val===v?"bold":"normal"}}>{l}</button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {fS&&<StatsRow s={fS}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:11,color:"#888"}}>Showing <strong style={{color:ORG}}>{filtered.length}</strong> / {trades.length} trades</span>
        <button onClick={()=>setShowCSV(true)} style={{background:GRN,color:"#000",border:"none",padding:"8px 16px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:"bold",fontFamily:"monospace"}}>📋 Export CSV ({filtered.length} trades)</button>
      </div>
      <div style={{overflowX:"auto",borderRadius:8,border:`1px solid ${C2}`}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:780}}>
          <thead>
            <tr style={{background:C1}}>
              {COLS.map(([k,l])=>(
                <th key={k} onClick={()=>{if(sKey===k)setSAsc(a=>!a);else{setSKey(k);setSAsc(true);}}}
                  style={{padding:"5px 7px",textAlign:"right",fontWeight:"normal",borderBottom:`1px solid ${C2}`,whiteSpace:"nowrap",cursor:"pointer",color:sKey===k?ORG:"#888",userSelect:"none"}}>
                  {l}{sKey===k?(sAsc?" ↑":" ↓"):""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${C2}15`,background:t.exitR==="SL"?"#1f0505":t.exitR==="T4"?"#051f05":i%2===0?C0:C1}}>
                <td style={{padding:"3px 7px",textAlign:"right",color:"#555"}}>{i+1}</td>
                <td style={{padding:"3px 7px",textAlign:"center",color:t.d===1?GRN:RED,fontWeight:"bold"}}>{t.dl}</td>
                <td style={{padding:"3px 7px",textAlign:"right",color:"#aaa"}}>{t.date}</td>
                <td style={{padding:"3px 7px",textAlign:"right",color:POWER.includes(t.timeStr)?GRN:AVOID.includes(t.timeStr)?RED:CT,fontWeight:POWER.includes(t.timeStr)||AVOID.includes(t.timeStr)?"bold":"normal"}}>{t.timeStr}</td>
                <td style={{padding:"3px 7px",textAlign:"right"}}>{fmt(t.entry,0)}</td>
                <td style={{padding:"3px 7px",textAlign:"right",color:BLU}}>{fmt(t.ae,0)}</td>
                <td style={{padding:"3px 7px",textAlign:"right",color:RED}}>{fmt(t.sl,0)}</td>
                <td style={{padding:"3px 7px",textAlign:"right",color:GRN}}>{fmt(t.t1,0)}</td>
                <td style={{padding:"3px 7px",textAlign:"right"}}>{fmt(t.exitP,0)}</td>
                <td style={{padding:"3px 7px",textAlign:"center",color:t.tHit>0?GRN:"#555",fontWeight:"bold"}}>T{t.tHit}</td>
                <td style={{padding:"3px 7px",textAlign:"right",color:clrN(t.pnl),fontWeight:"bold"}}>{fmt(t.pnl,0)}</td>
                <td style={{padding:"3px 7px",textAlign:"right",color:t.rr>=1?GRN:t.rr>=0?ORG:RED}}>{fmt(t.rr,2)}</td>
                <td style={{padding:"3px 7px",textAlign:"right",color:t.distRatio<0.25?"#777":t.distRatio<0.5?GRN:t.distRatio<0.75?ORG:RED}}>{(t.distRatio*100).toFixed(0)}%</td>
                <td style={{padding:"3px 7px",textAlign:"center"}}>
                  <span style={{padding:"1px 7px",borderRadius:8,fontSize:9,fontWeight:"bold",background:t.exitR==="SL"?"#3a0000":t.exitR==="T4"?"#003a00":t.exitR.startsWith("Trail")?"#2a1f00":"#0d1a2a",color:t.exitR==="SL"?RED:t.exitR==="T4"?GRN:t.exitR.startsWith("Trail")?ORG:BLU}}>{t.exitR}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:6,fontSize:10,color:"#555",textAlign:"center"}}>🟥 red=SL &nbsp;|&nbsp; 🟩 green=T4 &nbsp;|&nbsp; time <span style={{color:GRN}}>green</span>=power <span style={{color:RED}}>red</span>=avoid</div>
    </div>
  );
}

/* ── Main App ── */
export default function BacktesterPage(){
  const[trades,setTrades]=useState(null);
  const[bars,setBars]=useState(null);
  const[tab,setTab]=useState("overview");
  const[filt,setFilt]=useState({dist:0.75,h0:9,h1:14,dir:"ALL"});
  const[err,setErr]=useState(null);
  const[loading,setLoading]=useState(false);
  const fileRef=useRef();

  const loadFile=useCallback(async e=>{
    const f=e.target.files?.[0];if(!f)return;
    setLoading(true);setErr(null);
    try{
      const txt=await f.text();
      const raw=parseCSV(txt);
      if(raw.length<50)throw new Error("Too few bars — check CSV format.");
      const b2=buildBars(raw),b3=runSM(b2),tr=simulate(b3);
      setBars(b3);setTrades(tr);setTab("overview");
    }catch(ex){setErr(ex.message);}
    setLoading(false);e.target.value="";
  },[]);

  const allS=useMemo(()=>trades?calcStats(trades):null,[trades]);
  const filtS=useMemo(()=>trades?calcStats(applyFilt(trades,filt)):null,[trades,filt]);

  const timeData=useMemo(()=>{
    if(!trades)return[];
    const m={};
    trades.forEach(t=>{if(!m[t.timeStr])m[t.timeStr]={time:t.timeStr,W:0,n:0,pnl:0};m[t.timeStr].n++;if(t.win)m[t.timeStr].W++;m[t.timeStr].pnl+=t.pnl;});
    return Object.values(m).sort((a,b)=>a.time.localeCompare(b.time)).map(x=>({...x,wr:x.W/x.n}));
  },[trades]);

  const monthData=useMemo(()=>{
    if(!trades)return[];
    const m={};
    trades.forEach(t=>{if(!m[t.mk])m[t.mk]={month:t.mk,pnl:0,n:0,W:0};m[t.mk].n++;m[t.mk].pnl+=t.pnl;if(t.win)m[t.mk].W++;});
    return Object.values(m);
  },[trades]);

  const cumData=useMemo(()=>{if(!allS)return[];let c=0;return allS.data.map((t,i)=>{c+=t.pnl;return{i,c};});},[allS]);
  const filtCumData=useMemo(()=>{if(!filtS)return[];let c=0;return filtS.data.map((t,i)=>{c+=t.pnl;return{i,c};});},[filtS]);

  const distBuckets=useMemo(()=>{
    if(!trades)return[];
    return[{r:"0–25%",min:0,max:0.25},{r:"25–50%",min:0.25,max:0.5},{r:"50–75%",min:0.5,max:0.75},{r:"75–100%",min:0.75,max:1.0},{r:">100%",min:1.0,max:99}]
    .map(b=>{const t=trades.filter(x=>x.distRatio>=b.min&&x.distRatio<b.max),W=t.filter(x=>x.win);
      return{...b,n:t.length,wr:t.length?W.length/t.length:0,avg:t.length?t.reduce((s,x)=>s+x.pnl,0)/t.length:0};});
  },[trades]);

  const bestSetup=useMemo(()=>{
    if(!trades||trades.length<10)return null;
    let best=null,bestSc=-Infinity;
    for(const dist of[0.25,0.4,0.6,0.75,1.0])
      for(const h0 of[9,10])
        for(const h1 of[12,13,14,15])
          for(const dir of["ALL","BULL","BEAR"]){
            const t=applyFilt(trades,{dist,h0,h1,dir});if(t.length<5)continue;
            const s=calcStats(t);if(!s)continue;
            const sc=s.wr*45+Math.min(s.rr,5)*20+(s.avg/50)*25+(t.length/50)*10;
            if(sc>bestSc){bestSc=sc;best={...s,dist,h0,h1,dir};}
          }
    return best;
  },[trades]);

  if(!trades){
    return(
      <div style={{background:C0,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace"}}>
        <Link href="/" style={{position:"fixed",top:12,left:12,display:"flex",alignItems:"center",gap:6,background:C1,border:`1px solid ${C2}`,color:CT,padding:"6px 12px",borderRadius:6,fontSize:11,textDecoration:"none",fontFamily:"monospace",fontWeight:"bold",zIndex:100}}>← Home</Link>
        <div style={{maxWidth:460,width:"100%",padding:20}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40}}>📊</div>
            <div style={{color:GRN,fontSize:20,fontWeight:"bold",marginTop:8}}>CCC Indicator Backtester</div>
            <div style={{color:"#888",fontSize:11,marginTop:4}}>Confirmation Colour Candles • BankNifty 15m</div>
          </div>
          <label style={{display:"block",background:C1,border:`2px dashed ${C2}`,borderRadius:12,padding:32,cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:30,marginBottom:10}}>📁</div>
            <div style={{color:BLU,fontSize:14,marginBottom:6}}>Click to upload TradingView CSV</div>
            <div style={{color:"#555",fontSize:11}}>BANKNIFTY1! • 15 min • 1 year</div>
            <input type="file" accept=".csv,.txt" onChange={loadFile} style={{display:"none"}} ref={fileRef}/>
          </label>
          {loading&&<div style={{color:ORG,marginTop:16,fontSize:13,textAlign:"center"}}>⏳ Processing {bars?bars.length:""} bars…</div>}
          {err&&<div style={{color:RED,marginTop:12,fontSize:11,padding:12,background:"#1a0000",borderRadius:8}}>❌ {err}</div>}
          <div style={{marginTop:16,background:C1,padding:14,borderRadius:8,fontSize:11,color:"#888",lineHeight:1.9}}>
            <div style={{color:CT,fontWeight:"bold",marginBottom:6}}>📋 How to export from TradingView</div>
            <div>1. Open <span style={{color:ORG}}>BANKNIFTY1!</span> → 15m chart</div>
            <div>2. Right-click anywhere on the chart</div>
            <div>3. Click <span style={{color:GRN}}>"Download chart data (CSV)"</span></div>
            <div>4. Upload that file here ↑</div>
          </div>
        </div>
      </div>
    );
  }

  const TB=({id,lbl})=>(
    <button onClick={()=>setTab(id)} style={{padding:"7px 11px",borderRadius:5,border:"none",cursor:"pointer",fontSize:10,fontFamily:"monospace",whiteSpace:"nowrap",background:tab===id?GRN:C2,color:tab===id?"#000":CT,fontWeight:tab===id?"bold":"normal"}}>{lbl}</button>
  );

  return(
    <div style={{background:C0,minHeight:"100vh",color:CT,fontFamily:"monospace",fontSize:12}}>
      <div style={{background:C1,borderBottom:`1px solid ${C2}`,padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <Link href="/" style={{display:"flex",alignItems:"center",gap:4,background:"none",border:`1px solid ${C2}`,color:CT,padding:"3px 8px",borderRadius:4,fontSize:10,textDecoration:"none",fontFamily:"monospace",whiteSpace:"nowrap"}}>← Home</Link>
        <span style={{color:GRN,fontWeight:"bold",fontSize:13}}>📊 CCC Backtester</span>
        <span style={{color:"#888"}}>BankNifty 15m</span>
        <span style={{color:"#888"}}>•</span>
        <span>{bars.length.toLocaleString()} bars</span>
        <span style={{color:"#888"}}>•</span>
        <span style={{color:ORG}}>{trades.length} signals</span>
        <div style={{marginLeft:"auto",display:"flex",gap:12,fontSize:10,alignItems:"center"}}>
          <span>WR:<strong style={{color:clrN(allS.wr-0.5),marginLeft:4}}>{pct(allS.wr)}</strong></span>
          <span>P&L:<strong style={{color:clrN(allS.tot),marginLeft:4}}>{fmt(allS.tot,0)} pts</strong></span>
          <button onClick={()=>fileRef.current.click()} style={{background:"none",border:`1px solid ${BLU}`,color:BLU,padding:"3px 8px",borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>↩ Load new</button>
          <input type="file" accept=".csv" onChange={loadFile} style={{display:"none"}} ref={fileRef}/>
        </div>
      </div>

      <div style={{padding:"8px 12px",display:"flex",gap:5,borderBottom:`1px solid ${C2}`,flexWrap:"wrap"}}>
        <TB id="overview" lbl="📈 Overview"/>
        <TB id="dist"     lbl="🎯 Entry Distance"/>
        <TB id="time"     lbl="⏰ Time Analysis"/>
        <TB id="monthly"  lbl="📅 Monthly"/>
        <TB id="filter"   lbl="🔧 Filter & Optimise"/>
        <TB id="setup"    lbl="🏆 Best Setup"/>
        <TB id="trades"   lbl="📋 Trades List"/>
      </div>

      {tab==="overview"&&allS&&(
        <div style={{padding:14}}>
          <StatsRow s={allS}/>
          <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`,marginBottom:12}}>
            <div style={{color:"#888",fontSize:10,marginBottom:6}}>CUMULATIVE P&L — all {allS.n} signals (unfiltered)</div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={cumData}><YAxis tick={{fill:"#888",fontSize:9}} width={55}/><TT formatter={v=>[`${fmt(v,0)} pts`]}/><ReferenceLine y={0} stroke="#444"/><Line type="monotone" dataKey="c" dot={false} strokeWidth={1.5} stroke={allS.tot>=0?GRN:RED}/></LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`,marginBottom:12}}>
            <div style={{color:"#888",fontSize:10,marginBottom:10}}>HOW FAR DO TRADES GO?</div>
            <div style={{display:"flex",gap:10,alignItems:"flex-end",height:80}}>
              {["T1","T2","T3","T4"].map((t,n)=>{const cnt=allS.tH[n+1],p=cnt/allS.n;return(
                <div key={t} style={{flex:1,textAlign:"center"}}>
                  <div style={{color:GRN,fontSize:12,fontWeight:"bold"}}>{pct(p)}</div>
                  <div style={{height:`${Math.max(p*60,2)}px`,background:`rgba(0,204,0,${0.3+n*0.2})`,borderRadius:"3px 3px 0 0",marginTop:4}}/>
                  <div style={{color:"#888",fontSize:10,marginTop:4}}>{t} ({cnt})</div>
                </div>
              );})}
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{color:RED,fontSize:12,fontWeight:"bold"}}>{pct(allS.L/allS.n)}</div>
                <div style={{height:`${Math.max(allS.L/allS.n*60,2)}px`,background:RED,borderRadius:"3px 3px 0 0",marginTop:4}}/>
                <div style={{color:"#888",fontSize:10,marginTop:4}}>SL ({allS.L})</div>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {["BULL","BEAR"].map(d=>{const ds=calcStats(trades.filter(x=>x.dl===d));if(!ds)return null;const c=d==="BULL"?GRN:RED;return(
              <div key={d} style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${c}40`}}>
                <div style={{color:c,fontWeight:"bold",marginBottom:8}}>{d==="BULL"?"▲ BULL":"▼ BEAR"} ({ds.n})</div>
                {[["Win Rate",pct(ds.wr),ds.wr>=0.5?GRN:RED],["Avg P&L",`${fmt(ds.avg,0)} pts`,clrN(ds.avg)],["Avg R:R",fmt(ds.rr,2),ds.rr>=1?GRN:ORG],["Max DD",`${fmt(ds.dd,0)} pts`,RED]].map(([k,v,vc])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${C2}40`,fontSize:11}}><span style={{color:"#888"}}>{k}</span><span style={{color:vc,fontWeight:"bold"}}>{v}</span></div>
                ))}
              </div>
            );})}
          </div>
        </div>
      )}

      {tab==="dist"&&(
        <div style={{padding:14}}>
          <div style={{background:"#111a08",border:`1px solid ${ORG}40`,borderRadius:8,padding:12,marginBottom:14,fontSize:11,lineHeight:1.8}}>
            <div style={{color:ORG,fontWeight:"bold",marginBottom:4}}>💡 distRatio = (actual open − signal level) ÷ (T1 − signal level)</div>
            <div style={{color:"#aaa"}}><span style={{color:GRN}}>0% = entered at exact signal level</span> &nbsp;|&nbsp; <span style={{color:RED}}>≥100% = entered at or past T1</span></div>
          </div>
          <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`,marginBottom:14}}>
            <div style={{color:"#888",fontSize:10,marginBottom:8}}>WIN RATE BY ENTRY DISTANCE</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={distBuckets} barSize={50}>
                <XAxis dataKey="r" tick={{fill:"#888",fontSize:10}}/><YAxis tickFormatter={v=>`${(v*100).toFixed(0)}%`} tick={{fill:"#888",fontSize:9}} domain={[0,1]}/>
                <ReferenceLine y={0.5} stroke="#444" strokeDasharray="3 3"/><TT formatter={(v,n)=>n==="wr"?pct(v):fmt(v,0)}/>
                <Bar dataKey="wr" name="Win Rate" radius={[3,3,0,0]}>{distBuckets.map((b,i)=><Cell key={i} fill={b.wr>=0.5?GRN:b.wr>=0.4?ORG:RED}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{color:"#888",borderBottom:`1px solid ${C2}`}}>{["Distance","Trades","Win%","Avg P&L","Verdict"].map(h=><th key={h} style={{padding:"5px 10px",textAlign:"left",fontWeight:"normal"}}>{h}</th>)}</tr></thead>
              <tbody>{distBuckets.map((b,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${C2}30`}}>
                  <td style={{padding:"6px 10px",color:CT,fontWeight:"bold"}}>{b.r}</td>
                  <td style={{padding:"6px 10px"}}>{b.n}</td>
                  <td style={{padding:"6px 10px",color:b.wr>=0.5?GRN:b.wr>=0.4?ORG:RED,fontWeight:"bold"}}>{pct(b.wr)}</td>
                  <td style={{padding:"6px 10px",color:clrN(b.avg)}}>{fmt(b.avg,0)} pts</td>
                  <td style={{padding:"6px 10px",color:i===1?GRN:i===0?RED:i<=2?ORG:RED}}>{i===0?"⚠️ Weak — skip":i===1?"✅ Best — enter":i===2?"🟡 OK":i===3?"❌ Risky":"🚫 Never"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="time"&&(
        <div style={{padding:14}}>
          <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`,marginBottom:12}}>
            <div style={{color:"#888",fontSize:10,marginBottom:6}}>WIN RATE BY 15-MIN SLOT (IST)</div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={timeData}><XAxis dataKey="time" tick={{fill:"#888",fontSize:9}} interval={1}/><YAxis tickFormatter={v=>`${(v*100).toFixed(0)}%`} tick={{fill:"#888",fontSize:9}} domain={[0,1]}/><ReferenceLine y={0.5} stroke="#444" strokeDasharray="3 3"/><TT formatter={v=>pct(v)}/><Bar dataKey="wr" name="Win Rate" radius={[2,2,0,0]}>{timeData.map((s,i)=><Cell key={i} fill={s.wr>=0.6?GRN:s.wr>=0.4?ORG:RED}/>)}</Bar></BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`,marginBottom:12}}>
            <div style={{color:"#888",fontSize:10,marginBottom:6}}>TOTAL P&L BY TIME SLOT (pts)</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={timeData}><XAxis dataKey="time" tick={{fill:"#888",fontSize:9}} interval={1}/><YAxis tick={{fill:"#888",fontSize:9}}/><ReferenceLine y={0} stroke="#444"/><TT formatter={v=>`${fmt(v,0)} pts`}/><Bar dataKey="pnl" name="P&L" radius={[2,2,0,0]}>{timeData.map((s,i)=><Cell key={i} fill={s.pnl>=0?GRN:RED}/>)}</Bar></BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:C1,borderRadius:8,padding:10,border:`1px solid ${C2}`}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{color:"#888",borderBottom:`1px solid ${C2}`}}>{["Time","#","Wins","Win%","P&L pts","Avg/trade"].map(h=><th key={h} style={{padding:"4px 8px",textAlign:"right",fontWeight:"normal"}}>{h}</th>)}</tr></thead>
              <tbody>{timeData.map((s,i)=>{const isPow=POWER.includes(s.time),isAvd=AVOID.includes(s.time);return(
                <tr key={i} style={{borderBottom:`1px solid ${C2}30`,background:isPow?"#051205":isAvd?"#120505":undefined}}>
                  <td style={{padding:"4px 8px",textAlign:"right",color:isPow?GRN:isAvd?RED:CT,fontWeight:isPow||isAvd?"bold":"normal"}}>{s.time}{isPow?" ⭐":isAvd?" 🚫":""}</td>
                  <td style={{padding:"4px 8px",textAlign:"right"}}>{s.n}</td>
                  <td style={{padding:"4px 8px",textAlign:"right"}}>{s.W}</td>
                  <td style={{padding:"4px 8px",textAlign:"right",color:s.wr>=0.55?GRN:s.wr>=0.4?ORG:RED,fontWeight:"bold"}}>{pct(s.wr)}</td>
                  <td style={{padding:"4px 8px",textAlign:"right",color:clrN(s.pnl)}}>{fmt(s.pnl,0)}</td>
                  <td style={{padding:"4px 8px",textAlign:"right",color:clrN(s.pnl/s.n)}}>{fmt(s.pnl/s.n,0)}</td>
                </tr>
              );})}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="monthly"&&(
        <div style={{padding:14}}>
          <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`,marginBottom:12}}>
            <div style={{color:"#888",fontSize:10,marginBottom:6}}>MONTHLY P&L (pts)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthData}><XAxis dataKey="month" tick={{fill:"#888",fontSize:10}}/><YAxis tick={{fill:"#888",fontSize:10}}/><ReferenceLine y={0} stroke="#444"/><TT formatter={v=>`${fmt(v,0)} pts`}/><Bar dataKey="pnl" name="P&L" radius={[2,2,0,0]}>{monthData.map((m,i)=><Cell key={i} fill={m.pnl>=0?GRN:RED}/>)}</Bar></BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:C1,borderRadius:8,padding:10,border:`1px solid ${C2}`}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{color:"#888",borderBottom:`1px solid ${C2}`}}>{["Month","Trades","Wins","Win%","P&L pts","Avg/Trade"].map(h=><th key={h} style={{padding:"4px 10px",textAlign:"right",fontWeight:"normal"}}>{h}</th>)}</tr></thead>
              <tbody>{monthData.map((m,i)=>{const wr=m.W/m.n;return(
                <tr key={i} style={{borderBottom:`1px solid ${C2}30`}}>
                  <td style={{padding:"5px 10px",color:CT}}>{m.month}</td>
                  <td style={{padding:"5px 10px",textAlign:"right"}}>{m.n}</td>
                  <td style={{padding:"5px 10px",textAlign:"right"}}>{m.W}</td>
                  <td style={{padding:"5px 10px",textAlign:"right",color:wr>=0.5?GRN:RED,fontWeight:"bold"}}>{pct(wr)}</td>
                  <td style={{padding:"5px 10px",textAlign:"right",color:clrN(m.pnl),fontWeight:"bold"}}>{fmt(m.pnl,0)}</td>
                  <td style={{padding:"5px 10px",textAlign:"right",color:clrN(m.pnl/m.n)}}>{fmt(m.pnl/m.n,0)}</td>
                </tr>
              );})}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="filter"&&(
        <div style={{padding:14}}>
          <div style={{background:C1,borderRadius:8,padding:14,border:`1px solid ${C2}`,marginBottom:14}}>
            <div style={{color:BLU,fontWeight:"bold",marginBottom:12,fontSize:12}}>🔧 ADJUST FILTERS — stats update live</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
              {[{label:"Max Entry Distance",key:"dist",step:0.05,min:0.1,max:1.5,disp:v=>`${(v*100).toFixed(0)}%`},{label:"From Hour (IST)",key:"h0",step:1,min:9,max:14,disp:v=>`${v}:15`},{label:"To Hour (IST)",key:"h1",step:1,min:10,max:15,disp:v=>`${v}:30`}].map(({label,key,step,min,max,disp})=>(
                <div key={key}>
                  <div style={{color:"#888",fontSize:10,marginBottom:4}}>{label}: <strong style={{color:ORG}}>{disp(filt[key])}</strong></div>
                  <input type="range" min={min} max={max} step={step} value={filt[key]} onChange={e=>setFilt(p=>({...p,[key]:+e.target.value}))} style={{width:"100%",accentColor:GRN}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#555",marginTop:2}}><span>{disp(min)}</span><span>{disp(max)}</span></div>
                </div>
              ))}
              <div>
                <div style={{color:"#888",fontSize:10,marginBottom:4}}>Direction: <strong style={{color:ORG}}>{filt.dir}</strong></div>
                <div style={{display:"flex",gap:5,marginTop:6}}>
                  {["ALL","BULL","BEAR"].map(d=><button key={d} onClick={()=>setFilt(p=>({...p,dir:d}))} style={{flex:1,padding:"6px 0",borderRadius:4,border:"none",cursor:"pointer",fontSize:10,fontFamily:"monospace",background:filt.dir===d?GRN:C2,color:filt.dir===d?"#000":CT,fontWeight:filt.dir===d?"bold":"normal"}}>{d}</button>)}
                </div>
              </div>
            </div>
          </div>
          {filtS&&<StatsRow s={filtS}/>}
          {filtS&&(
            <div style={{background:C1,borderRadius:8,padding:12,border:`1px solid ${C2}`}}>
              <div style={{color:"#888",fontSize:10,marginBottom:6}}>FILTERED CUMULATIVE P&L</div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={filtCumData}><YAxis tick={{fill:"#888",fontSize:9}} width={55}/><ReferenceLine y={0} stroke="#444"/><TT formatter={v=>[`${fmt(v,0)} pts`]}/><Line type="monotone" dataKey="c" dot={false} strokeWidth={1.5} stroke={filtS.tot>=0?GRN:RED}/></LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {tab==="setup"&&bestSetup&&(
        <div style={{padding:14}}>
          <div style={{background:"#0a1f0a",border:`2px solid ${GRN}`,borderRadius:10,padding:16,marginBottom:14}}>
            <div style={{color:GRN,fontSize:14,fontWeight:"bold",marginBottom:4}}>🏆 BEST SETUP (Auto-Optimised)</div>
            <div style={{color:"#888",fontSize:10,marginBottom:12}}>Best combination of win rate + R:R + avg P&L across all filter combos</div>
            <StatsRow s={bestSetup}/>
          </div>
          <div style={{background:C1,borderRadius:8,padding:14,border:`1px solid ${C2}`,marginBottom:12}}>
            <div style={{color:BLU,fontWeight:"bold",marginBottom:10,fontSize:12}}>📋 ENTRY RULES</div>
            {[["🎯","Direction",bestSetup.dir==="ALL"?"Both BULL and BEAR":bestSetup.dir+" only",GRN],["⏰","Time Window",`${bestSetup.h0}:15 → ${bestSetup.h1}:30 IST only`,ORG],["📏","Entry Dist",`Enter only if next bar opens within ${(bestSetup.dist*100).toFixed(0)}% of T1 distance`,ORG],["🟢","BULL Entry","GREEN candle → enter at next bar open",GRN],["🔴","BEAR Entry","RED candle → enter at next bar open",RED],["🟠","ORANGE","Bull reversal warning — skip new BULL entries",ORG],["🔵","BLUE","Bear reversal warning — skip new BEAR entries",BLU]].map(([ic,k,v,c])=>(
              <div key={k} style={{display:"grid",gridTemplateColumns:"22px 110px 1fr",gap:8,padding:"7px 0",borderBottom:`1px solid ${C2}40`,fontSize:11}}>
                <span>{ic}</span><span style={{color:"#888"}}>{k}</span><span style={{color:c}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{background:C1,borderRadius:8,padding:14,border:`1px solid ${C2}`,marginBottom:12}}>
            <div style={{color:ORG,fontWeight:"bold",marginBottom:10,fontSize:12}}>🚪 EXIT RULES</div>
            {[["1️⃣","Stop Loss","SL = Entry ± (1.618 × breakout range). Hard stop."],["2️⃣","T1 Hit","Move SL to breakeven. Now risk-free."],["3️⃣","T2 Hit","Trail SL to T1. Lock in profit."],["4️⃣","T3 Hit","Trail SL to T2. Only T4 left."],["5️⃣","T4 Hit","Full exit. 100% target achieved."],["❌","GREY candle","ST flipped. Exit at market if no target hit."],["⚠️","Orange/Blue","Reduce 50% at market. Trail rest."]].map(([ic,k,v])=>(
              <div key={k} style={{display:"grid",gridTemplateColumns:"22px 110px 1fr",gap:8,padding:"7px 0",borderBottom:`1px solid ${C2}40`,fontSize:11}}>
                <span>{ic}</span><span style={{color:"#888"}}>{k}</span><span style={{color:CT}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{background:"#0d1a1f",borderRadius:8,padding:14,border:`1px solid ${BLU}40`}}>
            <div style={{color:BLU,fontWeight:"bold",marginBottom:10,fontSize:12}}>📊 REALISTIC EXPECTATION</div>
            {[["T1 reach",pct(bestSetup.tH[1]/bestSetup.n),GRN],["T2 reach",pct(bestSetup.tH[2]/bestSetup.n),GRN],["T3 reach",pct(bestSetup.tH[3]/bestSetup.n),ORG],["T4 reach",pct(bestSetup.tH[4]/bestSetup.n),ORG],["Avg winner",`${fmt(bestSetup.avgW,0)} pts`,GRN],["Avg loser",`${fmt(bestSetup.avgL,0)} pts`,RED],["Expectancy",`${fmt(bestSetup.avg,0)} pts/trade`,clrN(bestSetup.avg)]].map(([k,v,c])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C2}40`,fontSize:11}}>
                <span style={{color:"#888"}}>{k}</span><span style={{color:c,fontWeight:"bold"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="trades"&&<TradesTab trades={trades}/>}
    </div>
  );
}
