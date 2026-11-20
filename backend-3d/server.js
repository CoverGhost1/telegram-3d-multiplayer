const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors({ origin: true }));
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "Telegram 3D Multiplayer Backend v3", players: players.size });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

const players = new Map();

// Dunia v2 lebih besar: 56x56, batas jalan 27
// v3: zona interior — interior dibangun di x=80, jadi batas luar tidak berlaku di sana
const WORLD_LIMIT = 27;
const MAX_STEP = 1.6; // horizontal per paket (lari + lag)
const MAX_STEP_ZONE_CHANGE = 90; // teleport masuk/keluar bangunan (80 -> kota)
const MAX_Y = 6;
const MAX_DY = 0.6; // vertikal per paket (lompat)
const ZONES = ["luar", "rumah", "kafe", "berdua"];
const INTERIOR_CENTERS = { rumah: { x: 80, z: 0 }, kafe: { x: 80, z: 30 }, berdua: { x: 80, z: -30 } };

const SHIRTS = [0xff5c7a, 0x5c8dff, 0x5ce1a6, 0xffc857, 0xb36bff, 0x35c2d8, 0xff8a3d, 0x2ecc71, 0xe74c3c, 0x9b59b6];
const PANTS = [0x2c3e50, 0x34495e, 0x1a5276, 0x7e5109, 0x4a235a, 0x145a32, 0x7b241c];
const SKINS = [0xf2c89b, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xf1c27d];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function sanitizeText(value, fallback = "Player") {
  if (typeof value !== "string") return fallback;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.slice(0, 24) || fallback;
}

function publicPlayer(p) {
  return {
    id: p.id, x: p.x, y: p.y, z: p.z, rotY: p.rotY,
    color: p.color, shirt: p.shirt, pants: p.pants, skin: p.skin,
    name: p.name, moving: p.moving, zone: p.zone || "luar",
  };
}

function broadcastCount() {
  io.emit("playerCount", players.size);
}

io.on("connection", (socket) => {
  const tgUser = socket.handshake.auth?.telegramUser || {};
  const firstName = sanitizeText(tgUser.first_name, "Player");
  const lastName = sanitizeText(tgUser.last_name, "");
  const username = sanitizeText(tgUser.username ? `@${tgUser.username}` : "", "");
  const displayName = username || [firstName, lastName].filter(Boolean).join(" ") || "Player";

  const shirt = pick(SHIRTS);
  const player = {
    id: socket.id,
    x: (Math.random() - 0.5) * 6, y: 0, z: 4 + (Math.random() - 0.5) * 4,
    rotY: 0, color: shirt, shirt, pants: pick(PANTS), skin: pick(SKINS),
    name: displayName, moving: false, zone: "luar",
  };
  players.set(socket.id, player);
  console.log(`Player masuk: ${player.name} (${socket.id})`);

  socket.emit("currentPlayers", Object.fromEntries([...players.entries()].map(([id, p]) => [id, publicPlayer(p)])));
  socket.broadcast.emit("newPlayer", publicPlayer(player));
  broadcastCount();

  socket.on("playerMovement", (d) => {
    const cur = players.get(socket.id);
    if (!cur || !d) return;
    const nx = Number(d.x), ny = Number(d.y ?? 0), nz = Number(d.z);
    if (![nx, ny, nz].every(Number.isFinite)) return;
    const nextZone = ZONES.includes(d.zone) ? d.zone : cur.zone;
    const zoneChanged = nextZone !== cur.zone;
    // Ruangan Berdua privat: max 2 orang (selain yang sudah di dalam)
    if (zoneChanged && nextZone === "berdua") {
      const inRoom = [...players.values()].filter(p => p.zone === "berdua" && p.id !== socket.id).length;
      if (inRoom >= 2) { socket.emit("zoneDenied", { zone: "berdua", reason: "Ruangan Berdua sudah penuh (max 2 orang)" }); return; }
    }
    const dx = nx - cur.x, dz = nz - cur.z, dy = ny - cur.y;
    const stepLimit = zoneChanged ? MAX_STEP_ZONE_CHANGE : MAX_STEP;
    if (Math.hypot(dx, dz) > stepLimit) return;
    if (Math.abs(dy) > MAX_DY) return;
    if (ny < 0 || ny > MAX_Y) return;
    // Di interior, posisi boleh di sekitar x=80 (bukan batas kota 27)
    if (nextZone === "luar") {
      cur.x = clamp(nx, -WORLD_LIMIT, WORLD_LIMIT);
      cur.z = clamp(nz, -WORLD_LIMIT, WORLD_LIMIT);
    } else {
      const c = INTERIOR_CENTERS[nextZone];
      cur.x = clamp(nx, c.x - 6, c.x + 6);
      cur.z = clamp(nz, c.z - 5, c.z + 5);
    }
    cur.y = clamp(ny, 0, MAX_Y);
    cur.zone = nextZone;
    cur.rotY = Number.isFinite(Number(d.rotY)) ? Number(d.rotY) : cur.rotY;
    cur.moving = !!d.moving;
    socket.broadcast.emit("playerMoved", { id: socket.id, x: cur.x, y: cur.y, z: cur.z, rotY: cur.rotY, moving: cur.moving, zone: cur.zone });
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    console.log(`Player keluar: ${player.name} (${socket.id})`);
    io.emit("playerDisconnected", socket.id);
    broadcastCount();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`Server multiplayer v3 aktif di port ${PORT}`));
