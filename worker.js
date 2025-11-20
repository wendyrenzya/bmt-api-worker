// ========== BASE WORKER: dari "Semua Oke Kecuali Upload" ==========

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS
    if (request.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: defaultHeaders(),
      });
    }

    try {
      // === LOGIN ===
      if (path === "/login" && request.method === "POST") {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
          return json({ ok: false, error: "Missing login fields" });
        }

        const stmt = env.DB
          .prepare("SELECT id, username FROM user WHERE username = ? AND password = ?")
          .bind(username, password);

        const user = await stmt.first();

        if (!user) {
          return json({ ok: false, error: "Invalid login" });
        }

        return json({ ok: true, user });
      }

      // === BARANG ===
      if (path === "/barang" && request.method === "GET") {
        const stmt = env.DB.prepare("SELECT * FROM barang ORDER BY id DESC");
        const items = await stmt.all();
        return json(items);
      }

      // === UPLOAD (diganti full dengan versi file B) ===
      if (path === "/upload" && request.method === "POST") {
        return await handleUpload(request, env);
      }

      return json({ ok: false, error: "Route not found", route: path }, 404);
    } catch (err) {
      return json({ ok: false, error: "Internal", message: err.message }, 500);
    }
  },
};

// =====================================================
// ==== UPLOAD HANDLER FINAL — dari "Upload OK File B" ===
// =====================================================

async function handleUpload(request, env) {
  const key = env.IMG_BB_KEY || null;

  if (!key) {
    return json({ ok: false, error: "IMG_BB_KEY not configured on worker" }, 400);
  }

  const contentType = request.headers.get("content-type") || "";
  let base64 = null;

  // === multipart/form-data ===
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") || form.get("image");
    if (!file) return json({ ok: false, error: "no file field" }, 400);

    const ab = await file.arrayBuffer();
    base64 = arrayBufferToBase64(ab);
  } else {
    // === JSON input ===
    let body = null;
    try {
      body = await request.json();
    } catch (_) {
      body = {};
    }

    if (body.imageBase64) {
      base64 = body.imageBase64;
    } else if (body.imageUrl) {
      const r = await fetch(body.imageUrl);
      const ab = await r.arrayBuffer();
      base64 = arrayBufferToBase64(ab);
    }
  }

  if (!base64) {
    return json({ ok: false, error: "no image data" }, 400);
  }

  // === Upload ke ImgBB ===
  try {
    const resp = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `image=${encodeURIComponent(base64)}`,
      }
    );

    const j = await resp.json();

    if (!j || !j.success) {
      return json({ ok: false, error: "upload failed", raw: j }, 500);
    }

    return json({
      ok: true,
      url: j.data.url,
      thumb: j.data.thumb?.url || null,
    });
  } catch (err) {
    return json({ ok: false, error: "upload error", message: err.message }, 500);
  }
}

// =====================================================
// =================== UTILITIES =======================
// =====================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: defaultHeaders(),
  });
}

function defaultHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// aman untuk Cloudflare Workers (tanpa Buffer)
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}
