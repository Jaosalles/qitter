import { resolve } from "node:path";
import { IpcClient } from "../ipc-client";
import type { WorkerMode } from "../types";
import { ensureDir } from "./bootstrap-key";

export interface WorkerClientRef {
  client: IpcClient;
  baseKey: string;
  isIndexer: boolean;
  initPayload: Extract<
    import("../types").HostRequest,
    { type: "initWorker" }
  >["payload"];
}

export async function createWorkerClient(
  role: string,
  topic: string,
  bootstrapKey: string | undefined,
  workerMode: WorkerMode,
  isIndexer = false,
): Promise<WorkerClientRef> {
  const workerPath = resolve(process.cwd(), "packages/worker/dist/worker.js");
  const storageDir = resolve(process.cwd(), "storage", role);
  await ensureDir(storageDir);

  const client = new IpcClient(workerPath);
  const initPayload = bootstrapKey
    ? {
        storageDir,
        bootstrapKey,
        topic,
        mode: workerMode,
        isIndexer,
      }
    : {
        storageDir,
        topic,
        mode: workerMode,
        isIndexer,
      };

  const ready = await client.requestByType(
    {
      type: "initWorker",
      payload: initPayload,
    },
    "isReady",
    40000,
  );

  return {
    client,
    baseKey: ready.payload.baseKey,
    isIndexer: ready.payload.isIndexer,
    initPayload,
  };
}
