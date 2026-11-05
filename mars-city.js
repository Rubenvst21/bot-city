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
    const g=ctx.createLinearGradient(w*.1,0,w*.88,h);
    g.addColorStop(0,"#131e35");g.addColorStop(.29,"#233449");
    g.addColorStop(.6,"#60404a");g.addColorStop(1,"#b26c59");
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    const haze=ctx.createRadialGradient(w*.72,h*.3,12,w*.72,h*.3,w*.85);
    haze.addColorStop(0,"rgba(249,177,113,.23)");haze.addColorStop(1,"rgba(249,177,113,0)");
    ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
    // Low-poly Mars dunes and soft desert light.
    for(let band=0;band<4;band++){
      const y=h*(.18+band*.19),shift=band*21;
      ctx.beginPath();ctx.moveTo(-20,h);
      for(let x=-40;x<=w+50;x+=23){
        ctx.lineTo(x,y+Math.sin(x*.011+band*2.4)*22+Math.sin(x*.027+band)*8+shift);
      }
      ctx.lineTo(w+30,h);ctx.closePath();
      ctx.fillStyle=["rgba(146,81,85,.08)","rgba(176,92,75,.08)","rgba(221,130,91,.07)","rgba(255,173,109,.07)"][band];ctx.fill();
    }
    for(let i=0;i<60;i++){
      const x=seeded(i+11)*w,y=seeded(i+181)*h;
      const rr=4+seeded(i+321)*23;
      ctx.beginPath();ctx.ellipse(x,y,rr*1.65,rr*.46,-.17,0,Math.PI*2);
      ctx.fillStyle="rgba(13,35,55,.13)";ctx.fill();
      ctx.strokeStyle="rgba(255,184,143,.11)";ctx.lineWidth=1.4;ctx.stroke();
      if(i%5===0){ctx.beginPath();ctx.ellipse(x-2,y-2,rr*.73,rr*.16,-.17,Math.PI,Math.PI*2);ctx.strokeStyle="rgba(255,214,170,.10)";ctx.stroke();}
    }
    for(let i=0;i<34;i++){
      const x=seeded(i+59)*w,y=seeded(i+407)*h;
      ctx.fillStyle="rgba(255,225,192,"+(.15+seeded(i+201)*.28)+")";
      ctx.fillRect(x,y,1.5,1.5);
    }
    // The colony's shared illuminated boundary lattice.
    const center=cityProjection([0,0]);
    ctx.lineWidth=1;
    for(let ring=2;ring<=6;ring+=2){
      const r=ring*41*state.zoom;
      ctx.beginPath();ctx.ellipse(center.x,center.y,r*1.3,r*.68,0,0,Math.PI*2);
      ctx.strokeStyle="rgba(111,237,230,"+(.045+.025/ring)+")";ctx.setLineDash([3,12]);ctx.stroke();ctx.setLineDash([]);
    }
  }
  function cityProjection(p){
    const fit=state.width<550? Math.min(47,state.width/10.2):Math.min(71,state.width/17);
    const k=fit*state.zoom;
    const cx=state.width*.5+state.panX,cy=state.height*.545+state.panY;
    return {x:cx+(p[0]-p[1])*k*.86,y:cy+(p[0]+p[1])*k*.44,k};
  }
  function roadPath(points,k){
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
    ctx.lineWidth=Math.max(2,17*state.zoom);ctx.strokeStyle="rgba(19,26,36,.75)";ctx.lineCap="round";ctx.stroke();
    ctx.lineWidth=Math.max(1,3.2*state.zoom);ctx.strokeStyle="rgba(103,224,228,.58)";ctx.stroke();
    ctx.setLineDash([6*state.zoom,14*state.zoom]);ctx.lineWidth=Math.max(.6,1.1*state.zoom);ctx.strokeStyle="#e3c7a177";ctx.stroke();ctx.setLineDash([]);
  }
  function hexPoints(cx,cy,r){return [
    [cx,cy-r*.58],[cx+r*.86,cy-r*.29],[cx+r*.86,cy+r*.29],
    [cx,cy+r*.59],[cx-r*.86,cy+r*.29],[cx-r*.86,cy-r*.29]
  ];}
  function isoBox(cx,cy,w,h,depth,top,front,right,edge){
    const topFace=[[cx,cy-h],[cx+w,cy-h*.58],[cx,cy],[cx-w,cy-h*.58]];
    const leftFace=[[cx-w,cy-h*.58],[cx,cy],[cx,cy+depth],[cx-w,cy-h*.58+depth]];
    const rightFace=[[cx,cy],[cx+w,cy-h*.58],[cx+w,cy-h*.58+depth],[cx,cy+depth]];
    poly(leftFace,front);poly(rightFace,right);
    poly(topFace,top,edge||"rgba(204,252,255,.6)");
  }
  function miniatureScreen(cx,cy,color,size=1){
    isoBox(cx,cy,17*size,8*size,18*size,"#749bb0","#274a6a","#152e47","#a2edfc");
    const sx=cx-8*size,sy=cy+2*size;
    rrect(sx,sy,16*size,10*size,2*size,"#09253b","#589cb8");
    for(let i=0;i<3;i++)rrect(sx+3*size,sy+2*size+i*2.9*size,(10-i*2)*size,1.4*size,.7*size,i===1?color:"#72e0df");
  }
  function departmentProps(z,cx,cy,size,t,st){
    const s=size;
    const animated=!reducedMotion;
    const pulse=(animated?.5+.5*Math.sin(t*2):.6);
    const planned=st.mode==="planned";
    if(planned){
      // Role-specific blueprint buildings. Construction, not a claim of active automation.
      ctx.setLineDash([4*s,4*s]);
      poly([[cx,cy-28*s],[cx+38*s,cy-10*s],[cx,cy+4*s],[cx-38*s,cy-10*s]],alpha(z.color,.15),alpha(z.color,.68));
      ctx.setLineDash([]);
      isoBox(cx,cy-15*s,26*s,12*s,12*s,alpha(z.color,.38),"#29455c","#31546b",alpha(z.color,.95));
      // A color-coded modular gantry and construction scaffold.
      line(cx-28*s,cy-29*s,cx-28*s,cy-61*s,alpha(z.color,.95),2.5*s);
      line(cx-28*s,cy-61*s,cx+24*s,cy-61*s,alpha(z.color,.82),2*s);
      line(cx+23*s,cy-61*s,cx+23*s,cy-29*s,alpha(z.color,.68),1.5*s);
      line(cx-25*s,cy-59*s,cx+20*s,cy-31*s,"rgba(193,225,250,.22)",1*s);
      // A blueprint hologram reflects the department's purpose without a fake worker.
      ctx.beginPath();ctx.ellipse(cx,cy-38*s,18*s,11*s,0,0,Math.PI*2);
      ctx.fillStyle=alpha(z.color,.16);ctx.fill();ctx.strokeStyle=alpha(z.color,.65);ctx.lineWidth=1.2*s;ctx.stroke();
      text(z.icon,cx,cy-40*s,16*s,"#eaf6ff");
      for(let q=0;q<3;q++){
        const x=cx+(q-1)*14*s;
        rrect(x-5*s,cy-3*s,10*s,5*s,1*s,q%2?"#6b8095":alpha(z.color,.38));
      }
      return;
    }
    switch(z.id){
      case "creative":
      case "project-money-files":
        // Studio building: glowing editing monitor, film reel and upload dock.
        isoBox(cx,cy-17*s,31*s,21*s,25*s,"#b7a3e9","#5e4d8b","#46366c",z.color);
        miniatureScreen(cx+13*s,cy-34*s,"#fa97c9",.92*s);
        for(let i=0;i<2;i++){
          const ox=cx-24*s+i*11*s,oy=cy-47*s;
          ctx.beginPath();ctx.arc(ox,oy,5*s,0,Math.PI*2);
          ctx.fillStyle="#b78be6";ctx.fill();ctx.strokeStyle="#f9d9ff";ctx.lineWidth=1*s;ctx.stroke();
          ctx.fillStyle="#423366";
          for(let q=0;q<4;q++){ctx.beginPath();ctx.arc(ox+Math.cos(q*Math.PI/2)*2.4*s,oy+Math.sin(q*Math.PI/2)*2.4*s,1.25*s,0,Math.PI*2);ctx.fill();}
        }
        rrect(cx-11*s,cy+7*s,22*s,5*s,2*s,alpha("#eab2e9",pulse*.9));
        break;
      case "commerce":
      case "project-store-growth":
        // Golden fulfilment house, conveyor and real boxes on the ramp.
        isoBox(cx,cy-14*s,33*s,24*s,25*s,"#f7bf7a","#9c623d","#744934","#ffda97");
        rrect(cx-19*s,cy-20*s,14*s,8*s,2*s,"#174d63","#4e91ab");
        rrect(cx+5*s,cy-17*s,11*s,10*s,1*s,"#e9d5a6","#fff1c9");
        line(cx-25*s,cy+26*s,cx+28*s,cy+43*s,"#456779",6*s);
        for(let i=0;i<3;i++){
          const x=cx-12*s+i*13*s+ (animated?Math.sin(t*.9+i)*1.5*s:0);
          isoBox(x,cy+27*s,6*s,6*s,6*s,"#ffdea3","#c38e50","#a76a3d","#fff0b1");
        }
        break;
      case "quality":
        isoBox(cx,cy-16*s,34*s,24*s,19*s,"#7bdeda","#316d83","#28576e","#adfaff");
        // inspection arch and scanner beam
        for(const dx of [-22,22]){
          line(cx+dx*s,cy-9*s,cx+dx*s,cy-49*s,"#d5fbff",3.2*s);
        }
        line(cx-22*s,cy-49*s,cx+22*s,cy-49*s,"#d5fbff",4*s);
        rrect(cx-11*s,cy-30*s,22*s,9*s,3*s,alpha("#5bffee",pulse*.8));
        miniatureScreen(cx+24*s,cy-26*s,"#79ecd8",.65*s);
        break;
      case "finance":
        isoBox(cx,cy-13*s,33*s,23*s,25*s,"#6fdbc3","#28675d","#1a554d","#bbffe7");
        for(let i=0;i<4;i++){
          const hh=(13+i*8)*s*(1+(animated?.07*Math.sin(t+i):0));
          rrect(cx-20*s+i*11*s,cy-31*s-hh,6*s,hh,1*s,["#8af0c8","#56a9d3","#b3ed8a","#e4e7aa"][i]);
        }
        ctx.beginPath();ctx.arc(cx+22*s,cy-34*s,8*s,Math.PI,2*Math.PI);
        ctx.strokeStyle="#c3ffea";ctx.lineWidth=2*s;ctx.stroke();
        break;
      case "engineering":
        isoBox(cx,cy-15*s,34*s,25*s,22*s,"#9aafe9","#455c97","#304878","#c6d9ff");
        // robotic arm, gripping a part and a spinning gear.
        line(cx-12*s,cy-20*s,cx-1*s,cy-43*s,"#b2cefd",6*s);
        line(cx-1*s,cy-43*s,cx+18*s,cy-48*s+Math.sin(t*1.8)*2*s,"#8eecf2",5*s);
        ctx.beginPath();ctx.arc(cx+22*s,cy-47*s,10*s,0,Math.PI*2);
        ctx.fillStyle="#6b8dca";ctx.fill();ctx.strokeStyle="#e1f0ff";ctx.lineWidth=2*s;ctx.stroke();
        ctx.fillStyle="#dcf6ff";
        for(let q=0;q<7;q++){
          const angle=q*Math.PI*2/7+(animated?t*.38:0);
          const xx=cx+22*s+Math.cos(angle)*6.4*s,yy=cy-47*s+Math.sin(angle)*6.4*s;
          ctx.beginPath();ctx.arc(xx,yy,1.5*s,0,Math.PI*2);ctx.fill();
        }
        break;
      default:
        isoBox(cx,cy-16*s,32*s,20*s,22*s,"#94a8d4","#465b79","#364c70",z.color);
        miniatureScreen(cx+5*s,cy-34*s,z.color,.8*s);
        break;
    }
  }
  function building(p,z,st,t) {
    const s=clamp(state.zoom*.94,.48,1.6),cx=p.x,cy=p.y;
    const r=clamp(68*s,34,116),dep=clamp(16*s,9,28);
    const hex=hexPoints(cx,cy,r);
    // Soft terraformed plot shadow and chunky six-sided extrusion.
    ctx.beginPath();ctx.ellipse(cx,cy+dep+r*.34,r*.85,r*.26,0,0,Math.PI*2);
    ctx.fillStyle="rgba(8,17,35,.32)";ctx.fill();
    for(let i=0;i<6;i++){
      const j=(i+1)%6;
      if(i===0||i===5)continue;
      poly([hex[i],hex[j],[hex[j][0],hex[j][1]+dep],[hex[i][0],hex[i][1]+dep]],i<3?"#7a4146":"#9b5450");
    }
    poly(hex,st.mode==="planned"?alpha(z.color,.23):"#294a5b",alpha(z.color,.95));
    const inner=hexPoints(cx,cy,r*.88);
    poly(inner,st.mode==="planned"?alpha(z.color,.13):alpha(z.color,.20),alpha(z.color,.28));
    // Hex floor panels / work areas with unique department props.
    line(cx-r*.48,cy+r*.22,cx+r*.52,cy+r*.22,alpha(z.color,.26),1.1*s);
    line(cx-r*.18,cy-r*.3,cx-r*.18,cy+r*.35,alpha(z.color,.24),1.1*s);
    departmentProps(z,cx,cy,clamp(s,.45,1.24),t,st);
    const planned=st.mode==="planned";
    if(!planned){
      const walk=reducedMotion?0:Math.sin(t*.72+cx*.04);
      miniRobot(cx-r*.48+walk*9*s,cy+r*.28-4*s,z.color,.45*s,false);
      miniRobot(cx+r*.47-walk*6*s,cy+r*.23-4*s,z.color,.43*s,st.mode==="running");
      if(state.zoom>1.15)miniRobot(cx,cy+r*.5-5*s,z.color,.43*s,false);
    }else{
      // Two construction beacons rather than fake active workers.
      for (let k=0;k<2;k++){
        const bx=cx+(-1+2*k)*r*.62,by=cy+r*.17;
        rrect(bx-3*s,by-6*s,6*s,8*s,2*s,"#8d98b3","#d5e5fc");
        ctx.beginPath();ctx.arc(bx,by-8*s,2.5*s,0,Math.PI*2);ctx.fillStyle="#ffc482";ctx.fill();
      }
    }
    // Department icon floats over the factory and allows identification at overview scale.
    const tagSize=clamp(9*s,8,15);
    ctx.beginPath();ctx.arc(cx+r*.4,cy-r*.50,clamp(10*s,7,17),0,Math.PI*2);
    ctx.fillStyle="#163348";ctx.fill();ctx.strokeStyle=alpha(z.color,.9);ctx.lineWidth=1.5;ctx.stroke();
    text(z.icon,cx+r*.4,cy-r*.50,tagSize);
    // Name plates stay inside each plot; no sprawling overlapping badges.
    const short=state.zoom>=1.25||state.width>=760?z.name:(z.kind==="project"?"PROJECT":z.kind==="store"?"STORE":({creative:"STUDIO",commerce:"STORES",quality:"QUALITY",finance:"FINANCE",engineering:"ENGINEER"}[z.id]||"BOT"));
    const labelW=clamp(short.length*6.4+17,49,168);
    const labelY=cy+r*.59+dep*.4;
    rrect(cx-labelW/2,labelY-10,labelW,21,8,"rgba(13,31,47,.92)",alpha(z.color,.8));
    text(short,cx,labelY+1,clamp(8+state.zoom*1.4,9,12),"#f0fcff");
    state.tiles.push({id:z.id,x:cx,y:cy,w:Math.max(70,r*1.85),h:Math.max(60,r*1.5),r});
  }
  function miniRobot(x,y,color,s,working){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    // Friendly original colony robots; limbs bend when the scene is active.
    const wave=working&&!reducedMotion?Math.sin((performance.now()-state.start)*.0035):0;
    const stroke=Math.max(.8,1.5);
    ctx.fillStyle="rgba(8,32,50,.26)";
    ctx.beginPath();ctx.ellipse(0,28,16,4,0,0,Math.PI*2);ctx.fill();
    line(-7,14,-8-wave*2,24,"#93bace",4);
    line(7,14,8+wave*2,24,"#93bace",4);
    rrect(-13,-2,26,22,8,"#bce4f1","#f4ffff");
    rrect(-16,-27,32,28,11,"#effaff","#b6e1ef");
    rrect(-12,-21,24,16,7,"#123048");
    rrect(-9,-17,7,6,3,"#66f9f2");
    rrect(3,-17,7,6,3,"#66f9f2");
    rrect(-4,5,8,6,3,color);
    line(-13,5,-20,7-wave*10,"#aedcf1",4);
    line(13,5,20,-4-wave*12,"#aedcf1",4);
    rrect(-21,-3-wave*10,7,7,3,"#d5f2fc");
    rrect(17,-9-wave*12,7,7,3,"#d5f2fc");
    rrect(-18,-17,3,10,2,"#f5ca84");
    rrect(15,-17,3,10,2,"#f5ca84");
    ctx.restore();
  }
  function cityView(t){
    ground(t);
    const all=allPlots();
    const hq=cityProjection([0,0]);
    // A connected infrastructure lattice rather than spoke-only roads.
    const roadNodes=all.map(z=>cityProjection(z.pos));
    for(let i=0;i<all.length;i++){
      roadPath([hq,roadNodes[i]],Math.max(1,state.zoom));
      // Power lines join neighbouring tiles in a meaningful, slowly growing colony network.
      const nearest=roadNodes.map((p,j)=>({p,j,d:Math.hypot(p.x-roadNodes[i].x,p.y-roadNodes[i].y)}))
        .filter(x=>x.j!==i).sort((a,b)=>a.d-b.d)[0];
      if(nearest && nearest.d < Math.min(state.width*.48,215*state.zoom)){
        ctx.beginPath();ctx.moveTo(roadNodes[i].x,roadNodes[i].y);
        ctx.lineTo(nearest.p.x,nearest.p.y);
        ctx.strokeStyle="rgba(119,232,229,.2)";ctx.lineWidth=1.1;ctx.stroke();
      }
    }
    // Elevated HQ occupies its own hex plot, with a transparent command dome.
    const r=clamp(42*state.zoom,27,73);
    const hex=hexPoints(hq.x,hq.y,r);
    for(let i=1;i<5;i++){const j=(i+1)%6;poly([hex[i],hex[j],[hex[j][0],hex[j][1]+13*state.zoom],[hex[i][0],hex[i][1]+13*state.zoom]],"#43567c");}
    poly(hex,"#385778","#8bf2ee");
    ctx.beginPath();ctx.ellipse(hq.x,hq.y-12*state.zoom,r*.51,r*.39,0,Math.PI,2*Math.PI);
    ctx.fillStyle="rgba(51,155,183,.38)";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle="#96faff";ctx.stroke();
    miniRobot(hq.x,hq.y-9*state.zoom,"#9cf6eb",clamp(.58*state.zoom,.4,.8),false);
    text("HQ",hq.x,hq.y+r*.57,clamp(9+state.zoom*2,9,13),"#e7fffa","center","800");
    // Render the raised plots back-to-front.
    all.sort((a,b)=>(a.pos[0]+a.pos[1])-(b.pos[0]+b.pos[1]));
    state.tiles=[];
    all.forEach(z=>building(cityProjection(z.pos),z,zoneStatus(z),t));
    // Tiny cargo transport moves on a short path as a visual motif, NOT a verified order.
    if(!reducedMotion){
      const c=cityProjection([0,0]),target=cityProjection(zones[1].pos);
      const f=(t*.045)%1,mx=c.x+(target.x-c.x)*f,my=c.y+(target.y-c.y)*f;
      rrect(mx-6,my-4,12,8,2,"#ffd184","#fff3be");
      rrect(mx-3,my-6,6,3,1,"#9ae8e2");
    }
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
    const mobile=w<610;
    const inset=clamp(w*.06,14,54),top=mobile?clamp(h*.07,48,73):clamp(h*.11,68,110);
    // Big floor plate: one distinct plot/apartment.
    const floorX=inset,floorY=top,floorW=w-inset*2,floorH=h-top-(mobile?177:60);
    ctx.save();ctx.shadowColor=alpha(z.color,.24);ctx.shadowBlur=28;
    roundedPanel(floorX,floorY,floorW,floorH,"rgba(11,32,50,.95)",alpha(z.color,.68),22);
    ctx.restore();
    rrect(floorX+12,floorY+10,floorW-24,8,4,alpha(z.color,.4));
    text(z.icon+" "+z.name,w/2,floorY+44,clamp(16+w*.015,17,24),"#fff","center","800");
    text(st.label,w/2,floorY+73,11,st.mode==="planned"?"#b4cafa":"#b6f0e9");
    const gridW=floorW-28,gap=9,cols=w<610?1:3;
    const usableH=floorH-(mobile?115:139);
    const cardH=cols===1?clamp((usableH-18)/3,82,195):clamp(usableH*.77,166,300);
    const cardW=cols===1?gridW:(gridW-gap*(cols-1))/cols;
    state.tiles=[];
    z.tasks.forEach((task,i)=>{
      const x=floorX+14+(i%cols)*(cardW+gap);
      const y=floorY+(mobile?95:107)+Math.floor(i/cols)*(cardH+gap);
      renderStation(x,y,cardW,cardH,task,i,z.color,st.mode,t);
      state.tiles.push({id:"room-"+i,x:x+cardW*.5,y:y+cardH*.5,w:cardW,h:cardH,top:y,left:x});
    });
    if(!mobile)text(st.mode==="planned"?"Blueprint stage — no live automation verified":"Illustrative workers • actual bot status from GitHub",w/2,Math.min(h-40,floorY+floorH-19),10,"#b8cfdd");
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
    state.zoom=clamp(count>8?Math.min(1.2,width/385):Math.min(1.16,width/405),.53,1.45);
    state.panX=0;state.panY=0;
  }
  function setLevel(level,z=null,room=null){
    state.level=level;state.zone=z;state.room=room;state.panX=0;state.panY=0;root.dataset.level=level;
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
  classic.addEventListener("click",()=>{
    document.body.classList.remove("mars-mode");root.hidden=true;returnButton.hidden=false;
    // Classic view should open the interactive workfloor, even after visiting reports.
    const reportPanel=document.getElementById("controlRoom");
    if(reportPanel&&!reportPanel.hidden)document.getElementById("crToggle")?.click();
  });
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