import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { resolveModule } from "../src/router";

async function withTempRoutes(
  setup: (routesDir: string) => Promise<void>,
  run: (routesDir: string) => Promise<void>
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "microvibe-router-"));
  const routesDir = path.join(root, "routes");
  await fs.mkdir(routesDir, { recursive: true });
  try {
    await setup(routesDir);
    await run(routesDir);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function writeRoute(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, "export default function Page(){return null;}\n");
}

test("prefers static route over dynamic route", async () => {
  await withTempRoutes(
    async (routesDir) => {
      await writeRoute(path.join(routesDir, "about.jsx"));
      await writeRoute(path.join(routesDir, "[slug].jsx"));
    },
    async (routesDir) => {
      const resolved = await resolveModule(routesDir, "/about", [".jsx"]);
      assert.ok(resolved);
      assert.equal(path.basename(resolved.file), "about.jsx");
      assert.deepEqual(resolved.params, {});
    }
  );
});

test("prefers single-segment dynamic route over catch-all route", async () => {
  await withTempRoutes(
    async (routesDir) => {
      await writeRoute(path.join(routesDir, "blog", "[id].jsx"));
      await writeRoute(path.join(routesDir, "blog", "[...slug].jsx"));
    },
    async (routesDir) => {
      const resolved = await resolveModule(routesDir, "/blog/hello", [".jsx"]);
      assert.ok(resolved);
      assert.equal(path.basename(resolved.file), "[id].jsx");
      assert.deepEqual(resolved.params, { id: "hello" });
    }
  );
});

test("matches required catch-all route", async () => {
  await withTempRoutes(
    async (routesDir) => {
      await writeRoute(path.join(routesDir, "docs", "[...slug].jsx"));
    },
    async (routesDir) => {
      const resolved = await resolveModule(routesDir, "/docs/guides/getting-started", [".jsx"]);
      assert.ok(resolved);
      assert.equal(path.basename(resolved.file), "[...slug].jsx");
      assert.deepEqual(resolved.params, { slug: "guides/getting-started" });
    }
  );
});

test("matches optional catch-all route with and without segments", async () => {
  await withTempRoutes(
    async (routesDir) => {
      await writeRoute(path.join(routesDir, "docs", "[[...slug]].jsx"));
    },
    async (routesDir) => {
      const empty = await resolveModule(routesDir, "/docs", [".jsx"]);
      assert.ok(empty);
      assert.equal(path.basename(empty.file), "[[...slug]].jsx");
      assert.deepEqual(empty.params, {});

      const withParts = await resolveModule(routesDir, "/docs/api/v1", [".jsx"]);
      assert.ok(withParts);
      assert.equal(path.basename(withParts.file), "[[...slug]].jsx");
      assert.deepEqual(withParts.params, { slug: "api/v1" });
    }
  );
});

test("prefers exact index route over optional catch-all on same prefix", async () => {
  await withTempRoutes(
    async (routesDir) => {
      await writeRoute(path.join(routesDir, "docs", "index.jsx"));
      await writeRoute(path.join(routesDir, "docs", "[[...slug]].jsx"));
    },
    async (routesDir) => {
      const resolved = await resolveModule(routesDir, "/docs", [".jsx"]);
      assert.ok(resolved);
      assert.equal(path.basename(resolved.file), "index.jsx");
      assert.deepEqual(resolved.params, {});
    }
  );
});

test("prefers static child route over dynamic child route", async () => {
  await withTempRoutes(
    async (routesDir) => {
      await writeRoute(path.join(routesDir, "users", "settings.jsx"));
      await writeRoute(path.join(routesDir, "users", "[id].jsx"));
    },
    async (routesDir) => {
      const resolved = await resolveModule(routesDir, "/users/settings", [".jsx"]);
      assert.ok(resolved);
      assert.equal(path.basename(resolved.file), "settings.jsx");
      assert.deepEqual(resolved.params, {});
    }
  );
});

test("ignores invalid route definitions where catch-all is not the last segment", async () => {
  await withTempRoutes(
    async (routesDir) => {
      await writeRoute(path.join(routesDir, "docs", "[...slug]", "edit.jsx"));
    },
    async (routesDir) => {
      const resolved = await resolveModule(routesDir, "/docs/a/edit", [".jsx"]);
      assert.equal(resolved, null);
    }
  );
});
