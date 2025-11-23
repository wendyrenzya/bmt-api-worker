export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

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

      /* ===== STOK KELUAR ===== */
      if (path === "/api/stok_keluar" && method === "POST") return stokKeluar(env, request);

      /* ===== AUDIT ===== */
      if (path === "/api/stok_audit" && method === "POST") return stokAudit(env, request);

      /* ===== SERVIS (optional) ===== */
      if (path === "/api/servis" && method === "GET") return servisList(env, url);
      if (path === "/api/servis" && method === "POST") return servisAdd(env, request);
      if (path.startsWith("/api/servis/") && method === "GET") return servisByTid(env, request);

      /* ===== BARANG EDITS (logging edits) ===== */
      if (path === "/api/barang_edits" && method === "POST") return addBarangEdit(env, request);
      if (path === "/api/barang_edits" && method === "GET") return getBarangEdits(env, url);

      /* ===== RIWAYAT (light & detail) ===== */
      if (path === "/api/riwayat" && method === "GET") return riwayatAll(env, url);
      if (path.startsWith("/api/riwayat/") && method === "GET") return riwayatDetail(env, request);

      /* ===== RIWAYAT BATCH (OPTIMIZED) ===== */
      if (path === "/api/riwayat_batch" && method === "GET") return riwayatBatch(env, url);

      /* ===== RIWAYAT PER BARANG ===== */
      if (path.startsWith("/api/barang_history/") && method === "GET") return riwayatBarang(env, request);

      /* ===== MESSAGES ===== */
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
    } catch (err) {
      return json({ error: err.message || "Server Error" }, 500);
    }
  }
};

/* =========================
   Utilities
   ========================= */
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
  try { return await request.json(); } catch { return null; }
}
function nowISO(){ return new Date().toISOString(); }
function makeTID() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = Math.random().toString(16).substring(2,6).toUpperCase();
  return `${ts}-${rnd}`;
}
function sqlPlaceholdersAndVals(arr){
  if(!arr || !arr.length) return { ph:"()", vals:[] };
  const ph = arr.map(_=>"?").join(",");
  return { ph:`(${ph})`, vals: arr };
}

/* =========================
   Barang CRUD
   ========================= */
async function listBarang(env){
  const res = await env.BMT_DB.prepare(`SELECT * FROM barang ORDER BY nama ASC`).all();
  return json({ items: res.results || [] });
}
async function getBarang(env, request){
  const id = Number(request.url.split("/").pop());
  if(!id) return json({ item:null }, 400);
  const res = await env.BMT_DB.prepare("SELECT * FROM barang WHERE id=?").bind(id).first();
  return json({ item: res || null });
}
async function addBarang(env, request){
  const b = await bodyJSON(request);
  if(!b || !b.nama || !b.harga) return json({ error:"nama & harga required" }, 400);
  const kode = String(Date.now()).slice(-5);
  const now = nowISO();
  await env.BMT_DB.prepare(`
    INSERT INTO barang (kode_barang,nama,harga_modal,harga,stock,kategori,foto,deskripsi,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(kode,b.nama,b.harga_modal||0,b.harga,b.stock||0,b.kategori||"",b.foto||"",b.deskripsi||"",now).run();
  return json({ ok:true });
}
async function updateBarang(env, request){
  const id = Number(request.url.split("/").pop());
  const b = await bodyJSON(request);
  if(!b) return json({ error:"Invalid JSON" }, 400);
  const allowed = ["nama","harga_modal","harga","stock","kategori","foto","deskripsi"];
  const sets=[]; const vals=[];
  for(const k of allowed) if(b[k] !== undefined){ sets.push(`${k}=?`); vals.push(b[k]); }
  if(!sets.length) return json({ error:"No fields" }, 400);
  vals.push(id);
  await env.BMT_DB.prepare(`UPDATE barang SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
  return json({ ok:true });
}
async function deleteBarang(env, request){
  const id = Number(request.url.split("/").pop());
  await env.BMT_DB.prepare("DELETE FROM barang WHERE id=?").bind(id).run();
  return json({ ok:true });
}

/* =========================
   Search & kategori
   ========================= */
async function searchBarang(env, url){
  const q = (url.searchParams.get("q")||"").trim();
  if(!q) return json({ items: [] });
  const rows = await env.BMT_DB.prepare(`SELECT id,nama,stock,foto FROM barang WHERE nama LIKE ? ORDER BY nama ASC`).bind(`%${q}%`).all();
  return json({ items: rows.results || [] });
}
async function listKategori(env){
  const rows = await env.BMT_DB.prepare(`SELECT DISTINCT kategori FROM barang WHERE kategori!='' ORDER BY kategori`).all();
  return json({ categories: rows.results?.map(r=>r.kategori) || [] });
}

/* =========================
   stok_masuk
   ========================= */
async function stokMasuk(env, request){
  const body = await bodyJSON(request);
  if(!body || !Array.isArray(body.items) || !body.items.length) return json({ error:"items[] required" },400);
  const tid = makeTID();
  const operator = body.operator||"guest";
  const keterangan = body.keterangan||"";
  const now = nowISO();
  for(const it of body.items){
    const item = await env.BMT_DB.prepare("SELECT stock FROM barang WHERE id=?").bind(it.id).first();
    if(!item) continue;
    const stokBaru = Number(item.stock||0) + Number(it.jumlah||0);
    await env.BMT_DB.prepare("UPDATE barang SET stock=? WHERE id=?").bind(stokBaru,it.id).run();
    await env.BMT_DB.prepare(`
      INSERT INTO stok_masuk (barang_id,jumlah,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?)
    `).bind(it.id,it.jumlah,keterangan,operator,now,tid).run();
  }
  return json({ ok:true, transaksi_id: tid });
}

/* =========================
   stok_keluar (penjualan)
   ========================= */
async function stokKeluar(env, request){
  const body = await bodyJSON(request);
  if(!body || !Array.isArray(body.items) || !body.items.length) return json({ error:"items[] required" },400);
  const tid = makeTID();
  const operator = body.operator||"guest";
  const keterangan = body.keterangan||"";
  const now = nowISO();
  for(const it of body.items){
    const item = await env.BMT_DB.prepare("SELECT stock FROM barang WHERE id=?").bind(it.id).first();
    if(!item) continue;
    const old = Number(item.stock||0);
    if(old < Number(it.jumlah)) return json({ error:"Stock tidak cukup", barang_id: it.id, stock: old }, 400);
    const stokBaru = old - Number(it.jumlah);
    await env.BMT_DB.prepare("UPDATE barang SET stock=? WHERE id=?").bind(stokBaru,it.id).run();
    await env.BMT_DB.prepare(`
      INSERT INTO stok_keluar (barang_id,jumlah,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?)
    `).bind(it.id,it.jumlah,keterangan,operator,now,tid).run();
  }
  return json({ ok:true, transaksi_id: tid });
}

/* =========================
   stok_audit
   ========================= */
async function stokAudit(env, request){
  const body = await bodyJSON(request);
  if(!body || !Array.isArray(body.items) || !body.items.length) return json({ error:"items[] required" },400);
  const tid = makeTID();
  const operator = body.operator||"guest";
  const keterangan = body.keterangan||"";
  const now = nowISO();
  for(const it of body.items){
    const item = await env.BMT_DB.prepare("SELECT stock FROM barang WHERE id=?").bind(it.id).first();
    if(!item) continue;
    const old = Number(item.stock||0);
    const stokBaru = Number(it.stok_baru);
    await env.BMT_DB.prepare("UPDATE barang SET stock=? WHERE id=?").bind(stokBaru,it.id).run();
    await env.BMT_DB.prepare(`
      INSERT INTO stok_audit (barang_id,stok_lama,stok_baru,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?,?)
    `).bind(it.id,old,stokBaru,keterangan,operator,now,tid).run();
  }
  return json({ ok:true, transaksi_id: tid });
}

/* =========================
   SERVIS endpoints (simple)
   Table expected:
   servis(id, transaksi_id, daftar_servis, biaya, mekanik, dibuat_oleh, created_at)
   ========================= */
async function servisAdd(env, request){
  const b = await bodyJSON(request);
  if(!b || !b.transaksi_id) return json({ error:"transaksi_id required" },400);
  const daftar = b.daftar_servis || b.daftar || "";
  const biaya = Number(b.biaya || 0);
  const mekanik = b.mekanik || "";
  const dibuat_oleh = b.dibuat_oleh || b.dibuat_by || "guest";
  const now = b.created_at || nowISO();

  await env.BMT_DB.prepare(`
    INSERT INTO servis (transaksi_id, daftar_servis, biaya, mekanik, dibuat_oleh, created_at)
    VALUES (?,?,?,?,?,?)
  `).bind(b.transaksi_id, daftar, biaya, mekanik, dibuat_oleh, now).run();

  return json({ ok:true });
}

async function servisByTid(env, request){
  const tid = decodeURIComponent(request.url.split("/").pop());
  const rows = await env.BMT_DB.prepare(`
    SELECT transaksi_id, daftar_servis, biaya, mekanik, dibuat_oleh, created_at
    FROM servis WHERE transaksi_id=?
    ORDER BY created_at ASC
  `).bind(tid).all();
  return json({ items: rows.results || [] });
}

async function servisList(env, url){
  const tid = url.searchParams.get("transaksi_id") || "";
  if(tid){
    const rows = await env.BMT_DB.prepare(`
      SELECT transaksi_id, daftar_servis, biaya, mekanik, dibuat_oleh, created_at
      FROM servis WHERE transaksi_id=?
      ORDER BY created_at ASC
    `).bind(tid).all();
    return json({ items: rows.results || [] });
  }
  // generic list
  const limit = Number(url.searchParams.get("limit") || 50);
  const offset = Number(url.searchParams.get("offset") || 0);
  const rows = await env.BMT_DB.prepare(`
    SELECT transaksi_id, daftar_servis, biaya, mekanik, dibuat_oleh, created_at
    FROM servis ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();
  return json({ items: rows.results || [] });
}

/* =========================
   BARANG EDIT LOG (best-effort)
   Table expected: barang_edits(id, transaksi_id, barang_id, field, old_value, new_value, dibuat_oleh, created_at)
   ========================= */
async function addBarangEdit(env, request){
  const b = await bodyJSON(request);
  if(!b || !b.barang_id) return json({ error:"barang_id required" },400);
  const tid = b.transaksi_id || makeTID();
  const now = b.created_at || nowISO();
  await env.BMT_DB.prepare(`
    INSERT INTO barang_edits (transaksi_id, barang_id, field, old_value, new_value, dibuat_oleh, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).bind(tid, b.barang_id, b.field||"", String(b.old_value||""), String(b.new_value||""), b.dibuat_oleh||"guest", now).run();
  return json({ ok:true, transaksi_id: tid });
}
async function getBarangEdits(env, url){
  const tid = url.searchParams.get("transaksi_id");
  if(tid){
    const rows = await env.BMT_DB.prepare(`
      SELECT transaksi_id, barang_id, field, old_value, new_value, dibuat_oleh, created_at
      FROM barang_edits WHERE transaksi_id=? ORDER BY created_at ASC
    `).bind(tid).all();
    return json({ items: rows.results || [] });
  }
  const barangId = url.searchParams.get("barang_id");
  if(barangId){
    const rows = await env.BMT_DB.prepare(`
      SELECT transaksi_id, barang_id, field, old_value, new_value, dibuat_oleh, created_at
      FROM barang_edits WHERE barang_id=? ORDER BY created_at DESC
    `).bind(barangId).all();
    return json({ items: rows.results || [] });
  }
  return json({ items: [] });
}

/* =========================
   RIWAYAT (group ids)
   ========================= */
async function riwayatAll(env, url){
  const limit = Number(url.searchParams.get("limit") || 50);
  const offset = Number(url.searchParams.get("offset") || 0);

  const sql = `
    SELECT transaksi_id, MIN(created_at) AS waktu
    FROM (
      SELECT transaksi_id, created_at FROM stok_masuk
      UNION ALL
      SELECT transaksi_id, created_at FROM stok_keluar
      UNION ALL
      SELECT transaksi_id, created_at FROM stok_audit
      UNION ALL
      SELECT transaksi_id, created_at FROM servis
      UNION ALL
      SELECT transaksi_id, created_at FROM barang_edits
    )
    GROUP BY transaksi_id
    ORDER BY waktu DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await env.BMT_DB.prepare(sql).bind(limit, offset).all();
  return json({ items: rows.results || [] });
}

/* =========================================================
   RIWAYAT_BATCH — optimized bulk fetch for many transaksi_id
   GET /api/riwayat_batch?limit=20&offset=0
   returns { transactions: [ { transaksi_id, waktu, masuk:[], keluar:[], audit:[], servis:[], edits:[] } ] }
   ========================================================= */
async function riwayatBatch(env, url){
  const limit = Number(url.searchParams.get("limit") || 20);
  const offset = Number(url.searchParams.get("offset") || 0);

  // 1) get transaksi ids
  const idsRes = await env.BMT_DB.prepare(`
    SELECT transaksi_id, MIN(created_at) AS waktu
    FROM (
      SELECT transaksi_id, created_at FROM stok_masuk
      UNION ALL
      SELECT transaksi_id, created_at FROM stok_keluar
      UNION ALL
      SELECT transaksi_id, created_at FROM stok_audit
      UNION ALL
      SELECT transaksi_id, created_at FROM servis
      UNION ALL
      SELECT transaksi_id, created_at FROM barang_edits
    )
    GROUP BY transaksi_id
    ORDER BY waktu DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const ids = (idsRes.results || []).map(r => r.transaksi_id);
  if(!ids.length) return json({ transactions: [] });

  // placeholders
  const { ph, vals } = sqlPlaceholdersAndVals(ids);

  // 2) fetch masuk
  const masukSql = `
    SELECT sm.transaksi_id, sm.barang_id, sm.jumlah, sm.keterangan, sm.dibuat_oleh, sm.created_at,
           b.nama AS barang_nama, b.foto AS barang_foto
    FROM stok_masuk sm
    LEFT JOIN barang b ON b.id = sm.barang_id
    WHERE sm.transaksi_id IN ${ph}
    ORDER BY sm.created_at ASC
  `;
  const masukRows = await env.BMT_DB.prepare(masukSql).bind(...vals).all();

  // 3) fetch keluar
  const keluarSql = `
    SELECT sk.transaksi_id, sk.barang_id, sk.jumlah, sk.keterangan, sk.dibuat_oleh, sk.created_at,
           b.nama AS barang_nama, b.foto AS barang_foto
    FROM stok_keluar sk
    LEFT JOIN barang b ON b.id = sk.barang_id
    WHERE sk.transaksi_id IN ${ph}
    ORDER BY sk.created_at ASC
  `;
  const keluarRows = await env.BMT_DB.prepare(keluarSql).bind(...vals).all();

  // 4) fetch audit
  const auditSql = `
    SELECT sa.transaksi_id, sa.barang_id, sa.stok_lama, sa.stok_baru, (sa.stok_baru - sa.stok_lama) AS jumlah,
           sa.keterangan, sa.dibuat_oleh, sa.created_at,
           b.nama AS barang_nama, b.foto AS barang_foto
    FROM stok_audit sa
    LEFT JOIN barang b ON b.id = sa.barang_id
    WHERE sa.transaksi_id IN ${ph}
    ORDER BY sa.created_at ASC
  `;
  const auditRows = await env.BMT_DB.prepare(auditSql).bind(...vals).all();

  // 5) fetch servis (if table exists)
  let servisRows = { results: [] };
  try{
    const servisSql = `
      SELECT transaksi_id, daftar_servis, biaya, mekanik, dibuat_oleh, created_at
      FROM servis WHERE transaksi_id IN ${ph} ORDER BY created_at ASC
    `;
    servisRows = await env.BMT_DB.prepare(servisSql).bind(...vals).all();
  }catch(e){
    // table may not exist yet — ignore
    servisRows = { results: [] };
  }

  // 6) fetch barang_edits (if exists)
  let editsRows = { results: [] };
  try{
    const editsSql = `
      SELECT transaksi_id, barang_id, field, old_value, new_value, dibuat_oleh, created_at
      FROM barang_edits WHERE transaksi_id IN ${ph} ORDER BY created_at ASC
    `;
    editsRows = await env.BMT_DB.prepare(editsSql).bind(...vals).all();
  }catch(e){
    editsRows = { results: [] };
  }

  // 7) group by transaksi_id
  const map = {};
  idsRes.results.forEach(r=>{
    map[r.transaksi_id] = { transaksi_id: r.transaksi_id, waktu: r.waktu, masuk:[], keluar:[], audit:[], servis:[], edits:[] };
  });

  (masukRows.results || []).forEach(r=>{
    if(!map[r.transaksi_id]) return;
    map[r.transaksi_id].masuk.push(r);
  });
  (keluarRows.results || []).forEach(r=>{
    if(!map[r.transaksi_id]) return;
    map[r.transaksi_id].keluar.push(r);
  });
  (auditRows.results || []).forEach(r=>{
    if(!map[r.transaksi_id]) return;
    map[r.transaksi_id].audit.push(r);
  });
  (servisRows.results || []).forEach(r=>{
    if(!map[r.transaksi_id]) return;
    map[r.transaksi_id].servis.push(r);
  });
  (editsRows.results || []).forEach(r=>{
    if(!map[r.transaksi_id]) return;
    map[r.transaksi_id].edits.push(r);
  });

  // build ordered array
  const out = ids.map(id => map[id]);

  return json({ transactions: out });
}

/* =========================
   RIWAYAT DETAIL (single tid)  — kept for backward compatibility
   (these already join barang for names)
   ========================= */
async function riwayatDetail(env, request){
  const transaksi_id = decodeURIComponent(request.url.split("/").pop());

  const masuk = await env.BMT_DB.prepare(`
    SELECT 'masuk' AS jenis,
           sm.barang_id,
           sm.jumlah,
           sm.keterangan,
           sm.dibuat_oleh,
           sm.created_at,
           b.nama AS barang_nama,
           b.foto AS barang_foto
    FROM stok_masuk sm
    LEFT JOIN barang b ON b.id = sm.barang_id
    WHERE sm.transaksi_id=?
    ORDER BY sm.created_at ASC
  `).bind(transaksi_id).all();

  const keluar = await env.BMT_DB.prepare(`
    SELECT 'keluar' AS jenis,
           sk.barang_id,
           sk.jumlah,
           sk.keterangan,
           sk.dibuat_oleh,
           sk.created_at,
           b.nama AS barang_nama,
           b.foto AS barang_foto
    FROM stok_keluar sk
    LEFT JOIN barang b ON b.id = sk.barang_id
    WHERE sk.transaksi_id=?
    ORDER BY sk.created_at ASC
  `).bind(transaksi_id).all();

  const audit = await env.BMT_DB.prepare(`
    SELECT 'audit' AS jenis,
           sa.barang_id,
           (sa.stok_baru - sa.stok_lama) AS jumlah,
           sa.stok_lama,
           sa.stok_baru,
           sa.keterangan,
           sa.dibuat_oleh,
           sa.created_at,
           b.nama AS barang_nama,
           b.foto AS barang_foto
    FROM stok_audit sa
    LEFT JOIN barang b ON b.id = sa.barang_id
    WHERE sa.transaksi_id=?
    ORDER BY sa.created_at ASC
  `).bind(transaksi_id).all();

  // try fetch servis & edits best-effort
  let servis = { results: [] };
  try{
    servis = await env.BMT_DB.prepare(`SELECT transaksi_id, daftar_servis, biaya, mekanik, dibuat_oleh, created_at FROM servis WHERE transaksi_id=? ORDER BY created_at ASC`).bind(transaksi_id).all();
  }catch(e){ servis = { results: [] }; }

  let edits = { results: [] };
  try{
    edits = await env.BMT_DB.prepare(`SELECT transaksi_id, barang_id, field, old_value, new_value, dibuat_oleh, created_at FROM barang_edits WHERE transaksi_id=? ORDER BY created_at ASC`).bind(transaksi_id).all();
  }catch(e){ edits = { results: [] }; }

  return json({
    transaksi_id,
    masuk: masuk.results || [],
    keluar: keluar.results || [],
    audit: audit.results || [],
    servis: servis.results || [],
    edits: edits.results || []
  });
}

/* =========================
   RIWAYAT PER BARANG (JOIN)
   ========================= */
async function riwayatBarang(env, request){
  const id = Number(request.url.split("/").pop());
  const sql = `
    SELECT * FROM (
      SELECT 'masuk' AS jenis,
             sm.transaksi_id,
             sm.barang_id,
             sm.jumlah,
             sm.keterangan,
             sm.dibuat_oleh,
             sm.created_at,
             b.nama AS barang_nama,
             b.foto AS barang_foto
      FROM stok_masuk sm
      LEFT JOIN barang b ON b.id = sm.barang_id
      WHERE sm.barang_id=?

      UNION ALL

      SELECT 'keluar',
             sk.transaksi_id,
             sk.barang_id,
             sk.jumlah,
             sk.keterangan,
             sk.dibuat_oleh,
             sk.created_at,
             b.nama AS barang_nama,
             b.foto AS barang_foto
      FROM stok_keluar sk
      LEFT JOIN barang b ON b.id = sk.barang_id
      WHERE sk.barang_id=?

      UNION ALL

      SELECT 'audit',
             sa.transaksi_id,
             sa.barang_id,
             (sa.stok_baru - sa.stok_lama) AS jumlah,
             sa.keterangan,
             sa.dibuat_oleh,
             sa.created_at,
             b.nama AS barang_nama,
             b.foto AS barang_foto
      FROM stok_audit sa
      LEFT JOIN barang b ON b.id = sa.barang_id
      WHERE sa.barang_id=?
    )
    ORDER BY created_at DESC
  `;
  const rows = await env.BMT_DB.prepare(sql).bind(id,id,id).all();
  return json({ items: rows.results || [] });
}

/* =========================
   MESSAGES
   ========================= */
async function messageGet(env){
  const row = await env.BMT_DB.prepare("SELECT * FROM app_messages WHERE is_sticky=1 ORDER BY created_at DESC LIMIT 1").first();
  return json({ message: row || null });
}
async function messageAdd(env, request){
  const b = await bodyJSON(request);
  if(!b) return json({ error:"Invalid JSON" },400);
  const now = nowISO();
  const sticky = b.is_sticky ? 1 : 0;
  if(sticky) await env.BMT_DB.prepare("UPDATE app_messages SET is_sticky=0 WHERE is_sticky=1").run();
  await env.BMT_DB.prepare("INSERT INTO app_messages (message,is_sticky,created_at) VALUES (?,?,?)").bind(b.message||"", sticky, now).run();
  return json({ ok:true });
}
async function messageDelete(env, request){
  const id = Number(request.url.split("/").pop());
  await env.BMT_DB.prepare("DELETE FROM app_messages WHERE id=?").bind(id).run();
  return json({ ok:true });
}

/* =========================
   SETTINGS
   ========================= */
async function settingsList(env){
  const rows = await env.BMT_DB.prepare("SELECT key,value FROM settings").all();
  const obj = {};
  (rows.results || []).forEach(r=> obj[r.key]=r.value );
  return json({ settings: obj });
}
async function settingsSet(env, request){
  const b = await bodyJSON(request);
  if(!b || !b.key) return json({ error:"key required" },400);
  await env.BMT_DB.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").bind(b.key, String(b.value||"")).run();
  return json({ ok:true });
}
async function settingsDelete(env, request){
  const key = decodeURIComponent(request.url.split("/").pop());
  await env.BMT_DB.prepare("DELETE FROM settings WHERE key=?").bind(key).run();
  return json({ ok:true });
}

/* =========================
   USERS
   ========================= */
async function usersList(env){
  const rows = await env.BMT_DB.prepare("SELECT id,username,nama,role,created_at FROM users ORDER BY id").all();
  return json({ users: rows.results || [] });
}
async function usersAdd(env, request){
  const b = await bodyJSON(request);
  if(!b || !b.username || !b.password) return json({ error:"username & password required" },400);
  const exists = await env.BMT_DB.prepare("SELECT id FROM users WHERE username=?").bind(b.username).first();
  if(exists) return json({ error:"username exists" },400);
  const hash = await sha256(b.password);
  const now = nowISO();
  await env.BMT_DB.prepare("INSERT INTO users (username,nama,password_hash,role,created_at) VALUES (?,?,?,?,?)")
    .bind(b.username, b.nama||"", hash, b.role||"user", now).run();
  return json({ ok:true });
}
async function usersUpdate(env, request){
  const id = Number(request.url.split("/").pop());
  const b = await bodyJSON(request);
  const sets=[]; const vals=[];
  if(b.username !== undefined){ sets.push("username=?"); vals.push(b.username); }
  if(b.nama !== undefined){ sets.push("nama=?"); vals.push(b.nama); }
  if(b.role !== undefined){ sets.push("role=?"); vals.push(b.role); }
  if(b.password){ const hash = await sha256(b.password); sets.push("password_hash=?"); vals.push(hash); }
  if(!sets.length) return json({ error:"Nothing to update" },400);
  vals.push(id);
  await env.BMT_DB.prepare(`UPDATE users SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();
  return json({ ok:true });
}
async function usersDelete(env, request){
  const id = Number(request.url.split("/").pop());
  await env.BMT_DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();
  return json({ ok:true });
}

/* =========================
   Helpers
   ========================= */
async function sha256(str){
  const enc = new TextEncoder().encode(str||"");
  const h = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,"0")).join("");
    }
