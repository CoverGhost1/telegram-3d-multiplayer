// ============================================================
// Dunia 3D Multiplayer v3 — Roblox-style + interior
// Avatar blocky beranimasi + kota kecil + lompat/lari + kamera orbit
// v3: 3 bangunan bisa dimasuki (Rumah, Kafe, Ruangan Berdua privat max 2 orang)
// Interior dibangun jauh di (80, *, *) supaya tidak tabrakan dengan kota luar.
// Nama di Ruangan Berdua masih placeholder "Ghoz & Pacar" — ganti
// COUPLE_NAMES kalau nama pacar Ghoz sudah diketahui.
// ============================================================
const BACKEND_URL = "GANTI_DENGAN_URL_BACKEND";
const COUPLE_NAMES = "Ghoz & Pacar";
const WORLD_LIMIT = 27;
const WALK_SPEED = 5.0;
const RUN_SPEED = 8.0;
const GRAVITY = 24;
const JUMP_VEL = 8.8;
const PLAYER_RADIUS = 0.45;

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor("#7ec8f0"); tg.setBackgroundColor("#7ec8f0"); }
const telegramUser = tg?.initDataUnsafe?.user || {};
function getDisplayName(u) {
  if (u.username) return "@" + u.username;
  const n = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return n || "Player";
}
document.getElementById("playerName").textContent = getDisplayName(telegramUser);

// ---------------- THREE: langit siang ----------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c5eb);
scene.fog = new THREE.Fog(0x9fd0ee, 35, 95);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x5a7d4a, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
sun.position.set(25, 38, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 100; sun.shadow.bias = -0.0004;
scene.add(sun);

// Matahari + awan
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff6b0 }));
sunBall.position.set(45, 42, -55); scene.add(sunBall);
const clouds = [];
function addCloud(x, y, z, s) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  [[0, 0, 0, 2.2], [2.2, -0.2, 0.3, 1.7], [-2.2, -0.2, -0.2, 1.6], [0.8, 0.6, -0.4, 1.4]].forEach(p => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(p[3], 12, 12), m);
    b.position.set(p[0], p[1], p[2]); b.scale.y = 0.55; g.add(b);
  });
  g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g); clouds.push(g);
}
addCloud(-18, 22, -28, 1.2); addCloud(12, 25, -32, 1.5); addCloud(28, 21, 8, 1); addCloud(-28, 24, 18, 1.3);

// ---------------- Tekstur prosedural ----------------
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
}
const grassTex = canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#5da244"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = ["#54963d", "#68b04e", "#4c8a38", "#7ac25e"][i % 4];
    ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3);
  }
}, 18, 18);
const roadTex = canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#3d3d46"; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { ctx.fillStyle = "#45454f"; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  ctx.fillStyle = "#f5d76e"; ctx.fillRect(w / 2 - 4, 0, 8, 40); ctx.fillRect(w / 2 - 4, 90, 8, 40); ctx.fillRect(w / 2 - 4, 180, 8, 40);
}, 1, 8);
function facadeTex(base, win) {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(0, 0, w, 10);
    for (let y = 28; y < h - 20; y += 42) for (let x = 22; x < w - 20; x += 48) {
      ctx.fillStyle = win; ctx.fillRect(x, y, 30, 26);
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x, y, 30, 6);
    }
  });
}
function faceTex(skinCss) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = skinCss; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#222";
  ctx.beginPath(); ctx.arc(82, 100, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(174, 100, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(87, 95, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(179, 95, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#222"; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(128, 150, 42, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  return new THREE.CanvasTexture(c);
}

// ---------------- Dunia: tanah, jalan, plaza ----------------
const colliders = []; // {type:'box',x,z,hx,hz} | {type:'circle',x,z,r}
function addBoxCollider(x, z, hx, hz) { colliders.push({ type: "box", x, z, hx, hz }); }
function addCircleCollider(x, z, r) { colliders.push({ type: "circle", x, z, r }); }

const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// Plaza bundar di tengah (spawn)
const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 }));
plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true; scene.add(plaza);
// Jalan salib
[0, Math.PI / 2].forEach(rot => {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(70, 6), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 1 }));
  road.rotation.x = -Math.PI / 2; road.rotation.z = rot; road.position.y = 0.015; road.receiveShadow = true; scene.add(road);
});

// ---------------- Gedung ----------------
const buildingDefs = [
  { x: -22, z: -20, w: 9, h: 12, d: 8, c: "#e07a5f" }, { x: -10, z: -23, w: 8, h: 8, d: 7, c: "#81b29a" },
  { x: 4, z: -23, w: 10, h: 15, d: 8, c: "#f2cc8f" }, { x: 18, z: -21, w: 8, h: 10, d: 8, c: "#6d9dc5" },
  { x: -23, z: 8, w: 8, h: 9, d: 9, c: "#b5838d" }, { x: -22, z: 21, w: 9, h: 13, d: 7, c: "#8ab17d" },
  { x: 22, z: 12, w: 9, h: 11, d: 8, c: "#e07a5f" }, { x: 21, z: -8, w: 7, h: 7, d: 7, c: "#f2cc8f" },
  { x: 10, z: 23, w: 9, h: 9, d: 7, c: "#6d9dc5" }, { x: -8, z: 23, w: 8, h: 12, d: 7, c: "#81b29a" },
];
buildingDefs.forEach(b => {
  const mat = new THREE.MeshStandardMaterial({ map: facadeTex(b.c, "#bfe3ff"), roughness: 0.85 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
  mesh.position.set(b.x, b.h / 2, b.z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.4, b.d + 0.4), new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 1 }));
  roof.position.set(b.x, b.h + 0.2, b.z); roof.castShadow = true; scene.add(roof);
  addBoxCollider(b.x, b.z, b.w / 2 + 0.2, b.d / 2 + 0.2);
});

// ---------------- Pohon, lampu, bangku, air mancur ----------------
function addTree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 1.6 * s, 8), new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 }));
  trunk.position.y = 0.8 * s; trunk.castShadow = true; g.add(trunk);
  const leafM = new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 1 });
  [[0, 2.2, 0, 1.4], [0.7, 1.7, 0.2, 0.95], [-0.6, 1.8, -0.2, 0.9]].forEach(p => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(p[3] * s, 12, 12), leafM);
    leaf.position.set(p[0] * s, p[1] * s, p[2] * s); leaf.castShadow = true; g.add(leaf);
  });
  g.position.set(x, 0, z); scene.add(g); addCircleCollider(x, z, 0.5 * s);
}
[[-14, -12], [14, -14], [-16, 16], [16, 18], [-6, -16], [8, 16], [-26, -2], [26, 2], [2, -18], [-2, 18]].forEach(p => addTree(p[0], p[1], 0.9 + Math.random() * 0.5));

function addLamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x333340 }));
  pole.position.y = 1.7; pole.castShadow = true; g.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffd76e, emissiveIntensity: 0.9 }));
  bulb.position.y = 3.5; g.add(bulb);
  g.position.set(x, 0, z); scene.add(g); addCircleCollider(x, z, 0.25);
}
[[-4, -4], [4, -4], [-4, 4], [4, 4], [-12, 3.5], [12, -3.5]].forEach(p => addLamp(p[0], p[1]));

function addBench(x, z, rotY) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b30, roughness: 0.9 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.6), wood); seat.position.y = 0.5; seat.castShadow = true; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.12), wood); back.position.set(0, 0.9, -0.28); back.castShadow = true; g.add(back);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g); addBoxCollider(x, z, 1.2, 0.5);
}
addBench(-6, 7, 0.4); addBench(6, -7, -2.7); addBench(7, 6, -0.8);

// Air mancur di (0,-13) — bukan di spawn
const fountain = new THREE.Group();
const fBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 24), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.8 }));
fBase.position.y = 0.35; fBase.castShadow = true; fountain.add(fBase);
const fWater = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24), new THREE.MeshStandardMaterial({ color: 0x4db2e8, roughness: 0.2, metalness: 0.1 }));
fWater.rotation.x = -Math.PI / 2; fWater.position.y = 0.68; fountain.add(fWater);
const fTop = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.1, 12), new THREE.MeshStandardMaterial({ color: 0xcfc8b8 }));
fTop.position.y = 1.0; fTop.castShadow = true; fountain.add(fTop);
fountain.position.set(0, 0, -13); scene.add(fountain); addCircleCollider(0, -13, 2.9);

// Semak + batu
[[-18, 4, 0.9], [18, -16, 1.1], [-12, 20, 0.8], [12, 20, 1]].forEach(p => {
  const bush = new THREE.Mesh(new THREE.SphereGeometry(p[2], 10, 10), new THREE.MeshStandardMaterial({ color: 0x3a7d2e, roughness: 1 }));
  bush.position.set(p[0], p[2] * 0.55, p[1]); bush.scale.y = 0.7; bush.castShadow = true; scene.add(bush);
});

// Pagar batas dunia (rendah, ala Roblox baseplate)
const fenceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
[[0, -29, 58, 0.4], [0, 29, 58, 0.4], [-29, 0, 0.4, 58], [29, 0, 0.4, 58]].forEach(w => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w[2], 1.0, w[3]), fenceMat);
  m.position.set(w[0], 0.5, w[1]); m.castShadow = true; m.receiveShadow = true; scene.add(m);
});

// ---------------- v3: INTERIOR — bangunan bisa dimasuki ----------------
// Zona: 'luar' | 'rumah' | 'kafe' | 'berdua' (privat, max 2 orang)
let currentZone = "luar";
const INTERIORS = {
  rumah: { cx: 80, cz: 0, w: 10, d: 8, label: "Rumah", floor: 0xb08968, wall: 0xf5e6c8, furniture: [] },
  kafe: { cx: 80, cz: 30, w: 12, d: 9, label: "Kafe", floor: 0x8a5a3b, wall: 0xffe8c2, furniture: [] },
  berdua: { cx: 80, cz: -30, w: 9, d: 7, label: "Ruangan Berdua", floor: 0xd98a9e, wall: 0xffd6e0, furniture: [] },
};
// Pintu di luar (depan gedung). Gedung yang bisa dimasuki:
// Rumah = gedung hijau di (-10,-23), Kafe = gedung kuning di (4,-23),
// Ruangan Berdua = gedung biru di (10,23).
const DOORS = [
  { x: -10, z: -19.2, zone: "rumah", label: "RUMAH" },
  { x: 4, z: -18.7, zone: "kafe", label: "KAFE" },
  { x: 10, z: 19.2, zone: "berdua", label: "RUANGAN BERDUA" },
];
function boxAt(x, y, z, w, h, d, color, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m); return m;
}
function buildInterior(zoneKey) {
  const it = INTERIORS[zoneKey];
  const g = new THREE.Group(); g.position.set(it.cx, 0, it.cz); scene.add(g);
  // Lantai + dinding (tinggi 3,2). Pintu keluar di dinding selatan (z +d/2).
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(it.w, it.d), new THREE.MeshStandardMaterial({ color: it.floor, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.02; floor.receiveShadow = true; g.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ color: it.wall, roughness: 0.9 });
  const mkWall = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), wallM); m.position.set(x, 1.6, z); m.castShadow = true; m.receiveShadow = true; g.add(m); };
  mkWall(0, -it.d / 2, it.w, 0.3); mkWall(-it.w / 2, 0, 0.3, it.d); mkWall(it.w / 2, 0, 0.3, it.d);
  // Dinding selatan dua segmen, sisakan celah pintu 1,4 di tengah
  mkWall(-(it.w / 4 + 0.7), it.d / 2, it.w / 2 - 0.7, 0.3); mkWall(it.w / 4 + 0.7, it.d / 2, it.w / 2 - 0.7, 0.3);
  // Pintu keluar (panel cokelat, tidak menghalangi — jalan saja keluar)
  boxAt(0, 1.1, it.d / 2, 1.4, 2.2, 0.1, 0x6b4226, g);
  // Lampu gantung
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffd76e, emissiveIntensity: 1 }));
  lamp.position.set(0, 2.8, 0); g.add(lamp);
  const pl = new THREE.PointLight(0xffe9a3, 0.7, 12); pl.position.set(0, 2.6, 0); g.add(pl);
  if (zoneKey === "rumah") {
    boxAt(-2.8, 0.25, -2.2, 2.4, 0.5, 1.0, 0x7a5230, g); // sofa
    boxAt(-2.8, 0.75, -2.6, 2.4, 0.8, 0.25, 0x7a5230, g);
    it.furniture.push({ x: it.cx - 2.8, z: it.cz - 2.2, hx: 1.3, hz: 0.6 });
    boxAt(0.5, 0.3, -1.5, 1.6, 0.6, 0.9, 0x9c6b30, g); // meja
    it.furniture.push({ x: it.cx + 0.5, z: it.cz - 1.5, hx: 0.9, hz: 0.55 });
    boxAt(3.2, 0.9, -3.2, 2.0, 1.2, 0.25, 0x222222, g); // TV di dinding utara
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.04, 0.5); g.add(rug);
  } else if (zoneKey === "kafe") {
    boxAt(-3.5, 0.55, -3.2, 5.0, 1.1, 0.8, 0x5b4a3a, g); // meja kasir
    it.furniture.push({ x: it.cx - 3.5, z: it.cz - 3.2, hx: 2.6, hz: 0.5 });
    [[-1.5, 0.5], [1.5, 0.5], [-1.5, 2.5], [1.5, 2.5]].forEach(p => {
      boxAt(p[0], 0.4, p[1], 1.2, 0.8, 1.2, 0xffffff, g); // meja kafe
      it.furniture.push({ x: it.cx + p[0], z: it.cz + p[1], hx: 0.7, hz: 0.7 });
    });
  } else if (zoneKey === "berdua") {
    // Ranjang double + bantal, sofa berdua, meja lilin, hati di dinding
    boxAt(-1.8, 0.35, -2.0, 3.0, 0.7, 2.0, 0xff8fab, g);
    boxAt(-2.6, 0.6, -2.7, 1.0, 0.35, 0.4, 0xffffff, g); boxAt(-1.0, 0.6, -2.7, 1.0, 0.35, 0.4, 0xffffff, g);
    it.furniture.push({ x: it.cx - 1.8, z: it.cz - 2.0, hx: 1.6, hz: 1.1 });
    boxAt(2.2, 0.25, 1.8, 2.2, 0.5, 0.9, 0xe75480, g); // sofa berdua
    it.furniture.push({ x: it.cx + 2.2, z: it.cz + 1.8, hx: 1.2, hz: 0.55 });
    boxAt(0.2, 0.3, 1.5, 1.0, 0.6, 0.6, 0x9c6b30, g); // meja kecil
    it.furniture.push({ x: it.cx + 0.2, z: it.cz + 1.5, hx: 0.6, hz: 0.4 });
    [[-0.1, 0.75], [0.5, 0.75]].forEach(p => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffb703, emissiveIntensity: 1.2 }));
      c.position.set(it.cx + p[0], 0.8, it.cz + 1.5); scene.add(c);
    });
    // Hiasan hati di dinding utara (dua bola + kerucut, pink)
    const heart = new THREE.Group();
    const hm = new THREE.MeshStandardMaterial({ color: 0xff4d6d, roughness: 0.6 });
    [[-0.35, 0, 0], [0.35, 0, 0]].forEach(p => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), hm); s.position.set(p[0], p[1], p[2]); heart.add(s); });
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 4), hm); tri.position.set(0, -0.45, 0); tri.rotation.x = Math.PI; tri.rotation.y = Math.PI / 4; heart.add(tri);
    heart.position.set(it.cx, 2.0, it.cz - it.d / 2 + 0.25); heart.scale.setScalar(1.1); scene.add(heart);
    // Papan nama pasangan
    const sign = createLabel(COUPLE_NAMES + " ♥");
    sign.position.set(0, 2.6, 0); sign.scale.set(2.4, 0.6, 1); g.add(sign);
  }
}
Object.keys(INTERIORS).forEach(buildInterior);
// Pintu luar: panel + label di depan gedung
DOORS.forEach(d => {
  boxAt(d.x, 1.1, d.z, 1.4, 2.2, 0.15, 0x4a2c14, scene);
  const lab = createLabel(d.label);
  lab.position.set(d.x, 3.0, d.z + 0.3); scene.add(lab);
});
function nearestDoor() {
  if (currentZone !== "luar") return null;
  let best = null, bd = 1e9;
  DOORS.forEach(d => { const dist = Math.hypot(myData.x - d.x, myData.z - d.z); if (dist < bd) { bd = dist; best = d; } });
  return bd < 3.0 ? best : null;
}
function enterZone(zoneKey) {
  const it = INTERIORS[zoneKey]; if (!it) return;
  currentZone = zoneKey; myData.zone = zoneKey;
  myData.x = it.cx; myData.z = it.cz + it.d / 2 - 1.2; myData.y = 0; myData.vy = 0; myData.rotY = Math.PI;
  myMesh.position.set(myData.x, 0, myData.z);
  setStatus(zoneKey === "berdua" ? "💕 Ruangan Berdua — privat, max 2 orang" : "🏠 Di dalam: " + it.label);
  updateEnterPrompt();
}
function exitZone() {
  const door = DOORS.find(d => d.zone === currentZone);
  currentZone = "luar"; myData.zone = "luar";
  if (door) { myData.x = door.x; myData.z = door.z + 1.8; }
  myData.y = 0; myData.vy = 0; myData.rotY = 0;
  myMesh.position.set(myData.x, 0, myData.z);
  setStatus(isDemo ? "🟡 Mode Demo — isi BACKEND_URL untuk multiplayer" : "🟢 Online");
  updateEnterPrompt();
}
function tryEnterExit() {
  if (currentZone !== "luar") { exitZone(); return; }
  const d = nearestDoor(); if (d) enterZone(d.zone);
}
function updateEnterPrompt() {
  const el = document.getElementById("enterPrompt"); const btn = document.getElementById("enterBtn");
  if (!el || !btn) return;
  if (currentZone !== "luar") { el.textContent = "Pintu keluar — tekan E / KELUAR"; el.style.display = "block"; btn.textContent = "KELUAR"; btn.style.display = "block"; return; }
  const d = nearestDoor();
  if (d) { el.textContent = "Masuk " + d.label + "? Tekan E / MASUK"; el.style.display = "block"; btn.textContent = "MASUK"; btn.style.display = "block"; }
  else { el.style.display = "none"; btn.style.display = "none"; }
}

// ---------------- Tabrakan ----------------
function resolveCollisions(p) {
  // Di dalam ruangan: batas ruangan + furnitur, bukan kota luar.
  if (typeof currentZone !== "undefined" && currentZone !== "luar" && INTERIORS[currentZone]) {
    const it = INTERIORS[currentZone];
    const minX = it.cx - it.w / 2 + 0.7, maxX = it.cx + it.w / 2 - 0.7;
    const minZ = it.cz - it.d / 2 + 0.7, maxZ = it.cz + it.d / 2 - 0.7;
    p.x = Math.max(minX, Math.min(maxX, p.x));
    p.z = Math.max(minZ, Math.min(maxZ, p.z));
    for (const f of it.furniture) {
      const cx = Math.max(f.x - f.hx, Math.min(p.x, f.x + f.hx));
      const cz = Math.max(f.z - f.hz, Math.min(p.z, f.z + f.hz));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < PLAYER_RADIUS * PLAYER_RADIUS && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (PLAYER_RADIUS - d) / d;
        p.x += dx * push; p.z += dz * push;
      }
    }
    return;
  }
  for (const c of colliders) {
    if (c.type === "box") {
      const cx = Math.max(c.x - c.hx, Math.min(p.x, c.x + c.hx));
      const cz = Math.max(c.z - c.hz, Math.min(p.z, c.z + c.hz));
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < PLAYER_RADIUS * PLAYER_RADIUS) {
        if (d2 < 1e-6) { p.z = c.z + c.hz + PLAYER_RADIUS; continue; }
        const d = Math.sqrt(d2), push = (PLAYER_RADIUS - d) / d;
        p.x += dx * push; p.z += dz * push;
      }
    } else {
      let dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + PLAYER_RADIUS;
      if (d < min && d > 1e-6) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
      else if (d <= 1e-6) { p.z = c.z + min; }
    }
  }
  p.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, p.x));
  p.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, p.z));
}

// ---------------- Avatar Roblox-style ----------------
const SKIN_CSS = ["#f2c89b", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
function css(hex) { return "#" + hex.toString(16).padStart(6, "0"); }
function createLabel(text) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, 512, 128);
  ctx.font = "bold 44px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const tw = Math.min(480, ctx.measureText(text.slice(0, 22)).width + 36);
  ctx.fillStyle = "rgba(0,0,0,.6)";
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(256 - tw / 2, 28, tw, 72, 18) : ctx.fillRect(256 - tw / 2, 28, tw, 72); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText(text.slice(0, 22), 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(3.0, 0.75, 1); sp.position.y = 2.85; return sp;
}
function limb(w, h, d, color, x, y) {
  const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  m.position.set(x, y, 0); m.castShadow = true; return m;
}
function createAvatar(player, isMe = false) {
  const group = new THREE.Group();
  const shirt = player.shirt ?? player.color ?? 0x5c8dff;
  const pants = player.pants ?? 0x2c3e50;
  const skin = player.skin ?? 0xf2c89b;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 0.5), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.65 }));
  torso.position.y = 1.3; torso.castShadow = true; group.add(torso);
  const headMats = [
    new THREE.MeshStandardMaterial({ color: skin }), new THREE.MeshStandardMaterial({ color: skin }),
    new THREE.MeshStandardMaterial({ color: skin }), new THREE.MeshStandardMaterial({ color: skin }),
    new THREE.MeshStandardMaterial({ map: faceTex(css(skin)) }), new THREE.MeshStandardMaterial({ color: skin }),
  ];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), headMats);
  head.position.y = 2.15; head.castShadow = true; group.add(head);
  const armL = limb(0.32, 0.85, 0.38, shirt, -0.66, 1.72);
  const armR = limb(0.32, 0.85, 0.38, shirt, 0.66, 1.72);
  const legL = limb(0.42, 0.8, 0.45, pants, -0.24, 0.8);
  const legR = limb(0.42, 0.8, 0.45, pants, 0.24, 0.8);
  group.add(armL, armR, legL, legR);
  group.add(createLabel(isMe ? "YOU • " + (player.name || "Player") : (player.name || "Player")));
  group.position.set(player.x || 0, player.y || 0, player.z || 0);
  group.userData = { phase: Math.random() * 6, armL, armR, legL, legR, moving: false, speedNorm: 0 };
  scene.add(group);
  return group;
}
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function animateAvatar(mesh, moving, speedNorm, delta, airborne) {
  const u = mesh.userData;
  if (moving) u.phase += delta * (6 + 7 * speedNorm);
  const target = moving ? Math.sin(u.phase) * 0.85 : 0;
  const k = Math.min(1, delta * 14);
  if (airborne) {
    u.armL.rotation.x += (-2.4 - u.armL.rotation.x) * k;
    u.armR.rotation.x += (-2.4 - u.armR.rotation.x) * k;
    u.legL.rotation.x += (0.55 - u.legL.rotation.x) * k;
    u.legR.rotation.x += (-0.35 - u.legR.rotation.x) * k;
  } else {
    u.armL.rotation.x += (target - u.armL.rotation.x) * k;
    u.armR.rotation.x += (-target - u.armR.rotation.x) * k;
    u.legL.rotation.x += (-target - u.legL.rotation.x) * k;
    u.legR.rotation.x += (target - u.legR.rotation.x) * k;
  }
}

// ---------------- State pemain saya ----------------
const otherPlayers = {}; // id -> {mesh, target, moving}
let myData = { x: 0, y: 0, z: 4, vy: 0, rotY: Math.PI, grounded: true, moving: false, zone: "luar", color: 0x5c8dff, shirt: 0x5c8dff, pants: 0x2c3e50, skin: 0xf2c89b, name: getDisplayName(telegramUser) };
let myMesh = createAvatar(myData, true);
let camYaw = 0, camPitch = 0.34, camDist = 7.5;

function setStatus(t) { document.getElementById("status").textContent = t; }
function setCount(n) { document.getElementById("count").textContent = "👥 " + n + " pemain"; }
setCount(1);

// ---------------- Socket.IO ----------------
let socket = null;
const isDemo = !BACKEND_URL || BACKEND_URL === "GANTI_DENGAN_URL_BACKEND";
if (isDemo) {
  setStatus("🟡 Mode Demo — isi BACKEND_URL untuk multiplayer");
  // Tanpa bot/NPC — sesuai permintaan Ghoz (20 Nov 2026): kota kosong, hanya pemain sendiri.
  setCount(1);
} else {
  socket = io(BACKEND_URL, { transports: ["websocket", "polling"], auth: { telegramUser } });
  socket.on("connect", () => setStatus("🟢 Online"));
  socket.on("disconnect", () => setStatus("🔴 Terputus"));
  socket.on("connect_error", (e) => { console.error(e); setStatus("🔴 Gagal terhubung"); });
  socket.on("playerCount", (n) => setCount(n));
  socket.on("zoneDenied", (d) => {
    // Server menolak masuk Ruangan Berdua (sudah penuh) — balik ke luar
    if (currentZone === "berdua") exitZone();
    setStatus("🔒 " + (d.reason || "Ruangan penuh"));
  });
  socket.on("currentPlayers", (players) => {
    Object.entries(players).forEach(([id, p]) => {
      if (id === socket.id) {
        myData = { ...myData, ...p, vy: 0, grounded: true, zone: p.zone || "luar" };
        currentZone = myData.zone;
        scene.remove(myMesh); myMesh = createAvatar(myData, true);
      } else if (!otherPlayers[id]) {
        const mesh = createAvatar(p);
        otherPlayers[id] = { mesh, target: { x: p.x, y: p.y || 0, z: p.z, rotY: p.rotY || 0 }, moving: !!p.moving, zone: p.zone || "luar" };
      }
    });
    setCount(Object.keys(players).length);
  });
  socket.on("newPlayer", (p) => {
    if (p.id === socket.id || otherPlayers[p.id]) return;
    const mesh = createAvatar(p);
    otherPlayers[p.id] = { mesh, target: { x: p.x, y: p.y || 0, z: p.z, rotY: p.rotY || 0 }, moving: false, zone: p.zone || "luar" };
    setCount(Object.keys(otherPlayers).length + 1);
  });
  socket.on("playerMoved", (d) => {
    const o = otherPlayers[d.id]; if (!o) return;
    o.target = { x: d.x, y: d.y || 0, z: d.z, rotY: d.rotY || 0 }; o.moving = !!d.moving; if (d.zone) o.zone = d.zone;
  });
  socket.on("playerDisconnected", (id) => {
    const o = otherPlayers[id]; if (!o) return;
    scene.remove(o.mesh); delete otherPlayers[id];
    setCount(Object.keys(otherPlayers).length + 1);
  });
}

// ---------------- Bot demo ----------------
const bots = [];
function spawnBots() {
  const defs = [
    { name: "Budi", shirt: 0xff5c7a, pants: 0x2c3e50, skin: 0xf2c89b, x: -3, z: -2 },
    { name: "Sinta", shirt: 0x5ce1a6, pants: 0x7e5109, skin: 0xe0ac69, x: 4, z: -3 },
    { name: "Raka", shirt: 0xffc857, pants: 0x1a5276, skin: 0xc68642, x: 2, z: 7 },
  ];
  defs.forEach(d => {
    const mesh = createAvatar({ ...d, y: 0 }, false);
    bots.push({ mesh, tx: d.x, tz: d.z, vy: 0, y: 0, grounded: true, wait: Math.random() * 2, rotY: 0 });
  });
  setCount(4);
}
function updateBots(delta) {
  bots.forEach(b => {
    const p = b.mesh.position;
    const dx = b.tx - p.x, dz = b.tz - p.z, dist = Math.hypot(dx, dz);
    let moving = false;
    if (b.wait > 0) { b.wait -= delta; }
    else if (dist > 0.6) {
      moving = true;
      const sp = 2.6;
      p.x += (dx / dist) * sp * delta; p.z += (dz / dist) * sp * delta;
      b.rotY = Math.atan2(dx, dz);
      if (Math.random() < delta * 0.08 && b.grounded) { b.vy = JUMP_VEL * 0.8; b.grounded = false; }
    } else {
      b.tx = (Math.random() - 0.5) * 36; b.tz = (Math.random() - 0.5) * 36;
      if (Math.random() < 0.4) b.wait = 1 + Math.random() * 2;
    }
    // gravitasi bot
    b.vy -= GRAVITY * delta; b.y += b.vy * delta;
    if (b.y <= 0) { b.y = 0; b.vy = 0; b.grounded = true; }
    p.y = b.y;
    resolveCollisions(p);
    b.mesh.rotation.y = lerpAngle(b.mesh.rotation.y, b.rotY, Math.min(1, delta * 10));
    animateAvatar(b.mesh, moving, 0.5, delta, !b.grounded);
  });
}

// ---------------- Kontrol: D-pad + lompat/lari + drag kamera ----------------
const keys = { up: false, down: false, left: false, right: false, jump: false, run: false };
function bindHold(id, name) {
  const el = document.getElementById(id); if (!el) return;
  const on = (e) => { e.preventDefault(); keys[name] = true; el.classList.add("active"); };
  const off = (e) => { e.preventDefault(); keys[name] = false; el.classList.remove("active"); };
  el.addEventListener("pointerdown", on);
  el.addEventListener("pointerup", off); el.addEventListener("pointercancel", off); el.addEventListener("pointerleave", off);
}
bindHold("up", "up"); bindHold("down", "down"); bindHold("left", "left"); bindHold("right", "right");
bindHold("jumpBtn", "jump"); bindHold("runBtn", "run");
const enterBtnEl = document.getElementById("enterBtn");
if (enterBtnEl) enterBtnEl.addEventListener("pointerdown", (e) => { e.preventDefault(); tryEnterExit(); });
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.up = true;
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.down = true;
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
  if (e.key === " ") { keys.jump = true; e.preventDefault(); }
  if (e.key === "Shift") keys.run = true;
  if (e.key === "e" || e.key === "E") tryEnterExit();
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.up = false;
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.down = false;
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  if (e.key === " ") keys.jump = false;
  if (e.key === "Shift") keys.run = false;
});
// Drag kamera (di canvas saja, tombol di atasnya tidak kena)
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.005;
  camPitch = Math.max(0.08, Math.min(1.1, camPitch + (e.clientY - lastY) * 0.004));
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener("pointerup", () => { dragging = false; });
renderer.domElement.addEventListener("wheel", (e) => { e.preventDefault(); camDist = Math.max(4.5, Math.min(12, camDist + e.deltaY * 0.01)); }, { passive: false });

// ---------------- Gerakan saya (fisika Roblox-like) ----------------
let lastEmit = 0;
function updateMovement(delta) {
  if (!myMesh) return;
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = -fz, rz = fx;
  let ix = 0, iz = 0;
  if (keys.up) { ix += fx; iz += fz; }
  if (keys.down) { ix -= fx; iz -= fz; }
  if (keys.right) { ix += rx; iz += rz; }
  if (keys.left) { ix -= rx; iz -= rz; }
  const len = Math.hypot(ix, iz);
  const moving = len > 0;
  myData.moving = moving;
  if (moving) {
    ix /= len; iz /= len;
    const speed = keys.run ? RUN_SPEED : WALK_SPEED;
    myData.x += ix * speed * delta;
    myData.z += iz * speed * delta;
    myData.rotY = Math.atan2(ix, iz);
    myMesh.userData.speedNorm = keys.run ? 1 : 0.6;
  } else myMesh.userData.speedNorm = 0;
  // Lompat + gravitasi
  if (keys.jump && myData.grounded) { myData.vy = JUMP_VEL; myData.grounded = false; keys.jump = false; }
  myData.vy -= GRAVITY * delta;
  myData.y += myData.vy * delta;
  if (myData.y <= 0) { myData.y = 0; myData.vy = 0; myData.grounded = true; }
  resolveCollisions(myData);
  myMesh.position.set(myData.x, myData.y, myData.z);
  myMesh.rotation.y = lerpAngle(myMesh.rotation.y, myData.rotY, Math.min(1, delta * 12));
  animateAvatar(myMesh, moving, myMesh.userData.speedNorm, delta, !myData.grounded);
  const now = performance.now();
  if (socket?.connected && now - lastEmit > 50) {
    lastEmit = now;
    socket.emit("playerMovement", { x: myData.x, y: myData.y, z: myData.z, rotY: myData.rotY, moving, zone: currentZone });
  }
}
function updateCamera(delta) {
  const px = myData.x, py = myData.y, pz = myData.z;
  const ox = Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const oy = Math.sin(camPitch) * camDist + 1.2;
  const oz = Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  camera.position.lerp(new THREE.Vector3(px + ox, py + oy, pz + oz), Math.min(1, delta * 8));
  camera.lookAt(px, py + 1.4, pz);
}

// ---------------- Loop ----------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
const clock = new THREE.Clock();
let elapsed = 0;
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;
  clouds.forEach((c, i) => { c.position.x += delta * (0.4 + i * 0.15); if (c.position.x > 55) c.position.x = -55; });
  fWater.rotation.z += delta * 0.4;
  updateMovement(delta);
  updateCamera(delta);
  updateBots(delta);
  updateEnterPrompt();
  Object.values(otherPlayers).forEach(o => {
    const m = o.mesh, t = o.target;
    // Pemain di zona lain tidak terlihat (privasi ruangan)
    m.visible = (o.zone || "luar") === currentZone;
    if (!m.visible) return;
    const before = m.position.clone();
    m.position.lerp(new THREE.Vector3(t.x, t.y, t.z), Math.min(1, delta * 10));
    const moved = m.position.distanceTo(before);
    m.rotation.y = lerpAngle(m.rotation.y, t.rotY, Math.min(1, delta * 10));
    animateAvatar(m, o.moving || moved > 0.001, 0.6, delta, Math.abs(t.y - m.position.y) > 0.15);
  });
  renderer.render(scene, camera);
}
animate();
