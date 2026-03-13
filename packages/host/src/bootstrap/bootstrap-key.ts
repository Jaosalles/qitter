import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { HostMode } from "./cli";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function loadOrCreateBootstrapKey(mode: HostMode): Promise<string | undefined> {
  const keyPath = resolve(process.cwd(), "qitter.key");

  if (mode === "join") {
    if (!existsSync(keyPath)) {
      throw new Error("qitter.key not found. Run `bun run start` first.");
    }

    const key = (await readFile(keyPath, "utf-8")).trim();
    if (key.length !== 64) {
      throw new Error("Invalid qitter.key content.");
    }

    return key;
  }

  if (!existsSync(keyPath)) {
    return undefined;
  }

  const existingKey = (await readFile(keyPath, "utf-8")).trim();
  return existingKey.length === 64 ? existingKey : undefined;
}

export async function writeBootstrapKeyIfMissing(baseKey: string): Promise<void> {
  const keyPath = resolve(process.cwd(), "qitter.key");
  if (existsSync(keyPath)) {
    return;
  }

  await writeFile(keyPath, `${baseKey}\n`, "utf-8");
  console.log(`[host] wrote bootstrap key to ${keyPath}`);
}
