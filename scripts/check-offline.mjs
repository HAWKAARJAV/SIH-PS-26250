import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repo = join(root, "..");
const banned = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "unpkg.com", "googletagmanager", "tile.openstreetmap"];
const hits = [];

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".venv" || name === "data") continue;
    const path = join(dir, name);
    if (path.includes(`${sep}.next${sep}dev${sep}`) || path.includes(`${sep}.next${sep}dev`)) continue;
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (path.includes(`${sep}media${sep}`)) continue;
    if (!/\.(tsx?|css|html|mjs|js|json)$/.test(name)) continue;
    const text = readFileSync(path, "utf8");
    for (const host of banned) {
      if (text.includes(host)) hits.push(`${path}: ${host}`);
    }
  }
}

walk(join(repo, "apps/web/src"));
walk(join(repo, "apps/web/public"));
walk(join(repo, "apps/web/.next"));

if (hits.length) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log("offline check: no banned hosts in web source or build output");
