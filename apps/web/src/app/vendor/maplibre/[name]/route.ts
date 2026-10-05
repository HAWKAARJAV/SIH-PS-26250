import { readFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED = new Set(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]);

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!ALLOWED.has(name)) {
    return new Response("Not found", { status: 404 });
  }
  const file = path.join(process.cwd(), "node_modules/maplibre-gl/dist", name);
  const body = await readFile(file);
  return new Response(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
