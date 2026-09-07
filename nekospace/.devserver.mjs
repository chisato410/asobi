import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

http
  .createServer((req, res) => {
    let p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    if (p.endsWith("/")) p = path.join(p, "index.html");
    fs.readFile(p, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found: " + p);
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(4791, "127.0.0.1", () => {
    console.log("nekospace dev server on http://127.0.0.1:4791");
  });
