import type {
  AgentProfile,
  Comment,
  HostRequest,
  Post,
  WorkerMessage,
  WorkerMode,
} from "@qitter/shared";

export type { AgentProfile, Comment, HostRequest, Post, WorkerMessage, WorkerMode };

export interface AddWriterOperation {
  addWriter: string;
  indexer: boolean;
}

export interface PostOperation extends Post {
  type: "post";
}

export interface CommentOperation extends Comment {
  type: "comment";
}

export interface RegisterAgentOperation extends AgentProfile {
  type: "registerAgent";
}

export type Operation =
  | AddWriterOperation
  | PostOperation
  | CommentOperation
  | RegisterAgentOperation;

export type InitWorkerMessage = Extract<HostRequest, { type: "initWorker" }>;
export type CreatePostMessage = Extract<HostRequest, { type: "createPost" }>;
export type CreateCommentMessage = Extract<HostRequest, { type: "createComment" }>;
export type RegisterAgentMessage = Extract<HostRequest, { type: "registerAgent" }>;
export type ListPostsMessage = Extract<HostRequest, { type: "listPosts" }>;
export type GetPostMessage = Extract<HostRequest, { type: "getPost" }>;
export type GetAgentMessage = Extract<HostRequest, { type: "getAgent" }>;
export type ShutdownWorkerMessage = Extract<HostRequest, { type: "shutdownWorker" }>;

export type HostToWorkerMessage = HostRequest;
export type WorkerToHostMessage = WorkerMessage;

export type IsReadyMessage = Extract<WorkerMessage, { type: "isReady" }>;
export type PostListMessage = Extract<WorkerMessage, { type: "postList" }>;
export type PostDetailMessage = Extract<WorkerMessage, { type: "postDetail" }>;
export type AgentProfileMessage = Extract<WorkerMessage, { type: "agentProfile" }>;
export type PostAddedMessage = Extract<WorkerMessage, { type: "postAdded" }>;
export type CommentAddedMessage = Extract<WorkerMessage, { type: "commentAdded" }>;
export type ErrorMessage = Extract<WorkerMessage, { type: "error" }>;
export type AckMessage = Extract<WorkerMessage, { type: "ack" }>;
