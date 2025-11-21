// worker.js (full)
// Exposes:
// GET  /api/barang           -> list all items
// GET  /api/barang/:id       -> get single item
// POST /api/barang           -> add item (auto numeric kode_barang, 5 digits)
// PUT  /api/barang/:id       -> update item
// DELETE /api/barang/:id     -> delete item
// GET  /api/kategori         -> distinct kategori
// GET  /api/duckimg?q=...    -> duckduckgo image proxy
//
// Requires D1 binding named "DB" in wrangler.toml

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request, event));
});

function jsonHeaders() {
  return {
    "Content-Type": "application/json;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function textHeaders() {
  return {
    "Content-Type": "text/plain;charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

async function handleRequest(request, event) {
  const { method } = request;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, ""); // trim trailing slash
  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders() });
  }

  // route /api/*
  try {
    if (path === "/api/barang" && method === "GET") {
      return await listBarang(request, event);
    }

    if (path.startsWith("/api/barang/") && method === "GET") {
      return await getBarangById(request, event);
    }

    if (path === "/api/barang" && method === "POST") {
      return await addBarang(request, event);
    }

    if (path.startsWith("/api/barang/") && method === "PUT") {
      return await updateBarang(request, event);
    }

    if (path.startsWith("/api/barang/") && method === "DELETE") {
      return await deleteBarang(request, event);
    }

    if (path === "/api/kategori" && method === "GET") {
      return await listKategori(request, event);
    }

    if (path === "/api/duckimg" && method === "GET") {
      return await duckImageProxy(request, event);
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: jsonHeaders() });
  } catch (err) {
    console.error("Unhandled error", err);
    return new Response(JSON.stringify({ error: err.message || "Server error" }), { status: 500, headers: jsonHeaders() });
  }
}

/* ---------- Helpers to access DB binding ---------- */
function getDB(env = globalThis) {
  // In Workers runtime, DB is available on global binding via env in modules,
  // but since we use classic worker script, we assume binding named DB available as global variable
  // Cloudflare's classic worker maps bindings to global scope.
  return globalThis.DB;
}

async function queryAll(stmt, params = []) {
  const db = getDB();
  const res = await db.prepare(stmt).bind(...params).all();
  return res.results || [];
}
async function queryFirst(stmt, params = []) {
  const db = getDB();
  const res = await db.prepare(stmt).bind(...params).first();
  // .first() returns undefined or object
  return res || null;
}

/* ---------- Handlers ---------- */

async function listBarang(request, event) {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });

  const sql = `SELECT id, kode_barang, nama, harga_modal, harga, stock, kategori, foto, deskripsi, created_at
               FROM barang ORDER BY id DESC`;
  const res = await db.prepare(sql).all();
  const items = (res && res.results) ? res.results : [];
  return new Response(JSON.stringify({ items }), { status: 200, headers: jsonHeaders() });
}

async function getBarangById(request, event) {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });

  const parts = new URL(request.url).pathname.split("/").filter(Boolean); // ["api","barang",":id"]
  const id = Number(parts[2]);
  if (!id) return new Response(JSON.stringify({ error: "invalid id" }), { status: 400, headers: jsonHeaders() });

  const res = await db.prepare("SELECT * FROM barang WHERE id = ?").bind(id).first();
  return new Response(JSON.stringify({ item: res || null }), { status: 200, headers: jsonHeaders() });
}

async function addBarang(request, event) {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });

  const body = await safeJson(request);
  // minimal validation
  if (!body || !body.nama || !body.harga) {
    return new Response(JSON.stringify({ error: "fields nama & harga required" }), { status: 400, headers: jsonHeaders() });
  }

  // FULL AUTO NUMERIC for kode_barang - ignore input kode_barang
  // Find max numeric kode stored in kode_barang column; to be safe, consider non-numeric entries might exist,
  // so coerce using CAST; but D1 SQLite cannot cast gracefully: we'll try to read max as integer ignoring nulls
  // Assume existing kode_barang stored as numeric strings (padded). We'll fetch MAX(CAST(kode_barang AS INTEGER))
  let nextNum = 1;
  try {
    // Attempt to get numeric max; if no rows, result may be undefined
    const maxRow = await db.prepare("SELECT MAX(CAST(kode_barang AS INTEGER)) AS maxcode FROM barang").first();
    if (maxRow && maxRow.maxcode !== null && !isNaN(Number(maxRow.maxcode))) {
      nextNum = Number(maxRow.maxcode) + 1;
    }
  } catch (e) {
    // fallback: count rows +1
    try {
      const c = await db.prepare("SELECT COUNT(1) AS c FROM barang").first();
      nextNum = (c && c.c) ? Number(c.c) + 1 : nextNum;
    } catch (_) { /* ignore */ }
  }

  const kode_barang = String(nextNum).padStart(5, "0");
  const now = new Date().toISOString();

  const insertSQL = `INSERT INTO barang (kode_barang, nama, harga_modal, harga, stock, kategori, foto, deskripsi, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    kode_barang,
    body.nama,
    body.harga_modal || 0,
    body.harga,
    body.stock || 0,
    body.kategori || "",
    body.foto || "",
    body.deskripsi || "",
    now
  ];

  const r = await db.prepare(insertSQL).bind(...params).all();
  // Note: D1 returns results for INSERT ... RETURNING if used; to be safe, fetch last inserted id:
  // D1 SQLite does not provide lastInsertRowId directly via API; we can re-query by kode_barang+created_at
  const inserted = await db.prepare("SELECT id FROM barang WHERE kode_barang = ? AND created_at = ? LIMIT 1")
    .bind(kode_barang, now).first();

  return new Response(JSON.stringify({ ok: true, id: inserted ? inserted.id : null, kode_barang }), { status: 201, headers: jsonHeaders() });
}

async function updateBarang(request, event) {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });

  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = Number(parts[2]);
  if (!id) return new Response(JSON.stringify({ error: "invalid id" }), { status: 400, headers: jsonHeaders() });

  const body = await safeJson(request);
  if (!body) return new Response(JSON.stringify({ error: "no payload" }), { status: 400, headers: jsonHeaders() });

  const allowed = ["nama","harga_modal","harga","stock","kategori","foto","deskripsi"];
  const setClauses = [];
  const vals = [];
  for (const k of allowed) {
    if (k in body) {
      setClauses.push(`${k} = ?`);
      vals.push(body[k]);
    }
  }
  if (setClauses.length === 0) {
    return new Response(JSON.stringify({ error: "no updatable fields" }), { status: 400, headers: jsonHeaders() });
  }
  vals.push(id);
  const sql = `UPDATE barang SET ${setClauses.join(", ")} WHERE id = ?`;
  await db.prepare(sql).bind(...vals).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
}

async function deleteBarang(request, event) {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });

  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = Number(parts[2]);
  if (!id) return new Response(JSON.stringify({ error: "invalid id" }), { status: 400, headers: jsonHeaders() });

  await db.prepare("DELETE FROM barang WHERE id = ?").bind(id).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders() });
}

async function listKategori(request, event) {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: "DB not bound" }), { status: 500, headers: jsonHeaders() });

  const res = await db.prepare("SELECT DISTINCT kategori FROM barang WHERE kategori != '' ORDER BY kategori").all();
  const list = (res && res.results) ? res.results.map(r => r.kategori) : [];
  return new Response(JSON.stringify({ categories: list }), { status: 200, headers: jsonHeaders() });
}

async function duckImageProxy(request, event) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  if (!q) return new Response(JSON.stringify({ image: "" }), { status: 200, headers: jsonHeaders() });

  const ddg = `https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(ddg, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
    const json = await r.json();
    if (json && json.results && json.results.length > 0) {
      return new Response(JSON.stringify({ image: json.results[0].image }), { status: 200, headers: jsonHeaders() });
    }
  } catch (e) {
    console.warn("duck fetch error", e);
  }
  return new Response(JSON.stringify({ image: "" }), { status: 200, headers: jsonHeaders() });
}

/* ---------- Utilities ---------- */
async function safeJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
     }
