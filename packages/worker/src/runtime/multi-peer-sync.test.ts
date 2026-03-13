import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Autobase from "autobase";
import Corestore from "corestore";
import HyperDB, { type HyperDBInstance } from "hyperdb";
import Hyperswarm from "hyperswarm";
import { afterEach, describe, expect, it } from "vitest";
import def from "../spec/hyperdb/index.js";
import type { Operation } from "../types";
import { applyOperations } from "./apply-operations";
import { listAllPostsFromBase } from "./read-model";

function openView(store: Corestore): HyperDBInstance {
  return HyperDB.bee(store.get("qitter-view"), def, { autoUpdate: true });
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 50,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms waiting for replication.`);
}

describe("multi-peer synchronization", () => {
  const cleanupDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanupDirs.splice(0, cleanupDirs.length).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
      }),
    );
  });

  it("replicates post operations from peer A to peer B", async () => {
    const dirA = join(
      tmpdir(),
      `qitter-peer-a-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const dirB = join(
      tmpdir(),
      `qitter-peer-b-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    cleanupDirs.push(dirA, dirB);

    const storeA = new Corestore(dirA);
    const baseA = new Autobase<Operation, HyperDBInstance>(storeA, null, {
      valueEncoding: "json",
      optimistic: true,
      ackInterval: 100,
      open: openView,
      apply: async (nodes, view, host) => {
        await applyOperations(nodes, view, host);
      },
    });
    await baseA.ready();

    const storeB = new Corestore(dirB);
    const baseB = new Autobase<Operation, HyperDBInstance>(storeB, baseA.key, {
      valueEncoding: "json",
      optimistic: true,
      ackInterval: 100,
      open: openView,
      apply: async (nodes, view, host) => {
        await applyOperations(nodes, view, host);
      },
    });
    await baseB.ready();

    const topic = randomBytes(32);
    const swarmA = new Hyperswarm();
    const swarmB = new Hyperswarm();

    swarmA.join(topic, { client: true, server: true });
    swarmA.join(baseA.discoveryKey, { client: true, server: true });
    swarmB.join(topic, { client: true, server: true });
    swarmB.join(baseB.discoveryKey, { client: true, server: true });

    swarmA.on("connection", (connection) => {
      storeA.replicate(connection);
    });
    swarmB.on("connection", (connection) => {
      storeB.replicate(connection);
    });

    try {
      await baseA.append(
        {
          type: "post",
          id: "peer-sync-1",
          author: "peer-a",
          body: "hello from peer a",
          createdAt: Date.now(),
        },
        { optimistic: true },
      );

      await waitFor(async () => {
        await baseB.update();
        const posts = await listAllPostsFromBase(baseB);
        return posts.some(
          (post) =>
            post.id === "peer-sync-1" && post.body === "hello from peer a",
        );
      }, 8000);

      const postsOnPeerB = await listAllPostsFromBase(baseB);
      expect(postsOnPeerB.some((post) => post.id === "peer-sync-1")).toBe(true);
    } finally {
      await swarmA.destroy();
      await swarmB.destroy();
      await storeA.close();
      await storeB.close();
    }
  }, 20000);
});
