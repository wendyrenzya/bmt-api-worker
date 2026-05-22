export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(visualIndexAll(env));
  },

  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method.toUpperCase();

    if (method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders() });

    try {

      // ══════════════════════════════════════════
      // IMG PROXY
      // ══════════════════════════════════════════
      if (url.pathname === "/api/imgproxy") return handleImgProxy(request);

      // ══════════════════════════════════════════
      // ABSENSI (absen.html)
      // ══════════════════════════════════════════
      if (path === "/api/absensi" && method === "POST")  return absensiAdd(env, request);
      if (path === "/api/absensi" && method === "GET")   return absensiList(env);

      // ══════════════════════════════════════════
      // BARANG CRUD (barang.html, barang_detail.html, barang_edit.html, add_item.html)
      // ══════════════════════════════════════════
      if (path === "/api/barang" && method === "GET")    return listBarang(env);
      if (path === "/api/barang" && method === "POST")   return addBarang(env, request);

      if (path.startsWith("/api/barang/") && method === "GET")
        return getBarang(env, request);
      if (path.startsWith("/api/barang/") && (method === "PUT" || method === "PATCH"))
        return updateBarang(env, request);
      if (path.startsWith("/api/barang/") && method === "DELETE")
        return deleteBarang(env, request);

      // ══════════════════════════════════════════
      // STOK (add_item.html, stok pages)
      // ══════════════════════════════════════════
      if (path === "/api/stok_masuk"  && method === "POST") {
        const res = await stokMasuk(env, request);
        if (res.status === 200) ctx.waitUntil(sendBadgeFCM(env));
        return res;
      }
      if (path === "/api/stok_keluar" && method === "POST") {
        const res = await stokKeluar(env, request);
        if (res.status === 200) ctx.waitUntil(sendBadgeFCM(env));
        return res;
      }
      if (path === "/api/stok_keluar" && method === "GET")  return handleGetStokKeluar(request, env);
      if (path === "/api/stok_audit"  && method === "POST") return stokAudit(env, request);
      if (path === "/api/stock_track")                      return stockTrack(env);

      // ══════════════════════════════════════════
      // VARIASI BARANG
      // ══════════════════════════════════════════
      if (path === "/api/variasi"          && method === "GET")    return variasiList(env, url);
      if (path === "/api/variasi"          && method === "POST")   return variasiAdd(env, request);
      if (path.startsWith("/api/variasi/") && method === "PUT")    return variasiUpdate(env, request);
      if (path.startsWith("/api/variasi/") && method === "DELETE") return variasiDelete(env, request);

      // ══════════════════════════════════════════
      // SEARCH / KATEGORI (barang.html, add_item.html)
      // ══════════════════════════════════════════
      if (path === "/api/barang_search" && method === "GET") return searchBarang(env, url);
      if (path === "/api/kategori"      && method === "GET") return listKategori(env);

      // ══════════════════════════════════════════
      // IMAGE SEARCH AI (barang.html)
      // ══════════════════════════════════════════
      if (path === "/api/image-search" && method === "POST") return handleImageSearch(request, env);

      // ══════════════════════════════════════════
      // SERVIS (barang_detail.html, servis pages)
      // Urutan penting: specific dulu, generic terakhir
      // ══════════════════════════════════════════
      if (path.startsWith("/api/servis/alasan/")      && method === "PUT")
        return servisUpdateAlasan(env, request);
      if (path.startsWith("/api/servis/update_cost/") && method === "PUT")
        return servisUpdateBiaya(env, request);
      if (path.startsWith("/api/servis/selesai/")     && method === "PUT") {
        const id_servis = Number(path.split("/").pop());
        const res = await servisSelesai(env, request, { id: id_servis });
        if (res.status === 200) ctx.waitUntil(sendBadgeFCM(env));
        return res;
      }
      if (path.startsWith("/api/servis/batal/")       && method === "PUT") {
        const id_servis = Number(path.split("/").pop());
        return servisBatal(env, request, { id: id_servis });
      }
      if (path.startsWith("/api/servis/charge/batal/") && method === "PUT") {
        const id_servis = Number(path.split("/").pop());
        return servisBatalCharge(env, id_servis);
      }
      if (path.startsWith("/api/servis/update_items/") && method === "PUT")
        return servisUpdateItems(env, request);

      if (path === "/api/servis"       && method === "GET")  return servisList(env);
      if (path === "/api/servis"       && method === "POST") return servisAdd(env, request);
      if (path === "/api/servis/today" && method === "GET")  return servisToday(env);
      if (path.startsWith("/api/servis/") && method === "GET")
        return servisDetail(env, request);

      // ══════════════════════════════════════════
      // RIWAYAT SERVIS
      // ══════════════════════════════════════════
      if (path === "/api/riwayat_servis"          && method === "POST") return riwayatServisAdd(env, request);
      if (path.startsWith("/api/riwayat_servis/") && method === "GET")  return riwayatServisGet(env, request);

      // ══════════════════════════════════════════
      // RIWAYAT TRANSAKSI
      // ══════════════════════════════════════════
      if (path === "/api/riwayat"          && method === "GET") return riwayatAll(env, url);
      if (path.startsWith("/api/riwayat/") && method === "GET") return riwayatDetail(env, request);
      if (path.startsWith("/api/barang_history/") && method === "GET")
        return riwayatBarang(env, request);

      // ══════════════════════════════════════════
      // MESSAGE / SETTINGS (pengaturan.html)
      // ══════════════════════════════════════════
      if (path === "/api/message"          && method === "GET")    return messageGet(env);
      if (path === "/api/message"          && method === "POST")   return messageAdd(env, request);
      if (path.startsWith("/api/message/") && method === "DELETE") return messageDelete(env, request);

      if (path === "/api/settings/custom_message" && method === "GET")  return settingsGetCustomMessage(env);
      if (path === "/api/settings/custom_message" && method === "POST") return settingsSetCustomMessage(env, request);
      if (path === "/api/settings"          && method === "GET")    return settingsList(env);
      if (path === "/api/settings"          && method === "POST")   return settingsSet(env, request);
      if (path.startsWith("/api/settings/") && method === "DELETE") return settingsDelete(env, request);

      // ══════════════════════════════════════════
      // AUTH / LOGIN (login.html)
      // ══════════════════════════════════════════
      if (path === "/api/login" && method === "POST") return loginUser(env, request);

      // ══════════════════════════════════════════
      // BADGES (home.html, pengeluaran.html)
      // ══════════════════════════════════════════
      if (path === "/api/badges"      && method === "GET")  return badgesGet(env, url);
      if (path === "/api/badges/seen" && method === "POST") return badgesSeen(env, request);

      // ══════════════════════════════════════════
      // USERS (pengaturan.html, bonus.html, home.html)
      // ══════════════════════════════════════════
      if (path === "/api/users"                && method === "GET")    return usersList(env);
      if (path === "/api/users"                && method === "POST")   return usersAdd(env, request);
      if (path.startsWith("/api/users/")       && method === "DELETE") return usersDelete(env, request);
      if (path === "/api/user/by_username"     && method === "GET")    return userByUsername(env, url);
      if (path.startsWith("/api/user/name/")     && method === "PUT")  return userUpdateNama(env, request);
      if (path.startsWith("/api/user/password/") && method === "PUT")  return userUpdatePassword(env, request);
      if (path.startsWith("/api/user/foto/")     && method === "PUT")  return userUpdateFoto(env, request);
      if (path.startsWith("/api/user/")          && method === "GET")  return userDetail(env, request);

      // ══════════════════════════════════════════
      // PENGELUARAN (pengeluaran.html)
      // ══════════════════════════════════════════
      if (path === "/api/pengeluaran"          && method === "POST")   return pengeluaranAdd(env, request);
      if (path === "/api/pengeluaran"          && method === "GET")    return pengeluaranList(env);
      if (path.startsWith("/api/pengeluaran/") && method === "DELETE") return pengeluaranDelete(env, request);

      // ══════════════════════════════════════════
      // LAPORAN (laporan pages)
      // ══════════════════════════════════════════
      if (path === "/api/laporan/bulanan"         && method === "GET")  return laporanBulanan(env, url);
      if (path === "/api/laporan/harian/summary"  && method === "GET")  return laporanHarianSummary(env);
      if (path === "/api/laporan/harian/list"     && method === "GET")  return laporanHarianList(env);
      // [REMOVED] POST /api/laporan/harian → duplikat, versi lengkap (keuangan+bonus) ada di MSG_HOST
      if (path === "/api/laporan/harian"          && method === "GET")  return laporanHarianRange(env, url);
      if (path === "/api/laporan/detail"          && method === "GET")  return laporanDetail(env, url);

      // ══════════════════════════════════════════
      // BONUS (bonus.html)
      // ══════════════════════════════════════════
      if (path === "/api/bonus/riwayat"  && method === "GET")  return bonusRiwayat(env, url);
      if (path === "/api/bonus/achieved" && method === "POST") return bonusAchieved(env, request);
      if (path === "/api/bonus/status"   && method === "POST") return bonusUpdateStatus(env, request);
      if (path === "/api/bonus/progress" && method === "GET")  return bonusProgress(env, url);

      // ══════════════════════════════════════════
      // VISUAL SEARCH (barang.html)
      // ══════════════════════════════════════════
      if (path === "/api/visual/status"      && method === "GET")  return visualStatus(env);
      if (path === "/api/visual/index"       && method === "POST") return visualIndexManual(env);
      if (path === "/api/visual/index/one"   && method === "POST") return visualIndexOne(env, request);
      if (path === "/api/visual/search"      && method === "POST") return visualSearch(env, request);
      if (path === "/api/visual/unindexed"   && method === "GET")  return visualUnindexed(env);

      // ══════════════════════════════════════════
      // HEALTH CHECK
      // ══════════════════════════════════════════
      if (path === "/api/health" || path === "/health")
        return json({ ok: true, now: new Date().toISOString() });

      return json({ error: "Endpoint Not Found", path }, 404);

    } catch (err) {
      return json({ error: String(err) || "Server Error" }, 500);
    }
  }
};

// ══════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json;charset=UTF-8"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

// ── FCM Badge (data-only, no popup) ──────────────────────────────
async function getFCMAccessToken(env) {
  const header  = { alg: 'RS256', typ: 'JWT' };
  const now     = Math.floor(Date.now() / 1000);
  const payload = {
    iss:   env.FCM_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now, exp: now + 3600,
  };
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const sigInput = `${b64(header)}.${b64(payload)}`;
  const pemBody  = env.FCM_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/,'').replace(/-----END PRIVATE KEY-----/,'')
    .replace(/\\n/g,'').replace(/\n/g,'').trim();
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pemBody), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
  const jwt = `${sigInput}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('FCM token error');
  return data.access_token;
}

async function sendBadgeFCM(env) {
  try {
    if (!env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY || !env.FCM_PROJECT_ID) return;
    const rows = await env.BMT_DB.prepare(`SELECT token FROM fcm_tokens`).all();
    if (!rows.results.length) return;
    const accessToken = await getFCMAccessToken(env);
    const stale = [];
    for (const { token } of rows.results) {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              data: { type: 'badge_update' },
              webpush: { headers: { TTL: '300', Urgency: 'normal' } },
            },
          }),
        }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        const code = e?.error?.details?.[0]?.errorCode || '';
        if (['INVALID_ARGUMENT','NOT_FOUND'].includes(code) || res.status === 404) stale.push(token);
      }
    }
    for (const token of stale)
      await env.BMT_DB.prepare(`DELETE FROM fcm_tokens WHERE token=?`).bind(token).run();
  } catch(e) {
    console.error('sendBadgeFCM:', e.message);
  }
}

async function bodyJSON(req) {
  try { return await req.json(); } catch { return null; }
}

function nowISO() {
  return new Date().toISOString();
}

function makeTID() {
  const d   = new Date();
  const pad = n => String(n).padStart(2, "0");
  const ts  =
    `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = Math.random().toString(16).slice(2, 7).toUpperCase();
  return `${ts}-${rnd}`;
}

function mergeItems(items) {
  const map = new Map();
  for (const it of items) {
    const id    = Number(it.id || it.barang_id);
    if (!id) continue;
    const qty   = Number(it.jumlah || it.qty || 0);
    const harga = Number(it.harga  || 0);
    const vid   = it.variasi_id ? String(it.variasi_id) : "";
    const key   = `${id}_${harga}_${vid}`;
    if (map.has(key)) {
      map.get(key).jumlah += qty;
      map.get(key).qty     = map.get(key).jumlah;
    } else {
      map.set(key, {
        id,
        qty,
        jumlah:       qty,
        harga,
        komisi:       Number(it.komisi || 0),
        keterangan:   it.keterangan   || "",
        variasi_id:   it.variasi_id   || null,
        variasi_nama: it.variasi_nama || null
      });
    }
  }
  return Array.from(map.values());
}

// ══════════════════════════════════════════════════════════════════
// KV HELPERS
// ══════════════════════════════════════════════════════════════════

async function kvGet(env, key) {
  try { return await env.KV.get(key, "json"); } catch { return null; }
}

async function kvSet(env, key, value, ttlSec) {
  try {
    const opts = ttlSec ? { expirationTtl: ttlSec } : undefined;
    await env.KV.put(key, JSON.stringify(value), opts);
  } catch {}
}

async function kvDel(env, ...keys) {
  try { await Promise.all(keys.map(k => env.KV.delete(k))); } catch {}
}

// ══════════════════════════════════════════════════════════════════
// BADGES
// ══════════════════════════════════════════════════════════════════

// GET /api/badges?user=:username
async function badgesGet(env, url) {
  const user = url.searchParams.get("user");
  if (!user) return json({ error: "user required" }, 400);

  const K = {
    transaksi:   `last_seen:transaksi:${user}`,
    pengeluaran: `last_seen:pengeluaran:${user}`,
    harga:       `last_seen:harga:${user}`,
    riwayat:     `last_seen:riwayat:${user}`,
    servis:      `last_seen:servis:${user}`
  };

  const now = nowISO();

  const [lsT, lsP, lsH, lsR, lsS] = await Promise.all([
    env.KV.get(K.transaksi).catch(() => null),
    env.KV.get(K.pengeluaran).catch(() => null),
    env.KV.get(K.harga).catch(() => null),
    env.KV.get(K.riwayat).catch(() => null),
    env.KV.get(K.servis).catch(() => null)
  ]);

  // Init per-modul — tidak early return semua kalau hanya 1 yang null
  const toInit = [];
  if (!lsT) toInit.push(env.KV.put(K.transaksi,   now));
  if (!lsP) toInit.push(env.KV.put(K.pengeluaran, now));
  if (!lsH) toInit.push(env.KV.put(K.harga,       now));
  if (!lsR) toInit.push(env.KV.put(K.riwayat,     now));
  if (!lsS) toInit.push(env.KV.put(K.servis,      now));
  if (toInit.length) await Promise.all(toInit).catch(() => {});

  // First visit benar-benar baru — semua null
  if (!lsT && !lsP && !lsH && !lsR && !lsS)
    return json({ transaksi: 0, pengeluaran: 0, harga: 0, riwayat: 0, servis_ongoing: 0, servis_selesai: 0 });

  const [cntT, cntP, cntH, cntR, cntOngoing, cntSelesai] = await Promise.all([
    env.BMT_DB.prepare(
      `SELECT COUNT(*) AS cnt FROM stock_track WHERE created_at > ?`
    ).bind(lsT || now).first(),

    env.BMT_DB.prepare(
      `SELECT COUNT(*) AS cnt FROM pengeluaran WHERE created_at > ?`
    ).bind(lsP || now).first(),

    env.BMT_DB.prepare(
      `SELECT COUNT(*) AS cnt FROM messages WHERE created_at > ?`
    ).bind(lsH || now).first(),

    env.BMT_DB.prepare(
      `SELECT COUNT(DISTINCT transaksi_id) AS cnt FROM riwayat WHERE created_at > ?`
    ).bind(lsR || now).first(),

    // Ongoing: real-time, tidak pakai last_seen, exclude charge
    env.BMT_DB.prepare(
      `SELECT COUNT(*) AS cnt FROM servis WHERE status = 'ongoing' AND transaksi_id NOT LIKE 'CHG-%'`
    ).first(),

    // Selesai: baru sejak last_seen, exclude charge
    env.BMT_DB.prepare(
      `SELECT COUNT(*) AS cnt FROM servis WHERE status = 'selesai' AND selesai_at > ? AND transaksi_id NOT LIKE 'CHG-%'`
    ).bind(lsS || now).first()
  ]);

  return json({
    transaksi:      Number(cntT?.cnt       || 0),
    pengeluaran:    Number(cntP?.cnt       || 0),
    harga:          Number(cntH?.cnt       || 0),
    riwayat:        Number(cntR?.cnt       || 0),
    servis_ongoing: Number(cntOngoing?.cnt || 0),  // biru
    servis_selesai: Number(cntSelesai?.cnt || 0)   // merah
  });
}

// POST /api/badges/seen
// Body: { user: "wendy", modul: "transaksi" }
async function badgesSeen(env, req) {
  const b = await bodyJSON(req);
  if (!b?.user || !b?.modul)
    return json({ error: "user & modul required" }, 400);

  const valid = ["transaksi", "pengeluaran", "harga", "riwayat", "servis"];
  if (!valid.includes(b.modul))
    return json({ error: "modul tidak valid" }, 400);

  await env.KV.put(`last_seen:${b.modul}:${b.user}`, nowISO());
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// ABSENSI
// ══════════════════════════════════════════════════════════════════

async function absensiAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.username || !b.lokasi || !b.waktu)
    return json({ error: "username, lokasi, waktu required" }, 400);

  await env.BMT_DB.prepare(`
    INSERT INTO absensi(username, lokasi, waktu, created_at) VALUES(?,?,?,?)
  `).bind(b.username, b.lokasi, b.waktu, nowISO()).run();

  return json({ ok: true });
}

async function absensiList(env) {
  const rows = await env.BMT_DB
    .prepare("SELECT * FROM absensi ORDER BY id DESC")
    .all();
  return json({ items: rows.results || [] });
}

// ══════════════════════════════════════════════════════════════════
// BARANG CRUD
// ══════════════════════════════════════════════════════════════════

async function listBarang(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT * FROM barang ORDER BY nama ASC`)
    .all();
  return json({ items: rows.results || [] });
}

async function getBarang(env, req) {
  const id  = Number(req.url.split("/").pop());
  const row = await env.BMT_DB
    .prepare(`SELECT * FROM barang WHERE id=?`)
    .bind(id).first();
  return json({ item: row || null });
}

async function addBarang(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.nama || !b.harga)
    return json({ error: "nama & harga required" }, 400);

  const now = nowISO();
  const r   = await env.BMT_DB
    .prepare(`
      INSERT INTO barang
        (kode_barang,nama,pnp,spek,kategori,harga,komisi,stock,foto,deskripsi,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `)
    .bind(
      b.kode_barang || "KB" + Date.now().toString().slice(-6),
      b.nama,
      b.pnp      || "",
      b.spek     || "",
      b.kategori || "",
      Number(b.harga  || 0),
      Number(b.komisi || 0),
      Number(b.stock  || 0),
      b.foto      || "",
      b.deskripsi || "",
      now
    ).run();

  // Invalidate KV: produk baru bisa punya kategori baru
  await kvDel(env, "kategori:list");
  return json({ ok: true, id: r.lastRowId || null });
}

async function updateBarang(env, req) {
  const id = Number(req.url.split("/").pop());
  const b  = await bodyJSON(req);
  if (!b) return json({ error: "body required" }, 400);

  const allowed = ["nama","pnp","spek","alias","kategori","harga","komisi",
                   "foto","lokasi","deskripsi","stock","kode_barang"];
  const sets = [], vals = [];
  allowed.forEach(k => {
    if (b[k] !== undefined) { sets.push(`${k}=?`); vals.push(b[k]); }
  });
  if (!sets.length) return json({ error: "no fields to update" }, 400);

  vals.push(id);
  await env.BMT_DB
    .prepare(`UPDATE barang SET ${sets.join(", ")} WHERE id=?`)
    .bind(...vals).run();

  // Invalidate KV jika kategori berubah
  if (b.kategori !== undefined) await kvDel(env, "kategori:list");
  return json({ ok: true });
}

async function deleteBarang(env, req) {
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM barang WHERE id=?`).bind(id).run();
  await kvDel(env, "kategori:list");
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// SEARCH / KATEGORI
// ══════════════════════════════════════════════════════════════════

async function searchBarang(env, url) {
  const q    = url.searchParams.get("q") || "";
  const rows = await env.BMT_DB
    .prepare(`SELECT * FROM barang WHERE nama LIKE ? OR kode_barang LIKE ? LIMIT 200`)
    .bind(`%${q}%`, `%${q}%`).all();
  return json({ items: rows.results || [] });
}

// KV cached — invalidate saat add/update/delete barang
async function listKategori(env) {
  const cached = await kvGet(env, "kategori:list");
  if (cached) return json({ categories: cached });

  const rows = await env.BMT_DB
    .prepare(`SELECT DISTINCT kategori FROM barang ORDER BY kategori`)
    .all();
  const cats = (rows.results || []).map(r => r.kategori).filter(Boolean);

  await kvSet(env, "kategori:list", cats);
  return json({ categories: cats });
}

// ══════════════════════════════════════════════════════════════════
// STOK MASUK
// ══════════════════════════════════════════════════════════════════

async function stokMasuk(env, req) {
  const b = await bodyJSON(req);
  if (!b) return json({ error: "body required" }, 400);

  let items = [];
  if (Array.isArray(b.items) && b.items.length) {
    items = b.items.map(it => ({
      id:         it.id || it.id_barang || it.barang_id,
      jumlah:     Number(it.jumlah || it.qty || 0),
      keterangan: it.keterangan || ""
    }));
  } else if (b.id || b.id_barang) {
    items = [{ id: b.id || b.id_barang, jumlah: Number(b.jumlah || b.qty || 0), keterangan: b.keterangan || "" }];
  } else {
    return json({ error: "items[] or id_barang required" }, 400);
  }

  const operator = b.dibuat_oleh || b.operator || "Admin";
  const now      = nowISO();
  const tid      = "MSK-" + makeTID();

  for (const it of items) {
    if (!it.id) continue;

    const old = await env.BMT_DB
      .prepare(`SELECT stock, nama FROM barang WHERE id=?`)
      .bind(it.id).first();
    if (!old) continue;

    const newStock   = Number(old.stock || 0) + Number(it.jumlah || 0);
    const namaBarang = old.nama || "";

    await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`).bind(newStock, it.id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stock_track(barang_id,transaksi_id,sumber,stock_awal,qty,stock_akhir,dibuat_oleh,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(it.id, tid, "MASUK", Number(old.stock||0), Number(it.jumlah||0), newStock, operator, now).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_masuk(barang_id,jumlah,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?)
    `).bind(it.id, it.jumlah, it.keterangan, operator, now, tid).run();

    await env.BMT_DB.prepare(`
      INSERT INTO riwayat(tipe,barang_id,barang_nama,jumlah,harga,komisi,catatan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).bind("masuk", it.id, namaBarang, it.jumlah, 0, 0, it.keterangan||"", operator, now, tid).run();
  }

  return json({ ok: true, transaksi_id: tid });
}

// ══════════════════════════════════════════════════════════════════
// STOK KELUAR
// ══════════════════════════════════════════════════════════════════


// ── FUNGSI 1: stokKeluar ─────────────────────────────────────────
// Tambahan: cek duplikat transaksi_id sebelum proses apapun
// ─────────────────────────────────────────────────────────────────
async function stokKeluar(env, req) {
  const b = await bodyJSON(req);
  if (!b || !Array.isArray(b.items) || !b.items.length)
    return json({ error: "items[] required" }, 400);

  // ✅ FIX — Idempotency: tolak jika transaksi_id sudah diproses
  if (b.transaksi_id) {
    const dup = await env.BMT_DB
      .prepare(`SELECT COUNT(*) AS cnt FROM stok_keluar WHERE transaksi_id=?`)
      .bind(b.transaksi_id).first();
    if (Number(dup?.cnt || 0) > 0)
      return json({ ok: true, transaksi_id: b.transaksi_id, duplicate: true });
  }

  const items    = mergeItems(b.items);
  const operator = b.dibuat_oleh || b.operator || "Admin";
  const now      = nowISO();
  const tid      = b.transaksi_id || "PJL-" + makeTID();

  for (const it of items) {
    if (!it.id) continue;

    const row = await env.BMT_DB.prepare(`SELECT stock, nama FROM barang WHERE id=?`).bind(it.id).first();
    if (!row) continue;

    const newStock    = Number(row.stock||0) - Number(it.jumlah||it.qty||0);
    const namaBarang  = row.nama || "";
    const displayNama = it.variasi_nama || namaBarang;

    await env.BMT_DB.prepare(`UPDATE barang SET stock=? WHERE id=?`).bind(newStock, it.id).run();

    if (!tid.startsWith("SRV-")) {
      await env.BMT_DB.prepare(`
        INSERT INTO stock_track(barang_id,transaksi_id,sumber,stock_awal,qty,stock_akhir,dibuat_oleh,created_at)
        VALUES (?,?,?,?,?,?,?,?)
      `).bind(it.id, tid, "KELUAR", Number(row.stock||0), Number(it.jumlah||it.qty||0), newStock, operator, now).run();
    }

    await env.BMT_DB.prepare(`
      INSERT INTO stok_keluar(barang_id,jumlah,harga,dibuat_oleh,keterangan,created_at,transaksi_id,variasi_id,variasi_nama)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(it.id, it.jumlah||it.qty||0, it.harga||0, operator, it.keterangan||"", now, tid, it.variasi_id||null, it.variasi_nama||null).run();

    await env.BMT_DB.prepare(`
      INSERT INTO riwayat(tipe,barang_id,barang_nama,jumlah,harga,komisi,catatan,dibuat_oleh,created_at,transaksi_id,variasi_nama)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind("keluar", it.id, displayNama, it.jumlah||it.qty||0, it.harga||0, 0, it.keterangan||"", operator, now, tid, it.variasi_nama||null).run();
  }

  return json({ ok: true, transaksi_id: tid });
}

async function handleGetStokKeluar(request, env) {
  try {
    const url   = new URL(request.url);
    const start = url.searchParams.get("start");
    const end   = url.searchParams.get("end");
    const id    = url.searchParams.get("id");

    if (id) {
      const row = await env.BMT_DB
        .prepare("SELECT * FROM stok_keluar WHERE rowid=?")
        .bind(id).first();
      if (!row) return json({ error: "Not found" }, 404);
      return json(row);
    }

    let sql    = "SELECT * FROM stok_keluar";
    const bind = [];
    if (start && end) {
      sql += " WHERE DATE(created_at,'+7 hours')>=DATE(?) AND DATE(created_at,'+7 hours')<DATE(?)";
      bind.push(start, end);
    } else if (start) {
      sql += " WHERE DATE(created_at,'+7 hours')>=DATE(?)";
      bind.push(start);
    }
    sql += " ORDER BY created_at DESC";

    const result = bind.length
      ? await env.BMT_DB.prepare(sql).bind(...bind).all()
      : await env.BMT_DB.prepare(sql).all();

    return json({ items: result.results || [], total: (result.results||[]).length });
  } catch (err) {
    return json({ error: "Internal server error", detail: err.message }, 500);
  }
}

// ══════════════════════════════════════════════════════════════════
// STOK AUDIT
// ══════════════════════════════════════════════════════════════════

async function stokAudit(env, req) {
  const b = await bodyJSON(req);
  if (!b || !Array.isArray(b.items) || !b.items.length)
    return json({ error: "items[] required" }, 400);

  const operator = b.dibuat_oleh || "Admin";
  const now      = nowISO();
  const tid      = "AUD-" + makeTID();

  for (const it of b.items) {
    const barang_id = Number(it.barang_id);
    const stok_baru = Number(it.stok_baru);
    const ket       = it.keterangan || "";
    if (!barang_id || isNaN(stok_baru)) continue;

    const getOld     = await env.BMT_DB.prepare("SELECT stock,nama FROM barang WHERE id=?").bind(barang_id).first();
    const stok_lama  = Number(getOld?.stock || 0);
    const namaBarang = getOld?.nama || "";

    await env.BMT_DB.prepare("UPDATE barang SET stock=? WHERE id=?").bind(stok_baru, barang_id).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stock_track(barang_id,transaksi_id,sumber,stock_awal,qty,stock_akhir,dibuat_oleh,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(barang_id, tid, "AUDIT", stok_lama, stok_baru - stok_lama, stok_baru, operator, now).run();

    await env.BMT_DB.prepare(`
      INSERT INTO stok_audit(barang_id,stok_lama,stok_baru,keterangan,dibuat_oleh,created_at,transaksi_id)
      VALUES (?,?,?,?,?,?,?)
    `).bind(barang_id, stok_lama, stok_baru, ket, operator, now, tid).run();

    await env.BMT_DB.prepare(`
      INSERT INTO riwayat(transaksi_id,tipe,barang_id,jumlah,harga,dibuat_oleh,catatan,created_at,stok_lama,stok_baru,barang_nama)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(tid, "audit", barang_id, stok_baru-stok_lama, 0, operator, ket, now, stok_lama, stok_baru, namaBarang).run();
  }

  return json({ ok: true, transaksi_id: tid });
}

async function stockTrack(env) {
  try {
    const rows = await env.BMT_DB.prepare(`
      SELECT st.id, st.barang_id, st.transaksi_id, st.sumber,
             st.stock_awal, st.qty, st.stock_akhir, st.dibuat_oleh,
             st.created_at, b.nama AS nama_barang
      FROM stock_track st
      LEFT JOIN barang b ON b.id = st.barang_id
      ORDER BY st.id DESC
      LIMIT 200
    `).all();
    return json(rows.results || []);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}

// ══════════════════════════════════════════════════════════════════
// SERVIS
// ══════════════════════════════════════════════════════════════════

async function servisList(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT * FROM servis ORDER BY created_at DESC`)
    .all();
  return json({ items: rows.results || [] });
}

// BARU: hanya servis selesai hari ini — filter di DB bukan di client
async function servisToday(env) {
  const rows = await env.BMT_DB.prepare(`
    SELECT * FROM servis
    WHERE status = 'selesai'
      AND DATE(created_at, '+7 hours') = DATE('now', '+7 hours')
    ORDER BY created_at DESC
  `).all();
  return json({ items: rows.results || [] });
}

async function servisAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.nama_servis) return json({ error: "nama_servis required" }, 400);

  const transaksi_id = b.transaksi_id || "SRV-" + makeTID();
  const now          = nowISO();
  const itemsJson    = JSON.stringify(b.items || []);
  const dibuatOleh   = b.dibuat_oleh || "Admin";

  const r = await env.BMT_DB.prepare(`
    INSERT INTO servis(nama_servis,teknisi,biaya_servis,catatan,items,status,transaksi_id,created_at,dibuat_oleh)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(b.nama_servis, b.teknisi||"", Number(b.biaya_servis||0), b.catatan||"", itemsJson, "ongoing", transaksi_id, now, dibuatOleh).run();

  return json({ ok: true, id_servis: r.lastInsertRowId });
}

async function servisDetail(env, req) {
  const id_servis = Number(req.url.split("/").pop());
  const row       = await env.BMT_DB
    .prepare(`SELECT * FROM servis WHERE id_servis=?`)
    .bind(id_servis).first();
  if (!row) return json({ item: null });

  try { row.items = row.items ? JSON.parse(row.items) : []; } catch { row.items = []; }
  return json({ item: row });
}

async function servisBatal(env, req, { id }) {
  try {
    const b     = await bodyJSON(req) || {};
    const alasan = b.alasan || "";

    await env.BMT_DB.prepare(`UPDATE servis SET status='batal', alasan_batal=? WHERE id_servis=?`)
      .bind(alasan, id).run();

    const base = await env.BMT_DB.prepare(`SELECT transaksi_id FROM servis WHERE id_servis=?`).bind(id).first();
    if (!base?.transaksi_id) return json({ ok: true });

    const core = base.transaksi_id.startsWith("SRV-") ? base.transaksi_id.substring(4) : null;
    if (!core) return json({ ok: true });

    const charges = await env.BMT_DB.prepare(`
      SELECT id_servis FROM servis
      WHERE transaksi_id LIKE 'CHG-%' AND transaksi_id LIKE ? AND status='ongoing'
    `).bind('%' + core).all();

    for (const ch of (charges?.results || [])) {
      try { await servisBatalCharge(env, ch.id_servis); } catch {}
    }
    return json({ ok: true });
  } catch (err) {
    return json({ debug: "ERROR SERVIS BATAL", message: String(err) }, 500);
  }
}


// ── FUNGSI 2: servisSelesai ───────────────────────────────────────
// Tambahan: cek status sebelum proses — tolak jika bukan "ongoing"
// ─────────────────────────────────────────────────────────────────
async function servisSelesai(env, req, params) {
  const id          = Number(params.id);
  const b           = await bodyJSON(req) || {};
  const now         = nowISO();
  const selesaiOleh = b.diselesaikan_oleh || "Admin";

  const svc = await env.BMT_DB.prepare(`SELECT * FROM servis WHERE id_servis=?`).bind(id).first();
  if (!svc) return json({ error: "servis not found" }, 404);

  // ✅ FIX — Guard: tolak jika sudah selesai/batal (tab lama, webview race condition)
  if (svc.status !== "ongoing")
    return json({ error: `Servis sudah ${svc.status}`, status: svc.status }, 409);

  const core  = svc.transaksi_id.replace("SRV-", "");
  let barang  = [];
  try { barang = JSON.parse(svc.items || "[]"); } catch { barang = []; }
  barang      = mergeItems(barang);

  for (const it of barang) {
    const barang_id = it.id || it.barang_id;
    const qty       = Number(it.jumlah || it.qty || 0);
    if (!barang_id || qty <= 0) continue;

    const row = await env.BMT_DB.prepare(`SELECT stock FROM barang WHERE id=?`).bind(barang_id).first();
    if (!row) continue;

    const stock_akhir = Number(row.stock || 0);
    const stock_awal  = stock_akhir + qty;

    await env.BMT_DB.prepare(`
      INSERT INTO stock_track(barang_id,transaksi_id,sumber,stock_awal,qty,stock_akhir,dibuat_oleh,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(barang_id, svc.transaksi_id, "SERVIS", stock_awal, qty, stock_akhir, selesaiOleh, now).run();
  }

  await env.BMT_DB.prepare(`
    UPDATE servis SET status='selesai', selesai_at=?, diselesaikan_oleh=? WHERE id_servis=?
  `).bind(now, selesaiOleh, id).run();

  await env.BMT_DB.prepare(`
    INSERT INTO riwayat(transaksi_id,tipe,barang_id,barang_nama,jumlah,harga,catatan,dibuat_oleh,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(svc.transaksi_id, "servis", 0, svc.nama_servis||"", 1, Number(svc.biaya_servis||0), svc.catatan||"", svc.dibuat_oleh||"Admin", now).run();

  const charges = await env.BMT_DB.prepare(`
    SELECT * FROM servis WHERE transaksi_id LIKE ? AND transaksi_id LIKE 'CHG-%' AND status!='batal'
  `).bind("%" + core).all();

  for (const ch of charges.results) {
    await env.BMT_DB.prepare(`
      INSERT INTO riwayat(transaksi_id,tipe,barang_id,barang_nama,jumlah,harga,catatan,dibuat_oleh,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(svc.transaksi_id, "charge", 0, ch.nama_servis||"CHARGE", 1, Number(ch.biaya_servis||0), ch.catatan||"", ch.teknisi||"Admin", now).run();
  }

  return json({ ok: true });
}

async function servisBatalCharge(env, id_servis) {
  await env.BMT_DB.prepare(`DELETE FROM servis WHERE id_servis=? AND transaksi_id LIKE 'CHG-%'`)
    .bind(id_servis).run();
  return json({ ok: true });
}

async function servisUpdateItems(env, req) {
  const id_servis = Number(req.url.split("/").pop());
  const b         = await bodyJSON(req);
  if (!Array.isArray(b?.items)) return json({ error: "items[] required" }, 400);

  const row = await env.BMT_DB.prepare(`SELECT * FROM servis WHERE id_servis=?`).bind(id_servis).first();
  if (!row) return json({ error: "servis not found" }, 404);
  if (row.status === "selesai" || row.status === "batal") return json({ error: "servis is locked" }, 400);

  await env.BMT_DB.prepare(`UPDATE servis SET items=? WHERE id_servis=?`)
    .bind(JSON.stringify(b.items||[]), id_servis).run();
  return json({ ok: true });
}

async function servisUpdateAlasan(env, req) {
  const id_servis = Number(req.url.split("/").pop());
  const b         = await bodyJSON(req);
  await env.BMT_DB.prepare(`UPDATE servis SET alasan_batal=? WHERE id_servis=?`)
    .bind(b?.alasan||"", id_servis).run();
  return json({ ok: true });
}

async function servisUpdateBiaya(env, req) {
  const id = Number(req.url.split("/").pop());
  const b  = await bodyJSON(req);
  if (!b || typeof b.biaya_servis === "undefined")
    return json({ error: "biaya_servis required" }, 400);

  await env.BMT_DB.prepare(`UPDATE servis SET biaya_servis=? WHERE id_servis=?`)
    .bind(Number(b.biaya_servis||0), id).run();
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// RIWAYAT SERVIS
// ══════════════════════════════════════════════════════════════════

async function riwayatServisAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.transaksi_id || !b.id_servis)
    return json({ error: "transaksi_id & id_servis required" }, 400);

  await env.BMT_DB.prepare(`
    INSERT OR REPLACE INTO riwayat_servis(transaksi_id,id_servis,nama_servis,teknisi,biaya_servis,keterangan,created_at)
    VALUES (?,?,?,?,?,?,?)
  `).bind(b.transaksi_id, b.id_servis, b.nama_servis||"", b.teknisi||"", Number(b.biaya_servis||0), b.keterangan||"", nowISO()).run();

  return json({ ok: true });
}

async function riwayatServisGet(env, req) {
  const tid = decodeURIComponent(req.url.split("/").pop());
  const row = await env.BMT_DB
    .prepare(`SELECT * FROM riwayat_servis WHERE transaksi_id=? LIMIT 1`)
    .bind(tid).first();
  return json({ item: row || null });
}

// ══════════════════════════════════════════════════════════════════
// RIWAYAT
// ══════════════════════════════════════════════════════════════════

async function riwayatAll(env, url) {
  const limit  = Number(url.searchParams.get("limit")  || 50);
  const offset = Number(url.searchParams.get("offset") || 0);

  const q    = await env.BMT_DB.prepare(`
    SELECT * FROM riwayat ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();
  const rows = q.results || [];

  const map = {};
  for (const r of rows) {
    const tid = r.transaksi_id;
    if (!map[tid]) map[tid] = { transaksi_id: tid, waktu: r.created_at, rows: [] };
    map[tid].rows.push(r);
  }

  const items = Object.values(map).sort((a, b) => new Date(b.waktu) - new Date(a.waktu));
  return json({ items });
}

async function riwayatDetail(env, req) {
  const tid  = decodeURIComponent(req.url.split("/").pop());
  const r    = await env.BMT_DB.prepare(`SELECT * FROM riwayat WHERE transaksi_id=? ORDER BY created_at ASC`).bind(tid).all();
  const rows = r.results || [];

  const chargeItems  = rows.filter(x => x.keterangan && x.keterangan.includes("#CHG_FOR=" + tid));
  const filteredRows = rows.filter(x => !(x.keterangan && x.keterangan.includes("#CHG_FOR=" + tid)));

  return json({
    transaksi_id: tid,
    servis:       null,
    charge:       [],
    masuk:        filteredRows.filter(x => x.tipe === "masuk"),
    keluar:       filteredRows.filter(x => x.tipe === "keluar"),
    audit:        filteredRows.filter(x => x.tipe === "audit").map(x => ({ ...x, stok_lama: x.stok_lama??null, stok_baru: x.stok_baru??null })),
    edits:        []
  });
}

async function riwayatBarang(env, req) {
  const id = Number(req.url.split("/").pop());

  const [masuk, keluar] = await Promise.all([
    env.BMT_DB.prepare(`SELECT * FROM stok_masuk WHERE barang_id=? ORDER BY created_at DESC`).bind(id).all(),
    env.BMT_DB.prepare(`SELECT * FROM stok_keluar WHERE barang_id=? ORDER BY created_at DESC`).bind(id).all()
  ]);

  let audit;
  try {
    const a = await env.BMT_DB.prepare(`SELECT * FROM stok_audit WHERE barang_id=? ORDER BY created_at DESC`).bind(id).all();
    audit   = a.results || [];
  } catch {
    const fb = await env.BMT_DB.prepare(`SELECT * FROM riwayat WHERE barang_id=? ORDER BY created_at DESC`).bind(id).all().catch(()=>({results:[]}));
    audit    = (fb.results||[]).filter(x => x.tipe === "audit");
  }

  return json({ barang_id: id, masuk: masuk.results||[], keluar: keluar.results||[], audit });
}

// ══════════════════════════════════════════════════════════════════
// MESSAGES
// ══════════════════════════════════════════════════════════════════

async function messageGet(env) {
  const rows = await env.BMT_DB.prepare(`SELECT * FROM messages ORDER BY created_at DESC LIMIT 100`).all();
  return json({ items: rows.results || [] });
}

async function messageAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.text) return json({ error: "text required" }, 400);
  await env.BMT_DB.prepare(`INSERT INTO messages(text,created_at) VALUES(?,?)`).bind(b.text, nowISO()).run();
  return json({ ok: true });
}

async function messageDelete(env, req) {
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM messages WHERE id=?`).bind(id).run();
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// SETTINGS  (KV cached — invalidate on write)
// ══════════════════════════════════════════════════════════════════

async function settingsList(env) {
  const cached = await kvGet(env, "settings:all");
  if (cached) return json({ settings: cached });

  const rows = await env.BMT_DB.prepare(`SELECT * FROM settings`).all();
  const map  = {};
  (rows.results || []).forEach(r => map[r.key] = r.value);

  await kvSet(env, "settings:all", map);
  return json({ settings: map });
}

async function settingsSet(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.key) return json({ error: "key required" }, 400);

  await env.BMT_DB.prepare(`INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)`).bind(b.key, b.value||"").run();
  await kvDel(env, "settings:all");
  return json({ ok: true });
}

async function settingsDelete(env, req) {
  const key = req.url.split("/").pop();
  await env.BMT_DB.prepare(`DELETE FROM settings WHERE key=?`).bind(key).run();
  await kvDel(env, "settings:all");
  return json({ ok: true });
}

async function settingsGetCustomMessage(env) {
  const row = await env.BMT_DB
    .prepare(`SELECT value,meta_user,meta_time FROM settings WHERE key='custom_message'`)
    .first();
  return json({ message: row?.value||"", meta_user: row?.meta_user||"", meta_time: row?.meta_time||"" });
}

async function settingsSetCustomMessage(env, req) {
  const b = await bodyJSON(req);
  await env.BMT_DB.prepare(`INSERT OR REPLACE INTO settings(key,value,meta_user,meta_time) VALUES('custom_message',?,?,?)`)
    .bind(b?.message||"", b?.meta_user||"", b?.meta_time||"").run();
  await kvDel(env, "settings:all");
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════

async function loginUser(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.username || !b.password)
    return json({ error: "username & password required" }, 400);

  const row = await env.BMT_DB
    .prepare(`SELECT * FROM users WHERE username=? LIMIT 1`)
    .bind(b.username).first();

  if (!row)                                     return json({ error: "User tidak ditemukan" }, 400);
  if (String(row.password_hash) !== String(b.password)) return json({ error: "Password salah" }, 400);

  return json({ ok: true, token: crypto.randomUUID(), username: row.username, nama: row.nama, role: row.role });
}

// ══════════════════════════════════════════════════════════════════
// USERS  (foto KV cached — invalidate saat foto diupdate)
// ══════════════════════════════════════════════════════════════════

async function usersList(env) {
  const rows = await env.BMT_DB
    .prepare(`SELECT id,username,nama,role,foto FROM users ORDER BY username ASC`)
    .all();
  return json({ users: rows.results || [] });
}

// BARU: ambil 1 user by username, KV cached
// Menggantikan fetch /api/users (semua) hanya untuk cari foto 1 user
async function userByUsername(env, url) {
  const username = url.searchParams.get("u");
  if (!username) return json({ user: null }, 400);

  const cacheKey   = `user_foto:${username}`;
  const cachedFoto = await env.KV.get(cacheKey).catch(() => null);

  if (cachedFoto !== null) {
    return json({ user: { username, foto: cachedFoto } });
  }

  const row = await env.BMT_DB
    .prepare(`SELECT username,nama,role,foto FROM users WHERE username=? LIMIT 1`)
    .bind(username).first();

  if (row) await env.KV.put(cacheKey, row.foto||"").catch(() => {});
  return json({ user: row || null });
}

async function userDetail(env, req) {
  const id  = Number(req.url.split("/").pop());
  const row = await env.BMT_DB
    .prepare(`SELECT id,username,nama,role,foto FROM users WHERE id=?`)
    .bind(id).first();
  return json({ user: row || null });
}

async function userUpdateNama(env, req) {
  const id = Number(req.url.split("/").pop());
  const b  = await bodyJSON(req);
  await env.BMT_DB.prepare(`UPDATE users SET nama=? WHERE id=?`).bind(b?.nama||"", id).run();
  return json({ ok: true });
}

async function userUpdatePassword(env, req) {
  const id = Number(req.url.split("/").pop());
  const b  = await bodyJSON(req);
  await env.BMT_DB.prepare(`UPDATE users SET password_hash=? WHERE id=?`).bind(b?.password||"", id).run();
  return json({ ok: true });
}

async function userUpdateFoto(env, req) {
  const id = Number(req.url.split("/").pop());
  const b  = await bodyJSON(req);

  await env.BMT_DB.prepare(`UPDATE users SET foto=? WHERE id=?`).bind(b?.foto||"", id).run();

  // Invalidate KV foto cache
  const row = await env.BMT_DB.prepare(`SELECT username FROM users WHERE id=? LIMIT 1`).bind(id).first();
  if (row?.username) await kvDel(env, `user_foto:${row.username}`);

  return json({ ok: true });
}

async function usersAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.username) return json({ error: "username required" }, 400);
  await env.BMT_DB.prepare(`INSERT INTO users(username,password_hash,role,created_at) VALUES(?,?,?,?)`)
    .bind(b.username, b.password||"", b.role||"user", nowISO()).run();
  return json({ ok: true });
}

async function usersDelete(env, req) {
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM users WHERE id=?`).bind(id).run();
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// PENGELUARAN
// ══════════════════════════════════════════════════════════════════

async function pengeluaranAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.nama || !b.jumlah) return json({ error: "nama & jumlah required" }, 400);

  await env.BMT_DB.prepare(`
    INSERT INTO pengeluaran(nama,kategori,jumlah,catatan,dibuat_oleh,created_at)
    VALUES (?,?,?,?,?,?)
  `).bind(b.nama, b.kategori||"", Number(b.jumlah||0), b.catatan||"", b.dibuat_oleh||"Admin", nowISO()).run();

  return json({ ok: true });
}

async function pengeluaranList(env) {
  const r = await env.BMT_DB.prepare(`SELECT * FROM pengeluaran ORDER BY created_at DESC`).all();
  return json({ items: r.results || [] });
}

async function pengeluaranDelete(env, req) {
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM pengeluaran WHERE id=?`).bind(id).run();
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// LAPORAN
// ══════════════════════════════════════════════════════════════════

// KV cached — bulan lampau: 24 jam, bulan berjalan: 1 jam
async function laporanBulanan(env, url) {
  const month      = url.searchParams.get("bulan") || new Date().toISOString().slice(0, 7);
  const cacheKey   = `laporan_bulanan:${month}`;
  const currentMon = new Date().toISOString().slice(0, 7);
  const ttl        = month < currentMon ? 86400 : 3600;

  const cached = await kvGet(env, cacheKey);
  if (cached) return json(cached);

  const [y, m]    = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const lastDay   = new Date(y, m, 0).getDate();
  const endDate   = `${month}-${String(lastDay).padStart(2, "0")}`;

  try {
    const [pen, chg, out] = await Promise.all([
      env.BMT_DB.prepare(`SELECT IFNULL(SUM(harga*jumlah),0) AS total FROM stok_keluar WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)`).bind(startDate, endDate).first(),
      env.BMT_DB.prepare(`SELECT IFNULL(SUM(biaya_servis),0) AS total FROM servis WHERE transaksi_id LIKE 'CHG-%' AND status!='batal' AND DATE(created_at) BETWEEN DATE(?) AND DATE(?)`).bind(startDate, endDate).first(),
      env.BMT_DB.prepare(`SELECT IFNULL(SUM(jumlah),0) AS total FROM pengeluaran WHERE DATE(created_at) BETWEEN DATE(?) AND DATE(?)`).bind(startDate, endDate).first()
    ]);

    const result = {
      total_penjualan:   Number(pen.total || 0),
      total_charge:      Number(chg.total || 0),
      total_pengeluaran: Number(out.total || 0)
    };
    await kvSet(env, cacheKey, result, ttl);
    return json(result);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

async function laporanHarianSummary(env) {
  const [penjualan, pengeluaran] = await Promise.all([
    env.BMT_DB.prepare(`SELECT SUM(jumlah*harga) AS total FROM stok_keluar WHERE DATE(created_at,'+8 hours')=DATE('now','+8 hours')`).first(),
    env.BMT_DB.prepare(`SELECT SUM(jumlah) AS total FROM pengeluaran WHERE DATE(created_at,'+8 hours')=DATE('now','+8 hours')`).first()
  ]);

  const totalPenjualan   = Number(penjualan?.total  || 0);
  const totalPengeluaran = Number(pengeluaran?.total || 0);

  return json({
    tanggal:           new Date().toISOString().slice(0, 10),
    total_penjualan:   totalPenjualan,
    total_pengeluaran: totalPengeluaran,
    profit:            totalPenjualan - totalPengeluaran
  });
}

// FIX N+1: ganti loop query per-hari dengan 3 query paralel
async function laporanHarianRange(env, url) {
  const start = url.searchParams.get("start");
  const end   = url.searchParams.get("end");
  if (!start || !end) return json({ error: "start & end required" }, 400);

  // 3 query paralel — tidak ada loop di dalam
  const [rowsPenjualan, rowsPengeluaran, rowsDetail] = await Promise.all([
    env.BMT_DB.prepare(`
      SELECT DATE(created_at,'+8 hours') AS hari, SUM(jumlah*harga) AS total_penjualan
      FROM stok_keluar
      WHERE DATE(created_at,'+8 hours')>=DATE(?) AND DATE(created_at,'+8 hours')<DATE(?)
      GROUP BY DATE(created_at,'+8 hours') ORDER BY hari
    `).bind(start, end).all(),

    env.BMT_DB.prepare(`
      SELECT DATE(created_at) AS hari, SUM(jumlah) AS total_pengeluaran
      FROM pengeluaran
      WHERE DATE(created_at)>=DATE(?) AND DATE(created_at)<DATE(?)
      GROUP BY DATE(created_at) ORDER BY hari
    `).bind(start, end).all(),

    // Detail semua hari sekaligus — mengganti loop N query
    env.BMT_DB.prepare(`
      SELECT DATE(created_at) AS hari, nama, kategori, jumlah, catatan, dibuat_oleh, created_at
      FROM pengeluaran
      WHERE DATE(created_at)>=DATE(?) AND DATE(created_at)<DATE(?)
      ORDER BY created_at ASC
    `).bind(start, end).all()
  ]);

  const map = {};

  (rowsPenjualan.results || []).forEach(r => {
    if (!map[r.hari]) map[r.hari] = _emptyDay(r.hari);
    map[r.hari].penjualan = Number(r.total_penjualan || 0);
  });

  (rowsPengeluaran.results || []).forEach(r => {
    if (!map[r.hari]) map[r.hari] = _emptyDay(r.hari);
    map[r.hari].pengeluaran = Number(r.total_pengeluaran || 0);
  });

  // Distribusi detail ke hari masing-masing — O(n) bukan O(n*m)
  (rowsDetail.results || []).forEach(r => {
    if (!map[r.hari]) map[r.hari] = _emptyDay(r.hari);
    map[r.hari].pengeluaran_list.push(r);
    const k = String(r.kategori || "").toLowerCase();
    if (["operasional", "lain-lain", "komisi"].includes(k)) {
      map[r.hari].pengeluaran_operasional_lain += Number(r.jumlah || 0);
    }
  });

  const hasil = Object.values(map)
    .map(x => ({ ...x, profit: x.penjualan - x.pengeluaran }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  return json({ items: hasil });
}

function _emptyDay(hari) {
  return { tanggal: hari, penjualan: 0, pengeluaran: 0, profit: 0, pengeluaran_list: [], pengeluaran_operasional_lain: 0 };
}

// ══════════════════════════════════════════════════════════════════
// BONUS
// ══════════════════════════════════════════════════════════════════

async function saveBonusStatus(env, data) {
  await env.BMT_DB.prepare(`
    INSERT OR REPLACE INTO bonus_status(username,total,target,percent,periode_mulai,role,updated_at)
    VALUES(?,?,?,?,?,?,?)
  `).bind(data.user, data.total, data.target, data.percent, data.periode_mulai, data.role, nowISO()).run();
}

async function bonusCalculate(env, user, write = true) {
  if (!user) return { error: "user required" };

  const last = await env.BMT_DB.prepare(`SELECT tanggal FROM bonus_riwayat WHERE username=? ORDER BY id DESC LIMIT 1`).bind(user).first();
  let periode_mulai = "2000-01-01";
  if (last?.tanggal) {
    const d = new Date(last.tanggal);
    d.setDate(d.getDate() + 1);
    periode_mulai = d.toISOString().slice(0, 10);
  }

  const roleRow = await env.BMT_DB.prepare(`SELECT role FROM users WHERE username=? LIMIT 1`).bind(user).first();
  const role    = roleRow?.role || "mekanik";
  if (role === "owner") return { user, total: 0, target: 0, percent: 0, periode_mulai: "N/A", role };

  const target = role === "admin" ? 2000000 : 1000000;

  const rows = role === "admin"
    ? await env.BMT_DB.prepare(`SELECT IFNULL(SUM(jumlah*harga),0) AS total FROM stok_keluar WHERE DATE(created_at)>=DATE(?)`).bind(periode_mulai).first()
    : await env.BMT_DB.prepare(`SELECT IFNULL(SUM(jumlah*harga),0) AS total FROM stok_keluar WHERE dibuat_oleh=? AND DATE(created_at)>=DATE(?)`).bind(user, periode_mulai).first();

  const total   = Number(rows?.total || 0);
  const percent = target > 0 ? Math.min(100, Math.floor((total / target) * 100)) : 0;

  if (write && target > 0 && percent >= 100) {
    const today  = new Date().toISOString().slice(0, 10);
    const exists = await env.BMT_DB.prepare(`SELECT id FROM bonus_riwayat WHERE username=? AND tanggal=? LIMIT 1`).bind(user, today).first();
    if (!exists) {
      await env.BMT_DB.prepare(`INSERT INTO bonus_riwayat(username,tanggal,nilai,status,created_at) VALUES(?,?,?,?,?)`)
        .bind(user, today, 50000, "belum", nowISO()).run();
    }
  }

  if (write) await saveBonusStatus(env, { user, total, target, percent, periode_mulai, role });
  return { user, total, target, percent, periode_mulai, role };
}

async function bonusProgress(env, url) {
  const user    = url.searchParams.get("user");
  if (!user) return json({ error: "user required" }, 400);

  const roleRow = await env.BMT_DB.prepare(`SELECT role FROM users WHERE username=? LIMIT 1`).bind(user).first();
  const role    = roleRow?.role || "mekanik";
  if (role === "owner") return json({ user, hidden: true, reason: "owner_no_bonus" });

  return json(await bonusCalculate(env, user, false));
}

async function bonusRiwayat(env, url) {
  const user = url.searchParams.get("user") || "";
  const rows = await env.BMT_DB.prepare(`SELECT * FROM bonus_riwayat WHERE username=? ORDER BY id DESC`).bind(user).all();
  return json({ items: rows.results || [] });
}

async function bonusAchieved(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.username || !b.tanggal || !b.nilai)
    return json({ error: "username, tanggal, nilai required" }, 400);

  await env.BMT_DB.prepare(`INSERT INTO bonus_riwayat(username,tanggal,nilai,status,created_at) VALUES(?,?,?,?,?)`)
    .bind(b.username, b.tanggal, Number(b.nilai||0), b.status||"belum", nowISO()).run();
  return json({ ok: true });
}

async function bonusUpdateStatus(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.id || !b.status) return json({ error: "id & status required" }, 400);
  await env.BMT_DB.prepare(`UPDATE bonus_riwayat SET status=? WHERE id=?`).bind(b.status, b.id).run();
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// IMAGE SEARCH (Workers AI)
// ══════════════════════════════════════════════════════════════════

async function handleImageSearch(request, env) {
  const { image_base64 } = await request.json().catch(() => ({}));

  if (!image_base64 || !image_base64.startsWith("data:image"))
    return json({ error: "image_base64 tidak valid" }, 400);

  const base64Data = image_base64.split(",")[1];
  if (!base64Data || base64Data.length > 5_500_000)
    return json({ error: "Gambar terlalu besar, max 4MB" }, 413);

  const binaryStr = atob(base64Data);
  const bytes     = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const prompt = `Identify this automotive spare part product. Reply ONLY in this JSON format, no markdown:
{"keywords":["word1","word2"],"kategori":"category name","deskripsi":"short description in Indonesian","tags":["tag1","tag2"]}
Possible categories: Oli & Filter, Kampas Rem, Ban, Aki, Lampu, Busi, Bearing, Rantai, Karburator, Gasket, Suku Cadang.`;

  try {
    const response = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", { image: [...bytes], prompt, max_tokens: 300 });
    const rawText  = (response.description || response.response || "").trim();
    const clean    = rawText.replace(/```json|```/g, "").trim();
    const match    = clean.match(/\{[\s\S]*\}/);
    const jsonStr  = match ? match[0] : clean;

    let result;
    try { result = JSON.parse(jsonStr); }
    catch {
      const words = clean.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w.length>2).slice(0,8);
      result      = { keywords: words, kategori: "Suku Cadang", deskripsi: clean.slice(0,80), tags: words.slice(0,5) };
    }
    return json(result);
  } catch (err) {
    return json({ error: "AI gagal memproses gambar" }, 500);
  }
}

// ══════════════════════════════════════════════════════════════════
// VISUAL SEARCH
// ══════════════════════════════════════════════════════════════════

const CLIP_URL = "https://wendyrenzya-bigmotor.hf.space/embed";

async function visualStatus(env) {
  try {
    const stats = await env.VECTORIZE.describe();
    const dummy = new Array(512).fill(0.1);
    const test  = await env.VECTORIZE.query(dummy, { topK: 1 });
    return json({ indexed: stats.vectorsCount??0, query_working: (test.matches?.length??0) > 0 });
  } catch(e) { return json({ error: String(e) }, 500); }
}

async function clipEmbedImage(env, input) {
  let body;
  if (input.startsWith("http")) { body = { image_url: input }; }
  else {
    const base64 = input.includes(",") ? input.split(",")[1] : input;
    body = { image_base64: base64 };
  }
  const resp = await fetch(CLIP_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
  const raw  = await resp.text();
  if (!resp.ok) throw new Error(`CLIP error ${resp.status}: ${raw.slice(0,200)}`);
  const data = JSON.parse(raw);
  if (!data.embedding) throw new Error(`CLIP img no embedding`);
  return data.embedding;
}

async function clipEmbedText(env, text) {
  const resp = await fetch(CLIP_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text }) });
  const raw  = await resp.text();
  if (!resp.ok) throw new Error(`CLIP text error ${resp.status}: ${raw.slice(0,200)}`);
  const data = JSON.parse(raw);
  if (!data.embedding) throw new Error(`CLIP txt no embedding`);
  return data.embedding;
}

async function clipEmbedWithRetry(fn, maxRetry = 3, delayMs = 1000) {
  for (let i = 0; i < maxRetry; i++) {
    try { const result = await fn(); if (result) return result; }
    catch(e) { if (i < maxRetry-1) await new Promise(r => setTimeout(r, delayMs)); }
  }
  return null;
}

function validateEmbedding(emb) {
  if (!Array.isArray(emb) || emb.length === 0) return null;
  if (emb.some(v => v === null || v === undefined)) return null;
  const values = emb.map(v => typeof v === "number" ? v : Number(v));
  if (!values.every(v => Number.isFinite(v))) return null;
  return values;
}

async function visualIndexAll(env) {
  const { results: products } = await env.BMT_DB.prepare(`SELECT id,nama,kategori,pnp,spek,alias,foto FROM barang`).all();
  if (!products?.length) return { ok:0, fail:0, total:0 };

  let ok=0, fail=0, vectors=[];

  for (const p of products) {
    try {
      let values = null;
      const teks   = [p.nama,p.kategori,p.pnp,p.spek,p.alias].filter(Boolean).join(" ");
      const hasFoto = p.foto && p.foto !== "" && p.foto !== "null";

      if (hasFoto) {
        const raw = await clipEmbedWithRetry(() => clipEmbedImage(env, p.foto));
        if (raw) { const flat=Array.isArray(raw?.[0])?raw[0]:raw; const v=validateEmbedding(flat); if(v?.length===512) values=v; }
      }
      if (!values) {
        const raw = await clipEmbedWithRetry(() => clipEmbedText(env, teks));
        if (raw) { const flat=Array.isArray(raw?.[0])?raw[0]:raw; const v=validateEmbedding(flat); if(v?.length===512) values=v; }
      }
      if (!values) { fail++; continue; }

      vectors.push({ id: String(p.id), values, metadata: { nama: String(p.nama??""), foto: String(p.foto??"") } });
      ok++;
    } catch { fail++; }

    if (vectors.length >= 20) {
      try { await env.VECTORIZE.upsert(vectors); } catch { ok -= vectors.length; fail += vectors.length; }
      vectors = [];
    }
  }
  if (vectors.length > 0) {
    try { await env.VECTORIZE.upsert(vectors); } catch { ok -= vectors.length; fail += vectors.length; }
  }
  return { ok, fail, total: products.length };
}

async function visualIndexManual(env) {
  try { return json(await visualIndexAll(env)); }
  catch(e) { return json({ error: String(e) }, 500); }
}

async function visualIndexOne(env, request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Body tidak valid" }, 400); }
  const { id } = body;
  if (!id) return json({ error: "id diperlukan" }, 400);

  const p = await env.BMT_DB.prepare(`SELECT id,nama,kategori,pnp,spek,alias,foto FROM barang WHERE id=?`).bind(id).first();
  if (!p) return json({ error: "Produk tidak ditemukan" }, 404);

  try {
    let values = null;
    const teks    = [p.nama,p.kategori,p.pnp,p.spek,p.alias].filter(Boolean).join(" ");
    const hasFoto = p.foto && p.foto !== "" && p.foto !== "null";

    if (hasFoto) { const raw=await clipEmbedWithRetry(()=>clipEmbedImage(env,p.foto)); if(raw){const flat=Array.isArray(raw?.[0])?raw[0]:raw;const v=validateEmbedding(flat);if(v?.length===512)values=v;} }
    if (!values)  { const raw=await clipEmbedWithRetry(()=>clipEmbedText(env,teks));   if(raw){const flat=Array.isArray(raw?.[0])?raw[0]:raw;const v=validateEmbedding(flat);if(v?.length===512)values=v;} }
    if (!values)  return json({ ok:false, id:p.id, error:"Embedding tidak valid" });

    await env.VECTORIZE.upsert([{ id: String(p.id), values, metadata: { nama: String(p.nama??""), foto: String(p.foto??"") } }]);
    return json({ ok:true, id:p.id, nama:p.nama });
  } catch(e) { return json({ ok:false, id:p.id, error:String(e) }); }
}

async function visualSearch(env, request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Body tidak valid" }, 400); }
  const { image_base64 } = body;
  if (!image_base64) return json({ error: "image_base64 diperlukan" }, 400);

  try {
    const rawVec  = await clipEmbedImage(env, image_base64);
    const queryVec = (Array.isArray(rawVec[0]) ? rawVec[0] : rawVec).map(v => { const n=Number(v); return isFinite(n)?n:0; });
    if (queryVec.length !== 512) return json({ error: `Dimensi embedding salah: ${queryVec.length}` }, 500);

    const matches = await env.VECTORIZE.query(queryVec, { topK:50, returnMetadata:true });
    const results = (matches.matches||[]).filter(m=>m.score>=0.60).map(m=>({ id:m.id, score:parseFloat(m.score.toFixed(4)) }));
    return json({ results });
  } catch(e) { return json({ error: String(e) }, 500); }
}

async function visualUnindexed(env) {
  try {
    const { results: products } = await env.BMT_DB.prepare(`SELECT id,nama,kategori,pnp,spek,foto FROM barang ORDER BY nama ASC`).all();
    if (!products?.length) return json({ total_products:0, total_indexed:0, total_unindexed:0, unindexed:[] });

    const allIds     = products.map(p => String(p.id));
    const indexedIds = new Set();
    const BATCH      = 100;

    for (let i=0; i<allIds.length; i+=BATCH) {
      const chunk = allIds.slice(i, i+BATCH);
      try {
        const found = await env.VECTORIZE.getByIds(chunk);
        for (const v of (found||[])) { if (v?.id) indexedIds.add(String(v.id)); }
      } catch {}
    }

    const unindexed = products.filter(p => !indexedIds.has(String(p.id)));
    return json({ total_products: products.length, total_indexed: indexedIds.size, total_unindexed: unindexed.length, unindexed });
  } catch(e) { return json({ error: String(e) }, 500); }
}

// ══════════════════════════════════════════════════════════════════
// VARIASI BARANG
// ══════════════════════════════════════════════════════════════════

// GET /api/variasi?barang_id=X
async function variasiList(env, url) {
  const barang_id = url.searchParams.get("barang_id");
  if (!barang_id) return json({ error: "barang_id required" }, 400);
  const rows = await env.BMT_DB
    .prepare(`SELECT * FROM variasi WHERE barang_id=? ORDER BY id ASC`)
    .bind(Number(barang_id)).all();
  return json({ items: rows.results || [] });
}

// POST /api/variasi
// Body: { barang_id, nama, harga }
async function variasiAdd(env, req) {
  const b = await bodyJSON(req);
  if (!b || !b.barang_id || !b.nama || b.harga === undefined)
    return json({ error: "barang_id, nama & harga required" }, 400);
  const r = await env.BMT_DB
    .prepare(`INSERT INTO variasi(barang_id,nama,harga,created_at) VALUES(?,?,?,?)`)
    .bind(Number(b.barang_id), b.nama, Number(b.harga || 0), nowISO()).run();
  return json({ ok: true, id: r.lastInsertRowId });
}

// PUT /api/variasi/:id
// Body: { nama?, harga? }
async function variasiUpdate(env, req) {
  const id   = Number(req.url.split("/").pop());
  const b    = await bodyJSON(req);
  if (!b) return json({ error: "body required" }, 400);
  const sets = [], vals = [];
  if (b.nama  !== undefined) { sets.push("nama=?");  vals.push(b.nama); }
  if (b.harga !== undefined) { sets.push("harga=?"); vals.push(Number(b.harga)); }
  if (!sets.length) return json({ error: "no fields to update" }, 400);
  vals.push(id);
  await env.BMT_DB
    .prepare(`UPDATE variasi SET ${sets.join(",")} WHERE id=?`)
    .bind(...vals).run();
  return json({ ok: true });
}

// DELETE /api/variasi/:id
async function variasiDelete(env, req) {
  const id = Number(req.url.split("/").pop());
  await env.BMT_DB.prepare(`DELETE FROM variasi WHERE id=?`).bind(id).run();
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════
// IMG PROXY
// ══════════════════════════════════════════════════════════════════

async function handleImgProxy(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  if (!target) return new Response("Missing url param", { status:400 });
  if (!/^https?:\/\//i.test(target)) return new Response("Invalid url", { status:400 });

  try {
    const upstream    = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!upstream.ok) return new Response("Upstream error: " + upstream.status, { status:502 });

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const body        = await upstream.arrayBuffer();
    return new Response(body, {
      status:  200,
      headers: { "Content-Type": contentType, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET", "Cache-Control": "public, max-age=86400" }
    });
  } catch(err) { return new Response("Proxy fetch failed: " + err.message, { status:502 }); }
}

//////////////////////////////
// END OF FILE
//////////////////////////////
