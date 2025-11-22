// =========================================================
// worker.js FINAL — Big Motor Tingkulu
// Paket 1: /api/duckimages + /api/upload
// =========================================================

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "");
      const method = request.method;

      // ---------------------------------------
      // CORS PRE-FLIGHT
      // ---------------------------------------
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      // ---------------------------------------
      // NEW ENDPOINTS (AMAN, tidak merusak CRUD)
      // ---------------------------------------

      // 1) Multiple DuckDuckGo images — 5 images array
      if (path === "/api/duckimages" && method === "GET") {
        return duckImagesHandler(request, env);
      }

      // 2) Server-side upload to ImgBB
      if (path === "/api/upload" && method === "POST") {
        return uploadHandler(request, env);
      }

      // ---------------------------------------
      // EXISTING CRUD BARANG (dipertahankan)
      // ---------------------------------------

      if (path === "/api/barang" && method === "GET")
        return listBarang(env);

      if (path.startsWith("/api/barang/") && method === "GET")
        return getBarangById(env, request);

      if (path === "/api/barang" && method === "POST")
        return addBarang(env, request);

      if (path.startsWith("/api/barang/") && method === "PUT")
        return updateBarang(env, request);

      if (path.startsWith("/api/barang/") && method === "DELETE")
        return deleteBarang(env, request);

      if (path === "/api/kategori" && method === "GET")
        return listKategori(env);

      // Old endpoint (single Duck image)
      if (path === "/api/duckimg" && method === "GET")
        return duckImageProxy(request);

      // ---------------------------------------
      // FALLBACK
      // ---------------------------------------
      return json({ error: "Not Found" }, 404);

    } catch (err) {
      return json({ error: err.message || "Server Error" }, 500);
    }
  }
};

// =========================================================
// UTILITIES
// =========================================================
function corsHeaders() {
  return {
    "Content-Type": "application/json;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}
async function bodyJSON(request) {
  try { return await request.json(); }
  catch { return null; }
}

// =========================================================
// CRUD BARANG (ASLI, TIDAK DIUBAH)
// =========================================================

// 1) LIST BARANG
async function listBarang(env) {
  const sql = `SELECT * FROM barang ORDER BY id DESC`;
  const res = await env.BMT_DB.prepare(sql).all();
  return json({ items: res.results || [] });
}

// 2) GET BARANG BY ID
async function getBarangById(env, request) {
  const id = Number(request.url.split("/").pop());
  if (!id) return json({ error: "Invalid ID" }, 400);

  const res = await env.BMT_DB.prepare("SELECT * FROM barang WHERE id=?")
    .bind(id).first();

  return json({ item: res || null });
}

// 3) ADD BARANG
async function addBarang(env, request) {
  const body = await bodyJSON(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);
  if (!body.nama || !body.harga) {
    return json({ error: "nama & harga wajib" }, 400);
  }

  // AUTO NUMERIC KODE BARANG
  let next = 1;
  try {
    const max = await env.BMT_DB
      .prepare("SELECT MAX(CAST(kode_barang AS INTEGER)) AS maxcode FROM barang")
      .first();
    if (max && max.maxcode) next = Number(max.maxcode) + 1;
  } catch (_) {}

  const kode_barang = String(next).padStart(5, "0");
  const now = new Date().toISOString();

  await env.BMT_DB.prepare(`
    INSERT INTO barang (kode_barang, nama, harga_modal, harga, stock, kategori, foto, deskripsi, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    kode_barang,
    body.nama,
    body.harga_modal || 0,
    body.harga,
    body.stock || 0,
    body.kategori || "",
    body.foto || "",
    body.deskripsi || "",
    now
  ).run();

  const findInserted = await env.BMT_DB.prepare(`
    SELECT id FROM barang WHERE kode_barang=? AND created_at=? LIMIT 1
  `).bind(kode_barang, now).first();

  return json({
    ok: true,
    id: findInserted ? findInserted.id : null,
    kode_barang
  });
}

// 4) UPDATE BARANG
async function updateBarang(env, request) {
  const body = await bodyJSON(request);
  if (!body) return json({ error: "Invalid JSON" }, 400);

  const id = Number(request.url.split("/").pop());
  if (!id) return json({ error: "Invalid ID" }, 400);

  const allowed = ["nama", "harga_modal", "harga", "stock", "kategori", "foto", "deskripsi"];
  const sets = [];
  const vals = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      sets.push(`${key}=?`);
      vals.push(body[key]);
    }
  }

  if (sets.length === 0)
    return json({ error: "No fields to update" }, 400);

  vals.push(id);

  await env.BMT_DB
    .prepare(`UPDATE barang SET ${sets.join(", ")} WHERE id=?`)
    .bind(...vals)
    .run();

  return json({ ok: true });
}

// 5) DELETE
async function deleteBarang(env, request) {
  const id = Number(request.url.split("/").pop());
  if (!id) return json({ error: "Invalid ID" }, 400);

  await env.BMT_DB.prepare("DELETE FROM barang WHERE id=?").bind(id).run();
  return json({ ok: true });
}

// 6) KATEGORI (DISTINCT)
async function listKategori(env) {
  const res = await env.BMT_DB
    .prepare(`SELECT DISTINCT kategori FROM barang WHERE kategori!='' ORDER BY kategori`)
    .all();

  const categories = res.results ? res.results.map(r => r.kategori) : [];
  return json({ categories });
}

// 7) DUCK IMAGE (lama, tetap dipertahankan)
async function duckImageProxy(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  if (!q) return json({ image: "" });

  const api = `https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}`;

  try {
    const r = await fetch(api, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });
    const data = await r.json();

    if (data?.results?.length) {
      return json({ image: data.results[0].image });
    }
  } catch (e) {
    console.log("DuckDuckGo error:", e);
  }

  return json({ image: "" });
}

// =========================================================
// NEW ENDPOINT: /api/duckimages  (returns 5 images)
// =========================================================

async function duckImagesHandler(request, env) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  if (!q) return json({ images: [] });

  let results = [];

  // Try DuckDuckGo i.js
  try {
    const ddUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}`;
    const res = await fetch(ddUrl, { headers: { "Accept": "application/json" }});
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j.results)) {
        results = j.results.map(r => r.image).filter(Boolean);
      }
    }
  } catch(e) {}

  // If less than 5, fill with Unsplash source
  while (results.length < 5) {
    results.push(`https://source.unsplash.com/600x450/?${encodeURIComponent(q)}&sig=${Math.random().toString(36).slice(2,8)}`);
  }

  // Dedup & trim
  const final = [...new Set(results)].slice(0,5);
  return json({ images: final });
}

// =========================================================
// NEW ENDPOINT: /api/upload (server-side ImgBB upload)
// =========================================================

async function uploadHandler(request, env) {
  const IMG_KEY = env.IMG_BB_KEY;
  if (!IMG_KEY) return json({ error: "IMG_BB_KEY not configured" }, 500);

  let base64 = null;
  const ct = request.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const b = await request.json().catch(()=>null);
    base64 = b?.image || null;
  } else if (ct.includes("form")) {
    const fd = await request.formData();
    const file = fd.get("image");
    if (file && file.arrayBuffer) {
      const ab = await file.arrayBuffer();
      base64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
    } else {
      base64 = file;
    }
  }

  if (!base64) return json({ error:"No image payload" }, 400);

  base64 = base64.replace(/^data:.*;base64,/, "");

  const form = new URLSearchParams();
  form.append("key", IMG_KEY);
  form.append("image", base64);

  try {
    const r = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: form
    });
    const jr = await r.json().catch(()=>null);
    return new Response(JSON.stringify(jr), {
      status: r.status,
      headers: corsHeaders()
    });
  } catch(e) {
    return json({ error:"ImgBB upload failed", detail:String(e) }, 500);
  }
    }
