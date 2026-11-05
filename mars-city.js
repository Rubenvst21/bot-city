/* Bot City v2 — Mars Colony. A lightweight interactive, isometric operations world.
 * It visualises planned/real status honestly, but simulated workers are decorative.
 * All data loads read-only from existing public JSON, never writes to stores/accounts.
 */
(() => {
  "use strict";
  const root=document.getElementById("marsCity");
  if(!root)return;
  const canvas=document.getElementById("marsCanvas"), ctx=canvas.getContext("2d");
  const screen=document.getElementById("marsScreen"), crumb=document.getElementById("marsBreadcrumb");
  const summary=document.getElementById("marsSummary"), detail=document.getElementById("marsDetail");
  const nav=document.getElementById("marsDistricts"), back=document.getElementById("marsBack");
  const zoomPlus=document.getElementById("marsZoomIn"),zoomMinus=document.getElementById("marsZoomOut");
  const classic=document.getElementById("marsClassic"),returnButton=document.getElementById("marsReturn");
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const zones=[
    {id:"creative",name:"Creative Studio",icon:"🎬",tag:"VIDEOS & CONTENT",color:"#ab83ef",pos:[-2.4,-1.2],bots:["shorts","marketing"],tasks:["Storyboard","Edit timeline","Private review"]},
    {id:"commerce",name:"Commerce & Stores",icon:"📦",tag:"PRODUCTS & ORDERS",color:"#f5bc67",pos:[2.3,-1.3],bots:["scout","builder","orders","supplier","catalog","pricing"],tasks:["Product Scout","Supplier checks","Order desk"]},
    {id:"quality",name:"Operations & Quality",icon:"🛡️",tag:"APPROVALS & CHECKS",color:"#6be5e5",pos:[0.2,2.2],bots:["manager","quality"],tasks:["Quality test","Approval desk","Run reports"]},
    {id:"finance",name:"Finance & Research",icon:"📈",tag:"INSIGHTS & COSTS",color:"#80e3ae",pos:[-2.2,2.6],bots:["trading"],tasks:["Costs & margins","Analytics","Paper trading"]},
    {id:"engineering",name:"Engineering & DIY",icon:"⚙️",tag:"PROTOTYPES & DESIGN",color:"#8eaefe",pos:[2.5,2.5],bots:["engineering"],tasks:["CAD plans","Prototype lab","Inspection bay"]}
  ];
  let stores=[],projects=[],bots={},reportTimestamp=0;
  const state={level:"city",zone:null,room:null,panX:0,panY:0,zoom:1,drag:null,lastX:0,lastY:0,tiles:[],width:0,height:0,dpr:1,start:performance.now()};
  const statusText={running:"RUNNING NOW",recent:"RECENT RUN",stale:"REPORT STALE",failed:"NEEDS REVIEW",planned:"PLANNED"};
  const rgb=(hex)=>{const h=hex.replace("#","");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
  const alpha=(hex,a)=>{const [r,g,b]=rgb(hex);return "rgba("+r+","+g+","+b+","+a+")";};
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const seeded=n=>{let x=Math.sin(n*77.339+9.2)*43758.5453;return x-Math.floor(x);};
  const freshness=raw=>{const d=Date.parse(raw||"");return Number.isFinite(d) && d<=Date.now() && Date.now()-d<48*3600*1000;};
  const freshRunning=raw=>{const d=Date.parse(raw||"");return Number.isFinite(d)&&d<=Date.now()&&Date.now()-d<3*3600*1000;};
  function zoneStatus(zone) {
    if(zone.kind==="store")return {mode:"planned",label:"FUTURE STORE"};
    if(zone.kind==="project"&&zone.projectStatus==="planned")return {mode:"planned",label:"PROJECT PLANNED"};
    const bb=zone.bots.map(id=>bots[id]).filter(Boolean);
    const actual=bb.filter(b=>b.state!=="planned");
    if(!actual.length)return {mode:"planned",label:"PLANNED"};
    if(actual.some(b=>b.state==="failed"&&freshness(b.last_run)))return {mode:"failed",label:"NEEDS REVIEW"};
    if(actual.some(b=>b.state==="running"&&freshRunning(b.started||b.last_run)))return {mode:"running",label:"RUNNING NOW"};
    if(actual.some(b=>b.state==="ok"&&freshness(b.last_run)))return {mode:"recent",label:"RECENT RUN"};
    return {mode:"stale",label:"REPORT STALE"};
  }
  function allPlots() {
    const next=stores.filter(s=>s.status!=="existing").map((s,i)=>{
      const slot=[[0,-4.2],[4.6,-0.1],[-4.5,0.0],[0,5.4],[4.8,4.7],[-5,4.7]][i%6];
      const radius=Math.floor(i/6);
      return {id:"store-"+s.id,name:s.name,icon:"🛒",tag:s.segment||"FUTURE STORE",color:"#7e93c4",kind:"store",pos:[slot[0]+radius*1.5,slot[1]+radius*1.2],bots:[],tasks:["Connect store","Review products","Launch after approval"]};
    });
    const extras=projects.map((project,i)=>{
      const slot=[[-3.6,-4.2],[3.7,-4.2],[-5.8,3.5],[5.8,3.5],[0,-6.6]][i%5];
      const ring=Math.floor(i/5);
      const color=project.color&&/^#[0-9a-f]{6}$/i.test(project.color)?project.color:"#7e93c4";
      return {id:"project-"+project.id,name:project.name,kind:"project",projectStatus:project.status,
        icon:"🧩",tag:project.tag||"PROJECT",color,
        pos:[slot[0]+ring*2.5,slot[1]-ring*2],bots:project.bots||[],
        tasks:Array.isArray(project.tasks)&&project.tasks.length>=3?project.tasks.slice(0,3):["Project plan","Workstation","Review gate"]};
    });
    const covered=new Set(zones.concat(extras).flatMap(z=>z.bots||[]));
    const newBots=Object.entries(bots).filter(([id])=>!covered.has(id)).map(([id,bot],i)=>({
      id:"extra-"+id,name:bot.name||id,icon:"🤖",tag:"NEW BOT PLOT",
      color:/^#[0-9a-f]{6}$/i.test(bot.color||"")?bot.color:"#91b5ed",
      pos:[6.8*Math.cos(i*1.4),6.8*Math.sin(i*1.4)],bots:[id],tasks:["Bot console","Activity review","Quality gate"]
    }));
    return zones.concat(next,extras,newBots);
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();
    state.width=Math.max(1,rect.width);state.height=Math.max(1,rect.height);
    state.dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(state.width*state.dpr);canvas.height=Math.round(state.height*state.dpr);
    ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
  }
  function rrect(x,y,w,h,r,color,stroke){
    ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2));
    if(color){ctx.fillStyle=color;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  }
  function poly(points,fill,stroke){
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  }
  function line(ax,ay,bx,by,color,width=2){
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
  }
  function text(txt,x,y,size=14,color="#fff",align="center",weight="600"){
    ctx.textAlign=align;ctx.textBaseline="middle";ctx.font=weight+" "+size+"px Inter, system-ui, sans-serif";
    ctx.fillStyle=color;ctx.fillText(txt,x,y);
  }
  function roundedPanel(x,y,w,h,fill="#152940",border="#426d83",r=15){rrect(x,y,w,h,r,fill,border);}
  function ground(t){
    const w=state.width,h=state.height;
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,"#071726");g.addColorStop(.3,"#102339");g.addColorStop(.68,"#3f2c35");g.addColorStop(1,"#915046");
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    // Distant Martian sunrise, low and subtle.
    const rad=ctx.createRadialGradient(w*.78,h*.2,3,w*.78,h*.2,w*.5);
    rad.addColorStop(0,"rgba(249,170,101,.24)");rad.addColorStop(1,"rgba(255,165,94,0)");
    ctx.fillStyle=rad;ctx.fillRect(0,0,w,h);
    for(let i=0;i<90;i++){
      let x=seeded(i+1)*w,y=seeded(i+178)*h;
      const size=2+seeded(i+33)*21;
      ctx.beginPath();ctx.ellipse(x,y,size*1.7,size*.57,-.2,0,Math.PI*2);
      ctx.strokeStyle="rgba(231,169,130,.08)";ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle="rgba(234,170,130,.025)";ctx.fill();
    }
    for(let i=0;i<55;i++){
      const x=seeded(i+59)*w,y=seeded(i+407)*h;
      ctx.fillStyle="rgba(255,244,235,"+(.12+seeded(i+59)*.22)+")";
      ctx.fillRect(x,y,1.5,1.5);
    }
  }
  function cityProjection(p){
    const fit=state.width<550? Math.min(47,state.width/10.2):Math.min(71,state.width/17);
    const k=fit*state.zoom;
    const cx=state.width*.5+state.panX,cy=state.height*.49+state.panY;
    return {x:cx+(p[0]-p[1])*k*.86,y:cy+(p[0]+p[1])*k*.44,k};
  }
  function roadPath(points,k){
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
    ctx.lineWidth=Math.max(2,17*state.zoom);ctx.strokeStyle="rgba(19,26,36,.75)";ctx.lineCap="round";ctx.stroke();
    ctx.lineWidth=Math.max(1,3.2*state.zoom);ctx.strokeStyle="rgba(103,224,228,.58)";ctx.stroke();
    ctx.setLineDash([6*state.zoom,14*state.zoom]);ctx.lineWidth=Math.max(.6,1.1*state.zoom);ctx.strokeStyle="#e3c7a177";ctx.stroke();ctx.setLineDash([]);
  }
  function building(p,z,st,t) {
    const s=Math.max(.5,state.zoom),cx=p.x,cy=p.y;
    const w=clamp(80*s,55,146),h=clamp(45*s,25,78),lift=clamp(27*s,17,53);
    // Soil plot and rim.
    poly([[cx,cy-h*.65],[cx+w*.75,cy],[cx,cy+h*.7],[cx-w*.75,cy]],"#603c40","#dc946c");
    poly([[cx,cy-h*.65+5],[cx+w*.75,cy+5],[cx,cy+h*.7+5],[cx-w*.75,cy+5]],"rgba(122,67,58,.33)");
    // Structural base walls.
    poly([[cx-w*.55,cy-6],[cx,cy+h*.37],[cx,cy+h*.37-lift],[cx-w*.55,cy-6-lift]],"#243d56");
    poly([[cx,cy+h*.37],[cx+w*.55,cy-6],[cx+w*.55,cy-6-lift],[cx,cy+h*.37-lift]],"#36516a");
    poly([[cx-w*.55,cy-6-lift],[cx,cy-h*.39-lift],[cx+w*.55,cy-6-lift],[cx,cy+h*.37-lift]],"#54768a",z.color);
    const baseY=cy-5-lift;
    // glass-dome/pods on top
    ctx.beginPath();ctx.ellipse(cx,baseY-2,w*.36,h*.45,0,Math.PI,2*Math.PI);
    ctx.fillStyle=st.mode==="planned"?"rgba(95,127,169,.25)":alpha(z.color,.28);ctx.fill();
    ctx.strokeStyle=st.mode==="planned"?"#8898ac":z.color;ctx.lineWidth=2;ctx.stroke();
    for(let q=-1;q<=1;q++) {
      const xx=cx+q*w*.2;
      line(xx,baseY-h*.25,xx,baseY+5,"rgba(192,224,239,.22)",1);
    }
    // Robot microworkers on plot.
    if(st.mode!=="planned")for(let i=0;i<2;i++){
      const bob=reducedMotion?0:Math.sin(t*1.2+i*1.3+p.x)*2;
      miniRobot(cx-18+i*34,cy+7+bob,z.color,clamp(.54*s,.48,.88),st.mode==="running");
    }
    else {
      ctx.setLineDash([3,3]);rrect(cx-w*.17,baseY-h*.25,w*.34,h*.35,3,"rgba(112,175,211,.13)","#bedcf366");ctx.setLineDash([]);
      text("✧",cx,baseY-h*.15,14,"#c5daed");
    }
    // On phones, don't cover small plots with overlapping name badges.
    // Full names remain available in the accessible district navigation.
    const labelY=cy+h*.65+Math.max(11,7*s);
    if(state.width>=680 || state.zoom>=1.17){
      const labelWidth=clamp(z.name.length*6.15+30,90,165);
      rrect(cx-labelWidth/2,labelY-12,labelWidth,24,12,"rgba(9,28,45,.94)",alpha(z.color,.65));
      text(z.name,cx,labelY,clamp(10+state.zoom*1.2,10,12),"#f3f8ff");
      const badge=st.mode==="running"?"● ACTIVE":st.mode==="recent"?"● RECENT":st.mode==="failed"?"! REVIEW":st.mode==="planned"?"◇ PLANNED":"◌ STALE";
      text(badge,cx,labelY+21,9,st.mode==="running"?"#6bf0c6":st.mode==="failed"?"#ffb4ba":"#c3d8e3");
    }else{
      // A subtle district marker reads better at small zoom levels.
      const shortName=z.kind==="store"?"STORE":z.kind==="project"?"PROJECT":z.id.toUpperCase().slice(0,7);
      const markerW=clamp(shortName.length*5+15,35,66);
      rrect(cx-markerW/2,labelY-8,markerW,17,8,"rgba(9,27,44,.82)",alpha(z.color,.48));
      text(shortName,cx,labelY,8,"#d6e7f0");
    }
    state.tiles.push({id:z.id,x:cx,y:cy,w:Math.max(80,w),h:90*s});
  }
  function miniRobot(x,y,color,s,working){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    rrect(-11,-3,22,21,7,"#b0d5e5","#effbff");
    rrect(-15,-28,30,24,10,"#e3f5fe","#edf9ff");
    rrect(-11,-22,22,14,5,"#10283a");
    rrect(-7,-18,5,5,3,"#75f6fa");rrect(2,-18,5,5,3,"#75f6fa");
    line(-8,17,-11,24,"#86aabc",4);line(8,17,11,24,"#86aabc",4);
    line(-11,3,-19,working?-12:12,"#9ac3d5",4);
    line(11,3,18,working?-11:10,"#9ac3d5",4);
    rrect(-4,5,8,5,3,color);
    ctx.restore();
  }
  function cityView(t) {
    ground(t);
    const all=allPlots();
    const hq=cityProjection([0,0]);
    // pathways connect plots like a living city.
    for(const z of all)roadPath([hq,cityProjection(z.pos)],Math.max(1,state.zoom));
    // main HQ circular hub
    const r=clamp(42*state.zoom,24,83);
    ctx.beginPath();ctx.ellipse(hq.x,hq.y+9,r*1.45,r*.65,0,0,Math.PI*2);ctx.fillStyle="#243a50";ctx.fill();ctx.lineWidth=3;ctx.strokeStyle="#77eff2";ctx.stroke();
    ctx.beginPath();ctx.arc(hq.x,hq.y-12,r*.48,Math.PI,Math.PI*2);ctx.fillStyle="#1c607d";ctx.fill();ctx.strokeStyle="#83f6ff";ctx.stroke();
    text("BOT",hq.x,hq.y-8,clamp(10*state.zoom,9,16),"#e8fdff","center","800");
    text("HQ",hq.x,hq.y+3,clamp(9*state.zoom,8,14),"#a2eceb");
    // ordered by depth so overlapping plots render sensibly
    all.sort((a,b)=>(a.pos[0]+a.pos[1])-(b.pos[0]+b.pos[1]));
    state.tiles=[];
    all.forEach(z=>building(cityProjection(z.pos),z,zoneStatus(z),t));
    const n=all.length;
    const growth=Math.max(0,n-5);
    roundedPanel(16,18,Math.min(258,state.width-32),52,"rgba(9,30,46,.87)","#426c74");
    text("MARS COLONY • SECTOR 01",30,35,11,"#93f8f2","left","800");
    text(n+" plots • "+growth+" expansion foundations",30,53,10,"#d6e4ed","left","500");
    text("Tap any plot to enter its department",state.width/2,state.height-45,11,"#deedf7");
  }
  function renderStation(x,y,w,h,task,idx,color,mode,t){
    const shaded=mode==="planned";
    roundedPanel(x,y,w,h,"rgba(16,42,64,.96)",alpha(color,.45),15);
    rrect(x+11,y+11,w-22,4,2,alpha(color,.6));
    const rx=x+Math.max(28,w*.23),ry=y+h*.64;
    miniRobot(rx,ry,color,clamp(w/155,.7,1.4),mode==="running");
    const mx=x+w*.5,my=y+h*.26,mw=w*.38,mh=h*.3;
    roundedPanel(mx,my,mw,mh,"#071c2c","#6ca0b5",5);
    for(let j=0;j<3;j++)rrect(mx+7,my+9+j*11,mw*.53+(j%2)*mw*.2,4,2,shaded?"#465f76":j%2?"#83e9d4":color);
    if(idx===1){for(let j=0;j<3;j++)rrect(x+w*.56+j*15,y+h*.69,19,13,2,"#b98b58","#e9bd7a");}
    if(idx===2){text("✓",mx+mw*.5,my+mh*.58,30,"#85f4c0");}
    rrect(x+9,y+h-40,w-18,29,9,"rgba(5,25,39,.86)");
    text(task,x+w/2,y+h-25,clamp(w/14,11,15),"#f1fbff","center","700");
  }
  function districtView(t){
    ground(t);
    const z=state.zone,st=zoneStatus(z);
    const w=state.width,h=state.height;
    const inset=clamp(w*.06,14,54),top=clamp(h*.11,68,110);
    // Big floor plate: one distinct plot/apartment.
    const floorX=inset,floorY=top,floorW=w-inset*2,floorH=h-top-60;
    ctx.save();ctx.shadowColor=alpha(z.color,.24);ctx.shadowBlur=28;
    roundedPanel(floorX,floorY,floorW,floorH,"rgba(11,32,50,.95)",alpha(z.color,.68),22);
    ctx.restore();
    rrect(floorX+12,floorY+10,floorW-24,8,4,alpha(z.color,.4));
    text(z.icon+" "+z.name,w/2,floorY+44,clamp(16+w*.015,17,24),"#fff","center","800");
    text(st.label,w/2,floorY+73,11,st.mode==="planned"?"#b4cafa":"#b6f0e9");
    const gridW=floorW-28,gap=9,cols=w<610?1:3;
    const usableH=floorH-139;
    const cardH=cols===1?clamp((usableH-20)/3,112,220):clamp(usableH*.77,166,300);
    const cardW=cols===1?gridW:(gridW-gap*(cols-1))/cols;
    state.tiles=[];
    z.tasks.forEach((task,i)=>{
      const x=floorX+14+(i%cols)*(cardW+gap);
      const y=floorY+107+Math.floor(i/cols)*(cardH+gap);
      renderStation(x,y,cardW,cardH,task,i,z.color,st.mode,t);
      state.tiles.push({id:"room-"+i,x:x+cardW*.5,y:y+cardH*.5,w:cardW,h:cardH,top:y,left:x});
    });
    text(st.mode==="planned"?"Blueprint stage — no live automation verified":"Illustrative workers • actual bot status from GitHub",w/2,Math.min(h-40,floorY+floorH-19),10,"#b8cfdd");
  }
  function roomView(t){
    ground(t);
    const z=state.zone,task=z.tasks[state.room],st=zoneStatus(z),w=state.width,h=state.height;
    const inset=Math.max(15,w*.065),top=Math.max(100,h*.13);
    roundedPanel(inset,top,w-inset*2,h-top-78,"rgba(12,35,54,.97)",alpha(z.color,.66),24);
    text(z.icon+" "+z.name,w/2,top+37,clamp(17+w*.013,17,25),"#f3fcff");
    text(task.toUpperCase(),w/2,top+66,13,"#b3f1f4");
    const size=clamp(w*.29,90,157),centerX=w*.36,centerY=top+(h-top)*.49;
    ctx.save();ctx.translate(centerX,centerY);ctx.scale(size/70,size/70);
    const headBob=reducedMotion?0:Math.sin(t*1.7)*1.1;
    miniRobot(0,headBob,z.color,2.35,st.mode==="running");
    ctx.restore();
    const screenX=Math.max(w*.54,centerX+size*.45),screenW=Math.max(90,w*.30);
    roundedPanel(screenX,top+132,Math.min(screenW,w-screenX-31),130,"rgba(15,45,67,.96)","#7dbfc4",12);
    text(st.label,screenX+Math.min(screenW,w-screenX-31)/2,top+157,11,st.mode==="planned"?"#b2c7f1":"#8feec8");
    for(let i=0;i<5;i++)rrect(screenX+11,top+176+i*15,Math.min(screenW,w-screenX-31)-22-(i%3)*13,6,3,i%2?alpha(z.color,.66):"#357e97");
    const note=z.bots.length?z.bots.map(id=>bots[id]?.name||id).slice(0,4).join(" · "):"No bot installed";
    const lines=note.match(/.{1,36}(?:\s|$)/g)||[note];
    lines.slice(0,3).forEach((ln,i)=>text(ln.trim(),w/2,h-142+i*18,12,"#cce5eb"));
    text("Workstation visualisation — not a live camera feed",w/2,h-62,10,"#b9cfd9");
  }
  function fit(){
    const width=state.width,height=state.height;
    const count=allPlots().length;
    state.zoom=clamp(count>8?Math.min(1.05,width/450):Math.min(1.16,width/405),.53,1.45);
    state.panX=0;state.panY=0;
  }
  function setLevel(level,z=null,room=null){
    state.level=level;state.zone=z;state.room=room;state.panX=0;state.panY=0;
    if(level==="city")fit();
    else state.zoom=1;
    const t=level==="city"?"Colony overview":level==="district"?z.name:z.tasks[room];
    screen.textContent=t;
    crumb.textContent=level==="city"?"Mars Colony / Sector 01":level==="district"?"Mars Colony / "+z.name:"Mars Colony / "+z.name+" / "+z.tasks[room];
    back.disabled=level==="city";
    back.textContent=level==="room"?"← Department":level==="district"?"← Colony":"Colony";
    detail.textContent=level==="city"?"Tap a plot to enter. Pinch to zoom, drag to explore. Planned plots are foundations, not operating businesses.":level==="district"?"Tap a workstation to zoom in. Small moving bots are role illustrations, not proof of automation.":"This is an illustrative workroom. Its real status is shown separately in the department summary.";
    if(level==="district"||level==="room"){
      const st=zoneStatus(z);
      summary.textContent=z.name+" · "+st.label;
    }else summary.textContent=allPlots().length+" mapped plots · expands as configured stores are added";
    renderNav();
    // Reduced-motion users still need an immediate redraw after every navigation.
    if(reducedMotion)requestAnimationFrame(render);
  }
  function renderNav(){
    nav.replaceChildren();
    if((state.level==="district"||state.level==="room")&&state.zone){
      state.zone.tasks.forEach((task,i)=>{
        const btn=document.createElement("button");btn.type="button";btn.dataset.room=String(i);
        btn.textContent="🚪 "+task;
        btn.setAttribute("aria-current",state.level==="room"&&state.room===i?"location":"false");
        btn.addEventListener("click",()=>setLevel("room",state.zone,i));
        nav.append(btn);
      });
      return;
    }
    for(const z of allPlots()){
      const btn=document.createElement("button");btn.type="button";btn.dataset.zone=z.id;
      btn.textContent=z.icon+" "+z.name;
      btn.addEventListener("click",()=>setLevel("district",z));
      nav.append(btn);
    }
  }
  function render(timestamp){
    const t=(timestamp-state.start)/1000,w=state.width,h=state.height;
    ctx.setTransform(state.dpr,0,0,state.dpr,0,0);ctx.clearRect(0,0,w,h);
    if(state.level==="city")cityView(t);
    else if(state.level==="district")districtView(t);
    else roomView(t);
    if(!reducedMotion)requestAnimationFrame(render);
  }
  const clickHit=(x,y)=>{
    if(state.level==="city"){
      const hit=state.tiles.slice().reverse().find(a=>Math.abs(x-a.x)<a.w*.65 && Math.abs(y-a.y)<a.h*.7);
      if(hit){const found=allPlots().find(z=>z.id===hit.id);if(found)setLevel("district",found);}
    }else if(state.level==="district"){
      const hit=state.tiles.find(a=>x>=a.left&&x<=a.left+a.w&&y>=a.top&&y<=a.top+a.h);
      if(hit)setLevel("room",state.zone,Number(hit.id.split("-")[1]));
    }
  };
  const pos=e=>{const rect=canvas.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top};};
  const pointerPositions=new Map();
  let pinchDistance=0,pinchCenter=null,ignoreClick=false;
  function redrawIfStatic(){if(reducedMotion)render(performance.now());}
  canvas.addEventListener("pointerdown",e=>{
    if(e.button!==0)return;
    const p=pos(e);
    pointerPositions.set(e.pointerId,p);
    try{canvas.setPointerCapture(e.pointerId);}catch(_){}
    if(pointerPositions.size===1){
      state.drag={x:p.x,y:p.y,last:p,at:performance.now(),moved:false};
      pinchDistance=0;pinchCenter=null;ignoreClick=false;
    } else if(pointerPositions.size===2) {
      const ps=[...pointerPositions.values()];
      pinchDistance=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y);
      pinchCenter={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};
      ignoreClick=true;
    }
  });
  canvas.addEventListener("pointermove",e=>{
    if(!pointerPositions.has(e.pointerId))return;
    const p=pos(e);
    pointerPositions.set(e.pointerId,p);
    if(state.level!=="city")return;
    if(pointerPositions.size===2){
      const ps=[...pointerPositions.values()];
      const dist=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y);
      const center={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};
      if(pinchDistance>5)state.zoom=clamp(state.zoom*dist/pinchDistance,.45,2.4);
      if(pinchCenter){state.panX+=center.x-pinchCenter.x;state.panY+=center.y-pinchCenter.y;}
      pinchDistance=dist;pinchCenter=center;
      if(state.drag)state.drag.moved=true;
      ignoreClick=true;redrawIfStatic();
    }else if(pointerPositions.size===1&&state.drag){
      const dx=p.x-state.drag.last.x,dy=p.y-state.drag.last.y;
      if(Math.hypot(p.x-state.drag.x,p.y-state.drag.y)>8)state.drag.moved=true;
      state.panX+=dx;state.panY+=dy;
      state.drag.last=p;
      redrawIfStatic();
    }
  });
  function finishPointer(e,wasCancelled=false){
    const p=pos(e);
    const click=state.drag&&!state.drag.moved&&!ignoreClick&&!wasCancelled&&pointerPositions.size===1;
    pointerPositions.delete(e.pointerId);
    if(click)clickHit(p.x,p.y);
    if(pointerPositions.size===0){state.drag=null;pinchDistance=0;pinchCenter=null;ignoreClick=false;}
    else if(pointerPositions.size===1){
      const next=[...pointerPositions.values()][0];
      state.drag={x:next.x,y:next.y,last:next,moved:true};
      pinchDistance=0;pinchCenter=null;ignoreClick=true;
    }
    redrawIfStatic();
  }
  canvas.addEventListener("pointerup",e=>finishPointer(e));
  canvas.addEventListener("pointercancel",e=>finishPointer(e,true));
  canvas.addEventListener("wheel",e=>{
    if(state.level!=="city")return;e.preventDefault();
    state.zoom=clamp(state.zoom*(e.deltaY<0?1.12:.88),.45,2.4);
    if(reducedMotion)render(performance.now());
  },{passive:false});
  zoomPlus.addEventListener("click",()=>{if(state.level!=="city"){setLevel("city");}state.zoom=clamp(state.zoom*1.24,.45,2.4);if(reducedMotion)render(performance.now());});
  zoomMinus.addEventListener("click",()=>{if(state.level!=="city"){setLevel("city");}state.zoom=clamp(state.zoom*.8,.45,2.4);if(reducedMotion)render(performance.now());});
  back.addEventListener("click",()=>{if(state.level==="room")setLevel("district",state.zone);else setLevel("city");if(reducedMotion)render(performance.now());});
  document.getElementById("marsHome").addEventListener("click",()=>setLevel("city"));
  classic.addEventListener("click",()=>{document.body.classList.remove("mars-mode");root.hidden=true;returnButton.hidden=false;});
  returnButton.addEventListener("click",()=>{root.hidden=false;returnButton.hidden=true;document.body.classList.add("mars-mode");resize();if(reducedMotion)requestAnimationFrame(render);});
  document.getElementById("marsReports").addEventListener("click",()=>{
    classic.click();
    const reports=document.getElementById("wfReports");
    if(reports)reports.click();
  });
  if(new URLSearchParams(location.search).has("smoke"))window.__marsDebug=()=>({level:state.level,tiles:state.tiles,zoom:state.zoom,pointer:state.drag,screen:screen.textContent});
  const load=async()=>{
    try{
      const [s,shops,expansion]=await Promise.all([
        fetch("data/status.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject("status")),
        fetch("data/stores.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject("stores")),
        fetch("data/colony.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{projects:[]}).catch(()=>({projects:[]}))
      ]);
      bots=s.bots||{};stores=Array.isArray(shops.stores)?shops.stores:[];
      projects=Array.isArray(expansion.projects)?expansion.projects:[];
      reportTimestamp=s.updated||0;
      document.getElementById("marsReportAge").textContent=reportTimestamp?"Bot reports: "+new Date(reportTimestamp).toLocaleDateString():"No bot report timestamp";
      renderNav();
      if(state.level==="city")fit();
      if(state.zone){
        const found=allPlots().find(p=>p.id===state.zone.id);
        if(found)state.zone=found;else setLevel("city");
      }
      setLevel(state.level,state.zone,state.room);
    }catch(e){
      document.getElementById("marsReportAge").textContent="Live reports unavailable";
      if(!bots||Object.keys(bots).length===0)bots={};
      renderNav();setLevel("city");
    }
  };
  document.body.classList.add("mars-mode");
  root.hidden=false;returnButton.hidden=true;
  window.addEventListener("resize",()=>{resize();if(reducedMotion)render(performance.now());});
  resize();fit();renderNav();setLevel("city");load();setInterval(load,120000);
  requestAnimationFrame(render);
})();