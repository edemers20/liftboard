import "./styles.css";
import { attachDials } from "./dial.js";
import { ACT, ACT_IDS, ALL, CARDIO, CLIMB_MET, CUSTOM, DAYS, DEF, INTERVAL, KEY, KEY2, KEY3, L, PICKLE_MET, SPIN_MET, SPIN_MIN, SPORTS, STEADY, SUP, TAGTXT, YOGA_MET, actKey, cnt, dayDiff, deloadInfo, diffFx, enabled, esc, exHist, exName, fem, fx, get, hasSport, inSeason, incFor, init, isDB, isIso, kg, lastSet, markDone, minKey, newWeek, num, perMin, persist, plan, plannedMin, r5, range, review, roundW, save, set, setSaveHook, slots, split, suggest, syncDays, wk } from "./engine.js";

const storage=(()=>{ try{ const k="__t"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return localStorage; }catch(e){ const m=new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))}; } })();
init(storage);
setSaveHook(ok=>{ document.getElementById("saved").textContent= ok?"Saved":"Not saved (storage blocked)"; });
let cur="week";
try{ const t=localStorage.getItem(KEY+".tab"); if(t) cur=t; }catch(e){}
const actTabs=()=>ACT_IDS.filter(a=>a!=="lift"&&enabled(a));
const rampOn=()=>hasSport()&&!inSeason()&&wk.ramp==="Yes";
const TABS=()=>["season","week",...DAYS.map(d=>d.id),...(rampOn()?["zone2"]:[]),...actTabs()];
if(!wk.setupDone) cur="season";
const hsh=location.hash.slice(1); if(TABS().includes(hsh)) cur=hsh; if(!TABS().includes(cur)) cur="week";

/* ---------- Info overlays ---------- */
const sportInfo=a=>ACT[a].noMin?"Counts toward cardio and cuts pulling volume.":`Counts toward cardio.${ACT[a].leg?" Leg-heavy weeks trim overlapping unilateral and quad sets.":""}${ACT[a].sh?" Long weeks shift a side delt set to rear delts.":""}`;
const INFO={
 acts:"Turns on each activity's tab and check-in question. Lifting off hides all lift days.",
 mainSport:"The sport your seasons revolve around. It decides which support lifts appear in-season.",
 focus:"Where extra sets and extra days go. Lower: more lower-body work. Upper: the reverse. Balanced: even.",
 season:"Off-season: full splits, weights go up. In-season: 1–3 full-body days, 2 sets each, no weight increases, support lifts for your sport.",
 ramp:"Adds one 45-min zone 2 session a week to build the aerobic base that prevents in-season fatigue.",
 deload:"One lighter week: about 60% of sets, ~90% weights, easy-pace cardio. Suggested after 6 off-season weeks or when 2+ main lifts stall.",
 mode:"Deficit only: fat loss first. Recomp: loss capped at 0.5 lb/wk and cardio at 25% to protect muscle. Build: ~200 kcal surplus, +1 set on main lifts.",
 rate:"Target loss per week. Sets the weekly deficit at 3,500 kcal per lb.",
 share:"How much of the deficit should come from cardio. The rest comes from food.",
 sex:"Changes resting metabolism and the minimum weight jump. Other uses the midpoint.",
 age:"Used for resting metabolism.", height:"Used for resting metabolism.",
 weight:"Used for metabolism, cardio burn and protein.",
 bf:"If set, resting metabolism uses lean mass, which is more accurate for muscular people.",
 steps:"Average daily steps, added to maintenance.",
 oura:"Replaces the maintenance estimate, minus 7% because wearables read high.",
 days:"Sets your split. Focus decides where the extra days go.",
 time:"Shorter cuts accessories first; 75 adds a main-lift set.",
 liftK:"Average burn per lifting session, added to maintenance.",
 ready:"Low adds 2 to recovery load.",
 sore:"Adds 1 (2 if everywhere). Where you're sore decides which main lifts get cut.",
 cycle:"Period or luteal adds 1.",
 drink:"1–2 adds 1. 3+ adds 2.",
 load:"Recovery load 2: finishers switch to an easy, conversational pace (no intervals). 3–4: also main lifts −1 set and no weight increases. 5+: shortened days.",
 wAvg:"Optional. After 3+ weeks, maintenance corrects itself from your real change. Assumes you ate close to target.",
 ss:"No: exercises run as straight sets. At 60 min or less, optional accessories are cut to fit the time.",
 today:"Good: −1 recovery load and a push-your-top-set cue. Normal: plan as written. Rough gives a shortened day: −1 set on everything, optional accessories cut, easy-pace finisher, no weight increases.",
 heated:"Heated burns more.",
 progress:"↑ Up: hit the top of the range, ~5% more on lower lifts, ~2.5% on upper. = Hold: same weight, one more rep. ↓ Down: missed the bottom twice, rebuild at −10%. ! Fatigue: reps fell 4+ across sets; rest longer.",
 changes:"Everything this week's check-in and activities changed, grouped by cause.",
 watch:"Targets and warnings to keep an eye on this week.",
 lifts:"Your top working set each session. The number is the latest weight; the change is since your first logged session.",
 weeks:"Saved each time you tap Start new week. Weigh-ins logged here calibrate maintenance after 3+ weeks.", spint:"Really hard burns more and adds 1 to recovery load.", ymin:"Class length."
};
SPORTS.forEach(a=>{ INFO[a]=sportInfo(a); INFO[minKey(a)]="Planned length per session."; });
INFO.climb="Each session counts as about 75 minutes toward cardio. Pulling and arm work on lift days is trimmed so you don't double up.";INFO.yoga="Counts toward cardio."; INFO.pilates="Counts toward cardio at a light, yoga-like burn."; INFO[minKey("pilates")]="Class length."; INFO.spin="Counts toward cardio. Hard weeks cut a quad set.";
const LBL={acts:"Activities",mainSport:"Main sport",focus:"Focus",season:"Season",ramp:"Ramp",deload:"Deload",mode:"Goal",rate:"Lose lb/week",share:"From cardio",sex:"Sex",age:"Age",height:"Height",weight:"Weight",bf:"Body fat",steps:"Steps",oura:"Daily burn",days:"Lifting days",time:"Session length",liftK:"Avg lift kcal",ready:"Readiness",sore:"Soreness",cycle:"Cycle",drink:"Drinking",load:"Recovery load",wAvg:"Avg weight",ymin:"Class length",heated:"Heated",spint:"Intensity",today:"Today",ss:"Supersets",progress:"Progress",changes:"Changes",watch:"Watch",lifts:"Main lifts",weeks:"Previous weeks",maint:"Maintenance"};
ACT_IDS.forEach(a=>{ LBL[a]=ACT[a].name; LBL[minKey(a)]="Planned min"; });
const POP={}; let popN=0;
function hdr(title,keys,tag){ const id="p"+(++popN), t=tag||"h3";
  POP[id]=keys.filter(k=>INFO[k]).map(k=>`<p><b>${LBL[k]||k}:</b> ${INFO[k]}</p>`).join("");
  return `<${t} class="hdr">${title}<button type="button" class="ib" data-pop="${id}" aria-label="What these do" aria-expanded="false">i</button></${t}>`; }
function ib(k){ const id="p"+(++popN); POP[id]=`<p>${INFO[k]}</p>`; return `<button type="button" class="ib" data-pop="${id}" aria-label="What this does" aria-expanded="false">i</button>`; }
function seg(key,label,opts,val,solo){ const v=val!==undefined?val:wk[key];
  return `<div class="q"><span>${label}${solo?ib(key):""}</span><div class="seg" data-key="${key}">${opts.map(o=>{const [ov,ol]=Array.isArray(o)?o:[o,o];return `<button type="button" aria-pressed="${String(v)===String(ov)}" data-v="${ov}">${key==="time"?ol+" min":ol}</button>`;}).join("")}</div></div>`; }
function stepper(key,label,vals,unit,val){ const v=String(val!==undefined?val:wk[key]), arr=vals.map(String); let i=arr.indexOf(v); if(i<0) i=0;
  const b=(d,lab,sym)=>{ const j=i+d; return j<0||j>=arr.length?`<button type="button" disabled aria-label="${lab}">${sym}</button>`:`<button type="button" data-v="${arr[j]}" aria-label="${lab} to ${arr[j]}${unit?" "+unit:""}">${sym}</button>`; };
  return `<div class="q"><span>${label}</span><div class="seg stepper" data-key="${key}">${b(-1,"Decrease","−")}<output aria-live="polite">${arr[i]}${unit?`<small> ${unit}</small>`:""}</output>${b(1,"Increase","+")}</div></div>`; }
function toggle(key,label,val,onV="Yes",offV="No"){ const on=String(val!==undefined?val:wk[key])===onV;
  return `<div class="q tgl"><span id="tg-${key}">${label}</span><div class="seg toggle" data-key="${key}"><button type="button" role="switch" aria-checked="${on}" aria-labelledby="tg-${key}" data-v="${on?offV:onV}"><i aria-hidden="true"></i></button></div></div>`; }
function fld(key,label,mode,ph,cls,val){ return `<label class="field${cls?" "+cls:""}" for="${key}"><span>${label}</span><input id="${key}" data-w="${key}" inputmode="${mode||"numeric"}" placeholder="${ph||""}" value="${esc((val!==undefined?val:wk[key])??"")}"></label>`; }

function draftDirty(){ return !!draft&&Object.keys(draft).some(k=>JSON.stringify(draft[k])!==JSON.stringify(wk[k])); }
/* ---------- Your plan: live summary built from the engine's output ---------- */
const capF=s=>s.charAt(0).toUpperCase()+s.slice(1);
/* Your plan as a fill-in-the-blanks sentence. Strings are plain words; [id,value] pairs are the filled-in blanks. */
const andList=a=>a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1];
function planSentence(P){
  const M=P.math, inS=inSeason(), lift=enabled("lift"), n=DAYS.length, S=[];
  const sport=hasSport()?ACT[wk.mainSport].name.toLowerCase():"";
  const days=[["days",`${n} ${inS?"full-body ":""}lift day${n===1?"":"s"}`]];
  if(lift&&n){
    if(wk.deload==="Yes"){ S.push("This is a ",["deload","lighter deload week"],": about 60% of your usual sets with ",...days,". "); }
    else if(inS){
      const sp=Object.keys(SUP).filter(k=>SUP[k].includes(wk.mainSport)).map(k=>({calves:"calf",adductor:"adductor",cuff:"rotator cuff"})[k]);
      S.push("It's ",["season",`${sport} season`],", so you're ",["aim","holding your strength"]," with ",...days," a week");
      if(sp.length) S.push(" plus ",["support",`${andList(sp)} work`]);
      S.push(". ");
    } else {
      const foc=wk.focus==="Balanced"?["focus","upper and lower body evenly"]:["focus",wk.focus==="Upper"?"upper body":"lower body"];
      if(sport) S.push("It's your ",["season",`${sport} off-season`],", so you're ",["aim","building strength"]," with ",...days," a week");
      else S.push("You're ",["aim","building strength"]," with ",...days," a week");
      S.push(wk.focus==="Balanced"?", working ":", focused on your ",foc);
      if(rampOn()) S.push(", plus ",["ramp","one zone 2 session"]," to get ready for the season");
      S.push(". ");
    }
  }
  const goal={"Deficit only":"lose fat",Recomp:"lose fat and keep muscle",Build:"build muscle"}[wk.mode]||"lose fat";
  S.push("To ",["goal",goal],", eat about ",["eat",`${r5(M.intake).toLocaleString()} calories`]," and ",["protein",`${M.protein[0]}–${M.protein[1]} g of protein`]," a day");
  if(wk.mode!=="Build"&&M.cardioTarget>0) S.push(", and burn ",["cardio",`${r5(M.cardioTarget).toLocaleString()} calories`]," in cardio each week");
  S.push(".");
  return S;
}
const sentenceHTML=(S,prev)=>S.map(x=>typeof x==="string"?esc(x):`<b class="blank${prev&&prev[x[0]]!==x[1]?" hot":""}">${esc(x[1])}</b>`).join("");
/* Blanks whose value changed since the last plan card was drawn flash */
let planPrev=null;
function planHTML(P,o={}){
  const S=planSentence(P), prev=planPrev; planPrev=Object.fromEntries(S.filter(x=>typeof x!=="string"));
  return `<div class="plan${o.pin?" pin":""}" aria-live="polite"><div class="plab">Your plan</div><p class="psent">${sentenceHTML(S,prev)}</p></div>`;
}

const TAGICON={up:"↑",hold:"=",down:"↓",collapse:"!"};
const tagH=t=>`<span class="tag ${t}" role="img" aria-label="${TAGTXT[t]}">${TAGICON[t]}</span>`;
/* ---------- Number wheels: which inputs get one, and their ranges ---------- */
const DIAL={
  age:{label:"Age",min:13,max:90,step:1},
  height:{label:"Height",min:48,max:84,step:1,unit:"in"},
  weight:{label:"Weight",min:70,max:400,step:0.5,unit:"lb"},
  bf:{label:"Body fat",min:5,max:50,step:1,unit:"%",optional:1,start:25},
  steps:{label:"Steps / day",min:0,max:30000,step:250},
  oura:{label:"Daily burn",min:1000,max:5000,step:10,unit:"kcal",optional:1,start:2000},
  wAvg:{label:"Avg weight",min:70,max:400,step:0.2,unit:"lb",optional:1},
  liftK:{label:"Avg lift kcal",min:0,max:800,step:10,unit:"kcal"},
  rate:{label:"Lose per week",min:0,max:2,step:0.25,unit:"lb"},
  share:{label:"From cardio",min:0,max:100,step:5,unit:"%"}
};
function dialCfg(el){
  const d=el.dataset;
  if(d.f==="w"||d.f==="r"){
    const log=get(cur,+d.i).log||[], k=+d.set, prev=log[k-1]||{}, day=DAYS.find(x=>x.id===cur), slot=day&&day.slots[+d.i];
    if(d.f==="w") return {label:"Weight",min:0,max:600,step:2.5,unit:"lb",start:prev.w||(+el.placeholder>0?el.placeholder:45)};
    return {label:"Reps",min:0,max:40,step:1,start:prev.r||(slot?range(slot.reps)[1]:10)};
  }
  if(d.k==="act") return {label:"Actual minutes",min:0,max:120,step:1,unit:"min",start:el.placeholder};
  if(d.act) return {label:"Actual minutes",min:0,max:360,step:1,unit:"min",start:el.placeholder};
  const k=d.w||d.tw; if(!k) return null;
  if(DIAL[k]) return {...DIAL[k],start:DIAL[k].start??(k==="wAvg"?wk.weight:el.placeholder)};
  if(/min$/.test(k)) return {label:"Planned minutes",min:15,max:360,step:5,unit:"min",start:el.placeholder};
  return null;
}
/* ---------- Rendering ---------- */
function tabName(id){ if(id==="week") return "This week"; if(id==="zone2") return "Zone 2"; if(id==="season") return wk.setupDone?"Season":"Setup"; if(ACT[id]) return ACT[id].name; return DAYS.find(d=>d.id===id).tab; }
const themeOf=id=>DAYS.some(d=>d.id===id)?"th-green":(ACT[id]||id==="zone2")?"th-pink":"th-orange";
function renderTabs(P){
  const t=document.getElementById("tabs");
  t.innerHTML=TABS().map(id=>{
    const off=false, nx=id===P.nextId;
    return `<button class="tab ${themeOf(id)}${off?" off":""}${nx?" nx":""}" role="tab" type="button" aria-selected="${id===cur}" data-id="${id}">${(wk.done||{})[id]?"✓ ":""}${tabName(id)}</button>`;}).join("");
  t.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{closeSheet();closeCoach(true);cur=b.dataset.id;try{localStorage.setItem(KEY+".tab",cur)}catch(e){};closePop();render();resetConfirm(false);window.scrollTo(0,0);});
}
let draft=null;
function profileHTML(withGoal,src){
  src=src||wk;
  const en=a=>!!(src.acts||{})[a], hs=!!src.mainSport&&en(src.mainSport);
  const sports=SPORTS.filter(en);
  const F=(k,l,m,ph)=>fld(k,l,m,ph,"",src[k]);
  const G=h=>`<div class="pgroup">${h}</div>`;
  return `<div class="pgroups">${G(`${hdr("Activities",["acts","mainSport",...(hs?["season"]:[])])}
  <div class="seg">${ACT_IDS.map(a=>`<button type="button" class="actt" data-actt="${a}" aria-pressed="${en(a)}">${ACT[a].name}</button>`).join("")}</div>`)}
  ${sports.length?G(`${seg("mainSport","Main sport",[["","None"],...sports.map(a=>[a,ACT[a].name])],src.mainSport)}
  ${withGoal&&hs?toggle("season","In-season",src.season,"In-season","Off-season"):""}`):""}
  ${en("lift")?G(`${hdr("Lifting",["focus"])}${seg("focus","Focus",[["Lower","Lower body"],["Balanced","Balanced"],["Upper","Upper body"]],src.focus)}`):""}
  ${withGoal?G(`${hdr("Goal",["mode"])}${seg("mode","Goal",["Deficit only","Recomp","Build"])}`):""}
  ${G(`${hdr("Bio Data",["sex","age","height","weight","bf","steps","oura"])}
  ${seg("sex","Sex",["Female","Male","Other"],src.sex)}
  <div class="nums">${F("age","Age")}${F("height","Height (in)","decimal")}${F("weight","Weight (lb)","decimal")}${F("bf","Body fat %","decimal","optional")}${F("steps","Steps / day")}${F("oura","Daily burn","numeric","optional")}</div>`)}</div>`;
}
const spark=h=>{ const ws=h.slice(-8).map(x=>x.w), n=ws.length, lo=Math.min(...ws), hi=Math.max(...ws);
  const pts=ws.map((w,j)=>[n>1?4+j*104/(n-1):56, hi===lo?16:28-(w-lo)/(hi-lo)*24].map(v=>+v.toFixed(1)));
  return `<svg class="spark" width="112" height="32" viewBox="0 0 112 32" role="img" aria-label="Top set ${ws[0]} to ${ws[n-1]} lb over ${n} sessions"><line x1="0" y1="31" x2="112" y2="31"/><polyline points="${pts.map(p=>p.join(",")).join(" ")}"/><circle cx="${pts[n-1][0]}" cy="${pts[n-1][1]}" r="3"/></svg>`; };
const moveHTML=()=>`  <details class="panel" id="moveBox"><summary><h3 style="display:inline">Move your data</h3> <span class="small">to another device or link</span></summary>
    <div style="display:grid;gap:10px;margin-top:12px">
      <p class="note">Copy here, then paste into Lift Board on the other device or link and tap Load.</p>
      <textarea id="moveTxt" rows="4" placeholder="Paste data here" aria-label="Lift Board data"></textarea>
      <div class="nums two"><button class="btn" id="moveCopy" type="button">Copy my data</button><button class="btn primary" id="moveLoad" type="button">Load</button></div>
    </div></details>`;
function renderSeason(P){
  if(!wk.setupDone) return `<div class="dayhead"><h2>Setup</h2></div>${planHTML(P)}<div class="panel">${profileHTML(true)}<button class="btn primary" id="setupSave" type="button">Save setup</button></div>${moveHTML()}`;
  const inS=inSeason(), build=wk.mode==="Build", dl=deloadInfo();
  const fmt=t=>new Date(t).toLocaleDateString(undefined,{month:"short",day:"numeric"});
  const names=Object.keys(exHist).filter(n=>(exHist[n]||[]).length);
  const H=(wk.weeks||[]).slice().reverse();
  const seasonBox=hasSport()?`${toggle("season","In-season",undefined,"In-season","Off-season")}
    ${inS?"":toggle("ramp","Season starts in ≤6 weeks")}
`:`<p class="note">Pick a main sport in Profile to use seasons.</p>`;
  return `<div class="dayhead"><h2>Season</h2></div>
  ${planHTML(P)}
  <div class="panel">${hdr("Season",["season","ramp","deload"])}
    ${seasonBox}
    ${DAYS.length?`${dl.length&&wk.deload!=="Yes"?`<p class="flag">Deload suggested · ${dl.join(", ")}</p>`:""}${toggle("deload","Deload this week")}`:""}
  </div>
  <div class="panel">${hdr("Goal",["mode","rate","share"])}
    ${seg("mode","Goal",["Deficit only","Recomp","Build"])}
    ${build?"":`<div class="nums two">${fld("rate","Lose lb / week","decimal")}${fld("share","From cardio %")}</div>`}
  </div>
  ${DAYS.length||names.length?`<div class="panel">${hdr("Main lifts",["lifts"])}
   ${names.length?names.map(n=>{const h=exHist[n],a=h[0],z=h[h.length-1],dw=z.w-a.w;return `<div class="liftrow"><span class="ln">${esc(n)}</span>${spark(h)}<span class="lw"><b>${z.w}<small> lb</small></b>${h.length>1?`<em class="${dw<0?"neg":""}">${dw>0?"+":dw<0?"−":"±"}${Math.abs(dw)}</em>`:""}</span></div>`;}).join(""):`<p class="note">Appears after you mark days done.</p>`}
  </div>`:""}
  <div class="panel">${hdr("Previous weeks",["weeks"])}
   ${H.length?`<div style="overflow-x:auto"><table class="wk"><thead><tr><th>Week of</th><th>Plan</th><th>Lifts</th><th>Sport</th><th>Wt</th></tr></thead><tbody>${H.map(w=>`<tr><td>${fmt(w.start)}</td><td>${w.season==="In-season"?"In":"Off"}${w.ramp?" · ramp":""}${w.deload?" · deload":""} · ${esc(w.mode)}<br><span class="small">${esc(w.focus||w.priority||"")}</span></td><td>${w.lifts}/${w.planned}</td><td>${w.sport??w.pickle??0} min</td><td>${w.w||"–"}</td></tr>`).join("")}</tbody></table></div>`:`<p class="note">Saves when you tap Start new week.</p>`}
  </div>
  ${enabled("lift")?`<div class="panel">${hdr("Training preferences",["ss","liftK"])}
    ${toggle("ss","Supersets")}
    <div class="q"><span>Avg lift kcal</span>${fld("liftK","","numeric","","sm")}</div></div>`:""}
  <div class="panel" id="profileBox"><h3>Profile</h3>${profileHTML(false,{...wk,...(draft||{})})}<button class="btn primary" id="profSave" type="button"${draftDirty()?"":" disabled"}>Save changes</button></div>
  ${moveHTML()}
  <div class="foot season-foot"><button class="btn" id="replayTour" type="button">Replay tour</button><button class="btn" id="resetProfile" type="button">Reset profile</button></div>`;
}
function renderWeek(P){
  const M=P.math, inS=inSeason(), build=wk.mode==="Build", tot=Math.max(M.target,1);
  const pct=v=>Math.min(100,v/tot*100).toFixed(1);
  const nd=P.days[P.nextId];
  const others=ACT_IDS.filter(a=>a!=="lift"&&enabled(a));
  const acts=others.map(a=>stepper(a,ACT[a].name+" sessions",ACT[a].cls?[0,1,2,3]:[0,1,2,3,4,5])).join("");
  INFO.maint=M.useOura?`Your wearable's daily burn minus 7%, plus this week's cardio.`:`Resting ${r5(M.bmr)} + light movement ${r5(M.base-M.bmr)} + steps ${r5(M.stepsK)}${M.nLift?` + lifting ${r5(M.liftDay)}`:""} + digestion ${r5(M.tef)}${wk.calibN?`, ${M.calib>=0?"+":""}${r5(M.calib)} calibrated from ${wk.calibN} weigh-ins`:""}.`;
  return `<div class="dayhead"><h2>Weekly check-in</h2></div>
  ${nd&&nd.restSuggest?`<p class="flag">Reps dropped two sessions in a row. Take a rest day before ${DAYS.find(d=>d.id===P.nextId).tab}.</p>`:""}
  ${enabled("lift")?`<div class="panel">${hdr("Schedule",["days","time"])}
    ${stepper("days","Lifting days",inS?[1,2,3]:[1,2,3,4,5])}
    ${stepper("time","Time per session",[30,45,60,75],"min")}</div>`:""}
  <div class="panel">${hdr("How you're doing",["ready","sore",...(fem()?["cycle"]:[]),"drink","load","wAvg"])}
    ${seg("ready","Readiness",["Normal","Low"])}
    ${seg("sore","Soreness",["None","Legs","Upper body","Everything"])}
    ${fem()?seg("cycle","Cycle",["Not tracking","Period","Luteal","Other"]):""}
    ${seg("drink","Drinking nights",["0","1–2","3+"])}
    <div class="nums">${fld("wAvg","Avg weight","decimal","optional","sm")}</div></div>
  ${acts?`<div class="panel">${hdr("Other activity",others)}${acts}</div>`:""}
  <div class="panel">${hdr(esc(wk.mode),["mode","maint"])}
    <div class="inset">
      <div class="k label">Daily maintenance${M.useOura?" · wearable −7%":wk.calibN?" · calibrated":" · estimated"}</div>
      <p class="burn">Baseline ${r5(M.tdee-M.cardioTotal/7).toLocaleString()} + this week's cardio ${r5(M.cardioTotal/7)} = <strong>${r5(M.tdee).toLocaleString()}</strong></p>
      <p class="burn"><strong style="font-size:inherit">${r5(M.intake).toLocaleString()}</strong> kcal/day to eat</p>
      ${!build&&M.cardioTotal>M.cardioTarget+35?`<p class="burn" style="font-size:13px">+${r5((M.cardioTotal-M.cardioTarget)/7)} kcal/day more than planned, from extra activity</p>`:""}
    </div>
    ${build?"":`<div class="stats">
      <div class="stat"><div class="k">Weekly deficit</div><div class="v">${r5(M.target).toLocaleString()} <small>kcal</small></div></div>
      <div class="stat"><div class="k">Cardio target</div><div class="v">${r5(M.cardioTarget).toLocaleString()} <small>kcal</small></div></div>
      <div class="stat"><div class="k">Cardio planned</div><div class="v">${r5(M.cardioTotal).toLocaleString()} <small>kcal</small></div></div>
      <div class="stat"><div class="k">${M.food<0?"Eat above baseline":"Eat below baseline"}</div><div class="v">${M.food<0?"+":""}${r5(Math.abs(M.food))} <small>kcal / day</small></div></div>
    </div>
    <div class="bar" role="img" aria-label="Share of weekly deficit by source">
      <i style="width:${pct(M.finK)}%;background:var(--cardio)"></i><i style="width:${pct(M.otherK+M.doneK)}%;background:var(--warn)"></i><i style="width:${pct(Math.max(0,M.target-M.cardioTotal))}%;background:var(--accent)"></i></div>
    <div class="legend">${M.finK>0?`<span style="--c:var(--cardio)">Finishers ${r5(M.finK)}</span>`:""}<span style="--c:var(--warn)">Other activity ${r5(M.otherK+M.doneK)}</span><span style="--c:var(--accent)">Food ${r5(Math.max(0,M.target-M.cardioTotal))}</span></div>`}
    ${M.nLift&&M.nFin?`<p class="note">Remaining finishers: <strong>${M.m} min</strong> × ${M.nFin}</p>`:""}
  </div>
  ${P.rules.length?`<div class="panel">${hdr("This week's changes",["changes"])}<ul>${P.rules.map(n=>`<li>${n}</li>`).join("")}</ul></div>`:""}
  ${P.notes.length?`<div class="panel">${hdr("Watch",["watch"])}<ul>${P.notes.map(n=>`<li>${n}</li>`).join("")}</ul></div>`:""}
  <button class="btn primary" id="newWeek" type="button">Start new week</button>`;
}
/* ---------- Day: one focused exercise at a time ---------- */
const exDone=(d,D,i)=>{ const s=d.slots[i], A=D.slots[i]; if(A.skip) return true; if(D.done) return true; const st=get(d.id,i); return s.cardio?!!st.cdone:(st.log||[]).filter(x=>x.d).length>=A.sets; };
const exCands=(d,D)=>d.slots.map((_,i)=>i).filter(i=>!D.slots[i].skip);
function skipWhy(A){
  const k=A.skip||"";
  if(A.flag) return A.flag;
  if(k==="Trimmed · no supersets") return "Cut to fit without supersets. Turn supersets on or pick 75 min to keep it.";
  if(k.startsWith("Trimmed for a 45")) return "Cut to fit 45 min. Pick 60 min or more to keep it.";
  if(k.startsWith("Trimmed for a 30")) return "Cut to fit 30 min. Pick 45 min or more to keep it.";
  if(k==="Not needed this week") return "Your cardio target is already covered.";
  if(k.startsWith("Skipped · ")) return `Skipped for ${k.slice(10)}.`;
  return k;
}
function activeIdx(d,D){
  const c=exCands(d,D), a=(wk.active||{})[d.id];
  if(a!=null&&d.slots[a]&&D.slots[a]&&D.slots[a].skip!=="hidden") return a;
  return c.find(i=>!exDone(d,D,i)) ?? c[c.length-1];
}
const nextIdx=(d,D,i)=>exCands(d,D).find(j=>j>i&&!exDone(d,D,j)) ?? exCands(d,D).find(j=>!exDone(d,D,j)&&j!==i);
const whyTxt=A=>{ const w=A.why.filter(x=>!x.includes("focus")&&!x.includes("feeling good")); return w.length?[...new Set(w.map(x=>x.split(" · ")[1]))].join(", "):""; };
function renderDayHTML(d,P){
  const D=P.days[d.id], act=activeIdx(d,D);
  let html=`<div class="dayhead"><h2>${d.title}</h2></div>`;
  html+=`<div class="panel today"><div class="q"><span id="todayLbl">How do you feel today?${ib("today")}</span>
    <div class="seg slider" data-key="today" role="radiogroup" aria-labelledby="todayLbl">${["Good","Normal","Rough"].map(o=>`<button type="button" role="radio" data-v="${o}" aria-checked="${D.today===o}" aria-pressed="${D.today===o}"><i aria-hidden="true"></i><span>${o}</span></button>`).join("")}</div></div>
    ${D.restSuggest?`<p class="flag">Reps dropped two sessions in a row. Rest a day first if you can.</p>`:D.autoRough?`<p class="adj"><b>Shortened</b> · reps dropped last session</p>`:""}
    ${d.id===P.nextId&&wk.upNext===d.id&&wk.missedNote?`<p class="adj"><b>Up next</b> · ${esc(wk.missedNote.why)}</p>`:""}
    </div>`;
  const rv=D.done&&(wk.review||{})[d.id];
  if(rv&&rv.items.length) html+=`<div class="panel"><h3>Next time</h3><div class="rev">${rv.items.map(r=>`<p>${tagH(r.tag)}<b>${esc(r.n)}</b> · ${r.w} lb · ${esc(r.why)}</p>`).join("")}</div>${rv.note?`<p class="adj">${esc(rv.note)}</p>`:""}</div>`;
  html+=`<div class="list">`;
  d.slots.forEach((s,i)=>{
    const st=get(d.id,i), A=D.slots[i], base=`${d.id}-${i}`;
    if(A.skip==="hidden") return;
    if(A.skip&&i!==act){ const lg=(st.log||[]).filter(x=>x.d).length, dn=s.cardio?!!st.cdone:lg>=(A.sets||1);
      html+=`<button type="button" class="exrow opt${dn?" done":""}" data-ex="${i}" aria-label="Optional: ${esc(exName(d,s,i))}"><span class="label">${s.label} · optional</span><span class="mk" aria-hidden="true">${dn?"✓":"›"}</span><span class="exname">${esc(exName(d,s,i))}</span></button>`; return; }
    if(i!==act){ const dn=exDone(d,D,i);
      html+=`<button type="button" class="exrow${dn?" done":""}" data-ex="${i}" aria-label="${dn?"Done":"Start"} ${esc(exName(d,s,i))}"><span class="label">${s.label}${s.ss&&wk.ss!=="No"?` · ${s.ss}`:""}</span><span class="mk" aria-hidden="true">${dn?"✓":"›"}</span><span class="exname">${esc(exName(d,s,i))}</span></button>`; return; }
    const choice=st.choice ?? s.opts[0], isCustom=choice===CUSTOM;
    const opts=[...s.opts,CUSTOM].map(o=>`<option${o===choice?" selected":""}>${esc(o)}</option>`).join("");
    const log=st.log||[], ticks=log.filter(x=>x.d).length, fin=s.cardio?!!st.cdone||D.done:ticks>=A.sets;
    const nRows=Math.max(A.sets||0,log.length);
    const pill=s.cardio?(D.done?`~${r5(A.doneK||0)} kcal`:A.min?`${A.min} min`:"Optional"):fin?"Done":`Set ${Math.min(ticks+1,A.sets)} of ${A.sets}`;
    html+=`<section class="slot cur${s.ss&&wk.ss!=="No"?" ss":""}${fxOnce.slot===base?" justdone":""}" aria-current="step">
      <div class="row1"><span class="label hdr">${s.label}${s.ss&&wk.ss!=="No"?` · Superset ${s.ss}`:""}</span><span class="pill">${pill}</span></div>
      ${s.cardio?"":`<div class="bars" style="--n:${nRows}" aria-hidden="true">${Array.from({length:nRows},(_,k)=>`<i class="${k<ticks?"on":k===ticks&&!fin?"now":""}"></i>`).join("")}</div>`}
      <select id="sel-${base}" data-i="${i}" aria-label="${esc(s.label)} exercise">${opts}</select>
      <input id="cus-${base}" class="custom${isCustom?" on":""}" data-i="${i}" placeholder="Exercise name" value="${esc(st.custom||"")}">`;
    if(s.cardio){
      html+=`${A.flag?`<p class="adj"><b>Lowered</b> · ${A.flag}</p>`:""}${A.steady?`<p class="adj"><b>Easy pace, no intervals</b> · ${A.steady}</p>`:""}
      <div class="nums two"><label for="act-${base}">Actual min<input id="act-${base}" data-i="${i}" data-k="act" inputmode="numeric" placeholder="${A.min||""}" value="${esc(st.act||"")}"></label><label for="load-${base}">Setting<input id="load-${base}" data-i="${i}" data-k="load" placeholder="12% / 3.0" value="${esc(st.load||"")}"></label></div>
      ${D.done||st.cdone?"":`<div><button type="button" class="btn primary pillbtn cdone" data-i="${i}">Done</button></div>`}`;
    }else{
      const today=suggest(d,s,i,false,P);
      html+=`<div class="sets">`;
      for(let k=0;k<nRows;k++){ const x=log[k]||{};
        html+=`<div class="setrow${x.d?" done":""}${k===ticks&&!fin?" now":""}"><span class="sn">${k+1}</span>
          <input id="w-${base}-${k}" data-i="${i}" data-set="${k}" data-f="w" inputmode="decimal" placeholder="${today?today.w:"lb"}" aria-label="Set ${k+1} weight" value="${esc(x.w||"")}"><span class="u">lb</span>
          <input id="r-${base}-${k}" data-i="${i}" data-set="${k}" data-f="r" inputmode="numeric" placeholder="reps" aria-label="Set ${k+1} reps" value="${esc(x.r||"")}">
          <button type="button" class="chk${fxOnce.chk===`${base}-${k}`?" pop":""}" data-i="${i}" data-set="${k}" data-rest="${s.main?120:75}" aria-pressed="${!!x.d}" aria-label="Set ${k+1} done">✓</button></div>`; }
      html+=`<button type="button" class="btn addset" data-i="${i}">+ Set</button></div>`;
    }
    html+=`</section>`;
  });
  return html+`</div><button class="btn primary" id="doneBtn" type="button"${D.done?' disabled aria-disabled="true"':""}>${D.done?"✓ Day done":"Mark day done"}</button>`;
}
/* ---------- Small sheets: today's plan for an exercise, and next time after it ---------- */
let sheetT=null;
function showSheet(html,bindFn){
  const el=document.getElementById("sheet"); clearTimeout(sheetT);
  el.innerHTML=html; el.classList.remove("out"); el.hidden=false;
  el.querySelectorAll("[data-x]").forEach(b=>b.onclick=closeSheet); if(bindFn) bindFn(el);
}
function closeSheet(){ const el=document.getElementById("sheet"); if(!el||el.hidden||el.classList.contains("out")) return; el.classList.add("out"); sheetT=setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out"); },200); }
const XBTN=`<button type="button" class="dx" data-x aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>`;
function planSheet(id,i){
  const d=DAYS.find(x=>x.id===id); if(!d) return;
  const P=plan(), s=d.slots[i], A=P.days[id].slots[i]; if(A.skip&&s.cardio) return;
  const t=s.cardio?null:suggest(d,s,i,false,P), why=s.cardio?(A.steady?`Easy pace · ${A.steady}`:A.flag||""):whyTxt(A);
  const main=s.cardio?`${A.min} min · ~${r5(A.kcal||0)} kcal`:`${A.sets} × ${esc(s.reps)}${t?` · start ${t.w} lb`:""}`;
  showSheet(`<div class="shgrid"><span class="plab">Today's plan · ${esc(s.label)}</span><button type="button" class="shbtn" data-x>Begin</button><span class="shmain">${main}</span>${why?`<span class="shsub">${esc(why)}</span>`:""}</div>`);
}
function nextSheet(id,i){
  const d=DAYS.find(x=>x.id===id); if(!d) return;
  const P=plan(), D=P.days[id], s=d.slots[i], g=review(d,s,i,P), n=nextIdx(d,D,i);
  showSheet(`<div class="shtop"><span class="plab">${esc(exName(d,s,i))} · done</span>${XBTN}</div>
    ${g?`<p class="shline">${tagH(g.tag)}<span>Next time <b>${g.w} lb</b> · ${esc(g.why)}</span></p>`:""}
    ${n!=null?`<button type="button" class="shbtn wide" id="upNext">Up next: ${esc(exName(d,d.slots[n],n))}</button>`:""}`,
    el=>{ const b=el.querySelector("#upNext"); if(b) b.onclick=()=>{ wk.active={...(wk.active||{}),[id]:n}; save(); render(); }; });
}
function rows(key,n,pl,rate,label,noK){
  let h=""; if(key==="zAct") INFO.zAct="One easy 45-minute session during the pre-season ramp: bike, incline walk or rower at a pace you could talk through. It builds the aerobic base that keeps you fresh in-season.";
  for(let i=0;i<n;i++){ const v=(wk[key]||[])[i]||"", k=num(v,pl)*rate;
    h+=`<div class="slot cardio"><div class="row1"><span class="label hdr">${label}${n>1?" "+(i+1):""}${key==="zAct"?ib("zAct"):""}</span>${noK?"":`<span class="burn">~${r5(k)} kcal</span>`}</div>
    <div class="nums two"><label for="${key}-${i}">Actual min<input id="${key}-${i}" data-act="${key}" data-n="${i}" inputmode="numeric" placeholder="${pl}" value="${esc(v)}"></label></div></div>`; }
  return h;
}
function renderAct(a){
  if(a==="zone2") return `<div class="dayhead"><h2>Zone 2</h2></div>
  <div class="list">${rows("zAct",1,45,perMin(CARDIO["Bike (steady)"].met),"Zone 2 session")}</div>`;
  const n=cnt(a), A=ACT[a];
  if(A.noMin) return `<div class="dayhead"><h2>${A.name}</h2></div><div class="panel">${hdr("This week",[a])}${stepper(a,"Sessions",[0,1,2,3,4,5])}</div>`;
  if(a==="yoga") return `<div class="dayhead"><h2>Yoga</h2></div><div class="panel" style="margin-top:12px">${hdr("This week",["yoga","ymin","heated"])}${stepper("yoga","Sessions",[0,1,2,3])}${stepper("ymin","Class length",[45,60,75,90],"min")}${toggle("heated","Heated")}</div>
  <div class="list" style="margin-top:12px">${rows("yAct",n,num(wk.ymin,60),perMin(YOGA_MET[wk.heated]||2.8),"Class")}</div>`;
  if(a==="pilates") return `<div class="dayhead"><h2>Pilates</h2></div><div class="panel" style="margin-top:12px">${hdr("This week",["pilates",minKey("pilates")])}${stepper("pilates","Sessions",[0,1,2,3])}${stepper(minKey("pilates"),"Class length",[45,50,55,60],"min")}</div>
  <div class="list" style="margin-top:12px">${rows(actKey("pilates"),n,plannedMin("pilates"),perMin(A.met),"Class")}</div>`;
  if(a==="spin") return `<div class="dayhead"><h2>Spin</h2></div><div class="panel" style="margin-top:12px">${hdr("This week",["spin","spint"])}${stepper("spin","Sessions",[0,1,2,3])}${seg("spint","Intensity",["Hard","Really hard"])}</div>
  <div class="list" style="margin-top:12px">${rows("sAct",n,SPIN_MIN,perMin(SPIN_MET[wk.spint]||8.5),"Class")}</div>`;
  return `<div class="dayhead"><h2>${A.name}</h2></div><div class="panel" style="margin-top:12px">${hdr("This week",[a,minKey(a)])}${stepper(a,"Sessions",[0,1,2,3,4,5])}
   <div class="nums">${fld(minKey(a),"Planned min","numeric","","sm")}</div></div><div class="list" style="margin-top:12px">${rows(actKey(a),n,plannedMin(a),perMin(A.met),"Session",1)}</div>`;
}
function render(){
  if(!TABS().includes(cur)) cur="week";
  popN=0; for(const k in POP) delete POP[k];
  const P=plan(); renderTabs(P);
  document.body.classList.remove("th-green","th-orange","th-pink"); document.body.classList.add(themeOf(cur)); { const m=document.querySelector('meta[name="theme-color"]'); if(m) m.content={"th-green":"#131615","th-orange":"#181513","th-pink":"#181416"}[themeOf(cur)]; }
  const v=document.getElementById("view");
  document.getElementById("foot").hidden=!DAYS.some(d=>d.id===cur);
  v.innerHTML=cur==="week"?renderWeek(P):cur==="season"?renderSeason(P):(ACT[cur]||cur==="zone2")?renderAct(cur):renderDayHTML(DAYS.find(d=>d.id===cur),P);
  if(cur!==lastCur){ const T=TABS(), dir=lastCur==null?"":T.indexOf(cur)>=T.indexOf(lastCur)?"fwd":"back";
    v.classList.remove("enter","fwd","back"); void v.offsetWidth; v.classList.add("enter"); if(dir) v.classList.add(dir); lastCur=cur;
    const tb=document.querySelector('.tab[aria-selected="true"]'); if(tb&&tb.scrollIntoView) tb.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"}); }
  if(fxOnce.seg){ const b=v.querySelector(`.seg[data-key="${fxOnce.seg[0]}"] button[data-v="${CSS.escape(fxOnce.seg[1])}"]`); if(b) b.classList.add("pressed"); }
  fxOnce={};
  bind();
  stackCards();
  coachSoon();
}
/* ---------- Stacked cards on Season and This week ----------
   Cards stick under the tabs and the next one slides up over them, leaving title strips.
   Only the last STACK_MAX titles stay stacked; older ones scroll away so the page keeps room.
   Tap a stacked title to jump back to that card. A card taller than the space left sticks by
   its bottom edge while it is the current card, so none of it is hidden. */
const STACK_TABS=["week","season"], STACK_MAX=2;
let stackRO=null, stackRaf=0, ST=null;
function stackCards(){
  const v=document.getElementById("view");
  const on=STACK_TABS.includes(cur)&&wk.setupDone;
  v.classList.toggle("stacked",on);
  if(stackRO){ stackRO.disconnect(); stackRO=null; }
  ST=null;
  if(!on) return;
  const cards=[...v.children].filter(c=>c.matches(".panel,.plan"));
  cards.forEach((c,i)=>{ c.addEventListener("transitionend",e=>{ if(e.propertyName==="top"&&ST) updateStack(); }); c.classList.add("stack"); c.style.zIndex=i+1; c.style.setProperty("--lift",[0,4.5,9][i%3]+"%");
    c.addEventListener("click",e=>{ if(!c.classList.contains("covered")) return; e.preventDefault(); e.stopPropagation(); stackJump(i); },true); });
  ST={cards}; measureStack();
  if(window.ResizeObserver){ stackRO=new ResizeObserver(()=>{ cancelAnimationFrame(stackRaf); stackRaf=requestAnimationFrame(measureStack); }); cards.forEach(c=>stackRO.observe(c)); }
}
function measureStack(){
  if(!ST) return; const v=document.getElementById("view"), tabs=document.getElementById("tabs");
  let pad=v.querySelector(":scope > .stackpad"); if(!pad){ pad=document.createElement("div"); pad.className="stackpad"; pad.setAttribute("aria-hidden","true"); v.appendChild(pad); }
  pad.style.height="0px"; v.classList.add("measuring");
  const y=window.scrollY;
  ST.nat=ST.cards.map(c=>c.getBoundingClientRect().top+y);
  ST.h=ST.cards.map(c=>c.offsetHeight);
  ST.strip=ST.cards.map(c=>{ const f=c.firstElementChild; return f?Math.min(64,f.offsetTop+f.offsetHeight+10):44; });
  v.classList.remove("measuring");
  ST.tabsH=(parseFloat(getComputedStyle(tabs).top)||0)+tabs.offsetHeight+4;
  ST.thr=ST.cards.map((_,i)=>{ let t=ST.tabsH; for(let k=Math.max(0,i-STACK_MAX);k<i;k++) t+=ST.strip[k]; return t; });
  const vh0=window.innerHeight; ST.end=ST.cards.findIndex((c,i)=>i>0&&ST.h[i]>vh0-ST.thr[i]-12); if(ST.end<0) ST.end=ST.cards.length;
  ST.cards.forEach((c,i)=>c.classList.toggle("flow",i>=ST.end));
  /* room at the bottom so the last card can still slide up into place */
  const L=ST.cards.length-1, need=ST.nat[L]-ST.thr[L], max=document.documentElement.scrollHeight-window.innerHeight;
  if(ST.end>L&&L>0&&need>max) pad.style.height=Math.ceil(need-max)+"px";
  updateStack();
}
function updateStack(){
  if(!ST||!ST.nat) return;
  const y=window.scrollY, vh=window.innerHeight, n=ST.end;
  let c=0; for(let i=0;i<n;i++) if(ST.nat[i]-y<=ST.thr[i]+1) c=i;
  /* once the first card that scrolls normally reaches the stack, the stack lets go entirely */
  const past=ST.end<ST.cards.length&&ST.nat[ST.end]-y<=ST.thr[ST.end];
  const first=past?n:Math.max(0,c-STACK_MAX);
  let t=ST.tabsH;
  ST.cards.forEach((card,i)=>{
    if(i>=ST.end){ card.style.top=""; card.classList.remove("gone","covered"); return; }
    card.classList.toggle("gone",i<first); card.classList.toggle("covered",i>=first&&i<c);
    let top;
    if(i<first) top=null;
    else if(i<c){ top=t; t+=ST.strip[i]; }
    else { top=i===c?t:ST.thr[i]; if(ST.h[i]>vh-top-12) top=vh-ST.h[i]-12; }
    card.style.top=top==null?"":top+"px";
  });
  /* trim each card where the next one covers it, so a tall card's lower half never peeks out below a shorter one */
  const R=ST.cards.map(c=>c.getBoundingClientRect());
  ST.cards.forEach((card,i)=>{ const nx=R[i+1]; const hide=nx?R[i].bottom-nx.top-20:0;
    card.style.clipPath=hide>0?`inset(0 0 ${Math.round(hide)}px 0)`:""; });
}
function stackJump(i){ if(!ST) return; window.scrollTo({top:Math.max(0,ST.nat[i]-ST.thr[i]),behavior:"smooth"}); }
window.addEventListener("scroll",()=>{ if(ST){ cancelAnimationFrame(stackRaf); stackRaf=requestAnimationFrame(updateStack); } },{passive:true});
window.addEventListener("resize",()=>{ cancelAnimationFrame(stackRaf); stackRaf=requestAnimationFrame(measureStack); });
document.addEventListener("toggle",e=>{ if(e.target.matches&&e.target.matches(".stack")) measureStack(); },true);
/* ---------- First-visit tab tips: one short popup per tab type, then never again ---------- */
const coachKey=id=>DAYS.some(d=>d.id===id)?"day":id==="season"&&!wk.setupDone?"setup":id;
function coachText(id){
  if(id==="season"&&!wk.setupDone) return ["Setup","Fill in the rest of your details here. Your plan at the top updates as you go; save when it looks right."];
  if(id==="season") return ["Season","Your plan at a glance, plus season, goal, lift trends, past weeks and your profile."];
  if(id==="week") return ["This week","Check in once a week. Your schedule, how you're feeling and other activity reshape every lift day."];
  if(DAYS.some(d=>d.id===id)) return ["Lift Days","Use this tab to track your workout and see how previous lifts influence progressive overload."];
  if(id==="zone2") return ["Zone 2","One easy 45-minute session during your pre-season ramp. Log the minutes you actually did."];
  const A=ACT[id]; if(!A) return null;
  if(A.cls) return [A.name,"Log your classes here. They count toward this week's cardio."];
  if(A.noMin) return [A.name,"Log sessions here. Lift days trim pulling work so you don't double up."];
  return [A.name,"Log sessions and minutes here. They count toward cardio, and long weeks trim overlapping leg work on lift days."];
}
let coachT=null;
function coachSoon(){ clearTimeout(coachT); coachT=setTimeout(showCoach,450); }
function closeCoach(mark){
  const el=document.getElementById("coach"); if(!el||el.hidden) return;
  if(mark){ wk.seenTabs={...(wk.seenTabs||{}),[el.dataset.k]:1}; save(); }
  document.querySelectorAll(".tab.coached").forEach(t=>t.classList.remove("coached"));
  el.classList.add("out"); setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out"); },180);
}
function showCoach(){
  const el=document.getElementById("coach"); if(!el) return;
  const busy=["tour","done","confirm","dial"].some(x=>{ const n=document.getElementById(x); return n&&!n.hidden; });
  const k=coachKey(cur), t=coachText(cur);
  if(tour||busy||!t||(wk.seenTabs||{})[k]||(!wk.setupDone&&cur!=="season")){ return; }
  const tab=document.querySelector('.tab[aria-selected="true"]'); if(!tab) return;
  window.scrollTo({top:0}); const r=tab.getBoundingClientRect(), w=Math.min(320,window.innerWidth-32);
  const left=Math.max(16,Math.min(window.innerWidth-w-16,r.left+r.width/2-w/2));
  el.dataset.k=k; el.style.width=w+"px"; el.style.left=left+"px"; el.style.top=(r.bottom+12)+"px";
  el.style.setProperty("--ax",(r.left+r.width/2-left)+"px");
  el.innerHTML=`<span class="plab">${esc(t[0])}</span><p>${esc(t[1])}</p><button type="button" class="shbtn" id="coachOk">Got it</button>`;
  tab.classList.add("coached"); el.hidden=false; el.classList.remove("out");
  el.querySelector("#coachOk").onclick=()=>closeCoach(true);
}
/* One-shot animation hooks: set right before a render, cleared after it, so re-renders never replay them */
let fxOnce={}, lastCur=null;

/* ---------- Toasts: only when the plan actually changes ---------- */
let toastT=null;
function toast(lines,ms){
  if(!lines.length) return;
  const t=document.getElementById("toast");
  t.innerHTML=`<div class="tin">${lines.slice(0,5).map(l=>`<p>${esc(l)}</p>`).join("")}</div>`;
  t.classList.remove("show"); void t.offsetWidth; t.classList.add("show");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),ms||4500);
}
function change(fn){ const a=fx(plan()); fn(); save(); const b=fx(plan()); render(); toast(diffFx(a,b)); }

/* ---------- Popover ---------- */
let popBtn=null;
let popT=null;
function closePop(){ const p=document.getElementById("pop"); if(popBtn) popBtn.setAttribute("aria-expanded","false"); popBtn=null;
  if(p.hidden) return; p.classList.add("out"); clearTimeout(popT); popT=setTimeout(()=>{ p.hidden=true; p.classList.remove("out"); },140); }
function openPop(b){
  const p=document.getElementById("pop");
  if(popBtn===b){ closePop(); return; }
  closePop(); popBtn=b; b.setAttribute("aria-expanded","true");
  clearTimeout(popT); p.classList.remove("out");
  p.innerHTML=POP[b.dataset.pop]||""; p.hidden=false; p.classList.remove("in"); void p.offsetWidth; p.classList.add("in");
  const r=b.getBoundingClientRect(), w=Math.min(300,window.innerWidth-32);
  p.style.width=w+"px";
  p.style.left=Math.max(16,Math.min(window.innerWidth-w-16,r.left+r.width/2-w/2))+window.scrollX+"px";
  p.style.top=r.bottom+window.scrollY+8+"px";
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest(".ib"); if(b){ e.preventDefault(); openPop(b); return; } if(!e.target.closest||!e.target.closest("#pop")) closePop(); });
window.addEventListener("scroll",()=>closePop(),{passive:true});

/* ---------- Actions ---------- */
function logSet(i,k,f,val){ const st=get(cur,i); const log=(st.log||[]).slice(); while(log.length<=k) log.push({}); log[k]={...log[k],[f]:val}; set(cur,i,"log",log); }
let restT=null;
function startRest(sec){ const bar=document.getElementById("rest"); clearInterval(restT); let t=sec; const tick=()=>{ bar.hidden=false; bar.textContent=`Rest ${Math.floor(t/60)}:${String(t%60).padStart(2,"0")} · tap to skip`; if(t--<=0){clearInterval(restT); bar.textContent="Go"; setTimeout(()=>bar.hidden=true,2500);} }; tick(); restT=setInterval(tick,1000); }
new MutationObserver(()=>document.body.classList.toggle("resting",!document.getElementById("rest").hidden)).observe(document.getElementById("rest"),{attributes:true,attributeFilter:["hidden"]});
/* ---------- "Are you sure?" sheet for anything destructive ---------- */
function askSure({title,text,ok,onOk}){
  const el=document.getElementById("confirm"), back=document.activeElement; closePop();
  el.innerHTML=`<div class="ddim" data-no></div><section class="csheet" role="alertdialog" aria-modal="true" aria-labelledby="cTitle" aria-describedby="cText">
    <span class="plab">Are you sure?</span><h2 id="cTitle" tabindex="-1">${esc(title)}</h2><p id="cText">${esc(text)}</p>
    <div class="tbtns two"><button type="button" class="tb ghost" data-no>Cancel</button><button type="button" class="tb danger" id="cOk">${esc(ok)}</button></div></section>`;
  el.hidden=false; el.classList.remove("out");
  const close=go=>{ el.classList.add("out"); setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out"); if(go) onOk(); else back&&back.focus&&back.focus({preventScroll:true}); },200); };
  el.querySelectorAll("[data-no]").forEach(b=>b.onclick=()=>close(false));
  el.querySelector("#cOk").onclick=()=>close(true);
  el.onkeydown=e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(false); } };
  el.querySelector("[data-no].tb").focus({preventScroll:true});
}
/* ---------- Completion screens: short, closable sheets ---------- */
let doneCta=null;
const CHECK=`<span class="dcheck" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 28 28"><path d="M7 14.5l4.5 4.5L21 9.5"/></svg></span>`;
function showDone({eyebrow,title,body,cta,onCta}){
  const el=document.getElementById("done"); doneCta=onCta||null; closePop();
  el.innerHTML=`<div class="ddim" data-close></div><section class="dsheet" role="dialog" aria-modal="true" aria-labelledby="dTitle">
    <div class="dtop"><span class="plab">${esc(eyebrow)}</span><button type="button" class="dx" data-close aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
    <div class="dhead">${CHECK}<h2 id="dTitle" tabindex="-1">${esc(title)}</h2></div>
    ${body}
    <button type="button" class="tb dcta" id="dCta">${esc(cta)}</button></section>`;
  el.querySelectorAll(".dsheet > *").forEach((c,i)=>c.style.setProperty("--d",(i*60)+"ms"));
  el.hidden=false; el.classList.remove("out"); document.body.classList.add("touring");
  el.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeDone());
  el.querySelector("#dCta").onclick=()=>closeDone(true);
  el.querySelector("#dTitle").focus({preventScroll:true});
}
function closeDone(viaCta){
  const el=document.getElementById("done"); if(el.hidden||el.classList.contains("out")) return;
  el.classList.add("out"); const go=viaCta&&doneCta;
  setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out"); if(!tour) document.body.classList.remove("touring"); if(go) go(); coachSoon(); },220);
}
const dRows=R=>`<div class="drows">${R.map(([k,v,a])=>`<div class="prow"><span>${esc(k)}</span><b${a?' class="a"':""}>${esc(v)}</b></div>`).join("")}</div>`;
const dTiles=T=>`<div class="dtiles">${T.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>`;
function goTab(id){ cur=id; try{localStorage.setItem(KEY+".tab",cur)}catch(e){}; render(); window.scrollTo(0,0); }
function setupDone(){
  const P=plan();
  showDone({eyebrow:"Setup saved",title:"Your plan is ready",body:`<p class="psent">${sentenceHTML(planSentence(P))}</p>`,
    cta:"See this week",onCta:()=>goTab("week")});
}
function dayDone(id,sets){
  const d=DAYS.find(x=>x.id===id), rv=(wk.review||{})[id]||{items:[]}, c=t=>rv.items.filter(x=>x.tag===t).length;
  const ease=c("down")+c("collapse"), nxt=DAYS.find(x=>!(wk.done||{})[x.id]);
  const top=rv.items.filter(x=>x.tag==="up").concat(rv.items.filter(x=>x.tag!=="up")).slice(0,3);
  showDone({eyebrow:`${d.tab} · ${d.title.split(" · ")[0]}`,title:"Day done",
    body:dTiles([["Sets",String(sets)],["Up",String(c("up"))],ease?["Ease",String(ease)]:["Hold",String(c("hold"))]])
      +(top.length?`<div class="drows"><span class="dl">Next time</span>${top.map(x=>`<div class="prow"><span>${esc(x.n)}</span><b class="${x.tag==="up"?"a":""}">${TAGICON[x.tag]} ${x.w} lb</b></div>`).join("")}</div>`:"")
      +(rv.note?`<p class="dnote">${esc(rv.note)}</p>`:""),
    cta:nxt?`Up next: ${nxt.tab}`:"Done",onCta:nxt?()=>goTab(nxt.id):null});
}
function weekDone(s){
  const ws=wk.weeks||[], a=ws[ws.length-1], b=ws[ws.length-2];
  const dw=a&&a.w&&b&&b.w?(a.w-b.w):null;
  showDone({eyebrow:"Week complete",title:"Week done",
    body:dTiles([["Lifts",`${s.lifts}/${s.planned}`],["Cardio",s.cardio.toLocaleString()],["Weight",dw==null?(a&&a.w?String(a.w):"–"):`${dw>0?"+":dw<0?"−":""}${Math.abs(dw).toFixed(1)}`]])
      +(wk.missedNote?`<p class="dnote">${esc(capF(wk.missedNote.txt)+".")}</p>`:""),
    cta:"Start next week",onCta:()=>goTab("week")});
}
const setsLogged=id=>{ const d=DAYS.find(x=>x.id===id); return d?d.slots.reduce((n,s,i)=>n+(get(id,i).log||[]).filter(x=>x.d).length,0):0; };
/* A day is complete when every visible lift has all its planned sets ticked */
function dayComplete(id){
  const d=DAYS.find(x=>x.id===id), P=plan(); if(!d) return false;
  return d.slots.every((s,i)=>{ const A=P.days[id].slots[i]; if(s.cardio||A.skip) return true; const log=get(id,i).log||[]; return log.filter(x=>x.d).length>=A.sets; });
}
function bind(){
  const v=document.getElementById("view");
  attachDials(v,dialCfg);
  const inProf=el=>wk.setupDone&&!!el.closest("#profileBox");
  const stage=(k,val)=>{ draft=draft||{}; draft[k]=val; if(k==="acts"){ const ms=draft.mainSport??wk.mainSport; if(ms&&!val[ms]) draft.mainSport=""; } render(); };
  const ps=document.getElementById("profSave"); if(ps) ps.onclick=()=>{ const d=draft; draft=null; const a=fx(plan()); Object.assign(wk,d); if(!enabled(wk.mainSport)){ wk.mainSport=""; } if(!wk.mainSport) wk.season="Off-season"; save(); const b=fx(plan()); render(); toast(["Profile saved",...diffFx(a,b)]); };
  v.querySelectorAll(".actt").forEach(b=>{ if(inProf(b)) b.onclick=()=>{ const a=b.dataset.actt, cur0={...(wk.acts||{}),...((draft&&draft.acts)||{})}; stage("acts",{...cur0,[a]:!cur0[a]}); }; });
  v.querySelectorAll(".actt").forEach(b=>{ if(!inProf(b)) b.onclick=()=>change(()=>{ const a=b.dataset.actt; wk.acts={...(wk.acts||{}),[a]:!enabled(a)}; if(!enabled(wk.mainSport)) { wk.mainSport=""; wk.season="Off-season"; } }); });
  const ss=document.getElementById("setupSave"); if(ss) ss.onclick=()=>{ wk.setupDone=true; wk.weekStart=wk.weekStart||Date.now(); cur="week"; save(); render(); window.scrollTo(0,0); setupDone(); };
  const rt=document.getElementById("replayTour"); if(rt) rt.onclick=openTour;
  const mc=document.getElementById("moveCopy"); if(mc) mc.onclick=async()=>{ const data=JSON.stringify({v:1,slots:storage.getItem(KEY),wk:storage.getItem(KEY2),hist:storage.getItem(KEY3)}); const t=document.getElementById("moveTxt"); t.value=data; t.select(); try{ await navigator.clipboard.writeText(data); toast(["Copied","Paste it into Lift Board on the other device."]); }catch(e){ toast(["Selected","Copy the text in the box."]); } };
  const ml=document.getElementById("moveLoad"); if(ml) ml.onclick=()=>{ let o; try{ o=JSON.parse(document.getElementById("moveTxt").value); if(!o||o.v!==1||!o.wk) throw 0; }catch(e){ toast(["Couldn't load","Paste the full text from Copy my data."]); return; }
    const go=()=>{ storage.setItem(KEY,o.slots||"{}"); storage.setItem(KEY2,o.wk); storage.setItem(KEY3,o.hist||"{}"); location.reload(); };
    if(wk.setupDone) askSure({title:"Replace your data",text:"Everything on this device is replaced with the pasted data.",ok:"Replace",onOk:go}); else go(); };
  const rp=document.getElementById("resetProfile"); if(rp) rp.onclick=()=>askSure({title:"Reset profile",text:"This erases your setup, logs and lift history on this device and starts over from the welcome screen. Copy your data first if you want to keep it.",ok:"Erase and start over",onOk:()=>{ [KEY,KEY2,KEY3,KEY+".tab"].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} }); location.hash=""; location.reload(); }});
  v.querySelectorAll(".exrow[data-ex]").forEach(b=>b.onclick=()=>{ const i=+b.dataset.ex; wk.active={...(wk.active||{}),[cur]:i}; save(); render(); });
  v.querySelectorAll(".cdone").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i, A=plan().days[cur].slots[i], st=get(cur,i); if(!st.act&&A.min) set(cur,i,"act",String(A.min)); set(cur,i,"cdone",true); fxOnce.slot=`${cur}-${i}`;
    const d=DAYS.find(x=>x.id===cur), n=nextIdx(d,plan().days[cur],i); if(n!=null){ wk.active={...(wk.active||{}),[cur]:n}; save(); } render(); });
  v.querySelectorAll("input[data-set]").forEach(el=>{ el.oninput=()=>logSet(+el.dataset.i,+el.dataset.set,el.dataset.f,el.value); el.onchange=()=>render(); });
  v.querySelectorAll(".chk").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i,k=+b.dataset.set, x=(get(cur,i).log||[])[k]||{};
    if(!x.w){ const ph=document.getElementById(`w-${cur}-${i}-${k}`).placeholder; if(+ph>0) logSet(i,k,"w",ph); }
    logSet(i,k,"d",!x.d); if(!x.d) startRest(+b.dataset.rest);
    if(!x.d) closeSheet();
    if(!x.d&&!(wk.done||{})[cur]&&dayComplete(cur)){ const id=cur, n=setsLogged(id); markDone(id); render(); dayDone(id,n); return; }
    let finished=false;
    if(!x.d){ fxOnce.chk=`${cur}-${i}-${k}`; const A=plan().days[cur].slots[i]; if((get(cur,i).log||[]).filter(z=>z.d).length===A.sets){ fxOnce.slot=`${cur}-${i}`; finished=true; } }
    render(); if(finished) nextSheet(cur,i); });
  v.querySelectorAll(".addset").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i, log=(get(cur,i).log||[]).slice(), A=plan().days[cur].slots[i]; while(log.length<A.sets) log.push({}); log.push({}); set(cur,i,"log",log); render(); });
  const db=document.getElementById("doneBtn"); if(db) db.onclick=()=>{ const id=cur; if((wk.done||{})[id]) return; const n=setsLogged(id); markDone(id); render(); dayDone(id,n); };
  const nw=document.getElementById("newWeek"); if(nw) nw.onclick=()=>askSure({title:"Start a new week",text:"This closes out the week: it saves this week's numbers to history and resets the check-in and day logs.",ok:"Start new week",onOk:()=>{ const P=plan(), s={lifts:DAYS.filter(d=>(wk.done||{})[d.id]).length,planned:DAYS.length,cardio:r5(P.math.cardioTotal)}; newWeek(); render(); weekDone(s); }});
  v.querySelectorAll(".seg[data-key]").forEach(g=>g.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    const k=g.dataset.key, raw=b.dataset.v; fxOnce.seg=[k,raw];
    if(inProf(g)){ stage(k,raw); return; }
    if(!wk.setupDone){ wk[k]=(k==="days"||k==="time")?+raw:raw; if(k==="mainSport"&&!raw) wk.season="Off-season"; save(); render(); return; }
    if(k==="today"){ const Pa=plan(); wk.today={...(wk.today||{}),[cur]:raw}; save(); const Pb=plan(); render(); toast(dayDiff(Pa,Pb,cur)); return; }
    if(k==="season"&&Object.keys(wk.done||{}).length&&!b.dataset.sure){ askSure({title:`Switch to ${raw.toLowerCase()}`,text:"Your split changes, so days already marked done this week are cleared. Your lift history stays.",ok:"Switch",onOk:()=>{ b.dataset.sure=1; b.click(); }}); return; }
    if(k==="ramp"){ change(()=>{ wk.ramp=raw; }); if(raw==="Yes") toast(["Pre-season ramp","One 45-min zone 2 session added. It has its own Zone 2 tab."],6000); return; }
    change(()=>{
      wk[k]=(k==="days"||k==="time")?+raw:raw;
      if(k==="mainSport"&&!raw) wk.season="Off-season";
      if(k==="season"){ wk.days=raw==="In-season"?2:3; wk.done={}; wk.donePlan={}; wk.upNext=""; wk.missedNote=null; }
    }); }));
  v.querySelectorAll("input[data-act]").forEach(el=>el.onchange=()=>change(()=>{ const k=el.dataset.act; wk[k]=(wk[k]||[]).slice(); wk[k][+el.dataset.n]=el.value; }));
  v.querySelectorAll("input[data-w]").forEach(el=>el.onchange=()=>{ if(inProf(el)){ stage(el.dataset.w,el.value); return; } if(!wk.setupDone){ wk[el.dataset.w]=el.value; save(); return; } change(()=>{ wk[el.dataset.w]=el.value; }); });
  v.querySelectorAll("select").forEach(el=>el.onchange=()=>{ set(cur,+el.dataset.i,"choice",el.value); render(); if(el.value===CUSTOM){const c=document.getElementById(`cus-${cur}-${el.dataset.i}`); c&&c.focus();} });
  v.querySelectorAll(".custom").forEach(el=>{ el.oninput=()=>set(cur,+el.dataset.i,"custom",el.value); el.onchange=()=>render(); });
  v.querySelectorAll(".nums input[data-k]").forEach(el=>{ el.oninput=()=>set(cur,+el.dataset.i,el.dataset.k,el.value); if(el.dataset.k==="act"){ el.onfocus=()=>{ el._fx=fx(plan()); }; el.onchange=()=>{ const b=fx(plan()); render(); toast(diffFx(el._fx||b,b)); }; } });
}

/* ---------- Guided tour: first run, before setup. Controls write real settings;
   a replay after setup runs on a snapshot that is restored on close. ---------- */
let tour=null;
function openTour(){ closePop(); tour={i:-1,snap:wk.setupDone?JSON.stringify(wk):null,added:{}}; planPrev=null; renderTour("open"); }
function closeTour(){
  const t=tour; if(!t) return; tour=null;
  const el=document.getElementById("tour"); el.classList.add("out");
  setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out","step","opening"); if(document.getElementById("done").hidden) document.body.classList.remove("touring"); },200);
  if(t.snap){ const o=JSON.parse(t.snap); Object.keys(wk).forEach(k=>delete wk[k]); Object.assign(wk,o); }
  else { wk.tourDone=true; cur="season"; }
  save(); planPrev=null; render(); window.scrollTo(0,0);
  if(t.snap) document.getElementById("replayTour")?.focus();
  setTimeout(showCoach,500);
}
function tourSet(k,v){
  if(k==="sport"){
    const prev=wk.mainSport; if(prev&&tour.added[prev]){ wk.acts={...wk.acts,[prev]:false}; delete tour.added[prev]; }
    if(v){ if(!enabled(v)) tour.added[v]=1; wk.acts={...(wk.acts||{}),[v]:true}; wk.mainSport=v; } else { wk.mainSport=""; wk.season="Off-season"; }
  } else if(k==="season"){ wk.season=v; wk.days=v==="In-season"?2:3; }
  else wk[k]=(k==="days"||k==="time")?+v:v;
  save(); renderTour();
}
/* Tour versions of the stepper and toggle: same look, write through tourSet */
function tstep(key,label,vals,unit){ const v=String(wk[key]), arr=vals.map(String); let i=arr.indexOf(v); if(i<0) i=0;
  const b=(d,lab,sym)=>{ const j=i+d; return j<0||j>=arr.length?`<button type="button" disabled aria-label="${lab}">${sym}</button>`:`<button type="button" data-tk="${key}" data-v="${arr[j]}" aria-label="${lab} to ${arr[j]}">${sym}</button>`; };
  return `<div class="q tq"><span>${label}</span><div class="seg stepper">${b(-1,"Decrease","−")}<output>${arr[i]}${unit?`<small> ${unit}</small>`:""}</output>${b(1,"Increase","+")}</div></div>`; }
function ttoggle(key,label,onV="Yes",offV="No"){ const on=wk[key]===onV;
  return `<div class="q tgl"><span id="tt-${key}">${label}</span><div class="seg toggle"><button type="button" role="switch" aria-checked="${on}" aria-labelledby="tt-${key}" data-tk="${key}" data-v="${on?offV:onV}"><i aria-hidden="true"></i></button></div></div>`; }
function tchips(key,opts,val,cols){ return `<div class="seg tseg" role="radiogroup" style="grid-template-columns:repeat(${cols||opts.length},minmax(0,1fr))">${opts.map(([v,l])=>`<button type="button" role="radio" data-tk="${key}" data-v="${v}" aria-checked="${String(val)===String(v)}" aria-pressed="${String(val)===String(v)}">${l}</button>`).join("")}</div>`; }
function renderTour(focus){
  const el=document.getElementById("tour"), P=plan(), i=tour.i, inS=inSeason();
  const sportN=hasSport()?ACT[wk.mainSport].name:"", sw=sportN?sportN.toLowerCase():"sport";
  const rowsH=rows=>rows.map(([k,v,a])=>`<div class="trow"><span>${k}</span><b${a?' class="a"':""}>${esc(v)}</b></div>`).join("");
  const card=(t,b,hi)=>`<section class="tcard${hi?" hi":""}"><h3>${t}</h3>${b}</section>`;
  const lbl=t=>`<span class="tl">${t}</span>`;
  const tin=(k,l)=>`<label class="field" for="t-${k}"><span>${l}</span><input id="t-${k}" data-tw="${k}" inputmode="decimal" value="${esc(wk[k]??"")}"></label>`;
  const inc=incFor("Hip Thrust (Barbell)",{main:1},140);
  const S=[
   {tab:"Season",page:"Season",name:"Season",title:"Your split",
    text:"Pick your main sport and specify if you're in- or off-season. This determines the cadence for progressive overload and any accessory work.",
    body:card("Season",`${lbl("Main sport")}${tchips("sport",[["","None"],...SPORTS.map(a=>[a,ACT[a].name])],hasSport()?wk.mainSport:"",3)}${hasSport()?`${ttoggle("season","In-season","In-season","Off-season")}`:""}`,1)+card("Goal",rowsH([["Goal",wk.mode]]))},
   {tab:"Season",page:"Season",name:"Goal",title:"Pick a goal",
    text:"The goal, combined with your body settings, structures the cardio portion of lift days.",
    body:card("Goal",tchips("mode",[["Deficit only","Deficit"],["Recomp","Recomp"],["Build","Build"]],wk.mode),1)},
   {tab:"This week",page:"This week",name:"Your week",title:"Your week adjusts itself",
    text:"Different factors combine to adjust your week; if anything changes, the week changes too.",
    body:card("Schedule",`${tstep("days","Lifting days",inS?[1,2,3]:[1,2,3,4,5])}${tstep("time","Time per session",[30,45,60,75],"min")}${ttoggle("ss","Supersets")}`,1)
      +card("How you're doing",rowsH([["Readiness, soreness, drinks","Asked each week"]]))},
   {tab:"Day 1",page:"Day 1",name:"Lifting goals",title:"Specify lifting goals",
    text:"Hit the top or miss the bottom of your rep range to see future lifts adjust based on your goals.",
    body:card("Lifting focus",`${tchips("focus",[["Lower","Lower body"],["Balanced","Balanced"],["Upper","Upper body"]],wk.focus)}${rowsH([["Hip thrust · 4 × 6–10","140 lb × 10"],["Next time",inS?"140 lb · Hold":`${140+inc} lb · Up`,1]])}`,1)},
   {tab:"Season",page:"Profile",name:"Bio Data",title:"Tailor to your biometrics",
    text:"Set your bio data to see how things affect your metabolism, protein target & progressive overload.",
    body:card("Bio Data",`${tchips("sex",[["Female","Female"],["Male","Male"],["Other","Other"]],wk.sex)}<div class="nums two">${tin("height","Height (in)")}${tin("weight","Weight (lb)")}</div>`,1)}
  ];
  if(i>=5){
    el.innerHTML=`<div class="twelcome" role="dialog" aria-modal="true" aria-labelledby="tTitle">
      <h2 id="tTitle" tabindex="-1">I don't know you</h2>
      <p>You may not realize it, but all these things go into your ability to perform and improve over time. But I'm not a doctor. So try it out, but at the end of the day, you know yourself the best.</p>
      <p>Good luck!</p>
      <p class="wsig">Emma</p>
      <div class="tbtns two"><button type="button" class="tb ghost" id="tBack">Back</button><button type="button" class="tb" id="tNext">${tour.snap?"Got it":"Finish setup"}</button></div>
    </div>`;
    el.hidden=false; document.body.classList.add("touring");
    el.classList.toggle("step",!!focus); el.classList.toggle("opening",false);
    el.querySelector("#tBack").onclick=()=>{ tour.i=4; renderTour(true); };
    el.querySelector("#tNext").onclick=closeTour;
    if(focus) el.querySelector("#tTitle").focus({preventScroll:true});
    return;
  }
  if(i<0){
    el.innerHTML=`<div class="twelcome" role="dialog" aria-modal="true" aria-labelledby="tTitle">
      <span class="plab">Lift Board</span>
      <h2 id="tTitle" tabindex="-1">Welcome!</h2>
      <p>Thanks for trying this little program. I've never built anything for anyone else before. I hope you enjoy it.</p>
      <p class="wsig">Emma</p>
      <button type="button" class="tb" id="tNext">Take the tour</button>
      <button type="button" class="tskip" id="tSkip">${tour.snap?"Close":"Skip tour"}</button>
    </div>`;
    el.hidden=false; document.body.classList.add("touring");
    el.classList.toggle("step",!!focus); el.classList.toggle("opening",focus==="open");
    el.querySelector("#tSkip").onclick=closeTour;
    el.querySelector("#tNext").onclick=()=>{ tour.i=0; renderTour(true); };
    if(focus) el.querySelector("#tTitle").focus({preventScroll:true});
    return;
  }
  const s=S[i], last=i===S.length-1;
  const tabs=["Season","This week","Day 1",...(sportN&&!ACT[wk.mainSport].noMin?[sportN]:[])];
  el.innerHTML=`<div class="tscroll"><div class="tbody">
    <div class="ttabs" aria-hidden="true">${tabs.map(t=>`<span class="tab" aria-selected="${t===s.tab}">${t}</span>`).join("")}</div>
    <h2 class="tpage" aria-hidden="true">${s.page}</h2>
    ${s.body}
  </div></div>
  <div class="tdim" aria-hidden="true"></div>
  <div class="tpop" role="dialog" aria-modal="true" aria-labelledby="tTitle">
    <div class="ttop"><span class="plab">${i+1} of ${S.length} · ${s.name}</span><button type="button" class="tskip" id="tSkip">${tour.snap?"Close":"Skip tour"}</button></div>
    <p class="ttitle" id="tTitle" tabindex="-1">${s.title}</p>
    <p class="ttext">${s.text}</p>
    <div class="tbtns two"><button type="button" class="tb ghost" id="tBack">Back</button><button type="button" class="tb" id="tNext">Next</button></div>
  </div>`;
  el.hidden=false; document.body.classList.add("touring");
  el.classList.toggle("step",!!focus); el.classList.toggle("opening",focus==="open");
  el.querySelectorAll("[data-tk]").forEach(b=>b.onclick=()=>tourSet(b.dataset.tk,b.dataset.v));
  el.querySelectorAll("[data-tw]").forEach(x=>x.onchange=()=>{ wk[x.dataset.tw]=x.value; save(); renderTour(); });
  attachDials(el,dialCfg);
  el.querySelector("#tSkip").onclick=closeTour;
  const go=d=>{ tour.i+=d; renderTour(true); const sc=el.querySelector(".tscroll"); if(sc) sc.scrollTop=0; };
  const bk=el.querySelector("#tBack"); if(bk) bk.onclick=()=>go(-1);
  el.querySelector("#tNext").onclick=()=>go(1);
  if(focus) el.querySelector("#tTitle").focus({preventScroll:true});
}
document.addEventListener("keydown",e=>{ if(e.key!=="Escape") return; if(!document.getElementById("done").hidden) closeDone(); else if(tour) closeTour(); });
window.addEventListener("pagehide",()=>{ if(tour&&tour.snap){ const o=JSON.parse(tour.snap); Object.keys(wk).forEach(k=>delete wk[k]); Object.assign(wk,o); save(); } });
function resetConfirm(on){ document.getElementById("confirmBox").hidden=!on; document.getElementById("resetDay").hidden=on; }
document.getElementById("rest").onclick=()=>{clearInterval(restT);document.getElementById("rest").hidden=true;};
document.getElementById("toast").onclick=()=>{document.getElementById("toast").classList.remove("show");};
document.getElementById("resetDay").onclick=()=>{ const d=DAYS.find(x=>x.id===cur); askSure({title:`Reset ${d?d.tab:"this day"}`,text:"Clears every set you've logged today and reopens the day if it was marked done.",ok:"Reset day",onOk:()=>document.getElementById("confirmReset").click()}); };
document.getElementById("cancelReset").onclick=()=>resetConfirm(false);
document.getElementById("confirmReset").onclick=()=>{ if((wk.done||{})[cur]) markDone(cur); delete slots[cur]; save(); render(); resetConfirm(false); toast(["Day reset","Logs cleared and the day is open again."]); };
render();
if((!wk.setupDone&&!wk.tourDone)||location.hash==='#tour') openTour();
