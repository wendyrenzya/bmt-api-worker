// ==========================================================
//  WORKER.JS — FINAL (dengan harga penjualan + edit barang)
// ==========================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders() });

    try {
      /* ===== BARANG ===== */
      if (path === "/api/barang" && method === "GET") return listBarang(env);
      if (path === "/api/barang" && method === "POST") return addBarang(env, request);
      if (path.startsWith("/api/barang/") && method === "GET") return getBarang(env, request);
      if (path.startsWith("/api/barang/") && method === "PUT") return updateBarang(env, request);
      if (path.startsWith("/api/barang/") && method === "DELETE") return deleteBarang(env, request);

      /* ===== SEARCH / KATEGORI ===== */
      if (path === "/api/barang_search" && method === "GET") return searchBarang(env, url);
      if (path === "/api/kategori" && method === "GET") return listKategori(env);

      /* ===== STOK MASUK ===== */
      if (path === "/api/stok_masuk" && method === "POST") return stokMasuk(env, request);

      /* ===== STOK KELUAR / PENJUALAN ===== */
      if (path === "/api/stok_keluar" && method === "POST") return stokKeluar(env, request);

      /* ===== AUDIT ===== */
      if (path === "/api/stok_audit" && method === "POST") return stokAudit(env, request);

      /* ===== RIWAYAT ===== */
      if (path === "/api/riwayat" && method === "GET") return riwayatAll(env, url);
      if (path.startsWith("/api/riwayat/") && method === "GET") return riwayatDetail(env, request);

      /* ===== PER BARANG ===== */
      if (path.startsWith("/api/barang_history/") && method === "GET") return riwayatBarang(env, request);

      /* ===== MESSAGE ===== */
      if (path === "/api/message" && method === "GET") return messageGet(env);
      if (path === "/api/message" && method === "POST") return messageAdd(env, request);
      if (path.startsWith("/api/message/") && method === "DELETE") return messageDelete(env, request);

      /* ===== SETTINGS ===== */
      if (path === "/api/settings" && method === "GET") return settingsList(env);
      if (path === "/api/settings" && method === "POST") return settingsSet(env, request);
      if (path.startsWith("/api/settings/") && method === "DELETE") return settingsDelete(env, request);

      /* ===== USERS ===== */
      if (path === "/api/users" && method === "GET") return usersList(env);
      if (path === "/api/users" && method === "POST") return usersAdd(env, request);
      if (path.startsWith("/api/users/") && method === "PUT") return usersUpdate(env, request);
      if (path.startsWith("/api/users/") && method === "DELETE") return usersDelete(env, request);

      return json({ error: "Endpoint Not Found" }, 404);
    } catch (e) {
      return json({ error: e.message || "Server Error" }, 500);
    }
  }
};

/* ==========================
   UTILITIES
========================== */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
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
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = Math.random().toString(16).substring(2, 7).toUpperCase();
  return `${ts}-${rnd}`;
}

/* ==========================
   BARANG CRUD
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

  const kode = String(Date.now()).slice(-5);
  const now = nowISO();
  await env.BMT_DB.prepare(`
    INSERT INTO barang(kode_barang,nama,harga_modal,harga,stock,kategori,foto,deskripsi,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    kode, b.nama, b.harga_modal||0, b.harga, b.stock||0,
    b.kategori||"", b.foto||"", b.deskripsi||"", now
  ).run();

  return json({ ok:true });
}

/* ========= PATCH BESAR: RIWAYAT EDIT BARANG ========= */
async function updateBarang(env, req){
  const id = Number(req.url.split("/").pop());
  const body = await bodyJSON(req);
  if(!id) return json({ error:"Invalid ID" },400);

  const old = await env.BMT_DB.prepare(`SELECT * FROM barang WHERE id=?`).bind(id).first();
  if(!old) return json({ error:"Barang tidak ditemukan" },404);

  const now = nowISO();
  const tid = makeTID();
  const operator = body.dibuat_oleh || "guest";

  // hanya catat perubahan penting
  const fieldsToTrack = ["nama","harga_modal","harga","kategori"];

  for(const f of fieldsToTrack){
    if(body[f] !== undefined && body[f] != old[f]){
      await env.BMT_DB.prepare(`
        INSERT INTO edit_barang(barang_id, field, before, after, dibuat_oleh, created_at, transaksi_id)
        VALUES (?,?,?,?,?,?,?)
      `).bind(id, f, String(old[f]||""), String(body[f]||""), operator, now, tid).run();
    }
  }

  // lanjut update barang
  const sets=[]; const vals=[];
  const editable = ["nama","harga_modal","harga","stock","kategori","foto","deskripsi"];
  for(const f of editable){
    if(body[f] !== undefined){ sets.push(`${f}=?`); vals.push(body[f]); }
  }
  vals.push(id);
  await env.BMT_DB.prepare(`UPDATE barang SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();

  return json({ ok:true, transaksi_id: tid });
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
  if(!q) return json({ items:[] });
  const rows = await env.BMT_DB.prepare(`
    SELECT id,nama,stock FROM barang WHERE nama LIKE ? ORDER BY nama ASC
  `).bind(`%${q}%`).all();
  return json({ items: rows.results || [] });
}
async function listKategori(env){
  const rows = await env.BMT_DB.prepare(`
    SELECT DISTINCT kategori FROM barang WHERE kategori!='' ORDER BY kategori
  `).all();
  return json({ categories: (rows.results||[]).map(x=>x.kategori) });
}

/* ==========================
   STOK MASUK
========================== */
async function stokMasuk(env, req){
  const b = await bodyJSON(req);
  if(!b || !Array.isArray(b.items) || !b.items.length)
    return json({ error:"items[] required" },400);

  const tid = makeTID();
  const op = b.operator || "guest";
  const ket = b.keterangan || "";
  const now = nowISO();

  for(const it of b.items){
    const item = await env.BMT_DB.prepare(`SELECT stock FROM barang WHERE id=?`).bind(it.id).first();
    if(!item) continue;
    const newStock = Number(item.stock||0) + Number(it.jumlah||0);

    await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`)
      .bind(newStock, it.id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_masuk(barang_id,jumlah,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?)
    `).bind(it.id, it.jumlah, ket, op, now, tid).run();
  }

  return json({ ok:true, transaksi_id: tid });
}

/* ==========================
   STOK KELUAR (penjualan) + harga
========================== */
async function stokKeluar(env, req){
  const b = await bodyJSON(req);
  if(!b || !Array.isArray(b.items) || !b.items.length)
    return json({ error:"items[] required" },400);

  const tid = makeTID();
  const op = b.operator || "guest";
  const ket = b.keterangan || "";
  const now = nowISO();

  for(const it of b.items){
    const item = await env.BMT_DB.prepare(`
      SELECT stock, harga_modal, harga FROM barang WHERE id=?
    `).bind(it.id).first();
    if(!item) continue;

    const old = Number(item.stock||0);
    const qty = Number(it.jumlah||0);

    if(qty > old)
      return json({ error:"Stock tidak cukup", barang_id:it.id, stock:old },400);

    const newStock = old - qty;

    await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`)
      .bind(newStock, it.id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_keluar(barang_id,jumlah,keterangan,dibuat_oleh,created_at,transaksi_id,harga,harga_modal)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      it.id,
      qty,
      ket,
      op,
      now,
      tid,
      item.harga,
      item.harga_modal
    ).run();
  }

  return json({ ok:true, transaksi_id: tid });
}

/* ==========================
   AUDIT
========================== */
async function stokAudit(env, req){
  const b = await bodyJSON(req);
  if(!b || !Array.isArray(b.items) || !b.items.length)
    return json({ error:"items[] required" },400);

  const tid = makeTID();
  const op = b.operator || "guest";
  const ket = b.keterangan || "";
  const now = nowISO();

  for(const it of b.items){
    const item = await env.BMT_DB.prepare(`SELECT stock FROM barang WHERE id=?`).bind(it.id).first();
    if(!item) continue;

    const old = Number(item.stock||0);
    const newStock = Number(it.stok_baru||0);

    await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`)
      .bind(newStock, it.id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_audit(barang_id,stok_lama,stok_baru,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?,?)
    `).bind(it.id, old, newStock, ket, op, now, tid).run();
  }

  return json({ ok:true, transaksi_id: tid });
}

/* ==========================
   RIWAYAT (per transaksi)
========================== */
async function riwayatAll(env, url){
  const limit = Number(url.searchParams.get("limit")||50);
  const offset = Number(url.searchParams.get("offset")||0);

  const rows = await env.BMT_DB.prepare(`
    SELECT transaksi_id, MIN(created_at) AS waktu FROM (
      SELECT transaksi_id, created_at FROM stok_masuk
      UNION ALL
      SELECT transaksi_id, created_at FROM stok_keluar
      UNION ALL
      SELECT transaksi_id, created_at FROM stok_audit
      UNION ALL
      SELECT transaksi_id, created_at FROM edit_barang
    )
    GROUP BY transaksi_id
    ORDER BY waktu DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return json({ transactions: rows.results || [] });
}

/* ==========================
   RIWAYAT DETAIL
========================== */
async function riwayatDetail(env, req){
  const tid = decodeURIComponent(req.url.split("/").pop());

  const masuk = await env.BMT_DB.prepare(`
    SELECT 'masuk' AS jenis, sm.*, b.nama AS barang_nama
    FROM stok_masuk sm
    LEFT JOIN barang b ON b.id = sm.barang_id
    WHERE sm.transaksi_id=?
    ORDER BY sm.created_at ASC
  `).bind(tid).all();

  const keluar = await env.BMT_DB.prepare(`
    SELECT 'keluar' AS jenis, sk.*, b.nama AS barang_nama
    FROM stok_keluar sk
    LEFT JOIN barang b ON b.id = sk.barang_id
    WHERE sk.transaksi_id=?
    ORDER BY sk.created_at ASC
  `).bind(tid).all();

  const audit = await env.BMT_DB.prepare(`
    SELECT 'audit' AS jenis, sa.*, b.nama AS barang_nama
    FROM stok_audit sa
    LEFT JOIN barang b ON b.id = sa.barang_id
    WHERE sa.transaksi_id=?
    ORDER BY sa.created_at ASC
  `).bind(tid).all();

  const edits = await env.BMT_DB.prepare(`
    SELECT 'edit' AS jenis,
           e.*, 
           b.nama AS barang_nama
    FROM edit_barang e
    LEFT JOIN barang b ON b.id = e.barang_id
    WHERE e.transaksi_id=?
    ORDER BY e.created_at ASC
  `).bind(tid).all();

  return json({
    transaksi_id: tid,
    masuk: masuk.results || [],
    keluar: keluar.results || [],
    audit: audit.results || [],
    servis: [], // nanti untuk servis
    edits: edits.results || []
  });
}

/* ==========================
   RIWAYAT PER BARANG
========================== */
async function riwayatBarang(env, req){
  const id = Number(req.url.split("/").pop());
  const sql = `
    SELECT * FROM (
      SELECT 'masuk' AS jenis, sm.*, b.nama AS barang_nama
      FROM stok_masuk sm LEFT JOIN barang b ON b.id=sm.barang_id
      WHERE sm.barang_id=?

      UNION ALL
      SELECT 'keluar', sk.*, b.nama AS barang_nama
      FROM stok_keluar sk LEFT JOIN barang b ON b.id=sk.barang_id
      WHERE sk.barang_id=?

      UNION ALL
      SELECT 'audit', sa.*, b.nama AS barang_nama
      FROM stok_audit sa LEFT JOIN barang b ON b.id=sa.barang_id
      WHERE sa.barang_id=?

      UNION ALL
      SELECT 'edit', e.*, b.nama AS barang_nama
      FROM edit_barang e LEFT JOIN barang b ON b.id=e.barang_id
      WHERE e.barang_id=?
    )
    ORDER BY created_at DESC
  `;
  const rows = await env.BMT_DB.prepare(sql).bind(id, id, id, id).all();
  return json({ items: rows.results || [] });
}

/* ==========================
   MESSAGES
========================== */
async function messageGet(env){
  const row = await env.BMT_DB.prepare(`
    SELECT * FROM app_messages WHERE is_sticky=1 
    ORDER BY created_at DESC LIMIT 1
  `).first();
  return json({ message: row || null });
}
async function messageAdd(env, req){
  const b = await bodyJSON(req);
  const msg = b.message || "";
  const sticky = b.is_sticky ? 1 : 0;
  const now = nowISO();

  if(sticky){
    await env.BMT_DB.prepare(`UPDATE app_messages SET is_sticky=0 WHERE is_sticky=1`).run();
  }

  await env.BMT_DB.prepare(`
    INSERT INTO app_messages(message,is_sticky,created_at)
    VALUES (?,?,?)
  `).bind(msg, sticky, now).run();

  return json({ ok:true });
}
async function messageDelete(env, req){
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM app_messages WHERE id=?`)
    .bind(id).run();
  return json({ ok:true });
}

/* ==========================
   SETTINGS
========================== */
async function settingsList(env){
  const rows = await env.BMT_DB.prepare(`SELECT key,value FROM settings`).all();
  const out={}; (rows.results||[]).forEach(r=> out[r.key]=r.value );
  return json({ settings: out });
}
async function settingsSet(env, req){
  const b = await bodyJSON(req);
  await env.BMT_DB.prepare(`
    INSERT OR REPLACE INTO settings(key,value)
    VALUES (?,?)
  `).bind(b.key, String(b.value||"")).run();
  return json({ ok:true });
}
async function settingsDelete(env, req){
  const key = decodeURIComponent(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM settings WHERE key=?`)
    .bind(key).run();
  return json({ ok:true });
}

/* ==========================
   USERS
========================== */
async function usersList(env){
  const rows = await env.BMT_DB.prepare(`
    SELECT id,username,nama,role,created_at FROM users ORDER BY id
  `).all();
  return json({ users: rows.results || [] });
}
async function usersAdd(env, req){
  const b = await bodyJSON(req);
  if(!b.username || !b.password)
    return json({ error:"username & password required" },400);

  const exists = await env.BMT_DB
    .prepare(`SELECT id FROM users WHERE username=?`)
    .bind(b.username).first();
  if(exists) return json({ error:"username exists" },400);

  const hash = await sha256(b.password);
  const now = nowISO();
  await env.BMT_DB.prepare(`
    INSERT INTO users(username,nama,password_hash,role,created_at)
    VALUES (?,?,?,?,?)
  `).bind(b.username, b.nama||"", hash, b.role||"user", now).run();

  return json({ ok:true });
}
async function usersUpdate(env, req){
  const id = Number(req.url.split("/").pop());
  const b = await bodyJSON(req);

  const fields=[]; const vals=[];
  if(b.username!==undefined){ fields.push("username=?"); vals.push(b.username); }
  if(b.nama!==undefined){ fields.push("nama=?"); vals.push(b.nama); }
  if(b.role!==undefined){ fields.push("role=?"); vals.push(b.role); }
  if(b.password){
    const hash = await sha256(b.password);
    fields.push("password_hash=?");
    vals.push(hash);
  }
  if(!fields.length) return json({ error:"Nothing to update" },400);
  vals.push(id);

  await env.BMT_DB.prepare(`
    UPDATE users SET ${fields.join(", ")} WHERE id=?
  `).bind(...vals).run();
  return json({ ok:true });
}
async function usersDelete(env, req){
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM users WHERE id=?`).bind(id).run();
  return json({ ok:true });
}

/* ==========================
   SHA-256
========================== */
async function sha256(str){
  const enc = new TextEncoder().encode(str);
  const h = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
