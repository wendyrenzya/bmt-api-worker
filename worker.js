// worker.js — FINAL for STOCK MASUK ONLY
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // Handle CORS Preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {

      // ============================
      // BARANG CRUD
      // ============================
      if (path === "/api/barang" && method === "GET")
        return listBarang(env);

      if (path === "/api/barang" && method === "POST")
        return addBarang(env, request);

      if (path.startsWith("/api/barang/") && method === "GET")
        return getBarangById(env, request);

      if (path.startsWith("/api/barang/") && method === "PUT")
        return updateBarang(env, request);

      if (path.startsWith("/api/barang/") && method === "DELETE")
        return deleteBarang(env, request);


      // ============================
      // KATEGORI
      // ============================
      if (path === "/api/kategori" && method === "GET")
        return listKategori(env);


      // ============================
      // SEARCH BARANG (stok masuk)
      // ============================
      if (path === "/api/barang_search" && method === "GET")
        return searchBarang(env, url);


      // ============================
      // STOK MASUK (MAIN FEATURE)
      // ============================
      if (path === "/api/stok_masuk" && method === "POST")
        return stokMasuk(env, request);


      // ============================
      // FALLBACK
      // ============================
      return json({ error: "Endpoint Not Found" }, 404);

    } catch (err) {
      return json({ error: err.message || "Server Error" }, 500);
    }
  }
};


/* ============================================================
   UTILITIES
   ============================================================ */
function corsHeaders() {
  return {
    "Content-Type": "application/json;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}
async function bodyJSON(request) {
  try { return await request.json(); }
  catch { return null; }
}
function nowISO() { return new Date().toISOString(); }



/* ============================================================
   CRUD BARANG
   ============================================================ */

async function listBarang(env) {
  const sql = `SELECT * FROM barang ORDER BY id DESC`;
  const res = await env.BMT_DB.prepare(sql).all();
  return json({ items: res.results || [] });
}

async function getBarangById(env, request) {
  const id = Number(request.url.split("/").pop());
  if (!id) return json({ error: "Invalid ID" }, 400);

  const res = await env.BMT_DB
    .prepare("SELECT * FROM barang WHERE id=?")
    .bind(id)
    .first();

  return json({ item: res || null });
}

async function addBarang(env, request) {
  const body = await bodyJSON(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);
  if (!body.nama || !body.harga)
    return json({ error: "nama & harga wajib" }, 400);

  // Auto kode barang
  let next = 1;
  try {
    const max = await env.BMT_DB
      .prepare("SELECT MAX(CAST(kode_barang AS INTEGER)) AS maxcode FROM barang")
      .first();
    if (max && max.maxcode) next = Number(max.maxcode) + 1;
  } catch (_) { }

  const kode_barang = String(next).padStart(5, "0");
  const now = nowISO();

  await env.BMT_DB.prepare(`
    INSERT INTO barang (kode_barang, nama, harga_modal, harga, stock, kategori, foto, deskripsi, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    kode_barang,
    body.nama,
    body.harga_modal || 0,
    body.harga,
    body.stock || 0,
    body.kategori || "",
    body.foto || "",
    body.deskripsi || "",
    now
  ).run();

  const inserted = await env.BMT_DB
    .prepare(`SELECT id FROM barang WHERE kode_barang=? AND created_at=? LIMIT 1`)
    .bind(kode_barang, now)
    .first();

  return json({
    ok: true,
    id: inserted ? inserted.id : null,
    kode_barang
  });
}

async function updateBarang(env, request) {
  const body = await bodyJSON(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const id = Number(request.url.split("/").pop());
  if (!id) return json({ error: "Invalid ID" }, 400);

  const allowed = ["nama", "harga_modal", "harga", "stock", "kategori", "foto", "deskripsi"];
  const set = [];
  const val = [];

  for (const k of allowed) {
    if (body[k] !== undefined) {
      set.push(`${k}=?`);
      val.push(body[k]);
    }
  }

  if (!set.length)
    return json({ error: "No fields to update" }, 400);

  val.push(id);

  await env.BMT_DB
    .prepare(`UPDATE barang SET ${set.join(", ")} WHERE id=?`)
    .bind(...val)
    .run();

  return json({ ok: true });
}

async function deleteBarang(env, request) {
  const id = Number(request.url.split("/").pop());
  if (!id) return json({ error: "Invalid ID" }, 400);

  await env.BMT_DB
    .prepare("DELETE FROM barang WHERE id=?")
    .bind(id)
    .run();

  return json({ ok: true });
}



/* ============================================================
   KATEGORI
   ============================================================ */

async function listKategori(env) {
  const rows = await env.BMT_DB.prepare(`
    SELECT DISTINCT kategori 
    FROM barang 
    WHERE kategori!=''
    ORDER BY kategori
  `).all();

  return json({
    categories: rows.results?.map(r => r.kategori) || []
  });
}



/* ============================================================
   SEARCH BARANG (cocok untuk stok_masuk.html)
   ============================================================ */

async function searchBarang(env, url) {
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ items: [] });

  const rows = await env.BMT_DB.prepare(`
    SELECT id, nama, stock
    FROM barang
    WHERE nama LIKE ?
    ORDER BY nama ASC
  `).bind(`%${q}%`).all();

  return json({ items: rows.results || [] });
}



/* ============================================================
   STOK MASUK (UTAMA)
   ============================================================ */

async function stokMasuk(env, request) {
  const body = await bodyJSON(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const id_barang  = Number(body.id_barang);
  const jumlah     = Number(body.jumlah || 0);
  const keterangan = body.keterangan || "";
  const dibuat_oleh = body.dibuat_oleh || "";
  const tanggal    = body.tanggal || nowISO();

  if (!id_barang || !jumlah)
    return json({ error: "id_barang & jumlah wajib" }, 400);

  // stok lama
  const item = await env.BMT_DB
    .prepare("SELECT stock FROM barang WHERE id=?")
    .bind(id_barang)
    .first();

  if (!item) return json({ error: "Barang tidak ditemukan" }, 404);

  const stok_lama = Number(item.stock || 0);
  const stok_baru = stok_lama + jumlah;

  // update stok
  await env.BMT_DB.prepare(`
    UPDATE barang SET stock=? WHERE id=?
  `).bind(stok_baru, id_barang).run();

  // log riwayat stok masuk
  await env.BMT_DB.prepare(`
    INSERT INTO stok_masuk (barang_id, jumlah, keterangan, dibuat_oleh, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    id_barang,
    jumlah,
    keterangan,
    dibuat_oleh,
    tanggal
  ).run();

  return json({
    ok: true,
    stok_lama,
    stok_baru
  });
}
