import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const banned = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "unpkg.com", "googletagmanager", "tile.openstreetmap"];
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".venv" || name === "data") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.(tsx?|css|html|mjs|json)$/.test(name)) continue;
    const text = readFileSync(path, "utf8");
    for (const host of banned) {
      if (text.includes(host)) hits.push(`${path}: ${host}`);
    }
  }
}

walk(join(root, "apps/web/src"));
walk(join(root, "apps/web/public"));
if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log("offline check: no banned hosts in web source");
