// ==========================================================
// worker.js — FINAL PATCHED (apply to your project folder)
// - Minimal, safe patches only:
//   * stok_masuk accepts items[] OR legacy single-item payload
//   * transaksi_id prefixes: MSK-, PJL-, AUD-
//   * updateBarang: if stock changed -> insert into stok_audit (or fallback to riwayat)
//   * do NOT insert edit actions into edit_barang
//   * remove edit_barang from riwayat aggregation
// - Keeps all existing routes, bindings and behavior otherwise
// ==========================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

    try {
      // BARANG
      if (path === "/api/barang" && method === "GET") return listBarang(env);
      if (path === "/api/barang" && method === "POST") return addBarang(env, request);
      if (path.startsWith("/api/barang/") && method === "GET") return getBarang(env, request);
      if (path.startsWith("/api/barang/") && (method === "PUT" || method === "PATCH")) return updateBarang(env, request);
      if (path.startsWith("/api/barang/") && method === "DELETE") return deleteBarang(env, request);

      // SEARCH / KATEGORI
      if (path === "/api/barang_search" && method === "GET") return searchBarang(env, url);
      if (path === "/api/kategori" && method === "GET") return listKategori(env);

      // STOK MASUK
      if (path === "/api/stok_masuk" && method === "POST") return stokMasuk(env, request);

      // STOK KELUAR / PENJUALAN
      if (path === "/api/stok_keluar" && method === "POST") return stokKeluar(env, request);

      // AUDIT
      if (path === "/api/stok_audit" && method === "POST") return stokAudit(env, request);

      // RIWAYAT
      if (path === "/api/riwayat" && method === "GET") return riwayatAll(env, url);
      if (path.startsWith("/api/riwayat/") && method === "GET") return riwayatDetail(env, request);

      // PER BARANG HISTORY
      if (path.startsWith("/api/barang_history/") && method === "GET") return riwayatBarang(env, request);

      // MESSAGE
      if (path === "/api/message" && method === "GET") return messageGet(env);
      if (path === "/api/message" && method === "POST") return messageAdd(env, request);
      if (path.startsWith("/api/message/") && method === "DELETE") return messageDelete(env, request);

      // SETTINGS
      if (path === "/api/settings" && method === "GET") return settingsList(env);
      if (path === "/api/settings" && method === "POST") return settingsSet(env, request);
      if (path.startsWith("/api/settings/") && method === "DELETE") return settingsDelete(env, request);

      // USERS
      if (path === "/api/users" && method === "GET") return usersList(env);
      if (path === "/api/users" && method === "POST") return usersAdd(env, request);
      if (path.startsWith("/api/users/") && method === "PUT") return usersUpdate(env, request);
      if (path.startsWith("/api/users/") && method === "DELETE") return usersDelete(env, request);

      // PENGELUARAN (BARU)
if (path === "/api/pengeluaran" && method === "POST") 
  return pengeluaranAdd(env, request);

if (path === "/api/pengeluaran" && method === "GET") 
  return pengeluaranList(env);

if (path.startsWith("/api/pengeluaran/") && method === "DELETE") 
  return pengeluaranDelete(env, request);
      
      // health fallback
      if (path === "/api/health" || path === "/health") return json({ ok: true, now: new Date().toISOString() });

      return json({ error: "Endpoint Not Found", path }, 404);
    } catch (err) {
      // log message included in response to help debugging; remove in production if needed
      return json({ error: String(err) || "Server Error" }, 500);
    }
  }
};

/* ==========================
   Utilities
   ========================== */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json;charset=UTF-8"
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}
async function bodyJSON(req) {
  try { return await req.json(); } catch { return null; }
}
function nowISO() { return new Date().toISOString(); }
function makeTID() {
  // timestamp + random suffix — deterministic enough for human-readable id
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = Math.random().toString(16).slice(2, 7).toUpperCase();
  return `${ts}-${rnd}`;
}

/* ==========================
   BARANG CRUD (keep as original behavior)
   ========================== */
async function listBarang(env){
  const rows = await env.BMT_DB.prepare(`SELECT * FROM barang ORDER BY nama ASC`).all();
  return json({ items: rows.results || [] });
}
async function getBarang(env, req){
  const id = Number(req.url.split("/").pop());
  const row = await env.BMT_DB.prepare(`SELECT * FROM barang WHERE id=?`).bind(id).first();
  return json({ item: row || null });
}
async function addBarang(env, req){
  const b = await bodyJSON(req);
  if(!b || !b.nama || !b.harga) return json({ error:"nama & harga required" },400);

  const now = nowISO();
  const r = await env.BMT_DB.prepare(`
    INSERT INTO barang (kode_barang,nama,kategori,harga,harga_modal,stock,foto,deskripsi,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    b.kode_barang || ("KB" + Date.now().toString().slice(-6)),
    b.nama,
    b.kategori || "",
    Number(b.harga||0),
    Number(b.harga_modal||0),
    Number(b.stock||0),
    b.foto||"",
    b.deskripsi||"",
    now
  ).run();

  const insertedId = (r && r.lastRowId) ? r.lastRowId : null;
  return json({ ok:true, id: insertedId || null });
}
async function deleteBarang(env, req){
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM barang WHERE id=?`).bind(id).run();
  return json({ ok:true });
}

/* ==========================
   SEARCH / KATEGORI
   ========================== */
async function searchBarang(env, url){
  const q = url.searchParams.get("q") || "";
  const rows = await env.BMT_DB.prepare(`SELECT * FROM barang WHERE nama LIKE ? OR kode_barang LIKE ? LIMIT 200`)
    .bind(`%${q}%`,`%${q}%`).all();
  return json({ items: rows.results || [] });
}
async function listKategori(env){
  const rows = await env.BMT_DB.prepare(`SELECT DISTINCT kategori FROM barang ORDER BY kategori`).all();
  const cats = (rows.results||[]).map(r=>r.kategori).filter(Boolean);
  return json({ categories: cats });
}

/* ==========================
   STOK MASUK — patched (supports items[] and legacy single item)
   ========================== */
async function stokMasuk(env, req){
  const b = await bodyJSON(req);
  if(!b) return json({ error:"body required" },400);

  // normalize items
  let items = [];
  if (Array.isArray(b.items) && b.items.length) {
    items = b.items.map(it => ({
      id: it.id || it.id_barang || it.barang_id,
      jumlah: Number(it.jumlah || it.qty || 0),
      keterangan: it.keterangan || ""
    }));
  } else if (b.id || b.id_barang) {
    items = [{ id: b.id || b.id_barang, jumlah: Number(b.jumlah || b.qty || 0), keterangan: b.keterangan || "" }];
  } else {
    return json({ error: "items[] or id_barang required" }, 400);
  }

  const operator = b.dibuat_oleh || b.operator || "Admin";
  const now = nowISO();
  const tid = "MSK-" + makeTID();

  for(const it of items){
    if(!it.id) continue;
    const old = await env.BMT_DB.prepare(`SELECT stock FROM barang WHERE id=?`).bind(it.id).first();
    if(!old) continue;

    const newStock = Number(old.stock||0) + Number(it.jumlah||0);

    await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`).bind(newStock, it.id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_masuk(barang_id,jumlah,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?)
    `).bind(it.id, it.jumlah, it.keterangan || "", operator, now, tid).run();
  }

  return json({ ok:true, transaksi_id: tid });
}

/* ==========================
   STOK KELUAR / PENJUALAN (prefix PJL-)
   ========================== */
async function stokKeluar(env, req){
  const b = await bodyJSON(req);
  if(!b || !Array.isArray(b.items) || !b.items.length) return json({ error:"items[] required" },400);

  const items = b.items;
  const operator = b.dibuat_oleh || b.operator || "Admin";
  const now = nowISO();
  const tid = "PJL-" + makeTID();

  for(const it of items){
    if(!it.id) continue;
    const row = await env.BMT_DB.prepare(`SELECT stock FROM barang WHERE id=?`).bind(it.id).first();
    if(!row) continue;
    const newStock = Number(row.stock||0) - Number(it.jumlah || 0);

    await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`).bind(newStock, it.id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_keluar(barang_id,jumlah,harga,dibuat_oleh,keterangan,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?,?)
    `).bind(it.id, it.jumlah, it.harga || 0, operator, it.keterangan || "", now, tid).run();
  }

  return json({ ok:true, transaksi_id: tid });
}

/* ==========================
   STOK AUDIT (POST) — prefix AUD-
   ========================== */
async function stokAudit(env, req){
  const b = await bodyJSON(req);
  if(!b || !b.barang_id) return json({ error:"barang_id required" },400);

  const operator = b.dibuat_oleh || b.operator || "Admin";
  const now = nowISO();
  const tid = "AUD-" + makeTID();

  const oldRow = await env.BMT_DB.prepare(`SELECT stock FROM barang WHERE id=?`).bind(b.barang_id).first();
  const oldStock = Number(oldRow?.stock || 0);
  const newStock = Number(b.stok_baru || b.stock || 0);

  await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`).bind(newStock, b.barang_id).run();

  // insert into stok_audit if exists; otherwise fallback to riwayat insert
  try {
    await env.BMT_DB.prepare(`
      INSERT INTO stok_audit(barang_id,stok_lama,stok_baru,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?,?)
    `).bind(b.barang_id, oldStock, newStock, b.keterangan || "", operator, now, tid).run();
  } catch(e) {
    // fallback: insert into riwayat (if table exists in schema)
    try {
      await env.BMT_DB.prepare(`
        INSERT INTO riwayat(tipe,barang_id,barang_nama,jumlah,catatan,dibuat_oleh,created_at,transaksi_id)
        VALUES (?,?,?,?,?,?,?,?)
      `).bind('audit', b.barang_id, '', newStock - oldStock, b.keterangan || "", operator, now, tid).run();
    } catch(_) {
      // last resort: swallow, but return ok — we don't want to crash the worker
    }
  }

  return json({ ok:true, transaksi_id: tid });
}

/* ==========================
   UPDATE BARANG — patched
   - If stock changed: create stok_audit (or fallback)
   - Do NOT insert into edit_barang
   ========================== */
async function updateBarang(env, req){
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const id = Number(parts[parts.length - 1]);
  const body = await bodyJSON(req);

  if(!id) return json({ error:"Missing ID" },400);

  const old = await env.BMT_DB.prepare(`SELECT * FROM barang WHERE id=?`).bind(id).first();
  if(!old) return json({ error:"Barang tidak ditemukan" },404);

  const operator = body.dibuat_oleh || body.operator || "Admin";
  const now = nowISO();

  // detect stock change -> create stok_audit (AUD-...)
  if (body.stock !== undefined && Number(body.stock) !== Number(old.stock)) {
    const tidAudit = "AUD-" + makeTID();

    await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`).bind(Number(body.stock), id).run();

    try {
      await env.BMT_DB.prepare(`
        INSERT INTO stok_audit(barang_id,stok_lama,stok_baru,keterangan,dibuat_oleh,created_at,transaksi_id)
        VALUES (?,?,?,?,?,?,?)
      `).bind(id, Number(old.stock||0), Number(body.stock), body.keterangan || "", operator, now, tidAudit).run();
    } catch(e) {
      // fallback to riwayat insert (if no stok_audit table)
      try {
        await env.BMT_DB.prepare(`
          INSERT INTO riwayat(tipe,barang_id,barang_nama,jumlah,catatan,dibuat_oleh,created_at,transaksi_id)
          VALUES (?,?,?,?,?,?,?,?)
        `).bind('audit', id, old.nama || "", Number(body.stock) - Number(old.stock || 0), body.keterangan || "", operator, now, tidAudit).run();
      } catch(_) {
        // swallow to avoid worker crash
      }
    }
  }

  // update other editable fields but DO NOT record edits in edit_barang
  const editable = ["nama","harga","harga_modal","kategori","foto","deskripsi"];
  const sets = []; const vals = [];
  for(const f of editable){
    if(body[f] !== undefined && body[f] != old[f]){ sets.push(`${f}=?`); vals.push(body[f]); }
  }
  if(sets.length){
    vals.push(id);
    await env.BMT_DB.prepare(`UPDATE barang SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
  }

  return json({ ok:true });
}

/* ==========================
   RIWAYAT — exclude edit_barang entirely
   ========================== */
async function riwayatAll(env, req){
async function riwayatAll(env, req){
  const url = req instanceof URL ? req : new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || 50);
  const offset = Number(url.searchParams.get("offset") || 0);

  const rows = await env.BMT_DB.prepare(`
    SELECT transaksi_id, MIN(created_at) AS waktu
    FROM riwayat
    GROUP BY transaksi_id
    ORDER BY waktu DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return json({ items: rows.results || [] });
}

async function riwayatDetail(env, req){
  const url = new URL(req.url);
  const tid = decodeURIComponent(url.pathname.split("/").pop());

  const r = await env.BMT_DB.prepare(`
    SELECT *
    FROM riwayat
    WHERE transaksi_id = ?
    ORDER BY created_at ASC
  `).bind(tid).all();

  const rows = r.results || [];

  return json({
    transaksi_id: tid,
    masuk: rows.filter(x => x.tipe === 'masuk'),
    keluar: rows.filter(x => x.tipe === 'keluar'),
    audit: rows.filter(x => x.tipe === 'audit'),
    edits: [] // kamu memang mau hide edit
  });
}

/* ==========================
   per-barang history
   ========================== */
async function riwayatBarang(env, req){
  const id = Number(req.url.split("/").pop());
  const masuk = await env.BMT_DB.prepare(`SELECT * FROM stok_masuk WHERE barang_id=? ORDER BY created_at DESC`).bind(id).all();
  const keluar = await env.BMT_DB.prepare(`SELECT * FROM stok_keluar WHERE barang_id=? ORDER BY created_at DESC`).bind(id).all();
  let audit;
  try {
    audit = await env.BMT_DB.prepare(`SELECT * FROM stok_audit WHERE barang_id=? ORDER BY created_at DESC`).bind(id).all();
    audit = audit.results || [];
  } catch(e) {
    const r = await env.BMT_DB.prepare(`SELECT * FROM riwayat WHERE barang_id=? ORDER BY created_at DESC`).bind(id).all().catch(()=>({ results: [] }));
    audit = (r.results || []).filter(x=> x.tipe === 'audit');
  }

  return json({
    barang_id: id,
    masuk: masuk.results || [],
    keluar: keluar.results || [],
    audit: audit || []
  });
}

/* ==========================
   MESSAGE / SETTINGS / USERS (kept original behavior)
   ========================== */
async function messageGet(env){
  const rows = await env.BMT_DB.prepare(`SELECT * FROM messages ORDER BY created_at DESC LIMIT 100`).all();
  return json({ items: rows.results || [] });
}
async function messageAdd(env, req){
  const b = await bodyJSON(req);
  if(!b || !b.text) return json({ error:"text required" },400);
  const now = nowISO();
  await env.BMT_DB.prepare(`INSERT INTO messages(text,created_at) VALUES(?,?)`).bind(b.text, now).run();
  return json({ ok:true });
}
async function messageDelete(env, req){
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM messages WHERE id=?`).bind(id).run();
  return json({ ok:true });
}

async function settingsList(env){
  const rows = await env.BMT_DB.prepare(`SELECT * FROM settings`).all();
  const map = {};
  (rows.results||[]).forEach(r=> map[r.key] = r.value);
  return json({ settings: map });
}
async function settingsSet(env, req){
  const b = await bodyJSON(req);
  if(!b || !b.key) return json({ error:"key required" },400);
  await env.BMT_DB.prepare(`INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)`).bind(b.key, b.value||"").run();
  return json({ ok:true });
}
async function settingsDelete(env, req){
  const key = req.url.split("/").pop();
  await env.BMT_DB.prepare(`DELETE FROM settings WHERE key=?`).bind(key).run();
  return json({ ok:true });
}

async function usersList(env){
  const rows = await env.BMT_DB.prepare(`SELECT id,username,role FROM users ORDER BY username ASC`).all();
  return json({ users: rows.results || [] });
}
async function usersAdd(env, req){
  const b = await bodyJSON(req);
  if(!b || !b.username) return json({ error:"username required" },400);
  await env.BMT_DB.prepare(`INSERT INTO users(username,password,role,created_at) VALUES(?,?,?,?)`)
    .bind(b.username, b.password||"", b.role||"user", nowISO()).run();
  return json({ ok:true });
}
async function usersUpdate(env, req){
  const id = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);
  const sets=[]; const vals=[];
  ["username","role"].forEach(k=>{ if(b[k]!==undefined){ sets.push(`${k}=?`); vals.push(b[k]); }});
  if(sets.length){ vals.push(id); await env.BMT_DB.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).bind(...vals).run(); }
  return json({ ok:true });
}
async function usersDelete(env, req){
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM users WHERE id=?`).bind(id).run();
  return json({ ok:true });
}

  /* ==========================
   PENGELUARAN — endpoint baru
   ========================== */

// POST /api/pengeluaran
async function pengeluaranAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.nama || !b.jumlah)
    return json({ error: "nama & jumlah required" }, 400);

  const now = nowISO();

  await env.BMT_DB.prepare(`
    INSERT INTO pengeluaran (nama, kategori, jumlah, catatan, dibuat_oleh, created_at)
    VALUES (?,?,?,?,?,?)
  `).bind(
    b.nama,
    b.kategori || "",
    Number(b.jumlah || 0),
    b.catatan || "",
    b.dibuat_oleh || "Admin",
    now
  ).run();

  return json({ ok: true });
}

// GET /api/pengeluaran
async function pengeluaranList(env) {
  const r = await env.BMT_DB.prepare(`
    SELECT * FROM pengeluaran ORDER BY created_at DESC
  `).all();

  return json({ items: r.results || [] });
}

// DELETE /api/pengeluaran/:id
async function pengeluaranDelete(env, req) {
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM pengeluaran WHERE id=?`)
    .bind(id)
    .run();
  return json({ ok: true });
}
/* End of file */
