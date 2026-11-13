#!/usr/bin/env node
// Tiny static server for the repo root (local preview of the GitHub Pages site).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let p = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!p.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  // Like GitHub Pages: a folder without its trailing slash redirects (/why -> /why/), then serves its index.html.
  const isDir = await stat(p).then((st) => st.isDirectory(), () => false);
  if (isDir && !url.pathname.endsWith("/")) {
    res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
    return;
  }
  if (isDir) p = path.join(p, "index.html");
  try {
    const body = await readFile(p);
    res.writeHead(200, { "content-type": TYPES[path.extname(p)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(PORT, () => console.log(`GameMoonshot preview: http://localhost:${PORT}/`));
