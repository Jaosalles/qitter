# Guide: Peer Discovery with Hyperswarm

## What This Is

**Hyperswarm** is a DHT-based peer discovery and connection library. You join a "topic" (a 32-byte Buffer), and Hyperswarm finds other peers who joined the same topic and establishes direct connections between you.

There's no server involved — peers find each other through a distributed hash table and connect directly (with hole-punching for NAT traversal).

## Creating a Swarm

```typescript
import Hyperswarm from "hyperswarm";

const swarm = new Hyperswarm();
```

## Joining a Topic

A topic is a 32-byte Buffer. Typically you derive it from a human-readable seed using a hash:

```typescript
import { createHash } from "crypto";

const seed = "my-network-name";
const topic = createHash("sha256").update(seed).digest(); // 32-byte Buffer

swarm.join(topic, { client: true, server: true });
```

- `client: true` — actively search for peers on this topic
- `server: true` — announce yourself so others can find you

You can join multiple topics. In this project, you join at least two:
1. A **seed-derived topic** so all peers in the same network can find each other
2. The **Autobase discovery key** (`base.discoveryKey`) for Autobase-specific replication

```typescript
// Join the main network topic
swarm.join(Buffer.from(seedHash, "hex"), { client: true, server: true });

// After Autobase is ready, also join its discovery key
swarm.join(base.discoveryKey, { client: true, server: true });
```

## Handling Connections

When Hyperswarm establishes a connection to a peer, it emits a `"connection"` event with a duplex stream:

```typescript
swarm.on("connection", (conn) => {
  // conn is a duplex stream (NoiseSecretStream)
  // You can pipe it, read/write, or pass it to other libraries
});
```

## Replicating Corestore

The most important thing you do with a connection is replicate your Corestore over it. This single call syncs all Hypercores (including Autobase's internal cores) between the two peers:

```typescript
swarm.on("connection", (conn) => {
  store.replicate(conn);
});
```

That's it. Corestore handles figuring out which cores need syncing, downloading missing blocks, etc.

## Doing More on Each Connection

The connection is a regular duplex stream, so you can do more than just replicate. You can multiplex additional protocols over it using **Protomux** (see the Protomux guide). This is useful for exchanging bootstrap keys, writer keys, or any other metadata:

```typescript
swarm.on("connection", (conn) => {
  store.replicate(conn);

  // Set up additional protocols over the same connection (see Protomux guide)
  const mux = Protomux.from(conn);
  // ...
});
```

## Tearing Down

```typescript
await swarm.destroy();
```

This closes all connections and stops discovery.

## Full Pattern

```typescript
import { createHash } from "crypto";
import Corestore from "corestore";
import Hyperswarm from "hyperswarm";

const store = new Corestore("./storage");
const swarm = new Hyperswarm();

const topic = createHash("sha256").update("my-network").digest();
swarm.join(topic, { client: true, server: true });

swarm.on("connection", (conn) => {
  store.replicate(conn);
  console.log("Peer connected!");
});

// Later: clean up
await swarm.destroy();
await store.close();
```
