/* Lift Board rules engine: data, state, planning, progression. No DOM access. */
const CUSTOM="+ Custom…";
/* ---------- Cardio burn model: net kcal/min above rest = (MET-1) * 3.5 * kg / 200 ---------- */
const CARDIO={
 "Incline Walk":{met:6.5},"Stairmaster":{met:8.8},"Bike (steady)":{met:6.8},"Rower (steady)":{met:6.0},
 "Elliptical (steady)":{met:5.0},"Outdoor Walk (brisk)":{met:4.3},"Incline Treadmill Hike (15%)":{met:7.5},
 "Bike Intervals":{met:8.5,steady:"Bike (steady)"},"Rower Intervals":{met:8.5,steady:"Rower (steady)"},
 "Assault Bike Intervals":{met:10,steady:"Bike (steady)"},"Sled Push Intervals":{met:9,steady:"Incline Walk"}
};
const PICKLE_MET=4.5, CLIMB_MET=5.0, YOGA_MET={No:2.8,Yes:4.0}, SPIN_MET={"Hard":8.5,"Really hard":10.5}, SPIN_MIN=45;
const STEADY=["Incline Walk","Stairmaster","Incline Treadmill Hike (15%)","Bike (steady)","Rower (steady)","Elliptical (steady)","Outdoor Walk (brisk)"];
const INTERVAL=["Bike Intervals","Rower Intervals","Assault Bike Intervals","Sled Push Intervals"];

/* ---------- Exercise libraries ---------- */
const L={
 mainGlute:["Hip Thrust (Barbell)","Hip Thrust (Machine)","Smith Hip Thrust","Glute Bridge (Barbell)","B-Stance Hip Thrust (Barbell)","Hip Thrust (Dumbbell)","Banded Hip Thrust"],
 hinge:["Romanian Deadlift (Barbell)","Romanian Deadlift (Dumbbell)","Single-Leg RDL (Dumbbell)","Stiff-Leg Deadlift","Sumo Deadlift","Trap Bar Deadlift","Good Morning","Cable Pull-Through","45° Back Extension (weighted)","Reverse Hyper"],
 uni:["Bulgarian Split Squat","Bulgarian Split Squat (Smith)","Deficit Reverse Lunge (Dumbbell)","Reverse Lunge (Dumbbell)","Walking Lunge (Dumbbell)","Curtsy Lunge","Step-Up (Dumbbell)","Lateral Step-Up","Split Squat (Front-Foot Elevated)","Single-Leg Leg Press"],
 gluteMed:["Hip Abductor (Machine)","Hip Abductor (Machine, leaning forward)","Cable Hip Abduction","Banded Lateral Walk","Side-Lying Hip Abduction (ankle weight)","Banded Seated Abduction"],
 press:["Overhead Press (Barbell)","Overhead Press (Dumbbell, seated)","Overhead Press (Dumbbell, standing)","Arnold Press","Shoulder Press (Machine)","Landmine Press","Half-Kneeling Landmine Press","Smith Overhead Press"],
 vpull:["Lat Pulldown (Single Arm)","Lat Pulldown (Wide)","Lat Pulldown (Close Neutral Grip)","Lat Pulldown (Underhand)","Assisted Pull-Up","Pull-Up","Chin-Up","Negative Pull-Up","Kneeling Single-Arm Cable Pulldown"],
 chest:["Incline Chest Press (Machine)","Incline Dumbbell Press","Incline Barbell Bench","Chest Press (Machine)","Flat Dumbbell Press","Push-Up (deficit or weighted)","Cable Fly","Pec Deck"],
 hrow:["Seated Row (Cable)","Seated Row (Cable, wide bar)","Single-Arm Cable Row","Chest-Supported Row (Dumbbell)","Chest-Supported Row (Machine)","Bent-Over Row (Dumbbell)","Single-Arm Dumbbell Row","Machine Row","Inverted Row"],
 mainRow:["Bent-Over Row (Dumbbell)","Bent-Over Row (Barbell)","Pendlay Row","Chest-Supported Row (Dumbbell)","Chest-Supported Row (Machine)","Seal Row","T-Bar Row","Meadows Row","Seated Row (Cable)","Single-Arm Dumbbell Row"],
 side:["Lateral Raise (Dumbbell)","Cable Lateral Raise","Lateral Raise (Machine)","Lean-Away Lateral Raise","Seated Lateral Raise","Lateral Raise Partials (burnout)","Upright Row (Cable, wide)"],
 rear:["Face Pull (Cable)","Reverse Fly (Cable)","Reverse Fly (Machine)","Reverse Fly (Dumbbell, chest-supported)","Band Pull-Apart","Rear Delt Row (Cable)"],
 arms:["Bicep Curl (Dumbbell)","Hammer Curl","Incline Dumbbell Curl","Cable Curl","Preacher Curl (Machine)","Triceps Pushdown (Cable)","Overhead Triceps Extension (Cable)","Skull Crusher (EZ bar)","Dips (assisted)"],
 quad:["Hack Squat","Box Squat (Barbell)","Back Squat (Barbell)","Front Squat","Smith Squat","Leg Press","Pendulum Squat","Goblet Squat (heel-elevated)","Belt Squat"],
 lightGlute:["Single-Leg Hip Thrust","Glute Bridge (Barbell)","Hip Thrust (Barbell), 60–70%","Cable Kickback","Glute Kickback (Machine)","45° Back Extension (glute bias)","Frog Pump (Dumbbell)"],
 ham:["Leg Curl (Seated)","Leg Curl (Lying)","Single-Leg Leg Curl","Nordic Curl (assisted)","Stability Ball Curl","Sliding Leg Curl"],
 lats:["Straight Arm Pulldown","Cable Pullover","Dumbbell Pullover","Lat Pulldown (Single Arm)","Kneeling Single-Arm Cable Pulldown"],
 calves:["Standing Calf Raise (Machine)","Seated Calf Raise","Single-Leg Calf Raise (Dumbbell)","Smith Calf Raise","Leg Press Calf Raise"],
 adductor:["Copenhagen Plank","Hip Adductor (Machine)","Cable Hip Adduction","Lateral Lunge (Dumbbell)","Cossack Squat"],
 cuff:["Cable External Rotation","Side-Lying External Rotation (Dumbbell)","Band External Rotation","Prone Y-Raise","Face Pull (Cable)"],
 core:["Pallof Press","Dead Bug","Hanging Knee Raise","Ab Wheel","Cable Crunch","Side Plank","Copenhagen Plank","Suitcase Carry"],
};
/* ---------- Activities ---------- */
const ACT={
 lift:{name:"Lifting"},
 pickle:{name:"Pickleball",sport:1,met:4.5,leg:1,sh:1,min:75},
 run:{name:"Running",sport:1,met:8.3,leg:2,min:40},
 soccer:{name:"Soccer",sport:1,met:7,leg:2,min:90},
 volleyball:{name:"Volleyball",sport:1,met:4.5,leg:1,sh:1,min:90},
 climb:{name:"Climbing",sport:1,met:5,leg:0,pull:1,min:75,noMin:1},
 tennis:{name:"Tennis",sport:1,met:7.3,leg:1,sh:1,min:90},
 golf:{name:"Golf",sport:1,met:4.3,leg:0.5,sh:1,min:240},
 hockey:{name:"Hockey",sport:1,met:8,leg:2,min:60},
 yoga:{name:"Yoga",cls:1},
 pilates:{name:"Pilates",cls:1,met:3.0,min:50},
 spin:{name:"Spin",cls:1}
};
const ACT_IDS=Object.keys(ACT), SPORTS=ACT_IDS.filter(a=>ACT[a].sport);
const actKey=a=>({pickle:"pAct",yoga:"yAct",spin:"sAct"})[a]||a+"Act";
const minKey=a=>({pickle:"pmin",climb:"cmin",yoga:"ymin"})[a]||a+"min";

/* ---------- Day templates (slot order is storage order; append only) ---------- */
const SUP={calves:["pickle","run","soccer","volleyball","tennis","hockey"],adductor:["pickle","soccer","tennis","hockey"],cuff:["pickle","volleyball","climb","tennis","golf"]};
const ALL=[
 {id:"d1",title:"Lower · Hinge & Glute",slots:[
  {label:"Main glute",main:1,opts:L.mainGlute,sets:4,reps:"6–10"},
  {label:"Hinge",lower:1,opts:L.hinge,sets:3,reps:"8"},
  {label:"Unilateral",uni:1,lower:1,opts:L.uni,sets:3,reps:"8–10 / leg"},
  {label:"Glute med",trim:1,lower:1,opts:L.gluteMed,sets:3,reps:"15–20"},
  {label:"Calves",support:1,sp:SUP.calves,opts:L.calves,sets:2,reps:"12–15"},
  {label:"Cardio finisher",cardio:1,opts:STEADY}]},
 {id:"d2",title:"Upper",slots:[
  {label:"Main press",main:1,upperMain:1,opts:L.press,sets:3,reps:"5–8"},
  {label:"Vertical pull",ss:"A1",vpull:1,opts:L.vpull,sets:3,reps:"8–12"},
  {label:"Chest",ss:"A2",opts:L.chest,sets:3,reps:"8–12"},
  {label:"Horizontal pull",ss:"B1",opts:L.hrow,sets:3,reps:"10"},
  {label:"Side delts",ss:"B2",upperAcc:1,opts:L.side,sets:3,reps:"12–20"},
  {label:"Rear delts",ss:"C1",trim:1,upperAcc:1,opts:L.rear,sets:3,reps:"12–15"},
  {label:"Arms",ss:"C2",trim:1,arms:1,upperAcc:1,opts:L.arms,sets:2,reps:"12–15"},
  {label:"Rotator cuff",support:1,sp:SUP.cuff,opts:L.cuff,sets:2,reps:"15"},
  {label:"Cardio finisher",cardio:1,opts:[...INTERVAL,...STEADY]}]},
 {id:"d3",title:"Lower · Quad",slots:[
  {label:"Main quad",main:1,quad:1,opts:L.quad,sets:4,reps:"6–10"},
  {label:"Glute (light)",lower:1,opts:L.lightGlute,sets:3,reps:"10–12"},
  {label:"Hamstrings",lower:1,opts:L.ham,sets:3,reps:"10–12"},
  {label:"Lats",ss:"A1",trim:1,lats:1,upperAcc:1,opts:L.lats,sets:2,reps:"15"},
  {label:"Side delts",ss:"A2",trim:1,upperAcc:1,opts:L.side,sets:2,reps:"15"},
  {label:"Adductors",support:1,sp:SUP.adductor,opts:L.adductor,sets:2,reps:"10–12"},
  {label:"Cardio finisher",cardio:1,opts:STEADY}]},
 {id:"x",title:"Upper · Pull",slots:[
  {label:"Main row",main:1,upperMain:1,opts:L.mainRow,sets:4,reps:"6–10"},
  {label:"Vertical pull",vpull:1,opts:L.vpull,sets:3,reps:"6–10"},
  {label:"Press",ss:"A1",opts:L.press,sets:3,reps:"8–12"},
  {label:"Rear delts",ss:"A2",upperAcc:1,opts:L.rear,sets:3,reps:"12–15"},
  {label:"Side delts",ss:"B1",upperAcc:1,opts:L.side,sets:3,reps:"12–20"},
  {label:"Arms",ss:"B2",trim:1,arms:1,upperAcc:1,opts:L.arms,sets:2,reps:"12–15"},
  {label:"Core",trim:1,opts:L.core,sets:3,reps:"10–12"},
  {label:"Cardio finisher",cardio:1,opts:STEADY}]},
 {id:"fa",full:1,title:"Full Body A",slots:[
  {label:"Main glute",main:1,opts:L.mainGlute,sets:2,reps:"6–10"},
  {label:"Unilateral",uni:1,lower:1,opts:L.uni,sets:2,reps:"8–10 / leg"},
  {label:"Press",main:1,upperMain:1,opts:L.press,sets:2,reps:"6–10"},
  {label:"Vertical pull",vpull:1,opts:L.vpull,sets:2,reps:"8–12"},
  {label:"Calves",support:1,sp:SUP.calves,opts:L.calves,sets:2,reps:"12–15"},
  {label:"Adductors",support:1,sp:SUP.adductor,opts:L.adductor,sets:2,reps:"10–12"},
  {label:"Cardio finisher",cardio:1,opts:STEADY}]},
 {id:"fb",full:1,title:"Full Body B",slots:[
  {label:"Main quad",main:1,quad:1,opts:L.quad,sets:2,reps:"6–10"},
  {label:"Hinge",lower:1,opts:L.hinge,sets:2,reps:"8"},
  {label:"Chest",ss:"A1",opts:L.chest,sets:2,reps:"8–12"},
  {label:"Row",ss:"A2",opts:L.hrow,sets:2,reps:"10"},
  {label:"Rotator cuff",support:1,sp:SUP.cuff,opts:L.cuff,sets:2,reps:"15"},
  {label:"Core",trim:1,opts:L.core,sets:2,reps:"10–12"},
  {label:"Cardio finisher",cardio:1,opts:[...INTERVAL,...STEADY]}]},
 {id:"fc",full:1,title:"Full Body C",slots:[
  {label:"Main hinge",main:1,opts:L.hinge,sets:2,reps:"6–10"},
  {label:"Chest",opts:L.chest,sets:2,reps:"8–12"},
  {label:"Row",opts:L.mainRow,sets:2,reps:"8–12"},
  {label:"Unilateral",uni:1,lower:1,opts:L.uni,sets:2,reps:"8–10 / leg"},
  {label:"Side delts",trim:1,upperAcc:1,opts:L.side,sets:2,reps:"12–20"},
  {label:"Calves",support:1,sp:SUP.calves,opts:L.calves,sets:2,reps:"12–15"},
  {label:"Cardio finisher",cardio:1,opts:STEADY}]},
 {id:"lf",title:"Lower",slots:[
  {label:"Main quad",main:1,quad:1,opts:L.quad,sets:4,reps:"6–10"},
  {label:"Hinge",lower:1,opts:L.hinge,sets:3,reps:"8"},
  {label:"Unilateral",uni:1,lower:1,opts:L.uni,sets:3,reps:"8–10 / leg"},
  {label:"Hamstrings",trim:1,lower:1,opts:L.ham,sets:2,reps:"10–12"},
  {label:"Calves",support:1,sp:SUP.calves,opts:L.calves,sets:2,reps:"12–15"},
  {label:"Cardio finisher",cardio:1,opts:STEADY}]},
 {id:"g2",title:"Lower · Glute Volume",slots:[
  {label:"Main glute",main:1,opts:L.mainGlute,sets:3,reps:"10–15"},
  {label:"Unilateral",uni:1,lower:1,opts:L.uni,sets:3,reps:"10–12 / leg"},
  {label:"Glute (light)",lower:1,opts:L.lightGlute,sets:3,reps:"12–15"},
  {label:"Glute med",trim:1,lower:1,opts:L.gluteMed,sets:3,reps:"15–20"},
  {label:"Cardio finisher",cardio:1,opts:STEADY}]},
 {id:"u3",title:"Upper · Delts & Arms",slots:[
  {label:"Main press",main:1,upperMain:1,opts:L.press,sets:3,reps:"8–10"},
  {label:"Side delts",ss:"A1",upperAcc:1,opts:L.side,sets:3,reps:"12–20"},
  {label:"Rear delts",ss:"A2",upperAcc:1,opts:L.rear,sets:3,reps:"12–15"},
  {label:"Biceps",ss:"B1",arms:1,upperAcc:1,opts:L.arms,sets:3,reps:"10–15"},
  {label:"Triceps",ss:"B2",arms:1,upperAcc:1,opts:L.arms,sets:3,reps:"10–15"},
  {label:"Lats",trim:1,lats:1,upperAcc:1,opts:L.lats,sets:2,reps:"12–15"},
  {label:"Cardio finisher",cardio:1,opts:STEADY}]}
];
let DAYS=[];

/* ---------- State ---------- */
const KEY="liftboard.v1", KEY2="liftboard.week.v2", KEY3="liftboard.hist.v1";
const DEF={setupDone:false,sex:"Female",age:30,height:64,weight:150,bf:"",steps:8000,liftK:150,oura:"",
 acts:{lift:true},mainSport:"",focus:"Balanced",
 mode:"Recomp",rate:0.5,share:25,season:"Off-season",ramp:"No",zAct:[],
 days:3,time:60,ss:"Yes",ready:"Normal",sore:"None",cycle:"Not tracking",drink:"0",
 heated:"No",spint:"Hard",done:{},donePlan:{},today:{},wAvg:"",deload:"No",
 weeks:[],fatigue:[],upNext:"",missedNote:null,calib:0,calibN:0};
ACT_IDS.forEach(a=>{ if(a==="lift") return; DEF[a]="0"; DEF[actKey(a)]=[]; if(ACT[a].min) DEF[minKey(a)]=ACT[a].min; });
DEF.ymin=60;






let store=null, saveHook=()=>{};
function setSaveHook(f){ saveHook=f; }
function persist(){ store.setItem(KEY,JSON.stringify(slots)); store.setItem(KEY2,JSON.stringify(wk)); store.setItem(KEY3,JSON.stringify(exHist)); }
function save(){ try{ persist(); saveHook(true);}catch(e){ saveHook(false);} }
function get(day,i){ return (slots[day]&&slots[day][i])||{}; }
function set(day,i,k,v){ slots[day]=slots[day]||{}; slots[day][i]=slots[day][i]||{}; slots[day][i][k]=v; save(); }
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const num=(v,d)=>{const n=parseFloat(String(v).replace(/[,\s]/g,"").replace(/k$/i,"000"));return isFinite(n)?n:d;};
const r5=n=>Math.round(n/5)*5;
const kg=()=>num(wk.weight,150)/2.2046;
const perMin=met=>(met-1)*3.5*kg()/200;
const fem=()=>wk.sex!=="Male";
const enabled=a=>!!(wk.acts||{})[a];
const cnt=a=>enabled(a)?(parseInt(wk[a])||0):0;
const hasSport=()=>!!wk.mainSport&&enabled(wk.mainSport);
const inSeason=()=>hasSport()&&wk.season==="In-season";
const plannedMin=a=>num(wk[minKey(a)],ACT[a].min||60);
function exName(d,s,i){ const st=get(d.id,i); const c=st.choice??s.opts[0]; return c===CUSTOM?(st.custom||"Custom exercise"):c; }



let slots={}, wk={...DEF}, exHist={};
/** Load state from a storage adapter ({getItem,setItem}), run migrations, persist. */
function init(storage){
  store=storage; let hadStore=false;
  slots={}; wk={...DEF}; exHist={};
  try{ slots=JSON.parse(store.getItem(KEY)||"{}")||{}; }catch(e){}
  try{ const raw=store.getItem(KEY2); hadStore=!!raw; wk={...DEF,...(JSON.parse(raw||"{}")||{})}; }catch(e){}
  try{ exHist=JSON.parse(store.getItem(KEY3)||"{}")||{}; }catch(e){}

if(!wk.mig1){ [["d1",4],["d2",7],["d3",5]].forEach(([d,i])=>{ if(slots[d]&&slots[d][i]){ slots[d][i+1]=slots[d][i]; delete slots[d][i]; } }); wk.mig1=1; }
if(!wk.mig2){
  ALL.forEach(d=>d.slots.forEach((s,i)=>{ const st=slots[d.id]&&slots[d.id][i]; if(st&&st.hist&&st.hist.length){ const n=exName(d,s,i); exHist[n]=(exHist[n]||[]).concat(st.hist); delete st.hist; } }));
  if(hadStore) wk.setupDone=true;
  wk.drink=({"1":"1–2","2":"1–2"})[wk.drink]||wk.drink; if(!["0","1–2","3+"].includes(wk.drink)) wk.drink="0";
  wk.ready=wk.ready==="Under 70"||wk.ready==="Low"?"Low":"Normal";
  wk.cycle=({"Menstrual":"Period","Follicular":"Other","Ovulatory":"Other"})[wk.cycle]||wk.cycle;
  delete wk.sleep; wk.mig2=1;
}
if(!wk.mig3){
  if(hadStore){
    const old=wk.acts||{}, on=a=>old[a]!==false;
    wk.acts={lift:true,pickle:on("pickle"),climb:on("climb"),yoga:on("yoga"),spin:on("spin"),run:false,soccer:false,volleyball:false};
    if(!wk.mainSport&&wk.acts.pickle) wk.mainSport="pickle";
    wk.focus=wk.priority==="Balanced"?"Balanced":"Lower";
  }
  ["pickle","climb","yoga","spin"].forEach(a=>{ wk[a]=String(parseInt(wk[a])||0); });
  if(!["Not tracking","Period","Luteal","Other"].includes(wk.cycle)) wk.cycle="Not tracking";
  delete wk.priority; wk.mig3=1;
}
  try{ persist(); }catch(e){}
  syncDays();
}
/* ---------- Split ---------- */
function split(){
  if(!enabled("lift")) return [];
  const n=Math.max(1,Math.min(5,+wk.days||3)), f=wk.focus;
  if(inSeason()) return ["fa","fb","fc"].slice(0,Math.min(3,n));
  if(n===1) return ["fa"];
  if(n===2) return ["fa","fb"];
  if(n===3) return f==="Lower"?["d1","d2","d3"]:f==="Upper"?["d2","lf","x"]:["fa","fb","fc"];
  const four=f==="Upper"?["d2","d1","x","d3"]:["d1","d2","d3","x"];
  if(n===4) return four;
  return [...four,f==="Lower"?"g2":f==="Upper"?"u3":"fa"];
}
function syncDays(){ DAYS=split().map((id,i)=>({...ALL.find(t=>t.id===id),tab:`Day ${i+1}`})); }
/* ---------- Decision tree ---------- */
function plan(){
  syncDays();
  const P={days:{},notes:[]};
  const inS=inSeason(), sport=hasSport(), ramp=sport&&!inS&&wk.ramp==="Yes", deload=wk.deload==="Yes"&&DAYS.length>0;
  const recomp=wk.mode==="Recomp", build=wk.mode==="Build", focus=wk.focus;
  /* sport load */
  let legMin=0, shMin=0, sportTot=0; const sportOn=[];
  SPORTS.forEach(a=>{ if(ACT[a].noMin) return; const n=cnt(a); let m=0; for(let i=0;i<n;i++) m+=num((wk[actKey(a)]||[])[i],plannedMin(a));
    if(m){ sportOn.push([a,m]); sportTot+=m; legMin+=m*ACT[a].leg; shMin+=m*(ACT[a].sh||0); } });
  const sportWhy=sportOn.length===1?`${sportOn[0][1]} min ${ACT[sportOn[0][0]].name.toLowerCase()}`:`${sportTot} min of sport`;
  const cl=cnt("climb"), sp=cnt("spin"), yg=cnt("yoga");
  const hardSpin=sp>=2||(sp>=1&&wk.spint==="Really hard");
  /* recovery load */
  const F=[], addF=(p,l)=>{ if(p>0) F.push([p,l]); };
  addF(wk.ready==="Low"?2:0,"low readiness");
  addF(wk.sore==="Everything"?2:wk.sore!=="None"?1:0,"soreness");
  addF(wk.drink==="3+"?2:wk.drink==="1–2"?1:0,"drinking");
  if(fem()) addF(wk.cycle==="Period"||wk.cycle==="Luteal"?1:0,wk.cycle==="Period"?"period":"luteal phase");
  addF(legMin>=240?1:0,"heavy sport week");
  addF(hardSpin?1:0,"hard spin");
  const S=F.reduce((a,x)=>a+x[0],0);
  P.score=S; P.factors=F.map(x=>x[1]);
  const fat=wk.fatigue||[], hard=x=>x&&x.drops>=2;
  const lastHard=hard(fat[fat.length-1]), twoHard=lastHard&&hard(fat[fat.length-2]);
  const done=wk.done||{};
  const todo=DAYS.filter(d=>!done[d.id]);
  P.nextId=((todo.find(d=>d.id===wk.upNext))||todo[0]||{}).id;
  const cap=wk.time==30?0:wk.time==45?20:wk.time==60?30:40;
  let climbCut=false;
  DAYS.forEach(d=>{
    const today=(wk.today||{})[d.id]||"Normal";
    const autoRough=d.id===P.nextId&&lastHard&&today!=="Good";
    const dayS=Math.max(0,S+(today==="Rough"?5:0)+(autoRough?2:0)-(today==="Good"?1:0));
    const dayCause=today==="Rough"?"rough day":autoRough?"reps dropped last session":"recovery load";
    const shortD=dayS>=5, cutD=dayS>=3, steadyD=dayS>=2;
    const keep30=d.slots.findIndex(s=>!s.main&&!s.cardio&&!s.support), hasSS=d.slots.some(x=>x.ss);
    const D={slots:[],today,dayS,shortD,cutD,dayCause,autoRough,restSuggest:d.id===P.nextId&&twoHard};
    d.slots.forEach((s,i)=>{
      const A={delta:0,why:[],skip:"",steady:false};
      const base=s.sets+(d.full&&!inS&&!s.cardio&&!s.support?1:0);
      if(s.support&&!(inS&&s.sp.includes(wk.mainSport))){A.skip="hidden"; D.slots.push(A); return;}
      if(!s.cardio){
        if(deload){ A.sets=Math.max(1,Math.ceil(base*0.6)); A.why.push(`${A.sets} sets · deload week`); D.slots.push(A); return; }
        if(wk.time==30&&!s.main&&i!==keep30){A.skip="Trimmed for a 30-min session";}
        if(wk.time==45&&s.trim){A.skip="Trimmed for a 45-min session";}
        if(wk.ss==="No"&&wk.time<=60&&s.trim&&hasSS&&!A.skip){A.skip="Trimmed · no supersets";}
        if(focus==="Lower"&&s.lower&&!s.main){A.delta++;A.why.push("+1 · lower body focus");}
        if(focus==="Lower"&&s.upperAcc&&base>2){A.delta--;A.why.push("−1 · lower body focus");}
        if(focus==="Upper"&&s.upperAcc){A.delta++;A.why.push("+1 · upper body focus");}
        if(focus==="Upper"&&s.lower&&!s.main&&base>2){A.delta--;A.why.push("−1 · upper body focus");}
        if(shortD){ if(!s.main&&s.trim) A.skip="Skipped · "+dayCause; A.delta--; A.why.push("−1 · "+dayCause); }
        else if(cutD&&s.main){
          const loc=dayCause==="recovery load"?wk.sore:"Everything";
          const hit=loc==="Legs"?!s.upperMain:loc==="Upper body"?!!s.upperMain:true;
          if(hit){A.delta--;A.why.push("−1 · "+dayCause);}
        }
        if(wk.time==75&&s.main){A.delta++;A.why.push("+1 · 75-min session");}
        if(build&&s.main){A.delta++;A.why.push("+1 · build");}
        if(legMin>=120&&s.uni){A.delta--;A.why.push("−1 · "+sportWhy);}
        if(legMin>=180&&s.quad){A.delta--;A.why.push("−1 · "+sportWhy);}
        if(shMin>=120&&s.label==="Rear delts"){A.delta++;A.why.push("+1 · "+sportWhy);}
        if(shMin>=120&&s.label==="Side delts"&&base>=3){A.delta--;A.why.push("−1 · "+sportWhy);}
        if(hardSpin&&s.quad){A.delta--;A.why.push("−1 · hard spin");}
        if(cl>=1&&s.vpull&&!climbCut){climbCut=true;A.delta--;A.why.push(`−1 · ${cl}× climbing`);}
        if(cl>=1&&s.arms){A.skip=`Skipped · ${cl}× climbing`;}
        if(cl>=2&&s.lats){A.skip=`Skipped · ${cl}× climbing`;}
        if(today==="Good"&&s.main&&!cutD){A.why.push("push your top set · feeling good");}
        A.sets=Math.max(s.main?2:1,base+A.delta);
      }else{
        if(wk.time==30) A.skip="Trimmed for a 30-min session";
        const st=get(d.id,i), choice=st.choice&&st.choice!==CUSTOM?st.choice:s.opts[0];
        const why=build?"build phase":deload?"deload":steadyD?dayCause:"";
        let use=choice;
        if(CARDIO[choice]&&CARDIO[choice].steady&&why){use=CARDIO[choice].steady;A.steady=why;}
        A.use=use; A.rate=perMin((CARDIO[use]||CARDIO["Incline Walk"]).met);
      }
      D.slots.push(A);
    });
    P.days[d.id]=D;
  });
  /* Cardio */
  const rateEff=build?0:recomp?Math.min(num(wk.rate,0.5),0.5):num(wk.rate,0.5), shareEff=recomp?Math.min(num(wk.share,25),25):num(wk.share,25);
  const target=rateEff*3500, cardioTarget=build?0:target*shareEff/100;
  const sess=(n,act,pl,rate)=>{let k=0;for(let i=0;i<n;i++)k+=num((act||[])[i],pl)*rate;return k;};
  let sportK=0; sportOn.forEach(([a,m])=>{ sportK+=m*perMin(ACT[a].met); });
  const climbK=cl*75*perMin(ACT.climb.met);
  const pilK=sess(cnt("pilates"),wk[actKey("pilates")],plannedMin("pilates"),perMin(ACT.pilates.met));
  const yogaK=sess(yg,wk.yAct,num(wk.ymin,60),perMin(YOGA_MET[wk.heated]||2.8));
  const spinK=sess(sp,wk.sAct,SPIN_MIN,perMin(SPIN_MET[wk.spint]||8.5));
  const zoneK=ramp?num((wk.zAct||[])[0],45)*perMin(CARDIO["Bike (steady)"].met):0;
  let doneK=0; const cand=[];
  DAYS.forEach(d=>{ d.slots.forEach((s,i)=>{ const A=P.days[d.id].slots[i]; if(!s.cardio) return;
      const act=num(get(d.id,i).act,0);
      if(done[d.id]){ const k=act>0?act*A.rate:done[d.id]; doneK+=k; P.days[d.id].done=k||0.001; A.doneK=k; return; }
      if(!A.skip){A.day=d.id;cand.push(A);} }); });
  const otherK=sportK+climbK+yogaK+pilK+spinK+zoneK;
  const need=cardioTarget-otherK-doneK;
  const order=["d2","fb","x","u3","d1","fa","lf","fc","g2","d3"];
  cand.sort((p,q)=>order.indexOf(p.day)-order.indexOf(q.day));
  let fins=[];
  if(build||deload){fins=cand;}
  else if(need>cardioTarget*0.1&&cand.length){ fins=cand; for(let k=1;k<=cand.length;k++){const sub=cand.slice(0,k), r=sub.reduce((a,f)=>a+f.rate,0); if(need/r<=cap){fins=sub;break;}} }
  cand.forEach(f=>{ if(!fins.includes(f)) f.skip="Not needed this week"; });
  const sumRate=fins.reduce((a,f)=>a+f.rate,0);
  const m=(build||deload)?10:sumRate?Math.max(10,Math.round(need/sumRate)):0;
  fins.forEach(f=>{f.min=m;f.kcal=m*f.rate;});
  const finK=fins.reduce((a,f)=>a+f.kcal,0);
  const overs=[];
  DAYS.forEach(d=>{ const pl=(wk.donePlan||{})[d.id]; const got=P.days[d.id].done; if(done[d.id]&&pl!=null&&got-pl>Math.max(50,pl*0.25)) overs.push(`${d.tab} cardio +${r5(got-pl)} kcal`); });
  if(overs.length&&!build) cand.forEach(f=>{ f.flag=(f.skip?"Dropped":`Cut to ${f.min} min`)+" · "+overs.join(", "); f.overWhy=overs.join(", "); });
  const cardioTotal=otherK+doneK+finK;
  const food=(target-cardioTotal)/7;
  /* Maintenance */
  const bf=num(wk.bf,0), bfOk=bf>5&&bf<50;
  const sexOff=wk.sex==="Male"?5:wk.sex==="Other"?-78:-161;
  const bmr=bfOk?370+21.6*kg()*(1-bf/100):10*kg()+6.25*num(wk.height,64)*2.54-5*num(wk.age,30)+sexOff;
  const stepsK=num(wk.steps,8000)*0.04*num(wk.weight,150)/150;
  const baseM=bmr*1.1;
  const nLift=DAYS.length, liftDay=nLift*num(wk.liftK,150)/7;
  const ouraV=num(wk.oura,0), useOura=ouraV>0;
  const act=baseM+stepsK+liftDay+cardioTotal/7, tef=act/9;
  const raw=useOura?ouraV*0.93:act+tef;
  const calib=num(wk.calib,0), tdee=raw+calib;
  const intake=build?tdee+200:tdee-target/7;
  P.math={doneK,otherK,target,cardioTarget,finK,cardioTotal,food,cap,m,nFin:fins.length,bmr,base:baseM,stepsK,tef,liftDay,nLift,raw,calib,tdee,intake,useOura};
  /* Watch */
  const lb=num(wk.weight,150), pr=build?[0.7,0.9]:[0.8,1.0];
  P.math.protein=[r5(lb*pr[0]),r5(lb*pr[1])];
  P.notes.push(`Protein ${P.math.protein[0]}–${P.math.protein[1]} g daily.`);
  const floor=wk.sex==="Male"?1800:1500;
  if(intake<floor) P.notes.push(`Eating ~${r5(intake)} kcal/day is too low. Slow the rate.`);
  if(recomp&&num(wk.rate,0.5)>0.5) P.notes.push("Recomp caps loss at 0.5 lb/week.");
  if(recomp&&num(wk.share,25)>25) P.notes.push("Recomp caps cardio at 25%.");
  if(!build&&!recomp&&num(wk.rate,0.5)>=0.75) P.notes.push(`${wk.rate} lb/week is aggressive; strength will stall.`);
  if(food>500) P.notes.push(`A ${r5(food)} kcal/day food deficit is steep.`);
  if(!build&&food<0) P.notes.push(`Your activity covers the whole deficit. Eat ${r5(-food)} kcal/day above baseline so it doesn't cost muscle.`);
  if(fins.length&&m>cap&&cap>0) P.notes.push(`Finishers run ${m} min, past a normal ${cap}-min finisher.`);
  if(ramp&&sp&&wk.spint==="Really hard") P.notes.push("Keep spin easy during the ramp; hard classes don't build base.");
  /* Changes, by cause */
  const G={}, add=(why,txt)=>{const g=(G[why]=G[why]||[]); if(!g.includes(txt)) g.push(txt);};
  const loadLbl=`Recovery load ${S} (${P.factors.join(", ")})`;
  const causeOf=c=>c==="recovery load"?loadLbl:c;
  const cat=s=>s.main?"main lifts":s.uni?"unilateral":s.vpull?"pulling":s.label==="Rear delts"?"rear delts":s.label==="Side delts"?"side delts":s.lower?"lower accessories":s.upperAcc?"upper accessories":"accessories";
  DAYS.forEach(d=>{ d.slots.forEach((s,i)=>{ const A=P.days[d.id].slots[i];
    if(A.skip==="hidden") return;
    const daily=c=>c==="rough day"||c==="reps dropped last session"||c==="feeling good";
    if(A.skip&&A.skip.startsWith("Skipped · ")){ const c=A.skip.slice(10); if(!daily(c)) add(causeOf(c),"some accessories skipped"); }
    if(A.skip==="Trimmed · no supersets") add("No supersets","optional accessories cut to fit");
    else if(A.skip&&A.skip.startsWith("Trimmed")) add(wk.time+"-min sessions",wk.time==30?"main lifts + 1 accessory, no finisher":"optional accessories cut");
    if(!A.skip) A.why.forEach(w=>{const [e,c]=w.split(" · "); if(!c||daily(c)) return;
      if(/^[+−]\d$/.test(e)) add(causeOf(c),`${cat(s)} ${e[0]}1 set`); else if(c==="deload week") add(c,"about 60% of sets"); else add(c,e); });
    if(A.steady&&!A.skip&&!daily(A.steady)) add(causeOf(A.steady),"finishers at easy pace");
    if(A.overWhy) add(A.overWhy,A.skip?"finishers dropped":"finishers shortened"); }); });
  if(S>=3) add(loadLbl,"no weight increases");
  if(ramp) add("pre-season ramp","one 45-min zone 2 session");
  if(twoHard&&P.nextId) add("reps dropped 2 sessions in a row","take a rest day first");
  if(wk.missedNote&&wk.upNext&&!done[wk.upNext]) add(wk.missedNote.why,wk.missedNote.txt);
  P.G=G;
  P.rules=Object.entries(G).map(([c,l])=>`<b>${c[0].toUpperCase()+c.slice(1)}</b> → ${l.join(", ")}`);
  return P;
}

/* ---------- Deload check ---------- */
function deloadInfo(){
  if(!DAYS.length) return [];
  const ws=wk.weeks||[]; let n=0; for(let k=ws.length-1;k>=0;k--){ if(ws[k].season!==wk.season||ws[k].deload) break; n++; }
  const mains=new Set(); DAYS.forEach(d=>d.slots.forEach((s,i)=>{ if(s.main) mains.add(exName(d,s,i)); }));
  let stalled=0; mains.forEach(nm=>{ const h=(exHist[nm]||[]).filter(x=>x.season===wk.season); if(h.length>=3){ const a=h[h.length-3], z=h[h.length-1]; if(z.w<=a.w&&z.r<=a.r) stalled++; } });
  const why=[]; if(!inSeason()&&n>=6) why.push(`${n} weeks since last deload`); if(stalled>=2) why.push(`${stalled} main lifts stalled`);
  return why;
}

/* ---------- Progression ---------- */
const range=r=>{const m=String(r).match(/\d+/g)||[];return m.length?[+m[0],+(m[1]||m[0])]:[8,12];};
const lastSet=log=>{for(let k=(log||[]).length-1;k>=0;k--){const x=log[k];if(num(x.w,0)>0&&num(x.r,0)>0)return{w:num(x.w,0),r:num(x.r,0)};}return null;};
const isDB=n=>/dumbbell/i.test(n);
const roundW=(n,w)=>isDB(n)?Math.round(w/2.5)*2.5:r5(w);
function incFor(n,s,w){ if(isDB(n)) return w<=20?2.5:5; const lowerMain=s.main&&!s.upperMain; const pct=lowerMain?0.05:s.main?0.025:0.05; const min=lowerMain&&wk.sex==="Male"?10:5; return Math.max(min,r5(w*pct)); }
const isIso=s=>!!(s.upperAcc||s.support||s.label==="Glute med");
function suggest(d,s,i,useLog,P){
  const n=exName(d,s,i), st=get(d.id,i), h=exHist[n]||[];
  const now=useLog?lastSet(st.log):null, last=now||h[h.length-1];
  if(!last||!last.w) return null;
  const prev=now?h[h.length-1]:h[h.length-2];
  const [lo,hi]=range(s.reps), top=isIso(s)?hi+3:hi;
  const D=(P&&P.days[d.id])||{};
  if(wk.deload==="Yes") return {w:roundW(n,last.w*0.9),why:"deload, easy reps"};
  if(last.r>=top){ if(inSeason()) return {w:last.w,why:"same weight in-season"}; if(D.cutD) return {w:last.w,why:"same weight, "+D.dayCause}; return {w:last.w+incFor(n,s,last.w),why:`~${lo} reps`}; }
  if(last.r>=lo) return {w:last.w,why:`${Math.min(top,last.r+1)} reps`};
  if(prev&&prev.w===last.w&&prev.r<lo) return {w:roundW(n,last.w*0.9),why:"rebuild"};
  return {w:last.w,why:"repeat"};
}

function review(d,s,i,P){
  const st=get(d.id,i), log=(st.log||[]).map(x=>({w:num(x.w,0),r:num(x.r,0)})).filter(x=>x.w>0&&x.r>0);
  if(!log.length) return null;
  const base=suggest(d,s,i,true,P); if(!base) return null;
  const n=exName(d,s,i), last=log[log.length-1], first=log[0], A=P.days[d.id].slots[i], D=P.days[d.id];
  const [lo,hi]=range(s.reps), top=isIso(s)?hi+3:hi;
  let {w,why}=base, tag="";
  const canUp=!inSeason()&&wk.deload!=="Yes"&&!D.cutD;
  if(canUp&&last.r>=top+3){ w=last.w+2*incFor(n,s,last.w); why="too light, bigger jump"; }
  else if(log.length>=2&&first.w===last.w&&first.r-last.r>=4){ w=last.w; why="reps fell off across sets; rest longer, same weight"; tag="collapse"; }
  else if(last.r<lo&&base.why==="repeat"){ why="under the rep range; repeat it"; }
  if(log.length<(A.sets||0)) why+=` · ${log.length} of ${A.sets} sets done`;
  tag=tag||(w>last.w?"up":w<last.w?"down":"hold");
  return {n,w,why,tag};
}
const TAGTXT={up:"Up",down:"Down",hold:"Hold",collapse:"Fatigue"};
function fx(P){
  const o={};
  Object.entries(P.G).forEach(([c,l])=>{ o["r:"+c.replace(/ \d+ \(.*\)$/,"").replace(/^\d+ min /,"")]=`${c[0].toUpperCase()+c.slice(1)} → ${l.join(", ")}`; });
  o.intake=r5(P.math.intake);
  o.fin=P.math.nLift?(P.math.nFin?`Finishers now ${P.math.m} min × ${P.math.nFin}`:"No finishers needed"):"";
  o.days=DAYS.length?`Days now: ${DAYS.map(d=>d.title.split(" · ")[0]).join(" · ")}`:"No lifting days";
  return o;
}
function diffFx(a,b){
  const out=[], dayChange=a.days!==b.days;
  if(dayChange) out.push(b.days);
  else {
    Object.keys(b).filter(k=>k.startsWith("r:")&&a[k]!==b[k]&&!(k.includes("focus")&&k in a)).forEach(k=>out.push(b[k]));
    Object.keys(a).filter(k=>k.startsWith("r:")&&!(k in b)&&!k.includes("focus")).forEach(k=>out.push(`${a[k].split(" → ")[0].replace(/ \(.*\)/,"")}: back to normal`));
  }
  if(a.fin!==b.fin&&b.fin) out.push(b.fin);
  const di=b.intake-a.intake;
  if(Math.abs(di)>=20) out.push(`Eat ${b.intake.toLocaleString()} kcal/day (${di>0?"+":"−"}${Math.abs(di)})`);
  return out.slice(0,3);
}
function dayDiff(Pa,Pb,id){
  const d=DAYS.find(x=>x.id===id); if(!d) return [];
  const A=Pa.days[id], B=Pb.days[id], out=[], dn=[], up=[], sk=[], back=[];
  d.slots.forEach((s,i)=>{ const a=A.slots[i], b=B.slots[i]; if(a.skip==="hidden") return;
    if(!a.skip&&b.skip) sk.push(s.label); else if(a.skip&&!b.skip) back.push(s.label);
    else if(!a.skip&&!s.cardio&&a.sets!==b.sets) (b.sets<a.sets?dn:up).push(s.label);
    if(s.cardio&&!b.skip&&!!a.steady!==!!b.steady) out.push(b.steady?"Finisher at easy pace, no intervals":"Finisher back to normal pace"); });
  if(dn.length) out.unshift(`−1 set: ${dn.join(", ")}`);
  if(up.length) out.unshift(`+1 set: ${up.join(", ")}`);
  if(sk.length) out.push(`Skipped: ${sk.join(", ")}`);
  if(back.length) out.push(`Back in: ${back.join(", ")}`);
  if(B.cutD&&!A.cutD) out.push("Same weights as last time");
  if(!B.cutD&&A.cutD) out.push("Weights can go up again");
  if(B.today==="Good"&&A.today!=="Good") out.push("Push your top set on main lifts");
  return out.length?[`Today: ${B.today}`,...out]:[`Today: ${B.today} · no change to the plan`];
}
/** Mark a day done: logs history, detects fatigue, stores the next-time review. Returns toast lines. */
function markDone(dayId){
  wk.done=wk.done||{};
  if(wk.done[dayId]){ delete wk.done[dayId]; if(wk.review) delete wk.review[dayId]; save(); return []; }
  const d=DAYS.find(x=>x.id===dayId); let drops=0;
  const P0=plan(), items=[];
  d.slots.forEach((s,i)=>{ if(s.cardio||P0.days[dayId].slots[i].skip) return; const r=review(d,s,i,P0); if(r) items.push(r); });
  d.slots.forEach((s,i)=>{ if(s.cardio) return; const L=lastSet(get(dayId,i).log); if(!L) return; const n=exName(d,s,i), h=exHist[n]||[], pv=h[h.length-1];
    const rv=items.find(x=>x.n===n);
    if((pv&&wk.deload!=="Yes"&&L.w>=pv.w&&L.r<=pv.r-2)||(rv&&rv.tag==="collapse")) drops++;
    h.push({w:L.w,r:L.r,t:Date.now(),season:inSeason()?"In-season":"Off-season"}); exHist[n]=h.slice(-24); set(dayId,i,"log",[]); });
  wk.fatigue=(wk.fatigue||[]).concat([{t:Date.now(),day:dayId,drops}]).slice(-10);
  const P=plan(); let k=0;
  P.days[dayId].slots.forEach((A,i)=>{ if(d.slots[i].cardio&&!A.skip&&A.kcal){ const a=num(get(dayId,i).act,0); k+=a>0?a*A.rate:A.kcal; } });
  wk.done[dayId]=Math.max(0.001,k); wk.donePlan=wk.donePlan||{}; wk.donePlan[dayId]=P.days[dayId].slots.reduce((a,A)=>a+(A.kcal&&!A.skip?A.kcal:0),0);
  if(wk.upNext===dayId){ wk.upNext=""; wk.missedNote=null; }
  const c=t=>items.filter(x=>x.tag===t).length, nxt=DAYS.find(x=>x.id!==dayId&&!wk.done[x.id]);
  const note=drops>=2?`Reps dropped on ${drops} lifts, so ${nxt?nxt.tab:"your next session"} is shortened.`:"";
  wk.review={...(wk.review||{}),[dayId]:{items,note}};
  save();
  const parts=[c("up")&&`${c("up")} moving up`,c("hold")&&`${c("hold")} holding`,(c("down")+c("collapse"))&&`${c("down")+c("collapse")} easing off`].filter(Boolean);
  return [`${d.tab} done`,...(parts.length?[`Next time: ${parts.join(", ")}.`]:[]),...(note?[note]:[]),...(items.some(x=>x.why.startsWith("too light"))?["Some lifts were too light; they get a bigger jump."]:[])];
}
/** Close the week: snapshot history, plan missed days, calibrate maintenance, reset check-in. Returns toast lines. */
function newWeek(){
  const P=plan(), done=wk.done||{};
  const missed=DAYS.filter(d=>!done[d.id]);
  let sm=0; SPORTS.forEach(a=>{ if(ACT[a].noMin) return; for(let i=0;i<cnt(a);i++) sm+=num((wk[actKey(a)]||[])[i],plannedMin(a)); });
  const w=num(wk.wAvg,0)||null;
  wk.weeks=(wk.weeks||[]).concat([{start:wk.weekStart||Date.now(),season:inSeason()?"In-season":"Off-season",focus:wk.focus,mode:wk.mode,ramp:hasSport()&&!inSeason()&&wk.ramp==="Yes",deload:wk.deload==="Yes",
    lifts:DAYS.length-missed.length,planned:DAYS.length,sport:sm,cardio:r5(P.math.cardioTotal),w,intake:r5(P.math.intake),raw:r5(P.math.raw)}]).slice(-52);
  if(missed.length&&missed.length<DAYS.length){
    const names=missed.map(d=>d.tab).join(" and ");
    if(wk.mode==="Deficit only"){ wk.upNext=DAYS[0].id; wk.missedNote={why:`missed ${names} last week`,txt:`reset to ${DAYS[0].tab}; recovery beats catching up in a deficit`}; }
    else { wk.upNext=missed[0].id; wk.missedNote={why:`missed ${names} last week`,txt:`start with ${missed[0].tab}, then continue in order`}; }
  } else { wk.upNext=""; wk.missedNote=null; }
  const ws=wk.weeks.filter(x=>x.w&&x.intake&&x.raw).slice(-6);
  if(ws.length>=3){ const xs=ws.map(x=>x.start/6048e5), ys=ws.map(x=>x.w), mx=xs.reduce((a,b)=>a+b)/xs.length, my=ys.reduce((a,b)=>a+b)/ys.length;
    const slope=xs.reduce((a,x,j)=>a+(x-mx)*(ys[j]-my),0)/Math.max(1e-9,xs.reduce((a,x)=>a+(x-mx)**2,0));
    const avgIn=ws.reduce((a,x)=>a+x.intake,0)/ws.length, avgRaw=ws.reduce((a,x)=>a+x.raw,0)/ws.length;
    wk.calib=Math.max(-400,Math.min(400,r5(avgIn-slope*500-avgRaw))); wk.calibN=ws.length; }
  const reset={weekStart:Date.now(),review:{},done:{},donePlan:{},today:{},zAct:[],ready:"Normal",sore:"None",drink:"0",wAvg:"",deload:"No"};
  ACT_IDS.forEach(a=>{ if(a!=="lift") reset[actKey(a)]=[]; });
  Object.assign(wk,reset);
  ALL.forEach(d=>d.slots.forEach((s,i)=>{ if(s.cardio&&slots[d.id]&&slots[d.id][i]) delete slots[d.id][i].act; }));
  save(); return ["New week started. Check-in reset to normal."];
}

export { ACT, ACT_IDS, ALL, CARDIO, CLIMB_MET, CUSTOM, DAYS, DEF, INTERVAL, KEY, KEY2, KEY3, L, PICKLE_MET, SPIN_MET, SPIN_MIN, SPORTS, STEADY, SUP, TAGTXT, YOGA_MET, actKey, cnt, dayDiff, deloadInfo, diffFx, enabled, esc, exHist, exName, fem, fx, get, hasSport, inSeason, incFor, init, isDB, isIso, kg, lastSet, markDone, minKey, newWeek, num, perMin, persist, plan, plannedMin, r5, range, review, roundW, save, set, setSaveHook, slots, split, suggest, syncDays, wk };
