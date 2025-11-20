/**
 * worker.js
 * Minimal Cloudflare Worker API for BMT tester
 *
 * Expected bindings:
 * - BMT_DB   : D1 database binding
 * - IMG_BB_KEY (optional) : API key for imgbb (if you want image upload)
 *
 * Routes:
 * GET  /                -> health
 * POST /login           -> body { username, password }
 * GET  /barang          -> list barang (SELECT * FROM barang)
 * POST /upload          -> multipart/form-data or JSON { imageBase64 } -> uploads to imgbb if IMG_BB_KEY present
 *
 * CORS: permissive for tester pages (adjust origin if you want).
 */

const DOMAIN_SUFFIX = "@bigmotor.biz.id";

// CORS headers (permissive for testing)
function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

function jsonResponse(data, status = 200, request = null) {
  const headers = {
    ...((request && corsHeaders(request)) || { "Access-Control-Allow-Origin": "*" }),
    "Content-Type": "application/json; charset=utf-8",
  };
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

function textResponse(text, status = 200, request = null) {
  const headers = {
    ...((request && corsHeaders(request)) || { "Access-Control-Allow-Origin": "*" }),
    "Content-Type": "text/plain; charset=utf-8",
  };
  return new Response(text, { status, headers });
}

async function handleOptions(request) {
  // reply to preflight quickly
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function ensureUsernameSuffix(username) {
  if (!username) return username;
  if (username.includes("@")) return username; // assume full
  return username + DOMAIN_SUFFIX;
}

function makeToken() {
  // simple random token (not jwt). Good enough for tester.
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

/** Helper: run paramaterized D1 SQL and return rows */
async function d1Query(env, sql, params = []) {
  // env.BMT_DB must exist
  if (!env.BMT_DB) throw new Error("D1 binding 'BMT_DB' not found in environment");
  const res = await env.BMT_DB.prepare(sql).bind(...params).all();
  // .all() returns { results: [ ... ] } depending on runtime; handle both forms
  if (res && Array.isArray(res.results)) return res.results;
  if (res && Array.isArray(res)) return res;
  // fallback
  return res;
}

/** ROUTES */
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/"; // normalize trailing slash
      console.log(`[worker] ${request.method} ${path}`);

      if (request.method === "OPTIONS") return handleOptions(request);

      // Root / health
      if (request.method === "GET" && path === "/") {
        return jsonResponse({ status: "ok", message: "BMT API Worker running" }, 200, request);
      }

      // LOGIN - POST /login
      if (request.method === "POST" && path === "/login") {
        const contentType = request.headers.get("content-type") || "";
        let body = {};
        if (contentType.includes("application/json")) {
          body = await request.json();
        } else {
          // fallback to form data
          const form = await request.formData();
          for (const [k, v] of form.entries()) body[k] = v;
        }
        const rawUsername = (body.username || "").toString().trim();
        const username = ensureUsernameSuffix(rawUsername);
        const password = (body.password || "").toString();

        console.log(`[login] attempted username=${username}`);

        if (!username || !password) {
          return jsonResponse({ ok: false, error: "username and password required" }, 400, request);
        }

        // query users table
        try {
          const rows = await d1Query(env, "SELECT id, username FROM users WHERE username = ? AND password = ? LIMIT 1", [username, password]);
          if (!rows || rows.length === 0) {
            return jsonResponse({ ok: false, error: "invalid credentials" }, 401, request);
          }
          const user = rows[0];
          // make a token (not persisted)
          const token = makeToken();
          // return user summary and token
          return jsonResponse({ ok: true, user: { id: user.id, username: user.username }, token }, 200, request);
        } catch (err) {
          console.error("[login] d1 error:", err);
          return jsonResponse({ ok: false, error: "server error (d1)" }, 500, request);
        }
      }

      // GET /barang - list barang
      if (request.method === "GET" && path === "/barang") {
        try {
          const rows = await d1Query(env, "SELECT id, kode_barang, nama, harga, stock, foto FROM barang ORDER BY id DESC LIMIT 200");
          // normalize foto to empty string if null
          const normalized = (rows || []).map(r => ({
            id: r.id,
            kode_barang: r.kode_barang,
            nama: r.nama,
            harga: r.harga,
            stock: r.stock,
            foto: r.foto || "",
          }));
          return jsonResponse({ ok: true, data: normalized }, 200, request);
        } catch (err) {
          console.error("[barang] d1 error:", err);
          return jsonResponse({ ok: false, error: "server error (d1)" }, 500, request);
        }
      }

      // POST /upload - expects form-data file (key: file) OR JSON { imageBase64 }
      if (request.method === "POST" && path === "/upload") {
        // require IMG_BB_KEY to actually upload
        const imgbbKey = env.IMG_BB_KEY || null;
        if (!imgbbKey) {
          return jsonResponse({ ok: false, error: "IMG_BB_KEY not configured on worker" }, 400, request);
        }

        const contentType = request.headers.get("content-type") || "";
        let base64 = null;

        if (contentType.includes("multipart/form-data")) {
          // parse file from formdata
          const form = await request.formData();
          const file = form.get("file") || form.get("image");
          if (!file) return jsonResponse({ ok: false, error: "no file field (use 'file' or 'image')" }, 400, request);
          // file is a File object; convert to ArrayBuffer then base64
          const ab = await file.arrayBuffer();
          base64 = Buffer.from(ab).toString("base64");
        } else {
          // JSON
          const body = await request.json().catch(() => ({}));
          if (body.imageBase64) base64 = body.imageBase64;
          if (body.imageUrl) {
            // fetch the image and convert
            const r = await fetch(body.imageUrl);
            const ab = await r.arrayBuffer();
            base64 = Buffer.from(ab).toString("base64");
          }
        }

        if (!base64) return jsonResponse({ ok: false, error: "no image data found" }, 400, request);

        // upload to imgbb
        try {
          const form = new FormData();
          form.append("key", imgbbKey);
          form.append("image", base64);

          const upl = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            body: form,
          });

          const j = await upl.json();
          if (!j || !j.data || !j.data.url) {
            console.error("[upload] imgbb response:", j);
            return jsonResponse({ ok: false, error: "upload failed", raw: j }, 500, request);
          }

          return jsonResponse({ ok: true, url: j.data.url, thumb: j.data.thumb?.url || null }, 200, request);
        } catch (err) {
          console.error("[upload] err:", err);
          return jsonResponse({ ok: false, error: "upload error" }, 500, request);
        }
      }

      // fallback 404
      return jsonResponse({ ok: false, error: "not found", path }, 404, request);
    } catch (err) {
      console.error("[worker] uncaught:", err);
      return jsonResponse({ ok: false, error: "internal error", message: err.message }, 500, request);
    }
  }
};
