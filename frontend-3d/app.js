// ============================================================
// Dunia 3D Multiplayer v6 — Roblox-style + live together
// v6: dunia lebih besar (limit 45), interior lebih detail, Bioskop Mini,
// v6.1: pintu Bioskop keluar dari tembok (dulu terkubur), id pemain disimpan
//      di sessionStorage (hitungan tidak melonjak saat reload), emote 6 detik.
//     emote tersinkron (dadah/joget/ketawa/tidur/duduk/sayang),
//     aksi bareng: tidur di kasur, masak + makan, cemilan, musik (WebAudio),
//     nonton TV bareng (layar animasi) — semua tersinkron via Supabase.
// Avatar blocky beranimasi + kota kecil + lompat/lari + kamera orbit
// v3: 3 bangunan bisa dimasuki (Rumah, Kafe, Ruangan Berdua privat max 2 orang)
// v4: D-pad diganti joystick ANALOG — dorong dikit = jalan pelan,
//      dorong mentok = lari. Kecepatan ikut seberapa jauh stick didorong.
// Nama Ruangan Berdua: "Ghoz & Adel" (Adel, ultah 16 Januari).
// v5: Socket.IO diganti Supabase Realtime (presence + broadcast).
//      Tidak butuh server backend lagi — frontend saja di Vercel,
//      pemain saling lihat lewat channel Supabase 'dunia-3d'.
// v5.1: auto-reconnect — kalau channel putus (CHANNEL_ERROR / TIMED_OUT /
//      CLOSED) status jadi "🟡 Menghubungkan ulang..." dan channel dibuat
//      ulang dengan backoff 2s → 4s → 8s (maks 10s), presence di-track
//      ulang saat SUBSCRIBED; cek keamanan tiap 5 detik juga memicu retry.
// v5.2: hitungan pemain pakai id unik — reconnect sempat bikin satu pemain
//      kehitung dua kali (tampil "3 pemain" padahal cuma 2 tab).
// v6: lihat atas — dunia besar + emote + aksi live-together.
// ============================================================
const SUPABASE_URL = "https://euywpjczkchpvtkpvbps.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eXdwamN6a2NocHZ0a3B2YnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNTM4MTksImV4cCI6MjExMDkyOTgxOX0.cqUnF7MkI0GJC2HBu1qROyo8RSIJCw3k8X5QlVpw59g";
const COUPLE_NAMES = "Ghoz & Adel";
const WORLD_LIMIT = 45;
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
scene.fog = new THREE.Fog(0x9fd0ee, 55, 150);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 260);
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
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
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
}, 28, 28);
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

const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// Plaza bundar di tengah (spawn)
const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9 }));
plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true; scene.add(plaza);
// Jalan salib
[0, Math.PI / 2].forEach(rot => {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(110, 6), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 1 }));
  road.rotation.x = -Math.PI / 2; road.rotation.z = rot; road.position.y = 0.015; road.receiveShadow = true; scene.add(road);
});

// ---------------- Gedung ----------------
const buildingDefs = [
  { x: -22, z: -20, w: 9, h: 12, d: 8, c: "#e07a5f" }, { x: -10, z: -23, w: 8, h: 8, d: 7, c: "#81b29a" },
  { x: 4, z: -23, w: 10, h: 15, d: 8, c: "#f2cc8f" }, { x: 18, z: -21, w: 8, h: 10, d: 8, c: "#6d9dc5" },
  { x: -23, z: 8, w: 8, h: 9, d: 9, c: "#b5838d" }, { x: -22, z: 21, w: 9, h: 13, d: 7, c: "#8ab17d" },
  { x: 22, z: 12, w: 9, h: 11, d: 8, c: "#e07a5f" }, { x: 21, z: -8, w: 7, h: 7, d: 7, c: "#f2cc8f" },
  { x: 10, z: 23, w: 9, h: 9, d: 7, c: "#6d9dc5" }, { x: -8, z: 23, w: 8, h: 12, d: 7, c: "#81b29a" },
  { x: -34, z: 14, w: 9, h: 10, d: 8, c: "#8e6cc8" }, // Bioskop Mini (bisa dimasuki)
  { x: -38, z: -32, w: 10, h: 14, d: 8, c: "#e07a5f" }, { x: 34, z: -34, w: 9, h: 12, d: 8, c: "#81b29a" },
  { x: -40, z: 30, w: 9, h: 11, d: 8, c: "#f2cc8f" }, { x: 36, z: 32, w: 10, h: 13, d: 8, c: "#6d9dc5" },
  { x: 0, z: -42, w: 11, h: 10, d: 8, c: "#b5838d" }, { x: -36, z: -8, w: 8, h: 9, d: 7, c: "#8ab17d" },
  { x: 40, z: 0, w: 8, h: 10, d: 7, c: "#e07a5f" }, { x: 14, z: 40, w: 9, h: 12, d: 7, c: "#f2cc8f" },
  { x: -30, z: 40, w: 8, h: 10, d: 7, c: "#6d9dc5" }, { x: 36, z: -20, w: 8, h: 9, d: 7, c: "#81b29a" },
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
[[-14, -12], [14, -14], [-16, 16], [16, 18], [-6, -16], [8, 16], [-26, -2], [26, 2], [2, -18], [-2, 18],
  [-36, -24], [36, -26], [-40, 20], [40, 24], [-30, 33], [30, 38], [12, -38], [-12, -40], [42, -12], [-42, 4], [6, 40], [42, 14]].forEach(p => addTree(p[0], p[1], 0.9 + Math.random() * 0.5));

function addLamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x333340 }));
  pole.position.y = 1.7; pole.castShadow = true; g.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffd76e, emissiveIntensity: 0.9 }));
  bulb.position.y = 3.5; g.add(bulb);
  g.position.set(x, 0, z); scene.add(g); addCircleCollider(x, z, 0.25);
}
[[-4, -4], [4, -4], [-4, 4], [4, 4], [-12, 3.5], [12, -3.5],
  [-14, -14], [14, -14], [-14, 14], [14, 14], [-36, 0], [32, 0], [0, -36], [0, 36]].forEach(p => addLamp(p[0], p[1]));

function addBench(x, z, rotY) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9c6b30, roughness: 0.9 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.6), wood); seat.position.y = 0.5; seat.castShadow = true; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.12), wood); back.position.set(0, 0.9, -0.28); back.castShadow = true; g.add(back);
  g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g); addBoxCollider(x, z, 1.2, 0.5);
}
addBench(-6, 7, 0.4); addBench(6, -7, -2.7); addBench(7, 6, -0.8); addBench(-14, 30, 0.2); addBench(14, -30, -2.9); addBench(30, 4, -1.2); addBench(-30, -4, 1.2);

// Air mancur di (0,-13) — bukan di spawn
const fountain = new THREE.Group();
const fBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 24), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.8 }));
fBase.position.y = 0.35; fBase.castShadow = true; fountain.add(fBase);
const fWater = new THREE.Mesh(new THREE.CircleGeometry(2.3, 24), new THREE.MeshStandardMaterial({ color: 0x4db2e8, roughness: 0.2, metalness: 0.1 }));
fWater.rotation.x = -Math.PI / 2; fWater.position.y = 0.68; fountain.add(fWater);
const fTop = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.1, 12), new THREE.MeshStandardMaterial({ color: 0xcfc8b8 }));
fTop.position.y = 1.0; fTop.castShadow = true; fountain.add(fTop);
fountain.position.set(0, 0, -13); scene.add(fountain); addCircleCollider(0, -13, 2.9);

// Kolam kecil di timur (32,24) + taman bermain di barat laut (-26,-37)
const pond = new THREE.Mesh(new THREE.CircleGeometry(3, 28), new THREE.MeshStandardMaterial({ color: 0x4db2e8, roughness: 0.2, metalness: 0.1 }));
pond.rotation.x = -Math.PI / 2; pond.position.set(32, 0.03, 24); pond.receiveShadow = true; scene.add(pond);
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2;
  const st = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 1 }));
  st.position.set(32 + Math.cos(a) * 3.3, 0.18, 24 + Math.sin(a) * 3.3); st.castShadow = true; scene.add(st);
}
addCircleCollider(32, 24, 3.4);
// Ayunan
(function () {
  const g = new THREE.Group();
  const poleM = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.6 });
  [[-1.2, 0], [1.2, 0]].forEach(p => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), poleM);
    pole.position.set(p[0], 1.3, 0); pole.castShadow = true; g.add(pole);
  });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), poleM);
  bar.rotation.z = Math.PI / 2; bar.position.y = 2.6; g.add(bar);
  [[-0.4], [0.4]].forEach(p => {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    rope.position.set(p[0], 2.05, 0); g.add(rope);
  });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.45), new THREE.MeshStandardMaterial({ color: 0xff5c7a }));
  seat.position.y = 1.5; seat.castShadow = true; g.add(seat);
  g.position.set(-28, 0, -37); scene.add(g); addBoxCollider(-28, -37, 1.5, 0.4);
})();
// Perosotan
(function () {
  const g = new THREE.Group();
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 3.2), new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.6 }));
  slide.position.set(0, 1.1, 0); slide.rotation.x = 0.5; slide.castShadow = true; g.add(slide);
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.15), new THREE.MeshStandardMaterial({ color: 0x888899 }));
  ladder.position.set(0, 1.1, -1.7); ladder.castShadow = true; g.add(ladder);
  g.position.set(-23.5, 0, -38); scene.add(g); addBoxCollider(-23.5, -38, 1.0, 1.8);
})();

// Semak + batu
[[-18, 4, 0.9], [18, -16, 1.1], [-12, 20, 0.8], [12, 20, 1], [-38, -14, 1], [38, 14, 1.1], [-14, 42, 0.9], [14, -42, 1], [44, 34, 1], [-44, -20, 1]].forEach(p => {
  const bush = new THREE.Mesh(new THREE.SphereGeometry(p[2], 10, 10), new THREE.MeshStandardMaterial({ color: 0x3a7d2e, roughness: 1 }));
  bush.position.set(p[0], p[2] * 0.55, p[1]); bush.scale.y = 0.7; bush.castShadow = true; scene.add(bush);
});

// Pagar batas dunia (rendah, ala Roblox baseplate)
const fenceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
[[0, -47, 94, 0.4], [0, 47, 94, 0.4], [-47, 0, 0.4, 94], [47, 0, 0.4, 94]].forEach(w => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w[2], 1.0, w[3]), fenceMat);
  m.position.set(w[0], 0.5, w[1]); m.castShadow = true; m.receiveShadow = true; scene.add(m);
});

// ---------------- v3: INTERIOR — bangunan bisa dimasuki ----------------
// Zona: 'luar' | 'rumah' | 'kafe' | 'berdua' (privat, max 2 orang) | 'bioskop'
let currentZone = "luar";
const INTERIORS = {
  rumah: { cx: 80, cz: 0, w: 14, d: 10, label: "Rumah", floor: 0xb08968, wall: 0xf5e6c8, furniture: [] },
  kafe: { cx: 80, cz: 30, w: 14, d: 10, label: "Kafe", floor: 0x8a5a3b, wall: 0xffe8c2, furniture: [] },
  berdua: { cx: 80, cz: -30, w: 12, d: 9, label: "Ruangan Berdua", floor: 0xd98a9e, wall: 0xffd6e0, furniture: [] },
  bioskop: { cx: 80, cz: 60, w: 12, d: 9, label: "Bioskop Mini", floor: 0x4a3a6b, wall: 0x2e2140, furniture: [] },
};
// Status media per zona (tersinkron via Supabase): tv + musik
const zoneMedia = { rumah: { tv: false }, kafe: { tv: false }, berdua: { tv: false, music: false }, bioskop: { tv: false } };
// Layar TV per zona: {mesh, canvas, ctx, tex, matOn, matOff}
const tvScreens = {};
function makeTVScreen(zoneKey, w, h, x, y, z, parent) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 144;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111"; ctx.fillRect(0, 0, 256, 144);
  const tex = new THREE.CanvasTexture(canvas);
  const matOn = new THREE.MeshBasicMaterial({ map: tex });
  const matOff = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.4, metalness: 0.4 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), matOff);
  mesh.position.set(x, y, z); parent.add(mesh);
  // Bingkai layar
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  frame.position.set(x, y, z - 0.05); parent.add(frame);
  tvScreens[zoneKey] = { mesh, canvas, ctx, tex, matOn, matOff };
  return mesh;
}
function drawTVScreen(zoneKey, t) {
  const tv = tvScreens[zoneKey]; if (!tv) return;
  const { ctx } = tv; const hue = (t * 35) % 360;
  const grad = ctx.createLinearGradient(0, 0, 256, 144);
  grad.addColorStop(0, "hsl(" + hue + ",80%,55%)"); grad.addColorStop(1, "hsl(" + ((hue + 90) % 360) + ",80%,45%)");
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 144);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 3; i++) {
    const bx = 40 + ((t * 30 + i * 80) % 220);
    ctx.beginPath(); ctx.arc(bx, 55 + Math.sin(t * 2 + i) * 18, 16, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, 108, 256, 36);
  ctx.fillStyle = "#fff"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
  ctx.fillText("▶ SEDANG TAYANG", 128, 133);
  tv.tex.needsUpdate = true;
}
function setTV(zoneKey, on) {
  const tv = tvScreens[zoneKey]; if (!tv) return;
  if (zoneMedia[zoneKey]) zoneMedia[zoneKey].tv = on;
  tv.mesh.material = on ? tv.matOn : tv.matOff;
  if (on) drawTVScreen(zoneKey, elapsed);
}
// Pintu di luar (depan gedung). Gedung yang bisa dimasuki:
// Rumah = gedung hijau di (-10,-23), Kafe = gedung kuning di (4,-23),
// Ruangan Berdua = gedung biru di (10,23), Bioskop Mini = gedung ungu di (-34,14).
const DOORS = [
  { x: -10, z: -19.2, zone: "rumah", label: "RUMAH" },
  { x: 4, z: -18.7, zone: "kafe", label: "KAFE" },
  { x: 10, z: 19.2, zone: "berdua", label: "RUANGAN BERDUA" },
  { x: -34, z: 18.3, zone: "bioskop", label: "BIOSKOP MINI" }, // pintu 0,3 di luar dinding selatan (z=18) — dulu 17,7, terkubur di dalam tembok
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
  const pl = new THREE.PointLight(0xffe9a3, 0.7, 14); pl.position.set(0, 2.6, 0); g.add(pl);
  const furn = (lx, lz, hx, hz) => it.furniture.push({ x: it.cx + lx, z: it.cz + lz, hx, hz });
  if (zoneKey === "rumah") {
    // --- Ruang tamu (barat) ---
    boxAt(-4.5, 0.25, -2.5, 2.6, 0.5, 1.0, 0x7a5230, g); // sofa
    boxAt(-4.5, 0.75, -3.0, 2.6, 0.8, 0.25, 0x7a5230, g);
    furn(-4.5, -2.5, 1.4, 0.6);
    boxAt(-4.5, 0.3, -0.9, 1.8, 0.6, 0.9, 0x9c6b30, g); // meja kopi
    furn(-4.5, -0.9, 1.0, 0.55);
    makeTVScreen("rumah", 2.6, 1.5, -4.5, 1.3, -4.8, g); // TV dinding utara
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-4.5, 0.04, 0.3); g.add(rug);
    boxAt(-6.6, 1.1, -3.0, 0.6, 2.2, 2.0, 0x5b4a3a, g); // rak buku
    furn(-6.6, -3.0, 0.4, 1.1);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0x333340 }));
    fl.position.set(-6.4, 0.9, 1.6); g.add(fl);
    const flb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffd76e, emissiveIntensity: 1 }));
    flb.position.set(-6.4, 1.9, 1.6); g.add(flb); furn(-6.4, 1.6, 0.3, 0.3);
    // --- Dapur (timur utara) ---
    boxAt(4.6, 0.5, -4.4, 4.2, 1.0, 0.9, 0xdddddd, g); // meja dapur
    furn(4.6, -4.4, 2.2, 0.55);
    boxAt(3.4, 1.15, -4.4, 1.0, 0.3, 0.8, 0x333333, g); // kompor
    boxAt(5.6, 1.05, -4.4, 0.8, 0.15, 0.6, 0x4db2e8, g); // wastafel
    boxAt(6.4, 1.1, -3.6, 1.2, 2.2, 1.0, 0xeeeeee, g); // kulkas
    furn(6.4, -3.6, 0.7, 0.6);
    // --- Kamar tidur (timur selatan) ---
    boxAt(4.8, 0.3, 2.9, 1.7, 0.6, 2.4, 0x5c8dff, g); // kasur single
    boxAt(4.8, 0.65, 3.9, 1.2, 0.25, 0.5, 0xffffff, g); // bantal
    boxAt(4.8, 0.65, 2.6, 1.7, 0.15, 1.4, 0xe75480, g); // selimut
    furn(4.8, 2.9, 0.95, 1.3);
    boxAt(6.4, 0.35, 1.6, 0.8, 0.7, 0.8, 0x9c6b30, g); // nakas
    furn(6.4, 1.6, 0.5, 0.5);
    // --- Meja makan (tengah) ---
    boxAt(0.3, 0.35, 2.2, 2.4, 0.7, 1.3, 0x9c6b30, g);
    furn(0.3, 2.2, 1.3, 0.75);
    boxAt(0.3, 0.25, 0.9, 0.6, 0.5, 0.6, 0x7a5230, g); boxAt(0.3, 0.25, 3.5, 0.6, 0.5, 0.6, 0x7a5230, g);
    furn(0.3, 0.9, 0.4, 0.4); furn(0.3, 3.5, 0.4, 0.4);
  } else if (zoneKey === "kafe") {
    // --- Kasir + menu ---
    boxAt(-5.2, 0.55, -3.6, 4.6, 1.1, 0.9, 0x5b4a3a, g); // meja kasir
    furn(-5.2, -3.6, 2.4, 0.55);
    boxAt(-5.2, 2.0, -4.8, 3.4, 1.6, 0.12, 0x222222, g); // papan menu
    const menuLab = createLabel("MENU ☕ 🍰");
    menuLab.position.set(-5.2, 2.0, -4.6); menuLab.scale.set(2.6, 0.65, 1); g.add(menuLab);
    // --- Etalase cemilan ---
    boxAt(-1.2, 0.5, -3.9, 2.6, 1.0, 0.9, 0xbfe3ff, g);
    furn(-1.2, -3.9, 1.4, 0.55);
    [[-2.0, 0xff8fab], [-1.4, 0xffc857], [-0.8, 0x5ce1a6], [-0.2, 0xc77dff]].forEach(p => {
      boxAt(p[0], 1.2, -3.9, 0.45, 0.35, 0.45, p[1], g); // kue/cemilan warna-warni
    });
    // --- 4 meja + kursi ---
    [[-2.5, 0.6], [1.8, 0.6], [-2.5, 3.0], [1.8, 3.0]].forEach(p => {
      boxAt(p[0], 0.4, p[1], 1.4, 0.8, 1.4, 0xffffff, g);
      furn(p[0], p[1], 0.8, 0.8);
      boxAt(p[0] - 1.1, 0.25, p[1], 0.55, 0.5, 0.55, 0x9c6b30, g);
      boxAt(p[0] + 1.1, 0.25, p[1], 0.55, 0.5, 0.55, 0x9c6b30, g);
      furn(p[0] - 1.1, p[1], 0.35, 0.35); furn(p[0] + 1.1, p[1], 0.35, 0.35);
    });
    // --- Tanaman + lampu gantung ---
    [[6.4, -4.2], [-6.5, 4.2]].forEach(p => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xc06b4a }));
      pot.position.set(p[0], 0.25, p[1]); pot.castShadow = true; g.add(pot);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10), new THREE.MeshStandardMaterial({ color: 0x2f8f3a }));
      leaf.position.set(p[0], 0.9, p[1]); leaf.castShadow = true; g.add(leaf);
      furn(p[0], p[1], 0.4, 0.4);
    });
    [[-2, 2.6], [2, 2.6]].forEach(p => {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffd76e, emissiveIntensity: 1 }));
      hl.position.set(p[0], 2.6, p[1]); g.add(hl);
    });
  } else if (zoneKey === "berdua") {
    // Ranjang double + bantal + selimut
    boxAt(-2.8, 0.35, -2.3, 3.2, 0.7, 2.2, 0xff8fab, g);
    boxAt(-3.6, 0.6, -3.2, 1.1, 0.3, 0.45, 0xffffff, g); boxAt(-2.0, 0.6, -3.2, 1.1, 0.3, 0.45, 0xffffff, g);
    boxAt(-2.8, 0.72, -1.9, 3.2, 0.12, 1.3, 0xe75480, g);
    furn(-2.8, -2.3, 1.7, 1.2);
    // Sofa berdua menghadap TV (dinding utara)
    boxAt(3.2, 0.25, 2.0, 2.4, 0.5, 1.0, 0xe75480, g);
    boxAt(3.2, 0.75, 2.55, 2.4, 0.8, 0.25, 0xe75480, g);
    furn(3.2, 2.0, 1.3, 0.6);
    makeTVScreen("berdua", 2.4, 1.4, 3.2, 1.3, -4.3, g); // TV dinding utara
    // Meja makan kecil + lilin
    boxAt(0.3, 0.3, -0.6, 1.3, 0.6, 0.9, 0x9c6b30, g);
    furn(0.3, -0.6, 0.75, 0.55);
    [[0.0, 0.75], [0.6, 0.75]].forEach(p => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffb703, emissiveIntensity: 1.2 }));
      c.position.set(it.cx + p[0], 0.8, it.cz - 0.6); scene.add(c);
    });
    // Radio / pemutar musik (barat utara)
    boxAt(-5.3, 0.45, -3.6, 1.0, 0.9, 0.6, 0x9c6b30, g); // meja radio
    furn(-5.3, -3.6, 0.6, 0.45);
    boxAt(-5.3, 1.15, -3.6, 0.9, 0.5, 0.4, 0x333340, g); // radio
    [[-5.55], [-5.05]].forEach(p => {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
      sp.rotation.x = Math.PI / 2; sp.position.set(p[0], 1.15, -3.38); g.add(sp);
    });
    // Karpet + lampu lantai
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshStandardMaterial({ color: 0xff4d6d, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.04, 1.2); g.add(rug);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0x333340 }));
    fl.position.set(-5.3, 0.9, 3.6); g.add(fl);
    const flb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffd76e, emissiveIntensity: 1 }));
    flb.position.set(-5.3, 1.9, 3.6); g.add(flb); furn(-5.3, 3.6, 0.3, 0.3);
    // Hiasan hati di dinding utara (dua bola + kerucut, pink)
    const heart = new THREE.Group();
    const hm = new THREE.MeshStandardMaterial({ color: 0xff4d6d, roughness: 0.6 });
    [[-0.35, 0, 0], [0.35, 0, 0]].forEach(p => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), hm); s.position.set(p[0], p[1], p[2]); heart.add(s); });
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 4), hm); tri.position.set(0, -0.45, 0); tri.rotation.x = Math.PI; tri.rotation.y = Math.PI / 4; heart.add(tri);
    heart.position.set(it.cx, 2.0, it.cz - it.d / 2 + 0.25); heart.scale.setScalar(1.1); scene.add(heart);
    // Papan nama pasangan
    const sign = createLabel(COUPLE_NAMES + " ♥");
    sign.position.set(0, 2.6, 0); sign.scale.set(2.4, 0.6, 1); g.add(sign);
  } else if (zoneKey === "bioskop") {
    // Layar besar di dinding utara
    makeTVScreen("bioskop", 8, 3.2, 0, 1.9, -4.3, g);
    // 2 baris x 4 kursi
    [[-4.5, -0.6], [-1.5, -0.6], [1.5, -0.6], [4.5, -0.6], [-4.5, 1.7], [-1.5, 1.7], [1.5, 1.7], [4.5, 1.7]].forEach(p => {
      boxAt(p[0], 0.22, p[1], 1.3, 0.45, 1.0, 0x8e2f3c, g);
      boxAt(p[0], 0.75, p[1] + 0.55, 1.3, 0.9, 0.25, 0x8e2f3c, g);
      furn(p[0], p[1], 0.75, 0.65);
    });
    // Stand popcorn (timur selatan)
    boxAt(5.2, 0.55, 3.6, 1.3, 1.1, 1.0, 0xd62828, g);
    boxAt(5.2, 1.25, 3.6, 0.7, 0.35, 0.7, 0xffffff, g); // mangkuk popcorn
    furn(5.2, 3.6, 0.75, 0.6);
    // Karpet lorong tengah + lampu dinding
    const aisle = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 6.0), new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 1 }));
    aisle.position.set(0, 0.04, 0.5); g.add(aisle);
    [[-5.7, -2], [5.7, -2]].forEach(p => {
      const wl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffd76e, emissiveIntensity: 1 }));
      wl.position.set(p[0], 2.2, p[1]); g.add(wl);
    });
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
  applyMediaFromPresence();
  publishPresenceNow(); // kabari pemain lain langsung soal pindah zona
}
function exitZone() {
  const prevZone = currentZone;
  const door = DOORS.find(d => d.zone === currentZone);
  currentZone = "luar"; myData.zone = "luar";
  if (prevZone === "berdua") stopMusic(); // musik cuma di Ruangan Berdua
  refreshMediaState();
  if (door) { myData.x = door.x; myData.z = door.z + 1.8; }
  myData.y = 0; myData.vy = 0; myData.rotY = 0;
  myMesh.position.set(myData.x, 0, myData.z);
  setStatus(netOnline ? "🟢 Online" : "🔴 Offline");
  updateEnterPrompt();
  publishPresenceNow(); // kabari pemain lain langsung soal pindah zona
}
function countInBerdua() {
  if (!channel) return 0;
  return Object.values(channel.presenceState()).flat()
    .filter(p => p && p.zone === "berdua" && p.id !== playerId).length;
}
function tryEnterExit() {
  if (currentZone !== "luar") { exitZone(); return; }
  const d = nearestDoor(); if (!d) return;
  // Ruangan Berdua privat max 2 orang — cek dari presence Supabase
  if (d.zone === "berdua" && countInBerdua() >= 2) {
    setStatus("🔒 Ruangan Berdua sudah penuh (max 2 orang)");
    return;
  }
  enterZone(d.zone);
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
  // Sprite emote (disembunyikan sampai emote aktif)
  const zzz = createLabel("Zzz"); zzz.position.set(0, 3.4, 0); zzz.scale.set(1.5, 0.38, 1); zzz.visible = false; group.add(zzz);
  const heart = createLabel("❤"); heart.position.set(0, 3.4, 0); heart.scale.set(1.1, 0.28, 1); heart.visible = false; group.add(heart);
  group.userData = { phase: Math.random() * 6, armL, armR, legL, legR, head, moving: false, speedNorm: 0, zzz, heart };
  scene.add(group);
  return group;
}
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Emote: wave (dadah), dance (joget), laugh (ketawa), sleep (tidur),
// sit (duduk), love (sayang), cook (masak — internal, bukan tombol).
function animateAvatar(mesh, moving, speedNorm, delta, airborne, emote) {
  const u = mesh.userData;
  const em = emote || "";
  // Sprite emote
  if (u.zzz) u.zzz.visible = (em === "sleep");
  if (u.heart) u.heart.visible = (em === "love");
  if (moving) u.phase += delta * (6 + 7 * speedNorm);
  const target = moving ? Math.sin(u.phase) * 0.85 : 0;
  const k = Math.min(1, delta * 14);
  // Pose berbaring / duduk (rotasi grup X; posisi Y diatur pemanggil)
  const lieTarget = (em === "sleep") ? -1.35 : 0;
  mesh.rotation.x += (lieTarget - mesh.rotation.x) * k;
  if (u.head) u.head.rotation.z += ((em === "laugh" ? Math.sin(elapsed * 8) * 0.35 : 0) - u.head.rotation.z) * k;
  if (em === "dance") {
    u.phase += delta * 14;
    const d = Math.sin(u.phase);
    u.armL.rotation.x += (-2.8 + d * 0.4 - u.armL.rotation.x) * k;
    u.armR.rotation.x += (-2.8 - d * 0.4 - u.armR.rotation.x) * k;
    u.legL.rotation.x += (d * 0.9 - u.legL.rotation.x) * k;
    u.legR.rotation.x += (-d * 0.9 - u.legR.rotation.x) * k;
  } else if (em === "wave") {
    u.armR.rotation.x += (-2.7 + Math.sin(elapsed * 12) * 0.45 - u.armR.rotation.x) * k;
    u.armL.rotation.x += (0 - u.armL.rotation.x) * k;
    u.legL.rotation.x += (0 - u.legL.rotation.x) * k;
    u.legR.rotation.x += (0 - u.legR.rotation.x) * k;
  } else if (em === "love") {
    u.armL.rotation.x += (-2.4 - u.armL.rotation.x) * k;
    u.armR.rotation.x += (-2.4 - u.armR.rotation.x) * k;
    u.legL.rotation.x += (Math.sin(elapsed * 6) * 0.25 - u.legL.rotation.x) * k;
    u.legR.rotation.x += (-Math.sin(elapsed * 6) * 0.25 - u.legR.rotation.x) * k;
  } else if (em === "laugh") {
    u.armL.rotation.x += (-0.9 + Math.sin(elapsed * 10) * 0.3 - u.armL.rotation.x) * k;
    u.armR.rotation.x += (-0.9 - Math.sin(elapsed * 10) * 0.3 - u.armR.rotation.x) * k;
    u.legL.rotation.x += (Math.sin(elapsed * 10) * 0.2 - u.legL.rotation.x) * k;
    u.legR.rotation.x += (-Math.sin(elapsed * 10) * 0.2 - u.legR.rotation.x) * k;
  } else if (em === "sit") {
    u.armL.rotation.x += (-0.5 - u.armL.rotation.x) * k;
    u.armR.rotation.x += (-0.5 - u.armR.rotation.x) * k;
    u.legL.rotation.x += (-1.5 - u.legL.rotation.x) * k;
    u.legR.rotation.x += (-1.5 - u.legR.rotation.x) * k;
  } else if (em === "sleep") {
    u.armL.rotation.x += (0.2 - u.armL.rotation.x) * k;
    u.armR.rotation.x += (0.2 - u.armR.rotation.x) * k;
    u.legL.rotation.x += (0 - u.legL.rotation.x) * k;
    u.legR.rotation.x += (0 - u.legR.rotation.x) * k;
  } else if (em === "cook") {
    u.armR.rotation.x += (-1.2 + Math.sin(elapsed * 15) * 0.5 - u.armR.rotation.x) * k;
    u.armL.rotation.x += (-0.6 - u.armL.rotation.x) * k;
    u.legL.rotation.x += (0 - u.legL.rotation.x) * k;
    u.legR.rotation.x += (0 - u.legR.rotation.x) * k;
  } else if (airborne) {
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

// ---------------- v6: EMOTE + MUSIK + MAKANAN + AKSI LIVE-TOGETHER ----------------
const EMOTES = { wave: "👋 Dadah", dance: "💃 Joget", laugh: "😂 Ketawa", sleep: "😴 Tidur", sit: "🪑 Duduk", love: "❤️ Sayang" };
const EMOTE_TIMED = { wave: 1, dance: 1, laugh: 1, love: 1 }; // habis ~6 detik; sleep/sit menetap
let myEmote = { name: "", until: 0 };
let mySleep = false;          // tidur di kasur (bangun kalau gerak / tekan aksi lagi)
let myCookingUntil = 0;       // timestamp selesai masak
let cookSteamTimer = 0;
function setEmote(name) {
  if (myEmote.name === name) { clearEmote(); return; }
  myEmote.name = name;
  myEmote.until = EMOTE_TIMED[name] ? performance.now() + 6000 : 0;
  publishPresenceNow();
}
function clearEmote() {
  if (!myEmote.name) return;
  myEmote.name = ""; myEmote.until = 0;
  publishPresenceNow();
}

// --- Musik (WebAudio, tanpa file eksternal): melodi ceria looping ---
const MELODY = [[72, .5], [76, .5], [79, .5], [76, .5], [81, 1], [79, .5], [76, .5], [72, 1], [74, .5], [77, .5], [81, .5], [77, .5], [79, 1], [76, .5], [74, .5], [72, 1]];
const BEAT = 0.30;
let audioCtx = null, musicGain = null, musicTimer = null, musicOn = false, musicMuted = false;
let melIdx = 0, melNext = 0;
function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function ensureAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioCtx = new AC();
      musicGain = audioCtx.createGain(); musicGain.gain.value = musicMuted ? 0 : 0.15;
      musicGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return true;
  } catch (e) { return false; }
}
function playNote(midi, when, dur) {
  const o = audioCtx.createOscillator(); o.type = "triangle"; o.frequency.value = midiHz(midi);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.5, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.95);
  o.connect(g); g.connect(musicGain); o.start(when); o.stop(when + dur);
}
function startMusic() {
  if (musicOn) return;
  if (!ensureAudio()) return;
  musicOn = true; melIdx = 0; melNext = audioCtx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!audioCtx) return;
    while (melNext < audioCtx.currentTime + 0.4) {
      const nt = MELODY[melIdx % MELODY.length];
      playNote(nt[0], melNext, nt[1] * BEAT);
      melNext += nt[1] * BEAT; melIdx++;
    }
  }, 120);
}
function stopMusic() {
  musicOn = false;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
document.addEventListener("pointerdown", () => { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); });

// --- Makanan bersama (satu spot aktif per zona, tersinkron via broadcast) ---
const foodSpots = {}; // zone -> {mesh, kind, x, z}
function makeFoodMesh(kind) {
  const g = new THREE.Group();
  if (kind === "pizza") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0xffb703 }));
    base.position.y = 0.04; g.add(base);
    [[0.12, 0.1], [-0.1, 0.12], [0, -0.12]].forEach(t => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: 0x2f8f3a }));
      top.position.set(t[0], 0.1, t[1]); g.add(top);
    });
  } else if (kind === "snack") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xff8fab }));
    b.position.y = 0.15; g.add(b);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.06, 0.32), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    top.position.y = 0.32; g.add(top);
  } else { // popcorn
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    cup.position.y = 0.16; g.add(cup);
    const pop = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfff2cc }));
    pop.position.y = 0.36; pop.scale.y = 0.6; g.add(pop);
  }
  return g;
}
function spawnFood(zone, kind, x, z, y) {
  removeFood(zone);
  const mesh = makeFoodMesh(kind);
  mesh.position.set(x, y || 0.8, z); scene.add(mesh);
  foodSpots[zone] = { mesh, kind, x, z };
}
function removeFood(zone) {
  const f = foodSpots[zone];
  if (f) { scene.remove(f.mesh); delete foodSpots[zone]; }
}
function broadcastFood(zone, kind, x, z, y) {
  if (channel && netOnline) channel.send({ type: "broadcast", event: "food", payload: { zone, kind, x, z, y } });
  spawnFood(zone, kind, x, z, y);
}
function eatFood() {
  if (!foodSpots[currentZone]) return;
  if (channel && netOnline) channel.send({ type: "broadcast", event: "eat", payload: { zone: currentZone } });
  removeFood(currentZone);
  setStatus("😋 Nyam nyam! Enak banget");
  setTimeout(() => setStatus(netOnline ? "🟢 Online" : "🔴 Offline"), 2500);
}

// --- Uap masakan ---
const steamPuffs = [];
function spawnSteam(x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  m.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
  scene.add(m); steamPuffs.push({ mesh: m, life: 0 });
}
function updateSteam(delta) {
  for (let i = steamPuffs.length - 1; i >= 0; i--) {
    const pf = steamPuffs[i]; pf.life += delta;
    pf.mesh.position.y += delta * 1.1;
    pf.mesh.material.opacity = Math.max(0, 0.75 - pf.life * 0.6);
    if (pf.life > 1.2) { scene.remove(pf.mesh); steamPuffs.splice(i, 1); }
  }
}

// --- Aksi kontekstual (F / tombol aksi) ---
const INTERACTABLES = [
  { id: "bed_rumah", zone: "rumah", x: 84.8, z: 2.9, r: 2.4, label: "😴 Tidur di kasur", action: "sleep" },
  { id: "bed_berdua", zone: "berdua", x: 77.2, z: -32.3, r: 2.4, label: "😴 Tidur di kasur", action: "sleep" },
  { id: "stove", zone: "rumah", x: 83.4, z: -4.4, r: 2.2, label: "🍳 Masak", action: "cook" },
  { id: "snack", zone: "kafe", x: 78.8, z: 26.1, r: 2.2, label: "🧁 Ambil cemilan", action: "snack" },
  { id: "radio", zone: "berdua", x: 74.7, z: -33.6, r: 2.2, label: "🎵 Putar musik", action: "music" },
  { id: "tv_rumah", zone: "rumah", x: 75.5, z: -4.7, r: 2.6, label: "📺 Nonton TV", action: "tv" },
  { id: "tv_berdua", zone: "berdua", x: 83.2, z: -34.3, r: 2.6, label: "📺 Nonton TV", action: "tv" },
  { id: "screen", zone: "bioskop", x: 80, z: 55.7, r: 3.0, label: "📺 Putar film", action: "tv" },
  { id: "popcorn", zone: "bioskop", x: 85.2, z: 63.6, r: 2.2, label: "🍿 Ambil popcorn", action: "popcorn" },
];
let currentAction = null;
function nearestInteractable() {
  if (currentZone === "luar") return null;
  let best = null, bd = 1e9;
  INTERACTABLES.forEach(a => {
    if (a.zone !== currentZone) return;
    const d = Math.hypot(myData.x - a.x, myData.z - a.z);
    if (d < a.r && d < bd) { bd = d; best = a; }
  });
  return best;
}
function updateActionPrompt() {
  const el = document.getElementById("actionPrompt"), btn = document.getElementById("actionBtn");
  if (!el || !btn) return;
  let label = null, action = null;
  const food = foodSpots[currentZone];
  if (food && Math.hypot(myData.x - food.x, myData.z - food.z) < 2.4) { label = "🍽️ Makan"; action = { action: "eat" }; }
  else if (mySleep) { label = "☀️ Bangun"; action = { action: "wake" }; }
  else {
    const a = nearestInteractable();
    if (a) {
      label = a.label; action = a;
      if (a.action === "music") label = zoneMedia.berdua.music ? "⏸️ Matikan musik" : "🎵 Putar musik";
      if (a.action === "tv") label = (zoneMedia[currentZone] && zoneMedia[currentZone].tv) ? "⏸️ Matikan TV" : "📺 Nonton TV";
    }
  }
  currentAction = action;
  if (label) { el.textContent = label + " — tekan F"; el.style.display = "block"; btn.textContent = label; btn.style.display = "block"; }
  else { el.style.display = "none"; btn.style.display = "none"; }
}
function doAction() {
  const a = currentAction; if (!a) return;
  if (a.action === "eat") eatFood();
  else if (a.action === "wake") wakeUp();
  else if (a.action === "sleep") sleepAt(a);
  else if (a.action === "cook") startCooking();
  else if (a.action === "snack") broadcastFood("kafe", "snack", 77.5, 30.6, 0.85);
  else if (a.action === "popcorn") broadcastFood("bioskop", "popcorn", 85.2, 63.6, 1.15);
  else if (a.action === "music") toggleMusic();
  else if (a.action === "tv") toggleTV(currentZone);
}
function sleepAt(bed) {
  myData.x = bed.x; myData.z = bed.z; myData.y = 0;
  myMesh.position.set(bed.x, 0, bed.z);
  mySleep = true; setEmote("sleep");
  setStatus("😴 Zzz... (gerak / tekan lagi untuk bangun)");
}
function wakeUp() {
  mySleep = false; clearEmote();
  myData.z += 1.5; myMesh.position.set(myData.x, 0, myData.z);
  setStatus(netOnline ? "🟢 Online" : "🔴 Offline");
}
function startCooking() {
  if (myCookingUntil > performance.now()) return;
  myCookingUntil = performance.now() + 3000; cookSteamTimer = 0;
  myData.x = INTERIORS.rumah.cx + 3.4; myData.z = INTERIORS.rumah.cz - 3.3; myData.rotY = Math.PI;
  myMesh.position.set(myData.x, 0, myData.z);
  setEmote("cook");
  setStatus("🍳 Lagi masak...");
}
function toggleMusic() {
  const on = !zoneMedia.berdua.music;
  zoneMedia.berdua.music = on;
  if (on) startMusic(); else stopMusic();
  if (channel && netOnline) channel.send({ type: "broadcast", event: "music", payload: { on, zone: "berdua" } });
  publishPresenceNow(); refreshMediaState();
}
function toggleTV(zone) {
  const on = !(zoneMedia[zone] && zoneMedia[zone].tv);
  setTV(zone, on);
  if (channel && netOnline) channel.send({ type: "broadcast", event: "tv", payload: { on, zone } });
  publishPresenceNow(); refreshMediaState();
}
function refreshMediaState() {
  const el = document.getElementById("mediaState"); if (!el) return;
  const m = zoneMedia[currentZone] || {};
  const parts = [];
  if (m.music) parts.push("🎵 Musik nyala");
  if (m.tv) parts.push("📺 TV nyala");
  el.textContent = parts.join(" • ");
}
function applyMediaFromPresence() {
  if (!channel) return;
  Object.values(channel.presenceState()).flat().forEach(p => {
    if (!p || p.zone !== currentZone) return;
    if (p.music && currentZone === "berdua" && !musicOn) startMusic();
    if (p.tv && zoneMedia[p.zone] && !zoneMedia[p.zone].tv) setTV(p.zone, true);
  });
  refreshMediaState();
}

// ---------------- Supabase Realtime (v5: ganti Socket.IO) ----------------
// Satu channel 'dunia-3d': presence untuk daftar pemain (join/leave +
// posisi dasar), broadcast 'move' untuk update posisi yang sering.
// Tanpa server backend — semua pemain terhubung langsung ke Supabase.
const playerId = (() => {
  // v6.1: id pemain disimpan di sessionStorage — reload di tab yang sama
  // memakai id yang sama, jadi presence lama tidak kehitung sebagai pemain
  // baru (hitungan sempat melonjak 2–5 karena tiap reload bikin UUID baru).
  try {
    const saved = window.sessionStorage?.getItem("tg3d-player-id");
    if (saved) return saved;
  } catch (e) { /* abaikan */ }
  const fresh = (window.crypto?.randomUUID ? window.crypto.randomUUID() : "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  try { window.sessionStorage?.setItem("tg3d-player-id", fresh); } catch (e) { /* abaikan */ }
  return fresh;
})();
let supabaseClient = null;
let channel = null;
let netOnline = false;
// --- v5.1 auto-reconnect: backoff 2s -> 4s -> 8s, cap 10s ---
let reconnectTimer = null;
let reconnectDelay = 2000;
const RECONNECT_MAX = 10000;
function scheduleReconnect() {
  if (reconnectTimer) return; // sudah ada retry yang menunggu
  netOnline = false;
  setStatus("🟡 Menghubungkan ulang...");
  reconnectTimer = setTimeout(() => { reconnectTimer = null; setupRealtime(); }, reconnectDelay);
  reconnectDelay = Math.min(RECONNECT_MAX, reconnectDelay * 2);
}
function setupRealtime() {
  if (!supabaseClient) return;
  if (channel) {
    try { supabaseClient.removeChannel(channel); } catch (e) { /* abaikan */ }
    channel = null;
  }
  channel = supabaseClient.channel("dunia-3d", {
    config: { presence: { key: playerId }, broadcast: { self: false } },
  });
  channel.on("presence", { event: "sync" }, syncFromPresence);
  channel.on("presence", { event: "join" }, syncFromPresence);
  channel.on("presence", { event: "leave" }, syncFromPresence);
  channel.on("broadcast", { event: "move" }, ({ payload }) => applyRemoteState(payload));
  channel.on("broadcast", { event: "music" }, ({ payload }) => {
    if (!payload) return;
    if (payload.zone === currentZone) {
      if (zoneMedia[payload.zone]) zoneMedia[payload.zone].music = !!payload.on;
      if (payload.on) startMusic(); else stopMusic();
      refreshMediaState();
    }
  });
  channel.on("broadcast", { event: "tv" }, ({ payload }) => {
    if (!payload || !payload.zone) return;
    setTV(payload.zone, !!payload.on);
    refreshMediaState();
  });
  channel.on("broadcast", { event: "food" }, ({ payload }) => {
    if (!payload) return;
    spawnFood(payload.zone, payload.kind, payload.x, payload.z, payload.y || 0.8);
  });
  channel.on("broadcast", { event: "eat" }, ({ payload }) => {
    if (!payload) return;
    removeFood(payload.zone);
  });
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      netOnline = true;
      reconnectDelay = 2000; // reset backoff setelah berhasil
      setStatus("🟢 Online");
      await channel.track(presencePayload());
      syncFromPresence();
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      scheduleReconnect();
    }
  });
}
function presencePayload() {
  return { id: playerId, name: myData.name, x: myData.x, y: myData.y, z: myData.z, rotY: myData.rotY, moving: myData.moving, zone: currentZone, shirt: myData.shirt, pants: myData.pants, skin: myData.skin, emote: myEmote.name || "", music: (zoneMedia[currentZone] && zoneMedia[currentZone].music) ? 1 : 0, tv: (zoneMedia[currentZone] && zoneMedia[currentZone].tv) ? 1 : 0 };
}
function applyRemoteState(p) {
  if (!p || p.id === playerId) return;
  const em = p.emote || "";
  const emUntil = (em === "sleep" || em === "sit") ? Infinity : (em ? performance.now() + 6000 : 0);
  const ex = otherPlayers[p.id];
  if (!ex) {
    const mesh = createAvatar(p);
    otherPlayers[p.id] = { mesh, target: { x: p.x, y: p.y || 0, z: p.z, rotY: p.rotY || 0 }, moving: !!p.moving, zone: p.zone || "luar", emote: em, emoteUntil: emUntil };
  } else {
    ex.target = { x: p.x, y: p.y || 0, z: p.z, rotY: p.rotY || 0 };
    ex.moving = !!p.moving;
    if (p.zone) ex.zone = p.zone;
    ex.emote = em; ex.emoteUntil = emUntil;
  }
  // Media dari pemain lain di zona yang sama (baru masuk ruangan ikut dengar/lihat)
  if (p.zone === currentZone) {
    if (p.music && currentZone === "berdua" && !musicOn) startMusic();
    if (p.tv && zoneMedia[p.zone] && !zoneMedia[p.zone].tv) setTV(p.zone, true);
  }
}
function syncFromPresence() {
  if (!channel) return;
  const state = channel.presenceState();
  const all = Object.values(state).flat();
  const seen = new Set();
  all.forEach(p => { if (p && p.id && p.id !== playerId) { seen.add(p.id); applyRemoteState(p); } });
  Object.keys(otherPlayers).forEach(id => {
    if (!seen.has(id)) { scene.remove(otherPlayers[id].mesh); delete otherPlayers[id]; }
  });
  // Hitung pemain UNIK berdasarkan id (bukan jumlah meta presence):
  // saat reconnect, satu pemain bisa punya 2 meta sesaat (channel lama
  // belum timeout + channel baru), dan itu sempat bikin hitungan jadi 3.
  const uniqueIds = new Set();
  all.forEach(p => { if (p && p.id) uniqueIds.add(p.id); });
  setCount(Math.max(1, uniqueIds.size));
}
function publishPresenceNow() {
  if (channel && netOnline) channel.track(presencePayload()).catch(() => {});
}
if (window.supabase?.createClient) {
  setStatus("🟡 Menghubungkan...");
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setupRealtime();
  // Cek keamanan tiap 5 detik: kalau masih offline dan tidak ada retry
  // yang menunggu, picu retry. (Menangkap kasus di mana callback
  // subscribe tidak pernah terpanggil sama sekali.)
  setInterval(() => { if (!netOnline && !reconnectTimer) scheduleReconnect(); }, 5000);
} else {
  setStatus("🔴 Offline — Supabase gagal dimuat");
  setCount(1);
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

// ---------------- Kontrol: JOYSTICK ANALOG + lompat/lari + drag kamera ----------------
// Joystick analog: stick.x = kanan (+1) / kiri (-1), stick.y = maju (+1) / mundur (-1),
// stick.mag = 0..1 seberapa jauh didorong (0 = diam, 1 = mentok = lari).
const stick = { active: false, id: null, x: 0, y: 0, mag: 0 };
const STICK_RADIUS = 42; // px, jarak maks knob dari tengah
function stickSet(dx, dy) {
  let len = Math.hypot(dx, dy);
  if (len > STICK_RADIUS) { dx = dx / len * STICK_RADIUS; dy = dy / len * STICK_RADIUS; len = STICK_RADIUS; }
  const knob = document.getElementById("stickKnob");
  if (knob) knob.style.transform = "translate(" + dx + "px," + dy + "px)";
  stick.x = dx / STICK_RADIUS; stick.y = -dy / STICK_RADIUS; // atas layar = maju
  stick.mag = len / STICK_RADIUS;
  if (stick.mag < 0.15) { stick.x = 0; stick.y = 0; stick.mag = 0; } // deadzone
}
function stickReset() {
  stick.active = false; stick.id = null; stick.x = 0; stick.y = 0; stick.mag = 0;
  const knob = document.getElementById("stickKnob");
  if (knob) knob.style.transform = "translate(0px,0px)";
}
function stickInit() {
  const base = document.getElementById("stickBase"); if (!base) return;
  base.addEventListener("pointerdown", (e) => {
    e.preventDefault(); stick.active = true; stick.id = e.pointerId;
    base.setPointerCapture(e.pointerId);
    const r = base.getBoundingClientRect();
    stickSet(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  });
  base.addEventListener("pointermove", (e) => {
    if (!stick.active || e.pointerId !== stick.id) return;
    e.preventDefault();
    const r = base.getBoundingClientRect();
    stickSet(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  });
  const end = (e) => { if (e.pointerId === stick.id) stickReset(); };
  base.addEventListener("pointerup", end);
  base.addEventListener("pointercancel", end);
}
stickInit();
const keys = { up: false, down: false, left: false, right: false, jump: false, run: false };
function bindHold(id, name) {
  const el = document.getElementById(id); if (!el) return;
  const on = (e) => { e.preventDefault(); keys[name] = true; el.classList.add("active"); };
  const off = (e) => { e.preventDefault(); keys[name] = false; el.classList.remove("active"); };
  el.addEventListener("pointerdown", on);
  el.addEventListener("pointerup", off); el.addEventListener("pointercancel", off); el.addEventListener("pointerleave", off);
}
bindHold("jumpBtn", "jump"); bindHold("runBtn", "run");
const enterBtnEl = document.getElementById("enterBtn");
if (enterBtnEl) enterBtnEl.addEventListener("pointerdown", (e) => { e.preventDefault(); tryEnterExit(); });
const actionBtnEl = document.getElementById("actionBtn");
if (actionBtnEl) actionBtnEl.addEventListener("pointerdown", (e) => { e.preventDefault(); doAction(); });
document.querySelectorAll("#emoteBar button").forEach(b => b.addEventListener("pointerdown", (e) => { e.preventDefault(); setEmote(b.dataset.emote); }));
const muteBtnEl = document.getElementById("muteBtn");
if (muteBtnEl) muteBtnEl.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  musicMuted = !musicMuted;
  if (musicGain) musicGain.gain.value = musicMuted ? 0 : 0.15;
  muteBtnEl.textContent = musicMuted ? "🔇" : "🔊";
});
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keys.up = true;
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") keys.down = true;
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
  if (e.key === " ") { keys.jump = true; e.preventDefault(); }
  if (e.key === "Shift") keys.run = true;
  if (e.key === "e" || e.key === "E") tryEnterExit();
  if (e.key >= "1" && e.key <= "6") { const names = ["wave", "dance", "laugh", "sleep", "sit", "love"]; setEmote(names[+e.key - 1]); }
  if (e.key === "f" || e.key === "F") doAction();
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
let lastPresence = 0;
function updateMovement(delta) {
  if (!myMesh) return;
  const nowMs = performance.now();
  // Emote berwaktu habis sendiri
  if (myEmote.name && myEmote.until && nowMs > myEmote.until) clearEmote();
  // Tidur di kasur: diam sampai gerak atau tekan aksi bangun
  if (mySleep) {
    const inp = (stick.active && stick.mag > 0) || keys.up || keys.down || keys.left || keys.right;
    if (inp) { wakeUp(); }
    else { myMesh.position.set(myData.x, 0.4, myData.z); animateAvatar(myMesh, false, 0, delta, false, myEmote.name); return; }
  }
  // Masak: diam di depan kompor 3 detik, uap naik, lalu pizza jadi
  if (nowMs < myCookingUntil) {
    if (nowMs - cookSteamTimer > 400) { cookSteamTimer = nowMs; spawnSteam(myData.x, 1.3, myData.z - 0.8); }
    myMesh.position.set(myData.x, 0, myData.z);
    animateAvatar(myMesh, false, 0, delta, false, "cook");
    return;
  } else if (myCookingUntil) {
    myCookingUntil = 0; clearEmote();
    broadcastFood("rumah", "pizza", 85.0, -3.5, 1.05);
    setStatus("🍕 Masakan jadi! Makan di meja dapur");
  }
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = -fz, rz = fx;
  let ix = 0, iz = 0, mag = 0;
  // 1) Joystick analog (prioritas di HP): arah + kecepatan dari stick
  if (stick.active && stick.mag > 0) {
    ix = fx * stick.y + rx * stick.x;
    iz = fz * stick.y + rz * stick.x;
    mag = stick.mag;
  } else {
    // 2) Keyboard WASD / panah (digital)
    if (keys.up) { ix += fx; iz += fz; }
    if (keys.down) { ix -= fx; iz -= fz; }
    if (keys.right) { ix += rx; iz += rz; }
    if (keys.left) { ix -= rx; iz -= rz; }
    const klen = Math.hypot(ix, iz);
    if (klen > 0) { ix /= klen; iz /= klen; mag = 1; }
  }
  const moving = mag > 0;
  myData.moving = moving;
  // Gerak membatalkan emote menetap (tidur/duduk)
  if (moving && (myEmote.name === "sleep" || myEmote.name === "sit")) clearEmote();
  if (moving) {
    // Analog: dorong dikit = jalan pelan (~2), mentok = lari (8). Tombol LARI paksa lari.
    const speed = keys.run ? RUN_SPEED : (2.0 + (RUN_SPEED - 2.0) * mag);
    myData.x += ix * speed * delta;
    myData.z += iz * speed * delta;
    myData.rotY = Math.atan2(ix, iz);
    myMesh.userData.speedNorm = Math.max(mag, keys.run ? 1 : 0);
  } else myMesh.userData.speedNorm = 0;
  // Lompat + gravitasi
  if (keys.jump && myData.grounded) { myData.vy = JUMP_VEL; myData.grounded = false; keys.jump = false; }
  myData.vy -= GRAVITY * delta;
  myData.y += myData.vy * delta;
  if (myData.y <= 0) { myData.y = 0; myData.vy = 0; myData.grounded = true; }
  resolveCollisions(myData);
  myMesh.position.set(myData.x, myData.y, myData.z);
  if (myEmote.name === "sleep") myMesh.position.y = 0.4;
  else if (myEmote.name === "sit") myMesh.position.y = -0.3;
  myMesh.rotation.y = lerpAngle(myMesh.rotation.y, myData.rotY, Math.min(1, delta * 12));
  animateAvatar(myMesh, moving, myMesh.userData.speedNorm, delta, !myData.grounded, myEmote.name);
  const now = performance.now();
  if (channel && netOnline) {
    // Broadcast posisi ~15/detik (gerakan halus), presence ~1/detik (daftar pemain + zona)
    if (now - lastEmit > 66) {
      lastEmit = now;
      channel.send({ type: "broadcast", event: "move", payload: presencePayload() });
    }
    if (now - lastPresence > 1000) { lastPresence = now; publishPresenceNow(); }
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
let tvTimer = 0;
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  elapsed += delta;
  clouds.forEach((c, i) => { c.position.x += delta * (0.4 + i * 0.15); if (c.position.x > 75) c.position.x = -75; });
  fWater.rotation.z += delta * 0.4;
  updateMovement(delta);
  updateCamera(delta);
  updateBots(delta);
  updateEnterPrompt();
  updateActionPrompt();
  updateSteam(delta);
  tvTimer += delta;
  if (tvTimer > 0.15) {
    tvTimer = 0;
    Object.keys(zoneMedia).forEach(z => { if (zoneMedia[z].tv) drawTVScreen(z, elapsed); });
  }
  Object.values(otherPlayers).forEach(o => {
    const m = o.mesh, t = o.target;
    // Pemain di zona lain tidak terlihat (privasi ruangan)
    m.visible = (o.zone || "luar") === currentZone;
    if (!m.visible) return;
    if (o.emoteUntil && performance.now() > o.emoteUntil) o.emote = "";
    const before = m.position.clone();
    m.position.lerp(new THREE.Vector3(t.x, t.y, t.z), Math.min(1, delta * 10));
    const moved = m.position.distanceTo(before);
    m.rotation.y = lerpAngle(m.rotation.y, t.rotY, Math.min(1, delta * 10));
    animateAvatar(m, o.moving || moved > 0.001, 0.6, delta, Math.abs(t.y - m.position.y) > 0.15, o.emote || "");
    if (o.emote === "sleep") m.position.y = 0.35;
    else if (o.emote === "sit") m.position.y = -0.3;
  });
  renderer.render(scene, camera);
}
animate();
