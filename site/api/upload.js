/* POST /api/upload?name=<filename>  → stores a dish photo, returns its public URL.
   Body is the raw image bytes. Password required. */

import { put } from "@vercel/blob";

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function authorized(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const given = req.headers["x-admin-password"];
  if (typeof given !== "string" || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });

  const type = (req.headers["content-type"] || "").split(";")[0].trim();
  const ext = ALLOWED[type];
  if (!ext) return res.status(415).json({ error: "only jpeg, png or webp" });

  const buf = await rawBody(req);
  if (!buf.length) return res.status(400).json({ error: "empty body" });
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: "max 8MB" });

  const stamp = Date.now().toString(36);
  const safe = String(req.query.name || "dish")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "dish";

  const blob = await put(`dishes/${safe}-${stamp}.${ext}`, buf, {
    access: "public",
    contentType: type,
    addRandomSuffix: false,
  });

  return res.status(200).json({ url: blob.url });
}
