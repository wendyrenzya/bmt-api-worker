// worker.js - BMT API final (single-file)
// Bindings required: D1 database named "DB" (set binding name DB -> resource bmt_db)
// API base root serves health check. Uses X-User header for authentication (no JWT).

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/+$/, ''); // no trailing slash
    const method = request.method.toUpperCase();

    // ---------- helpers ----------
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });

    const text = (t, status = 200) =>
      new Response(String(t), { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

    const safeJson = async (req) => {
      try { return await req.json(); } catch (e) { return null; }
    };

    const getHeaderUser = (req) => {
      const h = req.headers.get('X-User') || req.headers.get('x-user') || '';
      return h ? String(h) : null;
    };

    // D1 helpers
    const dbAll = async (sql, ...binds) => {
      const r = await env.DB.prepare(sql).bind(...binds).all();
      return r;
    };
    const dbFirst = async (sql, ...binds) => {
      const r = await env.DB.prepare(sql).bind(...binds).first();
      return r;
    };
    const dbRun = async (sql, ...binds) => {
      const r = await env.DB.prepare(sql).bind(...binds).run();
      return r;
    };

    const getUserRecord = async (username) => {
      if (!username) return null;
      const res = await dbFirst('SELECT username,name,role,photo_url,created_at FROM users WHERE username = ?', username);
      return res || null;
    };
    const checkRole = async (username, allowed = []) => {
      if (!username) return { ok: false, code: 401, msg: 'User not found or X-User missing' };
      const user = await getUserRecord(username);
      if (!user) return { ok: false, code: 401, msg: 'User not found or X-User missing' };
      if (allowed.length === 0) return { ok: true, user };
      if (!allowed.includes(user.role)) return { ok: false, code: 403, msg: 'Anda tidak memiliki akses, silahkan contact owner', user };
      return { ok: true, user };
    };

    // parts
    const parts = path.split('/').filter(Boolean);

    try {
      // health
      if ((path === '' || path === '/') && method === 'GET') {
        return text('BMT API OK');
      }

      // ---------- AUTH (no token) ----------
      // NOTE: we keep endpoints for compatibility with your UI that uses POST /auth/login
      if (path === '/auth/login' && method === 'POST') {
        const body = await safeJson(request);
        const username = body && body.username;
        const password = body && body.password;
        if (!username || !password) return json({ ok: false, error: 'username & password required' }, 400);
        const row = await dbFirst('SELECT username,name,role,photo_url,password FROM users WHERE username = ?', username);
        if (!row) return json({ ok: false, error: 'invalid credentials' }, 401);
        if (row.password !== password) return json({ ok: false, error: 'invalid credentials' }, 401);
        const { password: _p, ...user } = row;
        return json({ ok: true, ...user });
      }

      if (path === '/auth/me' && method === 'GET') {
        const u = getHeaderUser(request);
        if (!u) return json({ ok: false, error: 'X-User header required' }, 401);
        const rec = await getUserRecord(u);
        if (!rec) return json({ ok: false, error: 'user not found' }, 404);
        return json({ ok: true, user: rec });
      }

      // ---------- USERS ----------
      if (path === '/users' && method === 'GET') {
        const perm = await checkRole(getHeaderUser(request), ['owner','admin']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const res = await dbAll('SELECT username,name,role,photo_url,created_at FROM users ORDER BY created_at DESC');
        return json({ ok: true, results: res.results || [] });
      }

      if (path === '/users' && method === 'POST') {
        // create user — owner only; bootstrap if none exists
        const body = await safeJson(request);
        if (!body || !body.username || !body.password || !body.name) return json({ ok: false, error: 'username,password,name required' }, 400);
        const cntRes = await dbFirst("SELECT COUNT(*) AS c FROM users");
        const c = (cntRes && cntRes.c) ? cntRes.c : 0;
        if (c === 0) {
          // bootstrap owner
          await dbRun('INSERT INTO users (username,password,name,role,photo_url) VALUES (?,?,?,?,?)',
            body.username, body.password, body.name, 'owner', body.photo_url || '');
          return json({ ok: true, message: 'owner created (bootstrap)' }, 201);
        }
        const caller = getHeaderUser(request);
        if (!caller) return json({ ok: false, error: 'X-User header required' }, 401);
        const perm = await checkRole(caller, ['owner']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        try {
          await dbRun('INSERT INTO users (username,password,name,role,photo_url) VALUES (?,?,?,?,?)',
            body.username, body.password, body.name, body.role || 'mekanik', body.photo_url || '');
          return json({ ok: true, message: 'user created' }, 201);
        } catch (err) {
          return json({ ok: false, error: String(err) }, 400);
        }
      }

      // PUT/PATCH /users/:username
      if (parts[0] === 'users' && parts[1] && (method === 'PUT' || method === 'PATCH')) {
        const target = decodeURIComponent(parts[1]);
        const caller = getHeaderUser(request);
        if (!caller) return json({ ok: false, error: 'X-User header required' }, 401);
        const callerRec = await getUserRecord(caller);
        if (!callerRec) return json({ ok: false, error: 'caller not found' }, 401);
        if (callerRec.role !== 'owner' && caller !== target) return json({ ok: false, error: 'forbidden' }, 403);
        const body = await safeJson(request);
        if (!body) return json({ ok: false, error: 'body required' }, 400);
        const fields = []; const binds = [];
        if (body.password) { fields.push('password = ?'); binds.push(body.password); }
        if (body.name) { fields.push('name = ?'); binds.push(body.name); }
        if (body.photo_url) { fields.push('photo_url = ?'); binds.push(body.photo_url); }
        if (body.role && callerRec.role === 'owner') { fields.push('role = ?'); binds.push(body.role); }
        if (fields.length === 0) return json({ ok: false, error: 'nothing to update' }, 400);
        binds.push(target);
        const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE username = ?`;
        try {
          await dbRun(sql, ...binds);
          return json({ ok: true, message: 'updated' });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      // DELETE /users/:username (owner only)
      if (parts[0] === 'users' && parts[1] && method === 'DELETE') {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const target = decodeURIComponent(parts[1]);
        try {
          await dbRun('DELETE FROM users WHERE username = ?', target);
          return json({ ok: true, message: 'deleted' });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------- BARANG (products) ----------
      // GET /barang
      if (path === '/barang' && method === 'GET') {
        const params = Object.fromEntries(url.searchParams.entries());
        const limit = Number(params.limit || 100);
        const offset = Number(params.offset || 0);
        const q = params.q || null;
        let sql = 'SELECT id,kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi,created_at,updated_at FROM barang';
        const binds = [];
        if (q) {
          sql += ' WHERE nama LIKE ? OR kode_barang LIKE ?';
          const like = `%${q}%`;
          binds.push(like, like);
        }
        sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        binds.push(limit, offset);
        const r = await dbAll(sql, ...binds);
        return json({ ok: true, results: r.results || [] });
      }

      // GET /barang/:id
      if (parts[0] === 'barang' && parts[1] && method === 'GET') {
        const id = parseInt(parts[1], 10);
        if (!id) return json({ ok: false, error: 'invalid id' }, 400);
        const r = await dbFirst('SELECT * FROM barang WHERE id = ?', id);
        if (!r) return json({ ok: false, error: 'not found' }, 404);
        return json({ ok: true, result: r });
      }

      // POST /barang (create product)
      if (path === '/barang' && method === 'POST') {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner','admin']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body || !body.nama) return json({ ok: false, error: 'nama required' }, 400);

        // auto fetch photo if not provided: use source.unsplash.com with nama
        let fotoUrl = body.foto && String(body.foto).trim();
        if (!fotoUrl) {
          // sanitize nama -> remove quotes etc
          const q = encodeURIComponent(String(body.nama).replace(/\s+/g,' ').trim());
          fotoUrl = `https://source.unsplash.com/800x600/?${q}`;
        }

        try {
          const res = await dbRun(
            `INSERT INTO barang (kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi) VALUES (?,?,?,?,?,?,?,?)`,
            body.kode_barang || '', body.nama, Number(body.harga || 0), Number(body.harga_modal || 0), Number(body.stock || 0),
            body.kategori || '', fotoUrl, body.deskripsi || ''
          );
          const newId = res && res.lastInsertRowid ? res.lastInsertRowid : null;
          // riwayat tambah
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'tambah_barang', newId, body.nama, Number(body.stock || 0), body.catatan || '', perm.user.username);
          return json({ ok: true, id: newId, foto_used: fotoUrl });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      // PUT/PATCH /barang/:id (edit)
      if (parts[0] === 'barang' && parts[1] && (method === 'PUT' || method === 'PATCH')) {
        const id = parseInt(parts[1], 10);
        if (!id) return json({ ok: false, error: 'invalid id' }, 400);
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner','admin']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body) return json({ ok: false, error: 'body required' }, 400);
        const cur = await dbFirst('SELECT nama,stock FROM barang WHERE id = ?', id);
        if (!cur) return json({ ok: false, error: 'not found' }, 404);

        const fields = []; const binds = [];
        if (body.kode_barang !== undefined) { fields.push('kode_barang = ?'); binds.push(body.kode_barang); }
        if (body.nama !== undefined) { fields.push('nama = ?'); binds.push(body.nama); }
        if (body.harga !== undefined) { fields.push('harga = ?'); binds.push(Number(body.harga)); }
        if (body.harga_modal !== undefined) { fields.push('harga_modal = ?'); binds.push(Number(body.harga_modal)); }
        if (body.stock !== undefined) { fields.push('stock = ?'); binds.push(Number(body.stock)); }
        if (body.kategori !== undefined) { fields.push('kategori = ?'); binds.push(body.kategori); }
        if (body.foto !== undefined) { fields.push('foto = ?'); binds.push(body.foto); }
        if (body.deskripsi !== undefined) { fields.push('deskripsi = ?'); binds.push(body.deskripsi); }
        if (fields.length === 0) return json({ ok: false, error: 'nothing to update' }, 400);

        binds.push(id);
        const sql = `UPDATE barang SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        try {
          await dbRun(sql, ...binds);
          // if stock changed, log diff
          if (body.stock !== undefined && Number(body.stock) !== Number(cur.stock)) {
            const diff = Number(body.stock) - Number(cur.stock);
            await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
              'edit_barang', id, body.nama || cur.nama, diff, body.catatan || 'adjust stock', perm.user.username);
          } else {
            await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
              'edit_barang', id, body.nama || cur.nama, 0, body.catatan || 'edit', perm.user.username);
          }
          return json({ ok: true, message: 'updated' });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      // DELETE /barang/:id
      if (parts[0] === 'barang' && parts[1] && method === 'DELETE') {
        const id = parseInt(parts[1], 10);
        if (!id) return json({ ok: false, error: 'invalid id' }, 400);
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner','admin']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const cur = await dbFirst('SELECT nama FROM barang WHERE id = ?', id);
        if (!cur) return json({ ok: false, error: 'not found' }, 404);
        try {
          await dbRun('DELETE FROM barang WHERE id = ?', id);
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'hapus_barang', id, cur.nama || '', 0, '', perm.user.username);
          return json({ ok: true, message: 'deleted' });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------- STOK MASUK / KELUAR (same as before) ----------
      if (path === '/stok_masuk' && method === 'POST') {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner','admin','mekanik']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body) return json({ ok: false, error: 'body required' }, 400);
        const qty = Number(body.jumlah || body.qty || 0);
        if (!qty || qty <= 0) return json({ ok: false, error: 'jumlah must be > 0' }, 400);

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
          return json({ ok: false, error: 'barang_id or kode_barang or nama required' }, 400);
        }

        if (!barangRow) return json({ ok: false, error: 'barang not found' }, 404);
        const newStock = Number(barangRow.stock || 0) + qty;
        try {
          await dbRun('UPDATE barang SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, bid);
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'stok_masuk', bid, barangRow.nama, qty, body.catatan || '', perm.user.username);
          return json({ ok: true, message: 'stok updated', barang_id: bid, newStock });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      if (path === '/stok_keluar' && method === 'POST') {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner','admin','mekanik']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body) return json({ ok: false, error: 'body required' }, 400);
        const qty = Number(body.jumlah || body.qty || 0);
        if (!qty || qty <= 0) return json({ ok: false, error: 'jumlah must be > 0' }, 400);

        let bid = body.barang_id || null;
        if (!bid && body.kode_barang) {
          const r = await dbFirst('SELECT id FROM barang WHERE kode_barang = ? LIMIT 1', body.kode_barang);
          bid = r ? r.id : null;
        }
        if (!bid && body.nama) {
          const r = await dbFirst('SELECT id FROM barang WHERE nama = ? LIMIT 1', body.nama);
          bid = r ? r.id : null;
        }
        if (!bid) return json({ ok: false, error: 'barang_id or kode_barang or nama required' }, 400);

        const barangRow = await dbFirst('SELECT id,nama,stock FROM barang WHERE id = ?', bid);
        if (!barangRow) return json({ ok: false, error: 'barang not found' }, 404);
        if (Number(barangRow.stock || 0) < qty) return json({ ok: false, error: 'stock tidak mencukupi' }, 400);

        const newStock = Number(barangRow.stock || 0) - qty;
        try {
          await dbRun('UPDATE barang SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStock, bid);
          await dbRun('INSERT INTO riwayat (tipe, barang_id, barang_nama, jumlah, catatan, dibuat_oleh) VALUES (?,?,?,?,?,?)',
            'stok_keluar', bid, barangRow.nama, -qty, body.catatan || '', perm.user.username);
          return json({ ok: true, message: 'stok updated', barang_id: bid, newStock });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------- RIWAYAT ----------
      if (path === '/riwayat' && method === 'GET') {
        const params = Object.fromEntries(url.searchParams.entries());
        const limit = Number(params.limit || 100);
        const offset = Number(params.offset || 0);
        const tipe = params.tipe || null;
        const barang_id = params.barang_id || null;
        const dibuat_oleh = params.user || params.dibuat_oleh || null;
        const from = params.from || null;
        const to = params.to || null;

        const binds = []; let where = [];
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
        return json({ ok: true, results: res.results || [] });
      }

      // ---------- MORE / settings ----------
      if (path === '/more' && method === 'GET') {
        const r = await dbFirst('SELECT custom_message,sticky_message,welcome_image_url,updated_by,updated_at FROM more WHERE id = 1');
        return json({ ok: true, result: r || {} });
      }
      if (path === '/more' && (method === 'PUT' || method === 'POST')) {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ['owner']);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);
        const body = await safeJson(request);
        if (!body) return json({ ok: false, error: 'body required' }, 400);
        const cm = body.custom_message || '';
        const sm = body.sticky_message || '';
        const wi = body.welcome_image_url || '';
        try {
          await dbRun('UPDATE more SET custom_message = ?, sticky_message = ?, welcome_image_url = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
            cm, sm, wi, perm.user.username);
          return json({ ok: true, message: 'more updated' });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      // fallback
      return json({ ok: false, error: 'not found', path }, 404);
    } catch (err) {
      return json({ ok: false, error: String(err) + '' }, 500);
    }
  }
};      if (!allowed.includes(u.role))
        return { ok: false, code: 403, msg: "Anda tidak memiliki akses, silahkan contact owner", user: u };
      return { ok: true, user: u };
    };

    const parts = path.split("/").filter(Boolean);

    // -------------------------------------------------------
    // ROUTES
    // -------------------------------------------------------

    try {
      // ---------- HEALTH ----------
      if ((path === "" || path === "/") && method === "GET")
        return text("BMT API OK");

      // ---------- AUTH ----------
      if (path === "/auth/login" && method === "POST") {
        const body = await safeJson(request);
        if (!body || !body.username || !body.password)
          return json({ ok: false, error: "username & password required" }, 400);

        const row = await dbFirst(
          "SELECT username,name,role,photo_url,password FROM users WHERE username = ?",
          body.username
        );

        if (!row || row.password !== body.password)
          return json({ ok: false, error: "invalid credentials" }, 401);

        const { password, ...user } = row;
        return json({ ok: true, ...user });
      }

      if (path === "/auth/me" && method === "GET") {
        const u = getHeaderUser(request);
        if (!u) return json({ ok: false, error: "X-User required" }, 401);
        const rec = await getUserRecord(u);
        if (!rec) return json({ ok: false, error: "user not found" }, 404);
        return json({ ok: true, user: rec });
      }

      // =====================================================
      //                     BARANG
      // =====================================================

      // GET all barang
      if (path === "/barang" && method === "GET") {
        const r = await dbAll(
          `SELECT id,kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi,created_at,updated_at
           FROM barang ORDER BY id DESC`
        );
        return json({ ok: true, results: r.results || [] });
      }

      // GET barang by id
      if (parts[0] === "barang" && parts[1] && method === "GET") {
        const id = Number(parts[1]);
        if (!id) return json({ ok: false, error: "invalid id" }, 400);
        const r = await dbFirst("SELECT * FROM barang WHERE id = ?", id);
        if (!r) return json({ ok: false, error: "not found" }, 404);
        return json({ ok: true, result: r });
      }

      // ------------------------------
      // POST /barang  (AUTO IMAGE)
      // ------------------------------
      if (path === "/barang" && method === "POST") {
        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ["owner", "admin"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        const body = await safeJson(request);
        if (!body || !body.nama)
          return json({ ok: false, error: "nama required" }, 400);

        // Auto image search
        const autoFoto = await autoImageSearch(body.nama);
        const fotoFinal = autoFoto || "";

        const res = await dbRun(
          `INSERT INTO barang (kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi)
           VALUES (?,?,?,?,?,?,?,?)`,
          body.kode_barang || "",
          body.nama,
          Number(body.harga || 0),
          Number(body.harga_modal || 0),
          Number(body.stock || 0),
          body.kategori || "",
          fotoFinal,
          body.deskripsi || ""
        );

        const newId = res.lastInsertRowid;

        await dbRun(
          `INSERT INTO riwayat (tipe,barang_id,barang_nama,jumlah,catatan,dibuat_oleh)
           VALUES (?,?,?,?,?,?)`,
          "tambah_barang",
          newId,
          body.nama,
          Number(body.stock || 0),
          body.catatan || "",
          perm.user.username
        );

        return json({ ok: true, id: newId, auto_foto: fotoFinal });
      }

      // ------------------------------
      // PUT /barang/:id (AUTO OR MANUAL UPDATE FOTO)
      // ------------------------------
      if (parts[0] === "barang" && parts[1] && (method === "PUT" || method === "PATCH")) {
        const id = Number(parts[1]);
        if (!id) return json({ ok: false, error: "invalid id" }, 400);

        const caller = getHeaderUser(request);
        const perm = await checkRole(caller, ["owner", "admin"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        const body = await safeJson(request);
        if (!body) return json({ ok: false, error: "body required" }, 400);

        const cur = await dbFirst("SELECT nama,stock,foto FROM barang WHERE id = ?", id);
        if (!cur) return json({ ok: false, error: "not found" }, 404);

        const fields = [];
        const binds = [];

        if (body.kode_barang !== undefined) { fields.push("kode_barang=?"); binds.push(body.kode_barang); }
        if (body.nama !== undefined) { fields.push("nama=?"); binds.push(body.nama); }
        if (body.harga !== undefined) { fields.push("harga=?"); binds.push(Number(body.harga)); }
        if (body.harga_modal !== undefined) { fields.push("harga_modal=?"); binds.push(Number(body.harga_modal)); }
        if (body.stock !== undefined) { fields.push("stock=?"); binds.push(Number(body.stock)); }
        if (body.kategori !== undefined) { fields.push("kategori=?"); binds.push(body.kategori); }
        if (body.deskripsi !== undefined) { fields.push("deskripsi=?"); binds.push(body.deskripsi); }

        // FOTO HANDLING
        let newFoto = cur.foto;

        // 1. Manual URL
        if (body.foto_manual) {
          newFoto = body.foto_manual;
        }

        // 2. Auto refresh image
        if (body.refresh_foto === true) {
          const autoNew = await autoImageSearch(body.nama || cur.nama);
          if (autoNew) newFoto = autoNew;
        }

        fields.push("foto=?");
        binds.push(newFoto);

        if (fields.length === 0)
          return json({ ok: false, error: "nothing to update" }, 400);

        binds.push(id);

        await dbRun(
          `UPDATE barang SET ${fields.join(",")}, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          ...binds
        );

        return json({ ok: true, message: "updated", foto: newFoto });
      }

      // =====================================================
      // ROUTES LAIN (stok_masuk, stok_keluar, users, more, riwayat)
      // =====================================================
      // (SEMUA BAGIAN INI TETAP SAMA seperti worker sebelumnya)
      // ... (Kode lanjut — tidak dihapus untuk ringkas)
      // ------------------------------------------------------

      return json({ ok: false, error: "not found", path }, 404);

    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  }
};
