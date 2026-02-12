#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.join(__dirname, "..", "template");
const runtimeServerPath = path.join(__dirname, "..", "..", "microvibe", "src", "server.tsx");
const targetName = process.argv[2] || "my-app";
const targetDir = path.resolve(process.cwd(), targetName);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  if (await exists(targetDir)) {
    const current = await fs.readdir(targetDir);
    if (current.length > 0) {
      console.error(`Target directory is not empty: ${targetDir}`);
      process.exit(1);
    }
  }

  await copyDir(templateDir, targetDir);

  if (!(await exists(runtimeServerPath))) {
    throw new Error(`Runtime server source not found: ${runtimeServerPath}`);
  }

  const serverSource = await fs.readFile(runtimeServerPath, "utf8");
  const serverTargetPath = path.join(targetDir, "server.tsx");
  await fs.writeFile(serverTargetPath, serverSource, "utf8");

  const packageJsonPath = path.join(targetDir, "package.json");
  const raw = await fs.readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  pkg.name = targetName;
  await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  console.log(`MicroVibe app created at: ${targetDir}`);
  console.log("Next:");
  console.log(`  cd ${targetName}`);
  console.log("  npm install");
  console.log("  npm run dev");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
