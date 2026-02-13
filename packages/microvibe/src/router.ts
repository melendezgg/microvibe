import { promises as fs } from "node:fs";
import path from "node:path";

export type ResolvedModule = {
  file: string;
  params: Record<string, string>;
};

type Segment =
  | { type: "static"; value: string }
  | { type: "dynamic"; key: string }
  | { type: "catchall"; key: string; optional: boolean };

type RouteCandidate = {
  file: string;
  segments: Segment[];
  sortKey: number[];
};

function normalizePath(urlPath: string) {
  return urlPath.split("?")[0].replace(/\/+$/, "") || "/";
}

function toParts(urlPath: string) {
  const normalized = normalizePath(urlPath);
  if (normalized === "/") return [];
  return normalized.slice(1).split("/").map(decodeURIComponent);
}

function toPosixPath(filePath: string) {
  return filePath.split(path.sep).join(path.posix.sep);
}

function parseSegment(raw: string): Segment {
  const optionalCatchAll = raw.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
  if (optionalCatchAll) return { type: "catchall", key: optionalCatchAll[1], optional: true };

  const catchAll = raw.match(/^\[\.\.\.([^\]]+)\]$/);
  if (catchAll) return { type: "catchall", key: catchAll[1], optional: false };

  const dynamic = raw.match(/^\[([^\]]+)\]$/);
  if (dynamic) return { type: "dynamic", key: dynamic[1] };

  return { type: "static", value: raw };
}

function scoreForSegment(segment: Segment) {
  if (segment.type === "static") return 40;
  if (segment.type === "dynamic") return 30;
  return segment.optional ? 10 : 20;
}

function compareCandidates(a: RouteCandidate, b: RouteCandidate) {
  const maxLen = Math.max(a.sortKey.length, b.sortKey.length);
  for (let i = 0; i < maxLen; i += 1) {
    const av = a.sortKey[i] ?? -1;
    const bv = b.sortKey[i] ?? -1;
    if (av !== bv) return bv - av;
  }
  const aPath = toPosixPath(a.file);
  const bPath = toPosixPath(b.file);
  return aPath.localeCompare(bPath);
}

function parseRouteSegments(relativeWithoutExt: string) {
  const rawParts = toPosixPath(relativeWithoutExt).split("/").filter(Boolean);
  const parts = rawParts[rawParts.length - 1] === "index" ? rawParts.slice(0, -1) : rawParts;
  const segments = parts.map(parseSegment);

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.type === "catchall" && i !== segments.length - 1) return null;
  }

  return segments;
}

async function walkRouteFiles(baseDir: string, exts: string[]) {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!exts.includes(path.extname(entry.name))) continue;
      files.push(fullPath);
    }
  }

  try {
    await walk(baseDir);
  } catch {
    return [];
  }

  return files;
}

function matchSegments(segments: Segment[], pathParts: string[]) {
  const params: Record<string, string> = {};
  let routeIndex = 0;
  let pathIndex = 0;

  while (routeIndex < segments.length) {
    const segment = segments[routeIndex];

    if (segment.type === "static") {
      if (pathParts[pathIndex] !== segment.value) return null;
      routeIndex += 1;
      pathIndex += 1;
      continue;
    }

    if (segment.type === "dynamic") {
      const part = pathParts[pathIndex];
      if (part === undefined) return null;
      params[segment.key] = part;
      routeIndex += 1;
      pathIndex += 1;
      continue;
    }

    const rest = pathParts.slice(pathIndex);
    if (!segment.optional && rest.length === 0) return null;
    if (rest.length > 0) params[segment.key] = rest.join("/");
    routeIndex = segments.length;
    pathIndex = pathParts.length;
  }

  if (pathIndex !== pathParts.length) return null;
  return params;
}

export async function resolveModule(baseDir: string, urlPath: string, exts: string[]): Promise<ResolvedModule | null> {
  const pathParts = toParts(urlPath);
  const files = await walkRouteFiles(baseDir, exts);

  const candidates: RouteCandidate[] = [];
  for (const file of files) {
    const rel = path.relative(baseDir, file);
    const withoutExt = rel.slice(0, -path.extname(rel).length);
    const segments = parseRouteSegments(withoutExt);
    if (!segments) continue;
    candidates.push({
      file,
      segments,
      sortKey: segments.map(scoreForSegment),
    });
  }

  candidates.sort(compareCandidates);

  for (const candidate of candidates) {
    const params = matchSegments(candidate.segments, pathParts);
    if (params) return { file: candidate.file, params };
  }

  return null;
}
