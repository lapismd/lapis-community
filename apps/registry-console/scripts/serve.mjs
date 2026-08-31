import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^(?:index\.html|styles\.css|assets\/[a-z0-9-]+\.js)$/u.test(file)) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(new URL(`../dist/${file}`, import.meta.url));
    const contentType = file.endsWith(".js")
      ? "text/javascript; charset=utf-8"
      : file.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "text/html; charset=utf-8";
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Registry console listening on http://${host}:${port}`);
});
