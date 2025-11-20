export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const db = env.BMT_DB; // HARUS sesuai binding di wrangler.toml / Cloudflare

    // -----------------------
    // 1) LOGIN (POST /login)
    // -----------------------
    if (path === "/login" && request.method === "POST") {
      try {
        const data = await request.json();
        const { username, password } = data;

        const row = await db
          .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
          .bind(username, password)
          .first();

        if (!row) {
          return Response.json({ ok: false, error: "not found", path });
        }

        return Response.json({ ok: true, user: row });
      } catch (e) {
        console.log("LOGIN ERROR:", e);
        return Response.json({ ok: false, error: "Internal", message: e.message });
      }
    }

    // -----------------------
    // 2) GET /barang
    // -----------------------
    if (path === "/barang" && request.method === "GET") {
      try {
        const rows = await db.prepare("SELECT * FROM barang").all();
        return Response.json({
          ok: true,
          total: rows.results.length,
          data: rows.results,
        });
      } catch (e) {
        console.log("BARANG ERROR:", e);
        return Response.json({ ok: false, error: "Internal", message: e.message });
      }
    }

    // -----------------------
    // 3) POST /upload (imgbb)
    // -----------------------
    if (path === "/upload" && request.method === "POST") {
      try {
        if (!env.IMG_BB_KEY) {
          return Response.json({ ok: false, error: "IMG_BB_KEY not configured on worker" });
        }

        // support form-data file upload
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("multipart/form-data")) {
          return Response.json({ ok: false, error: "Expected multipart/form-data" });
        }

        const formData = await request.formData();
        const imageFile = formData.get("file"); // gunakan "file" sesuai form tester

        if (!imageFile) {
          return Response.json({ ok: false, error: "No file uploaded" });
        }

        // baca binary, ubah jadi base64 (Cloudflare safe)
        const arrayBuffer = await imageFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Convert bytes -> binary string in chunks to be safe
        let CHUNK = 0x8000; // chunk size
        let binary = "";
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
          binary += String.fromCharCode.apply(null, slice);
        }
        const base64 = btoa(binary);

        // prepare body
        const body = new URLSearchParams();
        body.append("key", env.IMG_BB_KEY);
        body.append("image", base64);

        const uploadRes = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });

        const result = await uploadRes.json();

        console.log("UPLOAD RESPONSE:", result);

        if (!result.success) {
          return Response.json({ ok: false, error: "Upload failed", detail: result });
        }

        return Response.json({ ok: true, url: result.data.url });
      } catch (e) {
        console.log("UPLOAD ERROR:", e);
        return Response.json({ ok: false, error: "Internal", message: e.message });
      }
    }

    // default
    return Response.json({ ok: false, error: "Route not found", path });
  },
};
