# Telegram 3D Multiplayer v2 — Roblox-style

Upgrade dari v1 (kotak polos di lantai gelap) jadi kota kecil ala Roblox.

## Yang berubah dari v1
- **Avatar Roblox-style:** kepala + badan + 2 tangan + 2 kaki (blocky), wajah (mata + senyum), warna baju/celana/kulit acak per pemain, label nama di atas kepala.
- **Animasi:** tangan & kaki ayun pas jalan, pose lompat (tangan ke atas), hadap ke arah jalan (rotasi halus).
- **Gerakan:** jalan (WASD / D-pad), **lompat** (Spasi / tombol LOMPAT, ada gravitasi), **lari** (Shift / tombol LARI).
- **Kamera orbit:** seret layar untuk putar kamera, scroll untuk zoom.
- **Dunia:** langit siang + matahari + awan bergerak, rumput bertekstur, jalan aspal + garis kuning, plaza bundar, 10 gedung berjendela, pohon, lampu jalan, bangku, air mancur, pagar putih. Arena 56x56 (dulu 30x30).
- **Tabrakan:** gedung, pohon, lampu, bangku, air mancur & pagar tidak bisa ditembus.
- **Multiplayer lebih halus:** server kirim x/y/z + rotasi + status jalan; pemain lain bergerak pakai interpolasi (tidak lompat-lompat). Ada hitung jumlah pemain.
- **Mode Demo:** kalau `BACKEND_URL` belum diisi, game tetap bisa dicoba tanpa backend — tanpa bot/NPC (sesuai permintaan Ghoz).
- **Bersih:** `node_modules/` TIDAK ikut di repo ini (v1 terlanjur ke-commit 988 file — hapus dengan `git rm -r --cached backend-3d/node_modules`).

## Cara jalanin (v5)
Frontend: upload `frontend-3d/` ke Vercel sebagai static site, pasang URL-nya sebagai Telegram Mini App di @BotFather. Tidak perlu backend — multiplayer jalan lewat Supabase Realtime (URL + anon key sudah ada di `frontend-3d/app.js`).

## Catatan
Identitas Telegram masih dari `initDataUnsafe` (tampilan saja). Untuk produksi, validasi `initData` di server pakai bot token. Posisi pemain masih di RAM — restart server = posisi hilang.

## v3 — Bangunan bisa dimasuki + Ruangan Berdua (20 Nov 2026)
- 3 gedung bisa dimasuki: **Rumah** (gedung hijau -10,-23), **Kafe** (gedung kuning 4,-23), **Ruangan Berdua** (gedung biru 10,23).
- Cara masuk: jalan ke depan pintu sampai muncul prompt, tekan **E** di keyboard atau tombol **MASUK** di HP. Keluar: tekan **E** / tombol **KELUAR** (pintu keluar di dinding selatan interior).
- Interior: Rumah (sofa, meja, TV, karpet), Kafe (meja kasir + 4 meja), Ruangan Berdua (ranjang double, sofa berdua, meja lilin, hati pink di dinding, papan nama "Ghoz & Pacar").
- Ruangan Berdua **privat max 2 orang**: server menolak pemain ke-3 (`zoneDenied`, "Ruangan Berdua sudah penuh"), dan pemain di zona lain tidak terlihat dari luar/dalam.
- Server v3 kirim `zone` di `currentPlayers`/`playerMoved`; teleport masuk/keluar diizinkan (batas langkah 90 saat ganti zona).
- Nama di papan Ruangan Berdua masih placeholder — ganti `COUPLE_NAMES` di `frontend-3d/app.js` kalau nama pacar sudah diketahui.
- Tanpa NPC/bot (sesuai permintaan Ghoz 20 Nov 2026).

## v4 — Joystick analog + nama Adel (22 Nov 2026)
- D-pad diganti **joystick analog** (kiri bawah): dorong dikit = jalan pelan, dorong mentok = lari (kecepatan 2–8 ikut jarak dorongan). WASD tetap jalan di desktop.
- Papan nama Ruangan Berdua kini "Ghoz & Adel".
- Backend masih server.js v3 (Socket.IO, zona + Ruangan Berdua max 2). Deploy backend ke Render, lalu isi BACKEND_URL di frontend-3d/app.js.

## v5 — Supabase Realtime, tanpa server backend (22 Nov 2026)
- Socket.IO + `BACKEND_URL` dihapus. Frontend memakai **Supabase Realtime** (channel `dunia-3d`): presence untuk daftar pemain (join/leave + posisi + zona) dan broadcast `move` ~15/detik untuk gerakan halus.
- Tidak butuh server backend lagi — frontend saja di Vercel. `backend-3d/` dibiarkan apa adanya sebagai referensi, tidak dipakai frontend.
- Ruangan Berdua **privat max 2 orang**: sebelum masuk, frontend menghitung presence yang sedang di zona `berdua`; kalau sudah 2, masuk ditolak dengan pesan "Ruangan Berdua sudah penuh (max 2 orang)". Pemain di zona berbeda tetap tidak saling terlihat.
- Status HUD: "Menghubungkan..." → "🟢 Online" saat channel tersubscribe, "🔴 Offline" kalau error. Jumlah pemain = jumlah presence (termasuk diri sendiri).
- Keterbatasan: kalau dua pemain masuk Ruangan Berdua di saat yang persis bersamaan, keduanya bisa lolos cek (race condition — tidak ada server yang mengunci).
