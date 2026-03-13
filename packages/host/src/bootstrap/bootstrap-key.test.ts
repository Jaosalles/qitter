import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadOrCreateBootstrapKey, writeBootstrapKeyIfMissing } from "./bootstrap-key";

const originalCwd = process.cwd();
const tempDirs: string[] = [];

async function withTempCwd(run: () => Promise<void>): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), "qitter-bootstrap-test-"));
  tempDirs.push(temp);
  process.chdir(temp);

  try {
    await run();
  } finally {
    process.chdir(originalCwd);
  }
}

afterEach(async () => {
  process.chdir(originalCwd);

  while (tempDirs.length > 0) {
    const next = tempDirs.pop();
    if (next) {
      await rm(next, { recursive: true, force: true });
    }
  }
});

describe("bootstrap-key", () => {
  it("returns undefined in bootstrap mode when key does not exist", async () => {
    await withTempCwd(async () => {
      await expect(loadOrCreateBootstrapKey("bootstrap")).resolves.toBeUndefined();
    });
  });

  it("throws in join mode when key is missing", async () => {
    await withTempCwd(async () => {
      await expect(loadOrCreateBootstrapKey("join")).rejects.toThrow("qitter.key not found");
    });
  });

  it("writes and loads bootstrap key", async () => {
    await withTempCwd(async () => {
      const key = "a".repeat(64);
      await writeBootstrapKeyIfMissing(key);

      const persisted = await readFile("qitter.key", "utf-8");
      expect(persisted.trim()).toBe(key);

      await expect(loadOrCreateBootstrapKey("join")).resolves.toBe(key);
    });
  });
});
