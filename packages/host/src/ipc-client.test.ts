import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcClient } from "./ipc-client";

type SidecarLike = {
  handlers: Map<string, Array<(chunk: Buffer) => void>>;
  writes: string[];
  stderr: { on: ReturnType<typeof vi.fn> };
  kill: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  emitData: (payload: string) => void;
};

const sidecarState = vi.hoisted(() => ({
  instances: [] as SidecarLike[],
}));

vi.mock("bare-sidecar", () => {
  class MockSidecar implements SidecarLike {
    handlers = new Map<string, Array<(chunk: Buffer) => void>>();
    writes: string[] = [];
    stderr = {
      on: vi.fn(),
    };
    kill = vi.fn();
    destroy = vi.fn();

    constructor(_workerPath: string) {
      sidecarState.instances.push(this);
    }

    on(event: string, handler: (chunk: Buffer) => void): void {
      const bucket = this.handlers.get(event) ?? [];
      bucket.push(handler);
      this.handlers.set(event, bucket);
    }

    write(data: string): void {
      this.writes.push(data);
    }

    emitData(payload: string): void {
      const bucket = this.handlers.get("data") ?? [];
      for (const handler of bucket) {
        handler(Buffer.from(payload));
      }
    }
  }

  return {
    default: MockSidecar,
  };
});

function getSidecar(): SidecarLike {
  const sidecar = sidecarState.instances[0];
  if (!sidecar) {
    throw new Error("Expected sidecar instance to exist.");
  }
  return sidecar;
}

function getLastWrittenRequestId(sidecar: SidecarLike): string {
  const raw = sidecar.writes.at(-1);
  if (!raw) {
    throw new Error("No message written to sidecar.");
  }

  const parsed = JSON.parse(raw) as { requestId?: string };
  if (!parsed.requestId) {
    throw new Error("Request id was not generated.");
  }

  return parsed.requestId;
}

describe("IpcClient", () => {
  beforeEach(() => {
    sidecarState.instances = [];
    vi.clearAllMocks();
  });

  it("resolves requestByType when matching response arrives", async () => {
    const client = new IpcClient("worker.js");
    const sidecar = getSidecar();

    const promise = client.requestByType(
      { type: "listPosts" },
      "postList",
      2000,
    );
    const requestId = getLastWrittenRequestId(sidecar);

    sidecar.emitData(
      `${JSON.stringify({ type: "postList", requestId, payload: { posts: [], nextCursor: null, hasMore: false } })}\n`,
    );

    await expect(promise).resolves.toEqual({
      type: "postList",
      requestId,
      payload: { posts: [], nextCursor: null, hasMore: false },
    });
  });

  it("notifies listeners and supports unsubscribe", () => {
    const client = new IpcClient("worker.js");
    const sidecar = getSidecar();
    const listener = vi.fn();

    const off = client.on("postAdded", listener);

    sidecar.emitData(
      `${JSON.stringify({
        type: "postAdded",
        payload: {
          post: {
            id: "p1",
            author: "a",
            body: "hello",
            createdAt: 1,
          },
        },
      })}\n`,
    );

    expect(listener).toHaveBeenCalledTimes(1);

    off();

    sidecar.emitData(
      `${JSON.stringify({
        type: "postAdded",
        payload: {
          post: {
            id: "p2",
            author: "a",
            body: "hello",
            createdAt: 2,
          },
        },
      })}\n`,
    );

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("rejects request when worker returns typed error", async () => {
    const client = new IpcClient("worker.js");
    const sidecar = getSidecar();

    const promise = client.requestByType(
      { type: "listPosts" },
      "postList",
      2000,
    );
    const requestId = getLastWrittenRequestId(sidecar);

    sidecar.emitData(
      `${JSON.stringify({
        type: "error",
        requestId,
        payload: { message: "worker failed" },
      })}\n`,
    );

    await expect(promise).rejects.toThrow("worker failed");
  });

  it("shuts down sidecar after ack", async () => {
    const client = new IpcClient("worker.js");
    const sidecar = getSidecar();

    const shutdown = client.shutdown();
    const requestId = getLastWrittenRequestId(sidecar);

    sidecar.emitData(`${JSON.stringify({ type: "ack", requestId })}\n`);

    await shutdown;

    expect(sidecar.kill).toHaveBeenCalledTimes(1);
    expect(sidecar.destroy).toHaveBeenCalledTimes(1);
  });

  it("reinitializes worker sidecar and resolves isReady", async () => {
    const client = new IpcClient("worker.js");
    const firstSidecar = getSidecar();

    const readyPromise = client.reinitialize(
      {
        storageDir: "/tmp/reinit",
        topic: "a".repeat(64),
        mode: "reader",
      },
      2000,
    );

    expect(firstSidecar.kill).toHaveBeenCalledTimes(1);
    expect(firstSidecar.destroy).toHaveBeenCalledTimes(1);

    const secondSidecar = sidecarState.instances[1];
    if (!secondSidecar) {
      throw new Error("Expected second sidecar instance.");
    }

    const requestId = getLastWrittenRequestId(secondSidecar);
    secondSidecar.emitData(
      `${JSON.stringify({
        type: "isReady",
        requestId,
        payload: {
          baseKey: "b".repeat(64),
          localKey: "c".repeat(64),
          isIndexer: false,
        },
      })}\n`,
    );

    await expect(readyPromise).resolves.toEqual({
      type: "isReady",
      requestId,
      payload: {
        baseKey: "b".repeat(64),
        localKey: "c".repeat(64),
        isIndexer: false,
      },
    });
  });

  it("rejects pending requests when worker is reinitialized", async () => {
    const client = new IpcClient("worker.js");

    const pending = client.requestByType(
      { type: "listPosts" },
      "postList",
      2000,
    );

    const readyPromise = client.reinitialize(
      {
        storageDir: "/tmp/reinit-2",
        topic: "d".repeat(64),
        mode: "reader",
      },
      2000,
    );

    const secondSidecar = sidecarState.instances[1];
    if (!secondSidecar) {
      throw new Error("Expected second sidecar instance.");
    }
    const requestId = getLastWrittenRequestId(secondSidecar);
    secondSidecar.emitData(
      `${JSON.stringify({
        type: "isReady",
        requestId,
        payload: {
          baseKey: "e".repeat(64),
          localKey: "f".repeat(64),
          isIndexer: false,
        },
      })}\n`,
    );

    await expect(pending).rejects.toThrow("Worker connection restarted");
    await expect(readyPromise).resolves.toMatchObject({ type: "isReady" });
  });
});
