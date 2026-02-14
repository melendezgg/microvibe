import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { h, type VNode } from "preact";
import render from "preact-render-to-string";
import { selectApiHandler } from "./api";
import { getFileVersion, loadVersionedModule } from "./module-loader";
import {
  type RouteParamRules,
  type RouteParamsValidator,
  validateRouteParams,
} from "./route-params";
import { resolveModule } from "./router";

type RouteContext = {
  req: http.IncomingMessage;
  url: URL;
  params: Record<string, string>;
};

type RouteModule = {
  default: (ctx: RouteContext & { children?: VNode }) => VNode | string;
  mode?: "server" | "client";
  params?: RouteParamRules;
  validateParams?: RouteParamsValidator;
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

const routeBundleCache = new Map<string, { version: string; code: string }>();

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveAppWrapper() {
  const appJsx = path.join(routesDir, "_app.jsx");
  if (await fileExists(appJsx)) return { file: appJsx };
  const appJs = path.join(routesDir, "_app.js");
  if (await fileExists(appJs)) return { file: appJs };
  return null;
}

async function bundleRouteModule(filePath: string) {
  const version = await getFileVersion(filePath);
  const cached = routeBundleCache.get(filePath);
  if (cached && cached.version === version) return { code: cached.code, version };

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
  routeBundleCache.set(filePath, { version, code: output });
  return { code: output, version };
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

function writeApiError(
  res: http.ServerResponse,
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>
) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...(headers || {}),
  });
  res.end(JSON.stringify({ ok: false, code, error: message }));
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
  const apiPath = url.pathname.replace(/^\/api/, "") || "/";
  const resolved = await resolveModule(apiDir, apiPath, [".js"]);

  if (!resolved) {
    writeApiError(res, 404, "API_ROUTE_NOT_FOUND", "API route not found");
    return;
  }

  try {
    const loaded = await loadVersionedModule<ApiModule>(resolved.file);
    const mod = loaded.mod;
    const method = (req.method || "GET").toUpperCase();
    const selected = selectApiHandler(mod, method);

    if (typeof selected.handler !== "function") {
      const allow = selected.allow.length > 0 ? selected.allow.join(", ") : "GET";
      writeApiError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed", { Allow: allow });
      return;
    }

    const result = await selected.handler({
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message === "Body too large" || message.includes("JSON") ? "BAD_REQUEST" : "INTERNAL_ERROR";
    const status = code === "BAD_REQUEST" ? 400 : 500;
    writeApiError(res, status, code, message);
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
      const bundled = await bundleRouteModule(absolutePath);
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end(bundled.code);
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

    const routeLoaded = await loadVersionedModule<RouteModule>(resolved.file);
    const routeMod = routeLoaded.mod;
    if (typeof routeMod.default !== "function") {
      throw new Error(`Route ${resolved.file} must export default component`);
    }

    const paramCheck = validateRouteParams(resolved.params, routeMod.params, routeMod.validateParams);
    if (!paramCheck.ok) {
      res.writeHead(paramCheck.status, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html><body><h1>${paramCheck.status}</h1><p>${paramCheck.error}</p></body></html>`);
      return;
    }

    const ctx: RouteContext = { req, url, params: resolved.params };
    let vnode = h(routeMod.default, ctx);
    const routeMode = routeMod.mode || "server";

    const app = await resolveAppWrapper();
    if (app) {
      const appLoaded = await loadVersionedModule<RouteModule>(app.file);
      const appMod = appLoaded.mod;
      if (typeof appMod.default === "function") {
        const routeFile = path.relative(routesDir, resolved.file).replace(/\\/g, "/");
        const routeRuntime =
          routeMode === "client"
            ? {
                mode: "client",
                moduleUrl: `/__route_module?file=${encodeURIComponent(routeFile)}&v=${encodeURIComponent(routeLoaded.version)}`,
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
