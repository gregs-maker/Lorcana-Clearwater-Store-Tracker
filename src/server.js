import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 4173);
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8" };

const server = http.createServer(async (req,res) => {
  let pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === "/") pathname = "/index.html";
  let file = pathname === "/data/stores.json" ? path.join(root, "data", "stores.json") : path.join(publicDir, pathname);
  if (!file.startsWith(publicDir) && pathname !== "/data/stores.json") { res.writeHead(403); return res.end("Forbidden"); }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control":"no-store" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
server.listen(port, () => console.log(`Lorcana Tier Tracker: http://localhost:${port}`));
