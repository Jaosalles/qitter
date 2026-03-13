# Guide: Protocol Multiplexing with Protomux

## What This Is

**Protomux** lets you run multiple independent protocols over a single connection. In this project, each Hyperswarm connection already handles Corestore replication — Protomux lets you piggyback additional message channels on top of that same connection.

You need this for two things:
1. **Bootstrap key exchange** — when a new peer connects, it may not know the Autobase bootstrap key yet. An existing peer can send it.
2. **Writer key exchange** — each peer needs to tell others about its local writer key so they can add it to the Autobase.

## Creating a Mux from a Connection

Inside your Hyperswarm `"connection"` handler, wrap the connection with Protomux:

```typescript
import Protomux from "protomux";

swarm.on("connection", (conn) => {
  store.replicate(conn);
  const mux = Protomux.from(conn);
  // Now set up channels on the mux
});
```

`Protomux.from(conn)` is idempotent — if a mux already exists for that connection, it returns the existing one.

## Channels and Messages

A **channel** is a named protocol. A channel contains one or more **message types**. The pattern is:

1. Create a channel with a `protocol` name and an `onopen` callback
2. Add message handlers to the channel
3. Open the channel

```typescript
import c from "compact-encoding";

let msg = null;
const channel = mux.createChannel({
  protocol: "my-protocol",
  onopen() {
    // Called when both sides have opened a channel with the same protocol name.
    // This is where you send your initial data.
    msg.send("hello from this peer");
  },
});

if (channel) {
  msg = channel.addMessage({
    encoding: c.string,       // compact-encoding type for string data
    onmessage(data) {
      // Called when the other side sends a message on this channel
      console.log("Received:", data);
    },
  });
  channel.open();
}
```

### Key Points

- `createChannel` returns `null` if the protocol is already registered on this mux. Always check for null.
- `onopen` fires when **both sides** have opened a channel with the same protocol name. This is the right place to send your initial exchange.
- `addMessage` returns a message handle with a `.send(data)` method.
- `encoding` uses `compact-encoding` types. For simple string data, use `c.string`.
- `channel.open()` signals that you're ready. Once both sides call `open()`, the `onopen` callbacks fire.

## Bootstrap Key Exchange

When a new peer connects, it might not know the Autobase bootstrap key. An existing peer sends it:

```typescript
import c from "compact-encoding";

swarm.on("connection", (conn) => {
  store.replicate(conn);
  const mux = Protomux.from(conn);

  let bootstrapMsg = null;
  const bootstrapChannel = mux.createChannel({
    protocol: "myapp-bootstrap",
    onopen() {
      // When the channel opens, send our bootstrap key (if we have one)
      if (base?.key) {
        bootstrapMsg.send(base.key.toString("hex"));
      }
    },
  });

  if (bootstrapChannel) {
    bootstrapMsg = bootstrapChannel.addMessage({
      encoding: c.string,
      onmessage(keyHex) {
        if (keyHex.length === 64) {
          // We received the bootstrap key from a peer!
          // Use it to initialize our Autobase
          onBootstrapKeyReceived(Buffer.from(keyHex, "hex"));
        }
      },
    });
    bootstrapChannel.open();
  }
});
```

## Writer Key Exchange

Similarly, peers exchange their local writer keys so each side can add the other as a writer to Autobase:

```typescript
let writerMsg = null;
const writerChannel = mux.createChannel({
  protocol: "myapp-writers",
  onopen() {
    if (base?.local?.key) {
      writerMsg.send(base.local.key.toString("hex"));
    }
  },
});

if (writerChannel) {
  writerMsg = writerChannel.addMessage({
    encoding: c.string,
    onmessage(peerKeyHex) {
      if (peerKeyHex.length !== 64) return;

      // Activate the peer's core in our store
      store.get({ key: Buffer.from(peerKeyHex, "hex"), active: true });

      // Append an addWriter operation to the Autobase
      base.append({ addWriter: peerKeyHex }, { optimistic: true });
    },
  });
  writerChannel.open();
}
```

### Why `store.get(...)` Before `addWriter`?

Calling `store.get({ key: Buffer.from(keyHex, "hex"), active: true })` tells Corestore to actively replicate the peer's Hypercore. Without this, Autobase wouldn't be able to read the peer's operations.

## Full Connection Handler Pattern

```typescript
swarm.on("connection", (conn) => {
  store.replicate(conn);

  const mux = Protomux.from(conn);

  // Channel 1: bootstrap key exchange
  let bMsg = null;
  const bCh = mux.createChannel({
    protocol: "myapp-bootstrap",
    onopen() {
      if (base?.key) bMsg.send(base.key.toString("hex"));
    },
  });
  if (bCh) {
    bMsg = bCh.addMessage({
      encoding: c.string,
      onmessage(keyHex) { /* handle received bootstrap key */ },
    });
    bCh.open();
  }

  // Channel 2: writer key exchange
  let wMsg = null;
  const wCh = mux.createChannel({
    protocol: "myapp-writers",
    onopen() {
      if (base?.local?.key) wMsg.send(base.local.key.toString("hex"));
    },
  });
  if (wCh) {
    wMsg = wCh.addMessage({
      encoding: c.string,
      onmessage(peerKeyHex) { /* handle received writer key */ },
    });
    wCh.open();
  }
});
```
