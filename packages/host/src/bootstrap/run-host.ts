import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { AgentRunner } from "../agent";
import { loadHostConfig } from "../config";
import { InteractiveAgentGateway } from "../interactive-agent";
import { logError, logInfo, logWarn } from "../observability/logger";
import { startApiServer } from "../server";
import { loadOrCreateBootstrapKey, writeBootstrapKeyIfMissing } from "./bootstrap-key";
import { getModeFromCli, getTopicHex } from "./cli";
import { type WorkerClientRef, createWorkerClient } from "./worker-factory";

const HEARTBEAT_INTERVAL_MS = 7000;
const HEARTBEAT_TIMEOUT_MS = 3500;

function startWorkerHeartbeat(ref: WorkerClientRef, label: string): () => void {
  let inFlight = false;

  const timer = setInterval(async () => {
    if (inFlight) {
      return;
    }

    inFlight = true;
    try {
      await ref.client.requestByType(
        {
          type: "listPosts",
          payload: { limit: 1 },
        },
        "postList",
        HEARTBEAT_TIMEOUT_MS,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown heartbeat failure";
      logWarn("worker heartbeat failed", { label, message });

      try {
        const ready = await ref.client.reinitialize(ref.initPayload, 40000);
        ref.baseKey = ready.payload.baseKey;
        ref.isIndexer = ready.payload.isIndexer;
        logInfo("worker recovered", {
          label,
          baseKeyPrefix: ref.baseKey.slice(0, 12),
          isIndexer: ref.isIndexer,
        });
      } catch (recoveryError) {
        const recoveryMessage =
          recoveryError instanceof Error ? recoveryError.message : "unknown recovery failure";
        logError("worker recovery failed", { label, message: recoveryMessage });
      }
    } finally {
      inFlight = false;
    }
  }, HEARTBEAT_INTERVAL_MS);

  return () => {
    clearInterval(timer);
  };
}

export async function runHost(): Promise<void> {
  const config = loadHostConfig();
  const mode = getModeFromCli();
  const topic = getTopicHex(config.topicSeed);
  const port = config.port;
  const forceFreshLocalRun = mode === "bootstrap" && config.freshLocalRun;
  const singleWriterMode = config.singleWriterMode;

  logInfo("host starting", {
    mode,
    topicPrefix: topic.slice(0, 12),
    port,
  });

  if (forceFreshLocalRun) {
    const keyPath = resolve(process.cwd(), "qitter.key");
    const storagePath = resolve(process.cwd(), "storage");

    await rm(keyPath, { force: true });
    await rm(storagePath, { recursive: true, force: true });
    logInfo("fresh local run completed", {
      removedKey: true,
      removedStorage: true,
    });
  }

  const initialBootstrap = await loadOrCreateBootstrapKey(mode);

  let bootstrapKey = initialBootstrap;
  let primaryWriter: WorkerClientRef | null = null;

  if (mode === "bootstrap") {
    primaryWriter = await createWorkerClient("indexer-1", topic, initialBootstrap, "writer", true);
    bootstrapKey = initialBootstrap ?? primaryWriter.baseKey;

    logInfo("primary writer ready", {
      indexer: primaryWriter.isIndexer,
      keyPrefix: primaryWriter.baseKey.slice(0, 12),
    });
  }

  if (!initialBootstrap) {
    if (!bootstrapKey) {
      throw new Error("Failed to determine bootstrap key.");
    }

    await writeBootstrapKeyIfMissing(bootstrapKey);
  }

  if (!bootstrapKey) {
    throw new Error("Failed to determine bootstrap key.");
  }

  const apiWorker = await createWorkerClient("api", topic, bootstrapKey, "reader");

  const interactiveWriter = await createWorkerClient(
    mode === "join" ? `interactive-ui-${Date.now()}` : "interactive-ui",
    topic,
    bootstrapKey,
    "writer",
    false,
  );
  logInfo("interactive writer ready", {
    indexer: interactiveWriter.isIndexer,
    keyPrefix: interactiveWriter.baseKey.slice(0, 12),
  });

  const interactiveAgent = new InteractiveAgentGateway(interactiveWriter.client, apiWorker.client);

  const apiServer = startApiServer(apiWorker.client, interactiveAgent, port);

  const resourcesToShutdown: Array<() => Promise<void>> = [
    async () => {
      await apiServer.close();
    },
    async () => {
      await interactiveWriter.client.shutdown();
    },
    async () => {
      await apiWorker.client.shutdown();
    },
  ];

  const stopHeartbeats: Array<() => void> = [];

  stopHeartbeats.push(startWorkerHeartbeat(apiWorker, "api"));
  stopHeartbeats.push(startWorkerHeartbeat(interactiveWriter, "interactive-writer"));

  const agents: AgentRunner[] = [];

  if (mode === "bootstrap") {
    if (!primaryWriter) {
      throw new Error("Primary writer was not initialized.");
    }

    const runner1 = new AgentRunner(primaryWriter.client, apiWorker.client, 1);
    agents.push(runner1);

    resourcesToShutdown.push(async () => {
      await primaryWriter.client.shutdown();
    });
    stopHeartbeats.push(startWorkerHeartbeat(primaryWriter, "primary-writer"));

    void runner1.start();

    if (!singleWriterMode) {
      const secondaryWriter = await createWorkerClient(
        "writer-2",
        topic,
        bootstrapKey,
        "writer",
        false,
      );
      logInfo("secondary writer ready", {
        indexer: secondaryWriter.isIndexer,
        keyPrefix: secondaryWriter.baseKey.slice(0, 12),
      });

      const runner2 = new AgentRunner(secondaryWriter.client, apiWorker.client, 2);

      agents.push(runner2);
      resourcesToShutdown.push(async () => {
        await secondaryWriter.client.shutdown();
      });
      stopHeartbeats.push(startWorkerHeartbeat(secondaryWriter, "secondary-writer"));

      setTimeout(() => {
        void runner2.start();
      }, 12000);
    } else {
      const runner2 = new AgentRunner(primaryWriter.client, apiWorker.client, 2);
      agents.push(runner2);

      setTimeout(() => {
        void runner2.start();
      }, 12000);
    }
  } else {
    const joiner = await createWorkerClient(
      `agent-join-${Date.now()}`,
      topic,
      bootstrapKey,
      "writer",
      false,
    );
    logInfo("joiner writer ready", {
      indexer: joiner.isIndexer,
      keyPrefix: joiner.baseKey.slice(0, 12),
    });
    const runner = new AgentRunner(joiner.client, apiWorker.client, 3);
    agents.push(runner);

    resourcesToShutdown.push(async () => {
      await joiner.client.shutdown();
    });
    stopHeartbeats.push(startWorkerHeartbeat(joiner, "joiner-writer"));

    void runner.start();
  }

  const handleStop = async (): Promise<void> => {
    logInfo("host stopping");
    for (const stopHeartbeat of stopHeartbeats) {
      stopHeartbeat();
    }
    for (const agent of agents) {
      agent.stop();
    }

    for (const close of resourcesToShutdown.reverse()) {
      try {
        await close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown shutdown error";
        logError("host shutdown error", { message });
      }
    }

    process.exit(0);
  };

  process.on("SIGINT", () => {
    void handleStop();
  });
  process.on("SIGTERM", () => {
    void handleStop();
  });
}
