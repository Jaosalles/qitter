import Sidecar from "bare-sidecar";
import type { HostRequest, WorkerMessage } from "./types";

type MessageOfType<TType extends WorkerMessage["type"]> = Extract<WorkerMessage, { type: TType }>;

type PendingRequest = {
  expectedType: WorkerMessage["type"];
  resolve: (message: WorkerMessage) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class IpcClient {
  private readonly workerPath: string;
  private sidecar: Sidecar;
  private buffer = "";
  private requestCounter = 0;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Map<
    WorkerMessage["type"],
    Set<(message: WorkerMessage) => void>
  >();

  constructor(workerPath: string) {
    this.workerPath = workerPath;
    this.sidecar = this.createSidecar(workerPath);
  }

  private createSidecar(workerPath: string): Sidecar {
    const sidecar = new Sidecar(workerPath);
    sidecar.on("data", (chunk: Buffer) => {
      this.handleData(chunk);
    });

    sidecar.stderr?.on("data", (chunk: Buffer) => {
      const output = chunk.toString().trim();
      if (output.length > 0) {
        console.error(`[worker] ${output}`);
      }
    });

    return sidecar;
  }

  private rejectPendingRequests(message: string): void {
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`${message} (${requestId})`));
    }
    this.pending.clear();
  }

  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString();
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }

      try {
        const message = JSON.parse(trimmed) as WorkerMessage;
        this.dispatch(message);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid worker JSON";
        console.error(`[worker] failed to parse message: ${message}`);
      }
    }
  }

  private dispatch(message: WorkerMessage): void {
    if (message.type === "error" && message.requestId) {
      const pending = this.pending.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(message.requestId);
        pending.reject(new Error(message.payload.message));
        return;
      }
    }

    if (message.requestId) {
      const pending = this.pending.get(message.requestId);
      if (pending && pending.expectedType === message.type) {
        clearTimeout(pending.timeout);
        this.pending.delete(message.requestId);
        pending.resolve(message);
        return;
      }
    }

    const listeners = this.listeners.get(message.type);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(message);
    }
  }

  private nextRequestId(): string {
    this.requestCounter += 1;
    return `req-${Date.now()}-${this.requestCounter}`;
  }

  request<TMessage extends WorkerMessage>(
    request: HostRequest,
    expectedType: TMessage["type"],
    timeoutMs = 20000,
  ): Promise<TMessage> {
    const requestId = this.nextRequestId();
    const message = {
      ...request,
      requestId,
    } as HostRequest;

    this.sidecar.write(`${JSON.stringify(message)}\n`);

    return new Promise<TMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timeout waiting for ${expectedType}`));
      }, timeoutMs);

      this.pending.set(requestId, {
        expectedType,
        resolve: (response) => resolve(response as TMessage),
        reject,
        timeout,
      });
    });
  }

  requestByType<TType extends WorkerMessage["type"]>(
    request: HostRequest,
    expectedType: TType,
    timeoutMs = 20000,
  ): Promise<MessageOfType<TType>> {
    const requestId = this.nextRequestId();
    const message = {
      ...request,
      requestId,
    } as HostRequest;

    this.sidecar.write(`${JSON.stringify(message)}\n`);

    return new Promise<MessageOfType<TType>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timeout waiting for ${expectedType}`));
      }, timeoutMs);

      this.pending.set(requestId, {
        expectedType,
        resolve: (response) => resolve(response as MessageOfType<TType>),
        reject,
        timeout,
      });
    });
  }

  notify(request: HostRequest): void {
    this.sidecar.write(`${JSON.stringify(request)}\n`);
  }

  async reinitialize(
    payload: Extract<HostRequest, { type: "initWorker" }>["payload"],
    timeoutMs = 40000,
  ): Promise<Extract<WorkerMessage, { type: "isReady" }>> {
    this.rejectPendingRequests("Worker connection restarted");
    this.sidecar.kill?.();
    this.sidecar.destroy?.();
    this.buffer = "";
    this.sidecar = this.createSidecar(this.workerPath);

    return this.requestByType(
      {
        type: "initWorker",
        payload,
      },
      "isReady",
      timeoutMs,
    );
  }

  on(type: WorkerMessage["type"], listener: (message: WorkerMessage) => void): () => void {
    const bucket = this.listeners.get(type) ?? new Set<(message: WorkerMessage) => void>();
    bucket.add(listener);
    this.listeners.set(type, bucket);

    return () => {
      const current = this.listeners.get(type);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  async shutdown(): Promise<void> {
    try {
      await this.request({ type: "shutdownWorker" }, "ack", 5000);
    } catch {
      // Best effort shutdown.
    }

    this.rejectPendingRequests("Worker shutdown");

    this.sidecar.kill?.();
    this.sidecar.destroy?.();
  }
}
