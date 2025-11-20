export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS (wajib minimal untuk form input + fetch)
    if (request.method === "OPTIONS") {
      return new Response("ok", {
        status: 200,
        headers: defaultHeaders(),
      });
    }

    try {
      // === ROUTE: LOGIN ======================================
      if (path === "/login" && request.method === "POST") {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
          return json({ ok: false, error: "Missing login fields" });
        }

        const stmt = env.DB.prepare(
          "SELECT id, username FROM user WHERE username = ? AND password = ?"
        ).bind(username, password);

        const user = await stmt.first();

        if (!user) {
          return json({ ok: false, error: "Invalid login" });
        }

        return json({ ok: true, user });
      }

      // === ROUTE: BARANG ======================================
      if (path === "/barang" && request.method === "GET") {
        const stmt = env.DB.prepare("SELECT * FROM barang ORDER BY id DESC");
        const items = await stmt.all();
        return json(items);
      }

      // === ROUTE: UPLOAD IMAGE IMGBB ===========================
      if (path === "/upload" && request.method === "POST") {
        return await handleUpload(request, env);
      }

      return json({ ok: false, error: "Route not found", route: path }, 404);
    } catch (err) {
      return json(
        { ok: false, error: "Internal", message: err.message },
        500
      );
    }
  },
};

/* ============================================================
   UPLOAD HANDLER — FIXED VERSION (NO BUFFER, WORKER SAFE)
============================================================ */

async function handleUpload(request, env) {
  if (!env.IMG_BB_KEY) {
    return json({ ok: false, error: "IMG_BB_KEY not configured on worker" }, 500);
  }

  let file;

  // Try multipart/form-data first
  try {
    const contentType = request.headers.get("Content-Type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      file = form.get("file") || form.get("image");
    }
  } catch (_) {}

  if (!file) {
    return json({ ok: false, error: "No file received" }, 400);
  }

  // Convert ke Uint8Array
  const arrayBuf = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuf);

  // Send to ImgBB
  const uploadRes = await fetch(
    `https://api.imgbb.com/1/upload?key=${env.IMG_BB_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `image=${encodeURIComponent(base64)}`,
    }
  );

  const result = await uploadRes.json();

  if (!result.success) {
    return json({ ok: false, error: "Upload failed", detail: result }, 500);
  }

  return json({ ok: true, url: result.data.url });
}

/* ============================================================
   UTILS
============================================================ */

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

// Convert ArrayBuffer → base64 (aman untuk Cloudflare Workers)
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  // chunk untuk hindari memory limit
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
