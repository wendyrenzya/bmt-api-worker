// worker.js (MODULE FORMAT – Cloudflare D1 Compatible)
// ===================================================
// ENDPOINTS:
// GET    /api/barang
// GET    /api/barang/:id
// POST   /api/barang        (auto numeric kode_barang)
// PUT    /api/barang/:id
// DELETE /api/barang/:id
// GET    /api/kategori
// GET    /api/duckimg?q=...
// ===================================================

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "");
      const method = request.method;

      // CORS PRE-FLIGHT
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      // ROUTING
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

      if (path === "/api/duckimg" && method === "GET")
        return duckImageProxy(request);

      return json({ error: "Not Found" }, 404);

    } catch (err) {
      return json({ error: err.message || "Server Error" }, 500);
    }
  }
};

// ===================================================
// UTILITIES
// ===================================================
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

// ===================================================
// HANDLERS
// ===================================================

// 1) LIST BARANG
async function listBarang(env) {
  const sql = `SELECT * FROM barang ORDER BY id DESC`;
  const res = await env.BMT_DB.prepare(sql).all();
  return json({ items: res.results || [] });
}

// 2) GET BARANG BY ID
async function getBarangById(env, request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = Number(parts[2]);
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

  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = Number(parts[2]);
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
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = Number(parts[2]);
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

// PATCH DUCKDUCKGO (2025 Compatible)
async function duckImageProxy(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  if (!q) return json({ image: "" });

  try {
    // 1. Ambil vqd token
    const searchURL = `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
    const html = await fetch(searchURL, {
      headers: { "User-Agent": "Mozilla/5.0" }
    }).then(r => r.text());

    const vqdMatch = html.match(/vqd=([0-9-]+)\&/);
    if (!vqdMatch) return json({ image: "" });
    const vqd = vqdMatch[1];

    // 2. Fetch image JSON
    const apiURL =
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}`;

    const imgData = await fetch(apiURL, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    }).then(r => r.json());

    if (imgData?.results?.length > 0) {
      return json({ image: imgData.results[0].image });
    }

  } catch (err) {
    console.log("DuckImage error", err);
  }

  return json({ image: "" });
}
