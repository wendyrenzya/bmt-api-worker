export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders() });

    try {
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
      // USERS
      // ==========================
      if (path === "/api/users" && method === "GET")
        return usersList(env);

      if (path === "/api/users" && method === "POST")
        return usersAdd(env, request);

      if (path.startsWith("/api/users/") && method === "PUT")
        return usersUpdate(env, request);

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
  }

  return json({ ok: true, transaksi_id: tid });
}

//////////////////////////////
// STOK AUDIT
//////////////////////////////

async function stokAudit(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.barang_id)
    return json({ error: "barang_id required" }, 400);

  const operator = b.dibuat_oleh || b.operator || "Admin";
  const now = nowISO();
  const tid = "AUD-" + makeTID();

  const oldRow = await env.BMT_DB
    .prepare(`SELECT stock FROM barang WHERE id=?`)
    .bind(b.barang_id)
    .first();

  const oldStock = Number(oldRow?.stock || 0);
  const newStock = Number(b.stok_baru || b.stock || 0);

  await env.BMT_DB
    .prepare(`UPDATE barang SET stock=? WHERE id=?`)
    .bind(newStock, b.barang_id)
    .run();

  await env.BMT_DB
    .prepare(
      `INSERT INTO stok_audit(
      barang_id,stok_lama,stok_baru,keterangan,dibuat_oleh,created_at,transaksi_id
    ) VALUES (?,?,?,?,?,?,?)`
    )
    .bind(
      b.barang_id,
      oldStock,
      newStock,
      b.keterangan || "",
      operator,
      now,
      tid
    )
    .run();

  return json({ ok: true });
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
}

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

  const rows = r.results || [];

  return json({
    transaksi_id: tid,
    masuk: rows.filter(x => x.tipe === "masuk"),
    keluar: rows.filter(x => x.tipe === "keluar"),
    audit: rows.filter(x => x.tipe === "audit"),
    edits: [],
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

//////////////////////////////
// USERS
//////////////////////////////

async function usersList(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT id, username, role FROM users ORDER BY username ASC`)
    .all();

  return json({ users: rows.results || [] });
}

async function usersAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.username)
    return json({ error: "username required" }, 400);

  await env.BMT_DB
    .prepare(`
      INSERT INTO users(username,password,role,created_at)
      VALUES(?,?,?,?)
    `)
    .bind(b.username, b.password || "", b.role || "user", nowISO())
    .run();

  return json({ ok: true });
}

async function usersUpdate(env, req) {
  const id = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);

  const sets = [];
  const vals = [];

  ["username", "role"].forEach(k => {
    if (b[k] !== undefined) {
      sets.push(`${k}=?`);
      vals.push(b[k]);
    }
  });

  if (sets.length) {
    vals.push(id);
    await env.BMT_DB
      .prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`)
      .bind(...vals)
      .run();
  }

  return json({ ok: true });
}

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

//////////////////////////////
// END OF FILE
//////////////////////////////
