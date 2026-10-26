// Bot City: every bot is a tower. Height grows with its runs; the beam on top shows its state.
// Data comes from data/status.json, which the bots update after every run.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const REFRESH_MS = 2 * 60 * 1000;
const STATE_COLORS = { ok: "#3cff9e", failed: "#ff4d6d", running: "#ffc83d", planned: "#8a83b8", idle: "#8a83b8" };
const STATE_TEXT = {
  ok: "Working well",
  failed: "Last run failed",
  running: "Working right now…",
  planned: "Coming soon",
  idle: "Waiting for its first run",
};
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- renderer, camera, controls ----------

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#101629");
scene.fog = new THREE.FogExp2("#11172a", 0.0026);

const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 0.13;
controls.minDistance = 25;
controls.maxDistance = 320;
controls.maxPolarAngle = 1.38;
controls.target.set(0, 6, 0);

scene.add(new THREE.HemisphereLight("#d1e9ff", "#101122", 1.65));
const moon = new THREE.DirectionalLight("#fff0d9", 1.6);
moon.position.set(-40, 80, 30);
scene.add(moon);

// ---------- shared textures and materials ----------

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function windowTexture(random) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 64, 128);
  const tints = ["#ffd9a0", "#ffd9a0", "#ffe9c4", "#9fd0ff", "#ff9be0"];
  for (let y = 3; y < 128; y += 8) {
    for (let x = 2; x < 64; x += 8) {
      if (random() < 0.45) continue;
      g.globalAlpha = 0.45 + random() * 0.55;
      g.fillStyle = tints[Math.floor(random() * tints.length)];
      g.fillRect(x, y, 4, 5);
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

const GLOW = glowTexture();
const WINDOWS = windowTexture(seeded("windows"));
const ROOF = new THREE.MeshStandardMaterial({ color: "#120e2e", roughness: 0.9 });

function facadeMaterial(width, height) {
  const map = WINDOWS.clone();
  map.needsUpdate = true;
  map.repeat.set(width / 4, height / 8);
  return new THREE.MeshStandardMaterial({
    color: "#0d0a26", roughness: 0.75, metalness: 0.25, emissive: "#ffffff", emissiveMap: map, emissiveIntensity: 0.95,
  });
}

function glowSprite(color, size, opacity = 1) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

// Small seeded random generator so each district keeps the same layout between visits.
function seeded(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- the permanent landscape ----------

function buildGround() {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPos = world.xz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vPos;
      void main() {
        vec2 cell = vPos / 6.0;
        vec2 grid = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);
        float d = length(vPos);
        float fade = smoothstep(230.0, 30.0, d);
        float wave = 0.6 + 0.4 * sin(d * 0.08 - uTime * 0.8);
        vec3 base = mix(vec3(0.015, 0.01, 0.06), vec3(0.10, 0.05, 0.30), smoothstep(150.0, 0.0, d));
        vec3 color = base + line * vec3(0.38, 0.26, 1.0) * 0.6 * fade * wave;
        gl_FragColor = vec4(color, 1.0);
      }`,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(320, 96), material);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  return material;
}

function buildStars() {
  const random = seeded("stars");
  const positions = [];
  for (let i = 0; i < 900; i++) {
    const theta = random() * Math.PI * 2;
    const phi = random() * Math.PI * 0.45;
    const r = 420 + random() * 60;
    positions.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) + 20, r * Math.sin(phi) * Math.sin(theta));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: "#cfc6ff", size: 1.6, fog: false })));
}

function ring(radius, color, tube = 0.22) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 180), new THREE.MeshBasicMaterial({ color }));
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube * 5, 8, 180),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  for (const mesh of [core, halo]) {
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
  }
  group.position.y = 0.3;
  scene.add(group);
  return group;
}


/* Miniature workplace kit. Low-polygon shapes make a real, explorable
   Three.js city on phones without image downloads or new paid services. */
const MAT = {
  stone: new THREE.MeshStandardMaterial({color:"#303d58",roughness:.86}),
  wall: new THREE.MeshStandardMaterial({color:"#6a7994",roughness:.72}),
  wallLight: new THREE.MeshStandardMaterial({color:"#a2b5ce",roughness:.7}),
  trim: new THREE.MeshStandardMaterial({color:"#19263f",metalness:.35,roughness:.48}),
  glass: new THREE.MeshStandardMaterial({color:"#65ccf0",metalness:.3,roughness:.2,emissive:"#104f73",emissiveIntensity:.5}),
  pavement: new THREE.MeshStandardMaterial({color:"#1c263e",roughness:.88}),
  foliage: new THREE.MeshStandardMaterial({color:"#4b8b6e",roughness:.95}),
  foliageLight: new THREE.MeshStandardMaterial({color:"#82ad75",roughness:.95}),
  robot: new THREE.MeshStandardMaterial({color:"#e0eaf1",roughness:.42,metalness:.16}),
  face: new THREE.MeshStandardMaterial({color:"#112b48",roughness:.22,metalness:.3}),
  gold: new THREE.MeshStandardMaterial({color:"#ffcc7e",emissive:"#77501f",emissiveIntensity:.5}),
  cyan: new THREE.MeshStandardMaterial({color:"#51e8ed",emissive:"#33a4b8",emissiveIntensity:.7}),
};
function cube(parent,mat,w,h,d,x,y,z) {
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  o.position.set(x,y,z); parent.add(o); return o;
}
function ball(parent,mat,r,x,y,z,segments=12){
  const o=new THREE.Mesh(new THREE.SphereGeometry(r,segments,8),mat);
  o.position.set(x,y,z); parent.add(o); return o;
}
function upright(parent,mat,r,height,x,y,z){
  const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,height,10),mat);
  o.position.set(x,y,z);parent.add(o);return o;
}
function neon(parent,color,x,y,z,w,d=.23){
  const material=new THREE.MeshBasicMaterial({color});
  return cube(parent,material,w,.11,d,x,y,z);
}
function tinyRobot(parent,x,z,scale=.8,twist=0) {
  const bot=new THREE.Group(); bot.position.set(x,.7,z);bot.rotation.y=twist;bot.scale.setScalar(scale);
  cube(bot,MAT.robot,1.25,1,1.05,0,1.15,0);
  cube(bot,MAT.face,1.08,.47,.1,0,1.3,.56);
  ball(bot,MAT.cyan,.11,-.28,1.32,.65);
  ball(bot,MAT.cyan,.11,.28,1.32,.65);
  cube(bot,MAT.robot,.3,.65,.3,-.45,.33,0);
  cube(bot,MAT.robot,.3,.65,.3,.45,.33,0);
  cube(bot,MAT.robot,.28,.65,.3,-.8,1,0);
  cube(bot,MAT.robot,.28,.65,.3,.8,1,0);
  upright(bot,MAT.gold,.065,.4,0,1.9,0);
  ball(bot,MAT.cyan,.13,0,2.15,0);
  parent.add(bot);return bot;
}
function tinyTree(parent,x,z,s=1){
  const tree=new THREE.Group();tree.position.set(x,.7,z);tree.scale.setScalar(s);
  upright(tree,MAT.trim,.17,1.6,0,.8,0);
  const top=new THREE.Mesh(new THREE.IcosahedronGeometry(1.1,0),MAT.foliage);
  top.position.y=2;tree.add(top);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.68,0),MAT.foliageLight);
  crown.position.set(.35,2.4,.15);tree.add(crown);
  parent.add(tree);
}
function miniPlatform(group,color){
  const p=new THREE.Mesh(new THREE.CylinderGeometry(12,12.2,1.25,6),MAT.pavement);
  p.rotation.y=Math.PI/6;p.position.y=.5;group.add(p);
  const border=new THREE.LineSegments(new THREE.EdgesGeometry(p.geometry),new THREE.LineBasicMaterial({color}));
  border.position.copy(p.position);border.rotation.copy(p.rotation);group.add(border);
  const inlay=new THREE.Mesh(new THREE.CylinderGeometry(10.7,10.7,.16,6),
    new THREE.MeshStandardMaterial({color:"#34415a",roughness:.88}));
  inlay.rotation.y=Math.PI/6;inlay.position.y=1.15;group.add(inlay);
}
function studioBuilding(group){
  cube(group,MAT.wallLight,11,6,8,0,4.25,0);
  cube(group,MAT.trim,12,1,9,0,7.8,0);
  cube(group,MAT.face,6,4.3,.28,0,4.8,4.1);
  cube(group,new THREE.MeshBasicMaterial({color:"#f66ca5"}),3.7,2.8,.1,0,4.9,4.3);
  // Universal play symbol, visible from a mobile overview.
  const play=new THREE.Mesh(new THREE.ConeGeometry(.88,.95,3),MAT.robot);
  play.rotation.z=-Math.PI/2;play.position.set(.12,4.95,4.49);group.add(play);
  for(const x of [-4.7,4.7]){
    upright(group,MAT.trim,.14,5,x,4,5.7);
    cube(group,MAT.trim,1,.7,.6,x,6.65,5.7);
    ball(group,MAT.gold,.25,x,7.1,5.7);
  }
}
function shopBuilding(group){
  cube(group,MAT.wallLight,10,7.2,8,0,4.8,0);
  cube(group,MAT.trim,11,1,9,0,8.9,0);
  cube(group,MAT.glass,7,4,.25,0,4.3,4.15);
  neon(group,"#ffca7c",0,7.9,4.25,7);
  for(const x of [-3.5,0,3.5])cube(group,MAT.trim,.35,4,.45,x,4.3,4.34);
  cube(group,MAT.gold,3,1.3,1,0,2.3,5.3);
  for(const x of [-3,0,3])cube(group,MAT.stone,1.9,1.7,2,x,2,7.1);
}
function builderBuilding(group){
  cube(group,MAT.wall,9,5,8,0,3.75,0);
  cube(group,MAT.wallLight,7,3.7,6,-.5,8.1,-.5);
  cube(group,MAT.trim,8.2,.5,7.1,-.5,10.25,-.5);
  // Distinctive yellow construction crane.
  upright(group,MAT.gold,.28,12,4.1,8,-3.2);
  cube(group,MAT.gold,11,.35,.46,.35,14,-3.2);
  for(let x=-4;x<4;x+=2)cube(group,MAT.gold,.13,.12,1.1,x,14,-3.2);
  cube(group,MAT.trim,.1,5,.12,-4.5,11.6,-3.2);
  cube(group,MAT.gold,1.8,1.3,1.7,-4.5,8.45,-3.2);
  cube(group,MAT.glass,3.6,2.4,.2,0,7.4,2.65);
}
function scoutBuilding(group){
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(5.4,6.1,4.7,10),MAT.wallLight);
  hub.position.y=3.7;group.add(hub);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(4,20,10,0,Math.PI*2,0,Math.PI/2),MAT.glass);
  cap.position.y=6.1;group.add(cap);
  ball(group,MAT.cyan,1.4,0,7.4,0,14);
  for(const x of [-5.2,5.2]){
    cube(group,MAT.trim,2.3,3,.25,x,4.9,1);
    cube(group,MAT.glass,2,2.5,.15,x,4.9,1.2);
  }
}
function financeBuilding(group){
  cube(group,MAT.wallLight,10,6.5,8,0,4.6,0);
  cube(group,MAT.trim,11,.8,9,0,8.5,0);
  cube(group,MAT.face,7.8,4,.24,0,5.45,4.15);
  const bars=[1.1,2.5,1.9,3.3];
  bars.forEach((h,i)=>cube(group,MAT.cyan,.9,h,.16,-2.8+i*1.75,4.2+h*.5,4.35));
  neon(group,"#6bf5a6",0,2.7,4.3,7.2);
}
function makeWorkplace(group,id) {
  if(id==="shorts")studioBuilding(group);
  else if(id==="scout")scoutBuilding(group);
  else if(id==="builder")builderBuilding(group);
  else if(id==="orders")shopBuilding(group);
  else if(id==="trading")financeBuilding(group);
  else shopBuilding(group);
}
function buildHQ(){
  const group=new THREE.Group();
  miniPlatform(group,"#50e3ff");
  const base=new THREE.Mesh(new THREE.CylinderGeometry(6.5,7.3,6.1,10),MAT.wallLight);
  base.position.y=4.25;group.add(base);
  const led=new THREE.Mesh(new THREE.TorusGeometry(5.7,.18,6,48),MAT.cyan);
  led.rotation.x=Math.PI/2;led.position.y=7.4;group.add(led);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(3.5,24,14,0,Math.PI*2,0,Math.PI/2),MAT.glass);
  dome.position.y=7.5;group.add(dome);
  ball(group,MAT.cyan,1.15,0,8.9,0);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    cube(group,MAT.trim,1.35,3,.7,5.7*Math.cos(a),3.6,5.7*Math.sin(a));
  }
  tinyRobot(group,-7.5,3.9,.75,.2);
  tinyRobot(group,7.4,3,.75,-.5);
  tinyTree(group,-7,-5,.8);
  tinyTree(group,6.5,-6,.8);
  scene.add(group);
  return {group,top:new THREE.Vector3(0,11,0)};
}

const groundMaterial = buildGround();
buildStars();
ring(13.5, "#5ad1ff");
const hq = buildHQ();

// ---------- districts: one per bot ----------

let districts = [];
const world = new THREE.Group();
scene.add(world);
let outerRing = null;

function towerHeight(bot) {
  if (bot.state === "planned") return 9;
  return Math.min(40, 11 + 4 * Math.log2(1 + (bot.runs || 0)));
}

function buildDistrict(id, bot, angle, radius) {
  const random = seeded(id);
  const color = new THREE.Color(bot.color || "#8a7dff");
  const state = bot.state || "idle";
  const planned = state === "planned";
  const group = new THREE.Group();
  group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  group.rotation.y = -angle + Math.PI / 2;

  // Hexagonal platform with a neon rim in the bot's colour.
  const platformGeometry = new THREE.CylinderGeometry(10, 10.6, 0.7, 6);
  const platform = new THREE.Mesh(platformGeometry, new THREE.MeshStandardMaterial({ color: "#110d30", roughness: 0.9 }));
  platform.position.y = 0.35;
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(platformGeometry), new THREE.LineBasicMaterial({ color }));
  rim.position.y = 0.35;
  group.add(platform, rim);

  // The main tower: three stacked tiers that step in, like a classic skyscraper.
  const height = towerHeight(bot);
  const tiers = [
    [5.6, height * 0.55],
    [4.3, height * 0.3],
    [3.0, height * 0.15],
  ];
  let y = 0.7;
  const pickables = [];
  for (const [width, h] of tiers) {
    const geometry = new THREE.BoxGeometry(width, h, width);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color, transparent: planned, opacity: planned ? 0.55 : 1 }),
    );
    edges.position.y = y + h / 2;
    group.add(edges);
    if (!planned) {
      const facade = facadeMaterial(width, h);
      const box = new THREE.Mesh(geometry, [facade, facade, ROOF, ROOF, facade, facade]);
      box.position.y = y + h / 2;
      group.add(box);
      pickables.push(box);
    } else {
      // An invisible box so a planned plot can still be tapped.
      const hit = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = y + h / 2;
      group.add(hit);
      pickables.push(hit);
    }
    y += h;
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.5), new THREE.MeshBasicMaterial({ color }));
  antenna.position.y = y + 1.75;
  group.add(antenna);
  const top = y + 3.5;

  // Smaller buildings around the tower.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + random() * 0.5;
    const d = 6.2 + random() * 1.8;
    const w = 1.4 + random() * 1.4;
    const h = planned ? 0.6 + random() * 1.2 : 2 + random() * Math.min(9, height * 0.35);
    const material = planned ? new THREE.MeshStandardMaterial({ color: "#1b1640" }) : facadeMaterial(w, h);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), material);
    box.position.set(Math.cos(a) * d, 0.7 + h / 2, Math.sin(a) * d);
    group.add(box);
  }

  // The beam: green when working, red when the last run failed, amber pulsing while it runs.
  let beam = null;
  let halo = null;
  if (!planned && state !== "idle") {
    const beamColor = new THREE.Color(STATE_COLORS[state] || STATE_COLORS.ok);
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 1.5, 90, 20, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: beamColor }, uStrength: { value: 1 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `
          uniform vec3 uColor; uniform float uStrength; varying vec2 vUv;
          void main(){ float a = pow(1.0 - vUv.y, 2.2) * 0.75 * uStrength; gl_FragColor = vec4(uColor * 1.4, a); }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    beam.position.y = top + 45;
    group.add(beam);
    const flare = glowSprite(beamColor, 9);
    flare.position.y = top;
    group.add(flare);
    halo = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.09, 6, 64),
      new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = top - 1.5;
    group.add(halo);
  }

  world.add(group);
  group.updateMatrixWorld(true);
  const topWorld = group.localToWorld(new THREE.Vector3(0, top, 0));

  // A glowing cable from the tower to HQ, with data packets running along it.
  const curve = new THREE.QuadraticBezierCurve3(
    topWorld.clone(),
    topWorld.clone().lerp(hq.top, 0.5).add(new THREE.Vector3(0, 12, 0)),
    hq.top.clone(),
  );
  const cable = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: planned ? 0.18 : 0.55 }),
  );
  world.add(cable);
  const packets = [];
  if (!planned) {
    for (let i = 0; i < 3; i++) {
      const packet = glowSprite(color, 1.8);
      world.add(packet);
      packets.push({ sprite: packet, offset: i / 3 });
    }
  }

  return { id, bot, state, group, pickables, beam, halo, curve, packets, top: topWorld, label: null };
}

function clearDistricts() {
  for (const district of districts) district.label?.remove();
  world.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      if (material.emissiveMap && material.emissiveMap !== WINDOWS) material.emissiveMap.dispose();
      material.dispose();
    }
  });
  world.clear();
  if (outerRing) {
    outerRing.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    scene.remove(outerRing);
  }
  districts = [];
}

// ---------- HTML overlays: labels, detail sheet, ticker, summary ----------

const labelLayer = document.getElementById("labels");
const sheet = document.getElementById("sheet");
const ticker = document.getElementById("ticker");
const summary = document.getElementById("summary");
const hqLabel = makeHQLabel();
let selected = null;
let status = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function ago(iso) {
  if (!iso) return "";
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  if (seconds < 172800) return "yesterday";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function shortTime(iso) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value);
}

function firstTotal(bot) {
  const entry = Object.entries(bot.totals || {})[0];
  return entry ? `${entry[0]}: ${formatNumber(entry[1])}` : null;
}

function makeLabel(district) {
  const { bot, state } = district;
  const label = el("div", "label");
  label.style.setProperty("--c", bot.color || "#8a7dff");
  const title = el("div");
  title.append(el("span", `dot ${state}`), el("b", "", `${bot.emoji || "🤖"} ${bot.name || district.id}`));
  const stat = el("div", "stat", state === "planned" ? "Coming soon" : firstTotal(bot) || STATE_TEXT[state] || "");
  label.append(title, stat);
  label.addEventListener("click", () => select(district));
  labelLayer.append(label);
  return label;
}

function makeHQLabel() {
  const label = el("div", "label hq");
  label.append(el("b", "", "🏛️ HQ"), el("div", "stat", ""));
  labelLayer.append(label);
  return label;
}

function openSheet(district) {
  const { bot, state } = district;
  sheet.replaceChildren();
  sheet.style.setProperty("--c", bot.color || "#8a7dff");
  const head = el("div", "sheet-head");
  head.append(el("h2", "", `${bot.emoji || "🤖"} ${bot.name || district.id}`));
  const close = el("button", "close", "×");
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", () => select(null));
  head.append(close);
  const stateLine = el("p", "state");
  stateLine.append(el("span", `dot ${state}`), document.createTextNode(
    [STATE_TEXT[state] || state, bot.last_run && state !== "running" ? ago(bot.last_run) : ""].filter(Boolean).join(" · "),
  ));
  sheet.append(head, stateLine);
  if (bot.description) sheet.append(el("p", "desc", bot.description));
  if (bot.headline && state !== "planned") sheet.append(el("p", "headline", bot.headline));

  const totals = Object.entries(bot.totals || {});
  if (totals.length) {
    const grid = el("div", "totals");
    for (const [name, value] of totals) {
      const box = el("div", "total");
      box.append(el("div", "n", formatNumber(value)), el("div", "k", name));
      grid.append(box);
    }
    if (bot.runs) {
      const box = el("div", "total");
      box.append(el("div", "n", formatNumber(bot.runs)), el("div", "k", bot.failures ? `Runs (${bot.failures} failed)` : "Runs"));
      grid.append(box);
    }
    sheet.append(grid);
  }
  if (bot.history?.length) {
    sheet.append(el("h3", "", "Recent runs"));
    const list = el("ul", "history");
    for (const run of bot.history.slice(0, 8)) {
      const item = el("li");
      const time = el("time", "", shortTime(run.time));
      time.dateTime = run.time;
      const text = el("span");
      text.append(el("span", `dot ${run.state}`), document.createTextNode(run.headline || ""));
      item.append(time, text);
      list.append(item);
    }
    sheet.append(list);
  }
  if (bot.run_url) {
    const link = el("a", "run-link", "Open the latest run on GitHub ↗");
    link.href = bot.run_url;
    link.target = "_blank";
    link.rel = "noopener";
    sheet.append(link);
  }
  sheet.classList.add("open");
}

let flight = null; // camera move towards (or away from) a tower

function select(district) {
  selected = district;
  const target = district ? district.top.clone().setY(district.top.y * 0.55) : new THREE.Vector3(0, 6, 0);
  const direction = camera.position.clone().sub(controls.target).normalize();
  const phone = innerWidth < 760;
  const distance = district ? Math.max(phone ? 50 : 40, district.top.y * (phone ? 2.8 : 2.1)) : overviewDistance();
  flight = {
    fromTarget: controls.target.clone(),
    toTarget: target,
    fromPosition: camera.position.clone(),
    toPosition: target.clone().add(direction.multiplyScalar(distance)).setY(target.y + distance * 0.45),
    start: performance.now(),
  };
  controls.autoRotate = !district && !reducedMotion;
  if (district) openSheet(district);
  else sheet.classList.remove("open");
  document.body.classList.toggle("sheet-open", Boolean(district));
  applyViewOffset();
}

// On phones the detail sheet covers the bottom of the screen, so shift the picture up while it's open.
function applyViewOffset() {
  if (selected && innerWidth < 760) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.27, innerWidth, innerHeight);
  else camera.clearViewOffset();
}

function renderTicker() {
  const events = [];
  for (const [id, bot] of Object.entries(status?.bots || {})) {
    for (const run of bot.history || []) events.push({ bot: bot.name || id, emoji: bot.emoji || "🤖", ...run });
  }
  events.sort((a, b) => (a.time < b.time ? 1 : -1));
  ticker.replaceChildren();
  const items = events.slice(0, 15);
  if (!items.length) {
    ticker.append(el("span", "", "Waiting for the first bot to report…"));
    return;
  }
  for (const event of items) {
    const item = el("span");
    item.append(el("span", `dot ${event.state}`), el("b", "", `${event.emoji} ${event.bot}`),
      document.createTextNode(` · ${shortTime(event.time)} · ${event.headline || ""}`));
    ticker.append(item);
  }
  ticker.style.animationDuration = `${Math.max(25, items.length * 9)}s`;
}

function renderSummary() {
  const bots = Object.values(status?.bots || {});
  const live = bots.filter((bot) => bot.state && bot.state !== "planned");
  const planned = bots.length - live.length;
  const failing = live.filter((bot) => bot.state === "failed").length;
  const parts = [`${live.length} bot${live.length === 1 ? "" : "s"} live`];
  if (failing) parts.push(`${failing} need${failing === 1 ? "s" : ""} attention`);
  if (planned) parts.push(`${planned} planned`);
  if (status?.updated) parts.push(`updated ${ago(status.updated)}`);
  summary.textContent = parts.join(" · ");
  const runs = live.reduce((sum, bot) => sum + (bot.runs || 0), 0);
  hqLabel.querySelector(".stat").textContent = `${live.length} live · ${runs} run${runs === 1 ? "" : "s"}`;
}

// ---------- data ----------

function statusUrls() {
  const urls = [];
  const owner = location.hostname.match(/^([^.]+)\.github\.io$/)?.[1];
  const repo = location.pathname.split("/").filter(Boolean)[0];
  // GitHub's API has the newest file; the site copy can lag a few minutes behind.
  if (owner && repo) urls.push(`https://api.github.com/repos/${owner}/${repo}/contents/data/status.json`);
  urls.push(`data/status.json?t=${Date.now()}`);
  return urls;
}

async function fetchStatus() {
  for (const url of statusUrls()) {
    try {
      const options = url.startsWith("https://api.github.com")
        ? { headers: { Accept: "application/vnd.github.raw+json" }, cache: "no-store" }
        : { cache: "no-store" };
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
    } catch {
      // try the next source
    }
  }
  return null;
}

function fingerprint(data) {
  return JSON.stringify(Object.entries(data?.bots || {}).map(([id, b]) => [id, b.state, b.runs, b.color, b.name]));
}

async function refresh() {
  const data = await fetchStatus();
  if (!data) {
    if (!status) summary.textContent = "Couldn't load the city data. Retrying soon…";
    return;
  }
  const rebuild = !built || fingerprint(data) !== fingerprint(status);
  status = data;
  if (rebuild) buildCity();
  renderSummary();
  renderTicker();
  if (selected) {
    const fresh = districts.find((d) => d.id === selected.id);
    if (fresh) {
      selected = fresh;
      openSheet(fresh);
    }
  }
}

let built = false;

function buildCity() {
  const first = !built;
  built = true;
  clearDistricts();
  const entries = Object.entries(status?.bots || {}).sort(([a], [b]) => a.localeCompare(b));
  const radius = Math.max(30, 16 + entries.length * 4.2);
  entries.forEach(([id, bot], index) => {
    const angle = (index / Math.max(1, entries.length)) * Math.PI * 2 - Math.PI / 2;
    const district = buildDistrict(id, bot, angle, radius);
    district.label = makeLabel(district);
    districts.push(district);
  });
  outerRing = ring(radius + 15, "#b45cff", 0.18);
  if (first) resetCamera();
}

function cityRadius() {
  return Math.max(30, 16 + districts.length * 4.2);
}

// Far enough back that the whole ring of districts fits the screen, wide or tall.
function overviewDistance() {
  const fit = cityRadius() + 14;
  const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
  const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
  return Math.max(fit / Math.tan(halfH), (fit * 0.8) / Math.tan(halfV)) * (camera.aspect < 0.8 ? 1.08 : 1.2);
}

function resetCamera() {
  const d = overviewDistance();
  const elevation = camera.aspect < 0.8 ? 0.95 : 0.62; // look down more on tall phone screens
  camera.position.set(d * Math.cos(elevation) * 0.55, d * Math.sin(elevation), d * Math.cos(elevation) * 0.84);
  controls.target.set(0, 6, 0);
}

// ---------- interaction ----------

const raycaster = new THREE.Raycaster();
let pointerDown = null;
canvas.addEventListener("pointerdown", (event) => (pointerDown = { x: event.clientX, y: event.clientY }));
canvas.addEventListener("pointerup", (event) => {
  if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 8) return;
  const pointer = new THREE.Vector2((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(districts.flatMap((d) => d.pickables))[0];
  const district = hit && districts.find((d) => d.pickables.includes(hit.object));
  select(district || null);
});
controls.addEventListener("start", () => (flight = null));
addEventListener("keydown", (event) => event.key === "Escape" && select(null));

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 62 : 50;
  applyViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
resetCamera();

// ---------- animation ----------

const projected = new THREE.Vector3();

function placeLabel(label, position, lift) {
  projected.copy(position).project(camera);
  const visible = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
  label.style.display = visible ? "" : "none";
  if (!visible) return;
  const half = label.offsetWidth / 2 + 6; // keep labels fully on screen
  const x = Math.min(innerWidth - half, Math.max(half, (projected.x * 0.5 + 0.5) * innerWidth));
  const y = (-projected.y * 0.5 + 0.5) * innerHeight - lift;
  label.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
  label.style.zIndex = String(Math.round((1 - projected.z) * 100000));
}

function animate() {
  const t = performance.now() / 1000;
  groundMaterial.uniforms.uTime.value = t;

  if (flight) {
    const k = Math.min(1, (performance.now() - flight.start) / 900);
    const ease = 1 - Math.pow(1 - k, 3);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, ease);
    if (k === 1) flight = null;
  }

  for (const district of districts) {
    if (district.beam && !reducedMotion) {
      const u = district.beam.material.uniforms.uStrength;
      if (district.state === "running") u.value = 0.55 + 0.45 * Math.sin(t * 5);
      else if (district.state === "failed") u.value = Math.sin(t * 13) > 0.2 || Math.sin(t * 3.1) > 0.9 ? 1 : 0.25;
      else u.value = 0.9 + 0.1 * Math.sin(t * 1.5);
    }
    if (district.halo) {
      district.halo.rotation.z = t * (district.state === "running" ? 3 : 0.6);
      district.halo.scale.setScalar(district.state === "running" ? 1 + 0.15 * Math.sin(t * 4) : 1);
    }
    const speed = district.state === "running" ? 0.45 : 0.12;
    for (const packet of district.packets) {
      const along = reducedMotion ? packet.offset : (t * speed + packet.offset) % 1;
      packet.sprite.position.copy(district.curve.getPoint(along));
    }
    placeLabel(district.label, district.top, 14);
  }
  placeLabel(hqLabel, hq.top, 10);

  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
document.addEventListener("visibilitychange", () => {
  renderer.setAnimationLoop(document.hidden ? null : animate);
  if (!document.hidden) refresh();
});

refresh();
setInterval(refresh, REFRESH_MS);
