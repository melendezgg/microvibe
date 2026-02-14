import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";

type CachedModule = {
  version: string;
  mod: unknown;
};

function createVersionToken(mtimeMs: number, size: number) {
  return `${Math.trunc(mtimeMs)}-${size}`;
}

export async function getFileVersion(filePath: string) {
  const stat = await fs.stat(filePath);
  return createVersionToken(stat.mtimeMs, stat.size);
}

const moduleCache = new Map<string, CachedModule>();

export async function loadVersionedModule<T>(filePath: string): Promise<{ mod: T; version: string }> {
  const version = await getFileVersion(filePath);
  const cached = moduleCache.get(filePath);
  if (cached && cached.version === version) {
    return { mod: cached.mod as T, version };
  }

  const specifier = `${pathToFileURL(filePath).href}?v=${encodeURIComponent(version)}`;
  const mod = (await import(specifier)) as T;
  moduleCache.set(filePath, { version, mod });
  return { mod, version };
}
