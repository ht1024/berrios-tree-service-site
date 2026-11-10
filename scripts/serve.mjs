import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};

function resolveInsideRoot(pathname) {
  const rel = decodeURIComponent(pathname.split("?")[0]).replace(/^\/+/, "");
  const abs = path.resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function fileFor(pathname) {
  const clean = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const exact = resolveInsideRoot(clean);
  if (!exact) return null;
  if (await isFile(exact)) return exact;
  const index = path.join(exact, "index.html");
  if (await isFile(index)) return index;
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const file = await fileFor(url.pathname);
    if (!file) {
      const body = await readFile(path.join(ROOT, "404.html"));
      res.writeHead(404, { "content-type": TYPES[".html"] });
      res.end(body);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "content-type": TYPES[ext] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error.message);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${PORT}`);
});
