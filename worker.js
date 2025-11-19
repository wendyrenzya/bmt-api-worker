// worker.js — Big Motor API (FINAL with ImgBB profile upload)
// Bindings required (in Cloudflare Worker settings / wrangler.toml):
// - D1 binding named "DB" (env.DB)
// - Environment variable: IMGBB_KEY (ImgBB API key string)
//
// Important: For profile upload, Worker will POST base64 to ImgBB.
// If ImgBB rejects due to size, Worker returns clear error asking client-side resize.
// Server-side resize requires extra WASM lib or R2/Images service and is not included here.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const method = request.method.toUpperCase();

    // --- small helpers
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    const text = (t, status = 200) =>
      new Response(String(t), { status, headers: { 'Content-Type': 'text/plain' } });
    const safeJson = async (req) => { try { return await req.json(); } catch { return null; } };
    const getHeaderUser = (req) => req.headers.get('X-User') || req.headers.get('x-user') || null;

    // --- D1 helpers
    const dbAll = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).all());
    const dbFirst = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first());
    const dbRun = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).run());

    // --- user helpers
    const getUserRecord = async (username) => {
      if (!username) return null;
      return await dbFirst('SELECT username,name,role,photo_url,created_at FROM users WHERE username = ?', username);
    };
    const checkRole = async (username, allowed = []) => {
      const user = await getUserRecord(username);
      if (!user) return { ok: false, code: 401, msg: 'User not found or X-User missing' };
      if (allowed.length === 0) return { ok: true, user };
      if (!allowed.includes(user.role)) return { ok: false, code: 403, msg: 'Anda tidak memiliki akses, silahkan contact owner', user };
      return { ok: true, user };
    };

    // --- DuckDuckGo image fetch (i.js)
    async function fetchDuckImages(query, limit = 8) {
      try {
        if (!query) return [];
        const endpoint = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}`;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(endpoint, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; BMTBot/1.0)',
                'Referer': 'https://duckduckgo.com/'
              },
              cf: { cacheTtl: 60, cacheEverything: true }
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (!data || !Array.isArray(data.results)) continue;
            const imgs = data.results.map(r => r.image).filter(Boolean);
            const out = []; const seen = new Set();
            for (const u of imgs) {
              if (!u) continue;
              if (seen.has(u)) continue;
              seen.add(u);
              out.push(u);
              if (out.length >= limit) break;
            }
            return out;
          } catch (err) {
            await new Promise(r => setTimeout(r, 250));
            continue;
          }
        }
        return [];
      } catch (err) {
        return [];
      }
    }

    // --- ImgBB upload helper
    // Accepts raw base64 string (no data: prefix) or data URI; returns { ok, url, rawResponse }
    async function uploadToImgBB(apiKey, base64OrDataURI, name = 'profile') {
      if (!apiKey) return { ok: false, error: 'IMGBB_KEY not configured' };
      try {
        // normalize: if starts with data:, strip prefix
        let raw = base64OrDataURI;
        if (raw.startsWith('data:')) {
          const idx = raw.indexOf(',');
          if (idx !== -1) raw = raw.slice(idx + 1);
        }
        // safety: limit size server-side (reject > 6MB to avoid huge payload)
        const approxBytes = Math.round((raw.length * 3) / 4);
        if (approxBytes > 6 * 1024 * 1024) {
          return { ok: false, error: 'image_too_large_server' };
        }

        const form = new URLSearchParams();
        form.append('key', apiKey);
        form.append('image', raw);
        form.append('name', name);

        const res = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });

        const data = await res.json();
        if (!res.ok || !data || !data.success) {
          // pass back ImgBB message if available
          return { ok: false, error: 'imgbb_error', detail: data };
        }
        return { ok: true, url: data.data.url, raw: data };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }

    const parts = path.split('/').filter(Boolean);

    try {
      // --- Health
      if ((path === '' || path === '/') && method === 'GET') {
        return json({ status: 'ok', message: 'BMT API Worker running' });
      }

      // --- AUTH
      if (path === '/auth/login' && method === 'POST') {
        const body = await safeJson(request);
        if (!body?.username || !body?.password) return json({ ok: false, error: 'username & password required' }, 400);
        const row = await dbFirst('SELECT username,name,role,photo_url,password FROM users WHERE username = ?', body.username);
        if (!row || row.password !== body.password) return json({ ok: false, error: 'invalid credentials' }, 401);
        const { password: _, ...user } = row;
        return json({ ok: true, ...user });
      }
      if (path === '/auth/me' && method === 'GET') {
        const u = getHeaderUser(request); if (!u) return json({ ok: false, error: 'X-User header required' }, 401);
        const rec = await getUserRecord(u); if (!rec) return json({ ok: false, error: 'user not found' }, 404);
        return json({ ok: true, user: rec });
      }

      // --- USERS (list/create/edit/delete)
      if (path === '/users' && method === 'GET') {
        const perm = await checkRole(getHeaderUser(request), ['owner','admin']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const r = await dbAll('SELECT username,name,role,photo_url,created_at FROM users ORDER BY created_at DESC');
        return json({ ok: true, results: r.results || [] });
      }

      if (path === '/users' && method === 'POST') {
        const body = await safeJson(request);
        if (!body?.username || !body?.password || !body?.name) return json({ ok: false, error: 'username,password,name required' }, 400);
        const cnt = await dbFirst('SELECT COUNT(*) AS c FROM users'); const c = (cnt?.c||0);
        if (c === 0) {
          await dbRun('INSERT INTO users (username,password,name,role,photo_url) VALUES (?,?,?,?,?)',
            body.username, body.password, body.name, 'owner', body.photo_url || '');
          return json({ ok: true, message: 'owner created (bootstrap)' }, 201);
        }
        const perm = await checkRole(getHeaderUser(request), ['owner']); if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        await dbRun('INSERT INTO users (username,password,name,role,photo_url) VALUES (?,?,?,?,?)',
          body.username, body.password, body.name, body.role || 'mekanik', body.photo_url || '');
        return json({ ok: true, message: 'user created' }, 201);
      }

      if (parts[0] === 'users' && parts[1] && ['PUT','PATCH'].includes(method)) {
        const target = decodeURIComponent(parts[1]); const caller = getHeaderUser(request); if (!caller) return json({ ok: false, error: 'X-User required' }, 401);
        const callerRec = await getUserRecord(caller); if (!callerRec) return json({ ok: false, error: 'caller not found' }, 401);
        if (callerRec.role !== 'owner' && caller !== target) return json({ ok: false, error: 'forbidden' }, 403);
        const body = await safeJson(request); if (!body) return json({ ok: false, error: 'body required' }, 400);
        const fields = []; const bind = [];
        if (body.password) { fields.push('password=?'); bind.push(body.password); }
        if (body.name) { fields.push('name=?'); bind.push(body.name); }
        if (body.photo_url) { fields.push('photo_url=?'); bind.push(body.photo_url); }
        if (body.role && callerRec.role === 'owner') { fields.push('role=?'); bind.push(body.role); }
        if (!fields.length) return json({ ok: false, error: 'nothing to update' }, 400);
        bind.push(target);
        await dbRun(`UPDATE users SET ${fields.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE username = ?`, ...bind);
        return json({ ok: true, message: 'updated' });
      }

      if (parts[0] === 'users' && parts[1] && method === 'DELETE') {
        const perm = await checkRole(getHeaderUser(request), ['owner']); if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        await dbRun('DELETE FROM users WHERE username = ?', parts[1]);
        return json({ ok: true, message: 'deleted' });
      }

      // --- PROFILE PHOTO UPLOAD (ImgBB) ---
      // POST /users/upload_photo
      if (path === '/users/upload_photo' && method === 'POST') {
        const caller = getHeaderUser(request);
        if (!caller) return json({ ok: false, error: 'X-User header required' }, 401);
        const body = await safeJson(request);
        if (!body || !body.image) return json({ ok: false, error: 'image (base64 or dataURI) required' }, 400);

        // Ensure user exists
        const userRec = await dbFirst('SELECT username FROM users WHERE username = ?', caller);
        if (!userRec) return json({ ok: false, error: 'user not found' }, 404);

        // Normalize base64 and approximate size
        let raw = body.image;
        if (raw.startsWith('data:')) {
          const idx = raw.indexOf(','); if (idx !== -1) raw = raw.slice(idx + 1);
        }
        // compute approx bytes
        const approxBytes = Math.round((raw.length * 3) / 4);
        // limit hard cap 6MB
        if (approxBytes > 6 * 1024 * 1024) return json({ ok: false, error: 'Image too large (limit 6MB)' }, 413);

        // If >100KB, we will still attempt to upload to ImgBB; if ImgBB fail due to size, client must resize
        const maxClientBytes = 100 * 1024;
        const attemptResizeOnServer = false; // we cannot reliably resize server-side without WASM or R2 Images

        // Upload to ImgBB
        const imgbbKey = env.IMGBB_KEY || null;
        const name = `${caller}_${Date.now()}`;
        const up = await uploadToImgBB(imgbbKey, raw, name);

        if (!up.ok) {
          // If imgbb_error and approxBytes > 100KB, tell client to resize. Otherwise return error detail.
          if (up.error === 'imgbb_error' && approxBytes > maxClientBytes) {
            return json({ ok: false, error: 'image_too_large', message: 'Upload failed — image likely too large. Please resize client-side to <=100KB and retry.' }, 413);
          }
          return json({ ok: false, error: up.error || 'upload_failed', detail: up.detail || up.raw || null }, 500);
        }

        // Save URL to DB
        try {
          await dbRun('UPDATE users SET photo_url = ?, updated_at=CURRENT_TIMESTAMP WHERE username = ?', up.url, caller);
        } catch (err) {
          // even if DB update fails, return URL so client can still use it
          return json({ ok: true, url: up.url, warning: 'img_uploaded_but_db_update_failed', db_error: String(err) });
        }

        return json({ ok: true, url: up.url });
      }

      // --- BARANG (list, single, fetch_image, create, edit, delete) ---
      if (path === '/barang' && method === 'GET') {
        const params = Object.fromEntries(url.searchParams.entries());
        const limit = Number(params.limit || 100); const offset = Number(params.offset || 0); const q = params.q || null;
        let sql = 'SELECT id,kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi,created_at,updated_at FROM barang';
        const binds = [];
        if (q) { sql += ' WHERE nama LIKE ? OR kode_barang LIKE ?'; const like = `%${q}%`; binds.push(like, like); }
        sql += ' ORDER BY id DESC LIMIT ? OFFSET ?'; binds.push(limit, offset);
        const r = await dbAll(sql, ...binds);
        return json({ ok: true, results: r.results || [] });
      }

      if (parts[0] === 'barang' && parts[1] && method === 'GET') {
        const id = Number(parts[1]); const r = await dbFirst('SELECT * FROM barang WHERE id = ?', id);
        if (!r) return json({ ok: false, error: 'not found' }, 404);
        return json({ ok: true, result: r });
      }

      if (path === '/barang/fetch_image' && method === 'GET') {
        const params = Object.fromEntries(url.searchParams.entries());
        const q = params.query || params.q || null;
        if (!q) return json({ ok: false, images: [], error: 'query required' }, 400);
        const imgs = await fetchDuckImages(q, 8);
        return json({ ok: true, images: imgs });
      }

      if (path === '/barang' && method === 'POST') {
        const perm = await checkRole(getHeaderUser(request), ['owner','admin']); if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request); if (!body || !body.nama) return json({ ok: false, error: 'nama required' }, 400);

        // auto-fetch first image if foto empty
        let fotoUrl = body.foto && String(body.foto).trim();
        if (!fotoUrl) {
          const imgs = await fetchDuckImages(body.nama, 1);
          if (imgs.length > 0) fotoUrl = imgs[0];
        }

        const res = await dbRun(
          `INSERT INTO barang (kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi) VALUES (?,?,?,?,?,?,?,?)`,
          body.kode_barang || '', body.nama, Number(body.harga || 0), Number(body.harga_modal || 0), Number(body.stock || 0),
          body.kategori || '', fotoUrl || '', body.deskripsi || ''
        );
        const newId = res && res.lastInsertRowid ? res.lastInsertRowid : null;
        await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
          'tambah_barang', newId, body.nama, Number(body.stock || 0), body.catatan || '', perm.user.username);
        return json({ ok: true, id: newId, foto_used: fotoUrl || null });
      }

      if (parts[0] === 'barang' && parts[1] && ['PUT','PATCH'].includes(method)) {
        const perm = await checkRole(getHeaderUser(request), ['owner','admin']); if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const id = Number(parts[1]); const body = await safeJson(request); if (!body) return json({ ok: false, error: 'body required' }, 400);
        const cur = await dbFirst('SELECT nama,stock FROM barang WHERE id = ?', id); if (!cur) return json({ ok: false, error: 'not found' }, 404);

        if (body.fetch_image && body.nama) {
          const imgs = await fetchDuckImages(body.nama, 1); if (imgs.length > 0) body.foto = imgs[0];
        }

        const fields = []; const bind = [];
        const addIf = (k, col) => { if (body[k] !== undefined) { fields.push(`${col}=?`); bind.push(body[k]); } };
        addIf('kode_barang','kode_barang'); addIf('nama','nama'); addIf('harga','harga'); addIf('harga_modal','harga_modal');
        addIf('stock','stock'); addIf('kategori','kategori'); addIf('foto','foto'); addIf('deskripsi','deskripsi');

        if (!fields.length) return json({ ok: false, error: 'nothing to update' }, 400);
        bind.push(id);
        await dbRun(`UPDATE barang SET ${fields.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...bind);

        if (body.stock !== undefined && Number(body.stock) !== Number(cur.stock)) {
          const diff = Number(body.stock) - Number(cur.stock);
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'edit_barang', id, body.nama || cur.nama, diff, body.catatan || 'adjust stock', perm.user.username);
        } else {
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'edit_barang', id, body.nama || cur.nama, 0, body.catatan || 'edit', perm.user.username);
        }
        return json({ ok: true, message: 'updated' });
      }

      if (parts[0] === 'barang' && parts[1] && method === 'DELETE') {
        const perm = await checkRole(getHeaderUser(request), ['owner','admin']); if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const id = Number(parts[1]); const cur = await dbFirst('SELECT nama FROM barang WHERE id = ?', id); if (!cur) return json({ ok: false, error: 'not found' }, 404);
        await dbRun('DELETE FROM barang WHERE id = ?', id);
        await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
          'hapus_barang', id, cur.nama || '', 0, '', perm.user.username);
        return json({ ok: true, message: 'deleted' });
      }

      // --- STOK MASUK
      if (path === '/stok_masuk' && method === 'POST') {
        const perm = await checkRole(getHeaderUser(request), ['owner','admin','mekanik']); if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request); if (!body) return json({ ok: false, error: 'body required' }, 400);
        const qty = Number(body.jumlah || body.qty || 0); if (!qty || qty <= 0) return json({ ok: false, error: 'jumlah must be > 0' }, 400);
        let bid = body.barang_id || null;
        if (!bid && body.kode_barang) { const r = await dbFirst('SELECT id FROM barang WHERE kode_barang = ? LIMIT 1', body.kode_barang); bid = r ? r.id : null; }
        if (!bid && body.nama) { const r = await dbFirst('SELECT id FROM barang WHERE nama = ? LIMIT 1', body.nama); bid = r ? r.id : null; }
        let barangRow = null;
        if (!bid && body.nama) {
          const res = await dbRun('INSERT INTO barang (kode_barang,nama,harga,harga_modal,stock) VALUES (?,?,?,?,?)', body.kode_barang||'', body.nama, Number(body.harga||0), Number(body.harga_modal||0), 0);
          bid = res && res.lastInsertRowid ? res.lastInsertRowid : null; barangRow = { id: bid, nama: body.nama, stock: 0 };
        } else if (bid) {
          const r = await dbFirst('SELECT id,nama,stock FROM barang WHERE id = ?', bid); barangRow = r || null;
        } else return json({ ok: false, error: 'barang_id or kode_barang or nama required' }, 400);
        if (!barangRow) return json({ ok: false, error: 'barang not found' }, 404);
        const newStock = Number(barangRow.stock || 0) + qty;
        await dbRun('UPDATE barang SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, bid);
        await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
          'stok_masuk', bid, barangRow.nama, qty, body.catatan || '', perm.user.username);
        return json({ ok: true, message: 'stok updated', barang_id: bid, newStock });
      }

      // --- STOK KELUAR
      if (path === '/stok_keluar' && method === 'POST') {
        const perm = await checkRole(getHeaderUser(request), ['owner','admin','mekanik']); if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request); if (!body) return json({ ok: false, error: 'body required' }, 400);
        const qty = Number(body.jumlah || body.qty || 0); if (!qty || qty <= 0) return json({ ok: false, error: 'jumlah must be > 0' }, 400);
        let bid = body.barang_id || null;
        if (!bid && body.kode_barang) { const r = await dbFirst('SELECT id FROM barang WHERE kode_barang = ? LIMIT 1', body.kode_barang); bid = r ? r.id : null; }
        if (!bid && body.nama) { const r = await dbFirst('SELECT id FROM barang WHERE nama = ? LIMIT 1', body.nama); bid = r ? r.id : null; }
        if (!bid) return json({ ok: false, error: 'barang_id or kode_barang or nama required' }, 400);
        const barangRow = await dbFirst('SELECT id,nama,stock FROM barang WHERE id = ?', bid); if (!barangRow) return json({ ok: false, error: 'barang not found' }, 404);
        if (Number(barangRow.stock || 0) < qty) return json({ ok: false, error: 'stock tidak mencukupi' }, 400);
        const newStock = Number(barangRow.stock || 0) - qty;
        await dbRun('UPDATE barang SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, bid);
        await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
          'stok_keluar', bid, barangRow.nama, -qty, body.catatan || '', perm.user.username);
        return json({ ok: true, message: 'stok updated', barang_id: bid, newStock });
      }

      // --- RIWAYAT
      if (path === '/riwayat' && method === 'GET') {
        const params = Object.fromEntries(url.searchParams.entries()); const limit = Number(params.limit || 100); const offset = Number(params.offset || 0);
        const tipe = params.tipe || null; const barang_id = params.barang_id || null; const dibuat_oleh = params.user || params.dibuat_oleh || null;
        const from = params.from || null; const to = params.to || null;
        const binds = []; let where = [];
        if (tipe) { where.push('tipe = ?'); binds.push(tipe); }
        if (barang_id) { where.push('barang_id = ?'); binds.push(Number(barang_id)); }
        if (dibuat_oleh) { where.push('dibuat_oleh = ?'); binds.push(dibuat_oleh); }
        if (from) { where.push('created_at >= ?'); binds.push(from); }
        if (to) { where.push('created_at <= ?'); binds.push(to); }
        let sql = 'SELECT id,tipe,barang_id,barang_nama,jumlah,catatan,dibuat_oleh,created_at FROM riwayat';
        if (where.length) sql += ' WHERE ' + where.join(' AND ');
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'; binds.push(limit, offset);
        const res = await dbAll(sql, ...binds);
        return json({ ok: true, results: res.results || [] });
      }

      // --- MORE
      if (path === '/more' && method === 'GET') {
        const r = await dbFirst('SELECT custom_message,sticky_message,welcome_image_url,updated_by,updated_at FROM more WHERE id = 1');
        return json({ ok: true, result: r || {} });
      }
      if (path === '/more' && ['PUT','POST'].includes(method)) {
        const perm = await checkRole(getHeaderUser(request), ['owner']); if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        await dbRun('UPDATE more SET custom_message=?,sticky_message=?,welcome_image_url=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=1',
          body.custom_message || '', body.sticky_message || '', body.welcome_image_url || '', perm.user.username);
        return json({ ok: true, message: 'updated' });
      }

      // fallback
      return json({ ok: false, error: 'not found', path }, 404);
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  }
};
