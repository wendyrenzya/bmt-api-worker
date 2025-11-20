export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const db = env.BMT_DB; // ⬅ WAJIB PERSIS SESUAI KONTRAK

    // ==========================================
    // 1. LOGIN (TIDAK DIUBAH)
    // ==========================================
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
        return Response.json({
          ok: false,
          error: "Internal",
          message: e.message,
        });
      }
    }

    // ==========================================
    // 2. BARANG (TIDAK DIUBAH)
    // ==========================================
    if (path === "/barang" && request.method === "GET") {
      try {
        const rows = await db.prepare("SELECT * FROM barang").all();
        return Response.json({
          ok: true,
          total: rows.results.length,
          data: rows.results,
        });
      } catch (e) {
        return Response.json({
          ok: false,
          error: "Internal",
          message: e.message,
        });
      }
    }

    // ==========================================
    // 3. UPLOAD IMAGE (FIX FINAL)
    // ==========================================
    if (path === "/upload" && request.method === "POST") {
      try {
        if (!env.IMG_BB_KEY) {
          return Response.json({
            ok: false,
            error: "IMG_BB_KEY not configured on worker",
          });
        }

        const formData = await request.formData();
        const imageFile = formData.get("file");

        if (!imageFile) {
          return Response.json({
            ok: false,
            error: "No file uploaded",
          });
        }

        // Read binary data
        const arrayBuffer = await imageFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Convert to base64 safely (Cloudflare compatible)
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        // Send to imgbb
        const body = new URLSearchParams();
        body.append("key", env.IMG_BB_KEY);
        body.append("image", base64);

        const uploadRes = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });

        const result = await uploadRes.json();

        if (!result.success) {
          return Response.json({
            ok: false,
            error: "Upload failed",
            detail: result,
          });
        }

        return Response.json({
          ok: true,
          url: result.data.url,
        });
      } catch (e) {
        return Response.json({ ok: false, error: "Internal", message: e.message });
      }
    }

    // ==========================================
    // DEFAULT
    // ==========================================
    return Response.json({ ok: false, error: "Route not found", path });
  },
};
