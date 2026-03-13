import { beforeEach, describe, expect, it, vi } from "vitest";

const createWorkerClient = vi.fn();
const loadHostConfig = vi.fn();
const getModeFromCli = vi.fn();
const getTopicHex = vi.fn();
const loadOrCreateBootstrapKey = vi.fn();
const writeBootstrapKeyIfMissing = vi.fn();
const startApiServer = vi.fn();
const logInfo = vi.fn();
const logError = vi.fn();
const logWarn = vi.fn();

const runnerStart = vi.fn();
const runnerStop = vi.fn();

vi.mock("../agent", () => ({
  AgentRunner: class {
    start = runnerStart;
    stop = runnerStop;
  },
}));

vi.mock("../config", () => ({
  loadHostConfig,
}));

vi.mock("../server", () => ({
  startApiServer,
}));

vi.mock("../observability/logger", () => ({
  logInfo,
  logError,
  logWarn,
}));

vi.mock("./cli", () => ({
  getModeFromCli,
  getTopicHex,
}));

vi.mock("./bootstrap-key", () => ({
  loadOrCreateBootstrapKey,
  writeBootstrapKeyIfMissing,
}));

vi.mock("./worker-factory", () => ({
  createWorkerClient,
}));

function createClientRef(baseKey: string, isIndexer: boolean) {
  return {
    client: {
      shutdown: vi.fn(async () => undefined),
      requestByType: vi.fn(),
      reinitialize: vi.fn(async () => ({
        type: "isReady",
        payload: { baseKey, localKey: "local-key", isIndexer },
      })),
      on: vi.fn(),
    },
    baseKey,
    isIndexer,
    initPayload: {
      storageDir: `/tmp/${baseKey}`,
      bootstrapKey: baseKey,
      topic: "topic-hex",
      mode: "writer",
      isIndexer,
    },
  };
}

describe("runHost", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    startApiServer.mockReturnValue({
      close: vi.fn(async () => undefined),
    });

    getTopicHex.mockReturnValue("topic-hex");
    vi.spyOn(process, "on").mockImplementation((() => process) as never);
  });

  it("bootstraps primary/indexer + api + interactive workers and writes key", async () => {
    loadHostConfig.mockReturnValue({
      port: 3000,
      llmMode: "local",
      freshLocalRun: false,
      singleWriterMode: true,
      topicSeed: "qitter-local",
    });

    getModeFromCli.mockReturnValue("bootstrap");
    loadOrCreateBootstrapKey.mockResolvedValue(undefined);

    createWorkerClient
      .mockResolvedValueOnce(createClientRef("bootstrap-key", true))
      .mockResolvedValueOnce(createClientRef("bootstrap-key", false))
      .mockResolvedValueOnce(createClientRef("bootstrap-key", false));

    const { runHost } = await import("./run-host");
    await runHost();

    expect(createWorkerClient).toHaveBeenCalledTimes(3);
    expect(createWorkerClient).toHaveBeenNthCalledWith(
      1,
      "indexer-1",
      "topic-hex",
      undefined,
      "writer",
      true,
    );
    expect(createWorkerClient).toHaveBeenNthCalledWith(
      2,
      "api",
      "topic-hex",
      "bootstrap-key",
      "reader",
    );
    expect(createWorkerClient).toHaveBeenNthCalledWith(
      3,
      "interactive-ui",
      "topic-hex",
      "bootstrap-key",
      "writer",
      false,
    );
    expect(writeBootstrapKeyIfMissing).toHaveBeenCalledWith("bootstrap-key");
    expect(startApiServer).toHaveBeenCalledTimes(1);
    expect(runnerStart).toHaveBeenCalledTimes(1);
  });

  it("starts join mode with deterministic joiner and interactive writer roles", async () => {
    loadHostConfig.mockReturnValue({
      port: 3000,
      llmMode: "replicate",
      freshLocalRun: false,
      singleWriterMode: false,
      topicSeed: "qitter-local",
    });

    getModeFromCli.mockReturnValue("join");
    loadOrCreateBootstrapKey.mockResolvedValue("bootstrap-existing");
    vi.spyOn(Date, "now").mockReturnValue(12345);

    createWorkerClient
      .mockResolvedValueOnce(createClientRef("bootstrap-existing", false))
      .mockResolvedValueOnce(createClientRef("bootstrap-existing", false))
      .mockResolvedValueOnce(createClientRef("bootstrap-existing", false));

    const { runHost } = await import("./run-host");
    await runHost();

    expect(createWorkerClient).toHaveBeenCalledTimes(3);
    expect(createWorkerClient).toHaveBeenNthCalledWith(
      1,
      "api",
      "topic-hex",
      "bootstrap-existing",
      "reader",
    );
    expect(createWorkerClient).toHaveBeenNthCalledWith(
      2,
      "interactive-ui-12345",
      "topic-hex",
      "bootstrap-existing",
      "writer",
      false,
    );
    expect(createWorkerClient).toHaveBeenNthCalledWith(
      3,
      "agent-join-12345",
      "topic-hex",
      "bootstrap-existing",
      "writer",
      false,
    );
    expect(writeBootstrapKeyIfMissing).not.toHaveBeenCalled();
  });

  it("reinitializes worker when heartbeat fails", async () => {
    vi.useFakeTimers();

    loadHostConfig.mockReturnValue({
      port: 3000,
      llmMode: "local",
      freshLocalRun: false,
      singleWriterMode: true,
      topicSeed: "qitter-local",
    });

    getModeFromCli.mockReturnValue("bootstrap");
    loadOrCreateBootstrapKey.mockResolvedValue("bootstrap-key");

    const primaryRef = createClientRef("bootstrap-key", true);
    const apiRef = createClientRef("bootstrap-key", false);
    const interactiveRef = createClientRef("bootstrap-key", false);

    apiRef.client.requestByType = vi
      .fn()
      .mockRejectedValueOnce(new Error("heartbeat timeout"))
      .mockResolvedValue({
        type: "postList",
        payload: { posts: [], nextCursor: null, hasMore: false },
      });

    createWorkerClient
      .mockResolvedValueOnce(primaryRef)
      .mockResolvedValueOnce(apiRef)
      .mockResolvedValueOnce(interactiveRef);

    const { runHost } = await import("./run-host");
    await runHost();

    await vi.advanceTimersByTimeAsync(7500);

    expect(apiRef.client.reinitialize).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
