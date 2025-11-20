/* ========================
   File: worker.js (FINAL v1)
   Minimal API: login, barang, upload
   Stable + CORS universal + correct response shape
   ======================== */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const method = request.method.toUpperCase();

    // ---------- CORS ----------
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-User",
    };

    if (method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      });

    const safeJson = async (req) => {
      try { return await req.json(); } catch { return null; }
    };

    const db = env?.BMT_DB || null;
    const IMGBB = env?.IMG_BB_KEY || null;

    // ===========================================================
    // LOGIN  (POST /login)
    // ===========================================================
    if (path === "/login" && method === "POST") {
      if (!db) return json({ ok: false, error: "BMT_DB missing from bindings" }, 500);

      const body = await safeJson(request);
      if (!body?.username || !body?.password)
        return json({ ok: false, error: "username & password required" }, 400);

      try {
        const row = await db
          .prepare("SELECT username,name,role,photo_url FROM users WHERE username = ? AND password = ?")
          .bind(body.username, body.password)
          .first();

        if (!row) return json({ ok: false, error: "invalid credentials" }, 401);

        return json({ ok: true, user: row });
      } catch (e) {
        return json({ ok: false, error: "DB error", detail: String(e) }, 500);
      }
    }

    // ===========================================================
    // GET BARANG  (GET /barang)
    // ===========================================================
    if (path === "/barang" && method === "GET") {
      if (!db) return json({ ok: false, error: "BMT_DB missing from bindings" }, 500);

      try {
        const res = await db
          .prepare("SELECT id,nama,harga,harga_modal,stock,kategori,foto,deskripsi FROM barang ORDER BY id DESC")
          .all();

        return json({
          ok: true,
          total: res?.results?.length || 0,
          results: res?.results || [],
        });
      } catch (e) {
        return json({ ok: false, error: "DB error", detail: String(e) }, 500);
      }
    }

    // ===========================================================
    // UPLOAD (POST /upload)
    // multipart/form-data → field name: "file"
    // ===========================================================
    if (path === "/upload" && method === "POST") {
      if (!IMGBB) return json({ ok: false, error: "IMG_BB_KEY not set in worker env" }, 500);

      const ct = request.headers.get("content-type") || "";
      if (!ct.includes("multipart/form-data")) {
        return json({ ok: false, error: 'Expected multipart/form-data with field "file"' }, 400);
      }

      try {
        const form = await request.formData();
        const file = form.get("file");

        if (!file) return json({ ok: false, error: 'No field "file" provided' });

        const ab = await file.arrayBuffer();
        const bytes = new Uint8Array(ab);

        // convert bytes → base64
        let bin = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        const base64 = btoa(bin);

        const body = new URLSearchParams();
        body.append("key", IMGBB);
        body.append("image", base64);

        const resp = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });

        const data = await resp.json();

        // imgbb success check
        if (!data?.success || !data?.data?.url) {
          return json({ ok: false, error: "Upload failed", detail: data }, 500);
        }

        return json({ ok: true, url: data.data.url, detail: data });
      } catch (e) {
        return json({ ok: false, error: "upload error", detail: String(e) }, 500);
      }
    }

    // ===========================================================
    // HEALTH CHECK
    // ===========================================================
    if (path === "" || path === "/") {
      return json({ ok: true, message: "BMT API minimal OK" });
    }

    return json({ ok: false, error: "Route not found", route: path }, 404);
  },
};
