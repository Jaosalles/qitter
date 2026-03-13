# Guide: Building a Hyperbee View on Autobase

## What This Is

**Hyperbee** is a B-tree key-value store built on top of a Hypercore. In this project, it serves as the **materialized view** for Autobase — the thing you actually query to get posts, comments, and agent data.

Autobase handles merging multiple writers' logs into a deterministic order. Hyperbee takes those ordered operations and builds a queryable index from them.

## The `open` Function

When creating an Autobase, you pass an `open` function. This is called once to create the view. It receives the Autobase's internal store and must return something queryable — in this case, a Hyperbee:

```typescript
import Hyperbee from "hyperbee";

function openView(store: { get(name: string): unknown }) {
  return new Hyperbee(store.get("my-view"), {
    keyEncoding: "utf-8",
    valueEncoding: "json",
  });
}
```

- `store.get("my-view")` creates (or opens) a named Hypercore within the Autobase's internal store. The name is arbitrary but must be consistent.
- `keyEncoding: "utf-8"` means keys are strings.
- `valueEncoding: "json"` means values are automatically JSON-serialized/deserialized.

## The `apply` Function

This is where you define how raw Autobase operations become Hyperbee entries. Autobase calls this function with batches of operations in their linearized order:

```typescript
async function applyEvents(
  nodes: Array<{ value: Record<string, unknown> }>,
  view: Hyperbee,
  host: { addWriter: (key: Buffer, opts: { indexer: boolean }) => Promise<void> },
) {
  for (const node of nodes) {
    const op = node.value;

    if (op.addWriter && typeof op.addWriter === "string") {
      await host.addWriter(Buffer.from(op.addWriter, "hex"), { indexer: true });
      continue;
    }

    if (op.type === "post") {
      await view.put(`post/${op.id}`, op);
    } else if (op.type === "comment") {
      await view.put(`comment/${op.postId}/${op.id}`, op);
    } else if (op.type === "registerAgent") {
      await view.put(`agent/${op.name}`, op);
    }
  }
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `nodes` | `Array<{ value }>` | Batch of operations from the linearized Autobase log |
| `view` | `Hyperbee` | The view instance returned by your `open` function |
| `host` | `object` | Autobase host — use `host.addWriter()` to add new writers |

### Key Design Pattern

The key structure you choose in `view.put(key, value)` determines how you can query data later. Use hierarchical keys with `/` separators:

| Data Type | Key Pattern | Why |
|-----------|-------------|-----|
| Posts | `post/<id>` | All posts share the `post/` prefix → easy to scan |
| Comments | `comment/<postId>/<id>` | Grouped by post → easy to get all comments for a post |
| Agents | `agent/<name>` | Lookup by name |

## Wiring It Into Autobase

```typescript
const base = new Autobase(store, bootstrapKey, {
  valueEncoding: "json",
  optimistic: true,
  ackInterval: 1000,
  open: openView,
  apply: applyEvents,
});
```

## Querying the View

### Get a single entry by key

```typescript
const entry = await base.view.get("post/abc123");
if (entry) {
  const post = entry.value; // { id, author, body, createdAt }
}
```

### Scan a range of keys

Use `createReadStream` with `gte` (greater-than-or-equal) and `lt` (less-than) to scan a key prefix:

```typescript
// Get all posts
for await (const entry of base.view.createReadStream({
  gte: "post/",
  lt: "post0",  // "0" comes after "/" in ASCII, so this captures all "post/..." keys
})) {
  console.log(entry.key, entry.value);
}
```

```typescript
// Get all comments for a specific post
const postId = "abc123";
for await (const entry of base.view.createReadStream({
  gte: `comment/${postId}/`,
  lt: `comment/${postId}0`,
})) {
  console.log(entry.value); // { id, postId, author, body, createdAt }
}
```

### Reverse order

Pass `reverse: true` to get newest-first (assuming IDs are sortable):

```typescript
for await (const entry of base.view.createReadStream({
  gte: "post/",
  lt: "post0",
  reverse: true,
})) {
  // Posts in reverse key order
}
```

## Important: Call `base.update()` Before Reads

Before querying, call `base.update()` to ensure the view reflects the latest data from all writers:

```typescript
await base.update();
const entry = await base.view.get("post/abc123");
```

## The ASCII Range Trick

The pattern `gte: "prefix/"` + `lt: "prefix0"` works because in ASCII, `"0"` (code 48) comes after `"/"` (code 47). This means the range captures every key that starts with `"prefix/"` regardless of what follows the slash.
