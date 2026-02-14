import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { getFileVersion, loadVersionedModule } from "../src/module-loader";

async function createTempModule(initialCode: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "microvibe-loader-"));
  const file = path.join(root, "mod.mjs");
  await fs.writeFile(file, initialCode, "utf8");
  return { root, file };
}

test("loadVersionedModule invalidates cache when file changes", async () => {
  const temp = await createTempModule("export const value = 'one';\n");
  try {
    const first = await loadVersionedModule<{ value: string }>(temp.file);
    assert.equal(first.mod.value, "one");

    const nextMtime = new Date(Date.now() + 1100);
    await fs.writeFile(temp.file, "export const value = 'two';\n", "utf8");
    await fs.utimes(temp.file, nextMtime, nextMtime);

    const second = await loadVersionedModule<{ value: string }>(temp.file);
    assert.equal(second.mod.value, "two");
    assert.notEqual(second.version, first.version);
  } finally {
    await fs.rm(temp.root, { recursive: true, force: true });
  }
});

test("getFileVersion is stable when file does not change", async () => {
  const temp = await createTempModule("export const value = 1;\n");
  try {
    const v1 = await getFileVersion(temp.file);
    const v2 = await getFileVersion(temp.file);
    assert.equal(v1, v2);
  } finally {
    await fs.rm(temp.root, { recursive: true, force: true });
  }
});
