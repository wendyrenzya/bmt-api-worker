/**
 * BMT API WORKER (Final + Upload Foto)
 * Semua endpoint lama TIDAK diubah. Hanya ditambah:
 * POST /api/upload  → Upload foto via imgbb (pakai env.IMG_BB_KEY)
 */

export default {
  async fetch(request, env, ctx) {

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ------------------------
    // ROUTER ASLI KAMU (dipertahankan)
    // ------------------------

    // LIST BARANG
    if (path === "/api/barang" && method === "GET") {
      return getAllBarang(env, url);
    }

    // DETAIL BARANG
    if (path.startsWith("/api/barang/") && method === "GET") {
      const id = path.split("/")[3];
      return getBarangById(env, id);
    }

    // NEW DETAIL ?id=
    if (path === "/api/barang" && method === "GET" && url.searchParams.has("id")) {
      const id = url.searchParams.get("id");
      return getBarangById(env, id);
    }

    // TAMBAH BARANG
    if (path === "/api/barang" && method === "POST") {
      return createBarang(env, request);
    }

    // UPDATE BARANG
    if (path === "/api/barang" && method === "PUT") {
      const id = url.searchParams.get("id");
      return updateBarang(env, request, id);
    }

    // DELETE BARANG
    if (path === "/api/barang" && method === "DELETE") {
      const id = url.searchParams.get("id");
      return deleteBarang(env, id);
    }

    // LIST KATEGORI
    if (path === "/api/kategori" && method === "GET") {
      return getKategori(env);
    }

    // DUCKIMG
    if (path.startsWith("/api/duckimg")) {
      const q = url.searchParams.get("q") || "";
      return duckImg(q);
    }

    // ======================================================
    // 🟦  UPLOAD FOTO (FITUR TAMBAHAN, AMAN)  
    // ======================================================
    if (path === "/api/upload" && method === "POST") {
      return uploadFoto(env, request);
    }

    // FALLBACK
    return new Response("Not Found", { status: 404 });
  },
};

// ======================================================
// FUNCTION-FUNCTION ASLI (TIDAK DIUBAH)
// ======================================================

async function getAllBarang(env, url) {
  const { results } = await env.BMT_DB.prepare(
    "SELECT * FROM barang ORDER BY id DESC"
  ).all();

  return json({ items: results });
}

async function getBarangById(env, id) {
  const { results } = await env.BMT_DB.prepare(
    "SELECT * FROM barang WHERE id = ?"
  ).bind(id).all();

  return json({ item: results[0] || null });
}

async function createBarang(env, request) {
  const body = await request.json();

  const kode = await generateKode(env);

  await env.BMT_DB.prepare(
    `INSERT INTO barang (kode_barang, nama, kategori, harga, harga_modal, stock, foto, deskripsi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      kode,
      body.nama,
      body.kategori,
      body.harga,
      body.harga_modal,
      0,
      body.foto,
      body.deskripsi
    )
    .run();

  return json({ ok: true, kode_barang: kode });
}

async function updateBarang(env, request, id) {
  const body = await request.json();

  await env.BMT_DB.prepare(
    `UPDATE barang
     SET nama = ?, kategori = ?, harga = ?, harga_modal = ?, foto = ?, deskripsi = ?
     WHERE id = ?`
  )
    .bind(
      body.nama,
      body.kategori,
      body.harga,
      body.harga_modal,
      body.foto,
      body.deskripsi,
      id
    )
    .run();

  return json({ ok: true });
}

async function deleteBarang(env, id) {
  await env.BMT_DB.prepare(`DELETE FROM barang WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

async function getKategori(env) {
  const { results } = await env.BMT_DB.prepare("SELECT * FROM kategori").all();
  return json({ items: results });
}

// Kode Barang Auto Numeric
async function generateKode(env) {
  const row = await env.BMT_DB.prepare(
    "SELECT kode_barang FROM barang ORDER BY id DESC LIMIT 1"
  ).all();

  let next = 1;
  if (row.results.length > 0) {
    next = Number(row.results[0].kode_barang) + 1;
  }

  return String(next).padStart(5, "0");
}

// DuckDuckGo image proxy
async function duckImg(q) {
  const res = await fetch(
    "https://api.duckduckgo.com/?q=" + encodeURIComponent(q) + "&format=json"
  );
  const data = await res.json();
  return json(data);
}

// JSON Helper
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ======================================================
// 🟦 FITUR BARU: UPLOAD FOTO via IMGBB (AMAN)
// ======================================================

async function uploadFoto(env, request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!file) return json({ error: "No file" }, 400);

  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  const uploadURL =
    "https://api.imgbb.com/1/upload?key=" + env.IMG_BB_KEY;

  const body = new URLSearchParams();
  body.append("image", base64);

  const res = await fetch(uploadURL, {
    method: "POST",
    body,
  });

  const data = await res.json();
  return json(data);
    }
