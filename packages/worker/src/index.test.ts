import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listPostsFromBase = vi.fn();
const listAllPostsFromBase = vi.fn();
const listAllCommentsFromBase = vi.fn();
const listCommentsForPostFromBase = vi.fn();
const getAgentProfileFromBase = vi.fn();

class FakeCorestore {
  get(_input: unknown) {
    return {};
  }

  replicate(_connection: unknown): void {}

  async close(): Promise<void> {}
}

class FakeHyperswarm {
  join(_topic: Buffer, _opts: { client: boolean; server: boolean }): void {}

  on(_event: string, _cb: (connection: unknown) => void): void {}

  async destroy(): Promise<void> {}
}

class FakeAutobase {
  key = Buffer.from("a".repeat(64), "hex");
  discoveryKey = Buffer.from("b".repeat(64), "hex");
  local = {
    key: Buffer.from("c".repeat(64), "hex"),
  };
  isIndexer = true;
  view = {
    get: vi.fn(async () => null),
  };

  async ready(): Promise<void> {}

  async update(): Promise<void> {}

  on(_event: string, _cb: () => void): void {}

  async append(_value: unknown, _opts: { optimistic: boolean }): Promise<void> {}
}

vi.mock("autobase", () => ({
  default: FakeAutobase,
}));

vi.mock("corestore", () => ({
  default: FakeCorestore,
}));

vi.mock("hyperswarm", () => ({
  default: FakeHyperswarm,
}));

vi.mock("compact-encoding", () => ({
  default: {
    string: "string",
  },
}));

vi.mock("protomux", () => ({
  default: {
    from: vi.fn(() => ({
      createChannel: vi.fn(() => null),
    })),
  },
}));

vi.mock("hyperdb", () => ({
  default: {
    bee: vi.fn(() => ({})),
  },
}));

vi.mock("./spec/hyperdb/index.js", () => ({
  default: {},
}));

vi.mock("./runtime/read-model", () => ({
  listPostsFromBase,
  listAllPostsFromBase,
  listAllCommentsFromBase,
  listCommentsForPostFromBase,
  getAgentProfileFromBase,
}));

type BareMock = {
  write: ReturnType<typeof vi.fn>;
  on: (event: "data", cb: (chunk: Buffer) => void) => void;
};

type WorkerHarness = {
  writeSpy: ReturnType<typeof vi.fn>;
  pushIpcData: (line: string) => void;
};

async function setupWorkerHarness(): Promise<WorkerHarness> {
  vi.resetModules();

  const callbacks: Array<(chunk: Buffer) => void> = [];
  const writeSpy = vi.fn();

  const bareMock: BareMock = {
    write: writeSpy,
    on: (_event, cb) => {
      callbacks.push(cb);
    },
  };

  globalThis.Bare = {
    IPC: bareMock,
  };

  await import("./index");

  return {
    writeSpy,
    pushIpcData: (line: string) => {
      const callback = callbacks[0];
      if (!callback) {
        throw new Error("IPC callback was not registered.");
      }
      callback(Buffer.from(line));
    },
  };
}

function parseWorkerWrites(writeSpy: ReturnType<typeof vi.fn>): Array<Record<string, unknown>> {
  return writeSpy.mock.calls.map((entry) => {
    const payload = String(entry[0]).trim();
    return JSON.parse(payload) as Record<string, unknown>;
  });
}

describe("worker index IPC runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPostsFromBase.mockResolvedValue({
      posts: [],
      hasMore: false,
      nextCursor: null,
    });
    listAllPostsFromBase.mockResolvedValue([]);
    listAllCommentsFromBase.mockResolvedValue([]);
    listCommentsForPostFromBase.mockResolvedValue([]);
    getAgentProfileFromBase.mockResolvedValue({
      agent: null,
      posts: [],
      comments: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when IPC payload is invalid JSON", async () => {
    const harness = await setupWorkerHarness();

    harness.pushIpcData("{invalid-json}\n");

    const writes = parseWorkerWrites(harness.writeSpy);
    expect(writes[0]?.type).toBe("error");
    expect(writes[0]?.payload).toEqual({
      message: expect.stringContaining("JSON"),
    });
  });

  it("returns error with request id when operation is invalid before init", async () => {
    const harness = await setupWorkerHarness();

    harness.pushIpcData(
      `${JSON.stringify({
        type: "createPost",
        requestId: "req-1",
        payload: {
          id: "p1",
          author: "meshpilot",
          body: "hello",
          createdAt: 1,
        },
      })}\n`,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const writes = parseWorkerWrites(harness.writeSpy);
    expect(writes[0]?.type).toBe("error");
    expect(writes[0]?.requestId).toBe("req-1");
    expect(writes[0]?.payload).toEqual({
      message: "Worker is not initialized.",
    });
  });

  it("initializes and serves listPosts request through read-model", async () => {
    listPostsFromBase.mockResolvedValue({
      posts: [
        {
          id: "p1",
          author: "meshpilot",
          body: "hello",
          createdAt: 1,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });

    const harness = await setupWorkerHarness();

    harness.pushIpcData(
      `${JSON.stringify({
        type: "initWorker",
        requestId: "req-init",
        payload: {
          storageDir: "/tmp/storage",
          topic: "d".repeat(64),
          mode: "writer",
          isIndexer: true,
        },
      })}\n`,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    harness.pushIpcData(
      `${JSON.stringify({
        type: "listPosts",
        requestId: "req-list",
      })}\n`,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const writes = parseWorkerWrites(harness.writeSpy);

    const ready = writes.find((entry) => entry.type === "isReady");
    const postList = writes.find((entry) => entry.type === "postList");

    expect(ready?.requestId).toBe("req-init");
    expect(postList?.requestId).toBe("req-list");
    expect(postList?.payload).toEqual({
      posts: [
        {
          id: "p1",
          author: "meshpilot",
          body: "hello",
          createdAt: 1,
        },
      ],
      hasMore: false,
      nextCursor: null,
    });
  });
});
