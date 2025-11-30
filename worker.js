export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // helper
    async function json(data, code = 200) {
      return new Response(JSON.stringify(data), {
        status: code,
        headers: { "Content-Type": "application/json" }
      })
    }

    // ---- PARSE BODY ----
    async function body() {
      try { return await req.json() } catch { return {} }
    }

    // ---- ROUTER ----
    if (path === "/api/login" && method === "POST")
      return login()

    if (path === "/api/users" && method === "GET")
      return listUsers()

    // BARANG CRUD
    if (path === "/api/barang" && method === "GET")
      return barangList()

    if (path === "/api/barang" && method === "POST")
      return barangCreate()

    if (path.startsWith("/api/barang/") && method === "GET")
      return barangDetail()

    if (path.startsWith("/api/barang/") && method === "PUT")
      return barangUpdate()

    if (path.startsWith("/api/barang/") && method === "DELETE")
      return barangDelete()

    // KATEGORI
    if (path === "/api/kategori" && method === "GET")
      return kategoriList()

    // ABSENSI
    if (path === "/api/absensi" && method === "GET")
      return absenList()

    if (path === "/api/absensi" && method === "POST")
      return absenCreate()

    // MESSAGE (harga)
    if (path === "/api/message" && method === "GET")
      return messageList()

    if (path === "/api/message" && method === "POST")
      return messageCreate()

    // SETTINGS
    if (path === "/api/settings" && method === "GET")
      return settingsGet()

    if (path === "/api/settings" && method === "POST")
      return settingsSet()

    // STOK MASUK BARU (1 per 1)
    if (path === "/api/stok_masuk" && method === "POST")
      return stokMasukSingle()

    // AUDIT (multi-item)
    if (path === "/api/stok_audit" && method === "POST")
      return stokAudit()

    return json({ error: "Endpoint tidak ditemukan" }, 404)


    // ======================================================
    // IMPLEMENTASI FUNGSI
    // ======================================================

    // LOGIN
    async function login() {
      const b = await body()
      const user = await env.DB.prepare(
        "SELECT * FROM users WHERE username=? AND password=?"
      ).bind(b.username, b.password).first()

      if (!user) return json({ ok: false, error: "Login gagal" }, 401)

      return json({
        ok: true,
        token: "STATIC-TOKEN",
        username: user.username,
        nama: user.nama,
        role: user.role
      })
    }

    // USERS
    async function listUsers() {
      const rows = await env.DB.prepare("SELECT id,username,nama,foto FROM users").all()
      return json({ users: rows.results })
    }

    // BARANG LIST
    async function barangList() {
      const rows = await env.DB.prepare(
        "SELECT * FROM barang ORDER BY id DESC"
      ).all()
      return json({ items: rows.results })
    }

    // BARANG DETAIL
    async function barangDetail() {
      const id = path.split("/").pop()
      const row = await env.DB.prepare("SELECT * FROM barang WHERE id=?").bind(id).first()
      return json({ item: row || null })
    }

    // BARANG CREATE
    async function barangCreate() {
      const b = await body()
      const r = await env.DB.prepare(
        `INSERT INTO barang 
         (kode_barang,nama,kategori,harga,harga_modal,stock,foto,deskripsi)
         VALUES (?,?,?,?,?,?,?,?)`
      )
        .bind(
          b.kode_barang,
          b.nama,
          b.kategori,
          b.harga,
          b.harga_modal,
          b.stock,
          b.foto,
          b.deskripsi
        )
        .run()

      return json({ ok: true, item: { id: r.lastInsertRowId } })
    }

    // BARANG UPDATE
    async function barangUpdate() {
      const id = path.split("/").pop()
      const b = await body()

      await env.DB.prepare(
        `UPDATE barang SET 
          nama=?, kategori=?, harga=?, harga_modal=?, deskripsi=?, foto=?
        WHERE id=?`
      )
        .bind(
          b.nama,
          b.kategori,
          b.harga,
          b.harga_modal,
          b.deskripsi,
          b.foto,
          id
        )
        .run()

      return json({ ok: true })
    }

    // BARANG DELETE
    async function barangDelete() {
      const id = path.split("/").pop()
      await env.DB.prepare("DELETE FROM barang WHERE id=?").bind(id).run()
      return json({ ok: true })
    }

    // KATEGORI LIST
    async function kategoriList() {
      const rows = await env.DB.prepare("SELECT nama FROM kategori").all()
      const arr = rows.results.map(r => r.nama)
      return json({ categories: arr })
    }

    // ABSENSI LIST
    async function absenList() {
      const rows = await env.DB.prepare(
        "SELECT * FROM absensi ORDER BY waktu DESC"
      ).all()
      return json({ items: rows.results })
    }

    // ABSENSI CREATE
    async function absenCreate() {
      const b = await body()
      await env.DB.prepare(
        "INSERT INTO absensi (username,lokasi,waktu) VALUES (?,?,?)"
      ).bind(b.username, b.lokasi, b.waktu).run()
      return json({ ok: true })
    }

    // MESSAGE LIST
    async function messageList() {
      const rows = await env.DB.prepare(
        "SELECT * FROM message ORDER BY created_at DESC"
      ).all()
      return json({ items: rows.results })
    }

    // MESSAGE CREATE
    async function messageCreate() {
      const b = await body()
      await env.DB.prepare(
        "INSERT INTO message (text,created_at) VALUES (?,strftime('%Y-%m-%d %H:%M:%S'))"
      ).bind(b.text).run()
      return json({ ok: true })
    }

    // SETTINGS GET
    async function settingsGet() {
      const rows = await env.DB.prepare("SELECT key,value FROM settings").all()
      const obj = {}
      rows.results.forEach(r => obj[r.key] = r.value)
      return json(obj)
    }

    // SETTINGS SET
    async function settingsSet() {
      const b = await body()
      await env.DB.prepare(
        "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
      ).bind(b.key, b.value).run()
      return json({ ok: true })
    }

    // STOK MASUK 1 PER 1
    async function stokMasukSingle() {
      const b = await body()
      const id = Number(b.barang_id)
      const qty = Number(b.qty)
      const keterangan = b.keterangan || ""

      const item = await env.DB
        .prepare("SELECT stock FROM barang WHERE id=?")
        .bind(id).first()

      if (!item) return json({ ok: false, error: "Barang tidak ditemukan" })

      const newStock = item.stock + qty

      await env.DB.prepare(
        "UPDATE barang SET stock=? WHERE id=?"
      ).bind(newStock, id).run()

      await env.DB.prepare(
        `INSERT INTO stok_masuk 
        (barang_id, qty, stok_setelah, keterangan, waktu) 
        VALUES (?,?,?,?,strftime('%Y-%m-%d %H:%M:%S'))`
      )
        .bind(id, qty, newStock, keterangan)
        .run()

      return json({ ok: true, stock: newStock })
    }

    // AUDIT STOCK MULTI-ITEM
    async function stokAudit() {
      const b = await body()
      const user = b.dibuat_oleh || "unknown"

      for (const it of b.items) {
        await env.DB.prepare(
          "UPDATE barang SET stock=? WHERE id=?"
        ).bind(it.stok_baru, it.barang_id).run()

        await env.DB.prepare(
          `INSERT INTO stok_audit 
           (barang_id, stok_baru, dibuat_oleh, waktu) 
           VALUES (?,?,?,strftime('%Y-%m-%d %H:%M:%S'))`
        )
          .bind(it.barang_id, it.stok_baru, user)
          .run()
      }

      return json({ ok: true })
    }

  }
}