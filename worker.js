// File: worker.js
// Final patched Worker compatible with Cloudflare D1 & Workers runtime.
// Requirements:
// - Binding: D1 named "DB" (env.DB)
// - Secret: IMG_BB_KEY in Worker env (env.IMG_BB_KEY)
// - Do NOT use Node Buffer: use ArrayBuffer -> base64 via btoa + chunking

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const rawPath = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method.toUpperCase();

    // ---------- Helpers ----------
    const jsonResponse = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: baseHeaders(),
      });

    const textResponse = (t = 'ok', status = 200) =>
      new Response(String(t), {
        status,
        headers: baseHeaders(),
      });

    function baseHeaders() {
      return {
        'Content-Type': 'application/json;charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User',
      };
    }

    const safeJson = async (req) => {
      try {
        return await req.json();
      } catch (e) {
        return null;
      }
    };

    const getHeaderUser = (req) => {
      const h = req.headers.get('X-User') || req.headers.get('x-user') || '';
      return h ? String(h) : null;
    };

    // D1 helpers
    const dbAll = async (sql, ...binds) => {
      const r = await env.DB.prepare(sql).bind(...binds).all();
      return r.results || [];
    };
    const dbFirst = async (sql, ...binds) => {
      const r = await env.DB.prepare(sql).bind(...binds).first();
      return r || null;
    };
    const dbRun = async (sql, ...binds) => {
      const r = await env.DB.prepare(sql).bind(...binds).run();
      return r || null;
    };

    // role helper
    const getUserRecord = async (username) => {
      if (!username) return null;
      const res = await dbFirst('SELECT username,name,role,photo_url,created_at FROM users WHERE username = ?', username);
      return res || null;
    };
    const checkRole = async (username, allowed = []) => {
      const user = await getUserRecord(username);
      if (!user) return { ok: false, code: 401, msg: 'User not found or X-User missing' };
      if (allowed.length === 0) return { ok: true, user };
      if (!allowed.includes(user.role)) return { ok: false, code: 403, msg: 'Anda tidak memiliki akses, silahkan contact owner', user };
      return { ok: true, user };
    };

    // base64 conversion safe for large files
    function arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000; // 32KB
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary);
    }

    // parse path parts
    const path = rawPath; // leading slash kept
    const parts = path.split('/').filter(Boolean); // e.g. ['barang','12']

    // CORS preflight
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders() });

    try {
      // Health
      if ((path === '/' || path === '') && method === 'GET') {
        return textResponse('BMT API OK');
      }

      // ---------- AUTH ----------
      if (path === '/auth/login' && method === 'POST') {
        const body = await safeJson(request);
        const username = body && body.username;
        const password = body && body.password;
        if (!username || !password) return jsonResponse({ ok: false, error: 'username & password required' }, 400);
        const row = await dbFirst('SELECT username,name,role,photo_url,password FROM users WHERE username = ?', username);
        if (!row) return jsonResponse({ ok: false, error: 'invalid credentials' }, 401);
        if (row.password !== password) return jsonResponse({ ok: false, error: 'invalid credentials' }, 401);
        const { password: _p, ...user } = row;
        console.log('[auth] login success', username);
        return jsonResponse({ ok: true, user });
      }

      if (path === '/auth/me' && method === 'GET') {
        const u = getHeaderUser(request);
        if (!u) return jsonResponse({ ok: false, error: 'X-User header required' }, 401);
        const rec = await getUserRecord(u);
        if (!rec) return jsonResponse({ ok: false, error: 'user not found' }, 404);
        return jsonResponse({ ok: true, user: rec });
      }

      // ---------- USERS ----------
      if (path === '/users' && method === 'GET') {
        const perm = await checkRole(getHeaderUser(request), ['owner', 'admin']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);
        const res = await dbAll('SELECT username,name,role,photo_url,created_at FROM users ORDER BY created_at DESC');
        return jsonResponse({ ok: true, results: res });
      }

      if (path === '/users' && method === 'POST') {
        const body = await safeJson(request);
        if (!body || !body.username || !body.password || !body.name) return jsonResponse({ ok: false, error: 'username,password,name required' }, 400);

        // allow bootstrap owner if no users
        const cntRes = await dbFirst("SELECT COUNT(*) AS c FROM users");
        const c = (cntRes && cntRes.c) ? cntRes.c : 0;
        if (c === 0) {
          await dbRun('INSERT INTO users (username,password,name,role,photo_url) VALUES (?,?,?,?,?)',
            body.username, body.password, body.name, 'owner', body.photo_url || '');
          return jsonResponse({ ok: true, message: 'owner created (bootstrap)' }, 201);
        }

        const caller = getHeaderUser(request);
        if (!caller) return jsonResponse({ ok: false, error: 'X-User header required' }, 401);
        const perm = await checkRole(caller, ['owner']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);

        try {
          await dbRun('INSERT INTO users (username,password,name,role,photo_url) VALUES (?,?,?,?,?)',
            body.username, body.password, body.name, body.role || 'mekanik', body.photo_url || '');
          return jsonResponse({ ok: true, message: 'user created' }, 201);
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 400);
        }
      }

      // Update user
      if (parts[0] === 'users' && parts[1] && (method === 'PUT' || method === 'PATCH')) {
        const target = decodeURIComponent(parts[1]);
        const caller = getHeaderUser(request);
        if (!caller) return jsonResponse({ ok: false, error: 'X-User header required' }, 401);
        const callerRec = await getUserRecord(caller);
        if (!callerRec) return jsonResponse({ ok: false, error: 'caller not found' }, 401);
        if (callerRec.role !== 'owner' && caller !== target) return jsonResponse({ ok: false, error: 'forbidden' }, 403);

        const body = await safeJson(request);
        if (!body) return jsonResponse({ ok: false, error: 'body required' }, 400);

        const fields = [];
        const binds = [];
        if (body.password) { fields.push('password = ?'); binds.push(body.password); }
        if (body.name) { fields.push('name = ?'); binds.push(body.name); }
        if (body.photo_url) { fields.push('photo_url = ?'); binds.push(body.photo_url); }
        if (body.role && callerRec.role === 'owner') { fields.push('role = ?'); binds.push(body.role); }
        if (fields.length === 0) return jsonResponse({ ok: false, error: 'nothing to update' }, 400);

        binds.push(target);
        const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE username = ?`;
        try {
          await dbRun(sql, ...binds);
          return jsonResponse({ ok: true, message: 'updated' });
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // DELETE user
      if (parts[0] === 'users' && parts[1] && method === 'DELETE') {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);
        const target = decodeURIComponent(parts[1]);
        try {
          await dbRun('DELETE FROM users WHERE username = ?', target);
          return jsonResponse({ ok: true, message: 'deleted' });
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------- BARANG ----------
      if (path === '/barang' && method === 'GET') {
        const res = await dbAll('SELECT id,kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi,created_at,updated_at FROM barang ORDER BY id DESC');
        return jsonResponse({ ok: true, results: res });
      }

      if (parts[0] === 'barang' && parts[1] && method === 'GET') {
        const id = parseInt(parts[1], 10);
        if (!id) return jsonResponse({ ok: false, error: 'invalid id' }, 400);
        const r = await dbFirst('SELECT * FROM barang WHERE id = ?', id);
        if (!r) return jsonResponse({ ok: false, error: 'not found' }, 404);
        return jsonResponse({ ok: true, result: r });
      }

      if (path === '/barang' && method === 'POST') {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner', 'admin']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body || !body.nama) return jsonResponse({ ok: false, error: 'nama required' }, 400);
        try {
          const res = await dbRun(
            `INSERT INTO barang (kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi) VALUES (?,?,?,?,?,?,?,?)`,
            body.kode_barang || '', body.nama, Number(body.harga || 0), Number(body.harga_modal || 0), Number(body.stock || 0),
            body.kategori || '', body.foto || '', body.deskripsi || ''
          );
          const newId = res && res.lastInsertRowid ? res.lastInsertRowid : null;
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'tambah_barang', newId, body.nama, Number(body.stock || 0), body.catatan || '', perm.user.username);
          return jsonResponse({ ok: true, id: newId });
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // Update barang
      if (parts[0] === 'barang' && parts[1] && (method === 'PUT' || method === 'PATCH')) {
        const id = parseInt(parts[1], 10);
        if (!id) return jsonResponse({ ok: false, error: 'invalid id' }, 400);
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner', 'admin']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body) return jsonResponse({ ok: false, error: 'body required' }, 400);

        const cur = await dbFirst('SELECT nama,stock FROM barang WHERE id = ?', id);
        if (!cur) return jsonResponse({ ok: false, error: 'not found' }, 404);

        const fields = [];
        const binds = [];
        if (body.kode_barang !== undefined) { fields.push('kode_barang = ?'); binds.push(body.kode_barang); }
        if (body.nama !== undefined) { fields.push('nama = ?'); binds.push(body.nama); }
        if (body.harga !== undefined) { fields.push('harga = ?'); binds.push(Number(body.harga)); }
        if (body.harga_modal !== undefined) { fields.push('harga_modal = ?'); binds.push(Number(body.harga_modal)); }
        if (body.stock !== undefined) { fields.push('stock = ?'); binds.push(Number(body.stock)); }
        if (body.kategori !== undefined) { fields.push('kategori = ?'); binds.push(body.kategori); }
        if (body.foto !== undefined) { fields.push('foto = ?'); binds.push(body.foto); }
        if (body.deskripsi !== undefined) { fields.push('deskripsi = ?'); binds.push(body.deskripsi); }
        if (fields.length === 0) return jsonResponse({ ok: false, error: 'nothing to update' }, 400);

        binds.push(id);
        const sql = `UPDATE barang SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        try {
          await dbRun(sql, ...binds);
          if (body.stock !== undefined && Number(body.stock) !== Number(cur.stock)) {
            const diff = Number(body.stock) - Number(cur.stock);
            await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
              'edit_barang', id, body.nama || cur.nama, diff, body.catatan || 'adjust stock', perm.user.username);
          } else {
            await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
              'edit_barang', id, body.nama || cur.nama, 0, body.catatan || 'edit', perm.user.username);
          }
          return jsonResponse({ ok: true, message: 'updated' });
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // DELETE barang
      if (parts[0] === 'barang' && parts[1] && method === 'DELETE') {
        const id = parseInt(parts[1], 10);
        if (!id) return jsonResponse({ ok: false, error: 'invalid id' }, 400);
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner', 'admin']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);
        const cur = await dbFirst('SELECT nama FROM barang WHERE id = ?', id);
        if (!cur) return jsonResponse({ ok: false, error: 'not found' }, 404);
        try {
          await dbRun('DELETE FROM barang WHERE id = ?', id);
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'hapus_barang', id, cur.nama || '', 0, '', perm.user.username);
          return jsonResponse({ ok: true, message: 'deleted' });
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------- STOK MASUK ----------
      if (path === '/stok_masuk' && method === 'POST') {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner', 'admin', 'mekanik']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body) return jsonResponse({ ok: false, error: 'body required' }, 400);
        const qty = Number(body.jumlah || body.qty || 0);
        if (!qty || qty <= 0) return jsonResponse({ ok: false, error: 'jumlah must be > 0' }, 400);

        let bid = body.barang_id || null;
        if (!bid && body.kode_barang) {
          const r = await dbFirst('SELECT id FROM barang WHERE kode_barang = ? LIMIT 1', body.kode_barang);
          bid = r ? r.id : null;
        }
        if (!bid && body.nama) {
          const r = await dbFirst('SELECT id FROM barang WHERE nama = ? LIMIT 1', body.nama);
          bid = r ? r.id : null;
        }
        let barangRow = null;
        if (!bid && body.nama) {
          const res = await dbRun('INSERT INTO barang (kode_barang,nama,harga,harga_modal,stock) VALUES (?,?,?,?,?)',
            body.kode_barang || '', body.nama, Number(body.harga || 0), Number(body.harga_modal || 0), 0);
          bid = res && res.lastInsertRowid ? res.lastInsertRowid : null;
          barangRow = { id: bid, nama: body.nama, stock: 0 };
        } else if (bid) {
          const r = await dbFirst('SELECT id,nama,stock FROM barang WHERE id = ?', bid);
          barangRow = r || null;
        } else {
          return jsonResponse({ ok: false, error: 'barang_id or kode_barang or nama required' }, 400);
        }

        if (!barangRow) return jsonResponse({ ok: false, error: 'barang not found' }, 404);
        const newStock = Number(barangRow.stock || 0) + qty;
        try {
          await dbRun('UPDATE barang SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, bid);
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'stok_masuk', bid, barangRow.nama, qty, body.catatan || '', perm.user.username);
          return jsonResponse({ ok: true, message: 'stok updated', barang_id: bid, newStock });
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------- STOK KELUAR ----------
      if (path === '/stok_keluar' && method === 'POST') {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner', 'admin', 'mekanik']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body) return jsonResponse({ ok: false, error: 'body required' }, 400);
        const qty = Number(body.jumlah || body.qty || 0);
        if (!qty || qty <= 0) return jsonResponse({ ok: false, error: 'jumlah must be > 0' }, 400);

        let bid = body.barang_id || null;
        if (!bid && body.kode_barang) {
          const r = await dbFirst('SELECT id FROM barang WHERE kode_barang = ? LIMIT 1', body.kode_barang);
          bid = r ? r.id : null;
        }
        if (!bid && body.nama) {
          const r = await dbFirst('SELECT id FROM barang WHERE nama = ? LIMIT 1', body.nama);
          bid = r ? r.id : null;
        }
        if (!bid) return jsonResponse({ ok: false, error: 'barang_id or kode_barang or nama required' }, 400);

        const barangRow = await dbFirst('SELECT id,nama,stock FROM barang WHERE id = ?', bid);
        if (!barangRow) return jsonResponse({ ok: false, error: 'barang not found' }, 404);
        if (Number(barangRow.stock || 0) < qty) return jsonResponse({ ok: false, error: 'stock tidak mencukupi' }, 400);

        const newStock = Number(barangRow.stock || 0) - qty;
        try {
          await dbRun('UPDATE barang SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, bid);
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'stok_keluar', bid, barangRow.nama, -qty, body.catatan || '', perm.user.username);
          return jsonResponse({ ok: true, message: 'stok updated', barang_id: bid, newStock });
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------- RIWAYAT READ ----------
      if (path === '/riwayat' && method === 'GET') {
        const params = Object.fromEntries(url.searchParams.entries());
        const limit = Number(params.limit || 100);
        const offset = Number(params.offset || 0);
        const tipe = params.tipe || null;
        const barang_id = params.barang_id || null;
        const dibuat_oleh = params.user || params.dibuat_oleh || null;
        const from = params.from || null;
        const to = params.to || null;

        const binds = [];
        let where = [];
        if (tipe) { where.push('tipe = ?'); binds.push(tipe); }
        if (barang_id) { where.push('barang_id = ?'); binds.push(Number(barang_id)); }
        if (dibuat_oleh) { where.push('dibuat_oleh = ?'); binds.push(dibuat_oleh); }
        if (from) { where.push('created_at >= ?'); binds.push(from); }
        if (to) { where.push('created_at <= ?'); binds.push(to); }

        let sql = 'SELECT id,tipe,barang_id,barang_nama,jumlah,catatan,dibuat_oleh,created_at FROM riwayat';
        if (where.length) sql += ' WHERE ' + where.join(' AND ');
        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        binds.push(limit, offset);

        const res = await dbAll(sql, ...binds);
        return jsonResponse({ ok: true, results: res });
      }

      // ---------- MORE / SETTINGS ----------
      if (path === '/more' && method === 'GET') {
        const r = await dbFirst('SELECT custom_message,sticky_message,welcome_image_url,updated_by,updated_at FROM more WHERE id = 1');
        return jsonResponse({ ok: true, result: r || {} });
      }

      if (path === '/more' && (method === 'PUT' || method === 'POST')) {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner']);
        if (!perm.ok) return jsonResponse({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body) return jsonResponse({ ok: false, error: 'body required' }, 400);
        const cm = body.custom_message || '';
        const sm = body.sticky_message || '';
        const wi = body.welcome_image_url || '';
        try {
          await dbRun('UPDATE more SET custom_message = ?, sticky_message = ?, welcome_image_url = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
            cm, sm, wi, perm.user.username);
          return jsonResponse({ ok: true, message: 'more updated' });
        } catch (err) {
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------- UPLOAD IMAGE (IMGBB) ----------
      if (path === '/upload' && method === 'POST') {
        // handle multipart/form-data or json { imageBase64 } or { imageUrl }
        const imgbbKey = env.IMG_BB_KEY || null;
        if (!imgbbKey) {
          return jsonResponse({ ok: false, error: 'IMG_BB_KEY not configured on worker' }, 400);
        }

        const contentType = request.headers.get('content-type') || '';
        let base64 = null;

        if (contentType.includes('multipart/form-data')) {
          const form = await request.formData();
          const file = form.get('file') || form.get('image');
          if (!file) return jsonResponse({ ok: false, error: 'no file field' }, 400);
          const ab = await file.arrayBuffer();
          base64 = arrayBufferToBase64(ab);
        } else {
          const body = await safeJson(request) || {};
          if (body.imageBase64) base64 = body.imageBase64;
          else if (body.imageUrl) {
            const r = await fetch(body.imageUrl);
            const ab = await r.arrayBuffer();
            base64 = arrayBufferToBase64(ab);
          }
        }

        if (!base64) return jsonResponse({ ok: false, error: 'no image data' }, 400);

        try {
          const imgbbUrl = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey)}`;
          const resp = await fetch(imgbbUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `image=${encodeURIComponent(base64)}`
          });
          const j = await resp.json();
          if (!j || !j.success) {
            console.log('[upload] imgbb raw:', j);
            return jsonResponse({ ok: false, error: 'upload failed', raw: j }, 500);
          }
          return jsonResponse({ ok: true, url: j.data.url, thumb: j.data.thumb?.url || null });
        } catch (err) {
          console.error('[upload] err:', err);
          return jsonResponse({ ok: false, error: 'upload error', message: err.message || String(err) }, 500);
        }
      }

      // fallback 404
      return jsonResponse({ ok: false, error: 'not found', path }, 404);
    } catch (err) {
      console.error('[worker] unexpected error', err);
      return jsonResponse({ ok: false, error: 'unexpected', message: err && err.message ? err.message : String(err) }, 500);
    }
  }
};
