/* ============================================================
   Cut Tracker — offline-first calorie / macro / weight tracker
   ============================================================ */
(function () {
"use strict";

const CFG = window.CONFIG || {};
const hasSupabase = CFG.SUPABASE_URL && !/^PASTE_/.test(CFG.SUPABASE_URL)
                 && CFG.SUPABASE_ANON_KEY && !/^PASTE_/.test(CFG.SUPABASE_ANON_KEY);
const hasUSDA = CFG.USDA_API_KEY && !/^PASTE_/.test(CFG.USDA_API_KEY);

/* ---------- tiny helpers ---------- */
const $ = id => document.getElementById(id);
const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;
const now = () => Date.now();
const uid = () => Math.random().toString(36).slice(2, 9) + now().toString(36);
function ymd(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function parseYmd(s){ const p=String(s).split("-").map(Number); return new Date(p[0],p[1]-1,p[2]); }
function shiftDay(k,n){ const d=parseYmd(k); d.setDate(d.getDate()+n); return ymd(d); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function toast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("on"),1700);
}
const MEALS = [["breakfast","Breakfast"],["lunch","Lunch"],["dinner","Dinner"],["snack","Snacks"]];

/* ---------- storage ---------- */
const KEY = "cutTracker_v2";
const AUTHKEY = "cutTracker_auth";
let memOnly = false;
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ memOnly=true; return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){ memOnly=true; } }

const DEFAULTS = {
  settings:{ sex:"m", age:35, heightIn:70, act:1.2, start:215, goal:180, pace:1.5,
             protPerLb:1, fatPct:0.25, remindOn:false, remindTime:"20:00" },
  days:{}, custom:[], favs:[], meals:[], customWorkouts:[], plan:{ days:[1,2,4,6], started:null },
  meta:{ pupdated:0, lastSync:0, notified:"" }
};

function migrate(){
  // pick up data from the original single-file version if it's in this browser
  const old = lsGet("cutTracker_v1");
  if(!old) return null;
  try{
    const o = JSON.parse(old);
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    out.settings = Object.assign(out.settings, o.settings||{});
    Object.keys(o.days||{}).forEach(k=>{
      const d = o.days[k];
      out.days[k] = {
        entries:(d.entries||[]).map(e=>({id:uid(),name:e.name,serv:e.serv,cal:e.cal,p:e.p,c:e.c,f:e.f,meal:"snack"})),
        burned:d.burned||0, weight:d.weight==null?null:d.weight, updated:now()
      };
    });
    out.custom = (o.custom||[]).map(f=>Object.assign({id:uid()},f));
    return out;
  }catch(e){ return null; }
}

let DB;
try{ DB = JSON.parse(lsGet(KEY)); }catch(e){ DB = null; }
if(!DB) DB = migrate();
if(!DB) DB = JSON.parse(JSON.stringify(DEFAULTS));
DB.settings = Object.assign({}, DEFAULTS.settings, DB.settings||{});
DB.meta     = Object.assign({}, DEFAULTS.meta, DB.meta||{});
["days"].forEach(k=>{ if(!DB[k]) DB[k]={}; });
["custom","favs","meals","customWorkouts"].forEach(k=>{ if(!Array.isArray(DB[k])) DB[k]=[]; });
if(!DB.plan || typeof DB.plan!=="object") DB.plan = { days:[1,2,4,6], started:null };

function save(){ lsSet(KEY, JSON.stringify(DB)); }
function touchDay(k){ day(k).updated = now(); save(); scheduleSync(); }
function touchProfile(){ DB.meta.pupdated = now(); save(); scheduleSync(); }

/* ---------- model ---------- */
const TODAY = ymd(new Date());
let cur = TODAY;

function day(k){
  if(!DB.days[k]) DB.days[k] = { entries:[], burned:0, weight:null, updated:0 };
  const d = DB.days[k];
  if(!Array.isArray(d.entries)) d.entries = [];
  d.burned = d.burned || 0;
  if(d.weight === undefined) d.weight = null;
  d.updated = d.updated || 0;
  return d;
}
function hasData(k){
  const d = DB.days[k];
  return !!d && (d.entries.length>0 || d.burned>0 || d.weight!=null);
}
function totals(k, meal){
  const d=day(k); let c=0,p=0,cb=0,f=0;
  d.entries.forEach(e=>{ if(meal && e.meal!==meal) return; c+=e.cal; p+=e.p; cb+=e.c; f+=e.f; });
  return {cal:c,p:p,c:cb,f:f};
}
function latestWeight(){
  const ks = Object.keys(DB.days).filter(k=>DB.days[k].weight!=null).sort();
  return ks.length ? DB.days[ks[ks.length-1]].weight : (+DB.settings.start||215);
}
function weightOn(k){
  const ks = Object.keys(DB.days).filter(x=>DB.days[x].weight!=null && x<=k).sort();
  return ks.length ? DB.days[ks[ks.length-1]].weight : (+DB.settings.start||215);
}

/* ---------- calorie math ---------- */
function bmr(w){
  const s=DB.settings, kg=(w==null?latestWeight():w)*0.45359237, cm=(+s.heightIn||70)*2.54;
  return 10*kg + 6.25*cm - 5*(+s.age||35) + (s.sex==="f" ? -161 : 5);
}
function baseBurn(k){ return bmr(k?weightOn(k):null) * (+DB.settings.act||1.2); }
function dailyDeficit(){ return (+DB.settings.pace||1.5) * 3500/7; }
function calFloor(){ return DB.settings.sex==="f" ? 1200 : 1500; }
function budget(k){ return baseBurn(k) + exerciseCal(k) - dailyDeficit(); }
function macroTargets(k){
  const cals = Math.max(budget(k), calFloor());
  const s = DB.settings;
  const prot = (+s.goal||180) * (+s.protPerLb||1);
  const fat  = cals * (+s.fatPct||0.25) / 9;
  const carb = Math.max(0, (cals - prot*4 - fat*9) / 4);
  return { cal:cals, p:prot, f:fat, c:carb };
}
function deficitOn(k){ return baseBurn(k) + exerciseCal(k) - totals(k).cal; }
function loggedDays(){ return Object.keys(DB.days).filter(k=>k<=TODAY && DB.days[k].entries.length>0).sort(); }
function weighDays(){ return Object.keys(DB.days).filter(k=>DB.days[k].weight!=null).sort(); }

function streak(){
  let n=0, k = day(TODAY).entries.length ? TODAY : shiftDay(TODAY,-1);
  while(DB.days[k] && DB.days[k].entries.length>0){ n++; k = shiftDay(k,-1); }
  return n;
}

/* ============================================================
   RENDER — Today
   ============================================================ */
function renderDate(){
  const d = parseYmd(cur);
  $("dateLabel").childNodes[0].nodeValue =
    d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
  const diff = Math.round((parseYmd(cur)-parseYmd(TODAY))/86400000);
  $("dateRel").textContent = diff===0?"Today":diff===-1?"Yesterday":(diff<0?(-diff)+" days ago":"in "+diff+" days");
  $("nextDay").style.visibility = cur>=TODAY ? "hidden":"visible";
}

function renderHero(){
  const t=totals(cur), tg=macroTargets(cur).cal, left=tg-t.cal;
  $("eBase").textContent = r0(baseBurn(cur)).toLocaleString();
  $("eEx").textContent   = "+" + r0(exerciseCal(cur)).toLocaleString();
  $("eDef").textContent  = "−" + r0(dailyDeficit()).toLocaleString();
  $("eTarget").textContent = r0(tg).toLocaleString();
  $("eAte").textContent  = r0(t.cal).toLocaleString();
  $("eTargetRow").classList.toggle("over", budget(cur) < calFloor());

  $("ringNum").textContent = Math.abs(r0(left)).toLocaleString();
  $("ringLbl").textContent = left>=0 ? "cal left" : "cal over";
  const pct = tg>0 ? Math.min(t.cal/tg,1) : 0, C = 2*Math.PI*56, arc = $("ringArc");
  arc.setAttribute("stroke-dashoffset", C*(1-pct));
  arc.style.opacity = pct>0.001 ? 1 : 0;
  arc.setAttribute("stroke", left<0 ? "#f87171" : pct>0.85 ? "#fbbf24" : "#4ade80");
  $("baseHint").textContent = r0(baseBurn(cur)).toLocaleString();
  $("hdrSub").textContent = r1(DB.settings.start)+" → "+r1(DB.settings.goal)+" lbs · now "+r1(latestWeight());
}

function renderMacros(){
  const t=totals(cur), tg=macroTargets(cur);
  const rows=[["Protein",t.p,tg.p,"var(--pro)"],["Carbs",t.c,tg.c,"var(--carb)"],["Fat",t.f,tg.f,"var(--fat)"]];
  $("macros").innerHTML = rows.map(([n,v,g,col])=>{
    const pct = g>0 ? Math.min(v/g*100,100) : 0, over = v>g*1.05;
    return '<div class="macro"><div class="mhead"><span>'+n+'</span>'+
      '<b'+(over?' style="color:var(--warn)"':'')+'>'+r0(v)+' / '+r0(g)+' g</b></div>'+
      '<div class="bar"><i style="width:'+pct+'%;background:'+(over?'var(--warn)':col)+'"></i></div></div>';
  }).join("");
}

function favKey(x){ return (x.name||x.n||"") + "|" + (x.serv||x.s||""); }
function isFav(e){ const k=favKey(e); return DB.favs.some(f=>favKey(f)===k); }
function toggleFav(e){
  const k=favKey(e), i=DB.favs.findIndex(f=>favKey(f)===k);
  if(i>=0){ DB.favs.splice(i,1); toast("Removed from favorites"); }
  else {
    // store the single-serving version so quantity doesn't get baked in
    const q = e.qty || 1;
    DB.favs.unshift({ n:e.name, s:e.baseServ || e.serv, c:e.cal/q, p:e.p/q, cb:e.c/q, f:e.f/q });
    DB.favs = DB.favs.slice(0,40); toast("Added to favorites");
  }
  touchProfile(); renderMeals(); renderChips();
}

function renderMeals(){
  const d = day(cur);
  $("meals").innerHTML = MEALS.map(([id,label])=>{
    const items = d.entries.map((e,i)=>({e,i})).filter(x=>(x.e.meal||"snack")===id);
    const kc = items.reduce((a,x)=>a+x.e.cal,0);
    return '<div class="meal"><div class="mealhead">'+
      '<span class="nm">'+label+'</span>'+
      '<span class="kc">'+(kc?r0(kc)+" cal":"")+'</span>'+
      '<button class="add" data-meal="'+id+'">＋</button></div>'+
      '<div class="mealbody">'+ items.map(x=>
        '<div class="entry">'+
          '<button class="star '+(isFav(x.e)?"on":"")+'" data-fav="'+x.i+'">'+(isFav(x.e)?"★":"☆")+'</button>'+
          '<div class="info"><div class="n">'+esc(x.e.name)+'</div>'+
          '<div class="m">'+esc(x.e.serv||"")+' · '+r0(x.e.p)+'p '+r0(x.e.c)+'c '+r0(x.e.f)+'f</div></div>'+
          '<div class="cal">'+r0(x.e.cal)+'</div>'+
          '<button class="del" data-del="'+x.i+'">×</button>'+
        '</div>').join("") + '</div></div>';
  }).join("");

  $("meals").querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    day(cur).entries.splice(+b.dataset.del,1); touchDay(cur); renderToday();
  });
  $("meals").querySelectorAll("[data-fav]").forEach(b=>b.onclick=()=>{
    toggleFav(day(cur).entries[+b.dataset.fav]);
  });
  $("meals").querySelectorAll("[data-meal]").forEach(b=>b.onclick=()=>openSheet(b.dataset.meal));
}

function renderStreak(){
  const n = streak();
  $("streakNum").textContent = n;
  $("streakTxt").textContent = n===0 ? "Log any food to start a streak."
    : n===1 ? "1 day logged. Keep it going."
    : n+" days in a row logged.";
  let dots="";
  for(let i=6;i>=0;i--){
    const k = shiftDay(TODAY,-i), d = DB.days[k];
    const cls = d && d.entries.length ? "on" : (d && (d.burned||d.weight!=null) ? "part" : "");
    dots += '<i class="'+cls+'"></i>';
  }
  $("streakDots").innerHTML = dots;
}

function renderWeighPrompt(){
  const box = $("weighPrompt");
  if(cur !== TODAY || day(TODAY).weight != null){ box.innerHTML=""; return; }
  box.innerHTML =
    '<div class="card tight" style="border-color:#254468;background:linear-gradient(135deg,#1b2a3a,#161b22)">'+
      '<div style="display:flex;align-items:center;gap:10px">'+
        '<div style="flex:1"><b style="font-size:14px">Weigh in</b>'+
          '<div style="font-size:12px;color:var(--tx3);margin-top:1px">No weight logged today</div></div>'+
        '<input id="qWeight" type="number" inputmode="decimal" step="0.1" placeholder="lbs" style="width:92px;text-align:center">'+
        '<button class="btn" id="qWeightSave">Save</button>'+
      '</div></div>';
  const commit = ()=>{
    const v = parseFloat($("qWeight").value);
    if(isNaN(v) || v<50 || v>1000){ toast("Enter a weight in pounds"); return; }
    day(TODAY).weight = v; touchDay(TODAY); renderToday(); toast("Logged "+r1(v)+" lbs");
  };
  $("qWeightSave").onclick = commit;
  $("qWeight").addEventListener("keydown", e=>{ if(e.key==="Enter") commit(); });
}

function renderWorkoutLine(){
  const ws = dayWorkouts(cur);
  const el = $("workoutLine");
  if(!el) return;
  el.innerHTML = ws.length
    ? ws.map(w=>'<div class="eqrow"><span>'+esc(w.name)+' · '+w.minutes+' min</span><b>+'+r0(w.cal)+'</b></div>').join("")
    : '';
}

function renderToday(){
  renderDate();
  $("burned").value = day(cur).burned || "";
  renderWorkoutLine();
  renderWeighPrompt();
  renderHero(); renderMacros(); renderMeals(); renderStreak();
}

/* ============================================================
   ADD FOOD — sheet, search (built-in + USDA), chips
   ============================================================ */
let sheetMeal = "snack";

function guessMeal(){
  const h = new Date().getHours();
  return h<10.5 ? "breakfast" : h<15 ? "lunch" : h<21 ? "dinner" : "snack";
}
function openSheet(meal){
  sheetMeal = meal || guessMeal();
  $("mealPick").value = sheetMeal;
  $("search").value = ""; $("results").innerHTML = ""; $("searchStatus").textContent = "";
  $("quickPanels").classList.remove("hide");
  $("quickForm").classList.add("hide"); $("customForm").classList.add("hide");
  renderChips();
  $("addSheet").classList.add("on");
  document.body.style.overflow = "hidden";
}
function closeSheet(){
  $("addSheet").classList.remove("on");
  document.body.style.overflow = "";
}

function addEntry(food, qty, meal){
  const q = qty||1;
  day(cur).entries.push({
    id:uid(), name:food.n, baseServ:food.s, qty:q,
    serv:(q===1 ? food.s : (q%1===0?q:r1(q))+" × "+food.s),
    cal:food.c*q, p:food.p*q, c:food.cb*q, f:food.f*q,
    meal: meal || sheetMeal
  });
  touchDay(cur); renderToday();
  toast(food.n.length>28 ? food.n.slice(0,28)+"… added" : food.n+" added");
}

/* ---- recents: what he actually eats, ranked by how often and how lately ---- */
function recents(){
  const map = new Map();
  for(let i=0;i<45;i++){
    const k = shiftDay(TODAY,-i), d = DB.days[k];
    if(!d) continue;
    d.entries.forEach(e=>{
      const key = favKey(e);
      const q = e.qty || 1;
      const prev = map.get(key);
      const score = (prev?prev.score:0) + 1/(1+i*0.25);
      map.set(key, prev ? Object.assign(prev,{score:score, n:prev.n})
        : { n:e.name, s:e.baseServ||e.serv, c:e.cal/q, p:e.p/q, cb:e.c/q, f:e.f/q, score:score });
    });
  }
  return [...map.values()].sort((a,b)=>b.score-a.score).slice(0,18);
}

function chipHTML(list, attr){
  if(!list.length) return '<div class="empty" style="padding:8px 0">Nothing here yet.</div>';
  return list.map((x,i)=>'<button class="chip" data-'+attr+'="'+i+'">'+esc(x.n||x.name)+
    '<b>'+r0(x.c!=null?x.c:(x.cal||0))+'</b></button>').join("");
}
function renderChips(){
  const favs = DB.favs, recs = recents(), mls = DB.meals;
  $("favChips").innerHTML = chipHTML(favs,"fav");
  $("recentChips").innerHTML = chipHTML(recs,"rec");
  $("mealChips").innerHTML = mls.length
    ? mls.map((m,i)=>'<button class="chip" data-savedmeal="'+i+'">'+esc(m.name)+
        '<b>'+r0(m.items.reduce((a,e)=>a+e.cal,0))+'</b></button>').join("")
    : '<div class="empty" style="padding:8px 0">Log a day, then tap "Save as meal".</div>';

  $("favChips").querySelectorAll("[data-fav]").forEach(b=>b.onclick=()=>addEntry(favs[+b.dataset.fav],1));
  $("recentChips").querySelectorAll("[data-rec]").forEach(b=>b.onclick=()=>addEntry(recs[+b.dataset.rec],1));
  $("mealChips").querySelectorAll("[data-savedmeal]").forEach(b=>b.onclick=()=>{
    const m = DB.meals[+b.dataset.savedmeal];
    m.items.forEach(e=>day(cur).entries.push(Object.assign({},e,{id:uid(),meal:sheetMeal})));
    touchDay(cur); renderToday(); toast(m.name+" added");
  });
}

/* ---- built-in database ---- */
function builtIn(){
  return DB.custom.map(f=>({n:f.n,s:f.s,c:f.c,p:f.p,cb:f.cb,f:f.f,src:"mine"}))
    .concat((window.FOODS||[]).map(a=>({n:a[0],s:a[1],c:a[2],p:a[3],cb:a[4],f:a[5],src:"built"})));
}
function localSearch(q){
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return builtIn().filter(f=>{
    const n=f.n.toLowerCase(); return words.every(w=>n.includes(w));
  }).sort((a,b)=>{
    if((a.src==="mine")!==(b.src==="mine")) return a.src==="mine"?-1:1;
    const ai=a.n.toLowerCase().indexOf(words[0]), bi=b.n.toLowerCase().indexOf(words[0]);
    return ai-bi || a.n.length-b.n.length;
  }).slice(0,20);
}

/* ---- USDA FoodData Central ---- */
let usdaAbort = null;
function usdaNutrient(food, ids){
  const list = food.foodNutrients||[];
  const hit = list.find(x=>ids.indexOf(+(x.nutrientId||x.nutrientNumber||0))>=0);
  return hit ? (+hit.value || 0) : 0;
}
function usdaMap(food){
  const per100 = {
    c : usdaNutrient(food,[1008,208]),
    p : usdaNutrient(food,[1003,203]),
    cb: usdaNutrient(food,[1005,205]),
    f : usdaNutrient(food,[1004,204])
  };
  let factor = 1, serving = "100 g";
  const ss = +food.servingSize, unit = String(food.servingSizeUnit||"").toLowerCase();
  if(ss>0 && (unit==="g"||unit==="grm"||unit==="ml"||unit==="mlt")){
    factor = ss/100;
    serving = food.householdServingFullText ? food.householdServingFullText+" ("+r0(ss)+unit.slice(0,2)+")" : r0(ss)+" "+unit.slice(0,2);
  }
  const brand = food.brandName || food.brandOwner || "";
  let name = String(food.description||"").replace(/\s+/g," ").trim();
  name = name.charAt(0)+name.slice(1).toLowerCase();
  if(brand) name = name + " — " + String(brand).trim();
  return { n:name, s:serving, c:per100.c*factor, p:per100.p*factor, cb:per100.cb*factor, f:per100.f*factor, src:"usda" };
}
async function usdaSearch(q){
  if(!hasUSDA) return [];
  if(usdaAbort) usdaAbort.abort();
  usdaAbort = new AbortController();
  const url = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key="+encodeURIComponent(CFG.USDA_API_KEY)+
    "&query="+encodeURIComponent(q)+"&pageSize=25&dataType=Branded,SR%20Legacy,Foundation";
  const res = await fetch(url,{signal:usdaAbort.signal});
  if(!res.ok) throw new Error("USDA "+res.status);
  const j = await res.json();
  return (j.foods||[]).map(usdaMap).filter(f=>f.c>0);
}

let searchTimer=null, searchSeq=0;
function doSearch(){
  const q = $("search").value.trim();
  clearTimeout(searchTimer);
  if(!q){ $("results").innerHTML=""; $("searchStatus").textContent=""; $("quickPanels").classList.remove("hide"); return; }
  $("quickPanels").classList.add("hide");
  const mine = localSearch(q);
  paintResults(mine);
  if(!hasUSDA){ $("searchStatus").textContent = mine.length?"":"no match"; return; }
  const seq = ++searchSeq;
  $("searchStatus").innerHTML = '<span class="spin"></span> searching USDA';
  searchTimer = setTimeout(async ()=>{
    try{
      const web = await usdaSearch(q);
      if(seq!==searchSeq) return;
      $("searchStatus").textContent = web.length ? "+"+web.length+" from USDA" : "no USDA match";
      paintResults(mine.concat(web));
    }catch(err){
      if(err.name==="AbortError" || seq!==searchSeq) return;
      $("searchStatus").textContent = navigator.onLine ? "USDA unavailable" : "offline — built-in only";
    }
  }, 420);
}

function paintResults(list){
  const box = $("results");
  if(!list.length){ box.innerHTML='<div class="empty">No match yet — try "Quick add" below.</div>'; return; }
  box.innerHTML = list.map((f,i)=>
    '<div class="res"><div class="info"><div class="n">'+(f.src==="mine"?"★ ":"")+esc(f.n)+'</div>'+
    '<div class="m">'+(f.src==="usda"?'<span style="color:var(--pro)">USDA</span> · ':'')+
      esc(f.s)+' · '+r0(f.c)+' cal · '+r0(f.p)+'p '+r0(f.cb)+'c '+r0(f.f)+'f</div></div>'+
    '<input type="number" inputmode="decimal" step="0.25" value="1" data-q="'+i+'">'+
    '<button class="btn" data-add="'+i+'">Add</button></div>').join("");
  box.querySelectorAll("[data-add]").forEach(btn=>btn.onclick=()=>{
    const i=+btn.dataset.add;
    const qty = parseFloat(box.querySelector('[data-q="'+i+'"]').value)||1;
    addEntry(list[i], qty);
    $("search").value=""; box.innerHTML=""; $("searchStatus").textContent="";
    $("quickPanels").classList.remove("hide"); renderChips();
    const panel = document.querySelector("#addSheet .panel"); if(panel) panel.scrollTop = 0;
  });
}

/* ---- copy yesterday / save as meal ---- */
function copyYesterday(){
  const y = shiftDay(cur,-1), src = DB.days[y];
  if(!src || !src.entries.length){ toast("Nothing logged the day before"); return; }
  src.entries.forEach(e=>day(cur).entries.push(Object.assign({},e,{id:uid()})));
  touchDay(cur); renderToday(); toast(src.entries.length+" items copied");
}
function saveDayAsMeal(){
  const d = day(cur);
  if(!d.entries.length){ toast("Log something first"); return; }
  let name = null;
  try{ name = prompt("Name this meal (e.g. \"Usual breakfast\")"); }catch(e){ name = null; }
  if(name === null && typeof prompt !== "function") name = "Meal — " + parseYmd(cur).toLocaleDateString(undefined,{month:"short",day:"numeric"});
  if(!name) return;
  DB.meals.unshift({ id:uid(), name:name.trim().slice(0,40),
    items:d.entries.map(e=>({name:e.name,baseServ:e.baseServ,qty:e.qty,serv:e.serv,cal:e.cal,p:e.p,c:e.c,f:e.f,meal:e.meal})) });
  DB.meals = DB.meals.slice(0,30);
  touchProfile(); toast("Saved — find it under Add"); renderSavedMeals();
}

/* ============================================================
   RENDER — Trends
   ============================================================ */
function renderTrends(){ renderWeekly(); renderHistory(); }

function renderWeight(){
  const s=DB.settings, w=latestWeight();
  const lost=s.start-w, left=w-s.goal, span=s.start-s.goal;
  $("sNow").textContent  = r1(w);
  $("sLost").textContent = (lost<0?"+":"")+r1(Math.abs(lost));
  $("sLeft").textContent = r1(Math.max(left,0));
  const pct = span>0 ? Math.max(0,Math.min(lost/span*100,100)) : 0;
  $("progBar").style.width = pct+"%";
  $("progText").textContent = weighDays().length
    ? r0(pct)+"% of the way there — "+r1(Math.max(left,0))+" lbs to go."
    : "Log your first weigh-in above to start tracking.";
  if(!$("wDate").value) $("wDate").value = TODAY;
  drawChart(); renderProjection(); renderWHistory();
}

/* ---- the full, editable weigh-in log ---- */
let editingDate = null;
function saveWeighIn(dateKey, value){
  if(dateKey > TODAY){ toast("That date hasn't happened yet"); return false; }
  if(isNaN(value) || value<50 || value>1000){ toast("Enter a weight in pounds"); return false; }
  day(dateKey).weight = value; touchDay(dateKey);
  renderWeight(); renderToday();
  return true;
}
function renderWHistory(){
  const wd = weighDays().slice().reverse();
  $("wCount").textContent = wd.length ? "("+wd.length+")" : "";
  if(!wd.length){ $("wHistory").innerHTML='<div class="empty">No weigh-ins yet. Add one above.</div>'; return; }
  $("wHistory").innerHTML = wd.map((k,i)=>{
    const wv = DB.days[k].weight;
    const prev = wd[i+1] ? DB.days[wd[i+1]].weight : null;
    const dif = prev==null ? null : wv-prev;
    const difTxt = dif==null ? '<span style="color:var(--tx3)">first weigh-in</span>'
      : Math.abs(dif)<0.05 ? '<span style="color:var(--tx3)">no change</span> from previous'
      : '<span class="'+(dif<0?"good":"bad")+'">'+(dif<0?"−":"+")+r1(Math.abs(dif))+'</span> from previous';
    if(editingDate===k){
      return '<div class="entry"><div class="info"><div class="n">'+
        parseYmd(k).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})+'</div></div>'+
        '<input type="number" inputmode="decimal" step="0.1" value="'+wv+'" data-edit="'+k+'" style="width:88px;text-align:center">'+
        '<button class="btn sm" data-ok="'+k+'">Save</button>'+
        '<button class="del" data-cancel="1">×</button></div>';
    }
    return '<div class="entry"><div class="info">'+
      '<div class="n">'+parseYmd(k).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})+
        (k===TODAY?' <span style="color:var(--accent);font-size:11px">today</span>':'')+'</div>'+
      '<div class="m">'+difTxt+'</div></div>'+
      '<div class="cal">'+r1(wv)+'</div>'+
      '<button class="star" data-pencil="'+k+'" title="Edit">✎</button>'+
      '<button class="del" data-drop="'+k+'" title="Delete">×</button></div>';
  }).join("");

  const box = $("wHistory");
  box.querySelectorAll("[data-pencil]").forEach(b=>b.onclick=()=>{ editingDate=b.dataset.pencil; renderWHistory(); });
  box.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>{ editingDate=null; renderWHistory(); });
  box.querySelectorAll("[data-ok]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.ok, v=parseFloat(box.querySelector('[data-edit="'+k+'"]').value);
    if(saveWeighIn(k,v)){ editingDate=null; renderWHistory(); toast("Updated"); }
  });
  box.querySelectorAll("[data-drop]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.drop;
    if(b.dataset.armed){ day(k).weight=null; touchDay(k); renderWeight(); renderToday(); toast("Weigh-in deleted"); return; }
    b.dataset.armed="1"; b.textContent="✓"; b.style.color="var(--warn)"; b.title="Tap again to delete";
    setTimeout(()=>{ if(b.isConnected){ delete b.dataset.armed; b.textContent="×"; b.style.color=""; } },3000);
  });
}

function windowStats(startOffset, len){
  // [startOffset, startOffset+len) days back from today
  let cal=0, def=0, n=0, w0=null, w1=null;
  for(let i=startOffset; i<startOffset+len; i++){
    const k = shiftDay(TODAY,-i), d = DB.days[k];
    if(!d) continue;
    if(d.entries.length){ cal += totals(k).cal; def += deficitOn(k); n++; }
    if(d.weight!=null){ if(w1===null) w1=d.weight; w0=d.weight; }
  }
  return { days:n, avgCal:n?cal/n:0, avgDef:n?def/n:0, wChange:(w0!=null&&w1!=null)?(w1-w0):null };
}
function renderWeekly(){
  const a = windowStats(0,7), b = windowStats(7,7);
  if(!a.days && !b.days){ $("weekly").innerHTML='<div class="empty">Log a few days and a weekly comparison appears here.</div>'; return; }
  function delta(x,y,unit,goodIsUp){
    if(!b.days || !a.days) return '<span style="color:var(--tx3)">—</span>';
    const d = x-y; if(Math.abs(d)<0.5) return '<span style="color:var(--tx3)">flat</span>';
    const good = goodIsUp ? d>0 : d<0;
    return '<span class="'+(good?"good":"bad")+'">'+(d>0?"+":"−")+r0(Math.abs(d))+unit+'</span>';
  }
  $("weekly").innerHTML =
    '<div class="eqrow"><span>Days logged</span><b>'+a.days+' <span style="color:var(--tx3);font-weight:400">vs '+b.days+'</span></b></div>'+
    '<div class="eqrow"><span>Avg calories eaten</span><b>'+r0(a.avgCal)+' '+delta(a.avgCal,b.avgCal," cal",false)+'</b></div>'+
    '<div class="eqrow"><span>Avg daily deficit</span><b>'+r0(a.avgDef)+' '+delta(a.avgDef,b.avgDef," cal",true)+'</b></div>'+
    '<div class="eqrow"><span>Weight change</span><b>'+
      (a.wChange==null ? "—" : (a.wChange<=0?"down ":"up ")+r1(Math.abs(a.wChange))+" lbs")+'</b></div>'+
    '<div class="eqrow"><span>Your deficit predicts</span><b>'+
      (a.days ? (a.avgDef>=0?"down ":"up ")+r1(Math.abs(a.avgDef*7/3500))+" lbs" : "—")+'</b></div>';
}

function renderProjection(){
  const s=DB.settings, left=latestWeight()-s.goal;
  const ld = loggedDays().slice(-14), defs = ld.map(deficitOn);
  const avg = defs.length ? defs.reduce((x,y)=>x+y,0)/defs.length : null;
  const wd = weighDays();
  let ratePerWk = null;
  if(wd.length>=2){
    const a=wd[0], b=wd[wd.length-1], days=(parseYmd(b)-parseYmd(a))/86400000;
    if(days>=5) ratePerWk = (DB.days[a].weight - DB.days[b].weight)/days*7;
  }
  const useRate = (ratePerWk!=null && ratePerWk>0.05) ? ratePerWk
                : (avg!=null && avg>0) ? avg*7/3500 : null;
  if(left<=0){
    $("pDate").textContent="Done"; $("pRate").textContent="—";
    $("pText").textContent="You hit your goal weight."; return;
  }
  if(useRate){
    const dt = new Date(now() + left/useRate*7*86400000);
    $("pDate").textContent = dt.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
    $("pRate").textContent = r1(useRate)+" lb/wk";
    $("pText").textContent = (ratePerWk!=null&&ratePerWk>0.05
      ? "Based on your actual weigh-in trend. "
      : "Based on your average logged deficit ("+r0(avg)+" cal/day). ")
      + "Your plan is "+s.pace+" lb/wk ("+r0(dailyDeficit())+" cal/day).";
  } else {
    $("pDate").textContent="—"; $("pRate").textContent="—";
    $("pText").textContent="Add two weigh-ins about a week apart and a projection appears here.";
  }
}

function renderHistory(){
  const keys=[];
  for(let i=0;i<14;i++){ const k=shiftDay(TODAY,-i); if(hasData(k)) keys.push(k); }
  const tb = $("histTable").querySelector("tbody");
  if(!keys.length){ tb.innerHTML='<tr><td class="empty" colspan="5">Nothing logged in the last 14 days.</td></tr>'; return; }
  tb.innerHTML = '<tr><th>Day</th><th>Ate</th><th>Burned</th><th>Deficit</th><th>Weight</th></tr>' +
    keys.map(k=>{
      const t=totals(k), d=day(k), df=deficitOn(k);
      return '<tr><td>'+parseYmd(k).toLocaleDateString(undefined,{weekday:"short",month:"numeric",day:"numeric"})+'</td>'+
        '<td>'+(t.cal?r0(t.cal):"—")+'</td><td>'+(d.burned?"+"+r0(d.burned):"—")+'</td>'+
        '<td class="'+(df>0?"good":"bad")+'">'+(t.cal?(df>0?"−":"+")+r0(Math.abs(df)):"—")+'</td>'+
        '<td>'+(d.weight!=null?r1(d.weight):"—")+'</td></tr>';
    }).join("");
}

function drawChart(){
  const wd=weighDays(), svg=$("wChart");
  if(wd.length<2){
    svg.innerHTML="";
    $("chartHint").textContent = wd.length===1 ? "One weigh-in logged — add more to see the trend." : "No weigh-ins yet.";
    return;
  }
  const pts = wd.map(k=>({x:parseYmd(k).getTime(), y:DB.days[k].weight}));
  const W=700,H=190,PL=40,PR=12,PT=14,PB=24;
  const xs=pts.map(p=>p.x), ws=pts.map(p=>p.y);
  const x0=Math.min.apply(null,xs), x1=Math.max.apply(null,xs);
  let y0=Math.min.apply(null,ws), y1=Math.max.apply(null,ws);
  const goal=+DB.settings.goal, spanW=y1-y0;
  if(goal >= y0 - Math.max(spanW,3)){ y0=Math.min(y0,goal); y1=Math.max(y1,goal); }
  const pad=Math.max((y1-y0)*0.12,1.2); y0-=pad; y1+=pad;
  const X=v=> PL + (x1===x0?0.5:(v-x0)/(x1-x0))*(W-PL-PR);
  const Y=v=> PT + (1-(v-y0)/(y1-y0))*(H-PT-PB);
  let out="";
  for(let i=0;i<=3;i++){
    const v=y0+(y1-y0)*i/3, yy=Y(v);
    out+='<line x1="'+PL+'" y1="'+yy+'" x2="'+(W-PR)+'" y2="'+yy+'" stroke="#2a323d"/>'+
         '<text x="'+(PL-7)+'" y="'+(yy+4)+'" fill="#6b7784" font-size="11" text-anchor="end">'+r0(v)+'</text>';
  }
  const gy=Y(goal);
  if(gy>PT && gy<H-PB){
    out+='<line x1="'+PL+'" y1="'+gy+'" x2="'+(W-PR)+'" y2="'+gy+'" stroke="#4ade80" stroke-width="1.5" stroke-dasharray="5 4" opacity=".7"/>'+
         '<text x="'+(W-PR)+'" y="'+(gy-6)+'" fill="#4ade80" font-size="11" text-anchor="end">goal '+r1(goal)+'</text>';
  }
  const dl = pts.map((p,i)=>(i?"L":"M")+X(p.x)+","+Y(p.y)).join(" ");
  out+='<path d="'+dl+' L'+X(pts[pts.length-1].x)+','+(H-PB)+' L'+X(pts[0].x)+','+(H-PB)+' Z" fill="#60a5fa" opacity=".10"/>'+
       '<path d="'+dl+'" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  pts.forEach(p=>{ out+='<circle cx="'+X(p.x)+'" cy="'+Y(p.y)+'" r="3.5" fill="#0d1117" stroke="#60a5fa" stroke-width="2"/>'; });
  out+='<text x="'+PL+'" y="'+(H-6)+'" fill="#6b7784" font-size="11">'+parseYmd(wd[0]).toLocaleDateString(undefined,{month:"short",day:"numeric"})+'</text>'+
       '<text x="'+(W-PR)+'" y="'+(H-6)+'" fill="#6b7784" font-size="11" text-anchor="end">'+parseYmd(wd[wd.length-1]).toLocaleDateString(undefined,{month:"short",day:"numeric"})+'</text>';
  svg.innerHTML=out;
  const days=(pts[pts.length-1].x-pts[0].x)/86400000, ch=pts[0].y-pts[pts.length-1].y;
  $("chartHint").textContent = wd.length+" weigh-ins over "+r0(days)+" days · "+
    (ch>=0?"down ":"up ")+r1(Math.abs(ch))+" lbs"+(days>=5?" ("+r1(ch/days*7)+" lb/wk)":"");
}

/* ============================================================
   CLOUD SYNC — Supabase via plain REST (no library, works offline)
   ============================================================ */
let AUTH = null;
try{ AUTH = JSON.parse(lsGet(AUTHKEY)||"null"); }catch(e){ AUTH=null; }

function setSync(state, text){
  const p=$("syncPill"); p.className="syncpill "+state; $("syncTxt").textContent=text;
}
function saveAuth(a){ AUTH=a; lsSet(AUTHKEY, a?JSON.stringify(a):""); }

async function sbAuth(path, body){
  const res = await fetch(CFG.SUPABASE_URL.replace(/\/+$/,"")+"/auth/v1/"+path, {
    method:"POST",
    headers:{ "apikey":CFG.SUPABASE_ANON_KEY, "Content-Type":"application/json" },
    body:JSON.stringify(body)
  });
  const j = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(j.msg || j.error_description || j.message || ("Error "+res.status));
  return j;
}
function storeSession(j){
  if(!j.access_token) throw new Error("No session returned — check that email confirmation is turned off in Supabase.");
  saveAuth({
    access_token:j.access_token, refresh_token:j.refresh_token,
    expires_at: now() + (j.expires_in||3600)*1000 - 60000,
    email:(j.user&&j.user.email)||"", user_id:(j.user&&j.user.id)||""
  });
}
async function ensureToken(){
  if(!AUTH) throw new Error("Not signed in");
  if(now() < AUTH.expires_at) return AUTH.access_token;
  const j = await sbAuth("token?grant_type=refresh_token", { refresh_token:AUTH.refresh_token });
  storeSession(j);
  return AUTH.access_token;
}
async function sbRest(path, opts){
  const tok = await ensureToken();
  const o = opts||{};
  const res = await fetch(CFG.SUPABASE_URL.replace(/\/+$/,"")+"/rest/v1/"+path, {
    method:o.method||"GET",
    headers:Object.assign({
      "apikey":CFG.SUPABASE_ANON_KEY, "Authorization":"Bearer "+tok,
      "Content-Type":"application/json"
    }, o.headers||{}),
    body:o.body?JSON.stringify(o.body):undefined
  });
  if(!res.ok){
    const txt = await res.text().catch(()=>"" );
    throw new Error("Database error "+res.status+(txt?": "+txt.slice(0,140):""));
  }
  return res.status===204 ? null : res.json().catch(()=>null);
}

let syncTimer=null, syncing=false;
function scheduleSync(){
  if(!hasSupabase || !AUTH) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(()=>doSync(true), 4000);
}
async function doSync(quiet){
  if(!hasSupabase || !AUTH || syncing) return;
  if(!navigator.onLine){ setSync("off","Offline"); return; }
  syncing = true; setSync("busy","Syncing");
  try{
    /* ---- days ---- */
    const remote = await sbRest("cut_days?select=date,data,updated") || [];
    const rmap = new Map(remote.map(r=>[r.date, r]));
    // remote wins where it is newer
    rmap.forEach((r,k)=>{
      const l = DB.days[k];
      if(!l || (r.updated||0) > (l.updated||0)){
        DB.days[k] = Object.assign({entries:[],burned:0,weight:null,workouts:[]}, r.data, {updated:r.updated||0});
      }
    });
    // push everything local that is newer
    const push = [];
    Object.keys(DB.days).forEach(k=>{
      const l = DB.days[k], r = rmap.get(k);
      if(!l.updated) return;
      if(!r || l.updated > (r.updated||0)){
        push.push({ user_id:AUTH.user_id, date:k, updated:l.updated,
          data:{ entries:l.entries, burned:l.burned, weight:l.weight, workouts:l.workouts||[] } });
      }
    });
    for(let i=0;i<push.length;i+=100){
      await sbRest("cut_days?on_conflict=user_id,date", {
        method:"POST", headers:{ "Prefer":"resolution=merge-duplicates,return=minimal" },
        body:push.slice(i,i+100)
      });
    }

    /* ---- profile (settings, custom foods, favorites, saved meals) ---- */
    const prof = (await sbRest("cut_profile?select=data,updated&limit=1")) || [];
    const pr = prof[0];
    if(pr && (pr.updated||0) > (DB.meta.pupdated||0)){
      DB.settings = Object.assign({}, DEFAULTS.settings, pr.data.settings||{});
      DB.custom = pr.data.custom||[]; DB.favs = pr.data.favs||[]; DB.meals = pr.data.meals||[];
      if(pr.data.plan) DB.plan = pr.data.plan;
      DB.customWorkouts = pr.data.customWorkouts||[];
      DB.meta.pupdated = pr.updated;
    } else if(!pr || (DB.meta.pupdated||0) > (pr.updated||0)){
      // no row on the server yet (first sign-in) — upload what this device has
      if(!DB.meta.pupdated) DB.meta.pupdated = now();
      await sbRest("cut_profile?on_conflict=user_id", {
        method:"POST", headers:{ "Prefer":"resolution=merge-duplicates,return=minimal" },
        body:[{ user_id:AUTH.user_id, updated:DB.meta.pupdated,
          data:{ settings:DB.settings, custom:DB.custom, favs:DB.favs, meals:DB.meals, plan:DB.plan, customWorkouts:DB.customWorkouts } }]
      });
    }

    DB.meta.lastSync = now(); save();
    setSync("ok","Synced");
    renderToday(); renderChips();
    if(!$("tab-weight").classList.contains("hide")) renderWeight();
    if(!$("tab-train").classList.contains("hide"))  renderTrain();
    if(!$("tab-more").classList.contains("hide"))   showPane(curPane);
  }catch(err){
    setSync("err","Sync error");
    if(!quiet) toast(err.message.slice(0,90));
    console.warn("sync:", err);
  }finally{ syncing=false; }
}

function renderAuth(){
  const box = $("authBox");
  if(!hasSupabase){
    box.innerHTML = '<div class="hint">Cloud sync is not set up yet, so this device keeps its own copy. '+
      'Add your Supabase URL and key to <b>config.js</b> (SETUP.md step 2) to log on your phone and see it here.</div>';
    setSync("off","Local only"); return;
  }
  if(AUTH){
    box.innerHTML = '<div class="eqrow"><span>Signed in as</span><b>'+esc(AUTH.email)+'</b></div>'+
      '<div class="eqrow"><span>Last sync</span><b>'+(DB.meta.lastSync?new Date(DB.meta.lastSync).toLocaleString():"never")+'</b></div>'+
      '<div class="grid2" style="margin-top:12px">'+
      '<button class="btn ghost" id="btnSyncNow">Sync now</button>'+
      '<button class="btn ghost" id="btnSignOut">Sign out</button></div>'+
      '<div class="hint">Open this same address on your phone, sign in with the same email, and both devices stay in step.</div>';
    $("btnSyncNow").onclick = ()=>doSync(false);
    $("btnSignOut").onclick = ()=>{ saveAuth(null); setSync("off","Local only"); renderAuth(); toast("Signed out — your data stays on this device"); };
    return;
  }
  box.innerHTML =
    '<div class="field"><label>Email</label><input id="auEmail" type="email" autocomplete="email" inputmode="email"></div>'+
    '<div class="field" style="margin-top:10px"><label>Password</label><input id="auPass" type="password" autocomplete="current-password"></div>'+
    '<div class="grid2" style="margin-top:12px">'+
      '<button class="btn" id="btnSignIn">Sign in</button>'+
      '<button class="btn ghost" id="btnSignUp">Create account</button></div>'+
    '<div class="hint" id="auMsg">Use any email and a password of at least 6 characters. This is your own private database — nobody else has access.</div>';
  const go = async (which)=>{
    const email=$("auEmail").value.trim(), pw=$("auPass").value;
    if(!email||pw.length<6){ $("auMsg").textContent="Enter an email and a password of at least 6 characters."; return; }
    $("auMsg").innerHTML='<span class="spin"></span> working…';
    try{
      const j = which==="up"
        ? await sbAuth("signup",{email:email,password:pw})
        : await sbAuth("token?grant_type=password",{email:email,password:pw});
      storeSession(j); renderAuth(); await doSync(false); toast("Signed in");
    }catch(err){ $("auMsg").textContent = err.message; }
  };
  $("btnSignIn").onclick=()=>go("in");
  $("btnSignUp").onclick=()=>go("up");
}

/* ============================================================
   REMINDERS
   ============================================================ */
function renderRemind(){
  const box=$("remindBox"), s=DB.settings;
  if(!("Notification" in window)){
    box.innerHTML='<div class="hint">This browser can\'t show notifications. Set a daily alarm on your phone instead — it is more reliable anyway.</div>';
    return;
  }
  const perm = Notification.permission;
  box.innerHTML =
    '<div class="eqrow"><span>Daily logging reminder</span>'+
      '<b><input type="checkbox" id="rmOn" style="width:auto" '+(s.remindOn?"checked":"")+'></b></div>'+
    '<div class="field" style="margin-top:10px"><label>Remind me at</label><input id="rmTime" type="time" value="'+esc(s.remindTime)+'"></div>'+
    (perm==="denied"
      ? '<div class="hint warn">Notifications are blocked for this site. Allow them in your browser settings to use this.</div>'
      : '<button class="btn ghost sm" id="rmTest" style="margin-top:10px">Send a test notification</button>')+
    '<div class="hint">Worth knowing: a browser reminder only fires while the app is installed and running in the background. '+
      'If you want something that always goes off, set a repeating alarm in your phone\'s Clock app — this is a nudge, not a guarantee.</div>';

  $("rmOn").onchange = async e=>{
    if(e.target.checked && Notification.permission==="default"){
      const p = await Notification.requestPermission();
      if(p!=="granted"){ e.target.checked=false; renderRemind(); return; }
    }
    DB.settings.remindOn = e.target.checked; touchProfile(); renderRemind();
  };
  $("rmTime").onchange = e=>{ DB.settings.remindTime = e.target.value||"20:00"; touchProfile(); };
  if($("rmTest")) $("rmTest").onclick = async ()=>{
    if(Notification.permission!=="granted"){
      const p = await Notification.requestPermission();
      if(p!=="granted") return;
    }
    notify("Cut Tracker","This is what your reminder will look like.");
  };
}
function notify(title, body){
  try{
    if(navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(reg=>reg.showNotification(title,{body:body,icon:"./icons/icon-192.png",badge:"./icons/icon-192.png",tag:"cut-reminder"}))
        .catch(()=>new Notification(title,{body:body}));
    } else new Notification(title,{body:body});
  }catch(e){}
}
function checkReminder(){
  const s=DB.settings;
  if(!s.remindOn || !("Notification" in window) || Notification.permission!=="granted") return;
  const t=(s.remindTime||"20:00").split(":");
  const due=new Date(); due.setHours(+t[0]||20, +t[1]||0, 0, 0);
  if(now() < due.getTime()) return;
  if(DB.meta.notified === TODAY) return;
  if(day(TODAY).entries.length) return;      // already logged — no nagging
  DB.meta.notified = TODAY; save();
  notify("Nothing logged today", "Takes 30 seconds. Tap to open your tracker.");
}

/* ============================================================
   SETTINGS PANELS
   ============================================================ */
function fillSettings(){
  const s=DB.settings;
  $("sSex").value=s.sex; $("sAge").value=s.age;
  $("sFt").value=Math.floor(s.heightIn/12); $("sIn").value=Math.round(s.heightIn%12);
  $("sAct").value=String(s.act); $("sStart").value=s.start; $("sGoal").value=s.goal;
  $("sPace").value=String(s.pace); $("sProt").value=String(s.protPerLb); $("sFat").value=String(s.fatPct);
  renderCalc(); renderMyFoods(); renderSavedMeals(); renderAuth(); renderRemind(); renderSetupStatus();
  $("storageNote").textContent = memOnly
    ? "⚠ This browser is blocking local storage, so data lasts only until you close the tab. Download a backup before leaving."
    : "Saved in this browser." + (AUTH ? " Also backed up to your account." : " Download a backup now and then.");
}
function renderCalc(){
  const s=DB.settings;
  const rest = Math.max(baseBurn()-dailyDeficit(), calFloor());
  const prot = (+s.goal||180)*(+s.protPerLb||1);
  const fat  = rest*(+s.fatPct||0.25)/9;
  const carb = Math.max(0,(rest - prot*4 - fat*9)/4);
  const rows=[
    ["Resting metabolism (BMR)", r0(bmr())+" cal"],
    ["Base daily burn", r0(baseBurn())+" cal"],
    ["Target deficit", r0(dailyDeficit())+" cal/day"],
    ["Eat on a rest day", r0(rest)+" cal"],
    ["Protein / Carbs / Fat (rest day)", r0(prot)+"g / "+r0(carb)+"g / "+r0(fat)+"g"],
    ["Time to goal at this pace", r1((s.start-s.goal)/s.pace)+" weeks"]
  ];
  $("calcOut").innerHTML = rows.map(r=>'<div class="eqrow"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>').join("");
  const bare = baseBurn()-dailyDeficit();
  $("floorWarn").innerHTML = bare < calFloor()
    ? '⚠ This pace drops rest-day intake below '+calFloor()+' cal, so it is being held at that floor. Pick a slower pace, or plan on exercise to earn the extra calories.'
    : 'Exercise calories are added to that day\'s budget, so an active day lets you eat more and still hit the same deficit.';
}
function renderMyFoods(){
  if(!DB.custom.length){ $("myFoods").innerHTML='<div class="empty">No custom foods yet.</div>'; return; }
  $("myFoods").innerHTML = DB.custom.map((f,i)=>
    '<div class="entry"><div class="info"><div class="n">'+esc(f.n)+'</div>'+
    '<div class="m">'+esc(f.s)+' · '+r0(f.p)+'p '+r0(f.cb)+'c '+r0(f.f)+'f</div></div>'+
    '<div class="cal">'+r0(f.c)+'</div><button class="del" data-c="'+i+'">×</button></div>').join("");
  $("myFoods").querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{
    DB.custom.splice(+b.dataset.c,1); touchProfile(); renderMyFoods();
  });
}
function renderSavedMeals(){
  if(!DB.meals.length){ $("savedMeals").innerHTML='<div class="empty">On any logged day, tap "Save as meal" to reuse it later.</div>'; return; }
  $("savedMeals").innerHTML = DB.meals.map((m,i)=>
    '<div class="entry"><div class="info"><div class="n">'+esc(m.name)+'</div>'+
    '<div class="m">'+m.items.length+' items</div></div>'+
    '<div class="cal">'+r0(m.items.reduce((a,e)=>a+e.cal,0))+'</div>'+
    '<button class="del" data-m="'+i+'">×</button></div>').join("");
  $("savedMeals").querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{
    DB.meals.splice(+b.dataset.m,1); touchProfile(); renderSavedMeals();
  });
}
function renderSetupStatus(){
  const rows=[
    ["Installed as an app", window.matchMedia("(display-mode: standalone)").matches || navigator.standalone],
    ["Works offline", !!navigator.serviceWorker],
    ["Big food database (USDA)", hasUSDA],
    ["Cloud sync (Supabase)", hasSupabase && !!AUTH]
  ];
  $("setupStatus").innerHTML = rows.map(([n,ok])=>
    '<div class="eqrow"><span>'+n+'</span><b style="color:'+(ok?"var(--accent)":"var(--tx3)")+'">'+(ok?"✓ on":"not yet")+'</b></div>'
  ).join("") + '<div class="hint">Anything marked "not yet" is optional — the tracker works without it. SETUP.md has the steps.</div>';
}

/* ============================================================
   BACKUP / RESTORE
   ============================================================ */
function exportData(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download="cut-tracker-backup-"+TODAY+".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000); toast("Backup downloaded");
}
$("fileIn").onchange = e=>{
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const o=JSON.parse(rd.result);
      if(!o || typeof o!=="object" || !o.days) throw 0;
      DB.settings = Object.assign({}, DEFAULTS.settings, o.settings||{});
      DB.days = o.days||{}; DB.custom=o.custom||[]; DB.favs=o.favs||[]; DB.meals=o.meals||[];
      Object.keys(DB.days).forEach(k=>{ DB.days[k].updated = now(); });
      DB.meta.pupdated = now(); save(); scheduleSync();
      renderToday(); fillSettings(); toast("Backup restored");
    }catch(err){ toast("That file didn't look right"); }
  };
  rd.readAsText(f); e.target.value="";
};

/* ============================================================
   BANNERS — install prompt, storage warning
   ============================================================ */
let installEvt = null;
function banner(id, title, body, actionLabel, action){
  if(lsGet("dismiss_"+id)) return;
  const el = document.createElement("div");
  el.className = "banner";
  el.innerHTML = '<div style="flex:1"><b>'+title+'</b>'+body+
    (actionLabel?'<div><button class="btn sm" style="margin-top:9px">'+actionLabel+'</button></div>':'')+
    '</div><button class="x">✕</button>';
  el.querySelector(".x").onclick=()=>{ lsSet("dismiss_"+id,"1"); el.remove(); };
  if(actionLabel) el.querySelector(".btn").onclick=action;
  $("banners").appendChild(el);
}
window.addEventListener("beforeinstallprompt", e=>{
  e.preventDefault(); installEvt = e;
  banner("install","Install this as an app",
    "Get a real icon, its own window, and offline access.","Install",
    async ()=>{ installEvt.prompt(); await installEvt.userChoice; installEvt=null;
      document.querySelectorAll(".banner").forEach(b=>b.remove()); });
});
function iosTip(){
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const standalone = navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  if(isIOS && !standalone)
    banner("ios","Add this to your home screen",
      "Tap the Share button in Safari, then <b>Add to Home Screen</b>. It gets an icon and runs full screen like a normal app.");
}

/* ============================================================
   WIRING
   ============================================================ */
function switchTab(name){
  document.querySelectorAll(".tabbar button[data-tab]").forEach(x=>x.classList.toggle("on", x.dataset.tab===name));
  ["today","train","weight","more"].forEach(t=>$("tab-"+t).classList.toggle("hide", t!==name));
  if(name==="train")  renderTrain();
  if(name==="weight") renderWeight();
  if(name==="more")   showPane(curPane);
  window.scrollTo(0,0);
}
let curPane = "trends";
function showPane(which){
  curPane = which;
  document.querySelectorAll("[data-pane]").forEach(b=>b.classList.toggle("on", b.dataset.pane===which));
  $("tab-trends").classList.toggle("hide", which!=="trends");
  $("tab-settings").classList.toggle("hide", which!=="settings");
  if(which==="trends") renderTrends(); else fillSettings();
}
document.querySelectorAll("[data-pane]").forEach(b=>b.onclick=()=>showPane(b.dataset.pane));
document.querySelectorAll(".tabbar button[data-tab]").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$("tabAdd").onclick = ()=>{ if($("tab-today").classList.contains("hide")) switchTab("today"); openSheet(); };

$("prevDay").onclick = ()=>{ cur=shiftDay(cur,-1); renderToday(); };
$("nextDay").onclick = ()=>{ if(cur<TODAY){ cur=shiftDay(cur,1); renderToday(); } };
$("copyYest").onclick = copyYesterday;
$("saveMeal").onclick = saveDayAsMeal;

$("closeSheet").onclick = closeSheet;
$("closePick").onclick = closePick;
$("pickSheet").onclick = e=>{ if(e.target===$("pickSheet")) closePick(); };
$("addSheet").onclick = e=>{ if(e.target===$("addSheet")) closeSheet(); };
$("mealPick").onchange = e=>{ sheetMeal = e.target.value; };
$("search").addEventListener("input", doSearch);
$("usdaLbl").style.opacity = hasUSDA ? 1 : .35;
$("usdaLbl").title = hasUSDA ? "USDA search is on" : "Add a USDA key in config.js to turn this on";

$("showQuick").onclick  = ()=>{ $("quickForm").classList.toggle("hide"); $("customForm").classList.add("hide"); };
$("showCustom").onclick = ()=>{ $("customForm").classList.toggle("hide"); $("quickForm").classList.add("hide"); };
$("qAdd").onclick = ()=>{
  const c=parseFloat($("qCal").value);
  if(!(c>=0)){ toast("Enter calories"); return; }
  addEntry({ n:$("qName").value.trim()||"Quick add", s:"quick add", c:c,
    p:parseFloat($("qP").value)||0, cb:parseFloat($("qC").value)||0, f:parseFloat($("qF").value)||0 }, 1);
  ["qName","qCal","qP","qC","qF"].forEach(i=>$(i).value="");
  $("quickForm").classList.add("hide"); closeSheet();
};
$("cAdd").onclick = ()=>{
  const n=$("cName").value.trim(), c=parseFloat($("cCal").value);
  if(!n || !(c>=0)){ toast("Name and calories are required"); return; }
  DB.custom.unshift({ id:uid(), n:n, s:$("cServ").value.trim()||"1 serving", c:c,
    p:parseFloat($("cP").value)||0, cb:parseFloat($("cC").value)||0, f:parseFloat($("cF").value)||0 });
  touchProfile(); toast("Saved to my foods");
  ["cName","cServ","cCal","cP","cC","cF"].forEach(i=>$(i).value="");
  $("customForm").classList.add("hide");
};

$("burned").addEventListener("input", e=>{
  day(cur).burned = parseFloat(e.target.value)||0; touchDay(cur); renderHero(); renderMacros();
});
$("wSave").onclick = ()=>{
  const k = $("wDate").value || TODAY;
  if(saveWeighIn(k, parseFloat($("wVal").value))){
    $("wVal").value=""; toast("Saved for "+parseYmd(k).toLocaleDateString(undefined,{month:"short",day:"numeric"}));
  }
};
$("wVal").addEventListener("keydown", e=>{ if(e.key==="Enter") $("wSave").click(); });

const SETMAP={sSex:"sex",sAge:"age",sAct:"act",sStart:"start",sGoal:"goal",sPace:"pace",sProt:"protPerLb",sFat:"fatPct"};
Object.keys(SETMAP).forEach(id=>$(id).addEventListener("change",()=>{
  const v=$(id).value;
  DB.settings[SETMAP[id]] = (id==="sSex") ? v : parseFloat(v);
  touchProfile(); renderCalc(); renderToday();
}));
["sFt","sIn"].forEach(id=>$(id).addEventListener("change",()=>{
  DB.settings.heightIn = (parseFloat($("sFt").value)||0)*12 + (parseFloat($("sIn").value)||0);
  touchProfile(); renderCalc(); renderToday();
}));

$("btnExport").onclick = exportData;
$("btnImport").onclick = ()=>$("fileIn").click();
let armed=false;
$("btnReset").onclick = ()=>{
  const b=$("btnReset");
  if(!armed){ armed=true; b.textContent="Tap again to confirm — this erases everything";
    setTimeout(()=>{ armed=false; b.textContent="Erase all data"; },4000); return; }
  armed=false; b.textContent="Erase all data";
  DB = JSON.parse(JSON.stringify(DEFAULTS));
  Object.keys(DB.days).forEach(k=>delete DB.days[k]);
  save(); cur=TODAY; renderToday(); fillSettings(); toast("Data erased on this device");
};

$("plQuit").onclick  = ()=>{ if(P && P.done) saveSession(); else closePlayer(); };
$("plBack").onclick  = ()=>{ if(P && !P.done) prevStep(); };
$("plDone").onclick  = ()=>{ if(!P) return; if(P.done) saveSession(); else nextStep(); };
$("plPause").onclick = ()=>{
  if(!P) return;
  if(P.done){ closePlayer(); toast("Workout discarded"); return; }
  P.running = !P.running; paintPlayer();
};

$("syncPill").onclick = ()=>{ switchTab("more"); showPane("settings"); setTimeout(()=>$("authBox").scrollIntoView({behavior:"smooth",block:"center"}),120); };

window.addEventListener("online",  ()=>{ if(AUTH) doSync(true); else setSync(hasSupabase?"off":"off", hasSupabase?"Not signed in":"Local only"); });
window.addEventListener("offline", ()=>setSync("off","Offline"));
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden && AUTH) doSync(true); });

/* ============================================================
   BOOT
   ============================================================ */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  /* When a new version is published the old service worker keeps serving its cache,
     so the first reload still shows stale files. Watch for the new worker taking
     over and refresh once, automatically — no more double-reloading. */
  let hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", ()=>{
    if(!hadController){ hadController = true; return; }  // first ever install: adopt quietly
    if(refreshing) return;
    refreshing = true;
    toast("Updating to the latest version…");
    setTimeout(()=>location.reload(), 400);
  });
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("./sw.js").then(reg=>{
      reg.update();
      setInterval(()=>reg.update(), 30*60*1000);        // check twice an hour
      document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) reg.update(); });
    }).catch(()=>{});
  });
}

renderToday();
iosTip();
if(memOnly) banner("mem","Storage is blocked in this browser",
  "Your log will disappear when you close the tab. Try a different browser, or download a backup before you leave.");

if(hasSupabase && AUTH){ setSync("ok","Synced"); doSync(true); }
else if(hasSupabase){ setSync("off","Not signed in"); }
else setSync("off","Local only");

setInterval(checkReminder, 60000);
setTimeout(checkReminder, 4000);


/* ============================================================
   TRAINING — plan, schedule, guided session player
   ============================================================ */
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function plan(){
  if(!DB.plan) DB.plan = { days:[1,2,4,6], started:null };
  if(!Array.isArray(DB.plan.days) || !DB.plan.days.length) DB.plan.days=[1,2,4,6];
  return DB.plan;
}
function dayWorkouts(k){ const d=day(k); if(!Array.isArray(d.workouts)) d.workouts=[]; return d.workouts; }
function workoutCal(k){ return dayWorkouts(k).reduce((a,w)=>a+(w.cal||0),0); }
function exerciseCal(k){ return (day(k).burned||0) + workoutCal(k); }

function allWorkouts(){
  const out=[];
  Object.keys(DB.days).sort().forEach(k=>{
    (DB.days[k].workouts||[]).forEach(w=>out.push(Object.assign({date:k},w)));
  });
  return out;
}
function planCount(){ return allWorkouts().filter(w=>w.plan).length; }
function planWeek(){ return Math.min(8, Math.floor(planCount()/4) + 1); }
function planIdx(){ return planCount() % 4; }
function planDone(){ return planCount() >= 32; }

/* ---- turn a template into a concrete session ---- */
function buildSession(week, idx, variantKey, swaps){
  const type = WEEK_ORDER[idx];
  const T = SESSIONS[type];
  const phase = PHASE_OF_WEEK[Math.max(0,Math.min(7,week-1))];
  const level = LEVEL_OF_PHASE[phase];
  const rounds = T.rounds[phase];
  const rest = REST_OF_PHASE[phase];
  const V = variantOf(type, variantKey||"a");
  const SW = swaps || {};

  const pick = (slot, slotIndex) => {
    const id = SW[slotIndex] || slot.ex[level];
    const secs = slot.secs ? (slot.secs[level]||0) : 0;
    const reps = slot.reps ? (slot.reps[level]||0) : 0;
    return { id:id, ex:EX[id], secs:secs, reps:(secs>0?0:reps) };
  };

  const warm = WARMUP.map(s=>({ id:s.ex[level], ex:EX[s.ex[level]], secs:s.secs, reps:0 }));
  const main = V.main.map(pick);
  const cool = COOLDOWN.map(s=>({ id:s.ex[level], ex:EX[s.ex[level]], secs:s.secs, reps:0 }));

  /* flatten into the step list the player walks through */
  const steps = [];
  warm.forEach(x=>steps.push({kind:"work", phase:"Warm-up", x:x, secs:x.secs}));
  for(let r=1;r<=rounds;r++){
    main.forEach((x,j)=>{
      steps.push({kind:"work", phase:"Round "+r+" of "+rounds, x:x, secs:x.secs, reps:x.reps});
      const last = (r===rounds && j===main.length-1);
      if(!last) steps.push({kind:"rest", secs:rest, next:(j===main.length-1? main[0] : main[j+1])});
    });
  }
  steps.push({kind:"rest", secs:30, next:cool[0]});
  cool.forEach(x=>steps.push({kind:"work", phase:"Cool-down", x:x, secs:x.secs}));

  /* estimates — rep work is counted at roughly 3 seconds per rep */
  const kg = latestWeight()*0.45359237;
  let sec=0, cal=0;
  steps.forEach(s=>{
    const d = s.kind==="rest" ? s.secs : (s.secs>0 ? s.secs : s.reps*3);
    sec += d;
    cal += (s.kind==="rest" ? 1.5 : s.x.ex.met) * kg * (d/3600);
  });

  return { type:type, name:T.name, focus:T.focus, week:week, idx:idx, rounds:rounds,
           variant:V.key, variantLabel:V.label, counts:true,
           rest:rest, main:main, steps:steps, estMin:Math.round(sec/60), estCal:Math.round(cal) };
}

/* ============================================================
   TRAIN TAB
   ============================================================ */
function renderTrain(){
  syncSel();
  const wk = planWeek(), P2 = plan();
  const done = planDone();
  const sess = currentSession();
  const todayDone = dayWorkouts(TODAY).length > 0;
  const isTrainingDay = P2.days.indexOf(new Date().getDay()) >= 0;

  $("planHead").innerHTML = done
    ? '<div class="stat"><div class="v">Done</div><div class="k">8 weeks complete</div></div>'
    : '<div style="display:flex;align-items:baseline;justify-content:space-between">'+
        '<div><b style="font-size:17px">Week '+wk+'</b> <span style="color:var(--tx3)">of 8</span></div>'+
        '<div style="color:var(--tx3);font-size:13px">'+planCount()+' of 32 sessions</div></div>'+
      '<div class="bar" style="height:8px;margin-top:9px"><i style="width:'+(planCount()/32*100)+
        '%;background:linear-gradient(90deg,#22c55e,#4ade80)"></i></div>';

  const box = $("todaySession");
  if(todayDone){
    const list = dayWorkouts(TODAY);
    box.innerHTML = '<div class="card"><h2>Today</h2>'+
      list.map(w=>'<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'+
        '<div style="font-size:22px;color:var(--accent)">✓</div>'+
        '<div style="flex:1"><b>'+esc(w.name)+'</b>'+
        '<div style="font-size:12.5px;color:var(--tx3)">'+w.minutes+' min · '+r0(w.cal)+' cal'+
          (w.plan?'':' · extra')+'</div></div></div>').join("")+
      '<button class="btn ghost wide" id="startAnother" style="margin-top:6px">Do another session</button></div>';
    $("startAnother").onclick = ()=>{ resetSel(); openVersionPick(); };
  } else {
    const badge = sess.counts===false
      ? '<span class="pill" style="color:var(--tx3)">extra — doesn\'t move the plan</span>'
      : '<span class="pill" style="color:var(--accent);border-color:var(--accent-dim)">counts toward week '+wk+'</span>';
    box.innerHTML = '<div class="card">'+
      '<h2>'+(isTrainingDay ? "Today's session" : "Next session")+
        '<span class="act" id="changeSession">Change</span></h2>'+
      (isTrainingDay ? "" : '<div class="hint" style="margin:0 0 10px">Today is a rest day on your schedule. Start it anyway if you feel good.</div>')+
      '<div style="font-size:19px;font-weight:700;letter-spacing:-.02em">'+esc(sess.name)+'</div>'+
      '<div style="font-size:13px;color:var(--tx2);margin-top:2px">'+
        esc(sess.variantLabel && sess.variantLabel!=="Balanced" ? sess.variantLabel : sess.focus)+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'+
        '<span class="pill">'+sess.estMin+' min</span>'+
        '<span class="pill">'+sess.rounds+' rounds</span>'+
        '<span class="pill">~'+sess.estCal+' cal</span>'+badge+
      '</div>'+
      '<button class="btn wide" id="startSession" style="margin-top:14px;font-size:15px">Start workout</button>'+
      '</div>';
    $("startSession").onclick = ()=>openSession(currentSession());
    $("changeSession").onclick = openVersionPick;
  }

  /* the exercises in this session, each swappable */
  $("sessionPreview").innerHTML = todayDone ? "" :
    '<div class="card"><h2>Exercises <span class="act" id="openLib">Library</span></h2>'+
    sess.main.map((x,i)=>'<div class="entry"><div class="info"><div class="n">'+esc(x.ex.n)+'</div>'+
      '<div class="m">'+esc(x.ex.cue[0])+'</div></div>'+
      '<div class="cal">'+(x.secs>0 ? x.secs+"s" : x.reps+"×")+'</div>'+
      '<button class="star" data-swapi="'+i+'" title="Swap">⇄</button></div>').join("")+
    '<div class="hint">'+sess.rest+'s rest between exercises. Tap ⇄ to swap any exercise for another that trains the same thing — the session still counts.</div></div>';
  if(!todayDone){
    $("sessionPreview").querySelectorAll("[data-swapi]").forEach(b=>b.onclick=()=>openSwapPick(+b.dataset.swapi));
    $("openLib").onclick = openLibrary;
  }

  let strip = "";
  for(let i=6;i>=0;i--){
    const k = shiftDay(TODAY,-i), d = parseYmd(k);
    const trained = (DB.days[k]&&DB.days[k].workouts&&DB.days[k].workouts.length)>0;
    const scheduled = P2.days.indexOf(d.getDay())>=0;
    strip += '<div style="flex:1;text-align:center">'+
      '<div style="font-size:10.5px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">'+DOW[d.getDay()]+'</div>'+
      '<div style="margin-top:5px;height:30px;border-radius:8px;display:grid;place-items:center;font-size:14px;'+
        (trained ? 'background:var(--accent-dim);color:#04120a;font-weight:700'
                 : scheduled ? 'background:var(--panel2);color:var(--tx3);border:1px dashed var(--line)'
                             : 'background:transparent;color:var(--tx3)')+'">'+
        (trained?"✓":scheduled?"·":"")+'</div></div>';
  }
  $("weekStrip").innerHTML = strip;

  $("dayPicker").innerHTML = DOW.map((d,i)=>
    '<button class="chip" data-dow="'+i+'" style="'+(P2.days.indexOf(i)>=0
      ? 'background:var(--accent-dim);color:#04120a;border-color:var(--accent-dim);font-weight:600' : '')+'">'+d+'</button>').join("");
  $("dayPicker").querySelectorAll("[data-dow]").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.dow, at=P2.days.indexOf(i);
    if(at>=0){ if(P2.days.length>1) P2.days.splice(at,1); } else P2.days.push(i);
    P2.days.sort(); touchProfile(); renderTrain();
  });

  const mine = customList();
  $("myCustom").innerHTML = (mine.length
    ? mine.map((c,i)=>'<div class="entry"><div class="info"><div class="n">'+esc(c.name)+'</div>'+
        '<div class="m">'+c.items.length+' exercises · '+(c.rounds||3)+' rounds</div></div>'+
        '<button class="btn ghost sm" data-edit="'+i+'">Edit</button></div>').join("")
    : '<div class="empty">None yet.</div>')+
    '<button class="btn ghost wide" id="newCustom" style="margin-top:10px">Build a session</button>';
  $("myCustom").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openBuilder(customList()[+b.dataset.edit]));
  $("newCustom").onclick = ()=>openBuilder(null);

  const hist = allWorkouts().reverse().slice(0,12);
  $("workoutHistory").innerHTML = hist.length
    ? hist.map(w=>'<div class="entry"><div class="info"><div class="n">'+esc(w.name)+
        (w.plan?' <span style="color:var(--tx3);font-size:11px">wk '+w.week+'</span>':' <span style="color:var(--tx3);font-size:11px">extra</span>')+'</div>'+
        '<div class="m">'+parseYmd(w.date).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})+
        ' · '+w.minutes+' min</div></div>'+
        '<div class="cal">'+r0(w.cal)+'</div>'+
        '<button class="del" data-wdel="'+w.date+'|'+w.id+'">×</button></div>').join("")
    : '<div class="empty">No workouts logged yet.</div>';
  $("workoutHistory").querySelectorAll("[data-wdel]").forEach(b=>b.onclick=()=>{
    const [k,id] = b.dataset.wdel.split("|");
    const arr = dayWorkouts(k), at = arr.findIndex(w=>w.id===id);
    if(at>=0){ arr.splice(at,1); touchDay(k); renderTrain(); renderToday(); toast("Workout removed"); }
  });
}


/* ============================================================
   GUIDED PLAYER
   ============================================================ */
let P = null;   // {sess, i, left, up, running, tid, workSec, startedAt}
let wakeLock = null;

async function keepAwake(on){
  try{
    if(on && "wakeLock" in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    if(!on && wakeLock){ wakeLock.release(); wakeLock = null; }
  }catch(e){}
}
let audioCtx = null;
function beep(freq, ms){
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.type="sine";
    g.gain.setValueAtTime(0.14, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms/1000);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + ms/1000);
  }catch(e){}
}

function openSession(sess){
  P = { sess:sess, i:0, left:0, up:0, running:true, tid:null, workSec:0, done:false };
  $("player").classList.add("on");
  document.body.style.overflow="hidden";
  keepAwake(true);
  enterStep();
  P.tid = setInterval(tickPlayer, 1000);
}
function closePlayer(){
  if(P && P.tid) clearInterval(P.tid);
  P = null;
  $("player").classList.remove("on");
  document.body.style.overflow="";
  keepAwake(false);
}
function enterStep(){
  const s = P.sess.steps[P.i];
  if(!s){ finishSession(); return; }
  P.left = s.secs || 0;
  P.up = 0;
  paintPlayer();
}
function tickPlayer(){
  if(!P || !P.running || P.done) return;
  const s = P.sess.steps[P.i];
  if(!s) return;
  const timed = s.kind==="rest" || s.secs>0;
  if(timed){
    P.left--;
    if(s.kind!=="rest") P.workSec++;
    if(P.left===3||P.left===2||P.left===1) beep(660,90);
    if(P.left<=0){ beep(880,220); nextStep(); return; }
  } else {
    P.up++; P.workSec++;
  }
  paintPlayer();
}
function nextStep(){ P.i++; if(P.i >= P.sess.steps.length) finishSession(); else enterStep(); }
function prevStep(){ if(P.i>0){ P.i--; enterStep(); } }

function paintPlayer(){
  const s = P.sess.steps[P.i];
  if(!s) return;
  const total = P.sess.steps.length;
  const rest = s.kind==="rest";
  const timed = rest || s.secs>0;
  const secs = timed ? P.left : P.up;
  const dur  = timed ? (s.secs||1) : Math.max(P.up,1);
  const pct  = timed ? Math.max(0, Math.min(1, P.left/(s.secs||1))) : 1;

  $("plPhase").textContent = rest ? "Rest" : (s.phase||"");
  $("plStep").textContent  = (P.i+1)+" / "+total;
  $("plName").textContent  = rest ? "Rest" : s.x.ex.n;
  $("plBody").className    = "plbody" + (rest ? " resting" : "");

  const mm = Math.floor(Math.abs(secs)/60), ss = Math.abs(secs)%60;
  $("plTime").textContent = timed ? (mm>0 ? mm+":"+String(ss).padStart(2,"0") : String(Math.max(secs,0)))
                                  : (mm>0 ? mm+":"+String(ss).padStart(2,"0") : ss+"s");
  const C = 2*Math.PI*74;
  const arc = $("plArc");
  arc.setAttribute("stroke-dasharray", C);
  arc.setAttribute("stroke-dashoffset", C*(1-pct));
  arc.setAttribute("stroke", rest ? "#60a5fa" : "#4ade80");

  $("plSub").textContent = rest ? "" : (timed ? "hold / keep going" : s.reps+" reps — tap Done when finished");
  $("plCues").innerHTML = rest
    ? '<div style="text-align:center;color:var(--tx2);font-size:14px">Next: <b style="color:var(--tx)">'+esc(s.next?s.next.ex.n:"Finish")+'</b></div>'
    : s.x.ex.cue.map(c=>'<li>'+esc(c)+'</li>').join("");
  $("plCues").style.display = "block";

  const nxt = P.sess.steps[P.i+1];
  $("plNext").textContent = nxt ? ("Next: " + (nxt.kind==="rest" ? "rest" : nxt.x.ex.n)) : "Last one";
  $("plDone").textContent = timed ? "Skip" : "Done";
  $("plPause").textContent = P.running ? "Pause" : "Resume";
}

function finishSession(){
  if(P.tid) clearInterval(P.tid);
  P.done = true;
  const mins = Math.max(1, Math.round(P.workSec/60));
  const kg = latestWeight()*0.45359237;
  /* recompute from actual time spent working rather than the estimate */
  /* workSec counts working seconds only, so average the MET of the work steps only —
     folding rest periods into the rate would understate the burn. */
  const work = P.sess.steps.filter(s=>s.kind!=="rest");
  const avgMet = work.length ? work.reduce((a,s)=>a+s.x.ex.met,0)/work.length : 4;
  const restSec = Math.max(0, Math.round(P.workSec*0.55));   // rest actually taken, roughly
  const cal = Math.round(avgMet*kg*(P.workSec/3600) + 1.5*kg*(restSec/3600));
  P.result = { mins:mins, cal:cal };

  $("plPhase").textContent = "Complete";
  $("plStep").textContent  = "";
  $("plBody").className = "plbody finished";
  $("plName").textContent = "Session complete";
  $("plTime").textContent = "✓";
  $("plArc").setAttribute("stroke-dashoffset", 0);
  $("plArc").setAttribute("stroke", "#4ade80");
  $("plSub").textContent = P.sess.name;
  $("plCues").innerHTML =
    '<div class="grid2" style="margin-top:6px">'+
      '<div class="stat"><div class="v">'+mins+'</div><div class="k">minutes</div></div>'+
      '<div class="stat"><div class="v">'+cal+'</div><div class="k">calories</div></div>'+
    '</div>';
  $("plNext").textContent = "These calories get added to today's budget";
  $("plDone").textContent = "Save workout";
  $("plPause").textContent = "Discard";
  beep(880,150); setTimeout(()=>beep(1170,260),160);
}
function saveSession(){
  const w = {
    id: uid(), name: P.sess.name + (P.sess.variantLabel && P.sess.variantLabel!=="Balanced" ? " · "+P.sess.variantLabel : ""),
    type: P.sess.type, plan: P.sess.counts !== false,
    week: P.sess.week, idx: P.sess.idx,
    minutes: P.result.mins, cal: P.result.cal
  };
  dayWorkouts(TODAY).push(w);
  touchDay(TODAY);
  closePlayer();
  resetSel();
  renderTrain(); renderToday();
  toast(w.plan ? "Session done — "+w.cal+" cal added" : "Logged as an extra — "+w.cal+" cal added");
}


/* ============================================================
   CHOOSING WHAT TO TRAIN
   - alternate versions of each planned session (still count)
   - swapping individual exercises for same-muscle alternatives
   - building and saving your own sessions
   - browsing the whole exercise library
   ============================================================ */

let sel = { idx:-1, variant:"a", swaps:{}, custom:null };
function resetSel(){ sel = { idx:planIdx(), variant:"a", swaps:{}, custom:null }; }
function syncSel(){ if(sel.idx !== planIdx()){ resetSel(); } }

function variantsFor(type){ return (window.VARIANTS && VARIANTS[type]) || []; }
function variantOf(type, key){
  const list = variantsFor(type);
  return list.find(v=>v.key===key) || list[0] || { key:"a", label:"Balanced", main:SESSIONS[type].main };
}
function customList(){ if(!Array.isArray(DB.customWorkouts)) DB.customWorkouts=[]; return DB.customWorkouts; }

/* the session the Train tab is currently offering */
function currentSession(){
  syncSel();
  if(sel.custom) return buildCustomSession(sel.custom);
  return buildSession(planWeek(), planIdx(), sel.variant, sel.swaps);
}

function buildCustomSession(cw){
  const level = 1;
  const items = cw.items.filter(it=>EX[it.ex]);
  const main = items.map(it=>({ id:it.ex, ex:EX[it.ex], secs:it.secs||0, reps:it.secs?0:(it.reps||10) }));
  const warm = WARMUP.map(s=>({ id:s.ex[level], ex:EX[s.ex[level]], secs:s.secs, reps:0 }));
  const cool = COOLDOWN.map(s=>({ id:s.ex[level], ex:EX[s.ex[level]], secs:s.secs, reps:0 }));
  const rounds = cw.rounds||3, rest = cw.rest||45;

  const steps = [];
  warm.forEach(x=>steps.push({kind:"work", phase:"Warm-up", x:x, secs:x.secs}));
  for(let r=1;r<=rounds;r++){
    main.forEach((x,j)=>{
      steps.push({kind:"work", phase:"Round "+r+" of "+rounds, x:x, secs:x.secs, reps:x.reps});
      if(!(r===rounds && j===main.length-1)) steps.push({kind:"rest", secs:rest, next:(j===main.length-1?main[0]:main[j+1])});
    });
  }
  steps.push({kind:"rest", secs:30, next:cool[0]});
  cool.forEach(x=>steps.push({kind:"work", phase:"Cool-down", x:x, secs:x.secs}));

  const kg = latestWeight()*0.45359237;
  let sec=0, cal=0;
  steps.forEach(s=>{
    const d = s.kind==="rest" ? s.secs : (s.secs>0 ? s.secs : s.reps*3);
    sec += d; cal += (s.kind==="rest"?1.5:s.x.ex.met)*kg*(d/3600);
  });
  return { type:"custom", customId:cw.id, name:cw.name, focus:"Your own session", counts:false,
           week:planWeek(), idx:planIdx(), rounds:rounds, rest:rest, main:main, steps:steps,
           estMin:Math.round(sec/60), estCal:Math.round(cal) };
}

/* ---------- generic bottom sheet ---------- */
function openPick(title, html){
  $("pickTitle").textContent = title;
  $("pickBody").innerHTML = html;
  $("pickSheet").classList.add("on");
  document.body.style.overflow = "hidden";
}
function closePick(){
  $("pickSheet").classList.remove("on");
  document.body.style.overflow = "";
}

/* ---------- choose a version / another session ---------- */
function openVersionPick(){
  syncSel();
  const type = WEEK_ORDER[planIdx()];
  const planned = SESSIONS[type].name;
  const vs = variantsFor(type);

  let h = '<div class="hint" style="margin:0 0 12px">These all train the same thing as today\'s '+
          esc(planned)+', so any of them still counts toward week '+planWeek()+'.</div>';
  h += vs.map(v=>{
    const s = buildSession(planWeek(), planIdx(), v.key, {});
    return '<button class="pickrow'+(v.key===sel.variant&&!sel.custom?' on':'')+'" data-variant="'+v.key+'">'+
      '<div class="info"><div class="n">'+esc(v.label)+'</div><div class="m">'+esc(v.desc)+'</div></div>'+
      '<div class="meta">'+s.estMin+' min<br><span>'+s.estCal+' cal</span></div></button>';
  }).join("");

  h += '<h2 style="margin:20px 0 8px">Other sessions</h2>'+
       '<div class="hint" style="margin:0 0 10px">Different target, so these log their calories but don\'t move the plan forward.</div>';
  h += WEEK_ORDER.map((t,i)=> i===planIdx() ? "" : (function(){
        const s = buildSession(planWeek(), i, "a", {});
        return '<button class="pickrow" data-other="'+i+'">'+
          '<div class="info"><div class="n">'+esc(s.name)+'</div><div class="m">'+esc(s.focus)+'</div></div>'+
          '<div class="meta">'+s.estMin+' min<br><span>'+s.estCal+' cal</span></div></button>';
      })()).join("");

  const cw = customList();
  h += '<h2 style="margin:20px 0 8px">Your own sessions</h2>';
  h += cw.length ? cw.map((c,i)=>{
        const s = buildCustomSession(c);
        return '<button class="pickrow'+(sel.custom&&sel.custom.id===c.id?' on':'')+'" data-custom="'+i+'">'+
          '<div class="info"><div class="n">'+esc(c.name)+'</div><div class="m">'+c.items.length+' exercises · '+(c.rounds||3)+' rounds</div></div>'+
          '<div class="meta">'+s.estMin+' min<br><span>'+s.estCal+' cal</span></div></button>';
      }).join("") : '<div class="empty" style="padding:6px 0">None saved yet.</div>';
  h += '<button class="btn ghost wide" id="pickBuild" style="margin-top:12px">Build a new session</button>';

  openPick("Choose a workout", h);

  $("pickBody").querySelectorAll("[data-variant]").forEach(b=>b.onclick=()=>{
    sel.variant = b.dataset.variant; sel.custom = null; sel.swaps = {};
    closePick(); renderTrain();
  });
  $("pickBody").querySelectorAll("[data-other]").forEach(b=>b.onclick=()=>{
    sel.otherIdx = +b.dataset.other; sel.custom = null; sel.swaps = {}; sel.variant = "a";
    closePick();
    openSession(Object.assign(buildSession(planWeek(), sel.otherIdx, "a", {}), {counts:false}));
  });
  $("pickBody").querySelectorAll("[data-custom]").forEach(b=>b.onclick=()=>{
    sel.custom = customList()[+b.dataset.custom]; sel.swaps = {};
    closePick(); renderTrain();
  });
  $("pickBuild").onclick = ()=>openBuilder(null);
}

/* ---------- swap one exercise for a same-muscle alternative ---------- */
function openSwapPick(slotIndex){
  syncSel();
  const s = currentSession();
  const cur = s.main[slotIndex];
  if(!cur) return;
  const group = GROUP[cur.id];
  const options = Object.keys(EX).filter(id=>GROUP[id]===group);

  const h = '<div class="hint" style="margin:0 0 12px">Alternatives that train the same thing ('+
      esc(GROUP_LABEL[group]||group)+'), so the session still counts.</div>' +
    options.map(id=>'<button class="pickrow'+(id===cur.id?' on':'')+'" data-swap="'+id+'">'+
      '<div class="info"><div class="n">'+esc(EX[id].n)+'</div><div class="m">'+esc(EX[id].cue[0])+'</div></div>'+
      '<div class="meta">'+(id===cur.id?'current':'')+'</div></button>').join("") +
    (Object.keys(sel.swaps).length ? '<button class="btn ghost wide" id="swapReset" style="margin-top:12px">Undo all swaps</button>' : '');

  openPick("Swap "+cur.ex.n, h);
  $("pickBody").querySelectorAll("[data-swap]").forEach(b=>b.onclick=()=>{
    if(sel.custom){
      sel.custom.items[slotIndex].ex = b.dataset.swap;
      touchProfile();
    } else {
      sel.swaps[slotIndex] = b.dataset.swap;
    }
    closePick(); renderTrain();
  });
  if($("swapReset")) $("swapReset").onclick = ()=>{ sel.swaps={}; closePick(); renderTrain(); };
}

/* ---------- exercise library ---------- */
function openLibrary(){
  const h = '<input id="libSearch" placeholder="Search exercises…" autocomplete="off">'+
            '<div class="chips" style="margin-top:10px" id="libGroups"></div>'+
            '<div id="libList" style="margin-top:12px"></div>';
  openPick("Exercise library", h);
  let gFilter = "";
  const groups = ["lower","push","pull","core","cardio","mobility"];
  $("libGroups").innerHTML = '<button class="chip on" data-g="">All</button>' +
    groups.map(g=>'<button class="chip" data-g="'+g+'">'+esc(GROUP_LABEL[g])+'</button>').join("");
  const paint = ()=>{
    const q = ($("libSearch").value||"").toLowerCase();
    const ids = Object.keys(EX).filter(id=>(!gFilter||GROUP[id]===gFilter) && EX[id].n.toLowerCase().includes(q));
    $("libList").innerHTML = ids.length ? ids.map(id=>
      '<div class="card tight" style="margin-bottom:8px"><div style="font-weight:600;font-size:14.5px">'+esc(EX[id].n)+
      '<span style="float:right;font-weight:400;font-size:11.5px;color:var(--tx3)">'+esc(GROUP_LABEL[GROUP[id]])+'</span></div>'+
      '<ul style="margin:8px 0 0;padding-left:18px;color:var(--tx2);font-size:13px">'+
        EX[id].cue.map(c=>'<li>'+esc(c)+'</li>').join("")+'</ul></div>').join("")
      : '<div class="empty">Nothing matches.</div>';
  };
  $("libSearch").addEventListener("input", paint);
  $("libGroups").querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{
    gFilter = b.dataset.g;
    $("libGroups").querySelectorAll("[data-g]").forEach(x=>x.classList.toggle("on", x===b));
    paint();
  });
  paint();
}

/* ---------- build your own ---------- */
let draft = null;
function openBuilder(existing){
  draft = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id:uid(), name:"", rounds:3, rest:45, items:[] };
  const h =
    '<div class="row"><div class="field" style="flex:2"><label>Name</label>'+
      '<input id="bName" placeholder="Saturday circuit" value="'+esc(draft.name)+'"></div>'+
      '<div class="field"><label>Rounds</label><select id="bRounds">'+
        [1,2,3,4,5].map(n=>'<option value="'+n+'"'+(n===draft.rounds?' selected':'')+'>'+n+'</option>').join("")+
      '</select></div>'+
      '<div class="field"><label>Rest</label><select id="bRest">'+
        [30,40,45,60,75].map(n=>'<option value="'+n+'"'+(n===draft.rest?' selected':'')+'>'+n+'s</option>').join("")+
      '</select></div></div>'+
    '<h2 style="margin:16px 0 8px">Exercises <span id="bCount" style="font-weight:400;color:var(--tx3)"></span></h2>'+
    '<div id="bChosen"></div>'+
    '<h2 style="margin:16px 0 8px">Add exercises</h2>'+
    '<input id="bSearch" placeholder="Search…" autocomplete="off">'+
    '<div class="chips" style="margin-top:9px" id="bGroups"></div>'+
    '<div id="bPool" style="margin-top:10px;max-height:280px;overflow-y:auto"></div>'+
    '<button class="btn wide" id="bSave" style="margin-top:14px">Save session</button>'+
    (existing ? '<button class="btn ghost wide" id="bDelete" style="margin-top:8px;color:var(--warn)">Delete this session</button>' : '');

  openPick(existing ? "Edit session" : "Build a session", h);

  let gF = "";
  const groups = ["lower","push","pull","core","cardio"];
  $("bGroups").innerHTML = '<button class="chip on" data-bg="">All</button>' +
    groups.map(g=>'<button class="chip" data-bg="'+g+'">'+esc(GROUP_LABEL[g])+'</button>').join("");

  const paintChosen = ()=>{
    $("bCount").textContent = draft.items.length ? "("+draft.items.length+")" : "";
    $("bChosen").innerHTML = draft.items.length ? draft.items.map((it,i)=>
      '<div class="entry"><div class="info"><div class="n">'+esc(EX[it.ex].n)+'</div>'+
      '<div class="m">'+esc(GROUP_LABEL[GROUP[it.ex]])+'</div></div>'+
      '<select data-mode="'+i+'" style="width:78px;padding:6px">'+
        '<option value="reps"'+(it.secs?'':' selected')+'>reps</option>'+
        '<option value="secs"'+(it.secs?' selected':'')+'>secs</option></select>'+
      '<input type="number" inputmode="numeric" data-val="'+i+'" value="'+(it.secs||it.reps||10)+'" style="width:62px;text-align:center;padding:6px">'+
      '<button class="del" data-rm="'+i+'">×</button></div>').join("")
      : '<div class="empty" style="padding:8px 0">Add a few exercises below.</div>';

    $("bChosen").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{ draft.items.splice(+b.dataset.rm,1); paintChosen(); });
    $("bChosen").querySelectorAll("[data-mode]").forEach(sl=>sl.onchange=()=>{
      const i=+sl.dataset.mode, v=parseInt($("bChosen").querySelector('[data-val="'+i+'"]').value)||10;
      if(sl.value==="secs"){ draft.items[i].secs=v; draft.items[i].reps=0; }
      else { draft.items[i].reps=v; draft.items[i].secs=0; }
      paintChosen();
    });
    $("bChosen").querySelectorAll("[data-val]").forEach(inp=>inp.onchange=()=>{
      const i=+inp.dataset.val, v=Math.max(1, parseInt(inp.value)||10);
      if(draft.items[i].secs) draft.items[i].secs=v; else draft.items[i].reps=v;
    });
  };
  const paintPool = ()=>{
    const q=($("bSearch").value||"").toLowerCase();
    const ids = Object.keys(EX).filter(id=>GROUP[id]!=="mobility" && (!gF||GROUP[id]===gF) && EX[id].n.toLowerCase().includes(q));
    $("bPool").innerHTML = ids.map(id=>'<button class="pickrow" data-add="'+id+'">'+
      '<div class="info"><div class="n">'+esc(EX[id].n)+'</div><div class="m">'+esc(GROUP_LABEL[GROUP[id]])+'</div></div>'+
      '<div class="meta">＋</div></button>').join("") || '<div class="empty">Nothing matches.</div>';
    $("bPool").querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.add;
      draft.items.push(EX[id].mode==="time" ? {ex:id,secs:35,reps:0} : {ex:id,reps:12,secs:0});
      paintChosen();
    });
  };
  $("bSearch").addEventListener("input", paintPool);
  $("bGroups").querySelectorAll("[data-bg]").forEach(b=>b.onclick=()=>{
    gF=b.dataset.bg; $("bGroups").querySelectorAll("[data-bg]").forEach(x=>x.classList.toggle("on",x===b)); paintPool();
  });
  $("bRounds").onchange = e=>{ draft.rounds = +e.target.value; };
  $("bRest").onchange   = e=>{ draft.rest   = +e.target.value; };

  $("bSave").onclick = ()=>{
    draft.name = ($("bName").value||"").trim() || "My session";
    if(!draft.items.length){ toast("Add at least one exercise"); return; }
    const list = customList();
    const at = list.findIndex(c=>c.id===draft.id);
    if(at>=0) list[at] = draft; else list.unshift(draft);
    DB.customWorkouts = list.slice(0,20);
    touchProfile();
    sel.custom = draft; sel.swaps = {};
    closePick(); renderTrain(); toast("Saved — ready to start");
  };
  if($("bDelete")) $("bDelete").onclick = ()=>{
    const list = customList(), at = list.findIndex(c=>c.id===draft.id);
    if(at>=0) list.splice(at,1);
    if(sel.custom && sel.custom.id===draft.id) sel.custom = null;
    touchProfile(); closePick(); renderTrain(); toast("Session deleted");
  };

  paintChosen(); paintPool();
}

// expose a couple of internals for the test harness
window.__cut = { get DB(){return DB;}, save:save, renderToday:renderToday, renderTrends:renderTrends, renderWeight:renderWeight,
                 renderTrain:renderTrain, buildSession:buildSession, planWeek:planWeek, get P(){return P;},
                 currentSession:currentSession, openVersionPick:openVersionPick, openLibrary:openLibrary, openBuilder:openBuilder,
                 fillSettings:fillSettings, switchTab:switchTab, openSheet:openSheet, streak:streak,
                 macroTargets:macroTargets, baseBurn:baseBurn, deficitOn:deficitOn };
})();
