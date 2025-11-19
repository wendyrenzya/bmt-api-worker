export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = request.method.toUpperCase();
    
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });

    const text = (t, status = 200) =>
      new Response(String(t), { status, headers: { "Content-Type": "text/plain" } });

    const safeJson = async (req) => {
      try { return await req.json(); } catch { return null; }
    };

    const getHeaderUser = (req) =>
      req.headers.get("X-User") || req.headers.get("x-user") || null;

    const dbAll = async (sql, ...bind) =>
      await env.DB.prepare(sql).bind(...bind).all();
    const dbFirst = async (sql, ...bind) =>
      await env.DB.prepare(sql).bind(...bind).first();
    const dbRun = async (sql, ...bind) =>
      await env.DB.prepare(sql).bind(...bind).run();

    const getUserRecord = async (username) => {
      if (!username) return null;
      return await dbFirst(
        "SELECT username,name,role,photo_url,created_at FROM users WHERE username = ?",
        username
      );
    };

    const checkRole = async (username, allowed = []) => {
      const user = await getUserRecord(username);
      if (!user)
        return { ok: false, code: 401, msg: "User not found or X-User missing" };
      if (allowed.length === 0) return { ok: true, user };
      if (!allowed.includes(user.role))
        return {
          ok: false,
          code: 403,
          msg: "Anda tidak memiliki akses, silahkan contact owner",
          user,
        };
      return { ok: true, user };
    };

    const parts = path.split("/").filter(Boolean);

    try {
      // Health Check
      if ((path === "" || path === "/") && method === "GET")
        return text("BMT API OK");

      // ---------------- AUTH ----------------
      if (path === "/auth/login" && method === "POST") {
        const body = await safeJson(request);
        if (!body?.username || !body?.password)
          return json({ ok: false, error: "username & password required" }, 400);

        const row = await dbFirst(
          "SELECT username,name,role,photo_url,password FROM users WHERE username = ?",
          body.username
        );

        if (!row || row.password !== body.password)
          return json({ ok: false, error: "invalid credentials" }, 401);

        const { password: _, ...user } = row;
        return json({ ok: true, ...user });
      }

      if (path === "/auth/me" && method === "GET") {
        const u = getHeaderUser(request);
        if (!u) return json({ ok: false, error: "X-User header required" }, 401);
        const rec = await getUserRecord(u);
        if (!rec) return json({ ok: false, error: "user not found" }, 404);
        return json({ ok: true, user: rec });
      }

      // ---------------- USERS ----------------
      if (path === "/users" && method === "GET") {
        const perm = await checkRole(getHeaderUser(request), ["owner", "admin"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        const res = await dbAll(
          "SELECT username,name,role,photo_url,created_at FROM users ORDER BY created_at DESC"
        );
        return json({ ok: true, results: res.results || [] });
      }

      if (path === "/users" && method === "POST") {
        const body = await safeJson(request);
        if (!body?.username || !body?.password || !body?.name)
          return json({ ok: false, error: "username,password,name required" }, 400);

        const count = await dbFirst("SELECT COUNT(*) AS c FROM users");
        if ((count?.c || 0) === 0) {
          await dbRun(
            "INSERT INTO users (username,password,name,role,photo_url) VALUES (?,?,?,?,?)",
            body.username,
            body.password,
            body.name,
            "owner",
            body.photo_url || ""
          );
          return json({ ok: true, message: "owner created (bootstrap)" }, 201);
        }

        const perm = await checkRole(getHeaderUser(request), ["owner"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        try {
          await dbRun(
            "INSERT INTO users (username,password,name,role,photo_url) VALUES (?,?,?,?,?)",
            body.username,
            body.password,
            body.name,
            body.role || "mekanik",
            body.photo_url || ""
          );
          return json({ ok: true, message: "user created" }, 201);
        } catch (err) {
          return json({ ok: false, error: String(err) }, 400);
        }
      }

      if (parts[0] === "users" && parts[1] && ["PUT", "PATCH"].includes(method)) {
        const target = decodeURIComponent(parts[1]);
        const caller = getHeaderUser(request);
        if (!caller) return json({ ok: false, error: "X-User required" }, 401);

        const callerRec = await getUserRecord(caller);
        if (!callerRec) return json({ ok: false, error: "caller not found" }, 401);
        if (callerRec.role !== "owner" && caller !== target)
          return json({ ok: false, error: "forbidden" }, 403);

        const body = await safeJson(request);
        if (!body) return json({ ok: false, error: "body required" }, 400);

        const fields = [];
        const bind = [];

        if (body.password) { fields.push("password = ?"); bind.push(body.password); }
        if (body.name) { fields.push("name = ?"); bind.push(body.name); }
        if (body.photo_url) { fields.push("photo_url = ?"); bind.push(body.photo_url); }
        if (body.role && callerRec.role === "owner") {
          fields.push("role = ?"); bind.push(body.role);
        }

        if (!fields.length) return json({ ok: false, error: "nothing to update" }, 400);

        bind.push(target);
        await dbRun(
          `UPDATE users SET ${fields.join(", ")}, updated_at=CURRENT_TIMESTAMP WHERE username=?`,
          ...bind
        );

        return json({ ok: true, message: "updated" });
      }

      if (parts[0] === "users" && parts[1] && method === "DELETE") {
        const perm = await checkRole(getHeaderUser(request), ["owner"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        try {
          await dbRun("DELETE FROM users WHERE username = ?", parts[1]);
          return json({ ok: true, message: "deleted" });
        } catch (err) {
          return json({ ok: false, error: String(err) }, 500);
        }
      }

      // ---------------- BARANG ----------------
      if (path === "/barang" && method === "GET") {
        const res = await dbAll(
          "SELECT id,kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi,created_at,updated_at FROM barang ORDER BY id DESC"
        );
        return json({ ok: true, results: res.results || [] });
      }

      if (parts[0] === "barang" && parts[1] && method === "GET") {
        const id = Number(parts[1]);
        const r = await dbFirst("SELECT * FROM barang WHERE id=?", id);
        if (!r) return json({ ok: false, error: "not found" }, 404);
        return json({ ok: true, result: r });
      }

      if (path === "/barang" && method === "POST") {
        const perm = await checkRole(getHeaderUser(request), ["owner", "admin"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        const body = await safeJson(request);
        if (!body?.nama) return json({ ok: false, error: "nama required" }, 400);

        const res = await dbRun(
          "INSERT INTO barang (kode_barang,nama,harga,harga_modal,stock,kategori,foto,deskripsi) VALUES (?,?,?,?,?,?,?,?)",
          body.kode_barang || "",
          body.nama,
          Number(body.harga || 0),
          Number(body.harga_modal || 0),
          Number(body.stock || 0),
          body.kategori || "",
          body.foto || "",
          body.deskripsi || ""
        );

        const id = res.lastInsertRowid;

        await dbRun(
          "INSERT INTO riwayat (tipe,barang_id,barang_nama,jumlah,catatan,dibuat_oleh) VALUES (?,?,?,?,?,?)",
          "tambah_barang",
          id,
          body.nama,
          Number(body.stock || 0),
          body.catatan || "",
          perm.user.username
        );

        return json({ ok: true, id });
      }

      if (parts[0] === "barang" && parts[1] && ["PUT", "PATCH"].includes(method)) {
        const perm = await checkRole(getHeaderUser(request), ["owner", "admin"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        const id = Number(parts[1]);
        const body = await safeJson(request);
        const cur = await dbFirst("SELECT nama,stock FROM barang WHERE id=?", id);
        if (!cur) return json({ ok: false, error: "not found" }, 404);

        const fields = [];
        const bind = [];

        const check = (key, col) => {
          if (body[key] !== undefined) {
            fields.push(`${col}=?`);
            bind.push(body[key]);
          }
        };

        check("kode_barang", "kode_barang");
        check("nama", "nama");
        check("harga", "harga");
        check("harga_modal", "harga_modal");
        check("stock", "stock");
        check("kategori", "kategori");
        check("foto", "foto");
        check("deskripsi", "deskripsi");

        if (!fields.length) return json({ ok: false, error: "nothing to update" }, 400);

        bind.push(id);

        await dbRun(
          `UPDATE barang SET ${fields.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          ...bind
        );

        return json({ ok: true, message: "updated" });
      }

      if (parts[0] === "barang" && parts[1] && method === "DELETE") {
        const perm = await checkRole(getHeaderUser(request), ["owner", "admin"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        await dbRun("DELETE FROM barang WHERE id=?", Number(parts[1]));
        return json({ ok: true, message: "deleted" });
      }

      // ---------------- STOK MASUK / KELUAR ----------------
      if (path === "/stok_masuk" && method === "POST") {
        const perm = await checkRole(getHeaderUser(request), ["owner", "admin", "mekanik"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        const body = await safeJson(request);
        const qty = Number(body.jumlah || body.qty || 0);
        if (qty <= 0)
          return json({ ok: false, error: "jumlah must be > 0" }, 400);

        let id = body.barang_id;
        if (!id && body.nama) {
          const found = await dbFirst("SELECT id FROM barang WHERE nama=?", body.nama);
          if (found) id = found.id;
        }

        if (!id)
          return json({ ok: false, error: "barang_id or nama required" }, 400);

        const cur = await dbFirst("SELECT stock FROM barang WHERE id=?", id);
        if (!cur) return json({ ok: false, error: "barang not found" }, 404);

        const newStock = cur.stock + qty;

        await dbRun(
          "UPDATE barang SET stock=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          newStock,
          id
        );

        await dbRun(
          "INSERT INTO riwayat (tipe,barang_id,barang_nama,jumlah,catatan,dibuat_oleh) VALUES (?,?,?,?,?,?)",
          "stok_masuk",
          id,
          body.nama || "",
          qty,
          body.catatan || "",
          perm.user.username
        );

        return json({ ok: true, newStock });
      }

      if (path === "/stok_keluar" && method === "POST") {
        const perm = await checkRole(getHeaderUser(request), ["owner", "admin", "mekanik"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        const body = await safeJson(request);
        const qty = Number(body.jumlah || 0);
        if (qty <= 0)
          return json({ ok: false, error: "jumlah must be > 0" }, 400);

        const id = body.barang_id;
        const cur = await dbFirst("SELECT stock FROM barang WHERE id=?", id);
        if (!cur) return json({ ok: false, error: "barang not found" }, 404);
        if (cur.stock < qty)
          return json({ ok: false, error: "stock tidak mencukupi" }, 400);

        await dbRun(
          "UPDATE barang SET stock=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          cur.stock - qty,
          id
        );

        return json({ ok: true, newStock: cur.stock - qty });
      }

      // ---------------- RIWAYAT ----------------
      if (path === "/riwayat" && method === "GET") {
        const res = await dbAll(
          "SELECT * FROM riwayat ORDER BY created_at DESC LIMIT 200"
        );
        return json({ ok: true, results: res.results || [] });
      }

      // ---------------- MORE ----------------
      if (path === "/more" && method === "GET") {
        const r = await dbFirst(
          "SELECT custom_message,sticky_message,welcome_image_url,updated_by,updated_at FROM more WHERE id=1"
        );
        return json({ ok: true, result: r || {} });
      }

      if (path === "/more" && ["PUT", "POST"].includes(method)) {
        const perm = await checkRole(getHeaderUser(request), ["owner"]);
        if (!perm.ok) return json({ ok: false, error: perm.msg }, perm.code);

        const body = await safeJson(request);

        await dbRun(
          "UPDATE more SET custom_message=?,sticky_message=?,welcome_image_url=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=1",
          body.custom_message || "",
          body.sticky_message || "",
          body.welcome_image_url || "",
          perm.user.username
        );

        return json({ ok: true, message: "updated" });
      }

      return json({ ok: false, error: "not found", path }, 404);
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  },
};
