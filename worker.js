/* ==========================================================
   BMT API — WORKER.JS FINAL V1
   Semua fitur dasar aplikasi (Login, Barang, Stock, More, Settings, Upload)
   ========================================================== */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = request.method.toUpperCase();

    // ---------- Helper ----------
    const json = (o, s = 200) =>
      new Response(JSON.stringify(o, null, 2), {
        status: s,
        headers: { "Content-Type": "application/json" },
      });

    const safeBody = async (req) => {
      try { return await req.json(); }
      catch { return {}; }
    };

    const db = env.BMT_DB;
    const IMGKEY = env.IMG_BB_KEY || null;

    // ==========================================================
    // 1. LOGIN
    // ==========================================================
    if (path === "/login" && method === "POST") {
      if (!db) return json({ ok: false, error: "DB not bound" }, 500);
      const { username, password } = await safeBody(request);

      try {
        const row = await db
          .prepare(`SELECT id,username,name,role,photo_url 
                    FROM users WHERE username = ? AND password = ?`)
          .bind(username, password)
          .first();

        if (!row) return json({ ok: false, error: "invalid login" }, 401);
        return json({ ok: true, user: row });
      } catch (e) {
        return json({ ok: false, error: "db error", detail: e.message }, 500);
      }
    }

    // ==========================================================
    // 2. BARANG — GET ALL
    // ==========================================================
    if (path === "/barang" && method === "GET") {
      if (!db) return json({ ok: false, error: "DB not bound" }, 500);

      try {
        const res = await db.prepare("SELECT * FROM barang ORDER BY id DESC").all();
        return json({ ok: true, results: res.results || [] });
      } catch (e) {
        return json({ ok: false, error: "db error", detail: e.message }, 500);
      }
    }

    // ==========================================================
    // 3. STOCK MASUK — HISTORY
    // ==========================================================
    if (path === "/stok_masuk" && method === "GET") {
      if (!db) return json({ ok: false, error: "DB not bound" }, 500);

      try {
        const rows = await db
          .prepare("SELECT * FROM stok_masuk ORDER BY id DESC")
          .all();
        return json({ ok: true, results: rows.results || [] });
      } catch (e) {
        return json({ ok: false, error: "db error", detail: e.message }, 500);
      }
    }

    // ==========================================================
    // 4. STOCK KELUAR — HISTORY
    // ==========================================================
    if (path === "/stok_keluar" && method === "GET") {
      if (!db) return json({ ok: false, error: "DB not bound" }, 500);

      try {
        const rows = await db
          .prepare("SELECT * FROM stok_keluar ORDER BY id DESC")
          .all();
        return json({ ok: true, results: rows.results || [] });
      } catch (e) {
        return json({ ok: false, error: "db error", detail: e.message }, 500);
      }
    }

    // ==========================================================
    // 5. SETTINGS — GET
    // ==========================================================
    if (path === "/settings" && method === "GET") {
      if (!db) return json({ ok: false, error: "DB not bound" }, 500);

      try {
        const res = await db.prepare("SELECT * FROM settings").all();
        return json({ ok: true, settings: res.results || [] });
      } catch (e) {
        return json({ ok: false, error: "db error", detail: e.message }, 500);
      }
    }

    // ==========================================================
    // 6. MORE PAGE — CUSTOM & STICKY MESSAGE
    // ==========================================================
    if (path === "/more" && method === "GET") {
      if (!db) return json({ ok: false, error: "DB not bound" }, 500);

      try {
        const m = await db.prepare("SELECT * FROM more LIMIT 1").first();
        return json({ ok: true, more: m || {} });
      } catch (e) {
        return json({ ok: false, error: "db error", detail: e.message }, 500);
      }
    }

    // ==========================================================
    // 7. UPLOAD — PROFILE / BARANG IMAGE (imgbb)
    // ==========================================================
    if (path === "/upload" && method === "POST") {
      if (!IMGKEY) return json({ ok: false, error: "IMG_BB_KEY missing" }, 500);

      const ct = request.headers.get("content-type") || "";
      if (!ct.includes("multipart/form-data"))
        return json({ ok: false, error: "Expect multipart/form-data" }, 400);

      try {
        const fd = await request.formData();
        const file = fd.get("file");
        if (!file) return json({ ok: false, error: "no file" }, 400);

        // convert to base64
        const ab = await file.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) {
          const chunk = bytes.subarray(i, i + 0x8000);
          binary += String.fromCharCode.apply(null, chunk);
        }
        const base64 = btoa(binary);

        const body = new URLSearchParams();
        body.append("key", IMGKEY);
        body.append("image", base64);

        const imgres = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });

        const out = await imgres.json();
        if (!out || !out.success) return json({ ok: false, error: "upload fail", detail: out });

        return json({ ok: true, url: out.data.url });
      } catch (e) {
        return json({ ok: false, error: "upload error", detail: e.message }, 500);
      }
    }

    // ==========================================================
    // DEFAULT ROUTE
    // ==========================================================
    return json({ ok: false, error: "route not found", path }, 404);
  },
};
