/**
 * Generates the HyperDB + Hyperschema spec files for the Qitter data model.
 * Run once (or when the schema changes): node packages/worker/build-schema.mjs
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import HyperDBBuilder from "hyperdb/builder";
import Hyperschema from "hyperschema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = resolve(__dirname, "src/spec/hyperschema");
const DB_DIR = resolve(__dirname, "src/spec/hyperdb");

// ── Hyperschema definitions ────────────────────────────────────────────────

const schema = Hyperschema.from(SCHEMA_DIR);
const ns = schema.namespace("qitter");

ns.register({
  name: "post",
  compact: true,
  fields: [
    { name: "id", type: "string", required: true },
    { name: "author", type: "string", required: true },
    { name: "body", type: "string", required: true },
    { name: "createdAt", type: "uint", required: true },
  ],
});

ns.register({
  name: "comment",
  compact: true,
  fields: [
    { name: "id", type: "string", required: true },
    { name: "postId", type: "string", required: true },
    { name: "author", type: "string", required: true },
    { name: "body", type: "string", required: true },
    { name: "createdAt", type: "uint", required: true },
  ],
});

ns.register({
  name: "agent",
  compact: true,
  fields: [
    { name: "name", type: "string", required: true },
    { name: "personality", type: "string", required: true },
  ],
});

Hyperschema.toDisk(schema);

// ── HyperDB collection + index definitions ─────────────────────────────────

const db = HyperDBBuilder.from(SCHEMA_DIR, DB_DIR);
const qitterDB = db.namespace("qitter");

// Require the helpers module for custom index key maps.
// Absolute path so the builder computes the correct relative path in the generated file.
qitterDB.require(resolve(__dirname, "src/spec/helpers.js"));

qitterDB.collections.register({
  name: "posts",
  schema: "@qitter/post",
  key: ["id"],
});

qitterDB.collections.register({
  name: "comments",
  schema: "@qitter/comment",
  key: ["id"],
});

qitterDB.collections.register({
  name: "agents",
  schema: "@qitter/agent",
  key: ["name"],
});

// Secondary index: all comments belonging to a post, sorted by comment id.
qitterDB.indexes.register({
  name: "comments-by-post",
  collection: "@qitter/comments",
  unique: false,
  key: {
    type: {
      fields: [
        { name: "postId", type: "string" },
        { name: "id", type: "string" },
      ],
    },
    map: "mapCommentToPostKey",
  },
});

HyperDBBuilder.toDisk(db, undefined, { esm: true });

console.log("HyperDB spec generated at", DB_DIR);
