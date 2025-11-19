export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-User",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    };
    if (request.method === "OPTIONS") {
      return new Response("OK", { headers: corsHeaders });
    }

    // ---- ROUTES ----
    if (path === "/" && request.method === "GET") {
      return json({ ok: true, message: "BMT API OK" });
    }

    if (path === "/auth/login" && request.method === "POST") {
      return handleLogin(request, env);
    }

    // 404 fallback
    return json({ ok: false, error: "not found", path }, 404);
  }
};

// ------------------
// Helpers
// ------------------
async function handleLogin(request, env) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.username || !body.password) {
      return json({ ok: false, error: "username & password required" }, 400);
    }

    const { username, password } = body;

    // Check user in D1
    const result = await env.DB.prepare(
      `SELECT id, username, password, role FROM users WHERE username = ?`
    ).bind(username).first();

    if (!result) {
      return json({ ok: false, error: "user not found" }, 404);
    }

    if (result.password !== password) {
      return json({ ok: false, error: "wrong password" }, 401);
    }

    return json({
      ok: true,
      message: "login success",
      user: {
        id: result.id,
        username: result.username,
        role: result.role,
      }
    });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

// Response helper
function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    }
  });
      }
