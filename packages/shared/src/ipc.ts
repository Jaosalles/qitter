import type { AgentProfile, Comment, Post } from "./domain";

export interface WorkerEnvelope<T extends string, P> {
  type: T;
  requestId?: string;
  payload: P;
}

export type WorkerMode = "writer" | "reader";

export type HostRequest =
  | WorkerEnvelope<
      "initWorker",
      {
        storageDir: string;
        bootstrapKey?: string;
        topic: string;
        mode?: WorkerMode;
        isIndexer?: boolean;
      }
    >
  | WorkerEnvelope<
      "createPost",
      {
        id: string;
        author: string;
        body: string;
        createdAt: number;
      }
    >
  | WorkerEnvelope<
      "createComment",
      {
        id: string;
        postId: string;
        author: string;
        body: string;
        createdAt: number;
      }
    >
  | WorkerEnvelope<
      "registerAgent",
      {
        name: string;
        personality: string;
      }
    >
  | {
      type: "listPosts";
      requestId?: string;
      payload?: {
        limit?: number;
        before?: string;
      };
    }
  | WorkerEnvelope<
      "getPost",
      {
        postId: string;
      }
    >
  | WorkerEnvelope<
      "getAgent",
      {
        name: string;
      }
    >
  | {
      type: "shutdownWorker";
      requestId?: string;
    };

export type WorkerMessage =
  | WorkerEnvelope<
      "isReady",
      {
        baseKey: string;
        localKey: string;
        isIndexer: boolean;
      }
    >
  | WorkerEnvelope<"postList", { posts: Post[]; nextCursor: string | null; hasMore: boolean }>
  | WorkerEnvelope<"postDetail", { post: Post | null; comments: Comment[] }>
  | WorkerEnvelope<
      "agentProfile",
      { agent: AgentProfile | null; posts: Post[]; comments: Comment[] }
    >
  | WorkerEnvelope<"postAdded", { post: Post }>
  | WorkerEnvelope<"commentAdded", { comment: Comment }>
  | WorkerEnvelope<"error", { message: string }>
  | {
      type: "ack";
      requestId?: string;
    };
