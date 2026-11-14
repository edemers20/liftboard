import "./styles.css";
import { attachDials } from "./dial.js";
import { wTitle, e1rm, prsBetween, weekComplete, weekStreak, countWeek, EFF_MULT, OWN_EFF, weekActuals, swapOptions, swapDay, isBW, yogaMet, pilMet, cutting, XCAT, XGROUPS, catOf, addExtra, removeExtra, slotOrder, daySummary, logAct, defChoice, seasonSports, fixSports, resyncDone, ACT, ACT_IDS, ALL, CARDIO, CLIMB_MET, CUSTOM, DAYS, DEF, INTERVAL, KEY, KEY2, KEY3, L, PICKLE_MET, SPIN_MET, SPIN_MIN, SPORTS, STEADY, SUP, TAGTXT, YOGA_MET, actKey, cnt, dayDiff, deloadInfo, diffFx, enabled, esc, exHist, exName, fem, fx, get, hasSport, inSeason, incFor, init, isDB, isIso, kg, lastSet, markDone, minKey, newWeek, num, perMin, persist, plan, plannedMin, r5, range, review, roundW, save, set, setSaveHook, slots, split, suggest, syncDays, wk } from "./engine.js";

const storage=(()=>{ try{ const k="__t"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return localStorage; }catch(e){ const m=new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))}; } })();
init(storage);
setSaveHook(ok=>{ document.getElementById("saved").textContent= ok?"Saved":"Not saved (storage blocked)"; });
/* nav: the bottom tab. cur: "home", or the lift day / activity opened from Workouts */
const NAVS=["workouts","plan","history","you"];
let vtOpen=false, profOpen=false;
let nav="workouts", cur="home", planView="week", selOff=0, openSess=null, logMore=false;
/* what can be "your sport": the sports plus yoga and Pilates */
const MAINS=[...SPORTS,"yoga","pilates"];
const SEASONAL=a=>SPORTS.includes(a);
try{ const n=localStorage.getItem(KEY+".nav"); if(NAVS.includes(n)) nav=n; const t=localStorage.getItem(KEY+".tab"); if(t) cur=t; if(localStorage.getItem(KEY+".pv")==="season") planView="season"; }catch(e){}
const actTabs=()=>ACT_IDS.filter(a=>a!=="lift"&&enabled(a));
const rampOn=()=>hasSport()&&!inSeason()&&wk.ramp==="Yes";
const SUBS=()=>["home",...DAYS.map(d=>d.id),...(rampOn()?["zone2"]:[]),...actTabs()];
const TABS=SUBS;
if(!SUBS().includes(cur)) cur="home"; if(nav!=="workouts") cur="home";
/* pace moves to % of body weight: convert an old lb/week once */
if(wk.ratePct==null&&wk.rate!=null){ const pct=num(wk.rate,0.5)/num(wk.weight,150)*100, o=wk.mode==="Recomp"?[0.25,0.5,0.7]:[0.5,0.75,1]; wk.ratePct=String(o.reduce((a,x)=>Math.abs(x-pct)<Math.abs(a-pct)?x:a)); }

/* ---------- Info overlays ---------- */
const sportInfo=a=>ACT[a].noMin?"Counts toward cardio and cuts pulling volume.":`Counts toward cardio.${ACT[a].leg?" Leg-heavy weeks trim overlapping unilateral and quad sets.":""}${ACT[a].sh?" Long weeks shift a side delt set to rear delts.":""}`;
const INFO={
 acts:"Turns on each activity's tab and check-in question. Lifting off hides all lift days.",
 mainSport:"The sport your seasons revolve around. It decides which support lifts appear in-season.",
 focus:"Where extra sets and extra days go. Lower: more lower-body work. Upper: the reverse. Balanced: even.",
 season:"Off-season: full splits, weights go up. In-season: 1–3 full-body days, 2 sets each, no weight increases, support lifts for your sport.",
 ramp:"Adds one 45-min zone 2 session a week to build the aerobic base that prevents in-season fatigue.",
 deload:"One lighter week: about 60% of sets, ~90% weights, easy-pace cardio. Suggested after 6 off-season weeks or when 2+ main lifts stall.",
 mode:"Lose weight fast: fastest loss, up to 1% of your weight a week. Lose fat, keep strength: up to 0.7% a week with no more than 25% from cardio, so you hold your lifts. Maintain: eat what you burn. Build muscle: a small surplus with extra sets on your focus.",
 rate:"Target loss per week. Sets the weekly deficit at 3,500 kcal per lb. Up to 0.5% of your weight a week leaves room to keep building muscle; 0.5–0.7% holds muscle; faster than that, strength usually slips, so keep it short.",
 share:"How much of the deficit should come from cardio. The rest comes from food.",
 sex:"Changes resting metabolism and the minimum weight jump. Other uses the midpoint.",
 age:"Used for resting metabolism.", height:"Used for resting metabolism.",
 weight:"Used for metabolism, cardio burn and protein.",
 bf:"If set, resting metabolism uses lean mass, which is more accurate for muscular people.",
 steps:"Average daily steps, added to maintenance.",
 oura:"Replaces the maintenance estimate, minus 7% because wearables read high.",
 days:"Sets your split. 0 turns lift days off for now; focus decides where extra days go.",
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
 heated:"Heated adds roughly a third more calories.",
 yeff:"How hard the class usually is. Sets calories burned. Light classes don't count toward your core work; moderate and hard ones do, so the app eases off core accessories.",
 peff:"How hard the class usually is. Sets calories burned. Light classes don't count toward your core work; moderate and hard ones do, so the app eases off core accessories.",
 progress:"↑ Up: hit the top of the range, ~5% more on lower lifts, ~2.5% on upper. = Hold: same weight, one more rep. ↓ Down: missed the bottom twice, rebuild at −10%. ! Fatigue: reps fell 4+ across sets; rest longer.",
 changes:"Everything this week's check-in and activities changed, grouped by cause.",
 muscles:"Sets done this week against a target set by your focus and sports. Direct work counts 1 set; helper work counts ½ (a row also trains biceps and rear delts). The faint bar is what's still planned. Skip something and a later day brings back a trimmed exercise or adds a set; when a smaller muscle is already covered, its repeat on a later day becomes optional.",
 watch:"Targets and warnings to keep an eye on this week.",
 lifts:"Your top working set each session. The number is the latest weight; the change is since your first logged session.",
 freq:"Time spent each week on lifting, sports, classes and cardio, for the last 8 weeks (or since you started). Lifts use how long the workout took, rounded to 15 minutes; older lifts count as your session length. Activities use the minutes you logged.",
 weeks:"Saved when a new week begins on its own. Weigh-ins logged here calibrate maintenance after 3+ weeks.", spint:"Really hard burns more and adds 1 to recovery load.", ymin:"Class length."
};
SPORTS.forEach(a=>{ INFO[a]=sportInfo(a); INFO[minKey(a)]="Planned length per session."; });
INFO.climb="Each session counts as about 75 minutes toward cardio. Pulling and arm work on lift days is trimmed so you don't double up.";INFO.yoga="Counts toward cardio."; INFO.pilates="Counts toward cardio at a light, yoga-like burn."; INFO[minKey("pilates")]="Class length."; INFO.spin="Counts toward cardio. Hard weeks cut a quad set.";
const LBL={fuelHow:"How this is calculated",muscles:"Muscles",acts:"Activities",mainSport:"Main sport",focus:"Focus",season:"Season",ramp:"Ramp",deload:"Deload",mode:"Goal",rate:"Pace",share:"From cardio",sex:"Sex",age:"Age",height:"Height",weight:"Weight",bf:"Body fat",steps:"Steps",oura:"Daily burn",days:"Lifting days",time:"Session length",liftK:"Avg lift kcal",ready:"Readiness",sore:"Soreness",cycle:"Cycle",drink:"Drinking",load:"Recovery load",wAvg:"Avg weight",ymin:"Class length",heated:"Heated",yeff:"Effort",peff:"Effort",spint:"Intensity",today:"Today",ss:"Supersets",progress:"Progress",changes:"Changes",watch:"Watch",lifts:"Main lifts",weeks:"Previous weeks",maint:"Maintenance"};
ACT_IDS.forEach(a=>{ LBL[a]=ACT[a].name; LBL[minKey(a)]="Planned min"; });
const POP={}; let popN=0;
function hdr(title,keys,tag){ const id="p"+(++popN), t=tag||"h3";
  POP[id]=keys.filter(k=>INFO[k]).map(k=>`<p><b>${LBL[k]||k}:</b> ${INFO[k]}</p>`).join("");
  return `<${t} class="hdr">${title}<button type="button" class="ib" data-pop="${id}" aria-label="What these do" aria-expanded="false">i</button></${t}>`; }
function ib(k){ const id="p"+(++popN); POP[id]=`<p>${INFO[k]}</p>`; return `<button type="button" class="ib" data-pop="${id}" aria-label="What this does" aria-expanded="false">i</button>`; }
function seg(key,label,opts,val,solo,cls){ const v=val!==undefined?val:wk[key];
  return `<div class="q${cls?" q-"+cls:""}"><span>${label}${solo?ib(key):""}</span><div class="seg${cls?" "+cls:""}" data-key="${key}">${opts.map(o=>{const [ov,ol]=Array.isArray(o)?o:[o,o];return `<button type="button" aria-pressed="${String(v)===String(ov)}" data-v="${ov}">${key==="time"?ol+" min":ol}</button>`;}).join("")}</div></div>`; }
function stepper(key,label,vals,unit,val){ const v=String(val!==undefined?val:wk[key]), arr=vals.map(String); let i=arr.indexOf(v); if(i<0) i=0;
  const b=(d,lab,sym)=>{ const j=i+d; return j<0||j>=arr.length?`<button type="button" disabled aria-label="${lab}">${sym}</button>`:`<button type="button" data-v="${arr[j]}" aria-label="${lab} to ${arr[j]}${unit?" "+unit:""}">${sym}</button>`; };
  return `<div class="q"><span>${label}</span><div class="seg stepper" data-key="${key}">${b(-1,"Decrease","−")}<output aria-live="polite">${arr[i]}${unit?`<small> ${unit}</small>`:""}</output>${b(1,"Increase","+")}</div></div>`; }
function toggle(key,label,val,onV="Yes",offV="No"){ const on=String(val!==undefined?val:wk[key])===onV;
  return `<div class="q tgl"><span id="tg-${key}">${label}</span><div class="seg toggle" data-key="${key}"><button type="button" role="switch" aria-checked="${on}" aria-labelledby="tg-${key}" data-v="${on?offV:onV}"><i aria-hidden="true"></i></button></div></div>`; }
/* Units: everything is stored and calculated in lb. kg is display + input only: values convert on the way
   in (inputs, dial) and on the way out (a pass over rendered text that rewrites "150 lb" as "68 kg"). */
const KG=()=>wk.units==="kg", L2K=2.20462;
const toU=lb=>KG()?Math.round(+lb/L2K*2)/2:+lb, fromU=v=>KG()&&v!==""&&!isNaN(+v)?String(Math.round(+v*L2K*100)/100):v;
const U_KEYS=new Set(["weight","wAvg","rate"]);
function localize(root){
  if(!KG()||!root) return;
  root.querySelectorAll&&root.querySelectorAll('input[data-f="w"]:not([data-uc]),input[data-w]:not([data-uc])').forEach(el=>{
    if(el.dataset.w&&!U_KEYS.has(el.dataset.w)) return; el.dataset.uc=1;
    const conv=v=>v!==""&&!isNaN(+v)?(el.dataset.w==="rate"?String(Math.round(+v/L2K*100)/100):String(toU(v))):v;
    if(el.value) el.value=conv(el.value); if(el.placeholder) el.placeholder=conv(el.placeholder); });
  root.querySelectorAll&&root.querySelectorAll("[data-nudge]:not([data-uc])").forEach(b=>{ b.dataset.uc=1; b.textContent=b.textContent.replace(/[\d.]+/,String(toU(b.dataset.nudge))); });
  const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const ns=[]; while(tw.nextNode()) ns.push(tw.currentNode);
  ns.forEach(n=>{ const t=n.nodeValue; if(!/\blb\b/.test(t)) return;
    n.nodeValue=t.replace(/(\d[\d,]*(?:\.\d+)?)(\s?)lb\b/g,(m,x,sp)=>{ const v=+x.replace(/,/g,""); return `${Math.abs(v)<5&&/\./.test(x)?Math.round(v/L2K*100)/100:toU(v)}${sp}kg`; }).replace(/\blb\b/g,"kg"); });
}
new MutationObserver(ms=>{ if(!KG()) return; ms.forEach(m=>{ m.addedNodes.forEach(n=>{ if(n.nodeType===1) localize(n); else if(n.nodeType===3&&n.parentNode) localize(n.parentNode); }); if(m.type==="characterData"&&m.target.parentNode) localize(m.target.parentNode); }); }).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
function fld(key,label,mode,ph,cls,val){ return `<label class="field${cls?" "+cls:""}" for="${key}"><span>${label}</span><input id="${key}" data-w="${key}" inputmode="${mode||"numeric"}" placeholder="${ph||""}" value="${esc((val!==undefined?val:wk[key])??"")}"></label>`; }

/* Goal values stay as stored; these are the words people see */
const GOALS=[["Deficit only","Lose weight fast"],["Recomp","Lose fat, keep strength"],["Maintain","Maintain"],["Build","Build muscle"]];
const GOAL_SUB={"Deficit only":"Fastest loss, up to 1% of your weight a week. Your lifts may slip.",Recomp:"Steady loss, up to 0.7% of your weight a week, while you hold your lifts. Cardio covers at most a quarter of the deficit.",Maintain:"Eat what you burn and keep training as normal.",Build:"Eat a little over what you burn. Extra sets go to your focus area."};
const goalName=v=>(GOALS.find(g=>g[0]===v)||[v,v])[1];
function draftDirty(){ return !!draft&&Object.keys(draft).some(k=>JSON.stringify(draft[k])!==JSON.stringify(wk[k])); }
/* ---------- Your plan: live summary built from the engine's output ---------- */
const capF=s=>s.charAt(0).toUpperCase()+s.slice(1);
/* Your plan as a fill-in-the-blanks sentence. Strings are plain words; [id,value] pairs are the filled-in blanks. */
const andList=a=>a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1];
function planSentence(P){
  const M=P.math, inS=inSeason(), lift=enabled("lift"), n=DAYS.length, S=[];
  const sport=hasSport()?seasonSports().map(a=>ACT[a].name.toLowerCase()).join(" and "):"";
  const days=[["days",`${n} ${inS?"full-body ":""}lift day${n===1?"":"s"}`]];
  if(lift&&!n) S.push("No lift days are planned, so ",["aim","your other activity carries the week"],". ");
  if(lift&&n){
    if(wk.deload==="Yes"){ S.push("This is a ",["deload","lighter deload week"],": about 60% of your usual sets with ",...days,". "); }
    else if(inS){
      const sp=Object.keys(SUP).filter(k=>seasonSports().some(a=>SUP[k].includes(a))).map(k=>({calves:"calf",adductor:"adductor",cuff:"rotator cuff"})[k]);
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
  const goal={"Deficit only":"lose weight fast",Recomp:"lose fat and keep strength",Maintain:"maintain your weight",Build:"build muscle"}[wk.mode]||"lose fat";
  S.push("To ",["goal",goal],", fuel with about ",["eat",`${r5(M.intake).toLocaleString()} calories`]," and ",["protein",`${M.protein[0]}–${M.protein[1]} g of protein`]," a day");
  if(M.cardioTarget>0) S.push(", and burn ",["cardio",`${r5(M.cardioTarget).toLocaleString()} calories`]," in cardio each week");
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

const TAGICON={up:"↑",hold:"",down:"↓",collapse:"!"};
/* "Overhead Press (Barbell): 30lb x 8": the weight and rep target for next time; only notes that change what you do are kept */
const nextLine=r=>{ const U=KG()?"kg":"lb", w=r.bw?(+r.w>0?`BW+${toU(r.w)}${U}`:"BW"):`${toU(r.w)}${U}`, note=/^(hold|~?\d+ reps|\+5 lb|add a rep|same weight)/.test(r.why||"")?"":String(r.why||"").replace(/ · \d+\/\d+ sets$/,"");
  return `<b>${esc(r.n)}</b>: <span class="mono">${w}${r.r?` x ${r.r}`:""}</span>${note?` <small>${esc(note)}</small>`:""}`; };
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
    if(d.f==="w") return {label:slot&&isBW(exName(day,slot,+d.i))?"Added weight":"Weight",min:0,max:KG()?270:600,step:KG()?0.5:2.5,unit:KG()?"kg":"lb",start:(prev.w?toU(prev.w):0)||(+el.placeholder>0?el.placeholder:toU(slot?startW(exName(day,slot,+d.i),slot):45))};
    return {label:"Reps",min:0,max:40,step:1,start:prev.r||(slot?range(slot.reps)[1]:10)};
  }
  if(d.k==="act") return {label:"Actual minutes",min:0,max:120,step:1,unit:"min",start:el.placeholder};
  if(d.act) return {label:"Actual minutes",min:0,max:360,step:1,unit:"min",start:el.placeholder};
  const k=d.w||d.tw; if(!k) return null;
  if(DIAL[k]&&KG()&&U_KEYS.has(k)) return k==="rate"?{...DIAL[k],max:1,step:0.1,unit:"kg"}:{...DIAL[k],min:30,max:180,step:0.1,unit:"kg",start:k==="wAvg"&&!el.value?toU(wk.weight):el.placeholder||el.value};
  if(DIAL[k]) return {...DIAL[k],start:DIAL[k].start??(k==="wAvg"?wk.weight:el.placeholder)};
  if(/min$/.test(k)) return {label:"Planned minutes",min:15,max:360,step:5,unit:"min",start:el.placeholder};
  return null;
}
/* ---------- Navigation: Workouts · Plan · History · You ----------
   Workouts is home (a week strip and the selected day). Lift days and activity screens open
   on top of it with a back link; the bottom nav hides there so the rest timer has the space. */
const NAV=[["workouts","Workouts",`<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>`],["plan","Plan",`<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>`],["history","History",`<path d="M4 19V11M10 19V5M16 19v-6M22 19H2"/>`],["you","You",`<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>`]];
function renderNav(){
  const n=document.getElementById("bnav"), show=wk.setupDone&&!(nav==="workouts"&&cur!=="home");
  n.hidden=!show; document.body.classList.toggle("hasnav",show);
  n.innerHTML=NAV.map(([id,l,ic])=>`<button type="button" data-nav="${id}"${nav===id?' aria-current="page"':""}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic}</svg>${l}</button>`).join("");
  n.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{ closeSheet(); closePop(); const id=b.dataset.nav;
    const same=id===nav&&cur==="home", dir=NAV_IDS.indexOf(id)>NAV_IDS.indexOf(nav)?"fwd":"back";
    swapView(same?null:dir,()=>{ if(id==="workouts"&&nav==="workouts") selOff=0; nav=id; cur="home"; keepNav(); render(); window.scrollTo(0,0); }); });
}
function keepNav(){ try{ localStorage.setItem(KEY+".nav",nav); localStorage.setItem(KEY+".tab",cur); localStorage.setItem(KEY+".pv",planView); }catch(e){} }

/* ---------- Week model: lifts are a queue on your usual lift days; dates are projected, never stored ---------- */
const DAY0=t=>{ const d=new Date(t); d.setHours(0,0,0,0); return d; };
const addD=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const monIdx=d=>(d.getDay()+6)%7;
function weekStartOf(t){ const d=DAY0(t); return addD(d,-(wk.wkStart==="Sun"?d.getDay():monIdx(d))); }
const LDEF={0:[],1:[0],2:[0,3],3:[0,2,4],4:[0,2,4,6],5:[0,1,3,4,6],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]};
/* "Mark week as finished": the plan's week (wk.weekStart) moves to next week while the calendar week is still running */
const earlyDone=()=>!!wk.weekStart&&wk.weekStart>weekStartOf(Date.now()).getTime();
const planOff=()=>earlyDone()?1:0;
function ldays(){ const n=DAYS.length, L=Array.isArray(wk.ldays)?wk.ldays:null; return L&&L.length===n?L.slice().sort():(LDEF[n]||[]).slice(); }
/* days you usually play or take a class (Monday = 0); which activity is up to you */
const adays=()=>Array.isArray(wk.adays)?wk.adays.slice().sort():[];
const WD=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const wdOf=d=>WD[monIdx(d)];
/* lift order: start with the carried-over lift (upNext), then continue in order */
function rotation(first){ const ids=DAYS.map(d=>d.id); let s=ids.indexOf(first); if(s<0) s=0; return ids.slice(s).concat(ids.slice(0,s)); }
function weekModel(off){
  off=off||0;
  const today=DAY0(Date.now()), W=addD(weekStartOf(today),7*off), tIdx=off===0?Math.round((today-W)/864e5):off>0?-1:7;
  const dates=[...Array(7)].map((_,i)=>addD(W,i)), end=addD(W,7).getTime();
  const sess=(wk.sessions||[]).filter(s=>s.t>=W.getTime()&&s.t<end);
  const byDay=dates.map(d=>sess.filter(s=>DAY0(s.t).getTime()===d.getTime()));
  const done=wk.done||{}, L=ldays(), plan0={};
  let todo=[], left=[];
  const E=earlyDone();
  if(off>=0&&!(E&&off===0)){
    const cur0=weekModel0();
    todo=off===(E?1:0)?cur0.todo:rotation(cur0.left[0]||cur0.next0);
    const from=off===0?tIdx:0, liftToday=off===0&&byDay[tIdx].some(s=>s.k==="lift"), slotsI=[];
    /* "Move to today" pins that lift to today; the rest of the queue keeps its order on the remaining days */
    const pin=off===0&&!liftToday?pinnedToday(todo):null;
    if(pin) plan0[tIdx]=pin;
    for(let i=from;i<7;i++){ if(i===tIdx&&(liftToday||pin)) continue; if(L.includes(monIdx(dates[i]))) slotsI.push(i); }
    const rest=pin?todo.filter(x=>x!==pin):todo;
    rest.forEach((id,j)=>{ if(j<slotsI.length) plan0[slotsI[j]]=id; }); left=rest.slice(slotsI.length);
  }
  return {W,dates,tIdx,byDay,plan:plan0,left,todo,off};
}
const pinnedToday=todo=>{ const p=wk.pinToday; return p&&p.d===dayKey(Date.now())&&todo.includes(p.id)?p.id:null; };
/* this week's queue, used to project next week too */
function weekModel0(){ const done=wk.done||{}, ids=DAYS.map(d=>d.id), first=wk.upNext&&!done[wk.upNext]?wk.upNext:(ids.find(id=>!done[id])||ids[0]);
  const todo=rotation(first).filter(id=>!done[id]);
  const m={todo,next0:ids[0],left:[]};
  const E=earlyDone(), today=DAY0(Date.now()), W=addD(weekStartOf(today),E?7:0), t=E?0:Math.round((today-W)/864e5), L=ldays();
  const liftToday=!E&&(wk.sessions||[]).some(s=>s.k==="lift"&&DAY0(s.t).getTime()===today.getTime());
  const pin=!E&&!liftToday?pinnedToday(todo):null;
  let n=pin?1:0; for(let i=t;i<7;i++){ if(i===t&&(liftToday||pin)) continue; if(L.includes(monIdx(addD(W,i)))) n++; }
  m.left=todo.slice(n);
  /* after this week's lifts, next week picks the rotation up where it left off */
  if(!m.left.length){ const last=todo[todo.length-1]||ids[ids.length-1], k=ids.indexOf(last); m.next0=ids[(k+1)%ids.length]||ids[0]; }
  return m;
}
const dayById=id=>DAYS.find(d=>d.id===id);
const actName=k=>k==="zone2"?"Zone 2":ACT[k]?ACT[k].name:k;
const keyOfAct=a=>a==="zone2"?"zAct":actKey(a);
const plannedOf=a=>a==="zone2"?1:cnt(a);
const loggedOf=a=>(wk[keyOfAct(a)]||[]).filter(x=>String(x??"").trim()!=="").length;
const actList=()=>[...actTabs(),...(rampOn()?["zone2"]:[])];
/* log an activity on a date: fills the next open session; a session beyond the plan raises the count */
function logActOn(a,t){
  const key=keyOfAct(a), arr=wk[key]||[], P=plannedOf(a); let n=-1;
  for(let i=0;i<P;i++) if(String(arr[i]??"").trim()===""){ n=i; break; }
  change(()=>{ if(n<0){ n=Math.max(P,arr.length); if(a!=="zone2") wk[a]=n+1; }
    logAct(key,n,String(a==="zone2"?45:plannedMin(a)),t); });
}
/* weeks start on their own: the first open after Monday (or Sunday) closes out last week */
/* lifts logged since the week started count as done, even if a week rollover cleared the flags */
function syncDoneFromSessions(){
  const ids=DAYS.map(d=>d.id), from=wk.weekStart||0; let fixed=0;
  (wk.sessions||[]).forEach(s=>{ if(s.k==="lift"&&s.t>=from&&ids.includes(s.id)&&!(wk.done||{})[s.id]){ wk.done={...(wk.done||{}),[s.id]:1}; wk.doneT={...(wk.doneT||{}),[s.id]:s.t}; fixed++; } });
  if(fixed){ if(wk.upNext&&wk.done[wk.upNext]) wk.upNext=null; delete wk.missedNote; save(); }
  /* a week rollover cleared the set logs of lifts done this week: rebuild them from the saved top sets
     (the top set repeated for the number of sets logged; exact per-set numbers weren't kept) */
  let rebuilt=0;
  (wk.sessions||[]).forEach(x=>{ const d=dayById(x.id); if(x.k!=="lift"||x.t<from||!d||!(wk.done||{})[x.id]) return;
    const idx=d.slots.map((_,i)=>i); if(idx.some(i=>((get(d.id,i).log)||[]).some(l=>l&&(l.d||l.w||l.r)))) return;
    const ex=sessEx(x); if(!ex.length) return;
    idx.forEach(i=>{ const sl=d.slots[i]; if(sl.cardio) return; const e=ex.find(y=>y.n===exName(d,sl,i)); if(!e||!(e.r>0)) return;
      set(d.id,i,"log",Array.from({length:Math.max(1,e.sets||1)},()=>({w:String(e.w),r:String(e.r),d:true}))); rebuilt++; });
  });
  if(rebuilt) save();
}
const FIN_KEY=KEY2+".preFinish";
function hasFinishSnap(){ try{ const x=JSON.parse(localStorage.getItem(FIN_KEY)||"null"); return !!x&&x.to===wk.weekStart; }catch(e){ return false; } }
function finishWeek(){
  const next=addD(weekStartOf(Date.now()),7).getTime();
  try{ localStorage.setItem(FIN_KEY,JSON.stringify({to:next,wk,slots})); }catch(e){}
  const s={lifts:DAYS.filter(d=>(wk.done||{})[d.id]).length,planned:DAYS.length,cardio:weekActuals(weekStartOf(Date.now()).getTime()).burn};
  newWeek(next); selOff=0; render(); weekDone(s);
}
function undoFinish(){
  let x=null; try{ x=JSON.parse(localStorage.getItem(FIN_KEY)||"null"); }catch(e){}
  if(!x||x.to!==wk.weekStart) return;
  const keep=wk.sessions||[]; /* anything logged since finishing stays */
  Object.keys(wk).forEach(k=>delete wk[k]); Object.assign(wk,x.wk,{sessions:keep});
  Object.keys(slots).forEach(k=>delete slots[k]); Object.assign(slots,x.slots);
  try{ localStorage.removeItem(FIN_KEY); }catch(e){}
  syncDays(); save(); syncDoneFromSessions(); render(); toast(["Week reopened"]);
}
function autoWeek(){
  if(!wk.setupDone) return null;
  const W=weekStartOf(Date.now()).getTime();
  if(!wk.weekStart){ wk.weekStart=W; save(); return null; }
  if(wk.weekStart>=W) return null;
  const s={lifts:DAYS.filter(d=>(wk.done||{})[d.id]).length,planned:DAYS.length,cardio:weekActuals(weekStartOf(wk.weekStart).getTime()).burn};
  newWeek(W); selOff=0; return s;
}

/* ---------- Workouts (home) ---------- */
const fmtDate=d=>d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
/* what the workout will look like: each exercise with its sets, reps and starting weight */
function exPreview(id){ const d=dayById(id); if(!d) return ""; const P=plan(), D=P.days[id];
  const rows=slotOrder(d).filter(i=>!D.slots[i].skip&&!d.slots[i].optional).map(i=>{ const sl=d.slots[i], A=D.slots[i], n=exName(d,sl,i);
    if(sl.cardio) return [n,A.min?`${A.min} min`:""];
    const t=suggest(d,sl,i,false,P); return [n,`${A.sets} × ${sl.reps}${t&&t.w?` · ${isBW(n)?"BW":toU(t.w)}`:""}`]; });
  return rows.length?`<div class="wex">${rows.map(([n,v])=>`<div><span>${esc(n)}</span><b>${esc(v)}</b></div>`).join("")}</div>`:""; }
function liftCard(eyebrow,id,body,kind){ const d=dayById(id); if(!d) return "";
  const canSwap=canSwapDay(id);
  return `<section class="wcard lift ${kind||""}"><div class="wtop"><span class="weye">${eyebrow}</span>${canSwap?`<button type="button" class="swapbtn sm" data-swap="${id}" aria-label="Swap ${esc(d.title)} for another workout"><svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>Swap</button>`:""}</div><h3>${esc(d.title)}</h3>${exPreview(id)}${body||""}</section>`; }
function sessCard(s,today){
  if(s.k==="lift"){ const all=sessEx(s), ex=all.slice(0,6), d=dayById(s.id), open=d&&(wk.doneT||{})[s.id]===s.t;
    return `<section class="wcard lift done${open?" tap":""}"${open?` data-open="${s.id}" role="button" tabindex="0" aria-label="${esc(s.title||"Lift")}, open workout"`:""}><span class="weye">Completed</span><h3>${esc(s.title||"Lift")}</h3>
      ${ex.length?`<div class="drows wo">${ex.map(x=>`<div class="prow"><span>${esc(x.n)}</span><b>${x.cardio?`${x.min?x.min+" min":"done"}`:fmtSet(x.n,x.w,x.r)}</b></div>`).join("")}${all.length>6?`<p class="small">+${all.length-6} more</p>`:""}</div>`:`<p class="wsub">No sets were saved for this one.</p>`}
</section>`; }
  const recent=Date.now()-s.t<15*60e3, a=s.k, open=openSess===s.t;
  const head=`<span class="weye">${recent?"Logged":"Done"}</span><span class="wcrow"><b class="wt">${esc(actName(a))}</b><span class="wmeta">${s.min?`${s.min} min`:""}</span></span>`;
  if(!open) return `<button type="button" class="wcard act" data-sess="${s.t}" aria-expanded="false" aria-label="${esc(actName(a))}${s.min?`, ${s.min} minutes`:""}. Tap to edit or delete">${head}</button>`;
  const effH=OWN_EFF.includes(a)?"":`<div class="weff"><span>How hard was it?</span><div class="seg" role="radiogroup" aria-label="How hard was it?">${["Easy","Moderate","Hard"].map(e=>`<button type="button" role="radio" data-seff="${s.t}" data-v="${e}" aria-checked="${(s.eff||"Moderate")===e}" aria-pressed="${(s.eff||"Moderate")===e}">${e}</button>`).join("")}</div></div>`;
  return `<section class="wcard act open"><button type="button" class="wcbtn" data-sess="${s.t}" aria-expanded="true">${head}</button>${effH}
    <div class="wedit"><label for="sm-${s.t}"><span>Minutes</span><input id="sm-${s.t}" data-smin="${s.t}" inputmode="numeric" value="${s.min||""}"></label>
    <button type="button" class="btn wdel" data-sdel="${s.t}">Delete</button><button type="button" class="btn wsave" data-ssave="${s.t}">Save</button></div></section>`;
}
function renderWorkouts(P){
  const off=Math.floor(selOff/7+(monIdx(new Date())===0&&wk.wkStart!=="Sun"?0:0)), today=DAY0(Date.now());
  const sel=addD(today,selOff), W0=weekStartOf(today), wOff=Math.floor((weekStartOf(sel)-W0)/6048e5+0.01);
  const M=weekModel(wOff), i=Math.round((DAY0(sel)-M.W)/864e5), isToday=selOff===0, past=sel<today;
  const cells=M.dates.map((d,k)=>{ const ss=M.byDay[k], lift=ss.some(s=>s.k==="lift"), act=ss.some(s=>s.k!=="lift"), pl=M.plan[k]!=null;
    const o=Math.round((d-today)/864e5), ap=!act&&o>=0&&adays().includes(monIdx(d));
    return `<button type="button" class="wcell${k===i?" on":""}${o===0?" now":""}${o<0?" past":""}" data-sel="${o}" aria-pressed="${k===i}" aria-label="${fmtDate(d)}${lift?", lift done":pl?", lift planned":""}${act?", activity":""}"><span>${"MTWTFSS"[monIdx(d)]}</span><b>${d.getDate()}</b><i class="dots">${lift?'<i class="dl"></i>':pl?'<i class="dp"></i>':""}${act?'<i class="da"></i>':ap?'<i class="dap"></i>':""}</i></button>`; }).join("");
  const lo=pagerMin(), hi=pagerMax(), pg=o=>o<lo||o>hi?`<div class="wpage" aria-hidden="true" inert></div>`:`<div class="wpage"${o===selOff?"":` aria-hidden="true" inert`}>${dayBody(P,o)}</div>`;
  return `<div class="thead wt"><div class="whead"><h1>Lift Board</h1><button type="button" class="todayb" data-sel="0"${isToday?" disabled":""}>Today</button></div>
  <div class="wstrip"><div class="wcells">${cells}</div></div>
  <div class="wday"><button type="button" class="wdstep" data-sel="${selOff-1}" aria-label="Previous day"${wOff<=-8&&i===0?" disabled":""}>‹</button><span>${isToday?"Today · ":""}${fmtDate(sel)}</span><button type="button" class="wdstep" data-sel="${selOff+1}" aria-label="Next day"${wOff>=1&&i===6?" disabled":""}>›</button></div></div>
  <div class="wpager"><div class="wtrack">${pg(selOff-1)}${pg(selOff)}${pg(selOff+1)}</div></div>`;
}
/* how far the day pager reaches: 8 weeks back to the end of next week */
function pagerMin(){ const t=DAY0(Date.now()), W=addD(weekStartOf(t),-56); return Math.round((W-t)/864e5); }
function pagerMax(){ const t=DAY0(Date.now()), W=addD(weekStartOf(t),13); return Math.round((W-t)/864e5); }
/* one day's content (banners, cards, activity chips, fuel): the Workouts pager renders the day and its neighbours */
function dayBody(P,o){
  const today=DAY0(Date.now()), sel=addD(today,o), W0=weekStartOf(today), wOff=Math.floor((weekStartOf(sel)-W0)/6048e5+0.01);
  const M=weekModel(wOff), i=Math.round((DAY0(sel)-M.W)/864e5), isToday=o===0, past=sel<today;
  const ss=M.byDay[i]||[], cards=[], pid=M.plan[i], liftDone=ss.some(s=>s.k==="lift");
  const banners=[];
  if(isToday){
    /* forgot to log yesterday? one tap fixes it */
    const y=i-1, yk=dayKey(addD(today,-1).getTime()), open=actList().filter(a=>loggedOf(a)<plannedOf(a));
    if((wk.remind||"On")==="On"&&y>=0&&!M.byDay[y].length&&open.length&&wk.remindSeen!==yk)
      banners.push(`<div class="wban"><p>Did you play or train yesterday?</p><div class="chips">${open.map(a=>`<button type="button" class="chip" data-yday="${a}">${esc(actName(a))}</button>`).join("")}<button type="button" class="chip ghost" data-yday="">No</button></div></div>`);
    /* played a leg-heavy sport today with a lower day queued: offer an upper day instead */
    const tk=dayKey(today.getTime()), pd=dayById(pid), legs=ss.find(s=>ACT[s.k]&&ACT[s.k].leg>=1), up=M.todo.find(id=>/^Upper/.test((dayById(id)||{}).title||""));
    if(pd&&/^Lower/.test(pd.title)&&legs&&up&&!(wk.swapKeep||{})[tk])
      banners.push(`<div class="wban"><p>You logged ${esc(actName(legs.k))} today. Swap ${esc(pd.title)} for ${esc(dayById(up).title)} so your legs can recover?</p><div class="chips"><button type="button" class="chip on" data-open="${up}">Swap</button><button type="button" class="chip ghost" data-keep="${tk}">Keep plan</button></div></div>`);
  }
  ss.filter(s=>s.k==="lift").forEach(s=>cards.push(sessCard(s)));
  if(pid&&!liftDone){
    const d=dayById(pid), started=((wk.wt||{})[pid]||{}).start, other=M.todo.find(id=>id!==pid);
    if(isToday) cards.push(liftCard("Today",pid,`<button type="button" class="btn primary wgo" data-open="${pid}">${started?"Continue workout":"Start workout"}</button>`));
    else cards.push(liftCard("Planned",pid,wOff===0?`<button type="button" class="btn wgo" data-move="${pid}">Move to today</button>`:"","planned"));
  }
  if(!pid&&!liftDone){
    const nk=Object.keys(M.plan).map(Number).find(k=>k>i), nextId=isToday?(M.todo[0]||null):null;
    /* the next planned lift: later this week, else the first one next week */
    let nOff=null, nWhen="";
    if(nk!=null){ nOff=Math.round((M.dates[nk]-today)/864e5); nWhen=nOff===1?"tomorrow":wdOf(M.dates[nk]); }
    else if(wOff===0){ const N=weekModel(1), k1=Object.keys(N.plan).map(Number).sort((a,b)=>a-b)[0]; if(k1!=null){ nOff=Math.round((N.dates[k1]-today)/864e5); nWhen=nOff===1?"tomorrow":nOff<7?wdOf(N.dates[k1]):N.dates[k1].toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"}); } }
    const link=nOff!=null?`<button type="button" class="wlink" data-sel="${nOff}">View next lift</button>`:"";
    if(isToday&&nextId&&!ss.length) cards.push(`<section class="wcard open"><span class="weye">Today</span><h3>Nothing planned</h3>${link}</section>`);
    else if(!past&&!ss.length) cards.push(`<section class="wcard open"><span class="weye">Open day</span><h3>Nothing planned</h3>${link}</section>`);
    else if(past&&!ss.length) cards.push(`<section class="wcard open"><span class="weye">Rest</span><h3>Nothing logged</h3></section>`);
  }
  ss.filter(s=>s.k!=="lift").forEach(s=>cards.push(sessCard(s)));
  if(!past&&adays().includes(monIdx(sel))&&!ss.some(s=>s.k!=="lift")) cards.push(`<section class="wcard act plan"><span class="weye">Activity day</span><p class="wsub">${isToday?"Played or took a class? Log it below.":"You usually play or take a class today."}</p></section>`);
  const canLog=wOff===0&&!(sel>today), acts=actList(), others=ACT_IDS.filter(a=>a!=="lift"&&!enabled(a));
  const logH=canLog&&(acts.length||others.length)?`<div class="wlog"><div class="chips" role="group" aria-label="Log activity">${acts.map(a=>`<button type="button" class="chip act" data-log="${a}"><i aria-hidden="true">+</i>${esc(actName(a))} ${plannedOf(a)>0?`<small>${loggedOf(a)} of ${plannedOf(a)}</small>`:loggedOf(a)?`<small>${loggedOf(a)}</small>`:""}</button>`).join("")}${others.length?`<button type="button" class="chip act ghost2" data-logmore aria-expanded="${logMore}"><i aria-hidden="true">${logMore?"−":"+"}</i>Other</button>`:""}</div>
    ${logMore&&others.length?`<div class="chips more">${others.map(a=>`<button type="button" class="chip act" data-logx="${a}"><i aria-hidden="true">+</i>${esc(ACT[a].name)}</button>`).join("")}</div>`:""}</div>`:"";
  const Mth=P.math, food=isToday&&wk.setupDone?`<button type="button" class="wfood" data-nav2="plan" aria-label="Fuel and recovery: open Plan"><div class="fr"><span class="frl">Fuel today</span><b>${r5(Mth.intake).toLocaleString()}<small>kcal</small></b></div>${recovHTML()}</button>`:"";
  return `${banners.join("")}<div class="wcards">${cards.join("")}</div>${logH}${food}`;
}
/* ---------- Plan: this week and the season ---------- */
function ckSummary(){ const s={None:"no soreness",Legs:"sore legs","Upper body":"sore upper body",Everything:"sore all over"}[wk.sore]||"";
  return [`Feeling ${wk.ready==="Low"?"low":"normal"}`,s,...(fem()&&wk.cycle&&wk.cycle!=="Not tracking"?[wk.cycle.toLowerCase()]:[]),...(wk.wAvg?[`${toU(wk.wAvg)} ${KG()?"kg":"lb"}`]:[])].filter(Boolean).join(", "); }
const ICON={done:`<svg role="img" aria-label="Done" width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="var(--line)"/><path d="M6 10.3l2.6 2.6L14 7.5" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next:`<svg role="img" aria-label="Next" width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="#6fd0b4"/><path d="M8.3 6.3L12 10l-3.7 3.7" stroke="#181513" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  open:`<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.25" stroke="var(--div)" stroke-width="1.5"/></svg>`};
function planRows(){
  const M=weekModel(planOff()), today=DAY0(Date.now()), R=[];
  const wdShort=d=>{ const o=Math.round((DAY0(d)-today)/864e5); return o===0?"Today":o===1?"Tomorrow":WD[monIdx(d)].slice(0,3); };
  const sessW=M.byDay.flat();
  DAYS.forEach(d=>{ if((wk.done||{})[d.id]){ const s=sessW.find(x=>x.k==="lift"&&x.id===d.id); R.push({o:s?s.t:0,k:"lift",id:d.id,title:d.title,sub:s?wdShort(new Date(s.t)):"Done",st:"done"}); } });
  M.todo.forEach((id,j)=>{ const d=dayById(id), k=Object.keys(M.plan).find(x=>M.plan[x]===id);
    R.push({o:k!=null?M.dates[k].getTime()+1:9e15+j,k:"lift",id,title:d.title,sub:k!=null?wdShort(M.dates[k]):"Doesn't fit this week",st:j===0?"next":"open"}); });
  sessW.filter(s=>s.k!=="lift").forEach(s=>R.push({o:s.t,k:"act",id:s.k,title:actName(s.k),sub:wdShort(new Date(s.t)),st:"done"}));
  const AD=adays(), freeAD=M.dates.map((d,i)=>i).filter(i=>i>=M.tIdx&&AD.includes(monIdx(M.dates[i]))&&!M.byDay[i].some(s=>s.k!=="lift"));
  let q=0; actList().forEach(a=>{ for(let i=loggedOf(a);i<plannedOf(a);i++){ const k=freeAD[q++]; R.push({o:k!=null?M.dates[k].getTime()+2:9.5e15,k:"act",id:a,title:actName(a),sub:k!=null?wdShort(M.dates[k]):"Any day",st:"open"}); } });
  return R.sort((a,b)=>a.o-b.o);
}
/* Recovery: hours until each half of the body has had its usual break.
   A lift needs 48h for what it trained (full body 36h each), sports load legs 24h per level of leg work,
   and a Low readiness check-in adds 12h. Nothing here changes the plan; it's a read-out. */
function recov(){
  const now=Date.now(), H=36e5, extra=wk.ready==="Low"?12:0, until={lower:0,upper:0};
  const hit=(part,t,h)=>{ if(h>0) until[part]=Math.max(until[part],t+(h+extra)*H); };
  (wk.sessions||[]).filter(x=>now-x.t<4*864e5).forEach(x=>{
    if(x.k==="lift"){ const ti=String(x.title||""); if(/^Lower/.test(ti)) hit("lower",x.t,48); else if(/^Upper/.test(ti)) hit("upper",x.t,48); else { hit("lower",x.t,36); hit("upper",x.t,36); } }
    else { const A=ACT[x.k]||{}; hit("lower",x.t,24*(A.leg||0)); if(A.sh||A.pull) hit("upper",x.t,24); } });
  const f=ms=>{ const h=Math.ceil((ms-now)/H); return h<=0?null:h; };
  return {lower:f(until.lower),upper:f(until.upper)};
}
function recovHTML(){ const R=recov(), c=(l,h)=>`<div class="rc${h?"":" ok"}"><span class="frl">${l}</span><b>${h?`${h}<small>h rest</small>`:"Ready"}</b></div>`;
  return c("Lower body",R.lower)+c("Upper body",R.upper); }
function renderPlan(P){
  const tog=`<div class="phead thead"><h1 class="pdate">${planView==="week"?(()=>{ const W=addD(weekStartOf(Date.now()),7*planOff()), E=addD(W,6), f=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); return `${f(W)} – ${W.getMonth()===E.getMonth()?E.getDate():f(E)}`; })():"Season"}</h1>
    <div class="pvtog" role="group" aria-label="Plan view"><button type="button" data-pv="week" aria-pressed="${planView==="week"}">Week</button><button type="button" data-pv="season" aria-pressed="${planView==="season"}">Season</button></div></div>`;
  return tog+`<div class="vsub">${planView==="season"?planSeason(P):planWeek(P)}</div>`;
}
function planWeek(P){
  const Mt=P.math, build=wk.mode==="Build"||wk.mode==="Maintain", nd=P.days[P.nextId];
  INFO.maint=Mt.useOura?`Your wearable's daily burn minus 7%, plus this week's cardio.`:`Resting ${r5(Mt.bmr)} + light movement ${r5(Mt.base-Mt.bmr)} + steps ${r5(Mt.stepsK)}${Mt.nLift?` + lifting ${r5(Mt.liftDay)} (${r5(wk.liftKAuto)} kcal a session, worked out weekly from how long your lifts take)`:""} + digestion ${r5(Mt.tef)}${wk.calibN?`, ${Mt.calib>=0?"+":""}${r5(Mt.calib)} calibrated from ${wk.calibN} weigh-ins`:""}. Your base is what you'd burn on a day with no training; it only moves when your body data or steps change. Fuel today = base + your training this week − your deficit.`;
  const ck=`<div class="panel ck"><div class="ckh"><h3>Weekly check-in</h3></div>
    ${seg("ready","Readiness",["Normal","Low"])}
    ${seg("sore","Soreness",["None","Legs","Upper body","Everything"])}
    ${fem()?seg("cycle","Cycle",["Not tracking","Period","Luteal","Other"]):""}
    ${seg("drink","Drinking nights",["0","1–2","3+"])}
    <div class="nums">${fld("wAvg","Avg weight","decimal","optional","sm")}</div>
    <button type="button" class="btn primary" id="ckSave">Save check-in</button></div>`;
  const rowsH=planRows().map(r=>`<button type="button" class="prow2" data-open="${r.id}"><i class="pdot ${r.k}${r.st==="done"?" d":""}"></i><span><b${r.st==="done"?' class="pdone"':""}>${esc(r.title)}</b><small>${esc(r.sub)}</small></span>${ICON[r.st]}</button>`).join("");
  const L=ldays(), inS=inSeason();
  const daysH=enabled("lift")?`<div class="ldays"><span class="plab">Lift days</span><div class="ldgrid" role="group" aria-label="Lift days">${"MTWTFSS".split("").map((c,k)=>`<button type="button" data-ld="${k}" aria-pressed="${L.includes(k)}" aria-label="${WD[k]}">${c}</button>`).join("")}</div>${inS?`<p class="small">In-season: up to 3.</p>`:""}</div>`:"";
  const AD=adays(), adH=`<div class="ldays ad"><span class="plab">Activity days</span><div class="ldgrid" role="group" aria-label="Activity days">${"MTWTFSS".split("").map((c,k)=>`<button type="button" data-ad="${k}" aria-pressed="${AD.includes(k)}" aria-label="${WD[k]}">${c}</button>`).join("")}</div></div>`;
  const vs=Mt.vsLast;
  INFO.fuelHow=`${INFO.maint}${build?"":`<br><br>Weekly deficit: ${r5(Mt.target).toLocaleString()} kcal.`}${Mt.nLift&&Mt.nFin?`<br>Remaining finishers: ${Mt.m} min × ${Mt.nFin}.`:""}`;
  const food=`<div class="panel food">${hdr("Fuel/Recover",["fuelHow"])}
    <div class="frrow"><div class="eat"><span>Fuel today</span><b>${r5(Mt.intake).toLocaleString()} <small>kcal</small></b></div>${recovHTML()}</div>
    <div class="ftiles"><div><span>Your base</span><b>${r5(Mt.everyday).toLocaleString()}</b></div><div><span>vs last week</span><b class="${vs>0?"up":vs<0?"dn":""}">${vs==null||Math.abs(vs)<5?"same":`${vs>0?"+":"−"}${Math.abs(vs)}/day`}</b></div><div><span>${build?"Goal":"Expected loss"}</span><b>${build?esc(goalName(wk.mode)):`${KG()?Math.round(Mt.rateEff/L2K*100)/100:Mt.rateEff} ${KG()?"kg":"lb"}/wk`}</b></div></div>
</div>`;
  const E=earlyDone(), nW=new Date(wk.weekStart||0).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const early=E?`<div class="panel wkfin"><p><b>Week finished.</b> This is next week's plan; it starts ${nW}. Anything you log before then counts toward it.</p>${hasFinishSnap()?`<button type="button" class="btn" id="undoFinish">Undo</button>`:""}</div>`:"";
  return `${early}${nd&&nd.restSuggest?`<p class="flag">Reps dropped two sessions in a row. Take a rest day before ${esc(dayById(P.nextId).title)}.</p>`:""}
  ${wk.ckDone?"":ck}
  <div class="panel plist"><h3>${E?"Next week's plan":"This week's plan"}</h3><div class="prows">${rowsH||`<p class="small">Nothing planned yet. Pick your usual lift days below.</p>`}</div>${daysH}${adH}</div>
  ${food}
  ${P.rules.length?`<div class="panel">${hdr("This week's changes",["changes"])}<ul>${P.rules.map(n=>`<li>${n}</li>`).join("")}</ul></div>`:""}
  ${P.notes.length?`<div class="panel">${hdr("Watch",["watch"])}<ul>${P.notes.map(n=>`<li>${n}</li>`).join("")}</ul></div>`:""}
  ${wk.ckDone?`<div class="ckline"><span><b>Check-in</b> · ${esc(ckSummary())}</span><button type="button" class="wlink ckedit" id="ckEdit" aria-label="Edit check-in"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg></button></div>`:""}
  ${E?"":`<button type="button" class="btn" id="finishWeek">Mark week as finished</button>`}`;
}
/* pace choices are a share of body weight; the lb figure follows your current weight */
const PACES={"Deficit only":[0.5,0.75,1],Recomp:[0.25,0.5,0.7]};
const paceOpts=m=>(PACES[m]||[]).map(p=>{ const lb=Math.round(p/100*num(wk.weight,150)*10)/10; return [String(p),`${p}% · ${KG()?Math.round(lb/L2K*10)/10+" kg":lb+" lb"}`]; });
function fitPace(){ const o=PACES[wk.mode]; if(!o) return; const p=+wk.ratePct, max=o[o.length-1]; if(!(p>0)) wk.ratePct=String(o[1]); else if(p>max) wk.ratePct=String(max); }
/* Pace is a scrolling picker in lb (or kg) a week, up to the goal's cap (1% or 0.7% of your weight). Stored as % of body weight. */
function paceWheel(){ const o=PACES[wk.mode], w=num(wk.weight,150), kg=KG(), step=kg?0.05:0.1, u=kg?"kg":"lb";
  const maxU=o[o.length-1]/100*w/(kg?L2K:1), vals=[]; for(let x=step*2;x<=maxU+1e-9;x+=step) vals.push(Math.round(x*100)/100);
  const curU=(+wk.ratePct||0.5)/100*w/(kg?L2K:1); let i=0; vals.forEach((x,k)=>{ if(Math.abs(x-curU)<Math.abs(vals[i]-curU)) i=k; });
  const pct=v=>(v*(kg?L2K:1)/w*100).toFixed(2);
  return `<div class="q"><span>Pace</span><div class="wheelw"><div class="wheel" tabindex="0" role="spinbutton" aria-label="Pace per week" aria-valuenow="${vals[i]}" aria-valuetext="${vals[i]} ${u} a week" data-wheel data-i="${i}" data-u="${u}" data-vals="${vals.join(",")}">
    ${vals.map((x,k)=>`<div class="wit${k===i?" on":""}" data-k="${k}">${x.toFixed(kg?2:1)} <small>${u} / week</small></div>`).join("")}</div></div>
    <small class="wpct" data-wpct>${pct(vals[i])}% of your weight a week</small></div>`; }
function bindWheel(v){ const wh=v.querySelector("[data-wheel]"); if(!wh) return;
  const its=[...wh.querySelectorAll(".wit")], vals=wh.dataset.vals.split(",").map(Number), u=wh.dataset.u, H=44, w=num(wk.weight,150), kg=u==="kg";
  let idx=+wh.dataset.i, t=0; wh.scrollTop=idx*H;
  const pctEl=v.querySelector("[data-wpct]"), clamp=i=>Math.max(0,Math.min(vals.length-1,i));
  const paint=i=>{ its.forEach((x,k)=>x.classList.toggle("on",k===i)); if(pctEl) pctEl.textContent=`${(vals[i]*(kg?L2K:1)/w*100).toFixed(2)}% of your weight a week`;
    wh.setAttribute("aria-valuenow",vals[i]); wh.setAttribute("aria-valuetext",`${vals[i]} ${u} a week`); };
  const commit=i=>{ if(i===idx) return; idx=i; const lb=vals[i]*(kg?L2K:1); change(()=>{ wk.ratePct=String(+(lb/w*100).toFixed(4)); }); };
  wh.onscroll=()=>{ const i=clamp(Math.round(wh.scrollTop/H)); paint(i); clearTimeout(t); t=setTimeout(()=>commit(i),220); };
  const go=i=>wh.scrollTo({top:clamp(i)*H,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  wh.onkeydown=e=>{ const d={ArrowUp:-1,ArrowDown:1}[e.key]; if(d==null) return; e.preventDefault(); go(Math.round(wh.scrollTop/H)+d); };
  its.forEach((x,k)=>x.onclick=()=>go(k)); }
function planSeason(P){
  const inS=inSeason(), loss=!!PACES[wk.mode], dl=deloadInfo();
  return `${planHTML(P)}
  <div class="panel">${hdr("Season",["season","ramp","deload"])}
    ${hasSport()&&SEASONAL(wk.mainSport)?`${toggle("season","In-season",undefined,"In-season","Off-season")}${inS?"":toggle("ramp","Season starts in ≤6 weeks")}`:`<p class="note">${hasSport()?`${esc(ACT[wk.mainSport].name)} doesn't have a season, so lifting stays the same all year.`:"Pick a main sport under You to use seasons."}</p>`}
    ${DAYS.length?`${dl.length&&wk.deload!=="Yes"?`<p class="flag">Deload suggested · ${dl.join(", ")}</p>`:""}${toggle("deload","Deload this week")}`:""}</div>
  <div class="panel">${hdr("Goal",["mode","rate","share"])}
    <div class="seg two" data-key="mode">${GOALS.map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${wk.mode===v}">${l}</button>`).join("")}</div>
    <details class="fmath"><summary>Goal definitions</summary>${GOALS.map(([v,l])=>`<p class="small"><b>${l}.</b> ${GOAL_SUB[v]}</p>`).join("")}</details>
    ${loss?`${paceWheel()}
    <div class="nums">${fld("share","From cardio %","numeric","","sm")}</div>`:""}
    ${enabled("lift")?`<div class="q"><span>Lifting focus</span>${seg("focus","",[["Lower","Lower body"],["Balanced","Balanced"],["Upper","Upper body"]])}</div>`:""}</div>`;
}

/* ---------- You: profile, preferences, app settings, data ---------- */
/* FAQ (mirrors the launch plan doc) */
const HOW=[["How is my plan built?", "You pick a goal, a focus, your usual lift days and the activities you do. Lift Board picks a split (which days train what), then adjusts sets each week for your sports and classes, your check-in and what you already trained that week."], ["How does my week get scheduled?", "Lifts line up in order on your usual lift days. Miss one and the rest slide forward. Anything that doesn't fit carries into next week, which starts where you left off. Move to today pulls a planned lift onto today. Activities aren't tied to a day: log them from Workouts whenever you do them. Usual activity days only mark when you tend to play."], ["When does a new week start?", "On its own, on Monday or Sunday (You → App → Week starts on). Your weekly check-in reopens at the top of Plan."], ["Forgot to log something?", "Tap that day on Workouts and log it there. If the next-morning check is on, Workouts also asks \"Did you play or train yesterday?\" when the day before is empty. Tap a logged activity to change its minutes or delete it."], ["Which goal should I pick?", "Lose weight fast: up to 1% of your weight a week, and your lifts may slip. Lose fat, keep strength: up to 0.7% a week while you hold your lifts, with no more than a quarter of the deficit from cardio. Maintain: eat what you burn. Build muscle: eat a little more, with extra sets on your focus. Pace is a share of your body weight, so the pounds follow your weight."], ["Why did my weights change?", "Hit the top of your rep range and the weight goes up next time. Land inside the range and you aim for one more rep. Miss the range and you hold the weight. Miss twice when you're not on a cut and it drops about 10% so you can build back up. A new exercise starts from a guess based on a similar one you've done."], ["What does \"hold\" mean on a cut?", "When you're losing more than about 0.5% of your body weight a week, keeping your numbers is the win. A missed rep keeps the weight. It only eases 5% after three misses in a row, and accessories lose a set before any weight comes off."], ["How is fuel calculated?", "Your base is what you'd burn on a day with no training: resting burn, light movement, steps and digestion. Fuel today is your base plus this week's training, minus the gap your goal sets. After three weigh-ins the app checks its estimate against how your weight is actually moving. Food never drops so low that there isn't energy left for training."], ["How is recovery counted?", "Each half of your body gets a countdown. A Lower or Upper lift needs 48 hours for what it trained, and full-body days need 36 for both. Sports count against your legs (up to 48 hours for running or soccer); racquet sports and climbing also tire your upper body for a day. A Low readiness check-in adds 12 hours. It's a guide; it doesn't move your plan."], ["How long should I rest?", "Main lifts 2:30 (3:00 at 5 reps or fewer), other compound lifts 1:30, isolation 1:15. One side at a time adds 15 seconds and the first set adds 30. A cut, in-season or a rough day each add 15 seconds to compound lifts, up to 30. Tap the left or right side of the rest bar to take off or add 15 seconds; it remembers for that exercise. The chime may not play with the phone locked."], ["What does experience change?", "How many tips you see. Beginner and Some Experience show tips; Advanced hides them, and (i) explanations stay either way. Change it in You → Training preferences."], ["Bodyweight exercises?", "Leave the weight blank. Add a number only if you hold extra weight. Progress comes from reps, slower lowering or added weight."], ["How is Avg week breakdown counted?", "Lifts use how long the workout took, rounded to 15 minutes. Lifts logged before that was saved count as your session length. Activities use the minutes you logged."], ["Moving to a new phone?", "You → Your data → Download backup, then Restore backup on the new phone. With accounts, signing in will do this for you."], ["Is this medical advice?", "No. These are general estimates. Check with a doctor before big changes, especially if you're pregnant, injured or managing a health condition."]];
/* the top of You reads like a profile: who you are, since when, what you've done */
function profileHero(){
  const S=wk.sessions||[], lifts=S.filter(x=>x.k==="lift").length, acts=S.length-lifts;
  const first=Math.min(...[wk.createdAt,...S.map(x=>x.t),wk.weekStart].filter(Boolean)), since=isFinite(first)?new Date(first).toLocaleDateString("en-US",{month:"short",year:"numeric"}):"This week";
  const weeks=new Set(S.map(x=>weekStartOf(x.t).getTime())).size;
  const name=String(wk.name||"").trim(), initial=(name||"You").slice(0,1).toUpperCase();
  /* every sport and activity you do; your main sport first */
  const mine=ACT_IDS.filter(a=>a!=="lift"&&enabled(a)).sort((a,b)=>(b===wk.mainSport)-(a===wk.mainSport));
  const tag=(t,c)=>t?`<span class="ptag ${c}">${esc(t)}</span>`:"";
  return `<section class="phero" aria-label="Your profile">
    <div class="pav" aria-hidden="true">${esc(initial)}</div>
    <div class="pwho"><h2>${esc(name||"You")}</h2><p>Member since ${since}</p></div>
    ${mine.length?`<div class="ptags" aria-label="Your sports and activities">${mine.map(a=>tag(`${ACT[a].name}${a===wk.mainSport&&inSeason()?" · in-season":""}`,"sp")).join("")}</div>`:""}
    <div class="pstats"><div><b>${lifts}</b><span>Lifts</span></div><div><b>${acts}</b><span>Activities</span></div><div><b>${weeks}</b><span>Weeks active</span></div></div>
  </section>`;
}
/* profile at a glance: big values, small labels */
function profileGrid(){
  const h=num(wk.height,0), w=num(wk.weight,0), st=num(wk.steps,0);
  const T=(v,l,cls)=>v?`<div class="pt${cls?" "+cls:""}"><span>${l}</span><b>${v}</b></div>`:"";
  const goal=(GOALS.find(g=>g[0]===wk.mode)||[])[1]||"", lvl=(LEVELS.find(l=>l[0]===wk.level)||[])[1]||"";
  const focus=({Lower:"Lower body",Upper:"Upper body",Balanced:"Balanced"})[wk.focus]||"";
  const ht=h?(KG()?`${Math.round(h*2.54)}<small>cm</small>`:`${Math.floor(h/12)}′${Math.round(h%12)}″`):"";
  return `<div class="pgrid">${T(esc(goal),"Goal","w txt")}${T(esc(lvl),"Experience","w txt")}${enabled("lift")&&focus?T(esc(focus),"Lifting focus","w txt"):""}${T(ldays().length&&enabled("lift")?`${ldays().length}<small>/wk</small>`:"","Lift days","w")}
    ${T(ht,"Height")}${T(w?`${KG()?Math.round(w/L2K*10)/10:w}<small>${KG()?"kg":"lb"}</small>`:"","Weight")}${T(wk.bf?`${esc(wk.bf)}<small>%</small>`:"","Body fat")}
    ${T(st?`${(st/1000).toFixed(st%1000?1:0)}<small>k</small>`:"","Steps / day")}${T(wk.age?esc(wk.age):"","Age")}${T(wk.sex?esc(wk.sex):"","Sex","txt")}</div>`;
}
function xpSlider(v){
  return `<div class="q"><span id="xpLbl">Experience</span><div class="seg slider xp" data-key="level" role="radiogroup" aria-labelledby="xpLbl">${LEVELS.map(([k,l])=>`<button type="button" role="radio" data-v="${k}" aria-checked="${v===k}" aria-pressed="${v===k}"><i aria-hidden="true"></i><span>${l}</span></button>`).join("")}</div></div>`;
}
function renderYou(P){
  return `${profileHero()}
  <section class="panel pcard">${profileGrid()}
  <details id="profileBox"${profOpen||draftDirty()?" open":""}><summary class="psum">Edit profile</summary>${profileHTML(false,{...wk,...(draft||{})})}<button class="btn primary" id="profSave" type="button"${draftDirty()?"":" disabled"}>Save changes</button></details></section>
  ${enabled("lift")?`<div class="panel">${hdr("Training preferences",["ss"])}
    ${xpSlider(wk.level||(wk.guide==="Less"?"years":"some"))}
    ${stepper("time","Session length",[30,45,60,75],"min")}
    ${toggle("ss","Supersets")}
    ${toggle("stretch","Stretching after lifts")}
    ${toggle("sound","Rest timer sound",wk.sound||"Yes")}${(wk.sound||"Yes")==="Yes"?`<button type="button" class="btn mini" data-testsound>Play test sound</button>`:""}</div>`:""}
  <div class="panel"><h3>App</h3>
    ${seg("units","Units",[["lb","lb"],["kg","kg"]],wk.units||"lb",0,"sw2")}
    ${seg("guide","Tips",[["More","More"],["Less","Fewer"]],wk.guide||"More",0,"sw2")}
    ${seg("wkStart","Week starts on",[["Mon","Mon"],["Sun","Sun"]],wk.wkStart||"Mon",0,"sw2")}
    ${seg("remind","Next-morning check",[["On","On"],["Off","Off"]],wk.remind||"On",0,"sw2")}</div>
  <div class="panel"><h3>FAQ</h3>${HOW.map(([q,a])=>`<details class="how"><summary>${esc(q)}</summary><p class="small">${esc(a)}</p></details>`).join("")}</div>
  <div class="panel"><h3>Your data</h3><p class="small">Everything lives on this phone only. Download a backup now and then; restoring replaces what's here.</p>
    <div class="foot" style="margin:0"><button class="btn" id="bkDown" type="button">Download backup</button><label class="btn" for="bkFile">Restore backup<input id="bkFile" type="file" accept="application/json,.json" hidden></label></div></div>
  ${moveHTML()}
  <p class="small disclaimer">Lift Board gives general training and nutrition estimates, not medical advice. Check with a doctor before big changes, especially if you're pregnant, injured or managing a health condition.</p>
  <div class="foot season-foot"><button class="btn" id="replayTour" type="button">Replay tour</button><button class="btn" id="resetProfile" type="button">Reset profile</button></div>`;
}
/* an activity you logged: change its minutes, or "" to delete it */
function sessWrite(t,val){
  const x=(wk.sessions||[]).find(s=>s.t===t); if(!x) return;
  const [key,n,ws]=String(x.src||"").split(":"), live=x.src&&String(wk.weekStart||0)===ws;
  if(live) change(()=>logAct(key,+n,val));
  else change(()=>{ wk.sessions=val===""?(wk.sessions||[]).filter(s=>s.t!==t):(wk.sessions||[]).map(s=>s.t===t?{...s,min:num(val,0)}:s); });
}
/* handlers for the new screens; called from bind() */
function bindShell(v){
  v.querySelectorAll("[data-sel]").forEach(b=>b.onclick=()=>goDay(+b.dataset.sel));
  v.querySelectorAll("[data-wk]").forEach(b=>b.onclick=()=>{ let o=selOff+ +b.dataset.wk; const t=DAY0(Date.now()), s=addD(t,o); if(weekStartOf(s).getTime()===weekStartOf(t).getTime()) o=0; goDay(o); });
  /* Day pager: the day's content follows your finger and settles on the previous or next day; the date line stays put.
     The M–Sun strip swipes a week at a time. */
  const pager=v.querySelector(".wpager"), track=pager&&pager.querySelector(".wtrack");
  if(pager&&nav==="workouts"&&cur==="home"){ bindPager(pager,track); bindStripSwipe(v.querySelector(".wstrip")); }
  v.querySelectorAll("[data-open]").forEach(b=>{ const go=e=>{ if(e) e.stopPropagation(); const id=b.dataset.open; if(!(dayById(id)||ACT[id]||id==="zone2")) return;
      const card=b.closest(".wcard"), run=()=>{ nav="workouts"; cur=id; keepNav(); render(); window.scrollTo(0,0); };
      /* the card morphs into the workout's header where the browser supports view transitions */
      if(card&&document.startViewTransition&&!matchMedia("(prefers-reduced-motion: reduce)").matches){ card.style.viewTransitionName="lbopen"; vtOpen=true; document.documentElement.dataset.vt="open";
        const t=document.startViewTransition(run); t.finished.finally(()=>{ vtOpen=false; delete document.documentElement.dataset.vt; const h=document.querySelector(".dayhead"); if(h) h.style.viewTransitionName=""; }); }
      else run(); };
    b.onclick=go; if(b.getAttribute("role")==="button") b.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(e); } }; });
  v.querySelectorAll("[data-nav2]").forEach(b=>b.onclick=()=>{ nav=b.dataset.nav2; planView="week"; cur="home"; keepNav(); render(); window.scrollTo(0,0); });
  v.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>{ const from=cur, run=()=>{ cur="home"; keepNav(); render(); window.scrollTo(0,0);
      const c=document.querySelector(`.wcard [data-open="${from}"]`), card=c&&c.closest(".wcard")||document.querySelector(`.wcard[data-open="${from}"]`); if(card) card.style.viewTransitionName="lbopen"; };
    /* closing shrinks the page back into its card */
    const h=document.querySelector(".dayhead");
    if(h&&document.startViewTransition&&!matchMedia("(prefers-reduced-motion: reduce)").matches){ h.style.viewTransitionName="lbopen"; document.documentElement.dataset.vt="close";
      const t=document.startViewTransition(run); t.finished.finally(()=>{ delete document.documentElement.dataset.vt; document.querySelectorAll(".wcard").forEach(x=>x.style.viewTransitionName=""); }); }
    else run(); });
  v.querySelectorAll("[data-log]").forEach(b=>b.onclick=()=>{ const a=b.dataset.log, sel=addD(DAY0(Date.now()),selOff), t=selOff===0?Date.now():sel.getTime()+12*36e5; openSess=t; logActOn(a,t); });
  const lm=v.querySelector("[data-logmore]"); if(lm) lm.onclick=()=>{ logMore=!logMore; render(); };
  /* logging something new turns it on as an activity, so it shows up in Plan and here next time */
  v.querySelectorAll("[data-logx]").forEach(b=>b.onclick=()=>{ const a=b.dataset.logx, sel=addD(DAY0(Date.now()),selOff), t=selOff===0?Date.now():sel.getTime()+12*36e5;
    /* a one-off: remembered so deleting its only log removes the activity again */
    logMore=false; wk.acts={...(wk.acts||{}),[a]:true}; wk.adhoc={...(wk.adhoc||{}),[a]:true}; wk[a]=0; openSess=t; logActOn(a,t); toast([`${ACT[a].name} logged`]); });
  v.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{ const id=b.dataset.move; wk.pinToday={d:dayKey(Date.now()),id}; save(); selOff=0; render(); window.scrollTo({top:0,behavior:"smooth"}); toast([`${(dayById(id)||{}).title||"Lift"} moved to today`]); });
  v.querySelectorAll("[data-yday]").forEach(b=>b.onclick=()=>{ const a=b.dataset.yday, y=addD(DAY0(Date.now()),-1); wk.remindSeen=dayKey(y.getTime()); if(a) logActOn(a,y.getTime()+12*36e5); else { save(); render(); } });
  v.querySelectorAll("[data-keep]").forEach(b=>b.onclick=()=>{ wk.swapKeep={...(wk.swapKeep||{}),[b.dataset.keep]:1}; save(); render(); });
  v.querySelectorAll("[data-sess]").forEach(b=>b.onclick=()=>{ const t=+b.dataset.sess; openSess=openSess===t?null:t; render(); if(openSess){ const i=document.getElementById("sm-"+t); if(i) i.focus({preventScroll:true}); } });
  v.querySelectorAll("[data-ssave]").forEach(b=>b.onclick=()=>{ const t=+b.dataset.ssave, i=document.getElementById("sm-"+t); openSess=null; sessWrite(t,(i&&i.value.trim())||"0"); });
  v.querySelectorAll("[data-sdel]").forEach(b=>b.onclick=()=>{ const t=+b.dataset.sdel, x=(wk.sessions||[]).find(s=>s.t===t); openSess=null; sessWrite(t,"");
    /* deleting the only log of a one-off activity removes the activity too, so it leaves Plan and the chips */
    if(x&&(wk.adhoc||{})[x.k]&&!(wk.sessions||[]).some(s=>s.k===x.k)){ change(()=>{ wk.acts={...(wk.acts||{}),[x.k]:false}; wk[x.k]=0; const h={...wk.adhoc}; delete h[x.k]; wk.adhoc=h; fixSports(wk); }); }
    if(x) toast([`${actName(x.k)} deleted`]); });
  v.querySelectorAll("[data-seff]").forEach(b=>b.onclick=()=>{ const t=+b.dataset.seff, e=b.dataset.v; change(()=>{ wk.sessions=(wk.sessions||[]).map(s=>s.t===t?{...s,eff:e}:s); }); });
  v.querySelectorAll("[data-smin]").forEach(i=>i.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); const t=+i.dataset.smin; openSess=null; sessWrite(t,i.value.trim()||"0"); } });
  v.querySelectorAll("[data-pv]").forEach(b=>b.onclick=()=>{ const to=b.dataset.pv; if(to===planView) return; swapView(to==="season"?"subfwd":"subback",()=>{ planView=to; keepNav(); render(); }); });
  v.querySelectorAll("[data-ld]").forEach(b=>b.onclick=()=>{ const k=+b.dataset.ld, L=ldays(), on=L.includes(k), nL=on?L.filter(x=>x!==k):L.concat([k]).sort();
    if(!on&&inSeason()&&nL.length>3){ toast(["In-season","Up to 3 lift days so you stay fresh for games."]); return; }
    change(()=>{ wk.ldays=nL; wk.days=nL.length; syncDays(); }); });
  v.querySelectorAll("[data-ad]").forEach(b=>b.onclick=()=>{ const k=+b.dataset.ad, A=adays(); wk.adays=A.includes(k)?A.filter(x=>x!==k):A.concat([k]).sort(); save(); render(); });
  v.querySelectorAll("input[data-cnt]").forEach(el=>el.onchange=()=>{ const a=el.dataset.cnt, n=Math.max(0,Math.min(7,parseInt(el.value)||0)); change(()=>{ wk[a]=n; }); });
  const cs=v.querySelector("#ckSave"); if(cs) cs.onclick=()=>{ wk.ckDone=true; save(); render(); toast(["Check-in saved","This week's plan is set."]); };
  const ce=v.querySelector("#ckEdit"); if(ce) ce.onclick=()=>{ wk.ckDone=false; save(); render(); window.scrollTo({top:0,behavior:"smooth"}); };
}

/* ---------- Rendering ---------- */
function tabName(id){ if(id==="week") return "This week"; if(id==="zone2") return "Zone 2"; if(id==="history") return "History"; if(id==="season") return wk.setupDone?"Season":"Setup"; if(ACT[id]) return ACT[id].name; return DAYS.find(d=>d.id===id).tab; }
const themeOf=id=>DAYS.some(d=>d.id===id)?"th-green":(ACT[id]||id==="zone2")?"th-pink":"th-orange";
let draft=null;
function profileHTML(withGoal,src){
  src=src||wk;
  const en=a=>!!(src.acts||{})[a], hs=!!src.mainSport&&en(src.mainSport);
  const sports=MAINS.filter(en);
  const F=(k,l,m,ph)=>fld(k,l,m,ph,"",src[k]);
  const G=h=>`<div class="pgroup">${h}</div>`;
  return `<div class="pgroups">${G(`${hdr("Activities",["acts","mainSport",...(hs?["season"]:[])])}
  <div class="seg">${ACT_IDS.map(a=>`<button type="button" class="actt" data-actt="${a}" aria-pressed="${en(a)}">${ACT[a].name}</button>`).join("")}</div>`)}
  ${sports.length?G(`<div class="q"><span>Sports in season<small> · up to two. Tap a picked sport again to make it primary.</small></span><div class="seg sportseg">${[["","None"],...sports.map(a=>[a,ACT[a].name])].map(([a,l])=>{ const p=a&&src.mainSport===a, q=a&&src.sport2===a, on=a?p||q:!src.mainSport;
    return `<button type="button" data-sp="${a}" aria-pressed="${!!on}">${l}${p&&src.sport2?`<small class="prim">primary</small>`:""}</button>`; }).join("")}</div></div>
  ${withGoal&&hs?toggle("season","In-season",src.season,"In-season","Off-season"):""}`):""}
  ${en("lift")?G(`${hdr("Lifting",withGoal?["focus","days"]:["focus"])}${withGoal?stepper("days","Lifting days",(src.season==="In-season"&&hs?[0,1,2,3]:[0,1,2,3,4,5,6,7]),"",src.days):""}${String(src.days)==="0"?"":seg("focus","Focus",[["Lower","Lower body"],["Balanced","Balanced"],["Upper","Upper body"]],src.focus)}`):""}
  ${withGoal?G(`${hdr("Goal",["mode"])}${seg("mode","Goal",GOALS)}`):""}
  ${G(`${hdr("Bio Data",["sex","age","height","weight","bf","steps","oura"])}
  ${seg("sex","Sex",["Female","Male","Other"],src.sex)}
  <div class="nums">${withGoal?"":F("name","Name","text","optional")}${F("age","Age")}${F("height","Height (in)","decimal")}${F("weight","Weight (lb)","decimal")}${F("bf","Body fat %","decimal","optional")}${F("steps","Steps / day")}${F("oura","Daily burn","numeric","optional")}</div>`)}</div>`;
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
/* One line under the goal saying what the chosen pace means for muscle */
function paceNote(P){ const M=P.math, pct=(M.pace||0)*100; if(!M.rateEff) return "";
  const t=pct<=0.5?"Muscle-friendly pace: room to keep building.":pct<=0.7?"Faster pace: expect to hold muscle and strength, not build.":"Aggressive pace: strength will likely slip. Best kept short.";
  return `<br><br><b>Your pace:</b> ${M.rateEff} lb/week is ${pct.toFixed(2)}% of your weight. ${t}`; }
const RATE_INFO=INFO.rate;
function renderSeason(P){
  if(!wk.setupDone) return `<div class="dayhead"><h2>Setup</h2></div>${planHTML(P)}<div class="panel">${profileHTML(true)}<button class="btn primary" id="setupSave" type="button">Save setup</button></div>${moveHTML()}`;
  const inS=inSeason(), build=wk.mode==="Build"||wk.mode==="Maintain", dl=deloadInfo();
  const seasonBox=hasSport()?`${toggle("season","In-season",undefined,"In-season","Off-season")}
    ${inS?"":toggle("ramp","Season starts in ≤6 weeks")}
`:`<p class="note">Pick a main sport in Profile to use seasons.</p>`;
  return `<div class="dayhead"><h2>Season</h2></div>
  ${planHTML(P)}
  <div class="panel">${hdr("Season",["season","ramp","deload"])}
    ${seasonBox}
    ${DAYS.length?`${dl.length&&wk.deload!=="Yes"?`<p class="flag">Deload suggested · ${dl.join(", ")}</p>`:""}${toggle("deload","Deload this week")}`:""}
  </div>
  ${(INFO.rate=RATE_INFO+(build?"":paceNote(P)),"")}<div class="panel">${hdr("Goal",["mode","rate","share"])}
    ${seg("mode","Goal",GOALS)}
    ${build?"":`<div class="nums two">${fld("rate","Lose lb / week","decimal")}${fld("share","From cardio %")}</div>`}
  </div>
  ${enabled("lift")?`<div class="panel">${hdr("Training preferences",["ss"])}
    ${toggle("ss","Supersets")}
    ${toggle("stretch","Stretching after lifts")}
    ${toggle("sound","Rest timer sound",wk.sound||"Yes")}${(wk.sound||"Yes")==="Yes"?`<button type="button" class="btn mini" data-testsound>Play test sound</button>`:""}</div>`:""}
  <div class="panel" id="profileBox"><h3>Profile</h3>${profileHTML(false,{...wk,...(draft||{})})}<button class="btn primary" id="profSave" type="button"${draftDirty()?"":" disabled"}>Save changes</button></div>
  ${moveHTML()}
  <div class="panel"><h3>Units</h3>${seg("units","",[["lb","Pounds (lb)"],["kg","Kilograms (kg)"]],wk.units||"lb")}</div>
  <div class="panel"><h3>Tips</h3>${seg("guide","",[["More","More guidance"],["Less","Fewer tips"]],wk.guide||"More")}<p class="small">${(wk.guide||"More")==="Less"?"No first-visit tips, shorter change popups and no reasons under exercises. Watch notes and (i) explanations stay.":"First-visit tips on each tab, full change popups and the reason behind each exercise change."}</p></div>
  <div class="panel"><h3>Your data</h3><p class="small">Everything lives on this phone only. Download a backup now and then; restoring replaces what's here.</p>
    <div class="foot" style="margin:0"><button class="btn" id="bkDown" type="button">Download backup</button><label class="btn" for="bkFile">Restore backup<input id="bkFile" type="file" accept="application/json,.json" hidden></label></div></div>
  <p class="small disclaimer">Lift Board gives general training and nutrition estimates, not medical advice. Check with a doctor before big changes, especially if you're pregnant, injured or managing a health condition.</p>
  <div class="foot season-foot"><button class="btn" id="replayTour" type="button">Replay tour</button><button class="btn" id="resetProfile" type="button">Reset profile</button></div>`;
}
/* ---------- History: calendar of sessions, previous weeks, main lifts ---------- */
let histView="cal", calOff=0, calSel=null;
try{ const h=localStorage.getItem(KEY+".hv"); if(h) histView=h; }catch(e){}
const dowOf=t=>(new Date(t).getDay()+6)%7, dayKey=t=>{ const d=new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const sessName=x=>x.k==="lift"?(x.title||"Lift"):x.k==="zone2"?"Zone 2":(ACT[x.k]?ACT[x.k].name:x.k);
/* Avg week breakdown: time in each kind of training, one stacked bar per week (last 8 weeks).
   Lifts without a saved duration count as your session length; activities use the minutes you logged. */
const MIX=[["lift","Lifting","var(--lift)"],["sport","Activity","var(--act)"],["cls","Classes","#b9a3f0"],["cardio","Cardio","#fea06a"]];
function mixKind(x){ if(x.k==="lift") return "lift"; if(x.k==="zone2") return "cardio"; const A=ACT[x.k]; return A&&A.sport?"sport":A&&A.cls?"cls":"cardio"; }
function mixMin(x){ if(x.k==="lift") return num(x.min,0)||num(wk.time,60); return num(x.min,0)||(ACT[x.k]?plannedMin(x.k):45); }
function freqHTML(S){
  const W0=weekStartOf(Date.now()), first=S.length?weekStartOf(S[0].t):W0, N=Math.max(1,Math.min(8,Math.round((W0-first)/6048e5)+1));
  const weeks=[...Array(N)].map((_,i)=>{ const W=addD(W0,-7*(N-1-i)), E=addD(W,7), m={lift:0,sport:0,cls:0,cardio:0};
    S.filter(x=>x.t>=W.getTime()&&x.t<E.getTime()).forEach(x=>{ m[mixKind(x)]+=mixMin(x); }); return {W,m,tot:Object.values(m).reduce((a,b)=>a+b,0)}; });
  const max=Math.max(60,...weeks.map(w=>w.tot)), hrs=n=>{ const h=n/60; return h>=10?Math.round(h)+"h":(Math.round(h*2)/2).toString().replace(/\.5$/,"½").replace(/^0½$/,"½")+"h"; };
  const done=weeks.slice(0,-1).filter(w=>w.tot), avg=done.length?done.reduce((a,w)=>a+w.tot,0)/done.length:0;
  const used=MIX.filter(([k])=>weeks.some(w=>w.m[k]));
  return `<div class="panel">${hdr("Avg week breakdown",["freq"])}
    <p class="note">Hours a week by kind of training${avg?` · about ${hrs(avg)} a week`:""}</p>
    <div class="mix" role="img" aria-label="${weeks.map(w=>`Week of ${w.W.toLocaleDateString("en-US",{month:"short",day:"numeric"})}: ${MIX.filter(([k])=>w.m[k]).map(([k,l])=>`${l} ${Math.round(w.m[k])} min`).join(", ")||"nothing logged"}`).join(". ")}">
    ${weeks.map((w,i)=>`<div class="mixc${i===N-1?" now":""}"><span class="mixt">${w.tot?hrs(w.tot):""}</span><div class="mixb" style="height:${w.tot/max*112}px">${MIX.map(([k,,c])=>w.m[k]?`<i style="flex:${w.m[k]} 1 0;background:${c}"></i>`:"").join("")}</div><span class="mixl">${i===N-1?"Now":w.W.toLocaleDateString("en-US",{month:"numeric",day:"numeric"})}</span></div>`).join("")}</div>
    ${used.length?`<div class="legend">${used.map(([,l,c])=>`<span style="--c:${c}">${l}</span>`).join("")}</div>`:""}
  </div>`;
}
/* A logged session's exercises; older sessions are rebuilt from lift history (last logged set). */
/* top sets for a logged lift: saved with the session, else rebuilt from exercise history (same timestamp), else today's logged sets */
function sessEx(x){ const own=(x.ex||[]).slice();
  if(!own.length&&x.id&&(wk.doneT||{})[x.id]===x.t){ const L=daySummary(x.id); if(L.length) return L; }
  const fromHist=Object.entries(exHist).map(([n,h])=>{ const e=(h||[]).find(y=>y.t===x.t); return e&&!own.some(o=>o.n===n)?{n,w:e.w,r:e.r}:null; }).filter(Boolean);
  return own.concat(fromHist); }
function calHTML(){
  const S=(wk.sessions||[]).slice().sort((a,b)=>a.t-b.t);
  const now=new Date(), m0=new Date(now.getFullYear(),now.getMonth()+calOff,1), y=m0.getFullYear(), mo=m0.getMonth();
  const lead=(m0.getDay()+6)%7, nd=new Date(y,mo+1,0).getDate(), by={};
  S.forEach(x=>{ const k=dayKey(x.t); (by[k]=by[k]||[]).push(x); });
  const todayK=dayKey(now.getTime());
  let cells=""; for(let i=0;i<lead;i++) cells+=`<span class="cd pad" aria-hidden="true"></span>`;
  for(let d=1;d<=nd;d++){ const k=`${y}-${mo}-${d}`, L=by[k]||[], lab=new Date(y,mo,d).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
    const dots=L.slice(0,3).map(x=>`<i class="${x.k==="lift"?"l":"a"}"></i>`).join("");
    const kind=L.some(x=>x.k==="lift")?(L.some(x=>x.k!=="lift")?" both":" lift"):L.length?" act":"";
    cells+=`<button type="button" class="cd${k===todayK?" today":""}${L.length?" has":""}${kind}" data-cd="${k}" aria-pressed="${calSel===k}" aria-label="${lab}${L.length?": "+L.map(sessName).join(", "):""}"${L.length?"":" disabled"}><span>${d}</span></button>`; }
  const sel=calSel&&by[calSel]?by[calSel]:null;
  const selD=sel?new Date(sel[0].t).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"}):"";
  const selT=sel?[...new Set(sel.map(x=>x.k==="lift"?(x.title&&x.title!=="Lift"?(wTitle(x.title).match(/\((.+)\)$/)||[0,wTitle(x.title)])[1]:"Lift"):sessName(x)))].join(" + "):"";
  return `${S.length?freqHTML(S):""}
  <div class="panel">
    <div class="calhead"><button type="button" class="btn sm calnav" data-cal="-1" aria-label="Previous month">‹</button><h3>${m0.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h3><button type="button" class="btn sm calnav" data-cal="1" aria-label="Next month"${calOff>=0?" disabled":""}>›</button></div>
    <div class="cal"><span class="cw">M</span><span class="cw">T</span><span class="cw">W</span><span class="cw">T</span><span class="cw">F</span><span class="cw">S</span><span class="cw">S</span>${cells}</div>
    ${sel?`<div class="calsel" id="calsel"><span class="plab">${selD}</span><h3>${esc(selT)}</h3>${sel.map(x=>`<div class="csx">${x.k!=="lift"&&(sel.length>1||x.min)?`<span class="cs ${x.k==="lift"?"l":"a"}">${esc(sessName(x))}${x.min?` · ${x.min} min`:""}</span>`:""}${x.k==="lift"?workoutRows(sessEx(x)):""}</div>`).join("")}</div>`:""}
    ${S.length?"":`<p class="note">Sessions show up here when you finish a lift day or enter minutes for an activity.</p>`}
  </div>`;
}
let openLift=null;
/* weekly top sets for one exercise, oldest first, with PR marks by the same rule as the engine */
function liftWeeks(n){ const h=(exHist[n]||[]).filter(x=>x&&x.t).sort((a,b)=>a.t-b.t), by=new Map();
  h.forEach(x=>{ const k=weekStartOf(x.t).getTime(), c=by.get(k); if(!c||num(x.w,0)>num(c.w,0)||(num(x.w,0)===num(c.w,0)&&num(x.r,0)>num(c.r,0))) by.set(k,x); });
  const rows=[...by.entries()].sort((a,b)=>a[0]-b[0]).map(([k,x])=>({k,w:num(x.w,0),r:num(x.r,0),e:e1rm(x.w,x.r)}));
  let maxW=-1; const seen=[]; rows.forEach(x=>{ x.pr=seen.length>0&&(x.w>maxW||seen.some(p=>p.w<=x.w)&&x.r>Math.max(0,...seen.filter(p=>p.w>=x.w).map(p=>p.r))); seen.push(x); maxW=Math.max(maxW,x.w); });
  return rows; }
const spark1=rows=>{ const v=rows.slice(-8).map(x=>x.e), n=v.length, lo=Math.min(...v), hi=Math.max(...v);
  const pts=v.map((e,j)=>[n>1?4+j*88/(n-1):48, hi===lo?16:28-(e-lo)/(hi-lo)*24].map(z=>+z.toFixed(1)));
  return `<svg class="spark" width="96" height="32" viewBox="0 0 96 32" aria-hidden="true"><polyline points="${pts.map(p=>p.join(",")).join(" ")}"/><circle cx="${pts[n-1][0]}" cy="${pts[n-1][1]}" r="3"/></svg>`; };
function liftsHTML(){
  const names=Object.keys(exHist).filter(n=>(exHist[n]||[]).some(x=>x&&x.t)), now=Date.now();
  const prs=prsBetween(now-28*864e5,now+864e5).slice(0,8), U=KG()?"kg":"lb";
  INFO.liftsTip=`<b>1RM</b> is an estimate of the most you could lift once, worked out from your top set (weight × (1 + reps ÷ 30)). It's for tracking trends; you never need to test it.<br><br><span class="tipdb">${DUMBBELL}</span> Your top set: the heaviest set you did that week.<br>Shown for the last 8 weeks.`;
  return `${prs.length?`<div class="panel prsec"><h3>Recent PRs</h3><div class="prcards">${prs.map(x=>`<div class="prc"><span class="prk">${esc(x.kind==="Heaviest top set"?"Top set":"Reps")}</span><span class="prn">${esc(x.n)}</span><b>${fmtSet(x.n,x.w,x.r)}</b><small>${new Date(x.t).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</small></div>`).join("")}</div></div>`:""}
  <div class="panel"><h3 class="lhead">Main lifts${ib("liftsTip")}</h3>
   ${names.length?names.map(n=>{ const rows=liftWeeks(n), last=rows[rows.length-1], back=rows.filter(x=>x.k>=now-56*864e5)[0]||rows[0], dw=last.w-back.w, open=openLift===n;
     return `<div class="lrow${open?" open":""}"><button type="button" class="lbtn" data-lx="${esc(n)}" aria-expanded="${open}"><span class="lcopy"><span class="ln2">${esc(n)}</span>
       <span class="ltop"><span role="img" aria-label="Top set">${DUMBBELL}</span><span class="mono">${fmtSet(n,last.w,last.r)}</span>${rows.length>1?`<span class="${dw>0?"up":""}">${dw>0?"+":dw<0?"−":"±"}${Math.abs(dw)} ${U} in 8 wk</span>`:""}</span></span>${rows.length>1?spark1(rows):""}</button>
       ${open?`<div class="ltab"><div class="lth"><span>Week of</span><span>Top set</span><span>1RM</span></div>${rows.slice(-8).reverse().map(x=>`<div class="ltr"><span>${new Date(x.k).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span><span class="mono">${fmtSet(n,x.w,x.r)}</span><span class="mono${x.pr?" pr":""}">${isBW(n)&&!x.w?"–":x.e}${x.pr?" PR":""}</span></div>`).join("")}</div>`:""}</div>`; }).join(""):`<p class="note">Appears after you finish a lift day.</p>`}
  </div>`;
}
const FLAME=`<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
const DUMBBELL=`<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/></svg>`;
/* "Nov 2 – 8" or "Oct 26 – Nov 1" */
function wkRange(t){ const a=new Date(t), b=addD(a,6), m=d=>d.toLocaleDateString("en-US",{month:"short"});
  return m(a)===m(b)?`${m(a)} ${a.getDate()} – ${b.getDate()}`:`${m(a)} ${a.getDate()} – ${m(b)} ${b.getDate()}`; }
function musclesHTML(M){ if(!M||!M.length) return "";
  const gap=M.map(([n,d,t])=>[n,t-d]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1])[0];
  return `<div class="mbars2">${M.map(([n,d,t])=>`<div class="mbar2"><span>${esc(n)}</span><i><b style="width:${Math.min(100,d/Math.max(1,t)*100)}%" class="${d>=t?"ok":"low"}"></b></i><em class="${d>=t?"":"low"}">${d}/${t}</em></div>`).join("")}</div>
    ${gap?`<p class="small">${esc(gap[0])} came in ${gap[1]} set${gap[1]===1?"":"s"} under target.</p>`:""}`; }
let openWeek=null;
function weeksHTML(){
  const W=wk.weeks||[], H=W.slice().reverse(), run=weekStreak();
  const strip=W.slice(-8).map(w=>`<span class="flame${weekComplete(w)?" on":""}">${FLAME}</span>`).join("");
  return `${W.length?`<div class="streak"><div class="flames" aria-hidden="true">${strip}</div><span>${run?`${run} week${run===1?"":"s"} completed in a row`:"Start a new streak this week"}</span></div>`:""}
  <div class="panel">${hdr("Previous weeks",["weeks"])}
   ${H.length?`<div class="wlist">${H.map(w=>{ const A=weekActuals(w.start), bn=A.n>0?A.burn:w.cardio, ok=weekComplete(w), open=openWeek===w.start, byHand=w.counted&&!(w.planned>0&&w.lifts>=w.planned);
     return `<div class="wrow2${open?" open":""}"><button type="button" class="wtop2" data-wo="${w.start}" aria-expanded="${open}"><span class="wrng">${wkRange(w.start)}</span><span class="wpill${ok?" ok":""}">${ok?`✓ ${byHand?"Counted":"Completed"}`:`${w.lifts} of ${w.planned} lifts`}</span>
       <span class="wn3"><span><small>Lifts</small><b>${w.lifts}/${w.planned}</b></span><span><small>Sets</small><b>${w.sets??"–"}</b></span><span><small>Exercise kcal</small><b>${bn?Number(bn).toLocaleString():"–"}</b></span></span></button>
       ${open?`<div class="wmore">${w.muscles&&w.muscles.length?`<span class="plab">Sets by muscle</span>${musclesHTML(w.muscles)}`:""}
         ${!(w.planned>0&&w.lifts>=w.planned)?`<div class="wmiss"><span>${w.missed&&w.missed.length?`Missed ${esc(w.missed.join(" and "))}`:"Not every lift got done"}</span><button type="button" class="chip" data-wc="${w.start}">${w.counted?"Undo":"Count as completed"}</button></div>`:""}
         <p class="small">${w.season==="In-season"?"In-season":"Off-season"}${w.ramp?" · ramp":""}${w.deload?" · deload":""} · ${esc(goalName(w.mode))}${w.focus?` · ${esc(w.focus)} focus`:""}${w.w?` · ${w.w} lb`:""}</p></div>`:""}</div>`; }).join("")}</div>`:""}
  </div>`;
}
function renderHistory(){
  const V=[["cal","Calendar"],["weeks","Weeks"],["lifts","Lifts"]]; if(!V.some(x=>x[0]===histView)) histView="cal";
  const body=histView==="weeks"?weeksHTML():histView==="lifts"?liftsHTML():calHTML();
  return `<div class="thead"><div class="dayhead"><h2>History</h2></div>
  <div class="seg hseg" role="group" aria-label="History view">${V.map(([v,l])=>`<button type="button" data-hv="${v}" aria-pressed="${histView===v}">${l}</button>`).join("")}</div></div>
  <div class="vsub">${body}</div>`;
}
/* The weekly muscle ledger runs in the engine either way; this only controls whether This week shows it */
const SHOW_MUSCLES=false;
function renderWeek(P){
  const M=P.math, inS=inSeason(), build=wk.mode==="Build"||wk.mode==="Maintain", tot=Math.max(M.target,1);
  const pct=v=>Math.min(100,v/tot*100).toFixed(1);
  const nd=P.days[P.nextId];
  const others=ACT_IDS.filter(a=>a!=="lift"&&enabled(a));
  const acts=others.map(a=>stepper(a,ACT[a].name+" sessions",[0,1,2,3,4,5,6,7])).join("");
  INFO.maint=M.useOura?`Your wearable's daily burn minus 7%, plus this week's cardio.`:`Resting ${r5(M.bmr)} + light movement ${r5(M.base-M.bmr)} + steps ${r5(M.stepsK)}${M.nLift?` + lifting ${r5(M.liftDay)} (${r5(wk.liftKAuto)} kcal a session, worked out weekly from how long your lifts take)`:""} + digestion ${r5(M.tef)}${wk.calibN?`, ${M.calib>=0?"+":""}${r5(M.calib)} calibrated from ${wk.calibN} weigh-ins`:""}. Your base is what you'd burn on a day with no training; it only moves when your body data or steps change. Fuel today = base + your training this week − your deficit.`;
  return `<div class="dayhead"><h2>Weekly check-in</h2></div>
  ${nd&&nd.restSuggest?`<p class="flag">Reps dropped two sessions in a row. Take a rest day before ${DAYS.find(d=>d.id===P.nextId).tab}.</p>`:""}
  ${enabled("lift")?`<div class="panel">${hdr("Schedule",["days","time"])}
    ${stepper("days","Lifting days",inS?[0,1,2,3]:[0,1,2,3,4,5,6,7])}
    ${stepper("time","Time per session",[30,45,60,75],"min")}</div>`:""}
  <div class="panel">${hdr("How you're doing",["ready","sore",...(fem()?["cycle"]:[]),"drink","load","wAvg"])}
    ${seg("ready","Readiness",["Normal","Low"])}
    ${seg("sore","Soreness",["None","Legs","Upper body","Everything"])}
    ${fem()?seg("cycle","Cycle",["Not tracking","Period","Luteal","Other"]):""}
    ${seg("drink","Drinking nights",["0","1–2","3+"])}
    <div class="nums">${fld("wAvg","Avg weight","decimal","optional","sm")}</div></div>
  ${acts?`<div class="panel">${hdr("Other activity",others)}${acts}</div>`:""}
  <div class="panel">${hdr(esc(goalName(wk.mode)),["mode","maint"])}
    <div class="inset">
      <div class="k label">Fuel today</div>
      <p class="burn"><strong>${r5(M.intake).toLocaleString()}</strong> kcal</p>
      <p class="burn" style="font-size:14px">Your base is <strong style="font-size:inherit">${r5(M.everyday).toLocaleString()}</strong> kcal${M.useOura?" · wearable":wk.calibN?" · calibrated":" · estimated"}</p>
      ${M.vsLast!=null&&Math.abs(M.vsLast)>=20?`<p class="burn" style="font-size:13px"><strong style="font-size:inherit">${M.vsLast>0?"+":"−"}${Math.abs(M.vsLast)} a day vs last week</strong> (${M.vsLast>0?"+":"−"}${Math.abs(M.vsLast)*7} this week)</p>`:""}
    </div>
    ${build?"":`<div class="stats">
      <div class="stat"><div class="k">Weekly deficit</div><div class="v">${r5(M.target).toLocaleString()} <small>kcal</small></div></div>
      <div class="stat"><div class="k">Expected loss</div><div class="v">${M.rateEff} <small>lb / week</small></div></div>
    </div>
    <div class="bar" role="img" aria-label="Share of weekly deficit by source">
      <i style="width:${pct(M.finK)}%;background:var(--cardio)"></i><i style="width:${pct(M.otherK+M.doneK)}%;background:var(--warn)"></i><i style="width:${pct(Math.max(0,M.target-M.cardioTotal))}%;background:var(--accent)"></i></div>
    <div class="legend">${M.finK>0?`<span style="--c:var(--cardio)">Finishers</span>`:""}<span style="--c:var(--warn)">Other activity</span><span style="--c:var(--accent)">Food</span></div>`}
    ${M.nLift&&M.nFin?`<p class="note">Remaining finishers: <strong>${M.m} min</strong> × ${M.nFin}</p>`:""}
  </div>
  ${SHOW_MUSCLES&&(P.ledger||[]).some(x=>x.target>0)?`<div class="panel">${hdr("Muscles this week",["muscles"])}<div class="mlist">${P.ledger.filter(x=>x.target>0).map(x=>{ const f=v=>String(Math.round(v*2)/2), pd=Math.min(100,x.done/x.target*100), pp=Math.min(100,(x.done+x.left)/x.target*100);
    return `<div class="mrow ${x.status.replace(" ","")}"><span class="mn">${x.name}</span><span class="mbar" aria-hidden="true"><i class="pl" style="width:${pp}%"></i><i class="dn" style="width:${pd}%"></i></span><span class="mv">${f(x.done)}<small> / ${x.target}</small></span><span class="ms">${x.status}</span></div>`; }).join("")}</div></div>`:""}
  ${P.rules.length?`<div class="panel">${hdr("This week's changes",["changes"])}<ul>${P.rules.map(n=>`<li>${n}</li>`).join("")}</ul></div>`:""}
  ${P.notes.length?`<div class="panel">${hdr("Watch",["watch"])}<ul>${P.notes.map(n=>`<li>${n}</li>`).join("")}</ul></div>`:""}
  <button class="btn primary" id="newWeek" type="button">Start new week</button>`;
}
/* ---------- Day: one focused exercise at a time ---------- */
const exDone=(d,D,i)=>{ const s=d.slots[i], A=D.slots[i]; if(A.skip) return true; if(D.done) return true; const st=get(d.id,i); return s.cardio?!!st.cdone:(st.log||[]).filter(x=>x.d).length>=A.sets; };
const exCands=(d,D)=>slotOrder(d).filter(i=>!D.slots[i].skip);
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
  if(a===-1) return -1;
  if(a!=null&&d.slots[a]&&D.slots[a]&&D.slots[a].skip!=="hidden") return a;
  return c.find(i=>!exDone(d,D,i)) ?? c[c.length-1];
}
const nextIdx=(d,D,i)=>{ const c=exCands(d,D), p=c.indexOf(i); return c.slice(p+1).find(j=>!exDone(d,D,j)) ?? c.find(j=>!exDone(d,D,j)&&j!==i); };
const whyTxt=A=>{ const w=A.why.filter(x=>!x.includes("focus")&&!x.includes("feeling good")); return w.length?[...new Set(w.map(x=>x.split(" · ")[1]))].join(", "):""; };
/* First-time starting weight, by equipment, when an exercise has no history yet */
/* Guess a first weight from a related exercise you've logged: same movement list, same equipment.
   One-arm/one-leg ≈ 55% of two. Rounded down a step to start conservative. */
const EQ=n=>/bodyweight|push-up|pull-up|chin-up|plank/i.test(n)?"bw":/cable|pulldown|pushdown|face pull|straight arm|pull-through/i.test(n)?"cable":/machine|leg press|hack|pendulum|pec deck|smith/i.test(n)?"machine":/barbell|trap bar|deadlift|squat \(barbell|front squat|good morning|t-bar|pendlay|seal row/i.test(n)?"bar":/dumbbell|goblet|arnold|kettlebell/i.test(n)?"db":"other";
const UNIF=n=>/single-arm|single arm|one-arm|kneeling single|single-leg/i.test(n)?0.55:1;
function estW(name){
  if(isBW(name)||(exHist[name]||[]).length) return null;
  const lists=Object.values(L).filter(l=>l.includes(name)), eq=EQ(name); if(!lists.length||eq==="other"||eq==="bw") return null;
  let best=null;
  lists.flat().forEach(o=>{ if(o===name||EQ(o)!==eq) return; const h=exHist[o]||[], x=h[h.length-1]; if(!x||!x.w) return;
    if(!best||x.t>best.t) best={n:o,w:x.w,t:x.t}; });
  if(!best) return null;
  const raw=best.w*UNIF(name)/UNIF(best.n)*0.9, w=eq==="db"?Math.floor(raw/2.5)*2.5:Math.floor(raw/5)*5;
  return w>0?{w,from:best.n,fromW:best.w}:null;
}
function startW(name,s){
  { const g=estW(name); if(g) return g.w; }
  const n=name.toLowerCase(), main=!!s.main;
  if(isBW(name)) return 0;
  if(/band|plank|push-up|pull-up|chin-up|dead bug|bird dog|copenhagen|nordic|inverted|stability ball|sliding|knee raise|ab wheel|frog pump|back extension \(glute/.test(n)&&!/weighted/.test(n)) return 0;
  if(/smith/.test(n)) return main?95:65;
  if(/barbell|trap bar|deadlift|good morning|pendlay|seal row|t-bar|box squat|back squat|front squat|belt squat/.test(n)) return main?95:65;
  if(/lateral raise|reverse fly|external rotation|y-raise|kickback|pull-apart/.test(n)) return 10;
  if(/dumbbell|goblet|curl|arnold|lunge|step-up|split squat|carry/.test(n)) return main?30:20;
  if(/cable|pulldown|pushdown|face pull|pallof|crunch|row/.test(n)) return 40;
  if(/calf/.test(n)) return 90;
  if(/machine|press|leg press|hack|pendulum|abductor|adductor|leg curl|pec deck/.test(n)) return main?90:60;
  return 20;
}
const CSET=[[/incline walk|treadmill hike/i,"Incline · speed","12% · 3.0 mph"],[/stair/i,"Level","8"],[/bike/i,"Resistance","10"],[/rower/i,"Damper","5"],[/elliptical/i,"Resistance","8"],[/sled/i,"Load","90 lb"],[/outdoor walk/i,"",""]];
const cardioSetting=n=>{ const m=CSET.find(([re])=>re.test(n)); return m?{label:m[1],ph:m[2]}:{label:"Setting",ph:""}; };
const UNI=/single|bulgarian|split squat|lunge|step-up|copenhagen|side plank|suitcase|cossack|single-arm|one-arm|side-lying|kneeling single/i;
const lastSide=n=>{ const h=(exHist[n]||[]).slice().reverse().find(x=>x.side); return h?h.side:""; };
const sideToday=(d,s,i)=>{ const st=get(d.id,i), n=exName(d,s,i); return st.side||(lastSide(n)==="Left"?"Right":"Left"); };
/* Optional cooldown stretches matched to the day's muscles */
const STRETCH={
  lower:[["Half-kneeling hip flexor","45s / side"],["Pigeon","45s / side"],["Standing hamstring","45s / side"],["Adductor rock-back","8 reps"],["Wall calf stretch","30s / side"]],
  upper:[["Doorway pec stretch","45s / side"],["Lat stretch on a bench","45s"],["Cross-body shoulder","30s / side"],["Thread the needle","6 / side"],["Child's pose","60s"]],
  full:[["Half-kneeling hip flexor","45s / side"],["Standing hamstring","45s / side"],["Doorway pec stretch","45s / side"],["Lat stretch on a bench","45s"],["Child's pose","60s"]]};
const stretchesFor=d=>STRETCH[/^Lower/.test(d.title)?"lower":/^Upper/.test(d.title)?"upper":"full"];
let pendNudge=null;
/* "That looked easy / Tough set": a small popup offering the new weight for the rest of the sets */
function askNudge(p){ const u=KG()?"kg":"lb";
  showSheet(`<div class="swapsheet nudgesheet" role="dialog" aria-labelledby="nTitle"><div class="shtop"><h3 class="swapt" id="nTitle">${p.up?"That looked easy":"Tough set"}</h3>${XBTN}</div>
    <p class="small">${p.r0} reps on ${esc(p.nm)}. ${p.up?"Go up":"Drop"} to <b>${toU(p.w)} ${u}</b> for the rest of the sets${p.up?"":" to stay in range"}?</p>
    <div class="tbtns two"><button type="button" class="tb ghost" data-nk>Keep ${toU(p.w0)}</button><button type="button" class="tb" data-nu>Use ${toU(p.w)}</button></div></div>`,el=>{
    el.querySelector("[data-nk]").onclick=closeSheet;
    el.querySelector("[data-nu]").onclick=()=>{ const st=get(cur,p.i), log=(st.log||[]).slice(), w=String(p.w);
      for(let k=0;k<log.length;k++) if(!log[k].d) log[k]={...log[k],w}; const A=plan().days[cur].slots[p.i]; while(log.length<A.sets) log.push({w});
      set(cur,p.i,"log",log); closeSheet(); render(); }; },true); }
function renderDayHTML(d,P){
  const D=P.days[d.id], act=activeIdx(d,D);
  const WT=(wk.wt||{})[d.id];
  const canSwap=canSwapDay(d.id);
  let html=`<div class="dayhead"><h2>${d.title}</h2>${WT&&WT.start?`<p class="wtime" id="wtime" data-day="${d.id}"></p>`:""}${canSwap?`<button type="button" class="swapbtn" data-swap="${d.id}"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>Swap workout</button>`:""}</div>`;
  html+=`<div class="panel today"><div class="q"><span id="todayLbl">How do you feel today?${ib("today")}</span>
    <div class="seg slider" data-key="today" role="radiogroup" aria-labelledby="todayLbl">${["Good","Normal","Rough"].map(o=>`<button type="button" role="radio" data-v="${o}" aria-checked="${D.today===o}" aria-pressed="${D.today===o}"><i aria-hidden="true"></i><span>${o==="Good"?"Thriving":o}</span></button>`).join("")}</div></div>
    ${D.restSuggest?`<p class="flag">Reps dropped two sessions in a row. Rest a day first if you can.</p>`:D.autoRough?`<p class="adj"><b>Shortened</b> · reps dropped last session</p>`:""}
    ${d.id===P.nextId&&wk.upNext===d.id&&wk.missedNote?`<p class="adj"><b>Up next</b> · ${esc(wk.missedNote.why)}</p>`:""}
    </div>`;
  const rv=D.done&&(wk.review||{})[d.id];
  if(rv&&rv.items.length) html+=`<div class="panel"><h3>Next time</h3><div class="rev">${rv.items.map(r=>`<p>${nextLine(r)}</p>`).join("")}</div>${rv.note?`<p class="adj">${esc(rv.note)}</p>`:""}</div>`;
  html+=`<div class="list">`;
  /* required lifts, then what you added, then optional ones (trimmed/covered), then the cardio finisher */
  const ord0=slotOrder(d), isOpt=i=>!d.slots[i].cardio&&D.slots[i]&&D.slots[i].skip&&D.slots[i].skip!=="hidden";
  const ord=[...ord0.filter(i=>!d.slots[i].cardio&&!isOpt(i)),...ord0.filter(isOpt),...ord0.filter(i=>d.slots[i].cardio)];
  const firstOpt=ord.find(isOpt);
  ord.forEach(i=>{ const s=d.slots[i];
    if(i===firstOpt) html+=`<p class="optlab">Optional</p>`;
    const st=get(d.id,i), A=D.slots[i], base=`${d.id}-${i}`;
    if(A.skip==="hidden") return;
    if(A.skip&&i!==act){ const lg=(st.log||[]).filter(x=>x.d).length, dn=s.cardio?!!st.cdone:lg>=(A.sets||1);
      html+=`<button type="button" class="exrow opt${dn?" done":""}" data-ex="${i}" aria-label="Optional: ${esc(exName(d,s,i))}${dn?", done":""}"><span class="label">${s.label}</span><span class="mk" aria-hidden="true">${dn?"✓":""}</span><span class="exname">${esc(exName(d,s,i))}</span></button>`; return; }
    if(i!==act){ const dn=exDone(d,D,i);
      html+=`<button type="button" class="exrow${dn?" done":""}" data-ex="${i}" aria-label="${dn?"Done":"Start"} ${esc(exName(d,s,i))}"><span class="label">${s.extra?`Added · ${s.label}`:s.label}${s.ss&&wk.ss!=="No"?` · ${s.ss}`:""}</span><span class="mk" aria-hidden="true">${dn?"✓":""}</span><span class="exname">${esc(exName(d,s,i))}</span></button>`; return; }
    const choice=st.choice ?? defChoice(d,s,i), isCustom=choice===CUSTOM;
    const opts=[...s.opts,CUSTOM].map(o=>`<option${o===choice?" selected":""}>${esc(o)}</option>`).join("");
    const log=st.log||[], ticks=log.filter(x=>x.d).length, fin=s.cardio?!!st.cdone||D.done:ticks>=A.sets;
    const nRows=Math.max(A.sets||0,log.length);
    const pill=s.cardio?(D.done?`~${r5(A.doneK||0)} kcal`:A.min?`${A.min} min`:"Optional"):fin?"Done":`Set ${Math.min(ticks+1,A.sets)} of ${A.sets}`;
    html+=`<section class="slot cur${s.ss&&wk.ss!=="No"?" ss":""}${fxOnce.slot===base?" justdone":""}" aria-current="step">
      <div class="row1" role="button" tabindex="0" data-collapse aria-expanded="true" aria-label="Collapse ${esc(exName(d,s,i))}"><span class="label hdr">${s.extra?`Added · ${s.label}`:s.label}${s.ss&&wk.ss!=="No"?` · Superset ${s.ss}`:""}</span><span class="pill">${pill}</span></div>
      ${s.cardio?"":`<div class="bars" style="--n:${nRows}" aria-hidden="true">${Array.from({length:nRows},(_,k)=>`<i class="${k<ticks?"on":k===ticks&&!fin?"now":""}"></i>`).join("")}</div>`}
      ${s.extra?`<div class="xname"><b>${esc(exName(d,s,i))}</b>${(st.log||[]).some(x=>x.d)?"":`<button type="button" class="btn mini" data-xrm="${i-(d.slots.length-((wk.extra||{})[d.id]||[]).length)}">Remove</button>`}</div>`:`<select id="sel-${base}" data-i="${i}" aria-label="${esc(s.label)} exercise">${opts}</select>
      <input id="cus-${base}" class="custom${isCustom?" on":""}" data-i="${i}" placeholder="Exercise name" value="${esc(st.custom||"")}">`}`;
    if(s.cardio){
      const cn=exName(d,s,i), cs=cardioSetting(cn), isInt=INTERVAL.includes(cn)&&!A.steady;
      const planLine=A.min?`${A.min} min ${isInt?"· rounds of 30s hard, 90s easy":"at a steady, talkable pace"}${A.kcal?` · ~${r5(A.kcal)} kcal`:""}`:"";
      html+=`${A.flag?`<p class="adj"><b>Lowered</b> · ${A.flag}</p>`:""}${A.steady?`<p class="adj"><b>Easy pace, no intervals</b> · ${A.steady}</p>`:""}
      ${planLine?`<p class="cplan">${planLine}</p>`:""}
      <div class="nums ${cs.label?"two":"one"}"><label class="field" for="act-${base}"><span>Minutes done</span><input id="act-${base}" data-i="${i}" data-k="act" inputmode="numeric" placeholder="${A.min||""}" value="${esc(st.act||"")}"></label>${cs.label?`<label class="field" for="load-${base}"><span>${cs.label}</span><input id="load-${base}" data-i="${i}" data-k="load" placeholder="${esc(cs.ph)}" value="${esc(st.load||"")}"></label>`:""}</div>
      ${D.done||st.cdone?"":`<button type="button" class="btn primary cdone wide" data-i="${i}">Finish cardio</button>`}`;
    }else{
      const today=suggest(d,s,i,false,P), nm=exName(d,s,i), est=today?null:estW(nm);
      if(est&&!D.done) html+=`<p class="carry"><span>New exercise · starting guess <b>${est.w} lb</b> from ${esc(est.from)} at ${est.fromW}</span></p>`;
      const carry=(wk.next||{})[nm];
      if(carry&&carry.t!==(wk.doneT||{})[d.id]) html+=`<p class="carry"><span>${isBW(nm)?(carry.w>0?`${{up:"Go up to",down:"Ease to"}[carry.tag]||"Stay at"} <b>BW+${carry.w} lb</b> · `:carry.tag==="up"?"<b>Up</b> · ":"<b>Same</b> · "):`${{up:"Go up to",down:"Ease to"}[carry.tag]||"Stay at"} <b>${carry.w} lb</b> · `}${esc(carry.why)}</span></p>`;
      const [lo,hi]=range(s.reps), top=(s.upperAcc||s.support||s.label==="Glute med")?hi+3:hi;
      const lastT=log.slice(0,ticks).reverse().find(x=>x.d&&+x.w>0&&+x.r>0);
      if(!D.done&&!fin&&lastT&&st.nudged!==ticks){ const w0=+lastT.w, r0=+lastT.r, inc=incFor(nm,s,w0);
        /* asked in a popup right after the set is ticked (see askNudge), not inline */
        if(!pendNudge&&r0>=top+2) pendNudge={i,ticks,up:true,r0,w0,w:w0+inc,nm};
        else if(!pendNudge&&r0<lo) pendNudge={i,ticks,up:false,r0,w0,w:Math.max(0,w0-inc),nm}; }
      if(UNI.test(nm)){ const sd=sideToday(d,s,i), ls=lastSide(nm);
        html+=`<div class="side"><span>Start on</span><button type="button" class="btn mini sidebtn" data-side="${sd==="Left"?"Right":"Left"}" data-i="${i}" aria-label="Starting side: ${sd}. Tap to switch">${sd}</button>${ls?`<small>last time: ${ls}</small>`:""}</div>`; }
      html+=`<div class="sets">`;
      for(let k=0;k<nRows;k++){ const x=log[k]||{}, pw=k>0&&+(log[k-1]||{}).w>0?(log[k-1]||{}).w:"";
        html+=`<div class="setrow${x.d?" done":""}${k===ticks&&!fin?" now":""}"><span class="sn">${k+1}</span>
          <input id="w-${base}-${k}" data-i="${i}" data-set="${k}" data-f="w" inputmode="decimal" placeholder="${isBW(nm)?(D.done?"BW":pw||(today&&today.w?today.w:"BW")):D.done?"lb":pw||(today?today.w:est?est.w:"lb")}" aria-label="Set ${k+1} ${isBW(nm)?"added weight (blank for bodyweight)":"weight"}" value="${esc(x.w||"")}"><span class="u">${isBW(nm)?"+lb":"lb"}</span>
          <input id="r-${base}-${k}" data-i="${i}" data-set="${k}" data-f="r" inputmode="numeric" placeholder="${D.done?"reps":today&&today.r?today.r:range(s.reps)[0]}" aria-label="Set ${k+1} reps" value="${esc(x.r||"")}">
          <button type="button" class="chk${fxOnce.chk===`${base}-${k}`?" pop":""}" data-i="${i}" data-set="${k}" aria-pressed="${!!x.d}" aria-label="Set ${k+1} done">✓</button></div>`; }
      html+=`<button type="button" class="btn addset" data-i="${i}">+ Set</button></div>`;
    }
    html+=`</section>`;
  });
  html+=`</div>`;
  if(wk.stretch==="Yes"){ const sd=!!(wk.stretchDone||{})[d.id], list=stretchesFor(d);
    const so=(wk.stretchOpen||{})[d.id]??false;
    html+=`<section class="slot stretch${sd?" sdone":""}${so?"":" folded"}"><div class="row1" role="button" tabindex="0" data-stog aria-expanded="${so}" aria-label="${so?"Collapse":"Expand"} stretches"><span class="label hdr">Stretch</span>${sd?`<span class="pill">Done</span>`:""}</div>
      ${so?`<ul class="slist">${list.map(([n,t])=>`<li><span>${n}</span><small>${t}</small></li>`).join("")}</ul>
      <button type="button" class="btn ${sd?"":"primary "}wide" id="stretchBtn">${sd?"✓ Stretched":"Done stretching"}</button>`:""}</section>`; }
  html+=addExHTML(d);
  return html+`<button class="btn primary" id="doneBtn" type="button"${D.done?' disabled aria-disabled="true"':""}>${D.done?"✓ Day done":"Mark day done"}</button>`+(D.done?`<div class="dsharerow"><button type="button" class="btn dshare dsave" data-share="${d.id}" data-mode="save">${SAVE_ICON}Save to Photos</button><button type="button" class="btn dshare dicon" data-share="${d.id}" aria-label="Share workout">${SHARE_ICON}</button></div>`:"");
}
/* ---------- Add an exercise to the end of a day ---------- */
let addOpen=null, addPick="", addCustom="", addCat="";
function addExHTML(d){
  if(addOpen!==d.id) return `<button type="button" class="btn wide addex" data-addex="open">+ Add exercise</button>`;
  const used=new Set(); const groups=XGROUPS.map(([g,keys])=>{ const o=[]; keys.forEach(k=>(L[k]||[]).forEach(n=>{ if(!used.has(n)){ used.add(n); o.push(n); } })); return `<optgroup label="${g}">${o.map(n=>`<option${n===addPick?" selected":""}>${esc(n)}</option>`).join("")}</optgroup>`; }).join("");
  const isC=addPick===CUSTOM, guess=isC?(addCat||catOf(addCustom)||""):"";
  const cats=XGROUPS.map(([g,keys])=>`<optgroup label="${g}">${keys.map(k=>`<option value="${k}"${k===guess?" selected":""}>${XCAT[k][0]}</option>`).join("")}</optgroup>`).join("");
  const cat=isC?guess:catOf(addPick);
  return `<section class="slot addpanel"><div class="row1"><span class="label hdr">Add exercise</span><button type="button" class="nx" data-addex="close" aria-label="Close">×</button></div>
    <select id="addPick" aria-label="Exercise"><option value=""${addPick?"":" selected"}>Choose an exercise…</option>${groups}<option${isC?" selected":""}>${CUSTOM}</option></select>
    ${isC?`<input id="addCustom" placeholder="Exercise name" value="${esc(addCustom)}"><label class="field" for="addCat"><span>Counts as</span><select id="addCat"><option value="">Choose…</option>${cats}</select></label>`:""}
    ${cat?`<p class="small">Counts as ${XCAT[cat][0].toLowerCase()} · ${XCAT[cat][1]} reps. It goes into this week's muscle totals.</p>`:""}
    <button type="button" class="btn primary wide" data-addex="add"${(isC?addCustom.trim()&&cat:addPick)?"":" disabled"}>Add to ${esc(d.tab)}</button></section>`;
}
/* ---------- Small sheets: today's plan for an exercise, and next time after it ---------- */
let sheetT=null;
function sheetDim(on){ let d=document.getElementById("sheetDim");
  if(on&&!d){ d=document.createElement("div"); d.id="sheetDim"; d.setAttribute("aria-hidden","true"); d.onclick=()=>closeSheet(); document.body.appendChild(d); }
  if(d){ d.classList.toggle("on",!!on); } }
function showSheet(html,bindFn,dim){
  const el=document.getElementById("sheet"); clearTimeout(sheetT); sheetDim(!!dim);
  el.innerHTML=html; el.classList.remove("out"); el.hidden=false;
  el.querySelectorAll("[data-x]").forEach(b=>b.onclick=closeSheet); if(bindFn) bindFn(el);
}
/* pick another workout from the same family (lower, upper, full body) */
/* today's planned lift, and the other lifts still to do this week */
function todayLift(){ if(earlyDone()) return null; const M=weekModel(0); return M.plan[M.tIdx]||null; }
function plannedOthers(id){ if(earlyDone()||id!==todayLift()) return []; return weekModel(0).todo.filter(x=>x!==id); }
const canSwapDay=id=>!(wk.done||{})[id]&&!((wk.wt||{})[id]||{}).start&&(swapOptions(id).length>1||plannedOthers(id).length>0);
/* Swap: another workout from the same family (sticks in that spot), or, for today's lift, one of this week's other planned lifts */
function swapSheet(id){
  const fam=swapOptions(id).filter(t=>t.id!==id), others=plannedOthers(id).map(dayById).filter(Boolean);
  if(!fam.length&&!others.length) return;
  const ex=t=>t.slots.map((sl,i)=>[sl,i]).filter(([sl])=>!sl.cardio).slice(0,3).map(([sl,i])=>exName(t,sl,i)).join(" · ");
  const opt=(t,attr)=>`<button type="button" class="swapopt" ${attr}="${t.id}"><b>${esc(t.title)}</b><small>${esc(ex(t))}</small></button>`;
  showSheet(`<div class="swapsheet"><div class="shtop"><h3 class="swapt">Swap workout</h3>${XBTN}</div>
    <p class="small">The week will adjust to any swaps.</p>
    ${fam.length?`<span class="plab swaph">Same muscle group</span><div class="swaplist">${fam.map(t=>opt(t,"data-to")).join("")}</div>`:""}
    ${others.length?`<span class="plab swaph">Planned</span><div class="swaplist">${others.map(t=>opt(t,"data-pick")).join("")}</div>`:""}</div>`,
    el=>{ el.querySelectorAll("[data-to]").forEach(b=>b.onclick=()=>{ const to=b.dataset.to; closeSheet(); if(swapDay(id,to)){ if(cur===id) cur=to; keepNav(); render(); } });
      el.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{ const to=b.dataset.pick; closeSheet(); wk.pinToday={d:dayKey(Date.now()),id:to}; save(); if(cur===id) cur=to; keepNav(); render(); toast([`${(dayById(to)||{}).title||"Lift"} moved to today`]); }); },true);
}
function closeSheet(){ sheetDim(false); const el=document.getElementById("sheet"); if(!el||el.hidden||el.classList.contains("out")) return; el.classList.add("out"); sheetT=setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out"); },200); }
const XBTN=`<button type="button" class="dx" data-x aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>`;
function planSheet(id,i){
  const d=DAYS.find(x=>x.id===id); if(!d) return;
  const P=plan(), s=d.slots[i], A=P.days[id].slots[i]; if(A.skip&&s.cardio) return;
  const t=s.cardio?null:suggest(d,s,i,false,P), why=s.cardio?(A.steady?`Easy pace · ${A.steady}`:A.flag||""):wk.guide==="Less"?"":whyTxt(A);
  const main=s.cardio?`${A.min} min · ~${r5(A.kcal||0)} kcal`:`${A.sets} × ${esc(s.reps)}${t?` · start ${t.w} lb`:""}`;
  showSheet(`<div class="shgrid"><span class="plab">Today's plan · ${esc(s.label)}</span><button type="button" class="shbtn" data-x>Begin</button><span class="shmain">${main}</span>${why?`<span class="shsub">${esc(why)}</span>`:""}</div>`);
}
function nextSheet(id,i){
  const d=DAYS.find(x=>x.id===id); if(!d) return;
  const P=plan(), D=P.days[id], s=d.slots[i], g=review(d,s,i,P), n=nextIdx(d,D,i);
  showSheet(`<div class="shtop"><span class="plab">${esc(exName(d,s,i))} · done</span>${XBTN}</div>
    ${g?`<p class="shline"><span>Next time · ${nextLine(g)}</span></p>`:""}
    ${n!=null?`<button type="button" class="shbtn wide" id="upNext">Up next: ${esc(exName(d,d.slots[n],n))}</button>`:""}`,
    el=>{ const b=el.querySelector("#upNext"); if(b) b.onclick=()=>{ closeSheet(); wk.active={...(wk.active||{}),[id]:n}; save(); render(); const c=document.querySelector(".slot.cur"); if(c) c.scrollIntoView({block:"start",behavior:"smooth"}); }; });
}
function rows(key,n,pl,rate,label,noK){
  let h=""; if(key==="zAct") INFO.zAct="One easy 45-minute session during the pre-season ramp: bike, incline walk or rower at a pace you could talk through. It builds the aerobic base that keeps you fresh in-season.";
  for(let i=0;i<n;i++){ const v=(wk[key]||[])[i]||"", k=num(v,pl)*rate;
    h+=`<div class="slot cardio"><div class="row1"><span class="label hdr">${label}${n>1?" "+(i+1):""}${key==="zAct"?ib("zAct"):""}</span>${noK?"":`<span class="burn">~${r5(k)} kcal</span>`}</div>
    <div class="nums two"><label for="${key}-${i}">Actual min<input id="${key}-${i}" data-act="${key}" data-n="${i}" inputmode="numeric" placeholder="${pl}" value="${esc(v)}"></label></div></div>`; }
  return h;
}
/* Effort for yoga and pilates: sets calories, and light classes don't count as core work */
function effortSeg(key,desc){ const v=wk[key]||"Moderate"; return `${seg(key,"Effort",["Light","Moderate","Hard"],v)}<p class="small effd">${desc[v]}</p>`; }
function renderAct(a){
  if(a==="zone2") return `<div class="dayhead"><h2>Zone 2</h2></div>
  <div class="list">${rows("zAct",1,45,perMin(CARDIO["Bike (steady)"].met),"Zone 2 session")}</div>`;
  const n=cnt(a), A=ACT[a];
  if(A.noMin) return `<div class="dayhead"><h2>${A.name}</h2></div><div class="panel">${hdr("This week",[a])}${stepper(a,"Sessions",[0,1,2,3,4,5,6,7])}</div>`;
  if(a==="yoga") return `<div class="dayhead"><h2>Yoga</h2></div><div class="panel" style="margin-top:12px">${hdr("This week",["yoga","ymin","yeff","heated"])}${stepper("yoga","Sessions",[0,1,2,3,4,5,6,7])}${stepper("ymin","Class length",[45,60,75,90],"min")}${effortSeg("yeff",{Light:"Restorative, yin, gentle stretch",Moderate:"Flow, vinyasa or hatha",Hard:"Power or sculpt; sweaty and shaky"})}${toggle("heated","Heated")}</div>
  <div class="list" style="margin-top:12px">${rows("yAct",n,num(wk.ymin,60),perMin(yogaMet()),"Class")}</div>`;
  if(a==="pilates") return `<div class="dayhead"><h2>Pilates</h2></div><div class="panel" style="margin-top:12px">${hdr("This week",["pilates",minKey("pilates"),"peff"])}${stepper("pilates","Sessions",[0,1,2,3,4,5,6,7])}${stepper(minKey("pilates"),"Class length",[45,50,55,60],"min")}${effortSeg("peff",{Light:"Stretch-based or beginner mat",Moderate:"Most mat or reformer classes",Hard:"Sculpt, jump board or burn-style"})}</div>
  <div class="list" style="margin-top:12px">${rows(actKey("pilates"),n,plannedMin("pilates"),perMin(pilMet()),"Class")}</div>`;
  if(a==="spin") return `<div class="dayhead"><h2>Spin</h2></div><div class="panel" style="margin-top:12px">${hdr("This week",["spin","spint"])}${stepper("spin","Sessions",[0,1,2,3,4,5,6,7])}${seg("spint","Intensity",["Hard","Really hard"])}</div>
  <div class="list" style="margin-top:12px">${rows("sAct",n,SPIN_MIN,perMin(SPIN_MET[wk.spint]||8.5),"Class")}</div>`;
  return `<div class="dayhead"><h2>${A.name}</h2></div><div class="panel" style="margin-top:12px">${hdr("This week",[a,minKey(a)])}${stepper(a,"Sessions",[0,1,2,3,4,5,6,7])}
   <div class="nums">${fld(minKey(a),"Planned min","numeric","","sm")}</div></div><div class="list" style="margin-top:12px">${rows(actKey(a),n,plannedMin(a),perMin(A.met),"Session",1)}</div>`;
}
/* Slide between tabs (and between days on Workouts) with a view transition where the browser has one.
   dir: "fwd" | "back" for tabs, "dayfwd" | "dayback" for days; null just runs fn. */
const NAV_IDS=["workouts","plan","history","you"];
let vtSwap=false;
function swapView(dir,fn){
  if(!dir||!document.startViewTransition||matchMedia("(prefers-reduced-motion: reduce)").matches){ fn(); return; }
  const H=document.documentElement; H.dataset.vt=dir; vtSwap=true;
  const t=document.startViewTransition(()=>{ fn(); });
  t.finished.finally(()=>{ vtSwap=false; delete H.dataset.vt; });
}
function goDay(off){ if(off===selOff) return;
  const tr=document.querySelector(".wpager .wtrack");
  if(tr&&Math.abs(off-selOff)===1&&!reduceMotion()){ pagerTo(tr,off>selOff?1:-1,()=>{ selOff=off; render(); }); return; }
  const dir=off>selOff?"dayfwd":"dayback"; swapView(dir,()=>{ selOff=off; render(); }); }
const reduceMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
/* slide the track one page (-1 back, 1 forward, 0 home), then run done */
function pagerTo(tr,dir,done,ms){ const D=ms??260; tr.style.transition=`transform ${D}ms cubic-bezier(.2,.8,.2,1)`; tr.style.transform=`translateX(${-100/3*(1+dir)}%)`;
  let fired=false; const fin=()=>{ if(fired) return; fired=true; tr.removeEventListener("transitionend",fin); if(done) done(); };
  tr.addEventListener("transitionend",fin); setTimeout(fin,D+80); }
function bindPager(pager,tr){
  let x0=null,y0=0,t0=0,dx=0,mode=null; const W=()=>pager.clientWidth||1;
  const lo=pagerMin(), hi=pagerMax();
  pager.addEventListener("touchstart",e=>{ if(e.target.closest("input,textarea,select")){ x0=null; return; } const T=e.touches[0]; x0=T.clientX; y0=T.clientY; t0=Date.now(); dx=0; mode=null; tr.style.transition="none"; },{passive:true});
  pager.addEventListener("touchmove",e=>{ if(x0==null) return; const T=e.touches[0], mx=T.clientX-x0, my=T.clientY-y0;
    if(!mode){ if(Math.abs(mx)<8&&Math.abs(my)<8) return; mode=Math.abs(mx)>Math.abs(my)*1.2?"x":"y"; }
    if(mode!=="x") return; e.preventDefault(); dx=mx;
    /* rubber-band at either end of the range */
    if((dx>0&&selOff<=lo)||(dx<0&&selOff>=hi)) dx=dx/3;
    tr.style.transform=`translateX(calc(${-100/3}% + ${dx}px))`; },{passive:false});
  pager.addEventListener("touchend",()=>{ if(x0==null||mode!=="x"){ x0=null; return; } x0=null;
    const v=Math.abs(dx)/Math.max(1,Date.now()-t0), go=(Math.abs(dx)>W()*0.3||v>0.45)?(dx<0?1:-1):0, to=selOff+go;
    if(go&&(to<lo||to>hi)){ pagerTo(tr,0,null,200); return; }
    pagerTo(tr,go,go?()=>{ selOff=to; render(); }:null,go?220:200); });
}
function bindStripSwipe(strip){ if(!strip) return; let x0=null,y0=0;
  strip.addEventListener("touchstart",e=>{ const T=e.touches[0]; x0=T.clientX; y0=T.clientY; },{passive:true});
  strip.addEventListener("touchend",e=>{ if(x0==null) return; const T=e.changedTouches[0], dx=T.clientX-x0, dy=T.clientY-y0; x0=null;
    if(Math.abs(dx)<40||Math.abs(dx)<Math.abs(dy)*1.5) return;
    let o=selOff+(dx<0?7:-7); const t=DAY0(Date.now()); if(weekStartOf(addD(t,o)).getTime()===weekStartOf(t).getTime()) o=0;
    o=Math.max(pagerMin(),Math.min(pagerMax(),o)); if(o!==selOff){ const dir=o>selOff?"dayfwd":"dayback"; swapView(dir,()=>{ selOff=o; render(); }); } });
}
function render(){ setTimeout(()=>{ if(!document.getElementById("splash")) tabTip(); },350); renderCore(); }
function renderCore(){
  if(!SUBS().includes(cur)) cur="home";
  popN=0; for(const k in POP) delete POP[k];
  const P=plan(); renderNav(); document.body.dataset.nav=wk.setupDone?(nav==="workouts"&&cur!=="home"?"sub":nav):"setup";
  const sub=nav==="workouts"&&cur!=="home", th=!wk.setupDone?"th-orange":sub?themeOf(cur):nav==="workouts"?"th-green":nav==="you"?"th-pink":"th-orange";
  document.body.classList.remove("th-green","th-orange","th-pink"); document.body.classList.add(th); { const m=document.querySelector('meta[name="theme-color"]'); if(m) m.content={"th-green":"#131615","th-orange":"#181513","th-pink":"#181416"}[th]; }
  const v=document.getElementById("view");
  document.getElementById("foot").hidden=!(sub&&DAYS.some(d=>d.id===cur));
  const back=`<button type="button" class="wback" data-back>‹ Workouts</button>`;
  v.innerHTML=!wk.setupDone?renderSeason(P):nav==="history"?renderHistory():nav==="plan"?renderPlan(P):nav==="you"?renderYou(P):
    cur==="home"?renderWorkouts(P):back+((ACT[cur]||cur==="zone2")?renderAct(cur):renderDayHTML(DAYS.find(d=>d.id===cur),P));
  const key=nav+":"+cur;
  if(vtOpen){ const h=v.querySelector(".dayhead")||v.firstElementChild; if(h) h.style.viewTransitionName="lbopen"; lastCur=key; }
  if(vtSwap) lastCur=key;
  if(key!==lastCur){ v.classList.remove("enter","fwd","back"); void v.offsetWidth; v.classList.add("enter"); if(lastCur!=null) v.classList.add(sub?"fwd":"back"); lastCur=key; }
  if(fxOnce.seg){ const b=v.querySelector(`.seg[data-key="${fxOnce.seg[0]}"] button[data-v="${CSS.escape(fxOnce.seg[1])}"]`); if(b) b.classList.add("pressed"); }
  fxOnce={};
  bind();
  stackCards();
  tickTimers();
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
  cards.forEach((c,i)=>{ c.addEventListener("transitionend",e=>{ if(e.propertyName==="top"&&ST) updateStack(); }); c.classList.add("stack"); c.style.zIndex=i+1; 
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
    /* shade by distance behind the current card: front is lightest, the back of the pile is the base colour */
    card.style.setProperty("--lift",(i>=c||i>=ST.end?9:i===c-1?4.5:0)+"%");
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
  if(tour||busy||!t||(wk.seenTabs||{})[k]||(!wk.setupDone&&cur!=="season")||(wk.setupDone&&wk.guide==="Less")){ return; }
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
  t.innerHTML=`<div class="tin">${lines.slice(0,wk.guide==="Less"?2:5).map(l=>`<p>${esc(l)}</p>`).join("")}</div>`;
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
function logSet(i,k,f,val){ const st=get(cur,i); const log=(st.log||[]).slice(); while(log.length<=k) log.push({}); log[k]={...log[k],[f]:val}; set(cur,i,"log",log); if((wk.done||{})[cur]) resyncDone(cur); }
/* ---------- Timers ----------
   Both run off saved timestamps, not a countdown, so locking the phone or leaving the app
   doesn't pause them: on return they show the true time.
   Rest by exercise type: main lifts 2:30 (3:00 at 5 reps or fewer), other compounds 1:30, isolation 1:15;
   +15s for one-side-at-a-time work; +30s after the first (heaviest) set of a main or compound lift;
   20s after the first half of a superset. Your ±15s for an exercise replaces its base. */
const mmss=t=>{ t=Math.max(0,Math.round(t)); return `${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`; };
const ISO_LBL=/^(Side delts|Rear delts|Arms|Biceps|Triceps|Glute med|Glute \(light\)|Calves|Adductors|Rotator cuff|Core|Lats)$/;
function restPlan(s,name,k,d){
  /* Short superset transition only once you're actually alternating: the partner (A2 for A1) already has a set ticked.
     Straight sets of the first exercise get full rest. */
  if(s.ss&&wk.ss!=="No"&&/1$/.test(s.ss)&&d){ const pi=d.slots.findIndex(x=>x.ss===s.ss.replace(/1$/,"2"));
    if(pi>=0&&((get(d.id,pi).log||[]).some(x=>x.d))) return {base:20,bump:0,fixed:1}; }
  const iso=ISO_LBL.test(s.label), lo=+((String(s.reps).match(/\d+/)||[8])[0]);
  const base=s.main?(lo<=5?180:150):iso?75:90, uni=/single|bulgarian|split squat|lunge|step-up|single-arm|one-arm|cossack/i.test(name)?15:0;
  /* Context levers: heavier recovery demand gets longer rest on compound lifts (never shorter), capped at +30s */
  const ctx=[]; if(!iso){ if(cutting()) ctx.push("cut"); if(inSeason()) ctx.push("in-season");
    const feel=d?(wk.today||{})[d.id]:""; if(feel==="Rough"||wk.ready==="Low"||wk.sore==="Everything") ctx.push("recovery"); }
  return {base:base+uni,bump:(k===0&&!iso?30:0)+Math.min(30,ctx.length*15),why:ctx.length?`+${Math.min(30,ctx.length*15)}s · ${ctx.join(", ")}`:""};
}
const restFor=(name,p)=>((wk.restFor||{})[name])||p.base;
function startRest(name,s,k,d){ const p=restPlan(s,name,k,d), secs=p.fixed?p.base:restFor(name,p)+p.bump;
  wk.rest={end:Date.now()+secs*1000,name,base:p.fixed?null:p.base,bump:p.bump,why:p.why||""}; save(); schedChime(secs); tickTimers(); }
function adjRest(d){ const r=wk.rest; if(!r) return;
  if(r.base==null){ r.end=Math.max(Date.now()+5000,r.end+d*1000); save(); schedChime((r.end-Date.now())/1000); tickTimers(); return; }
  const base=restFor(r.name,{base:r.base}), nb=Math.max(30,Math.min(300,base+d));
  wk.restFor={...(wk.restFor||{}),[r.name]:nb}; r.end=Math.max(Date.now()+5000,r.end+d*1000); save(); schedChime((r.end-Date.now())/1000); tickTimers(); }
function endRest(){ wk.rest=null; stopChime(); save(); tickTimers(); }
/* Chime: scheduled on the audio clock when rest starts (a tap unlocks sound), so it still plays if the
   screen dims. A locked phone or the silent switch can still mute it; the vibration stays as a backup. */
let AC=null, chimeNodes=[], chimeAt=0;
function audio(){ try{
    /* "ambient" mixes the chime over music instead of pausing it ("playback" paused Spotify for the whole rest).
       Trade-off: with the ring/silent switch on silent, iPhone mutes ambient sounds. */
    if(navigator.audioSession&&navigator.audioSession.type!=="ambient") navigator.audioSession.type="ambient";
    AC=AC||new (window.AudioContext||window.webkitAudioContext)(); if(AC.state!=="running") AC.resume();
    if(!audio.unlocked){ audio.unlocked=1; const b=AC.createBuffer(1,1,22050), src=AC.createBufferSource(); src.buffer=b; src.connect(AC.destination); src.start(0); }
  }catch(e){ AC=null; } return AC; }
function stopChime(){ chimeNodes.forEach(o=>{ try{o.stop(0)}catch(e){} }); chimeNodes=[]; chimeAt=0; }
function chimeIn(secs){ const ac=audio(); if(!ac) return; const t0=ac.currentTime+Math.max(0,secs);
  [[784,0],[1047,.16],[1319,.32]].forEach(([f,dt])=>{ const o=ac.createOscillator(), g=ac.createGain(); o.type="sine"; o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,t0+dt); g.gain.exponentialRampToValueAtTime(0.4,t0+dt+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+dt+0.6);
    o.connect(g); g.connect(ac.destination); o.start(t0+dt); o.stop(t0+dt+0.65); chimeNodes.push(o); }); }
function schedChime(secs){ stopChime(); if(wk.sound==="No") return; chimeIn(secs); chimeAt=wk.rest?wk.rest.end:0; }
let buzzed=0;
function tickTimers(){
  const bar=document.getElementById("rest"), r=wk.rest, now=Date.now();
  if(r){ const left=(r.end-now)/1000;
    if(left<-300){ wk.rest=null; save(); }
    else { const over=left<=0;
      if(over&&buzzed!==r.end){ buzzed=r.end; try{ navigator.vibrate&&navigator.vibrate([200,100,200]); }catch(e){} if(chimeAt!==r.end&&left>-3&&wk.sound!=="No") chimeIn(0); }
      if(bar.hidden||bar.dataset.end!==String(r.end)){ bar.dataset.end=r.end;
        bar.innerHTML=`<button type="button" class="rz l" data-rest="-15" aria-label="15 seconds less"><span aria-hidden="true">−15s</span></button><span class="rmid"><span class="rt" aria-live="off"></span><button type="button" class="rb skip" data-rest="skip">Skip</button></span><button type="button" class="rz r" data-rest="15" aria-label="15 seconds more"><span aria-hidden="true">+15s</span></button>`;
        bar.querySelectorAll("[data-rest]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); const v=b.dataset.rest; if(v==="skip") endRest(); else adjRest(+v); }); }
      bar.hidden=false; bar.classList.toggle("over",over);
      bar.querySelector(".rt").textContent=over?`Go · ${mmss(-left)} over`:`Rest ${mmss(left)}`; } }
  if(!wk.rest){ bar.hidden=true; bar.innerHTML=""; delete bar.dataset.end; }
  const wt=document.getElementById("wtime"); if(wt){ const T=(wk.wt||{})[wt.dataset.day]; if(T&&T.start) wt.textContent=T.end?`${Math.round((T.end-T.start)/60000)} min`:mmss((now-T.start)/1000); }
}
setInterval(tickTimers,1000);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) tickTimers(); });
window.addEventListener("pageshow",tickTimers);
function wtStart(id){ wk.wt=wk.wt||{}; if(!(wk.wt[id]&&wk.wt[id].start)) wk.wt[id]={start:Date.now()}; }
function wtEnd(id){ wk.wt=wk.wt||{}; if(wk.wt[id]&&wk.wt[id].start&&!wk.wt[id].end) wk.wt[id].end=Date.now(); }
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
/* ---------- Share a finished workout as an image (Strava-style) ----------
   The PNG is drawn on a canvas as soon as the button appears, so the tap can hand it straight to the share
   sheet (iPhone only allows sharing right after a tap). Share sheet → Save Image / Copy / Messages / Instagram;
   no share sheet → copy to clipboard; no clipboard → download. */
const SAVE_ICON=`<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 19h14"/></svg>`;
const SHARE_ICON=`<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`;
function shareData(id){
  const d=DAYS.find(x=>x.id===id); if(!d) return null;
  const from=wk.weekStart||0, sess=(wk.sessions||[]).filter(x=>x.k==="lift"&&x.id===id&&x.t>=from).pop();
  const T=(wk.wt||{})[id], mins=T&&T.start&&T.end?Math.max(1,Math.round((T.end-T.start)/60000)):(sess&&sess.min)||0;
  const S=(sess&&sess.ex&&sess.ex.length?sess.ex:daySummary(id)), rv=(wk.review||{})[id]||{items:[]};
  const t0=DAY0(sess?sess.t:Date.now()).getTime();
  return {title:d.title, when:new Date(sess?sess.t:Date.now()), mins, sets:setsLogged(id)||S.filter(x=>!x.cardio).length, S, items:rv.items, prs:prsBetween(t0,t0+864e5).length};
}
async function shareCardBlob(id){
  const D=shareData(id); if(!D) return null;
  try{ await Promise.all(["400 80px Ranchers","600 40px 'DM Sans'","500 40px 'DM Sans'","400 32px 'DM Sans'","500 40px 'DM Mono'"].map(f=>document.fonts.load(f))); }catch(e){}
  const W=1080, rows=D.S.slice(0,9), H=Math.max(1350,1080+rows.length*96+(D.S.length>rows.length?70:0)), c=document.createElement("canvas"); c.width=W; c.height=H;
  const g=c.getContext("2d"), P=72, ink="#edeae8", mute="#a8a09c", acc="#6fd0b4", up="#fea06a";
  const bg=g.createLinearGradient(0,0,0,H); bg.addColorStop(0,"#1e3a32"); bg.addColorStop(.45,"#131615"); bg.addColorStop(1,"#131615"); g.fillStyle=bg; g.fillRect(0,0,W,H);
  g.textBaseline="alphabetic";
  g.fillStyle=acc; g.font="400 44px Ranchers, sans-serif"; g.fillText("LIFT BOARD",P,P+40);
  g.fillStyle=mute; g.font="500 30px 'DM Sans', sans-serif"; g.textAlign="right";
  g.fillText(D.when.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}),W-P,P+38); g.textAlign="left";
  /* title, wrapped to two lines */
  g.fillStyle=ink; g.font="400 104px Ranchers, sans-serif"; const words=D.title.toUpperCase().split(" "), lines=[""];
  words.forEach(w=>{ const t=(lines[lines.length-1]+" "+w).trim(); if(g.measureText(t).width>W-2*P&&lines[lines.length-1]) lines.push(w); else lines[lines.length-1]=t; });
  let y=P+200; lines.slice(0,2).forEach(l=>{ g.fillText(l,P,y); y+=108; });
  /* stat tiles */
  y+=20; const stats=[[D.mins?`${D.mins}`:"–","min"],[String(D.sets),"sets"],[String(D.prs),D.prs===1?"PR":"PRs"]], tw=(W-2*P-2*24)/3;
  stats.forEach(([v,l],i)=>{ const x=P+i*(tw+24); g.fillStyle="rgba(255,255,255,.06)"; rr(g,x,y,tw,170,28); g.fill();
    g.fillStyle=mute; g.font="600 26px 'DM Sans', sans-serif"; g.fillText(l.toUpperCase(),x+32,y+56);
    g.fillStyle=i===2&&D.prs?up:ink; g.font="500 72px 'DM Mono', monospace"; g.fillText(v,x+32,y+138); });
  y+=230;
  /* exercises with top set */
  g.fillStyle=mute; g.font="600 26px 'DM Sans', sans-serif"; g.fillText("TOP SETS",P,y); y+=30;
  rows.forEach(x=>{ y+=96; const r=(D.items||[]).find(q=>q.n===x.n), v=x.cardio?(x.min?`${x.min} min`:"done"):fmtSet(x.n,x.w,x.r);
    g.strokeStyle="rgba(255,255,255,.08)"; g.lineWidth=2; g.beginPath(); g.moveTo(P,y-66); g.lineTo(W-P,y-66); g.stroke();
    g.fillStyle=r&&r.tag==="up"?up:ink; g.font="500 40px 'DM Mono', monospace"; g.textAlign="right"; g.fillText(v+(r&&r.tag==="up"?" ↑":""),W-P,y-12);
    const vw=g.measureText(v+" ↑").width; g.textAlign="left"; g.fillStyle=ink; g.font="500 36px 'DM Sans', sans-serif";
    let n=x.n; while(g.measureText(n).width>W-2*P-vw-32&&n.length>4) n=n.slice(0,-2); if(n!==x.n) n=n.trim()+"…"; g.fillText(n,P,y-12); });
  if(D.S.length>rows.length){ y+=70; g.fillStyle=mute; g.font="400 30px 'DM Sans', sans-serif"; g.fillText(`+ ${D.S.length-rows.length} more`,P,y); }
  /* trim the spare canvas below the last row (never shorter than 4:5) */
  const H2=Math.min(H,Math.max(1350,Math.round(y+P+20))), out=document.createElement("canvas"); out.width=W; out.height=H2; out.getContext("2d").drawImage(c,0,0);
  return await new Promise(res=>out.toBlob(res,"image/png"));
}
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function bindShare(btn){
  const id=btn.dataset.share; let file=null; btn.disabled=true;
  shareCardBlob(id).then(b=>{ if(b){ file=new File([b],`lift-board-${dayKey(Date.now())}.png`,{type:"image/png"}); btn.disabled=false; } }).catch(()=>{});
  btn.onclick=async()=>{ if(!file) return;
    /* the web can't write to Photos directly: on phones the share sheet's "Save Image" does it; on a computer it downloads */
    if(btn.dataset.mode==="save"&&!(navigator.canShare&&navigator.canShare({files:[file]})&&/iPhone|iPad|Android/.test(navigator.userAgent))){ const a=document.createElement("a"); a.href=URL.createObjectURL(file); a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); toast(["Image saved"]); return; }
    try{
      if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file]}); return; }
      if(navigator.clipboard&&window.ClipboardItem){ await navigator.clipboard.write([new ClipboardItem({"image/png":file})]); toast(["Image copied"]); return; }
    }catch(e){ if(e&&e.name==="AbortError") return; }
    const a=document.createElement("a"); a.href=URL.createObjectURL(file); a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); };
}
function showDone({eyebrow,title,body,cta,onCta,shareId}){
  const el=document.getElementById("done"); doneCta=onCta||null; closePop();
  el.innerHTML=`<div class="ddim" data-close></div><section class="dsheet" role="dialog" aria-modal="true" aria-labelledby="dTitle">
    <div class="dtop"><span class="plab">${esc(eyebrow)}</span><button type="button" class="dx" data-close aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
    <div class="dhead">${CHECK}<h2 id="dTitle" tabindex="-1">${esc(title)}</h2></div>
    ${body}
    <div class="dbtns${shareId?" three":""}">${shareId?`<button type="button" class="tb ghost dshare dsave" data-share="${shareId}" data-mode="save">${SAVE_ICON}Save to Photos</button><button type="button" class="tb ghost dshare dicon" data-share="${shareId}" aria-label="Share">${SHARE_ICON}</button>`:""}<button type="button" class="tb dcta" id="dCta">${esc(cta)}</button></div></section>`;
  el.querySelectorAll(".dsheet > *").forEach((c,i)=>c.style.setProperty("--d",(i*60)+"ms"));
  el.hidden=false; el.classList.remove("out"); document.body.classList.add("touring");
  el.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeDone());
  el.querySelector("#dCta").onclick=()=>closeDone(true);
  el.querySelectorAll("[data-share]").forEach(bindShare);
  el.querySelector("#dTitle").focus({preventScroll:true});
}
function closeDone(viaCta){
  const el=document.getElementById("done"); if(el.hidden||el.classList.contains("out")) return;
  el.classList.add("out"); const go=viaCta&&doneCta;
  setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out"); if(!tour) document.body.classList.remove("touring"); if(go) go(); coachSoon(); },220);
}
const dRows=R=>`<div class="drows">${R.map(([k,v,a])=>`<div class="prow"><span>${esc(k)}</span><b${a?' class="a"':""}>${esc(v)}</b></div>`).join("")}</div>`;
const dTiles=T=>`<div class="dtiles">${T.map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>`;
function goTab(id){ if(id==="week"||id==="season"){ nav="plan"; planView=id; cur="home"; } else if(NAVS.includes(id)){ nav=id; cur="home"; } else { nav="workouts"; cur=id; } keepNav(); render(); window.scrollTo(0,0); }
function setupDone(){
  const P=plan();
  showDone({eyebrow:"Setup saved",title:"Your plan is ready",body:`<p class="psent">${sentenceHTML(planSentence(P))}</p>`,
    cta:"See this week",onCta:()=>goTab("workouts")});
}
/* "145 × 8"; bodyweight shows "BW × 12" or "BW+10 × 8" */
const fmtSet=(n,w,r)=>`${isBW(n)?(+w>0?`BW+${toU(w)}`:"BW"):toU(w)} × ${r}`;
/* Each exercise with its top set; the arrow is what happens next time (↑ up, = held, ↓ ease). */
function workoutRows(S,items){
  if(!S.length) return `<p class="dnote">No sets logged.</p>`;
  return `<div class="drows wo">${S.map(x=>{ const r=(items||[]).find(y=>y.n===x.n);
    return `<div class="prow"><span>${esc(x.n)}${x.extra?` <small>added</small>`:""}</span><b class="${r&&r.tag==="up"?"a":""}">${x.cardio?`${x.min?x.min+" min":"done"}`:fmtSet(x.n,x.w,x.r)}${r&&TAGICON[r.tag]?` <i aria-label="Next time: ${TAGTXT[r.tag]}">${TAGICON[r.tag]}</i>`:""}</b></div>`; }).join("")}</div>`;
}
function dayDone(id,sets){
  const d=DAYS.find(x=>x.id===id), rv=(wk.review||{})[id]||{items:[]}, c=t=>rv.items.filter(x=>x.tag===t).length;
  const ease=c("down")+c("collapse"), nxt=DAYS.find(x=>!(wk.done||{})[x.id]);
  const T=(wk.wt||{})[id];
  const S=daySummary(id), mins=T&&T.start&&T.end?Math.max(1,Math.round((T.end-T.start)/60000)):0;
  showDone({eyebrow:`${d.tab} · ${d.title}${mins?` · ${mins} min`:""}`,title:"Day done",
    body:workoutRows(S,rv.items)+(rv.note?`<p class="dnote">${esc(rv.note)}</p>`:""),
    cta:"Finish & close",onCta:()=>goTab("workouts"),shareId:id});
}
/* Weekly report: opens when the week is finished or rolls over. Numbers count up. */
function weekDone(){ const ws=wk.weeks||[], a=ws[ws.length-1]; if(!a) return;
  const A=weekActuals(a.start), ok=weekComplete(a), end=a.start+7*864e5, U=KG()?"kg":"lb";
  const acts={}; (wk.sessions||[]).filter(x=>x.k!=="lift"&&x.t>=a.start&&x.t<end).forEach(x=>{ const c=acts[x.k]||(acts[x.k]={n:0,m:0}); c.n++; c.m+=num(x.min,0); });
  const tiles=[["Lifts",a.lifts,` / ${a.planned}`,"lift"],["Sets",a.sets??0,"",""],["Activity",A.sport,"min","act"],["Exercise calories",A.burn,"kcal","fuel"]];
  const el=document.getElementById("done"); doneCta=()=>goTab("week"); closePop();
  el.innerHTML=`<div class="ddim" data-close></div><section class="dsheet wrep" role="dialog" aria-modal="true" aria-labelledby="dTitle">
    <div class="rhead"><h2 id="dTitle" tabindex="-1">${wkRange(a.start)}</h2><span class="wpill${ok?" ok":""}">${ok?"✓ Completed":`${a.lifts} of ${a.planned} lifts`}</span><button type="button" class="dx" data-close aria-label="Close"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
    <div class="rtiles">${tiles.map(([l,v,u,c])=>`<div class="${c}"><span>${l}</span><b data-count="${v}">0</b>${u?`<small>${u}</small>`:""}</div>`).join("")}</div>
    ${a.ups&&a.ups.length?`<div class="rsec"><h3>Going up next week</h3>${a.ups.map(x=>`<div class="rrow"><span>${esc(x.n)}</span><span class="mono">${x.from?fmtSet(x.n,x.from.w,x.from.r):""} <em>→ ${x.bw?`BW+${x.to}`:x.to} ${U}</em></span></div>`).join("")}</div>`:""}
    ${a.prs&&a.prs.length?`<div class="rsec rpr"><h3>Personal Records</h3>${a.prs.map(x=>`<div class="rrow"><span>${esc(x.n)}<small>${esc(x.kind)}</small></span><span class="mono">${fmtSet(x.n,x.w,x.r)}${x.was?`<small>was ${fmtSet(x.n,x.was.w,x.was.r)}</small>`:""}</span></div>`).join("")}</div>`:""}
    ${a.muscles&&a.muscles.length?`<div class="rsec"><h3>Sets by muscle</h3>${musclesHTML(a.muscles)}</div>`:""}
    ${Object.keys(acts).length?`<div class="rsec ract"><h3>Activities</h3>${Object.entries(acts).map(([k,c])=>`<div class="rrow"><span>${esc(actName(k))} × ${c.n}</span><span class="mono">${c.m} min</span></div>`).join("")}</div>`:""}
    <div class="dbtns"><button type="button" class="tb dcta" id="dCta">See next week</button></div></section>`;
  el.hidden=false; el.classList.remove("out"); document.body.classList.add("touring");
  el.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeDone());
  el.querySelector("#dCta").onclick=()=>closeDone(true);
  el.querySelector("#dTitle").focus({preventScroll:true});
  /* count up over 600ms */
  const nums=[...el.querySelectorAll("[data-count]")], t0=performance.now(), D=matchMedia("(prefers-reduced-motion: reduce)").matches?0:600;
  const step=now=>{ const k=D?Math.min(1,(now-t0)/D):1, e=1-Math.pow(1-k,3); nums.forEach(x=>{ x.textContent=Math.round(+x.dataset.count*e).toLocaleString(); }); if(k<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const setsLogged=id=>{ const d=DAYS.find(x=>x.id===id); return d?d.slots.reduce((n,s,i)=>n+(get(id,i).log||[]).filter(x=>x.d).length,0):0; };
/* A day is complete when every visible lift has all its planned sets ticked */
function dayComplete(id){
  const d=DAYS.find(x=>x.id===id), P=plan(); if(!d) return false;
  return d.slots.every((s,i)=>{ const A=P.days[id].slots[i]; if(A.skip) return true; if(s.cardio) return !!get(id,i).cdone; const log=get(id,i).log||[]; return log.filter(x=>x.d).length>=A.sets; });
}
function bind(){
  const v=document.getElementById("view");
  bindShell(v);
  const pb=v.querySelector("details#profileBox"); if(pb) pb.ontoggle=()=>{ profOpen=pb.open; };
  { const bd=v.querySelector("#bkDown"); if(bd) bd.onclick=()=>{ const data={app:"liftboard",v:1,at:new Date().toISOString(),keys:{}};
      ["liftboard.v1","liftboard.week.v2","liftboard.hist.v1"].forEach(k=>{ try{ data.keys[k]=localStorage.getItem(k); }catch(e){} });
      const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"})), a=document.createElement("a");
      a.href=url; a.download=`liftboard-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
      try{ wk.lastBackup=Date.now(); save(); }catch(e){} toast(["Backup downloaded"]); };
    const bf=v.querySelector("#bkFile"); if(bf) bf.onchange=()=>{ const f=bf.files&&bf.files[0]; if(!f) return; const r=new FileReader();
      r.onload=()=>{ try{ const d=JSON.parse(r.result); if(d.app!=="liftboard"||!d.keys) throw 0;
        askSure({title:"Restore backup?",text:`Replaces everything on this phone with the backup from ${new Date(d.at).toLocaleDateString()}.`,ok:"Restore",onOk:()=>{ Object.entries(d.keys).forEach(([k,x])=>{ if(x!=null) localStorage.setItem(k,x); }); location.reload(); }}); }
        catch(e){ toast(["That file isn't a Lift Board backup"]); } }; r.readAsText(f); }; }
  v.querySelectorAll("[data-testsound]").forEach(b=>b.onclick=()=>{ if(b.classList.contains("playing")) return; chimeIn(0); const t=b.textContent; b.classList.add("playing"); b.textContent="Playing…"; setTimeout(()=>{ b.classList.remove("playing"); b.textContent=t; },1200); });
  v.querySelectorAll("[data-collapse]").forEach(r=>{ const go=()=>{ wk.active={...(wk.active||{}),[cur]:-1}; save(); render(); };
    r.onclick=go; r.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } }; });
  v.querySelectorAll("[data-addex]").forEach(b=>b.onclick=()=>{ const a=b.dataset.addex;
    if(a==="open"){ addOpen=cur; addPick=""; addCustom=""; addCat=""; render(); return; }
    if(a==="close"){ addOpen=null; render(); return; }
    const isC=addPick===CUSTOM, name=isC?addCustom:addPick, cat=isC?(addCat||catOf(addCustom)):catOf(addPick);
    if(!name||!cat) return; addExtra(cur,name,cat); addOpen=null;
    const d=DAYS.find(x=>x.id===cur); if(d){ wk.active={...(wk.active||{}),[cur]:d.slots.length-1}; save(); }
    render(); toast([`Added ${name}`,`Counts as ${XCAT[cat][0].toLowerCase()} this week`]); });
  { const ap=v.querySelector("#addPick"); if(ap) ap.onchange=()=>{ addPick=ap.value; render(); };
    const ac=v.querySelector("#addCustom"); if(ac) ac.oninput=()=>{ addCustom=ac.value; }; if(ac) ac.onchange=()=>render();
    const at=v.querySelector("#addCat"); if(at) at.onchange=()=>{ addCat=at.value; render(); }; }
  v.querySelectorAll("[data-xrm]").forEach(b=>b.onclick=()=>{ removeExtra(cur,+b.dataset.xrm); render(); });
  v.querySelectorAll("[data-wo]").forEach(b=>b.onclick=()=>{ const t=+b.dataset.wo; openWeek=openWeek===t?null:t; render(); });
  v.querySelectorAll("[data-wc]").forEach(b=>b.onclick=()=>{ const t=+b.dataset.wc, w=(wk.weeks||[]).find(x=>x.start===t); countWeek(t,!(w&&w.counted)); render(); });
  v.querySelectorAll("[data-lx]").forEach(b=>b.onclick=()=>{ const n=b.dataset.lx; openLift=openLift===n?null:n; render(); });
  v.querySelectorAll("[data-hv]").forEach(b=>b.onclick=()=>{ const to=b.dataset.hv, O=["cal","weeks","lifts"]; if(to===histView) return;
    swapView(O.indexOf(to)>O.indexOf(histView)?"subfwd":"subback",()=>{ histView=to; try{localStorage.setItem(KEY+".hv",histView)}catch(e){}; render(); }); });
  v.querySelectorAll("[data-cal]").forEach(b=>b.onclick=()=>{ calOff=Math.min(0,calOff+ +b.dataset.cal); calSel=null; render(); });
  v.querySelectorAll("[data-cd]").forEach(b=>b.onclick=()=>{ calSel=calSel===b.dataset.cd?null:b.dataset.cd; render();
    const el=document.getElementById("calsel"); if(el) el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"}); });
  attachDials(v,dialCfg);
  const inProf=el=>wk.setupDone&&!!el.closest("#profileBox");
  const stage=(k,val)=>{ draft=draft||{}; draft[k]=val; if(k==="acts"){ const f=fixSports({acts:val,mainSport:draft.mainSport??wk.mainSport,sport2:draft.sport2??wk.sport2,season:draft.season??wk.season}); draft.mainSport=f.mainSport; draft.sport2=f.sport2; draft.season=f.season; } render(); };
  v.querySelectorAll("[data-sp]").forEach(b=>b.onclick=()=>{ const src=inProf(b)?{...wk,...(draft||{})}:wk, a=b.dataset.sp; let m=src.mainSport||"", s2=src.sport2||"";
    if(!a){ m=""; s2=""; } else if(a===m){ m=s2; s2=""; } else if(a===s2){ s2=m; m=a; } else if(!m) m=a; else s2=a;
    if(inProf(b)){ draft=draft||{}; draft.mainSport=m; draft.sport2=s2; if(!m) draft.season="Off-season"; render(); return; }
    wk.mainSport=m; wk.sport2=s2; fixSports(wk); save(); render(); });
  const ps=document.getElementById("profSave"); if(ps) ps.onclick=()=>{ const d=draft; draft=null; const a=fx(plan()); Object.assign(wk,d); if(d&&"days" in d){ wk.days=+d.days; if(ldays().length!==wk.days) wk.ldays=LDEF[wk.days]||[]; } fixSports(wk); save(); const b=fx(plan()); render(); toast(["Profile saved",...diffFx(a,b)]); };
  v.querySelectorAll(".actt").forEach(b=>{ if(inProf(b)) b.onclick=()=>{ const a=b.dataset.actt, cur0={...(wk.acts||{}),...((draft&&draft.acts)||{})}; stage("acts",{...cur0,[a]:!cur0[a]}); }; });
  v.querySelectorAll(".actt").forEach(b=>{ if(!inProf(b)) b.onclick=()=>change(()=>{ const a=b.dataset.actt; wk.acts={...(wk.acts||{}),[a]:!enabled(a)}; if(wk.adhoc&&wk.adhoc[a]){ const h={...wk.adhoc}; delete h[a]; wk.adhoc=h; } fixSports(wk); }); });
  const ss=document.getElementById("setupSave"); if(ss) ss.onclick=()=>{ wk.createdAt=wk.createdAt||Date.now(); wk.setupDone=true; wk.weekStart=weekStartOf(Date.now()).getTime(); wk.ldays=LDEF[DAYS.length]||[]; fitPace(); nav="workouts"; cur="home"; keepNav(); save(); render(); window.scrollTo(0,0); setupDone(); };
  const rt=document.getElementById("replayTour"); if(rt) rt.onclick=()=>{ wk.tabTips={}; save(); openOnb(); };
  const mc=document.getElementById("moveCopy"); if(mc) mc.onclick=async()=>{ const data=JSON.stringify({v:1,slots:storage.getItem(KEY),wk:storage.getItem(KEY2),hist:storage.getItem(KEY3)}); const t=document.getElementById("moveTxt"); t.value=data; t.select(); try{ await navigator.clipboard.writeText(data); toast(["Copied","Paste it into Lift Board on the other device."]); }catch(e){ toast(["Selected","Copy the text in the box."]); } };
  const ml=document.getElementById("moveLoad"); if(ml) ml.onclick=()=>{ let o; try{ o=JSON.parse(document.getElementById("moveTxt").value); if(!o||o.v!==1||!o.wk) throw 0; }catch(e){ toast(["Couldn't load","Paste the full text from Copy my data."]); return; }
    const go=()=>{ storage.setItem(KEY,o.slots||"{}"); storage.setItem(KEY2,o.wk); storage.setItem(KEY3,o.hist||"{}"); location.reload(); };
    if(wk.setupDone) askSure({title:"Replace your data",text:"Everything on this device is replaced with the pasted data.",ok:"Replace",onOk:go}); else go(); };
  const rp=document.getElementById("resetProfile"); if(rp) rp.onclick=()=>askSure({title:"Reset profile",text:"This erases your setup, logs and lift history on this device and starts over from the welcome screen. Copy your data first if you want to keep it.",ok:"Erase and start over",onOk:()=>{ [KEY,KEY2,KEY3,KEY+".tab"].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} }); location.hash=""; location.reload(); }});
  v.querySelectorAll(".exrow[data-ex]").forEach(b=>b.onclick=()=>{ const i=+b.dataset.ex; wk.active={...(wk.active||{}),[cur]:i}; save(); render(); });
  v.querySelectorAll(".cdone").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i, A=plan().days[cur].slots[i], st=get(cur,i); if(!st.act&&A.min) set(cur,i,"act",String(A.min)); set(cur,i,"cdone",true); fxOnce.slot=`${cur}-${i}`;
    if(!(wk.done||{})[cur]&&dayComplete(cur)){ const id=cur, n=setsLogged(id); markDone(id); render(); dayDone(id,n); return; }
    const d=DAYS.find(x=>x.id===cur), n=nextIdx(d,plan().days[cur],i); if(n!=null){ wk.active={...(wk.active||{}),[cur]:n}; save(); } render(); });
  v.querySelectorAll("input[data-set]").forEach(el=>{ el.oninput=()=>logSet(+el.dataset.i,+el.dataset.set,el.dataset.f,el.dataset.f==="w"?fromU(el.value):el.value); el.onchange=()=>render(); });
  v.querySelectorAll(".chk").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i,k=+b.dataset.set, x=(get(cur,i).log||[])[k]||{};
    if(!x.w){ const ph=document.getElementById(`w-${cur}-${i}-${k}`).placeholder; if(+ph>0) logSet(i,k,"w",ph); }
    if(!x.r){ const ph=document.getElementById(`r-${cur}-${i}-${k}`).placeholder; if(+ph>0) logSet(i,k,"r",ph); }
    if(!x.d) wtStart(cur);
    logSet(i,k,"d",!x.d); if(!x.d){ const d0=DAYS.find(z=>z.id===cur), s0=d0.slots[i]; startRest(exName(d0,s0,i),s0,k,d0); }
    if(!x.d) closeSheet();
    if(!x.d&&!(wk.done||{})[cur]&&dayComplete(cur)){ const id=cur, n=setsLogged(id); markDone(id); render(); dayDone(id,n); return; }
    let finished=false;
    if(!x.d){ fxOnce.chk=`${cur}-${i}-${k}`; const A=plan().days[cur].slots[i]; if((get(cur,i).log||[]).filter(z=>z.d).length===A.sets){ fxOnce.slot=`${cur}-${i}`; finished=true; } }
    render(); if(finished) nextSheet(cur,i); });
  if(pendNudge){ const p=pendNudge; pendNudge=null; if(dayById(cur)){ set(cur,p.i,"nudged",p.ticks); setTimeout(()=>askNudge(p),250); } }
  v.querySelectorAll("[data-nudge]").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i, st=get(cur,i), log=(st.log||[]).slice(), t=log.filter(x=>x.d).length, w=b.dataset.nudge;
    if(w!==""){ for(let k=0;k<log.length;k++) if(!log[k].d) log[k]={...log[k],w}; const A=plan().days[cur].slots[i]; while(log.length<A.sets) log.push({w}); set(cur,i,"log",log); }
    set(cur,i,"nudged",t); render(); });
  v.querySelectorAll("[data-stog]").forEach(r=>{ const go=()=>{ wk.stretchOpen={...(wk.stretchOpen||{}),[cur]:!(wk.stretchOpen||{})[cur]}; save(); render(); }; r.onclick=go; r.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } }; });
  const sb=document.getElementById("stretchBtn"); if(sb) sb.onclick=()=>{ wk.stretchDone={...(wk.stretchDone||{}),[cur]:!(wk.stretchDone||{})[cur]}; save(); render(); };
  v.querySelectorAll(".sidebtn").forEach(b=>b.onclick=()=>{ set(cur,+b.dataset.i,"side",b.dataset.side); render(); });
  v.querySelectorAll(".addset").forEach(b=>b.onclick=()=>{ const i=+b.dataset.i, log=(get(cur,i).log||[]).slice(), A=plan().days[cur].slots[i]; while(log.length<A.sets) log.push({}); log.push({}); set(cur,i,"log",log); render(); });
  const db=document.getElementById("doneBtn"); if(db) db.onclick=()=>{ const id=cur; if((wk.done||{})[id]) return; const n=setsLogged(id); markDone(id); render(); dayDone(id,n); };
  v.querySelectorAll("[data-swap]").forEach(b=>b.onclick=()=>swapSheet(b.dataset.swap));
  v.querySelectorAll("[data-share]").forEach(bindShare);
  const fw=document.getElementById("finishWeek"); if(fw) fw.onclick=()=>askSure({title:"Finish this week?",text:"This week's numbers are saved to history and next week's plan starts now. Lifts you didn't get to come first next week. You can undo until next week begins.",ok:"Finish week",onOk:finishWeek});
  const uf=document.getElementById("undoFinish"); if(uf) uf.onclick=undoFinish;
  const nw=document.getElementById("newWeek"); if(nw) nw.onclick=()=>askSure({title:"Start a new week",text:"This closes out the week: it saves this week's numbers to history and resets the check-in and day logs.",ok:"Start new week",onOk:()=>{ const s={lifts:DAYS.filter(d=>(wk.done||{})[d.id]).length,planned:DAYS.length,cardio:weekActuals(weekStartOf(Date.now()).getTime()).burn}; newWeek(); render(); weekDone(s); }});
  bindWheel(v);
  v.querySelectorAll(".seg[data-key]").forEach(g=>g.querySelectorAll("button").forEach(b=>b.onclick=()=>{
    const k=g.dataset.key, raw=b.dataset.v; fxOnce.seg=[k,raw];
    if(inProf(g)){ stage(k,raw); return; }
    if(!wk.setupDone){ wk[k]=(k==="days"||k==="time")?+raw:raw; if(k==="mainSport"&&!raw) wk.season="Off-season"; save(); render(); return; }
    if(k==="today"){ const Pa=plan(); wk.today={...(wk.today||{}),[cur]:raw}; save(); const Pb=plan(); render(); toast(dayDiff(Pa,Pb,cur)); return; }
    if(k==="season"&&Object.keys(wk.done||{}).length&&!b.dataset.sure){ askSure({title:`Switch to ${raw.toLowerCase()}`,text:"Your split changes, so days already marked done this week are cleared. Your lift history stays.",ok:"Switch",onOk:()=>{ b.dataset.sure=1; b.click(); }}); return; }
    if(k==="ramp"){ change(()=>{ wk.ramp=raw; }); if(raw==="Yes") toast(["Pre-season ramp","One 45-min zone 2 session added. It has its own Zone 2 tab."],6000); return; }
    change(()=>{
      wk[k]=(k==="days"||k==="time")?+raw:raw;
      if(k==="mode") fitPace();
      if(k==="level") wk.guide=guideFor(raw);
      if(k==="mainSport"&&!raw) wk.season="Off-season";
      if(k==="season"){ wk.days=raw==="In-season"?2:3; wk.done={}; wk.donePlan={}; wk.upNext=""; wk.missedNote=null; }
    }); }));
  v.querySelectorAll("input[data-act]").forEach(el=>el.onchange=()=>change(()=>{ const k=el.dataset.act; logAct(k,+el.dataset.n,el.value); }));
  v.querySelectorAll("input[data-w]").forEach(el=>el.onchange=()=>{ if(U_KEYS.has(el.dataset.w)&&KG()&&!el._uv){ el._uv=1; el.value=el.dataset.w==="rate"?String(Math.round(+el.value*L2K*100)/100):fromU(el.value); }
    if(inProf(el)){ stage(el.dataset.w,el.value); return; } if(!wk.setupDone){ wk[el.dataset.w]=el.value; save(); return; } change(()=>{ wk[el.dataset.w]=el.value; }); });
  v.querySelectorAll("select[data-i]").forEach(el=>el.onchange=()=>{ set(cur,+el.dataset.i,"choice",el.value); render(); if(el.value===CUSTOM){const c=document.getElementById(`cus-${cur}-${el.dataset.i}`); c&&c.focus();} });
  v.querySelectorAll(".custom").forEach(el=>{ el.oninput=()=>set(cur,+el.dataset.i,"custom",el.value); el.onchange=()=>render(); });
  v.querySelectorAll(".nums input[data-k]").forEach(el=>{ el.oninput=()=>set(cur,+el.dataset.i,el.dataset.k,el.value); if(el.dataset.k==="act"){ el.onfocus=()=>{ el._fx=fx(plan()); }; el.onchange=()=>{ const b=fx(plan()); render(); toast(diffFx(el._fx||b,b)); }; } });
}

/* ---------- Guided tour: first run, before setup. Controls write real settings;
   a replay after setup runs on a snapshot that is restored on close. ---------- */
let tour=null;
function openTour(){ closePop(); tour={i:-2,snap:wk.setupDone?JSON.stringify(wk):null,added:{}}; planPrev=null; renderTour("open"); }
function closeTour(){
  const t=tour; if(!t) return; tour=null;
  const el=document.getElementById("tour"); el.classList.add("out");
  setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out","step","opening"); if(document.getElementById("done").hidden) document.body.classList.remove("touring"); },200);
  if(t.snap){ const o=JSON.parse(t.snap); Object.keys(wk).forEach(k=>delete wk[k]); Object.assign(wk,o); }
  else { wk.tourDone=true; cur="home"; }
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
   {tab:"Season",page:"Season",name:"Season",title:"Choose your split",
    text:"Pick your main sport and specify if you're in- or off-season. This determines the cadence for progressive overload and any accessory work.",
    body:card("Season",`${lbl("Main sport")}${tchips("sport",[["","None"],...SPORTS.map(a=>[a,ACT[a].name])],hasSport()?wk.mainSport:"",3)}${hasSport()?`${ttoggle("season","In-season","In-season","Off-season")}`:""}`,1)+card("Goal",rowsH([["Goal",goalName(wk.mode)]]))},
   {tab:"Season",page:"Season",name:"Goal",title:"Pick a goal",
    text:"The goal, combined with your body settings, structures the cardio portion of lift days.",
    body:card("Goal",tchips("mode",GOALS,wk.mode,2),1)},
   {tab:"This week",page:"This week",name:"Your week",title:"Your week adjusts itself",
    text:"Different factors combine to adjust your week; if anything changes, the week changes too.",
    body:card("Schedule",`${tstep("days","Lifting days",inS?[0,1,2,3]:[0,1,2,3,4,5,6,7])}${tstep("time","Time per session",[30,45,60,75],"min")}${ttoggle("ss","Supersets")}`,1)
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
  if(i===-1){
    /* plain-language overview: four swipeable pictures of what the app does */
    const chips=(o,on)=>`<div class="achips">${o.map(x=>`<span${x===on?' class="on"':""}>${x}</span>`).join("")}</div>`;
    const A=[
      [`<div class="acard">${chips(["Off-season","In-season"],"In-season")}</div><div class="aarrow">↓</div><div class="acard dark"><span class="plab">Your days now</span><b>Full Body A · Full Body B</b><small>2 sets each · extra work for your sport</small></div>`,
       "Train for your season","Build strength when you're not playing much. When your season begins, the plan keeps you strong without wearing you out."],
      [`<div class="acard">${chips(["Lose fat","Maintain","Build muscle"],"Lose fat")}</div><div class="acard"><p class="abig"><b>1,595</b> calories a day</p><div class="abar"><i style="width:32%"></i><i style="width:68%"></i></div><small class="aacc">+85 a day from your extra games</small></div>`,
       "Know how to fuel","Choose your goal. Your fuel target moves with whatever else you did this week."],
      [`<div class="acard">${chips(["Lower body","Balanced","Upper body"],"Lower body")}</div><div class="acard alist"><div><b>Day 1 · Lower</b><small class="aacc">+1 set</small></div><div><b>Day 2 · Upper</b><small>shorter</small></div><div><b>Day 3 · Lower</b><small class="aacc">+1 set</small></div></div>`,
       "Your focus, your extra sets","Specify what you want to grow and any bonus work lands there."],
      [`<div class="acard">${chips(["Female","Male","Other"],"Female")}</div><div class="acard"><p class="abig"><span class="atag">↑</span>Next time <b class="aacc">140 lb</b></p><small>Protein 110–140 g a day · Maintenance 1,845</small></div>`,
       "Numbers that power your plan.","Sex, size and body fat set your metabolism, protein and progressive overload."]];
    el.innerHTML=`<div class="twelcome tabout" role="dialog" aria-modal="true" aria-labelledby="tTitle">
      <span class="plab">What this does</span>
      <h2 id="tTitle" tabindex="-1">A tailored plan</h2>
      <p>Lift Board writes your workouts and adjusts them every week to fit your sport, your goal and how you're feeling.</p>
      <div class="acar" id="acar">${A.map(([v,t,c],k)=>`<figure class="aslide" aria-label="${k+1} of ${A.length}"><div class="avis">${v}</div><figcaption><b>${t}</b>${c}</figcaption></figure>`).join("")}</div>
      <div class="adots" aria-hidden="true">${A.map((_,k)=>`<i${k?"":' class="on"'}></i>`).join("")}</div>
      <div class="tbtns two"><button type="button" class="tb ghost" id="tBack">Back</button><button type="button" class="tb" id="tNext">Show me around</button></div>
    </div>`;
    el.hidden=false; document.body.classList.add("touring");
    el.classList.toggle("step",!!focus); el.classList.toggle("opening",false);
    const car=el.querySelector("#acar"), dots=[...el.querySelectorAll(".adots i")];
    car.addEventListener("scroll",()=>{ const k=Math.round(car.scrollLeft/car.clientWidth); dots.forEach((d,j)=>d.classList.toggle("on",j===k)); },{passive:true});
    el.querySelector("#tBack").onclick=()=>{ tour.i=-2; renderTour(true); };
    el.querySelector("#tNext").onclick=()=>{ tour.i=0; renderTour(true); };
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
    el.querySelector("#tNext").onclick=()=>{ tour.i=-1; renderTour(true); };
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
/* ---------- Onboarding: welcome → what it's for → help level demo → six setup steps ----------
   Shows once (wk.onbDone); Replay tour on You opens it again. Answers start from your current settings; Skip leaves them as they are. */
let onb=null, onbDemo=0;
const LV_NAME=["Beginner","Some Experience","Advanced"];
const LV={mode:["Guided","Standard","Flexible"],s1:["3 × 10 · 65 lb","4 × 8 · 135 lb","4 × 6–10 · 155"],s2:["3 × 10 · 45 lb","3 × 8 · 95 lb","3 × 8–12 · 105"],
  p:[["Tips on every screen","The reason for each exercise","A fixed plan to follow"],["Tips the first time you see each screen","Rest timer and next-time targets","Swap exercises when you want to"],["No tips; explanations only if you tap (i)","Swap, add and skip exercises freely","Assumes you know form and your numbers"]]};
function paintLvl(el,v){ const r=el.querySelector(".lvlp"); if(!r) return; r.dataset.v=v;
  const set=(f,t)=>{ const x=r.querySelector(`[data-f="${f}"]`); if(x) x.textContent=t; };
  set("mode",LV.mode[v]); set("s1",LV.s1[v]); set("s2",LV.s2[v]); LV.p[v].forEach((t,i)=>set("p"+i,t));
  const rg=r.querySelector(".olvl"); if(rg){ if(!rg._drag) slideLvl(rg,v); rg.setAttribute("aria-valuetext",LV_NAME[v]); }
  r.querySelectorAll("[data-lvl]").forEach(b=>b.setAttribute("aria-pressed",String(+b.dataset.lvl===v))); }
/* the level slider glides to a stop instead of jumping (instant with Reduce Motion) */
function slideLvl(rg,to){ cancelAnimationFrame(rg._raf); const from=+rg.value; if(Math.abs(from-to)<0.001) return;
  const D=matchMedia("(prefers-reduced-motion: reduce)").matches?0:450, t0=performance.now();
  const f=now=>{ const k=D?Math.min(1,(now-t0)/D):1, e=1-Math.pow(1-k,3); rg.value=from+(to-from)*e; if(k<1) rg._raf=requestAnimationFrame(f); };
  rg._raf=requestAnimationFrame(f); }
/* weekly activities on the lift-days step: classes always, plus anything else already switched on (not the main sport) */
const ONB_ACTS=()=>ACT_IDS.filter(a=>a!=="lift"&&(ACT[a].cls||enabled(a))&&a!==(onb?onb.sport:wk.mainSport));
const ONB_SPORTS=[["pickle","Pickleball"],["tennis","Tennis"],["run","Running"],["bike","Biking"],["soccer","Soccer"],["volleyball","Volleyball"],["climb","Climbing"],["golf","Golf"],["hockey","Hockey"],["rugby","Rugby"],["yoga","Yoga"],["pilates","Pilates"],["","None"]];
const LEVELS=[["new","Beginner","Tips on every screen"],["some","Some Experience","Tips the first time you see each screen."],["years","Advanced","No tips. Explanations only if you tap (i)."]];
const guideFor=l=>l==="years"?"Less":"More";
const ONB_GOALS=[["Deficit only","Lose weight fast","Up to 1% of your weight. Lifts may slip."],["Recomp","Lose fat, keep strength","Up to 0.7% of your weight while you hold your lifts."],["Maintain","Maintain","Eat what you burn and train as normal."],["Build","Build muscle","Eat a little over. Extra sets go to your focus."]];
const ONB_Q=[["What do you do?","Your main activity sets the season. In-season, lifting is deprioritized so you’re fresh."],
  ["What are you training for?","Your goal sets your fuel and how hard you train. You can change it anytime in Plan → Season."],
  ["Which days do you usually lift?","Lifts get queued up according to your plan; you can skip days, move workouts around, and always change preferences later."],
  ["Where do you want extra focus?","Whenever you have the extra energy or time, you’ll see more exercises for your chosen focus."],
  ["How long have you been lifting?","This sets how much guidance you see. Change it anytime under You → Training preferences."],
  ["A bit about you","Your size sets your base burn, protein and starting weights."],
  ["You’re set","Your plan builds itself from here and adapts every week."]];
function openOnb(){
  closePop(); const sp=MAINS.includes(wk.mainSport)?wk.mainSport:"";
  onb={s:wk.setupDone?1:0,lvl:1,sport:sp,inS:wk.season==="In-season",goal:wk.mode||"Recomp",days:wk.setupDone?ldays():(LDEF[3]||[]).slice(),
    pb:sp?(cnt(sp)||2):0,ac:Object.fromEntries(ONB_ACTS().map(a=>[a,enabled(a)?cnt(a):0])),focus:wk.focus||"Balanced",level:wk.level||(wk.guide==="Less"?"years":"some"),sex:wk.sex||"Female",age:wk.age||"",steps:wk.steps||"",height:wk.height||"",weight:wk.weight||"",bf:wk.bf||""};
  renderOnb(true);
}
function closeOnb(){ onb=null; const el=document.getElementById("tour"); el.classList.add("out");
  setTimeout(()=>{ el.hidden=true; el.innerHTML=""; el.classList.remove("out","step"); document.body.classList.remove("touring"); },200); }
/* write the answers into the real settings (logs and history are untouched) */
function applyOnb(o,real){
  /* rebuild from the answers: anything not picked here is turned off, so old activities don't linger */
  wk.acts={lift:true}; if(o.sport){ wk.acts[o.sport]=true; wk[o.sport]=o.pb; }
  wk.mainSport=o.sport; wk.season=o.sport&&o.inS&&SEASONAL(o.sport)?"In-season":"Off-season";
  Object.entries(o.ac||{}).forEach(([a,c])=>{ if(a===o.sport) return; if(c>0){ wk.acts[a]=true; wk[a]=c; } });
  if(wk.sport2&&!wk.acts[wk.sport2]) wk.sport2="";
  wk.level=o.level; wk.guide=guideFor(o.level); wk.mode=o.goal; wk.ldays=o.days.slice().sort(); wk.days=o.days.length; wk.focus=o.focus; wk.sex=o.sex;
  ["age","height","weight","bf","steps"].forEach(k=>{ if(String(o[k]).trim()!=="") wk[k]=String(o[k]); });
  fixSports(wk); syncDays(); fitPace();
  if(real){ wk.createdAt=wk.createdAt||Date.now(); if(!wk.setupDone){ wk.setupDone=true; wk.weekStart=weekStartOf(Date.now()).getTime(); } wk.tourDone=true; wk.onbDone=true; save(); }
}
/* preview the plan these answers would make, without keeping them */
function onbPreview(o){ const snap=JSON.stringify(wk); applyOnb(o,false); const P=plan(), days=DAYS.map(d=>({id:d.id,title:d.title})), food=r5(P.math.intake);
  const o2=JSON.parse(snap); Object.keys(wk).forEach(k=>delete wk[k]); Object.assign(wk,o2); syncDays(); return {days,food}; }
function renderOnb(focus){
  const el=document.getElementById("tour"), o=onb, s=o.s, set=(k,v)=>{ o[k]=v; renderOnb(); };
  const btns=(back,next,label,go)=>`<div class="tbtns two">${back?`<button type="button" class="tb ghost" data-ob="back">Back</button>`:"<span></span>"}<button type="button" class="tb${go?" go":""}" data-ob="${next}">${label}</button></div>`;
  const skip=wk.setupDone?`<button type="button" class="tskip" data-ob="skip">Skip</button>`:"";
  let h="";
  if(s===0) h=`<div class="onb mid"><span class="plab">Lift Board</span><h2 class="oh" tabindex="-1">Welcome!</h2>
    <p>Thanks for trying this little program. I've never built anything for anyone else before. I hope you enjoy it.</p><p class="wsig">Emma</p>
    ${btns(false,"next","Get started")}</div>`;
  else if(s===1) h=`<div class="onb"><div class="otop"><span class="plab">What it's for</span>${skip}</div><h2 class="oh big" tabindex="-1">Plan your week</h2>
    <p class="olead">Share your goal, your activities and how you feel. Lift Board does the rest.</p>
    <div class="ofeat"><div class="f1"><svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6fd0b4" stroke-width="1.8"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/></svg><div><b>What to lift today</b><span>Exercises, sets and weights, based on last time.</span>
      <div class="lever" style="--lc:#6fd0b4;--ld:0.0s" role="img" aria-label="For example: Last: 135 × 8 ✓ leads to Today: 140 lb; Last: 140 × 5 leads to Today: hold 140."><span class="lv" aria-hidden="true"><i>Last: 135 × 8 ✓</i><i>Last: 140 × 5</i></span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M9 4.5 12.5 8 9 11.5"/></svg><span class="lv out" aria-hidden="true"><i>Today: 140 lb</i><i>Today: hold 140</i></span></div></div></div><div class="f2"><svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fc96bf" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg><div><b>Fits around everything else</b><span>Your lift schedule adapts to sports, classes and missed days.</span>
      <div class="lever" style="--lc:#fc96bf;--ld:0.8s" role="img" aria-label="For example: Pickleball ×2 leads to Leg day −1 set; Missed Wed leads to Lift moves to Fri."><span class="lv" aria-hidden="true"><i>Pickleball ×2</i><i>Missed Wed</i></span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M9 4.5 12.5 8 9 11.5"/></svg><span class="lv out" aria-hidden="true"><i>Leg day −1 set</i><i>Lift moves to Fri</i></span></div></div></div><div class="f3"><svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fea06a" stroke-width="1.8"><path d="M12 3c3 4 5 6.5 5 10a5 5 0 0 1-10 0c0-3.5 2-6 5-10Z"/></svg><div><b>Fuel and recover</b><span>A daily calorie target and rest times that adjust to your training and how you feel.</span>
      <div class="lever" style="--lc:#fea06a;--ld:1.6s" role="img" aria-label="For example: + Spin class leads to Fuel today +250; Feeling rough leads to Rest +15s."><span class="lv" aria-hidden="true"><i>+ Spin class</i><i>Feeling rough</i></span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M9 4.5 12.5 8 9 11.5"/></svg><span class="lv out" aria-hidden="true"><i>Fuel today +250</i><i>Rest +15s</i></span></div></div></div></div>
    ${btns(!wk.setupDone,"next","Next")}</div>`;
  else if(s===2){ const v=o.lvl;
    /* the demo card: everything is rendered once; changing level toggles parts in place so they animate */
    h=`<div class="onb lvlp" data-v="${v}"><div class="otop"><span class="plab">For any level</span>${skip}</div><h2 class="oh big" tabindex="-1">As much help as you want</h2>
    <p class="olead">Same workout for different experience levels.</p>
    <div class="lvwrap"><input class="olvl" type="range" min="0" max="2" step="0.01" value="${v}" aria-label="Experience level" aria-valuetext="${LV_NAME[v]}">
    <div class="olvls">${LV_NAME.map((n,k)=>`<button type="button" data-lvl="${k}" aria-pressed="${k===v}">${n}</button>`).join("")}</div></div>
    <section class="odemo" aria-live="polite">
      <div class="orow"><span class="weye">Day 1 · Lower</span><span class="omode" data-f="mode"></span></div>
      <div class="lvx tip"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6fd0b4" stroke-width="1.6"><circle cx="8" cy="8" r="6.5"/><path d="M8 7.2v4M8 4.8v.2"/></svg><span>Start light. The app finds your working weight over the first two weeks.</span></div>
      <div class="orow"><b>Hip Thrust (Barbell)</b><span class="mono" data-f="s1"></span></div>
      <div class="lvx why">Why: hip thrusts build glutes with less strain on your back than squats.</div>
      <div class="orow line"><b>Romanian Deadlift</b><span class="mono" data-f="s2"></span></div>
      <div class="lvx swap"><span class="swl">Swap freely</span><span class="chip">B-Stance Thrust</span><span class="chip">Sumo Deadlift</span><span class="chip">+ Add exercise</span></div>
      <div class="lvx rest">Rest 2:30. The timer starts when you tick a set and chimes when it's time.</div>
    </section>
    <ul class="opts"><li><i aria-hidden="true"></i><span data-f="p0"></span></li><li><i aria-hidden="true"></i><span data-f="p1"></span></li><li><i aria-hidden="true"></i><span data-f="p2"></span></li></ul>
    ${btns(true,"next","Get started")}</div>`; }
  else { const n=s-2, Q=ONB_Q[n-1], chip=(on,attr,l)=>`<button type="button" ${attr} aria-pressed="${on}">${l}</button>`;
    let body="";
    if(n===1) body=`<div class="ogrid three">${ONB_SPORTS.map(([a,l])=>chip(o.sport===a,`data-os="${a}"`,l)).join("")}</div>
      ${o.sport&&SEASONAL(o.sport)?`<div class="q tgl"><span id="oinS">In-season now</span><div class="seg toggle"><button type="button" role="switch" aria-checked="${o.inS}" aria-labelledby="oinS" data-oin><i aria-hidden="true"></i></button></div></div>`:""}`;
    if(n===2) body=`<div class="ogoals">${ONB_GOALS.map(([v,l,d])=>`<button type="button" data-og="${v}" aria-pressed="${o.goal===v}"><b>${l}</b><span>${d}</span></button>`).join("")}</div>`;
    if(n===3){ const acts=[...(o.sport?[[o.sport,"pb",ACT[o.sport].name]]:[]),...ONB_ACTS().map(a=>[a,"ac:"+a,ACT[a].name])], val=k=>k.startsWith("ac:")?(o.ac[k.slice(3)]||0):o[k];
      body=`<span class="plab">Lift days</span><div class="ldgrid">${"MTWTFSS".split("").map((c,k)=>`<button type="button" data-od="${k}" aria-pressed="${o.days.includes(k)}" aria-label="${WD[k]}">${c}</button>`).join("")}</div>
      <span class="plab">Other activities · per week, any day</span>${acts.map(([a,k,l])=>`<div class="ostep"><span>${l}</span><span><button type="button" data-oc="${k}" data-d="-1" aria-label="Fewer ${l}">−</button><output>${val(k)}</output><button type="button" data-oc="${k}" data-d="1" aria-label="More ${l}">+</button></span></div>`).join("")}`; }
    if(n===4) body=`<div class="ogrid three">${[["Lower","Lower body"],["Balanced","Balanced"],["Upper","Upper body"]].map(([v,l])=>chip(o.focus===v,`data-of="${v}"`,l)).join("")}</div>`;
    if(n===5) body=`<div class="ogoals">${LEVELS.map(([v,l,d])=>`<button type="button" data-olv="${v}" aria-pressed="${o.level===v}"><b>${l}</b><span>${d}</span></button>`).join("")}</div>`;
    if(n===6) body=`<div class="ogrid three">${["Female","Male","Other"].map(v=>chip(o.sex===v,`data-ox="${v}"`,v)).join("")}</div>
      <div class="nums two">${[["age","Age","numeric"],["height","Height (in)","decimal"],["weight",`Weight (${KG()?"kg":"lb"})`,"decimal"],["bf","Body fat %","decimal"],["steps","Daily steps","numeric"]].map(([k,l,m])=>`<label class="field" for="o-${k}"><span>${l}</span><input id="o-${k}" data-oi="${k}" inputmode="${m}" value="${esc(k==="weight"&&o[k]!==""?toU(o[k]):o[k])}"${k==="bf"?' placeholder="optional"':k==="steps"?' placeholder="e.g. 8000"':""}></label>`).join("")}</div>`;
    const pv=n>=6?onbPreview(o):null;
    if(n===7){ const D=pv.days, today=monIdx(new Date()), ds=o.days.slice().sort(), nextD=ds.find(d=>d>=today)??ds[0];
      const order=ds.filter(d=>d>=today).concat(ds.filter(d=>d<today));
      const rest=order.slice(1).map((d,i)=>({t:(D[(i+1)%D.length]||{}).title||"Lift",d:WD[d],a:0})).concat([[o.sport,o.pb],...Object.entries(o.ac||{}).filter(([a])=>a!==o.sport)].filter(([a,c])=>a&&c).map(([a,c])=>({t:ACT[a].name+(c>1?` ×${c}`:""),d:"Any day",a:1})));
      body=`<section class="ofirst"><span class="weye">First workout · ${D.length?(nextD===today?"Today":WD[nextD]):"whenever you like"}</span><h3>${esc(D.length?D[0].title:"Log an activity")}</h3><p>Starting weights are a guess. Log your first sets and the app adjusts from there.</p></section>
      <div class="orest2">${rest.map((r,i)=>`<div class="${r.a?"a":""}" style="animation-delay:${300+i*120}ms"><b>${esc(r.t)}</b><span>${r.d}</span></div>`).join("")}</div>`; }
    const gName=(ONB_GOALS.find(g=>g[0]===o.goal)||[])[1], nd=o.days.length;
    const prev=[[o.sport&&!SEASONAL(o.sport)?"Main activity":"Season",o.sport?`${ACT[o.sport].name}${SEASONAL(o.sport)?` · ${o.inS?"in-season":"off-season"}`:""}`:"No sport"],...(n>=2?[["Goal",gName]]:[]),...(n>=3?[["Week",`${nd} lift${nd===1?"":"s"}${o.sport&&o.pb?` + ${o.pb}× ${ACT[o.sport].name.toLowerCase()}`:""}${Object.entries(o.ac||{}).filter(([a,c])=>c&&a!==o.sport).map(([a,c])=>` + ${c}× ${ACT[a].name.toLowerCase()}`).join("")}`]]:[]),...(n>=4?[["Focus",o.focus==="Balanced"?"Balanced":o.focus+" body"]]:[]),...(n>=5?[["Guidance",LEVELS.find(x=>x[0]===o.level)[1]]]:[]),...(n>=6?[["Fuel",`${pv.food.toLocaleString()} kcal a day`]]:[])];
    h=`<div class="onb"><div class="otop"><div class="odots" role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax="7" aria-valuenow="${n}">${[1,2,3,4,5,6,7].map(i=>`<i class="${i===n?"on":i<n?"past":""}"></i>`).join("")}</div>${skip}</div>
      <div class="ostepbody"><h2 class="oh" tabindex="-1">${Q[0]}</h2><p class="olead sm">${Q[1]}</p>${body}</div>
      ${n<7?`<section class="oprev" aria-label="Plan so far"><span class="weye">Plan so far</span>${prev.map(([k,v])=>`<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</section>`:""}
      ${btns(true,n===7?"done":"next",n===7?"Go to Workouts":n===6?"Build my plan":"Next",n===7)}</div>`; }
  el.innerHTML=`<div class="tscroll">${h}</div>`; el.hidden=false; document.body.classList.add("touring"); el.classList.toggle("step",!!focus);
  const go=d=>{ o.s=Math.max(0,o.s+d); renderOnb(true); el.querySelector(".tscroll").scrollTop=0; };
  el.querySelectorAll("[data-ob]").forEach(b=>b.onclick=()=>{ const a=b.dataset.ob;
    if(a==="back") go(-1); else if(a==="next") go(1); else if(a==="skip"){ wk.onbDone=true; save(); closeOnb(); }
    else if(a==="done"){ applyOnb(o,true); closeOnb(); nav="workouts"; cur="home"; selOff=0; keepNav(); render(); window.scrollTo(0,0); } });
  /* level demo: steps on its own (also with Reduce Motion: no sliding) until touched; never saved */
  const lv=n=>{ o.lvl=n; paintLvl(el,n); };
  const r=el.querySelector(".olvl"); if(r){ const stop=()=>{ o.touched=true; clearTimeout(onbDemo); };
    r.onpointerdown=()=>{ stop(); r._drag=true; cancelAnimationFrame(r._raf); };
    r.oninput=()=>{ stop(); const n=Math.round(+r.value); if(n!==o.lvl) lv(n); };
    r.onchange=()=>{ r._drag=false; slideLvl(r,o.lvl); };
    r.onpointerup=r.onpointercancel=()=>{ r._drag=false; slideLvl(r,o.lvl); };
    r.onkeydown=e=>{ const d={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[e.key]; const to=e.key==="Home"?0:e.key==="End"?2:d!=null?Math.max(0,Math.min(2,o.lvl+d)):null;
      if(to==null) return; e.preventDefault(); stop(); lv(to); }; }
  el.querySelectorAll("[data-lvl]").forEach(b=>b.onclick=()=>{ o.touched=true; clearTimeout(onbDemo); lv(+b.dataset.lvl); });
  clearTimeout(onbDemo);
  if(s===2){ paintLvl(el,o.lvl); const tick=()=>{ if(onb===o&&o.s===2&&!o.touched){ lv((o.lvl+1)%3); onbDemo=setTimeout(tick,2600); } }; if(!o.touched) onbDemo=setTimeout(tick,2600); }
  el.querySelectorAll("[data-os]").forEach(b=>b.onclick=()=>{ const a=b.dataset.os; o.sport=a; if(!a) o.inS=false; if(a&&!o.pb) o.pb=cnt(a)||2; renderOnb(); });
  el.querySelectorAll("[data-oin]").forEach(b=>b.onclick=()=>{ o.inS=!o.inS; if(o.inS&&o.days.length>3) o.days=o.days.slice(0,3); renderOnb(); });
  el.querySelectorAll("[data-og]").forEach(b=>b.onclick=()=>set("goal",b.dataset.og));
  el.querySelectorAll("[data-od]").forEach(b=>b.onclick=()=>{ const k=+b.dataset.od, on=o.days.includes(k);
    if(!on&&o.inS&&o.days.length>=3){ toast(["In-season","Up to 3 lift days so you stay fresh for games."]); return; }
    set("days",on?o.days.filter(x=>x!==k):o.days.concat([k]).sort()); });
  el.querySelectorAll("[data-oc]").forEach(b=>b.onclick=()=>{ const k=b.dataset.oc, d=+b.dataset.d, cl=v=>Math.max(0,Math.min(7,v+d));
    if(k.startsWith("ac:")){ const a=k.slice(3); o.ac={...o.ac,[a]:cl(o.ac[a]||0)}; renderOnb(); } else set(k,cl(o[k])); });
  el.querySelectorAll("[data-olv]").forEach(b=>b.onclick=()=>set("level",b.dataset.olv));
  el.querySelectorAll("[data-of]").forEach(b=>b.onclick=()=>set("focus",b.dataset.of));
  el.querySelectorAll("[data-ox]").forEach(b=>b.onclick=()=>set("sex",b.dataset.ox));
  el.querySelectorAll("[data-oi]").forEach(x=>x.onchange=()=>{ const k=x.dataset.oi; o[k]=k==="weight"?fromU(x.value):x.value; renderOnb(); });
  if(focus){ const t=el.querySelector(".oh"); if(t) t.focus({preventScroll:true}); }
}

document.addEventListener("keydown",e=>{ if(e.key!=="Escape") return; if(!document.getElementById("done").hidden) closeDone(); else if(tour) closeTour(); });
window.addEventListener("pagehide",()=>{ if(tour&&tour.snap){ const o=JSON.parse(tour.snap); Object.keys(wk).forEach(k=>delete wk[k]); Object.assign(wk,o); save(); } });
function resetConfirm(on){ document.getElementById("confirmBox").hidden=!on; document.getElementById("resetDay").hidden=on; }

document.getElementById("toast").onclick=()=>{document.getElementById("toast").classList.remove("show");};
document.getElementById("resetDay").onclick=()=>{ const d=DAYS.find(x=>x.id===cur); askSure({title:`Reset ${d?d.tab:"this day"}`,text:"Clears every set you've logged today and reopens the day if it was marked done.",ok:"Reset day",onOk:()=>document.getElementById("confirmReset").click()}); };
document.getElementById("cancelReset").onclick=()=>resetConfirm(false);
document.getElementById("confirmReset").onclick=()=>{ if((wk.done||{})[cur]) markDone(cur); delete slots[cur]; if(wk.wt) delete wk.wt[cur]; if(wk.lockSets) delete wk.lockSets[cur]; save(); render(); resetConfirm(false); toast(["Day reset","Logs cleared and the day is open again."]); };
{ const s=autoWeek(); syncDoneFromSessions(); render(); if(s) weekDone(s); }
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState!=="visible") return; const s=autoWeek(); if(s){ render(); weekDone(s); } });
/* onboarding shows once; finishing or skipping it marks it done */
if(!wk.onbDone) openOnb();

/* ---------- First visit to each tab: a small tip pointing at it (once per tab; Replay tour shows them again) ---------- */
const TAB_TIPS={workouts:["Workout Tab","where your workouts for every day of the week are shown. You can move them around, swap them for different lifts and log activities."],
  plan:["Plan Tab","Week shows your week overview - update your check-in to see your plan adjust. Season shows your overall plan and goals."],
  history:["History","view your past activities, weeks completed and personal bests."],
  you:["You","change your preferences for tips, experience level, and FAQs about app calculations."]};
function tabTip(){ const old=document.getElementById("tabtip"); if(old) old.remove();
  if(!wk.setupDone||!wk.onbDone||!(nav in TAB_TIPS)||(nav==="workouts"&&cur!=="home")||(wk.tabTips||{})[nav]) return;
  if(!document.getElementById("tour")?.hidden&&document.getElementById("tour")) return;
  const btn=document.querySelector(`#bnav [data-nav="${nav}"]`); if(!btn) return;
  const r=btn.getBoundingClientRect(), [t,x]=TAB_TIPS[nav], el=document.createElement("div");
  el.id="tabtip"; el.setAttribute("role","note");
  el.innerHTML=`<b>${t}</b><span>${x}</span><i class="tarrow"></i>`;
  el.style.bottom=`${innerHeight-r.top+10}px`; document.body.appendChild(el);
  const tr=el.getBoundingClientRect(); el.querySelector(".tarrow").style.left=`${Math.max(16,Math.min(tr.width-16,r.left+r.width/2-tr.left))}px`;
  const done=()=>{ wk.tabTips={...(wk.tabTips||{}),[nav]:1}; save(); el.classList.add("out"); setTimeout(()=>el.remove(),200); document.removeEventListener("pointerdown",done,true); };
  setTimeout(()=>document.addEventListener("pointerdown",done,true),400); }
/* ---------- Splash: plates load onto the bar on a cold start; tap to skip ---------- */
(function splash(){ const el=document.getElementById("splash"); if(!el) return;
  const end=()=>{ if(el.classList.contains("out")) return; el.classList.add("out"); setTimeout(()=>{ el.remove(); tabTip(); },360); };
  el.onclick=end; setTimeout(end,matchMedia("(prefers-reduced-motion: reduce)").matches?1000:2300); })();

/* ---------- Tab headers hide while scrolling down and come back on any scroll up ----------
   On Workouts the date line stays pinned while the title and week strip slide away. */
(function hideOnScroll(){ let lastY=scrollY, acc=0;
  const hide=on=>{ const h=document.querySelector(".thead"); if(!h) return;
    if(h.classList.contains("wt")){ const d=h.querySelector(".wday"); h.style.setProperty("--hideH",`${d?d.offsetTop:0}px`); }
    h.classList.toggle("hid",on); };
  addEventListener("scroll",()=>{ const y=scrollY, dy=y-lastY; lastY=y;
    if(y<60){ acc=0; hide(false); return; }
    acc=(Math.sign(dy)===Math.sign(acc))?acc+dy:dy;
    if(acc>8) hide(true); else if(acc<-8) hide(false); },{passive:true}); })();
