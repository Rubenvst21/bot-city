/* Bot City miniature operations floor. Visual actions illustrate roles;
   ONLY recent GitHub status data can mark real work as active. No remote writes. */
(() => {
  "use strict";
  const floor = document.getElementById("workfloor");
  if (!floor) return;
  const zones = [
    {id:"creative",name:"Creative Studio",subtitle:"Video editing · Content",icon:"🎬",bots:["shorts","marketing"],task:"editing",color:"#ae83ff"},
    {id:"commerce",name:"Commerce & Stores",subtitle:"Products · Orders",icon:"📦",bots:["scout","builder","orders","supplier","catalog","pricing"],task:"packing",color:"#ffbf6c"},
    {id:"quality",name:"Operations & Quality",subtitle:"Reviews · Checks",icon:"🛡️",bots:["manager","quality"],task:"inspecting",color:"#74e5f5",central:true},
    {id:"finance",name:"Finance & Research",subtitle:"Analysis · Reports",icon:"📈",bots:["trading"],task:"charts",color:"#73d4bb"},
    {id:"engineering",name:"Engineering & DIY",subtitle:"Plans · Prototypes",icon:"⚙️",bots:["engineering"],task:"assembly",color:"#89adff"}
  ];
  const grid = document.getElementById("wfGrid");
  const counter = document.getElementById("wfCounter");
  const updated = document.getElementById("wfUpdated");
  const note = document.getElementById("wfNote");
  let lastData = null;
  const validDate = value => {
    const t = Date.parse(value || "");
    return Number.isFinite(t) ? t : 0;
  };
  const ago = value => {
    const t = validDate(value);
    if (!t) return "No reported run";
    return "Last run " + new Date(t).toLocaleDateString(undefined, {day:"numeric",month:"short",year:"numeric"});
  };
  function zoneState(z, bots) {
    const rows = z.bots.map(id => bots[id]).filter(Boolean);
    const active = rows.filter(b=> b.state !== "planned");
    if (!active.length) return {state:"planned",tag:"PLANNED",motion:"planned"};
    const now = Date.now(), recent = b => {
      const at = validDate(b.last_run || b.started);
      return at > 0 && now-at>=0 && now-at<48*3600*1000;
    };
    if (active.some(b=>b.state === "failed" && recent(b))) return {state:"problem",tag:"NEEDS REVIEW",motion:"stop"};
    if (active.some(b=>b.state === "running" && validDate(b.started) && now-validDate(b.started)<3*3600*1000)) return {state:"running",tag:"RUNNING NOW",motion:"running"};
    if (active.some(b=>b.state === "ok" && recent(b))) return {state:"recent",tag:"RECENT RUN",motion:"demo"};
    return {state:"stale",tag:"REPORT STALE",motion:"demo"};
  }
  function robot(motion,small=false) {
    const el=document.createElement("div");
    el.className="wf-robot"+(small?" wf-secondary":"");
    el.dataset.motion=motion;
    el.setAttribute("aria-hidden","true");
    el.innerHTML='<div class="wf-ear left"></div><div class="wf-ear right"></div><div class="wf-robot-head"><div class="wf-robot-face"><i class="wf-eye left"></i><i class="wf-eye right"></i></div></div><div class="wf-arm left"></div><div class="wf-arm right"></div><div class="wf-robot-torso"><div class="wf-core"></div></div><div class="wf-foot left"></div><div class="wf-foot right"></div>';
    return el;
  }
  function stage(z,motion) {
    const el=document.createElement("div");el.className="wf-station";
    const decor={
      editing:'<div class="wf-monitor"><div class="wf-timeline"></div><div class="wf-screen-line"></div></div><div class="wf-workbench"></div>',
      packing:'<div class="wf-monitor"><div class="wf-screen-bar"></div><div class="wf-screen-line"></div><div class="wf-screen-line"></div></div><div class="wf-pile"></div><div class="wf-belt"></div>',
      inspecting:'<div class="wf-monitor"><div class="wf-screen-bar"></div><div class="wf-screen-line"></div><div class="wf-screen-line"></div><div class="wf-screen-line"></div></div><div class="wf-workbench"></div><div class="wf-inspect"></div>',
      charts:'<div class="wf-bars"><i style="--height:27%"></i><i style="--height:46%"></i><i style="--height:33%"></i><i style="--height:68%"></i><i style="--height:88%"></i></div><div class="wf-workbench"></div>',
      assembly:'<div class="wf-monitor"><div class="wf-screen-bar"></div><div class="wf-screen-line"></div><div class="wf-screen-line"></div></div><div class="wf-workbench"></div><div class="wf-gear" aria-hidden="true">⚙</div>'
    };
    el.innerHTML=decor[z.task]+'<span class="wf-floor-strip" aria-hidden="true"></span>';
    el.append(robot(motion,false));
    if(z.id==="creative" || z.id==="commerce" || z.id==="engineering")el.append(robot(motion,true));
    el.setAttribute("aria-hidden","true");
    return el;
  }
  function buildZone(z,bots,idx) {
    const state=zoneState(z,bots), card=document.createElement("section");
    card.className="wf-dept"+(z.central?" wf-central":"");
    card.dataset.state=state.state;
    card.style.setProperty("--zone",z.color);
    const header=document.createElement("div");header.className="wf-dept-header";
    const icon=document.createElement("span");icon.className="wf-dept-icon";icon.textContent=z.icon;icon.setAttribute("aria-hidden","true");
    const names=document.createElement("div");names.className="wf-dept-headings";
    const name=document.createElement("h3");name.textContent=z.name;
    const subtitle=document.createElement("div");subtitle.className="wf-dept-sub";subtitle.textContent=z.subtitle;
    names.append(name,subtitle);
    const badge=document.createElement("span");badge.className="wf-status";badge.textContent=state.tag;
    header.append(icon,names,badge);
    const footer=document.createElement("div");footer.className="wf-dept-footer";
    const dates=z.bots.map(id=>bots[id]).filter(Boolean).map(b=>validDate(b.last_run)).filter(Boolean);
    const last=document.createElement("span");last.className="wf-last";
    last.textContent=dates.length?ago(new Date(Math.max(...dates)).toISOString()):"No live automation yet";
    const expand=document.createElement("button");expand.className="wf-info";expand.type="button";expand.textContent="See bots";expand.setAttribute("aria-expanded","false");
    const detail=document.createElement("div");detail.className="wf-details";detail.hidden=true;detail.id="wfDetails"+idx;expand.setAttribute("aria-controls",detail.id);
    const expl=document.createElement("p");expl.textContent=state.state==="running"
      ?"A recently started workflow is reporting as running. Open GitHub to inspect progress."
      :state.state==="planned"?"This department is a visual plan. No automated worker is operating here yet."
      :"These tiny worker animations illustrate department roles. They do not prove the bots are working at this moment.";
    detail.append(expl);
    const entries=z.bots.map(id=>({id,bot:bots[id]}));
    for (const {id,bot} of entries){
      const line=document.createElement("p");
      const label=bot?.name||id;
      line.textContent=(bot?.emoji||"🤖")+" "+label+": "+(bot?.state==="planned"?"planned":bot?.state==="ok"?"last run succeeded":bot?.state==="failed"?"last run failed":bot?.state==="running"?"reported running":"not reported")+".";
      detail.append(line);
    }
    const run=document.createElement("a");
    run.href="https://github.com/Rubenvst21/Bots/actions";
    run.target="_blank";run.rel="noopener noreferrer";run.textContent="View verified GitHub bot runs";
    detail.append(run);
    expand.addEventListener("click",()=>{detail.hidden=!detail.hidden;expand.setAttribute("aria-expanded",String(!detail.hidden));expand.textContent=detail.hidden?"See bots":"Close";});
    footer.append(last,expand);
    card.append(header,stage(z,state.motion),footer,detail);
    return {card,state};
  }
  function render(data) {
    lastData=data;
    const bots=data?.bots||{};
    const fragment=document.createDocumentFragment();
    let running=0,planned=0;
    zones.forEach((z,idx)=>{
      const {card,state}=buildZone(z,bots,idx);
      if(state.state==="running")running++;
      if(state.state==="planned")planned++;
      fragment.append(card);
    });
    grid.replaceChildren(fragment);
    counter.textContent=running+" running now";
    const dt=validDate(data?.updated);
    updated.textContent=dt?"Reports last updated "+new Date(dt).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"No verified report timestamp";
    note.textContent=planned+" departments have no operating bots. The animated mini-bots are illustrative; only a recent GitHub run indicates real activity.";
  }
  async function refresh() {
    try {
      const response=await fetch("data/status.json?t="+Date.now(),{cache:"no-store"});
      if(!response.ok)throw Error("Status unavailable");
      render(await response.json());
    } catch(e) {
      if (!lastData)render({bots:{}});
      updated.textContent="Reports unavailable";
      note.textContent="Showing illustrative department scenes only; current bot activity cannot be verified.";
    }
  }
  const dockTop=document.getElementById("wfHome");
  if(dockTop)dockTop.addEventListener("click",event=>{event.preventDefault();floor.scrollTo({top:0,behavior:"smooth"});});
  refresh();
  setInterval(refresh,120000);
})();
