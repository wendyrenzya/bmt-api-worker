// POST /upload - expects form-data or JSON
if (request.method === "POST" && path === "/upload") {

  const imgbbKey = env.IMG_BB_KEY || null;
  if (!imgbbKey) {
    return jsonResponse({ ok: false, error: "IMG_BB_KEY not configured on worker" }, 400, request);
  }

  const contentType = request.headers.get("content-type") || "";
  let base64 = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") || form.get("image");
    if (!file) return jsonResponse({ ok: false, error: "no file field" }, 400, request);

    const ab = await file.arrayBuffer();
    const uint8 = new Uint8Array(ab);
    base64 = btoa(String.fromCharCode(...uint8));

  } else {
    const body = await request.json().catch(() => ({}));

    if (body.imageBase64) base64 = body.imageBase64;

    if (body.imageUrl) {
      const r = await fetch(body.imageUrl);
      const ab = await r.arrayBuffer();
      const uint8 = new Uint8Array(ab);
      base64 = btoa(String.fromCharCode(...uint8));
    }
  }

  if (!base64) return jsonResponse({ ok: false, error: "no image data" }, 400, request);

  try {
    const fd = new FormData();
    fd.append("key", imgbbKey);
    fd.append("image", base64);

    const upl = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: fd
    });

    const j = await upl.json();
    if (!j?.data?.url) {
      console.log("[upload] imgbb raw:", j);
      return jsonResponse({ ok: false, error: "upload failed", raw: j }, 500, request);
    }

    return jsonResponse({
      ok: true,
      url: j.data.url,
      thumb: j.data.thumb?.url || null
    }, 200, request);

  } catch (err) {
    console.error("[upload] err:", err);
    return jsonResponse({ ok: false, error: "upload error", message: err.message }, 500, request);
  }
}
