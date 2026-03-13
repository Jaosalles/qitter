import type { HyperDBInstance } from "hyperdb";
import type { Comment, Operation, Post } from "../types";
import { isAgentProfile, isComment, isPost, isRecord } from "./guards";
import { isIgnorableAddWriterError } from "./writer-announcement";

export type NodeLike = { value: unknown };

export type HostLike = {
  addWriter: (key: Buffer, opts: { indexer: boolean }) => Promise<void>;
};

function isSamePostRecord(
  a: unknown,
  b: { id: string; author: string; body: string; createdAt: number },
) {
  return (
    isPost(a) &&
    a.id === b.id &&
    a.author === b.author &&
    a.body === b.body &&
    a.createdAt === b.createdAt
  );
}

function isSameCommentRecord(
  a: unknown,
  b: {
    id: string;
    postId: string;
    author: string;
    body: string;
    createdAt: number;
  },
) {
  return (
    isComment(a) &&
    a.id === b.id &&
    a.postId === b.postId &&
    a.author === b.author &&
    a.body === b.body &&
    a.createdAt === b.createdAt
  );
}

async function insertUniquePost(view: HyperDBInstance, post: Post) {
  const existing = await view.get("@qitter/posts", { id: post.id });
  if (existing === null) {
    await view.insert("@qitter/posts", {
      id: post.id,
      author: post.author,
      body: post.body,
      createdAt: post.createdAt,
    });
    return;
  }

  if (!isSamePostRecord(existing, post)) {
    throw new Error(`Conflicting post id detected: ${post.id}`);
  }
}

async function insertUniqueComment(view: HyperDBInstance, comment: Comment) {
  const existing = await view.get("@qitter/comments", { id: comment.id });
  if (existing === null) {
    await view.insert("@qitter/comments", {
      id: comment.id,
      postId: comment.postId,
      author: comment.author,
      body: comment.body,
      createdAt: comment.createdAt,
    });
    return;
  }

  if (!isSameCommentRecord(existing, comment)) {
    throw new Error(`Conflicting comment id detected: ${comment.id}`);
  }
}

export async function applyOperations(
  nodes: NodeLike[],
  view: HyperDBInstance,
  host: HostLike,
  onWriterSeen?: (keyHex: string, indexer: boolean) => void,
): Promise<void> {
  for (const node of nodes) {
    const op = node.value;
    if (!isRecord(op)) {
      continue;
    }

    const addWriterCandidate = op.addWriter;
    if (typeof addWriterCandidate === "string" && addWriterCandidate.length === 64) {
      const indexer = typeof op.indexer === "boolean" ? op.indexer : true;
      onWriterSeen?.(addWriterCandidate, indexer);

      try {
        await host.addWriter(Buffer.from(addWriterCandidate, "hex"), {
          indexer,
        });
      } catch (error) {
        if (!isIgnorableAddWriterError(error)) {
          throw error;
        }
      }

      continue;
    }

    if (op.type === "post" && isPost(op)) {
      await insertUniquePost(view, op);
      continue;
    }

    if (op.type === "comment" && isComment(op)) {
      await insertUniqueComment(view, op);
      continue;
    }

    if (op.type === "registerAgent" && isAgentProfile(op)) {
      await view.insert("@qitter/agents", {
        name: op.name,
        personality: op.personality,
      });
    }
  }

  await view.flush();
}
