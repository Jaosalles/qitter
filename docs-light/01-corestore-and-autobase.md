# Guide: Corestore and Autobase

## What These Are

**Corestore** is the storage layer. It manages a collection of Hypercores (append-only logs) in a single directory. You never create Hypercores directly — you ask the store for them.

**Autobase** sits on top of Corestore. It lets multiple independent writers each append to their own Hypercore, then merges all of those logs into a single deterministic, linearized view. This is the core primitive that makes multi-writer P2P work without a central server.

## Creating a Corestore

```typescript
import Corestore from "corestore";

const store = new Corestore("./my-storage-dir");
```

That's it. The directory is created if it doesn't exist. Each peer gets its own storage directory.

## Creating an Autobase

Autobase needs a store and optionally a bootstrap key (a Buffer). The bootstrap key is what ties multiple peers into the same network — they all share the same Autobase identity.

```typescript
import Autobase from "autobase";

const base = new Autobase(store, bootstrapKey, {
  valueEncoding: "json",
  optimistic: true,
  ackInterval: 1000,
  open: (store) => { /* return a view — see the Hyperbee guide */ },
  apply: async (nodes, view, host) => { /* process operations — see the Hyperbee guide */ },
});

await base.ready();
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `store` | `Corestore` | The storage instance |
| `bootstrapKey` | `Buffer \| null` | If `null`, a new Autobase is created (first peer). If a Buffer, joins an existing Autobase. |
| `opts.valueEncoding` | `string` | How values are encoded. Use `"json"` for JSON objects. |
| `opts.optimistic` | `boolean` | If `true`, writes are immediately visible locally before full replication. |
| `opts.ackInterval` | `number` | Milliseconds between acknowledgment rounds. |
| `opts.open` | `function` | Called to create the materialized view (see Hyperbee guide). |
| `opts.apply` | `function` | Called to process batches of operations into the view (see Hyperbee guide). |

### The Bootstrap Key

- The **first peer** passes `null` as the bootstrap key. Autobase generates a new key pair.
- After `await base.ready()`, read `base.key` to get the bootstrap key (a Buffer).
- **All other peers** must receive this key somehow (e.g., written to a shared file, exchanged via Protomux) and pass it when constructing their Autobase.

```typescript
// First peer
const base = new Autobase(store, null, { ... });
await base.ready();
const bootstrapKey = base.key; // Buffer — share this with other peers

// Other peers
const base = new Autobase(store, bootstrapKey, { ... });
await base.ready();
```

## Writing to Autobase

Every peer appends JSON operations to the shared log:

```typescript
await base.append(
  { type: "post", id: "abc123", author: "Alice", body: "Hello world", createdAt: Date.now() },
  { optimistic: true }
);
```

The `{ optimistic: true }` flag makes the write immediately visible in the local view before it's been fully replicated and acknowledged by other peers.

Each peer has its own local Hypercore (`base.local`). When you call `base.append(...)`, the operation goes into **your** local core. Autobase handles merging everyone's cores into the shared view.

## Adding Writers

By default, only the creator can write to an Autobase. To let other peers write, you must add them as writers. This is done by appending a special operation and handling it in the `apply` function:

```typescript
// The peer that wants to join appends its local key
await base.append(
  { addWriter: base.local.key.toString("hex") },
  { optimistic: true }
);
```

Then in the `apply` function (see Hyperbee guide), you detect this operation and call:

```typescript
await host.addWriter(Buffer.from(keyHex, "hex"), { indexer: true });
```

## Useful Properties

| Property | Type | Description |
|----------|------|-------------|
| `base.key` | `Buffer` | The bootstrap key (shared across all peers) |
| `base.discoveryKey` | `Buffer` | Used to join Hyperswarm for Autobase-specific replication |
| `base.local.key` | `Buffer` | This peer's local writer key |
| `base.isIndexer` | `boolean` | Whether this peer is an indexer |
| `base.view` | *(your view)* | The materialized view (e.g., a Hyperbee instance) |

## Listening for Updates

```typescript
base.on("update", () => {
  // The view has been updated (new data from self or peers)
  // Query the view here to detect new entries
});
```

## Reading the View

Before reading, call `base.update()` to ensure the view reflects the latest state:

```typescript
await base.update();
// Now query base.view (see Hyperbee guide)
```

## Replication

Autobase replicates through Corestore. When you replicate the store over a Hyperswarm connection, Autobase's cores are included automatically:

```typescript
swarm.on("connection", (conn) => {
  store.replicate(conn);
});
```

That single line handles replicating all Hypercores (including every writer's core and the Autobase metadata) over the connection. You don't need to manage individual core replication.
