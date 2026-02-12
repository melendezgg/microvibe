import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { h, type VNode } from "preact";
import render from "preact-render-to-string";

type RouteContext = {
  req: http.IncomingMessage;
  url: URL;
  params: Record<string, string>;
};

type RouteModule = {
  default: (ctx: RouteContext & { children?: VNode }) => VNode | string;
  mode?: "server" | "client";
};

type ApiContext = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  params: Record<string, string>;
  json: (status: number, payload: unknown) => void;
  readJsonBody: (maxBytes?: number) => Promise<Record<string, unknown>>;
};

type ApiHandler = (ctx: ApiContext) => unknown | Promise<unknown>;

type ApiModule = {
  default?: ApiHandler;
  GET?: ApiHandler;
  POST?: ApiHandler;
  PUT?: ApiHandler;
  PATCH?: ApiHandler;
  DELETE?: ApiHandler;
};

type ResolvedModule = {
  file: string;
  params: Record<string, string>;
};

const root = process.cwd();
const routesDir = path.join(root, "routes");
const apiDir = path.join(root, "api");
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 3020);
const host = process.env.HOST || "127.0.0.1";

const contentType: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function normalizePath(urlPath: string) {
  return urlPath.split("?")[0].replace(/\/+$/, "") || "/";
}

function toParts(urlPath: string) {
  const normalized = normalizePath(urlPath);
  if (normalized === "/") return [];
  return normalized.slice(1).split("/").map(decodeURIComponent);
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveFileFromBase(basePath: string, exts: string[]): Promise<ResolvedModule | null> {
  for (const ext of exts) {
    const file = `${basePath}${ext}`;
    if (await fileExists(file)) return { file, params: {} };
  }
  return null;
}

async function resolveExact(baseDir: string, parts: string[], exts: string[]) {
  if (parts.length === 0) return resolveFileFromBase(path.join(baseDir, "index"), exts);
  const direct = await resolveFileFromBase(path.join(baseDir, ...parts), exts);
  if (direct) return direct;
  return resolveFileFromBase(path.join(baseDir, ...parts, "index"), exts);
}

async function resolveDynamic(
  dir: string,
  parts: string[],
  params: Record<string, string>,
  exts: string[]
): Promise<ResolvedModule | null> {
  if (parts.length === 0) {
    const index = await resolveFileFromBase(path.join(dir, "index"), exts);
    if (index) return { ...index, params };
    return null;
  }

  const [segment, ...rest] = parts;

  if (rest.length === 0) {
    const directFile = await resolveFileFromBase(path.join(dir, segment), exts);
    if (directFile) return { ...directFile, params };
  }

  const exactDir = path.join(dir, segment);
  try {
    const stat = await fs.stat(exactDir);
    if (stat.isDirectory()) {
      const resolved = await resolveDynamic(exactDir, rest, params, exts);
      if (resolved) return resolved;
    }
  } catch {
    // ignore
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });

  if (rest.length === 0) {
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const match = entry.name.match(/^\[([^\]]+)\](\.[a-z]+)$/);
      if (!match) continue;
      if (!exts.includes(match[2])) continue;
      return { file: path.join(dir, entry.name), params: { ...params, [match[1]]: segment } };
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^\[([^\]]+)\]$/);
    if (!match) continue;
    const resolved = await resolveDynamic(path.join(dir, entry.name), rest, {
      ...params,
      [match[1]]: segment,
    }, exts);
    if (resolved) return resolved;
  }

  return null;
}

async function resolveModule(baseDir: string, urlPath: string, exts: string[]): Promise<ResolvedModule | null> {
  const parts = toParts(urlPath);
  const exact = await resolveExact(baseDir, parts, exts);
  if (exact) return exact;
  return resolveDynamic(baseDir, parts, {}, exts);
}

async function resolveAppWrapper() {
  const appJsx = path.join(routesDir, "_app.jsx");
  if (await fileExists(appJsx)) return { file: appJsx };
  const appJs = path.join(routesDir, "_app.js");
  if (await fileExists(appJs)) return { file: appJs };
  return null;
}

async function bundleRouteModule(filePath: string) {
  const importPath = filePath.split(path.sep).join(path.posix.sep);
  const result = await build({
    stdin: {
      contents: `
        import { h, hydrate } from "preact";
        import Page from ${JSON.stringify(importPath)};
        export default function mount(node, props) {
          hydrate(h(Page, props || {}), node);
        }
      `,
      resolveDir: root,
      sourcefile: "route-client-entry.js",
      loader: "js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    target: "es2020",
    jsx: "transform",
    jsxFactory: "h",
    jsxFragment: "Fragment",
    loader: { ".js": "jsx", ".jsx": "jsx" },
  });

  const output = result.outputFiles?.[0]?.text;
  if (!output) throw new Error("No output generated for route module");
  return output;
}

async function serveStatic(urlPath: string, res: http.ServerResponse) {
  const filePath = path.join(publicDir, urlPath.replace(/^\//, ""));
  if (!filePath.startsWith(publicDir)) return false;

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": contentType[ext] || "application/octet-stream" });
    res.end(await fs.readFile(filePath));
    return true;
  } catch {
    return false;
  }
}

function writeJson(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: http.IncomingMessage, maxBytes = 1_000_000) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bufferChunk.length;
    if (size > maxBytes) throw new Error("Body too large");
    chunks.push(bufferChunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const apiPath = normalizePath(url.pathname.replace(/^\/api/, "")) || "/";
  const resolved = await resolveModule(apiDir, apiPath, [".js"]);

  if (!resolved) {
    writeJson(res, 404, { ok: false, error: "API route not found" });
    return;
  }

  const mod = (await import(pathToFileURL(resolved.file).href + `?t=${Date.now()}`)) as ApiModule;
  const method = (req.method || "GET").toUpperCase() as keyof ApiModule;
  const handler = mod[method] || mod.default;

  if (typeof handler !== "function") {
    writeJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const result = await handler({
    req,
    res,
    url,
    params: resolved.params,
    json: (status, payload) => writeJson(res, status, payload),
    readJsonBody: (maxBytes) => readJsonBody(req, maxBytes),
  });

  if (!res.writableEnded && result !== undefined) {
    writeJson(res, 200, result);
  } else if (!res.writableEnded) {
    res.writeHead(204);
    res.end();
  }
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  if (url.pathname === "/__route_module") {
    const routeFile = url.searchParams.get("file");
    if (!routeFile) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Missing route file");
      return;
    }

    const absolutePath = path.resolve(routesDir, routeFile);
    if (!absolutePath.startsWith(routesDir)) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Invalid route file");
      return;
    }

    if (!absolutePath.endsWith(".jsx") && !absolutePath.endsWith(".js")) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Invalid route extension");
      return;
    }

    if (!(await fileExists(absolutePath))) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Route file not found");
      return;
    }

    try {
      const code = await bundleRouteModule(absolutePath);
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end(code);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Route module build error: ${String(error)}`);
    }
    return;
  }

  if (await serveStatic(url.pathname, res)) return;

  try {
    const resolved = await resolveModule(routesDir, url.pathname, [".jsx", ".js"]);
    if (!resolved) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html><body><h1>404</h1><p>Route not found: <code>${url.pathname}</code></p></body></html>`);
      return;
    }

    const routeMod = (await import(pathToFileURL(resolved.file).href + `?t=${Date.now()}`)) as RouteModule;
    if (typeof routeMod.default !== "function") {
      throw new Error(`Route ${resolved.file} must export default component`);
    }

    const ctx: RouteContext = { req, url, params: resolved.params };
    let vnode = h(routeMod.default, ctx);
    const routeMode = routeMod.mode || "server";

    const app = await resolveAppWrapper();
    if (app) {
      const appMod = (await import(pathToFileURL(app.file).href + `?t=${Date.now()}`)) as RouteModule;
      if (typeof appMod.default === "function") {
        const routeFile = path.relative(routesDir, resolved.file).replace(/\\/g, "/");
        const routeRuntime =
          routeMode === "client"
            ? {
                mode: "client",
                moduleUrl: `/__route_module?file=${encodeURIComponent(routeFile)}&t=${Date.now()}`,
                props: {
                  params: resolved.params,
                  url: { pathname: url.pathname, search: url.search },
                },
              }
            : null;
        vnode = h(appMod.default, { ...ctx, children: vnode, routeRuntime });
      }
    }

    const html = "<!doctype html>\n" + render(vnode as Parameters<typeof render>[0]);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html><body><h1>Route Error</h1><p>${String(error)}</p></body></html>`);
  }
}

http.createServer(handle).listen(port, host, () => {
  console.log(`microvibe on http://${host}:${port}`);
  console.log("Create a JSX file in routes/ to add a route.");
});
