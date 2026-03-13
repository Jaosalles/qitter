import Autobase from "autobase";
import c from "compact-encoding";
import Corestore from "corestore";
import HyperDB, { type HyperDBInstance } from "hyperdb";
import Hyperswarm from "hyperswarm";
import Protomux from "protomux";
import { applyOperations } from "./runtime/apply-operations";
import { isPost } from "./runtime/guards";
import {
  requireAgentNamePayload,
  requireAgentPayload,
  requireCommentPayload,
  requirePostIdPayload,
  requirePostPayload,
} from "./runtime/message-validation";
import {
  getAgentProfileFromBase,
  listAllCommentsFromBase,
  listAllPostsFromBase,
  listCommentsForPostFromBase,
  listPostsFromBase,
} from "./runtime/read-model";
import { parseWriterAnnouncement } from "./runtime/writer-announcement";
import def from "./spec/hyperdb/index.js";
import type {
  AgentProfile,
  Comment,
  CreateCommentMessage,
  CreatePostMessage,
  GetAgentMessage,
  GetPostMessage,
  HostToWorkerMessage,
  ListPostsMessage,
  Operation,
  Post,
  RegisterAgentMessage,
  WorkerMode,
  WorkerToHostMessage,
} from "./types";

declare global {
  // Bare exposes IPC globally.
  var Bare: {
    IPC: {
      write(data: string): void;
      on(event: "data", cb: (chunk: Buffer) => void): void;
    };
  };
}

type ChannelMessage = {
  send: (data: string) => void;
};

type ChannelLike = {
  addMessage: (opts: {
    encoding: unknown;
    onmessage: (data: string) => void;
  }) => ChannelMessage;
  open: () => void;
};

type MuxLike = {
  createChannel: (opts: {
    protocol: string;
    onopen: () => void;
  }) => ChannelLike | null;
};

let store: Corestore | null = null;
let base: Autobase<Operation, HyperDBInstance> | null = null;
let swarm: Hyperswarm | null = null;
let ipcBuffer = "";
let previousPostIds = new Set<string>();
let previousCommentIds = new Set<string>();
let initialized = false;
let mode: WorkerMode = "writer";
let desiredIndexer = false;
const knownWriterRoles = new Map<string, boolean>();

function withRequestId<T extends Record<string, unknown>>(
  message: T,
  requestId?: string,
): T & { requestId?: string } {
  if (requestId) {
    return {
      ...message,
      requestId,
    };
  }

  return message;
}

function send(message: WorkerToHostMessage): void {
  Bare.IPC.write(`${JSON.stringify(message)}\n`);
}

function sendError(message: string, requestId?: string): void {
  send(
    withRequestId(
      {
        type: "error",
        payload: { message },
      },
      requestId,
    ) as WorkerToHostMessage,
  );
}

function rememberWriterRole(keyHex: string, indexer: boolean): void {
  knownWriterRoles.set(keyHex, indexer);
}

function shouldAppendWriterRole(keyHex: string, indexer: boolean): boolean {
  const knownRole = knownWriterRoles.get(keyHex);
  if (knownRole === indexer) {
    return false;
  }

  knownWriterRoles.set(keyHex, indexer);
  return true;
}

function ensureWriterMode(): void {
  if (mode === "reader") {
    throw new Error("This worker is reader-only and cannot append operations.");
  }
}

function openView(workerStore: Corestore): HyperDBInstance {
  const core = workerStore.get("qitter-view");
  // HyperDB.bee wraps a raw Hypercore in a Hyperbee internally and
  // uses compact-encoding + the generated spec for typed storage.
  return HyperDB.bee(core, def, { autoUpdate: true });
}

async function requireBase(): Promise<Autobase<Operation, HyperDBInstance>> {
  if (!base) {
    throw new Error("Worker is not initialized.");
  }
  await base.update();
  return base;
}

async function listPostsFromView(): Promise<Post[]> {
  const currentBase = await requireBase();
  return listAllPostsFromBase(currentBase);
}

async function listCommentsForPost(postId: string): Promise<Comment[]> {
  const currentBase = await requireBase();
  return listCommentsForPostFromBase(currentBase, postId);
}

async function listAllComments(): Promise<Comment[]> {
  const currentBase = await requireBase();
  return listAllCommentsFromBase(currentBase);
}

async function getAgentProfile(name: string): Promise<{
  agent: AgentProfile | null;
  posts: Post[];
  comments: Comment[];
}> {
  const currentBase = await requireBase();
  return getAgentProfileFromBase(currentBase, name);
}

async function emitDeltas(): Promise<void> {
  const posts = await listPostsFromView();
  const postIds = new Set(posts.map((post) => post.id));

  for (const post of posts) {
    if (!previousPostIds.has(post.id)) {
      send({
        type: "postAdded",
        payload: { post },
      });
    }
  }

  const comments = await listAllComments();
  const commentIds = new Set(comments.map((comment) => comment.id));

  for (const comment of comments) {
    if (!previousCommentIds.has(comment.id)) {
      send({
        type: "commentAdded",
        payload: { comment },
      });
    }
  }

  previousPostIds = postIds;
  previousCommentIds = commentIds;
}

function setupProtomuxChannels(connection: unknown): void {
  const currentBase = base;
  const currentStore = store;

  if (!currentBase || !currentStore) {
    return;
  }

  const mux = Protomux.from(connection) as unknown as MuxLike;

  let bootstrapMessage: ChannelMessage | null = null;
  const bootstrapChannel = mux.createChannel({
    protocol: "qitter-bootstrap",
    onopen: () => {
      if (bootstrapMessage) {
        bootstrapMessage.send(currentBase.key.toString("hex"));
      }
    },
  });

  if (bootstrapChannel) {
    bootstrapMessage = bootstrapChannel.addMessage({
      encoding: c.string,
      onmessage: () => {
        // We always initialize from host-provided key, so received bootstrap is informational.
      },
    });
    bootstrapChannel.open();
  }

  let writerMessage: ChannelMessage | null = null;
  const writerChannel = mux.createChannel({
    protocol: "qitter-writers",
    onopen: () => {
      if (writerMessage && mode === "writer") {
        writerMessage.send(
          JSON.stringify({
            key: currentBase.local.key.toString("hex"),
            indexer: desiredIndexer,
          }),
        );
      }
    },
  });

  if (writerChannel) {
    writerMessage = writerChannel.addMessage({
      encoding: c.string,
      onmessage: async (data) => {
        const announcement = parseWriterAnnouncement(data);
        if (!announcement) {
          return;
        }

        const peerWriterHex = announcement.key;
        currentStore.get({
          key: Buffer.from(peerWriterHex, "hex"),
          active: true,
        });

        if (mode === "reader" || !currentBase.isIndexer) {
          rememberWriterRole(peerWriterHex, announcement.indexer);
          return;
        }

        if (peerWriterHex === currentBase.local.key.toString("hex")) {
          return;
        }

        if (!shouldAppendWriterRole(peerWriterHex, announcement.indexer)) {
          return;
        }

        await currentBase.append(
          {
            addWriter: peerWriterHex,
            indexer: announcement.indexer,
          },
          { optimistic: true },
        );
      },
    });

    writerChannel.open();
  }
}

async function initWorker(
  storageDir: string,
  topicHex: string,
  workerMode: WorkerMode,
  bootstrapKeyHex?: string,
  requestedIndexer?: boolean,
): Promise<void> {
  if (initialized) {
    return;
  }

  mode = workerMode;
  desiredIndexer = workerMode === "writer" && requestedIndexer === true;
  store = new Corestore(storageDir);

  const bootstrapKey = bootstrapKeyHex ? Buffer.from(bootstrapKeyHex, "hex") : null;

  base = new Autobase<Operation, HyperDBInstance>(store, bootstrapKey, {
    valueEncoding: "json",
    optimistic: true,
    ackInterval: 1000,
    open: openView,
    apply: async (nodes, view, host) => {
      await applyOperations(nodes, view, host, rememberWriterRole);
    },
  });

  await base.ready();
  rememberWriterRole(base.local.key.toString("hex"), Boolean(base.isIndexer));

  swarm = new Hyperswarm();
  swarm.join(Buffer.from(topicHex, "hex"), { client: true, server: true });
  swarm.join(base.discoveryKey, { client: true, server: true });

  swarm.on("connection", (connection: unknown) => {
    if (!store) {
      return;
    }

    store.replicate(connection);
    setupProtomuxChannels(connection);
  });

  base.on("update", () => {
    void emitDeltas();
  });

  initialized = true;
}

async function handleCreatePost(msg: CreatePostMessage): Promise<void> {
  ensureWriterMode();
  const payload = requirePostPayload(msg.payload);
  const currentBase = await requireBase();
  await currentBase.append(
    {
      type: "post",
      id: payload.id,
      author: payload.author,
      body: payload.body,
      createdAt: payload.createdAt,
    },
    { optimistic: true },
  );

  send(withRequestId({ type: "ack" }, msg.requestId) as WorkerToHostMessage);
}

async function handleCreateComment(msg: CreateCommentMessage): Promise<void> {
  ensureWriterMode();
  const payload = requireCommentPayload(msg.payload);
  const currentBase = await requireBase();
  await currentBase.append(
    {
      type: "comment",
      id: payload.id,
      postId: payload.postId,
      author: payload.author,
      body: payload.body,
      createdAt: payload.createdAt,
    },
    { optimistic: true },
  );

  send(withRequestId({ type: "ack" }, msg.requestId) as WorkerToHostMessage);
}

async function handleRegisterAgent(msg: RegisterAgentMessage): Promise<void> {
  ensureWriterMode();
  const payload = requireAgentPayload(msg.payload);
  const currentBase = await requireBase();
  await currentBase.append(
    {
      type: "registerAgent",
      name: payload.name,
      personality: payload.personality,
    },
    { optimistic: true },
  );

  send(withRequestId({ type: "ack" }, msg.requestId) as WorkerToHostMessage);
}

async function handleListPosts(msg: ListPostsMessage): Promise<void> {
  const currentBase = await requireBase();
  const options = {
    ...(typeof msg.payload?.limit === "number" ? { limit: msg.payload.limit } : {}),
    ...(msg.payload?.before ? { before: msg.payload.before } : {}),
  };
  const postPage = await listPostsFromBase(currentBase, {
    ...options,
  });
  send(
    withRequestId(
      {
        type: "postList",
        payload: postPage,
      },
      msg.requestId,
    ) as WorkerToHostMessage,
  );
}

async function handleGetPost(msg: GetPostMessage): Promise<void> {
  const postId = requirePostIdPayload(msg.payload);
  const currentBase = await requireBase();
  const postRaw = await currentBase.view.get("@qitter/posts", { id: postId });
  const post = postRaw !== null && isPost(postRaw) ? postRaw : null;
  const comments = await listCommentsForPost(postId);

  send(
    withRequestId(
      {
        type: "postDetail",
        payload: { post, comments },
      },
      msg.requestId,
    ) as WorkerToHostMessage,
  );
}

async function handleGetAgent(msg: GetAgentMessage): Promise<void> {
  const name = requireAgentNamePayload(msg.payload);
  const profile = await getAgentProfile(name);
  send(
    withRequestId(
      {
        type: "agentProfile",
        payload: profile,
      },
      msg.requestId,
    ) as WorkerToHostMessage,
  );
}

async function handleShutdown(requestId?: string): Promise<void> {
  if (swarm) {
    await swarm.destroy();
  }

  if (store) {
    await store.close();
  }

  send(withRequestId({ type: "ack" }, requestId) as WorkerToHostMessage);
}

async function routeMessage(msg: HostToWorkerMessage): Promise<void> {
  switch (msg.type) {
    case "initWorker": {
      await initWorker(
        msg.payload.storageDir,
        msg.payload.topic,
        msg.payload.mode ?? "writer",
        msg.payload.bootstrapKey,
        msg.payload.isIndexer,
      );
      if (!base) {
        throw new Error("Worker failed to initialize Autobase.");
      }

      send(
        withRequestId(
          {
            type: "isReady",
            payload: {
              baseKey: base.key.toString("hex"),
              localKey: base.local.key.toString("hex"),
              isIndexer: Boolean(base.isIndexer),
            },
          },
          msg.requestId,
        ) as WorkerToHostMessage,
      );
      return;
    }
    case "createPost": {
      await handleCreatePost(msg);
      return;
    }
    case "createComment": {
      await handleCreateComment(msg);
      return;
    }
    case "registerAgent": {
      await handleRegisterAgent(msg);
      return;
    }
    case "listPosts": {
      await handleListPosts(msg);
      return;
    }
    case "getPost": {
      await handleGetPost(msg);
      return;
    }
    case "getAgent": {
      await handleGetAgent(msg);
      return;
    }
    case "shutdownWorker": {
      await handleShutdown(msg.requestId);
      return;
    }
  }
}

Bare.IPC.on("data", (chunk) => {
  ipcBuffer += chunk.toString();
  const lines = ipcBuffer.split("\n");
  ipcBuffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as HostToWorkerMessage;
      void routeMessage(parsed).catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown worker error";
        sendError(message, parsed.requestId);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid IPC JSON payload";
      sendError(message);
    }
  }
});
