// worker.js
// Full final worker for BMT_DB (D1) schema provided
// Binding: env.BMT_DB
// Optional env: env.IMG_BB_KEY (for imgbb upload)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathRaw = url.pathname || '/';
    const path = pathRaw.replace(/\/+$/, '') || '/';
    const method = request.method.toUpperCase();

    // helpers
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });

    const safeJson = async (req) => {
      try { return await req.json(); } catch { return null; }
    };

    // bindings
    const db = env && env.BMT_DB ? env.BMT_DB : null;
    const IMGBB = env && env.IMG_BB_KEY ? env.IMG_BB_KEY : null;

    // quick health
    if ((path === '/' || path === '/health') && method === 'GET') {
      return json({ ok: true, service: 'BMT API', env: { hasDB: !!db, hasIMGBB: !!IMGBB } });
    }

    // -------------------------
    // BERANDA - summary endpoint
    // -------------------------
    // GET /beranda  => returns counts and last items for UI dashboard
    if (path === '/beranda' && method === 'GET') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      try {
        // counts: barang, stok_masuk, stok_keluar, users
        const c1 = await db.prepare('SELECT COUNT(*) AS cnt FROM barang').first();
        const c2 = await db.prepare('SELECT COUNT(*) AS cnt FROM stok_masuk').first();
        const c3 = await db.prepare('SELECT COUNT(*) AS cnt FROM stok_keluar').first();
        const c4 = await db.prepare('SELECT COUNT(*) AS cnt FROM users').first();
        // last 5 barang
        const lastBarang = await db.prepare('SELECT id,kode_barang,nama,harga,stock,foto,updated_at FROM barang ORDER BY id DESC LIMIT 5').all();

        return json({
          ok: true,
          counts: {
            barang: (c1 && c1.cnt) ? c1.cnt : 0,
            stok_masuk: (c2 && c2.cnt) ? c2.cnt : 0,
            stok_keluar: (c3 && c3.cnt) ? c3.cnt : 0,
            users: (c4 && c4.cnt) ? c4.cnt : 0,
          },
          last_barang: (lastBarang && lastBarang.results) ? lastBarang.results : [],
        });
      } catch (e) {
        console.log('BERANDA ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // -------------------------
    // LOGIN
    // -------------------------
    // POST /login  { username, password }
    if (path === '/login' && method === 'POST') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      const body = await safeJson(request);
      if (!body || !body.username || !body.password) return json({ ok: false, error: 'username & password required' }, 400);
      try {
        const row = await db.prepare('SELECT id,username FROM users WHERE username = ? AND password = ?').bind(body.username, body.password).first();
        if (!row) return json({ ok: false, error: 'invalid credentials' }, 401);
        return json({ ok: true, user: row });
      } catch (e) {
        console.log('LOGIN ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // -------------------------
    // BARANG - CRUD (minimal)
    // -------------------------
    // GET /barang  => list all
    if (path === '/barang' && method === 'GET') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      try {
        const rows = await db.prepare('SELECT * FROM barang ORDER BY id DESC').all();
        return json({ ok: true, total: (rows && rows.results) ? rows.results.length : 0, results: rows.results || [] });
      } catch (e) {
        console.log('BARANG ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // POST /barang  => add new barang (expects JSON matching schema)
    if (path === '/barang' && method === 'POST') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      const body = await safeJson(request);
      if (!body || !body.nama) return json({ ok: false, error: 'field nama required' }, 400);
      try {
        const now = new Date().toISOString();
        const q = await db.prepare(
          `INSERT INTO barang (kode_barang,nama,harga_modal,harga,stock,kategori,foto,deskripsi,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        )
        .bind(
          body.kode_barang || '',
          body.nama || '',
          body.harga_modal || 0,
          body.harga || 0,
          body.stock || 0,
          body.kategori || '',
          body.foto || '',
          body.deskripsi || '',
          now,
          now
        )
        .run();
        console.log('INSERT BARANG:', q);
        return json({ ok: true, result: q });
      } catch (e) {
        console.log('BARANG INSERT ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // PUT /barang  => update barang (expects JSON with id)
    if (path === '/barang' && method === 'PUT') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      const body = await safeJson(request);
      if (!body || !body.id) return json({ ok: false, error: 'field id required' }, 400);
      try {
        const now = new Date().toISOString();
        const q = await db.prepare(
          `UPDATE barang SET kode_barang=?,nama=?,harga_modal=?,harga=?,stock=?,kategori=?,foto=?,deskripsi=?,updated_at=? WHERE id = ?`
        )
        .bind(
          body.kode_barang || '',
          body.nama || '',
          body.harga_modal || 0,
          body.harga || 0,
          body.stock || 0,
          body.kategori || '',
          body.foto || '',
          body.deskripsi || '',
          now,
          body.id
        )
        .run();
        return json({ ok: true, result: q });
      } catch (e) {
        console.log('BARANG UPDATE ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // DELETE /barang?id=123
    if (path === '/barang' && method === 'DELETE') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      const id = url.searchParams.get('id');
      if (!id) return json({ ok: false, error: 'id required' }, 400);
      try {
        const q = await db.prepare('DELETE FROM barang WHERE id = ?').bind(id).run();
        return json({ ok: true, result: q });
      } catch (e) {
        console.log('BARANG DELETE ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // -------------------------
    // STOK MASUK / KELUAR
    // -------------------------
    // POST /stok_masuk  { barang_id, jumlah, keterangan, dibuat_oleh }
    if (path === '/stok_masuk' && method === 'POST') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      const body = await safeJson(request);
      if (!body || !body.barang_id || !body.jumlah) return json({ ok: false, error: 'barang_id & jumlah required' }, 400);
      try {
        const now = new Date().toISOString();
        const ins = await db.prepare('INSERT INTO stok_masuk (barang_id,jumlah,keterangan,dibuat_oleh,created_at) VALUES (?,?,?,?,?)')
          .bind(body.barang_id, body.jumlah, body.keterangan || '', body.dibuat_oleh || '', now)
          .run();
        // update stock in barang
        await db.prepare('UPDATE barang SET stock = stock + ? WHERE id = ?').bind(body.jumlah, body.barang_id).run();
        return json({ ok: true, result: ins });
      } catch (e) {
        console.log('STOK MASUK ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // POST /stok_keluar  { barang_id, jumlah, keterangan, dibuat_oleh }
    if (path === '/stok_keluar' && method === 'POST') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      const body = await safeJson(request);
      if (!body || !body.barang_id || !body.jumlah) return json({ ok: false, error: 'barang_id & jumlah required' }, 400);
      try {
        const now = new Date().toISOString();
        const ins = await db.prepare('INSERT INTO stok_keluar (barang_id,jumlah,keterangan,dibuat_oleh,created_at) VALUES (?,?,?,?,?)')
          .bind(body.barang_id, body.jumlah, body.keterangan || '', body.dibuat_oleh || '', now)
          .run();
        // update stock in barang (subtract)
        await db.prepare('UPDATE barang SET stock = stock - ? WHERE id = ?').bind(body.jumlah, body.barang_id).run();
        return json({ ok: true, result: ins });
      } catch (e) {
        console.log('STOK KELUAR ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // -------------------------
    // SETTINGS (simple)
    // -------------------------
    // GET /settings
    if (path === '/settings' && method === 'GET') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      try {
        const res = await db.prepare('SELECT id,key,value,updated_by,updated_at FROM settings ORDER BY id ASC').all();
        return json({ ok: true, results: res.results || [] });
      } catch (e) {
        console.log('SETTINGS ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // PUT /settings  { id, key, value, updated_by }
    if (path === '/settings' && method === 'PUT') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      const body = await safeJson(request);
      if (!body || !body.id) return json({ ok: false, error: 'id required' }, 400);
      try {
        const now = new Date().toISOString();
        const q = await db.prepare('UPDATE settings SET key=?,value=?,updated_by=?,updated_at=? WHERE id=?')
          .bind(body.key || '', body.value || '', body.updated_by || '', now, body.id).run();
        return json({ ok: true, result: q });
      } catch (e) {
        console.log('SETTINGS UPDATE ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // -------------------------
    // MORE / app_messages / riwayat (read-only basics)
    // -------------------------
    if (path === '/more' && method === 'GET') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      try {
        const more = await db.prepare('SELECT id,custom_message,sticky_message FROM more LIMIT 1').first();
        return json({ ok: true, more: more || {} });
      } catch (e) {
        console.log('MORE ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    if (path === '/app_messages' && method === 'GET') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      try {
        // structure not fully available — return what exists
        const res = await db.prepare('SELECT id,message FROM app_messages ORDER BY id DESC LIMIT 50').all();
        return json({ ok: true, results: res.results || [] });
      } catch (e) {
        console.log('APP_MESSAGES ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    if (path === '/riwayat' && method === 'GET') {
      if (!db) return json({ ok: false, error: 'BMT_DB not bound' }, 500);
      try {
        const res = await db.prepare('SELECT * FROM riwayat ORDER BY id DESC LIMIT 100').all();
        return json({ ok: true, results: res.results || [] });
      } catch (e) {
        console.log('RIWAYAT ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // -------------------------
    // UPLOAD (imgbb)
    // -------------------------
    // POST /upload  form-data field 'file'
    if (path === '/upload' && method === 'POST') {
      if (!IMGBB) return json({ ok: false, error: 'IMG_BB_KEY not configured' }, 500);

      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return json({ ok: false, error: 'Expected multipart/form-data with field "file"' }, 400);
      }

      try {
        const fd = await request.formData();
        const f = fd.get('file');
        if (!f) return json({ ok: false, error: 'No file field named "file"' }, 400);

        const ab = await f.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const CHUNK = 0x8000;
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
          binary += String.fromCharCode.apply(null, slice);
        }
        const base64 = btoa(binary);

        const body = new URLSearchParams();
        body.append('key', IMGBB);
        body.append('image', base64);

        const resp = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });

        const j = await resp.json().catch(e => ({ ok: false, error: 'invalid imgbb response', detail: String(e) }));
        console.log('UPLOAD RESPONSE:', j);

        if (!j || j.status !== 200 || !j.data || !j.data.url) {
          return json({ ok: false, error: 'imgbb upload failed', detail: j }, resp.status || 502);
        }

        return json({ ok: true, url: j.data.url, detail: j });
      } catch (e) {
        console.log('UPLOAD ERROR:', e);
        return json({ ok: false, error: 'Internal', message: String(e) }, 500);
      }
    }

    // not found
    return json({ ok: false, error: 'Route not found', path }, 404);
  },
};
