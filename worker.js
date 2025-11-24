// ================
// BIGMOTOR WORKER
// Worker.js (FINAL PATCHED)
// Semua patch sesuai permintaan user:
// - AUDIT masuk riwayat
// - STOK MASUK masuk riwayat
// - EDIT BARANG tidak dicatat
// - Prefix transaksi_id: MSK-, PJL-, AUD-
// ================

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ROUTING
    if (req.method === 'GET' && path === "/api/riwayat") return riwayatAll(env, req);
    if (req.method === 'GET' && path.startsWith("/api/riwayat/")) return riwayatDetail(env, req);

    // Barang
    if (req.method === 'PUT' && path.startsWith("/api/barang/")) return updateBarang(env, req);

    // Stok Masuk
    if (req.method === 'POST' && path === "/api/stok_masuk") return stokMasuk(env, req);

    // Stok Keluar (Penjualan)
    if (req.method === 'POST' && path === "/api/stok_keluar") return stokKeluar(env, req);

    // Audit stok (jika ada)
    if (req.method === 'POST' && path === "/api/stok_audit") return stokAudit(env, req);

    // Default
    return json({ error: "Not Found", path }, 404);
  }
};

// ===============================================
// Utilities
// ===============================================

function json(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json" }
  });
}

async function bodyJSON(req) {
  try { return await req.json(); }
  catch { return null; }
}

function nowISO() {
  return new Date().toISOString();
}

function makeTID() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// ===============================================
// 1) STOK MASUK (FINAL - patched)
// ===============================================
async function stokMasuk(env, req) {
  const b = await bodyJSON(req);
  if (!b) return json({ error: "Body required" }, 400);

  // NORMALIZE
  let items = [];

  // New format: items[]
  if (Array.isArray(b.items) && b.items.length) {
    items = b.items.map(x => ({
      id: x.id || x.id_barang || x.barang_id,
      jumlah: Number(x.jumlah || x.qty || 0),
      keterangan: x.keterangan || ""
    }));
  }

  // Legacy format: single item
  else if (b.id || b.id_barang) {
    items = [{
      id: b.id || b.id_barang,
      jumlah: Number(b.jumlah || b.qty || 0),
      keterangan: b.keterangan || ""
    }];
  }

  else return json({ error: "items[] or id_barang required" }, 400);

  const operator = b.dibuat_oleh || "Admin";
  const now = nowISO();
  const tid = "MSK-" + makeTID();

  for (const it of items) {
    if (!it.id) continue;

    const old = await env.BMT_DB.prepare(
      "SELECT stock FROM barang WHERE id=?"
    ).bind(it.id).first();

    if (!old) continue;

    const newStock = Number(old.stock || 0) + Number(it.jumlah || 0);

    await env.BMT_DB.prepare(
      "UPDATE barang SET stock=? WHERE id=?"
    ).bind(newStock, it.id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_masuk(barang_id,jumlah,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?)
    `).bind(
      it.id,
      it.jumlah,
      it.keterangan,
      operator,
      now,
      tid
    ).run();
  }

  return json({ ok: true, transaksi_id: tid });
}

// ===============================================
// 2) STOK KELUAR / Penjualan
// ===============================================
async function stokKeluar(env, req) {
  const b = await bodyJSON(req);
  if (!b?.items) return json({ error: "items[] required" }, 400);

  const items = b.items;
  const operator = b.dibuat_oleh || "Admin";
  const now = nowISO();
  const tid = "PJL-" + makeTID();

  for (const it of items) {
    const row = await env.BMT_DB.prepare(
      "SELECT stock FROM barang WHERE id=?"
    ).bind(it.id).first();

    if (!row) continue;

    const newStock = Number(row.stock || 0) - Number(it.jumlah || 0);

    await env.BMT_DB.prepare(
      "UPDATE barang SET stock=? WHERE id=?"
    ).bind(newStock, it.id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_keluar(barang_id,jumlah,harga,dibuat_oleh,keterangan,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?,?)
    `).bind(
      it.id,
      it.jumlah,
      it.harga || 0,
      operator,
      it.keterangan || "",
      now,
      tid
    ).run();
  }

  return json({ ok: true, transaksi_id: tid });
}

// ===============================================
// 3) AUDIT (via POST)
// ===============================================
async function stokAudit(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.barang_id) return json({ error: "barang_id required" }, 400);

  const operator = b.dibuat_oleh || "Admin";
  const now = nowISO();
  const tid = "AUD-" + makeTID();

  const oldRow = await env.BMT_DB.prepare(
    "SELECT stock FROM barang WHERE id=?"
  ).bind(b.barang_id).first();

  const oldStock = Number(oldRow?.stock || 0);
  const newStock = Number(b.stok_baru || 0);

  // update barang stock
  await env.BMT_DB.prepare(
    "UPDATE barang SET stock=? WHERE id=?"
  ).bind(newStock, b.barang_id).run();

  // insert riwayat audit
  await env.BMT_DB.prepare(`
    INSERT INTO stok_audit(barang_id,stok_lama,stok_baru,keterangan,dibuat_oleh,created_at,transaksi_id)
    VALUES (?,?,?,?,?,?,?)
  `).bind(
    b.barang_id,
    oldStock,
    newStock,
    b.keterangan || "",
    operator,
    now,
    tid
  ).run();

  return json({ ok: true, transaksi_id: tid });
}

// ===============================================
// 4) UPDATE BARANG — PATCH FINAL
// Tidak mencatat edit ke edit_barang
// Tetapi jika STOCK berubah → buat AUDIT
// ===============================================
async function updateBarang(env, req) {
  const id = Number(req.url.split("/").pop());
  const body = await bodyJSON(req);

  if (!id) return json({ error: "Missing ID" }, 400);

  const old = await env.BMT_DB.prepare(
    "SELECT * FROM barang WHERE id=?"
  ).bind(id).first();

  if (!old) return json({ error: "Barang tidak ditemukan" }, 404);

  const operator = body.dibuat_oleh || "Admin";
  const now = nowISO();

  // DETECT STOCK CHANGE → treat as AUDIT
  const stockNow = body.stock;
  if (stockNow !== undefined && Number(stockNow) !== Number(old.stock)) {
    const tidAudit = "AUD-" + makeTID();

    await env.BMT_DB.prepare(
      "UPDATE barang SET stock=? WHERE id=?"
    ).bind(stockNow, id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_audit(barang_id,stok_lama,stok_baru,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?,?)
    `).bind(
      id,
      Number(old.stock||0),
      Number(stockNow),
      body.keterangan || "",
      operator,
      now,
      tidAudit
    ).run();
  }

  // UPDATE non-stock fields
  const editable = ["nama", "harga", "harga_modal", "kategori", "foto", "deskripsi"];
  const sets = [];
  const vals = [];

  for (const f of editable) {
    if (body[f] !== undefined && body[f] != old[f]) {
      sets.push(`${f}=?`);
      vals.push(body[f]);
    }
  }

  if (sets.length) {
    vals.push(id);
    await env.BMT_DB.prepare(
      `UPDATE barang SET ${sets.join(", ")} WHERE id=?`
    ).bind(...vals).run();
  }

  // IMPORTANT: Edit tidak dicatat ke edit_barang
  return json({ ok: true });
}

// ===============================================
// 5) RIWAYAT — tanpa EDIT
// ===============================================

// === LIST riwayat
async function riwayatAll(env, req) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || 10);

  const sql = `
    SELECT transaksi_id, MIN(created_at) AS waktu FROM (
      SELECT transaksi_id, created_at FROM stok_masuk
      UNION ALL
      SELECT transaksi_id, created_at FROM stok_keluar
      UNION ALL
      SELECT transaksi_id, created_at FROM stok_audit
    )
    GROUP BY transaksi_id
    ORDER BY waktu DESC
    LIMIT ?
  `;

  const rows = await env.BMT_DB.prepare(sql).bind(limit).all();
  return json({ items: rows.results });
}

// === DETAIL riwayat
async function riwayatDetail(env, req) {
  const tid = decodeURIComponent(req.url.split("/").pop());

  const masuk = await env.BMT_DB.prepare(
    "SELECT * FROM stok_masuk WHERE transaksi_id=?"
  ).bind(tid).all();

  const keluar = await env.BMT_DB.prepare(
    "SELECT * FROM stok_keluar WHERE transaksi_id=?"
  ).bind(tid).all();

  const audit = await env.BMT_DB.prepare(
    "SELECT * FROM stok_audit WHERE transaksi_id=?"
  ).bind(tid).all();

  return json({
    transaksi_id: tid,
    masuk: masuk.results,
    keluar: keluar.results,
    audit: audit.results,
    edits: [] // per request: edit dihapus total
  });
    }
