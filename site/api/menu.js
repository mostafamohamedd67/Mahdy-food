/* GET  /api/menu  → the live menu (public)
   PUT  /api/menu  → replace the live menu (password required)

   Storage is a single JSON blob. No database, nothing that sleeps or expires.
   If the blob has never been written, we serve the seed file that ships with
   the site, so a fresh deploy already shows a complete menu. */

import { put, list } from "@vercel/blob";
import { readFile } from "node:fs/promises";
import path from "node:path";

const BLOB_KEY = "menu.json";

async function readSeed() {
  const file = path.join(process.cwd(), "data", "menu.json");
  return JSON.parse(await readFile(file, "utf8"));
}

async function readLive() {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    const hit = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!hit) return null;
    const res = await fetch(hit.url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("blob read failed", err);
    return null;
  }
}

function authorized(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const given = req.headers["x-admin-password"];
  if (typeof given !== "string" || given.length !== expected.length) return false;
  // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function isValidMenu(body) {
  return (
    body &&
    typeof body === "object" &&
    Array.isArray(body.items) &&
    Array.isArray(body.daily) &&
    Array.isArray(body.categories) &&
    body.settings &&
    typeof body.settings === "object"
  );
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const live = await readLive();
    const data = live || (await readSeed());
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=300");
    return res.status(200).json(data);
  }

  if (req.method === "PUT") {
    if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!isValidMenu(body)) return res.status(400).json({ error: "malformed menu" });

    body.updatedAt = new Date().toISOString();
    await put(BLOB_KEY, JSON.stringify(body, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return res.status(200).json({ ok: true, updatedAt: body.updatedAt });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "method not allowed" });
}
