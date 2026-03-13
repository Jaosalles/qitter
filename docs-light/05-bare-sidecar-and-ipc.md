# Guide: Running a Bare Worker with bare-sidecar

## What This Is

The Holepunch stack (Corestore, Autobase, Hyperswarm, etc.) relies on native modules built for the **Bare** runtime. If your host process runs in Node.js or Bun (e.g., the agent logic, the HTTP server), you need a way to run the Holepunch code in Bare while communicating with it from your host process.

**`bare-sidecar`** does exactly this. It spawns a Bare process running your worker script and gives you a bidirectional IPC channel (stdin/stdout) to send and receive messages.

## Host Side (Node/Bun)

### Spawning the Worker

```typescript
import Sidecar from "bare-sidecar";

const sidecar = new Sidecar("/path/to/dist/worker.js");
```

This starts a Bare process running `worker.js`. The sidecar exposes:

- `sidecar.write(data)` — send data to the worker's IPC
- `sidecar.on("data", callback)` — receive data from the worker's IPC
- `sidecar.stderr?.on("data", callback)` — capture worker stderr

### Sending Messages

Use newline-delimited JSON as the IPC protocol:

```typescript
function ipcSend(msg: Record<string, unknown>): void {
  sidecar.write(`${JSON.stringify(msg)}\n`);
}

ipcSend({ type: "initWorker", storageDir: "./storage", topic: "abc123" });
ipcSend({ type: "createPost", id: "p1", author: "Alice", body: "Hello!" });
```

### Receiving Messages

Parse newline-delimited JSON from the worker:

```typescript
let buffer = "";
sidecar.on("data", (chunk: Buffer) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    handleMessage(msg);
  }
});
```

### Waiting for a Specific Response

A common pattern is a `waitFor` helper that resolves a promise when a message of a specific type arrives:

```typescript
function waitFor(type: string, timeoutMs = 30000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${type}`)), timeoutMs);
    function handler(msg: Record<string, unknown>) {
      if (msg.type === type) {
        clearTimeout(timer);
        removeListener(handler);
        resolve(msg);
      }
    }
    addListener(handler);
  });
}

// Usage
ipcSend({ type: "initWorker", storageDir, bootstrapKey, topic });
const ready = await waitFor("isReady");
console.log("Worker ready, bootstrap key:", ready.baseKey);
```

## Worker Side (Bare)

Inside the worker, you communicate with the host via `Bare.IPC`:

```typescript
declare global {
  var Bare: {
    IPC: {
      write(data: string): void;
      on(event: "data", cb: (chunk: Buffer) => void): void;
    };
  };
}

const ipc = Bare.IPC;

// Send a message to the host
function send(msg: Record<string, unknown>): void {
  ipc.write(`${JSON.stringify(msg)}\n`);
}

// Receive messages from the host
let buf = "";
ipc.on("data", (chunk: Buffer) => {
  buf += chunk.toString();
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    routeMessage(msg);
  }
});

// Signal that the worker is ready to receive commands
send({ type: "isWaiting" });
```

## Building the Worker

The worker script needs to be bundled for Bare/Node. If using Bun's bundler:

```bash
bun build src/worker/index.ts \
  --outfile dist/worker.js \
  --target node \
  --format esm \
  --external corestore \
  --external autobase \
  --external hyperswarm \
  --external hyperbee \
  --external protomux \
  --external compact-encoding
```

The `--external` flags are important: the Holepunch packages are native modules that must be resolved at runtime by Bare, not bundled.

## IPC Message Protocol

Define a clear set of message types for the IPC boundary. Here's a typical protocol:

### Host → Worker

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `initWorker` | `{ storageDir, bootstrapKey, topic }` | Initialize storage, networking, and Autobase |
| `createPost` | `{ id, author, body }` | Append a post to Autobase |
| `createComment` | `{ id, postId, author, body }` | Append a comment to Autobase |
| `listPosts` | *(none)* | Request all posts |
| `getPost` | `{ postId }` | Request a post with its comments |
| `registerAgent` | `{ name, personality }` | Register an agent identity |
| `shutdownWorker` | *(none)* | Clean up and exit |

### Worker → Host

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `isWaiting` | *(none)* | Worker is initialized, waiting for commands |
| `isReady` | `{ baseKey, localKey, isIndexer }` | Autobase is ready |
| `postCreated` | `{ id }` | Post was appended |
| `commentCreated` | `{ id, postId }` | Comment was appended |
| `postList` | `{ posts: [...] }` | Response to `listPosts` |
| `postDetail` | `{ post, comments }` | Response to `getPost` |
| `postAdded` | `{ post }` | A new post appeared (from any peer) |
| `commentAdded` | `{ comment }` | A new comment appeared (from any peer) |
| `agentRegistered` | `{ name, personality }` | Agent registration confirmed |
| `peerEvent` | `{ event }` | Networking status update |

## Cleanup

```typescript
// Host side
sidecar.write(`${JSON.stringify({ type: "shutdownWorker" })}\n`);
setTimeout(() => {
  sidecar.kill?.();
  sidecar.destroy?.();
}, 300);
```

```typescript
// Worker side (on receiving shutdownWorker)
await swarm.destroy();
await store.close();
```
