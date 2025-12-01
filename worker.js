export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders() });

    try {
    
    // ==========================
// ABSENSI
// ==========================
if (path === "/api/absensi" && method === "POST")
  return absensiAdd(env, request);

if (path === "/api/absensi" && method === "GET")
  return absensiList(env);
  
      // ==========================
      // BARANG
      // ==========================
      if (path === "/api/barang" && method === "GET")
        return listBarang(env);

      if (path === "/api/barang" && method === "POST")
        return addBarang(env, request);

      if (path.startsWith("/api/barang/") && method === "GET")
        return getBarang(env, request);

      if (path.startsWith("/api/barang/") &&
          (method === "PUT" || method === "PATCH"))
        return updateBarang(env, request);

      if (path.startsWith("/api/barang/") && method === "DELETE")
        return deleteBarang(env, request);

      // ==========================
      // STOK MASUK
      // ==========================
      if (path === "/api/stok_masuk" && method === "POST")
        return stokMasuk(env, request);

      // ==========================
      // STOK KELUAR
      // ==========================
      if (path === "/api/stok_keluar" && method === "POST")
        return stokKeluar(env, request);

      // ==========================
      // AUDIT
      // ==========================
      if (path === "/api/stok_audit" && method === "POST")
        return stokAudit(env, request);

      // ==========================
      // SEARCH / KATEGORI
      // ==========================
      if (path === "/api/barang_search" && method === "GET")
        return searchBarang(env, url);

      if (path === "/api/kategori" && method === "GET")
        return listKategori(env);
      // ==========================
      // SERVIS (FINAL ORDER FIX)
      // ==========================

      // 1) ENDPOINT BARU — SIMPAN ALASAN PEMBATALAN
      if (path.startsWith("/api/servis/alasan/") && method === "PUT")
        return servisUpdateAlasan(env, request);

      // 2) UPDATE BIAYA SERVIS
      if (path.startsWith("/api/servis/update_cost/") && method === "PUT")
        return servisUpdateBiaya(env, request);

      // 3) SELESAI SERVIS
      if (path.startsWith("/api/servis/selesai/") && method === "PUT")
        return servisSelesai(env, request);

      // 4) BATAL SERVIS
      if (path.startsWith("/api/servis/batal/") && method === "PUT")
        return servisBatal(env, request);

      // 5) LIST SERVIS
      if (path === "/api/servis" && method === "GET")
        return servisList(env);

      // 6) TAMBAH SERVIS
      if (path === "/api/servis" && method === "POST")
        return servisAdd(env, request);

      // 6b) UPDATE ITEMS SERVIS
      if (path.startsWith("/api/servis/update_items/") && method === "PUT")
        return servisUpdateItems(env, request);
      
      // 7) DETAIL SERVIS (PALING BAWAH WAJIB)
      if (path.startsWith("/api/servis/") && method === "GET")
        return servisDetail(env, request);

      // =============================================
// RIWAYAT SERVIS (BARU)
// =============================================
if (path === "/api/riwayat_servis" && method === "POST")
  return riwayatServisAdd(env, request);

if (path.startsWith("/api/riwayat_servis/") && method === "GET")
  return riwayatServisGet(env, request);
      
      // ==========================
      // RIWAYAT
      // ==========================
      if (path === "/api/riwayat" && method === "GET")
        return riwayatAll(env, url);

      if (path.startsWith("/api/riwayat/") && method === "GET")
        return riwayatDetail(env, request);

      // ==========================
      // PER-BARANG HISTORY
      // ==========================
      if (path.startsWith("/api/barang_history/") && method === "GET")
        return riwayatBarang(env, request);

      // ==========================
      // MESSAGE
      // ==========================
      if (path === "/api/message" && method === "GET")
        return messageGet(env);

      if (path === "/api/message" && method === "POST")
        return messageAdd(env, request);

      if (path.startsWith("/api/message/") && method === "DELETE")
        return messageDelete(env, request);

      // ==========================
      // SETTINGS
      // ==========================
      if (path === "/api/settings" && method === "GET")
        return settingsList(env);

      if (path === "/api/settings" && method === "POST")
        return settingsSet(env, request);

      if (path.startsWith("/api/settings/") && method === "DELETE")
        return settingsDelete(env, request);
     
      // ==========================
      // LOGIN
      // ==========================
      if (path === "/api/login" && method === "POST")
        return loginUser(env, request); 
    
      // // ==========================
      // USERS (PATCH FINAL)
      // ==========================


      // List user lengkap

      if (path === "/api/users" && method === "GET")
        return usersList(env);


      // Detail user
      if (path.startsWith("/api/user/") && method === "GET")
  return userDetail(env, request);


      // Update nama
      if (path.startsWith("/api/user/name/") && method === "PUT")
  return userUpdateNama(env, request);


      // Update password

      if (path.startsWith("/api/user/password/") && method === "PUT")
  return userUpdatePassword(env, request);


      // Update foto

      if (path.startsWith("/api/user/foto/") && method === "PUT")
  return userUpdateFoto(env, request);

// Create user (lama, tetap)
if (path === "/api/users" && method === "POST")
  return usersAdd(env, request);

// Delete user (lama, tetap)
if (path.startsWith("/api/users/") && method === "DELETE")
  return usersDelete(env, request);

      // ==========================
      // PENGELUARAN
      // ==========================
      if (path === "/api/pengeluaran" && method === "POST")
        return pengeluaranAdd(env, request);

      if (path === "/api/pengeluaran" && method === "GET")
        return pengeluaranList(env);

      if (path.startsWith("/api/pengeluaran/") && method === "DELETE")
        return pengeluaranDelete(env, request);

      // ==========================
      // LAPORAN — ROUTES
      // ==========================
if (path === "/api/laporan/bulanan" && method === "GET")
  return laporanBulanan(env, url);

if (path === "/api/laporan/harian" && method === "GET")
  return laporanHarianRange(env, url);

if (path === "/api/laporan/harian/summary" && method === "GET")
  return laporanHarianSummary(env);

if (path === "/api/laporan/harian" && method === "POST")
  return laporanHarianSave(env, request);
  
  if (path === "/api/laporan/harian/list" && method === "GET")
  return laporanHarianList(env);

if (path === "/api/laporan/detail" && method === "GET")
  return laporanDetail(env, url);
    
// ==========================
      // BONUS
      // ==========================
      if (path === "/api/bonus/riwayat" && method === "GET")
        return bonusRiwayat(env, url);

      if (path === "/api/bonus/achieved" && method === "POST")
        return bonusAchieved(env, request);

      if (path === "/api/bonus/status" && method === "POST")
        return bonusUpdateStatus(env, request);

      
  

      // ==========================
      // HEALTH
      // ==========================
      if (path === "/api/health" || path === "/health")
        return json({ ok: true, now: new Date().toISOString() });

      return json({ error: "Endpoint Not Found", path }, 404);

    } catch (err) {
      return json({ error: String(err) || "Server Error" }, 500);
    }
  }
};
//////////////////////////////
// Utilities
//////////////////////////////

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json;charset=UTF-8"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

async function bodyJSON(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function nowISO() {
  return new Date().toISOString();
}

function makeTID() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = Math.random().toString(16).slice(2, 7).toUpperCase();
  return `${ts}-${rnd}`;
}
//////////////////
////// ABSEN 
////////////////

async function absensiAdd(env, req){
  const b = await bodyJSON(req);
  if(!b || !b.username || !b.lokasi || !b.waktu)
    return json({ error:"username, lokasi, waktu required" }, 400);

  await env.BMT_DB.prepare(`
    INSERT INTO absensi(username, lokasi, waktu, created_at)
    VALUES(?,?,?,?)
  `).bind(
    b.username,
    b.lokasi,
    b.waktu,
    nowISO()
  ).run();

  return json({ ok:true });
}

async function absensiList(env){
  const rows = await env.BMT_DB
    .prepare("SELECT * FROM absensi ORDER BY id DESC")
    .all();

  return json({ items: rows.results || [] });
}
//////////////////////////////
// BARANG CRUD
//////////////////////////////

async function listBarang(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT * FROM barang ORDER BY nama ASC`)
    .all();
  return json({ items: rows.results || [] });
}

async function getBarang(env, req) {
  const id = Number(req.url.split("/").pop());
  const row = await env.BMT_DB
    .prepare(`SELECT * FROM barang WHERE id=?`)
    .bind(id)
    .first();
  return json({ item: row || null });
}

async function addBarang(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.nama || !b.harga)
    return json({ error: "nama & harga required" }, 400);

  const now = nowISO();
  const r = await env.BMT_DB
    .prepare(`
    INSERT INTO barang (
      kode_barang, nama, kategori, harga, harga_modal, stock, foto, deskripsi, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `)
    .bind(
      b.kode_barang || "KB" + Date.now().toString().slice(-6),
      b.nama,
      b.kategori || "",
      Number(b.harga || 0),
      Number(b.harga_modal || 0),
      Number(b.stock || 0),
      b.foto || "",
      b.deskripsi || "",
      now
    )
    .run();

  return json({ ok: true, id: r.lastRowId || null });
}
///////////////////////////////////////////////////////////////
// 🔧 UPDATE BARANG — PUT / PATCH
// Catatan Penting:
// - STOCK TIDAK DIIZINKAN EDIT MANUAL (stock dihapus dari allowed fields)
// - Stok hanya boleh diubah lewat: masuk, keluar, audit
///////////////////////////////////////////////////////////////
async function updateBarang(env, req) {

  ///////////////////////////////////////////////////////////////
  // Ambil ID dari URL
  ///////////////////////////////////////////////////////////////
  const id = Number(req.url.split("/").pop());

  ///////////////////////////////////////////////////////////////
  // Ambil body JSON
  ///////////////////////////////////////////////////////////////
  const b = await bodyJSON(req);
  if (!b) return json({ error: "body required" }, 400);

  ///////////////////////////////////////////////////////////////
  // Daftar field yang boleh di-update
  // PERHATIKAN: "stock" sengaja TIDAK ADA karena tidak boleh edit manual
  ///////////////////////////////////////////////////////////////
  const allowed = [
    "nama",
    "kategori",
    "harga",
    "harga_modal",
    "foto",
    "deskripsi",
    "kode_barang"
  ];

  ///////////////////////////////////////////////////////////////
  // Build SET SQL dinamis
  ///////////////////////////////////////////////////////////////
  const sets = [];
  const vals = [];

  allowed.forEach(k => {
    if (b[k] !== undefined) {
      sets.push(`${k}=?`);
      vals.push(b[k]);
    }
  });

  ///////////////////////////////////////////////////////////////
  // Tidak ada field untuk update? → error
  ///////////////////////////////////////////////////////////////
  if (!sets.length)
    return json({ error: "no fields to update" }, 400);

  vals.push(id);

  ///////////////////////////////////////////////////////////////
  // Eksekusi update
  ///////////////////////////////////////////////////////////////
  await env.BMT_DB
    .prepare(`UPDATE barang SET ${sets.join(", ")} WHERE id=?`)
    .bind(...vals)
    .run();

  ///////////////////////////////////////////////////////////////
  // Berhasil
  ///////////////////////////////////////////////////////////////
  return json({ ok: true });
}

async function deleteBarang(env, req) {
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB
    .prepare(`DELETE FROM barang WHERE id=?`)
    .bind(id)
    .run();
  return json({ ok: true });
}

//////////////////////////////
// SEARCH / KATEGORI
//////////////////////////////

async function searchBarang(env, url) {
  const q = url.searchParams.get("q") || "";
  const rows = await env.BMT_DB
    .prepare(
      `SELECT * FROM barang WHERE nama LIKE ? OR kode_barang LIKE ? LIMIT 200`
    )
    .bind(`%${q}%`, `%${q}%`)
    .all();
  return json({ items: rows.results || [] });
}

async function listKategori(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT DISTINCT kategori FROM barang ORDER BY kategori`)
    .all();
  return json({
    categories: (rows.results || []).map((r) => r.kategori).filter(Boolean),
  });
}

//////////////////////////////
// STOK MASUK
//////////////////////////////

async function stokMasuk(env, req) {
  const b = await bodyJSON(req);
  if (!b) return json({ error: "body required" }, 400);

  let items = [];
  if (Array.isArray(b.items) && b.items.length) {
    items = b.items.map((it) => ({
      id: it.id || it.id_barang || it.barang_id,
      jumlah: Number(it.jumlah || it.qty || 0),
      keterangan: it.keterangan || "",
    }));
  } else if (b.id || b.id_barang) {
    items = [
      {
        id: b.id || b.id_barang,
        jumlah: Number(b.jumlah || b.qty || 0),
        keterangan: b.keterangan || "",
      },
    ];
  } else {
    return json({ error: "items[] or id_barang required" }, 400);
  }

  const operator = b.dibuat_oleh || b.operator || "Admin";
  const now = nowISO();
  const tid = "MSK-" + makeTID();

  for (const it of items) {
    if (!it.id) continue;

    const old = await env.BMT_DB
      .prepare(`SELECT stock FROM barang WHERE id=?`)
      .bind(it.id)
      .first();
    if (!old) continue;

    const newStock = Number(old.stock || 0) + Number(it.jumlah || 0);

    await env.BMT_DB
      .prepare(`UPDATE barang SET stock=? WHERE id=?`)
      .bind(newStock, it.id)
      .run();

    await env.BMT_DB
      .prepare(
        `INSERT INTO stok_masuk(
        barang_id,jumlah,keterangan,dibuat_oleh,created_at,transaksi_id
      ) VALUES (?,?,?,?,?,?)`
      )
      .bind(it.id, it.jumlah, it.keterangan, operator, now, tid)
      .run();

// PATCH RIWAYAT — STOK MASUK (KOMPATIBEL)
await env.BMT_DB.prepare(
  `INSERT INTO riwayat(
    tipe,
    barang_id,
    barang_nama,
    jumlah,
    harga,
    harga_modal,
    catatan,
    dibuat_oleh,
    created_at,
    transaksi_id
  ) VALUES (?,?,?,?,?,?,?,?,?,?)`
).bind(
  "masuk",
  it.id,
  it.nama || "",
  it.jumlah,
  0,
  0,
  it.keterangan || "",
  operator,
  now,
  tid
).run();
  }

  return json({ ok: true, transaksi_id: tid });
}

//////////////////////////////
// STOK KELUAR
//////////////////////////////

async function stokKeluar(env, req) {
  const b = await bodyJSON(req);
  if (!b || !Array.isArray(b.items) || !b.items.length)
    return json({ error: "items[] required" }, 400);

  const items = b.items;
  const operator = b.dibuat_oleh || b.operator || "Admin";
  const now = nowISO();
  const tid = b.transaksi_id || "PJL-" + makeTID();

  for (const it of items) {
    if (!it.id) continue;

    const row = await env.BMT_DB
      .prepare(`SELECT stock FROM barang WHERE id=?`)
      .bind(it.id)
      .first();
    if (!row) continue;

    const newStock =
      Number(row.stock || 0) - Number(it.jumlah || it.qty || 0);

    await env.BMT_DB
      .prepare(`UPDATE barang SET stock=? WHERE id=?`)
      .bind(newStock, it.id)
      .run();

    await env.BMT_DB
      .prepare(
        `INSERT INTO stok_keluar(
        barang_id,jumlah,harga,dibuat_oleh,keterangan,created_at,transaksi_id
      ) VALUES (?,?,?,?,?,?,?)`
      )
      .bind(
        it.id,
        it.jumlah || it.qty || 0,
        it.harga || 0,
        operator,
        it.keterangan || "",
        now,
        tid
      )
      .run();
    
// PATCH RIWAYAT — STOK KELUAR (KOMPATIBEL)
await env.BMT_DB.prepare(
  `INSERT INTO riwayat(
    tipe,
    barang_id,
    barang_nama,
    jumlah,
    harga,
    harga_modal,
    catatan,
    dibuat_oleh,
    created_at,
    transaksi_id
  ) VALUES (?,?,?,?,?,?,?,?,?,?)`
).bind(
  "keluar",
  it.id,
  it.nama || "",           // ← WAJIB ADA, STRING KOSONG AMAN
  it.jumlah || it.qty || 0,
  it.harga || 0,
  0,                       // harga_modal
  it.keterangan || "",     // catatan, kolom WAJIB DIISI
  operator,
  now,
  tid
).run();
  }

  return json({ ok: true, transaksi_id: tid });
}

//////////////////////////////
// STOK AUDIT
//////////////////////////////

//////////////////////////////
// STOK AUDIT (FORMAT BARU ONLY)
//////////////////////////////

async function stokAudit(env, req) {
  const b = await bodyJSON(req);
  if (!b || !Array.isArray(b.items) || !b.items.length) {
    return json({ error: "items[] required" }, 400);
  }

  const operator = b.dibuat_oleh || "Admin";
  const now = nowISO();
  const tid = "AUD-" + makeTID();

  for (const it of b.items) {
    const barang_id = Number(it.barang_id);
    const stok_baru = Number(it.stok_baru);
    const ket = it.keterangan || "";

    if (!barang_id || isNaN(stok_baru)) continue;

    const getOld = await env.BMT_DB
      .prepare("SELECT stock, nama FROM barang WHERE id=?")
      .bind(barang_id)
      .first();

    const stok_lama = Number(getOld?.stock || 0);
    const namaBarang = getOld?.nama || "";

    // UPDATE STOK
    await env.BMT_DB
      .prepare("UPDATE barang SET stock=? WHERE id=?")
      .bind(stok_baru, barang_id)
      .run();

    // INSERT stok_audit
    await env.BMT_DB
      .prepare(`
        INSERT INTO stok_audit(
          barang_id, stok_lama, stok_baru,
          keterangan, dibuat_oleh, created_at, transaksi_id
        )
        VALUES (?,?,?,?,?,?,?)
      `)
      .bind(
        barang_id,
        stok_lama,
        stok_baru,
        ket,
        operator,
        now,
        tid
      ).run();

    // INSERT ke RIWAYAT
    await env.BMT_DB
      .prepare(`
        INSERT INTO riwayat(
          transaksi_id, tipe, barang_id,
          jumlah, harga,
          dibuat_oleh, catatan, created_at,
          stok_lama, stok_baru, barang_nama
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `)
      .bind(
        tid,
        "audit",
        barang_id,
        stok_baru - stok_lama,
        0,
        operator,
        ket,
        now,
        stok_lama,
        stok_baru,
        namaBarang
      ).run();
  }

  return json({ ok: true, transaksi_id: tid });
}
////////////////////////////////////////////////////
// SERVIS HANDLERS (FIXED VERSION)
////////////////////////////////////////////////////

async function servisList(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT * FROM servis ORDER BY created_at DESC`)
    .all();
  return json({ items: rows.results || [] });
}

async function servisAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.nama_servis)
    return json({ error: "nama_servis required" }, 400);

  const transaksi_id = b.transaksi_id || "SRV-" + makeTID();
  const now = nowISO();
  const itemsJson = JSON.stringify(b.items || []);

  const r = await env.BMT_DB
    .prepare(`
      INSERT INTO servis (
        nama_servis, teknisi, biaya_servis, catatan,
        items, status, transaksi_id, created_at
      )
      VALUES (?,?,?,?,?,?,?,?)
    `)
    .bind(
      b.nama_servis,
      b.teknisi || "",
      Number(b.biaya_servis || 0),
      b.catatan || "",
      itemsJson,
      "ongoing",
      transaksi_id,
      now
    )
    .run();

  return json({ ok: true, id_servis: r.lastRowId, transaksi_id });
}

async function servisDetail(env, req) {
  const id_servis = Number(req.url.split("/").pop());
  const row = await env.BMT_DB
    .prepare(`SELECT * FROM servis WHERE id_servis=?`)
    .bind(id_servis)
    .first();

  if (!row) return json({ item: null });

  try {
    row.items = row.items ? JSON.parse(row.items) : [];
  } catch {
    row.items = [];
  }

  return json({ item: row });
}

async function servisSelesai(env, req) {
  const id_servis = Number(req.url.split("/").pop());
  const now = nowISO();

  await env.BMT_DB
    .prepare(`UPDATE servis SET status='selesai', selesai_at=? WHERE id_servis=?`)
    .bind(now, id_servis)
    .run();

  return json({ ok: true });
}  // ← PENUTUP YANG HILANG

async function servisBatal(env, req) {
  const id_servis = Number(req.url.split("/").pop());

  await env.BMT_DB
    .prepare(`UPDATE servis SET status='batal' WHERE id_servis=?`)
    .bind(id_servis)
    .run();

  return json({ ok: true });
}

async function servisUpdateBiaya(env, req) {
  const id_servis = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);

  await env.BMT_DB
    .prepare(`UPDATE servis SET biaya_servis=? WHERE id_servis=?`)
    .bind(Number(b.biaya_servis || 0), id_servis)
    .run();

  return json({ ok: true });
}

// ==========================================================
// 6b) UPDATE ITEMS SERVIS (ENDPOINT BARU)
// ==========================================================
async function servisUpdateItems(env, req) {
  const id_servis = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);

  if (!Array.isArray(b.items)) {
    return json({ error: "items[] required" }, 400);
  }

  const row = await env.BMT_DB
    .prepare(`SELECT * FROM servis WHERE id_servis=?`)
    .bind(id_servis)
    .first();

  if (!row) {
    return json({ error: "servis not found" }, 404);
  }

  if (row.status === "selesai" || row.status === "batal") {
    return json({ error: "servis is locked" }, 400);
  }

  const itemsJson = JSON.stringify(b.items || []);

  await env.BMT_DB
    .prepare(`UPDATE servis SET items=? WHERE id_servis=?`)
    .bind(itemsJson, id_servis)
    .run();

  return json({ ok: true });
}

/////// ENDPOINT BARU — ALASAN BATAL ///////
async function servisUpdateAlasan(env, req) {
  const id_servis = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);

  await env.BMT_DB
    .prepare(`UPDATE servis SET alasan_batal=? WHERE id_servis=?`)
    .bind(b.alasan || "", id_servis)
    .run();

  return json({ ok: true });
}
//////////////////////////////
// RIWAYAT
//////////////////////////////

async function riwayatAll(env, url) {
  const limit = Number(url.searchParams.get("limit") || 50);
  const offset = Number(url.searchParams.get("offset") || 0);

  const rows = await env.BMT_DB
    .prepare(`
      SELECT transaksi_id, MIN(created_at) AS waktu
      FROM riwayat
      GROUP BY transaksi_id
      ORDER BY waktu DESC
      LIMIT ? OFFSET ?
    `)
    .bind(limit, offset)
    .all();

  return json({ items: rows.results || [] });
}

async function riwayatDetail(env, req) {
  const tid = decodeURIComponent(req.url.split("/").pop());

  const r = await env.BMT_DB
    .prepare(`
      SELECT * FROM riwayat
      WHERE transaksi_id = ?
      ORDER BY created_at ASC
    `)
    .bind(tid)
    .all();
// PATCH: tarik detail servis jika exist
  const srv = await env.BMT_DB
    .prepare(`SELECT * FROM riwayat_servis WHERE transaksi_id=? LIMIT 1`)
    .bind(tid)
    .first();
  const rows = r.results || [];

  // === PATCH CHARGE ===
// Ambil CHARGE dari keterangan
const chargeItems = rows.filter(
  x => x.keterangan && x.keterangan.includes("#CHG_FOR=" + tid)
);

// Buang CHARGE dari rows lain
const filteredRows = rows.filter(
  x => !(x.keterangan && x.keterangan.includes("#CHG_FOR=" + tid))
);
  
  return json({
  transaksi_id: tid,
  servis: srv || null,

  // === CHARGE Field Baru ===
  charge: chargeItems,

  // === rows tanpa charge ===
  masuk: filteredRows.filter(x => x.tipe === "masuk"),

  keluar: filteredRows.filter(x => x.tipe === "keluar"),

  audit: filteredRows
    .filter(x => x.tipe === "audit")
    .map(x => ({
      ...x,
      stok_lama: x.stok_lama ?? null,
      stok_baru: x.stok_baru ?? null
    })),

  edits: []
});
}
//////////////////////////////
// PER-BARANG HISTORY
//////////////////////////////

async function riwayatBarang(env, req) {
  const id = Number(req.url.split("/").pop());

  const masuk = await env.BMT_DB
    .prepare(`SELECT * FROM stok_masuk WHERE barang_id=? ORDER BY created_at DESC`)
    .bind(id)
    .all();

  const keluar = await env.BMT_DB
    .prepare(`SELECT * FROM stok_keluar WHERE barang_id=? ORDER BY created_at DESC`)
    .bind(id)
    .all();

  let audit;
  try {
    audit = await env.BMT_DB
      .prepare(`SELECT * FROM stok_audit WHERE barang_id=? ORDER BY created_at DESC`)
      .bind(id)
      .all();
    audit = audit.results || [];
  } catch (e) {
    const fallback = await env.BMT_DB
      .prepare(`SELECT * FROM riwayat WHERE barang_id=? ORDER BY created_at DESC`)
      .bind(id)
      .all()
      .catch(() => ({ results: [] }));
    audit = (fallback.results || []).filter(x => x.tipe === "audit");
  }

  return json({
    barang_id: id,
    masuk: masuk.results || [],
    keluar: keluar.results || [],
    audit: audit || [],
  });
}

//////////////////////////////
// MESSAGES
//////////////////////////////

async function messageGet(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT * FROM messages ORDER BY created_at DESC LIMIT 100`)
    .all();

  return json({ items: rows.results || [] });
}

async function messageAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.text) return json({ error: "text required" }, 400);

  await env.BMT_DB
    .prepare(`INSERT INTO messages(text,created_at) VALUES(?,?)`)
    .bind(b.text, nowISO())
    .run();

  return json({ ok: true });
}

async function messageDelete(env, req) {
  const id = Number(req.url.split("/").pop());

  await env.BMT_DB
    .prepare(`DELETE FROM messages WHERE id=?`)
    .bind(id)
    .run();

  return json({ ok: true });
}

//////////////////////////////
// SETTINGS
//////////////////////////////

async function settingsList(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT * FROM settings`)
    .all();

  const map = {};
  (rows.results || []).forEach(r => map[r.key] = r.value);

  return json({ settings: map });
}

async function settingsSet(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.key) return json({ error: "key required" }, 400);

  await env.BMT_DB
    .prepare(`INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)`)
    .bind(b.key, b.value || "")
    .run();

  return json({ ok: true });
}

async function settingsDelete(env, req) {
  const key = req.url.split("/").pop();

  await env.BMT_DB
    .prepare(`DELETE FROM settings WHERE key=?`)
    .bind(key)
    .run();

  return json({ ok: true });
}
////// LOGIN

async function loginUser(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.username || !b.password)
    return json({ error: "username & password required" }, 400);

  const row = await env.BMT_DB
    .prepare(`SELECT * FROM users WHERE username=? LIMIT 1`)
    .bind(b.username)
    .first();

  if (!row)
    return json({ error: "User tidak ditemukan" }, 400);

  // password_hash digunakan sebagai password plain
  if (String(row.password_hash) !== String(b.password))
    return json({ error: "Password salah" }, 400);

  const token = crypto.randomUUID();

  return json({
    ok: true,
    token,
    username: row.username,
    nama: row.nama,
    role: row.role
  });
}

//////////////////////////////
// USERS
//////////////////////////////

//////////////////////////////
// USERS (PATCH FINAL)
//////////////////////////////

// List semua user lengkap
async function usersList(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT id, username, nama, role, foto FROM users ORDER BY username ASC`)
    .all();

  return json({ users: rows.results || [] });
}

// Detail user
async function userDetail(env, req) {
  const id = Number(req.url.split("/").pop());
  const row = await env.BMT_DB
    .prepare(`SELECT id, username, nama, role, foto FROM users WHERE id=?`)
    .bind(id)
    .first();

  return json({ user: row || null });
}

// Update nama
async function userUpdateNama(env, req) {
  const id = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);

  await env.BMT_DB
    .prepare(`UPDATE users SET nama=? WHERE id=?`)
    .bind(b.nama || "", id)
    .run();

  return json({ ok: true });
}

// Update password
async function userUpdatePassword(env, req) {
  const id = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);

  await env.BMT_DB
    .prepare(`UPDATE users SET password_hash=? WHERE id=?`)
    .bind(b.password || "", id)
    .run();

  return json({ ok: true });
}

// Update foto
async function userUpdateFoto(env, req) {
  const id = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);

  await env.BMT_DB
    .prepare(`UPDATE users SET foto=? WHERE id=?`)
    .bind(b.foto || "", id)
    .run();

  return json({ ok: true });
}

// Create user (tetap)
async function usersAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.username)
    return json({ error: "username required" }, 400);

  await env.BMT_DB
    .prepare(`
      INSERT INTO users(username,password_hash,role,created_at)
      VALUES(?,?,?,?)
    `)
    .bind(b.username, b.password || "", b.role || "user", nowISO())
    .run();

  return json({ ok: true });
}

// Delete user (tetap)
async function usersDelete(env, req) {
  const id = Number(req.url.split("/").pop());

  await env.BMT_DB
    .prepare(`DELETE FROM users WHERE id=?`)
    .bind(id)
    .run();

  return json({ ok: true });
}

//////////////////////////////
// PENGELUARAN
//////////////////////////////

async function pengeluaranAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.nama || !b.jumlah)
    return json({ error: "nama & jumlah required" }, 400);

  await env.BMT_DB
    .prepare(`
      INSERT INTO pengeluaran (
        nama, kategori, jumlah, catatan, dibuat_oleh, created_at
      ) VALUES (?,?,?,?,?,?)
    `)
    .bind(
      b.nama,
      b.kategori || "",
      Number(b.jumlah || 0),
      b.catatan || "",
      b.dibuat_oleh || "Admin",
      nowISO()
    )
    .run();

  return json({ ok: true });
}

async function pengeluaranList(env) {
  const r = await env.BMT_DB
    .prepare(`SELECT * FROM pengeluaran ORDER BY created_at DESC`)
    .all();

  return json({ items: r.results || [] });
}

async function pengeluaranDelete(env, req) {
  const id = Number(req.url.split("/").pop());

  await env.BMT_DB
    .prepare(`DELETE FROM pengeluaran WHERE id=?`)
    .bind(id)
    .run();

  return json({ ok: true });
}
///////////////////////////////////////////////////////////////
// LAPORAN — HANDLERS
///////////////////////////////////////////////////////////////


// =============================================
// HANDLER: Tambah riwayat servis utuh
// =============================================
async function riwayatServisAdd(env, req){
  const b = await bodyJSON(req);

  if(!b || !b.transaksi_id || !b.id_servis)
    return json({ error: "transaksi_id & id_servis required" }, 400);

  const now = nowISO();

  await env.BMT_DB.prepare(`
      INSERT OR REPLACE INTO riwayat_servis(
        transaksi_id, id_servis, nama_servis, teknisi,
        biaya_servis, keterangan, created_at
      ) VALUES (?,?,?,?,?,?,?)
  `).bind(
      b.transaksi_id,
      b.id_servis,
      b.nama_servis || "",
      b.teknisi || "",
      Number(b.biaya_servis || 0),
      b.keterangan || "",
      now
  ).run();

  return json({ ok:true });
}


// =============================================
// HANDLER: Ambil data riwayat servis lengkap
// =============================================
async function riwayatServisGet(env, req){
  const tid = decodeURIComponent(req.url.split("/").pop());

  const row = await env.BMT_DB
    .prepare(`SELECT * FROM riwayat_servis WHERE transaksi_id=? LIMIT 1`)
    .bind(tid)
    .first();

  return json({ item: row || null });
}

//
// ================================
// BONUS: GET RIWAYAT PER USER
// /api/bonus/riwayat?user=nama
// ================================
async function bonusRiwayat(env, url){
  const user = url.searchParams.get("user") || "";

  const rows = await env.BMT_DB.prepare(`
    SELECT *
    FROM bonus_riwayat
    WHERE username=?
    ORDER BY id DESC
  `).bind(user).all();

  return json({ items: rows.results || [] });
}

//
// ================================
// BONUS: CATAT ACHIEVED TARGET
// /api/bonus/achieved
// ================================
async function bonusAchieved(env, req){
  const b = await bodyJSON(req);

  if(!b || !b.username || !b.tanggal || !b.nilai){
    return json({ error: "username, tanggal, nilai required" }, 400);
  }

  await env.BMT_DB.prepare(`
    INSERT INTO bonus_riwayat(username, tanggal, nilai, status, created_at)
    VALUES(?,?,?,?,?)
  `).bind(
    b.username,
    b.tanggal,
    Number(b.nilai || 0),
    b.status || "belum",
    nowISO()
  ).run();

  return json({ ok: true });
}

//
// ================================
// BONUS: UPDATE STATUS (1x SAJA)
// /api/bonus/status
// ================================
async function bonusUpdateStatus(env, req){
  const b = await bodyJSON(req);

  if(!b || !b.id || !b.status){
    return json({ error: "id & status required" }, 400);
  }

  // update langsung → karena aturanmu: hanya boleh "belum" → "sudah"
  await env.BMT_DB.prepare(`
    UPDATE bonus_riwayat
    SET status=?
    WHERE id=?
  `).bind(b.status, b.id).run();

  return json({ ok: true });
}

// ======================================================
// LAPORAN: BULANAN
// ======================================================
async function laporanBulanan(env, url) {
  const month = url.searchParams.get("bulan") || new Date().toISOString().slice(0,7);

  const start = `${month}-01T00:00:00Z`;
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 1)).toISOString();

  try {
    // PENJUALAN = stok_keluar PJL-*
    const pen = await env.BMT_DB.prepare(`
      SELECT IFNULL(SUM(harga * jumlah),0) AS total
      FROM stok_keluar
      WHERE transaksi_id LIKE 'PJL-%'
        AND created_at >= ?
        AND created_at < ?
    `).bind(start, end).first();

    // CHARGE = servis transaksi_id CHG-*
    const chg = await env.BMT_DB.prepare(`
      SELECT IFNULL(SUM(biaya_servis),0) AS total
      FROM servis
      WHERE transaksi_id LIKE 'CHG-%'
        AND status != 'batal'
        AND created_at >= ?
        AND created_at < ?
    `).bind(start, end).first();

    // PENGELUARAN
    const out = await env.BMT_DB.prepare(`
      SELECT IFNULL(SUM(jumlah),0) AS total
      FROM pengeluaran
      WHERE created_at >= ?
        AND created_at < ?
    `).bind(start, end).first();

    return json({
      total_penjualan: Number(pen.total || 0),
      total_charge: Number(chg.total || 0),
      total_pengeluaran: Number(out.total || 0)
    });

  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}


// ======================================================
// LAPORAN: HARIAN SUMMARY (HARI INI)
// ======================================================
async function laporanHarianSummary(env){
  // Cloudflare D1 pakai UTC → konversi ke lokal +8
  // Tapi kita tetap pakai DATE(created_at) supaya aman.
  const penjualan = await env.BMT_DB.prepare(`
    SELECT SUM(jumlah * harga) AS total
    FROM stok_keluar
    WHERE DATE(created_at) = DATE('now')
  `).first();

  const pengeluaran = await env.BMT_DB.prepare(`
    SELECT SUM(jumlah) AS total
    FROM pengeluaran
    WHERE DATE(created_at) = DATE('now')
  `).first();

  const totalPenjualan = Number(penjualan?.total || 0);
  const totalPengeluaran = Number(pengeluaran?.total || 0);
  const profit = totalPenjualan - totalPengeluaran;

  return json({
    tanggal: new Date().toISOString().slice(0,10),
    total_penjualan: totalPenjualan,
    total_pengeluaran: totalPengeluaran,
    profit
  });
}


// ======================================================
// LAPORAN: RENTANG HARIAN (CHART 7 HARI / RANGE MANUAL)
// ======================================================
async function laporanHarianRange(env, url){
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if(!start || !end)
    return json({ error: "start & end required" }, 400);

  // Ambil semua tanggal antara start dan end
  const rows = await env.BMT_DB.prepare(`
    SELECT
      DATE(created_at) AS hari,
      SUM(jumlah * harga) AS total_penjualan
    FROM stok_keluar
    WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  `).bind(start, end).all();

  const rowsPengeluaran = await env.BMT_DB.prepare(`
    SELECT
      DATE(created_at) AS hari,
      SUM(jumlah) AS total_pengeluaran
    FROM pengeluaran
    WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  `).bind(start, end).all();

  // Gabungkan data kedua tabel
  const map = {};

  rows.results.forEach(r=>{
    const d = r.hari;
    if(!map[d]) map[d] = { tanggal:d, penjualan:0, pengeluaran:0, profit:0 };
    map[d].penjualan = Number(r.total_penjualan || 0);
  });

  rowsPengeluaran.results.forEach(r=>{
    const d = r.hari;
    if(!map[d]) map[d] = { tanggal:d, penjualan:0, pengeluaran:0, profit:0 };
    map[d].pengeluaran = Number(r.total_pengeluaran || 0);
  });

  // Hitung profit
  Object.values(map).forEach(x=>{
    x.profit = x.penjualan - x.pengeluaran;
  });

  // Sort ascending by date
  const hasil = Object.values(map).sort((a,b)=>a.tanggal.localeCompare(b.tanggal));

  return json(hasil);
}

//////////////////////////////
// END OF FILE
//////////////////////////////
