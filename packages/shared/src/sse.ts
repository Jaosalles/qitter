import type { Comment, Post } from "./domain";

export interface SseMessage {
  type: "postAdded" | "commentAdded" | "ready";
  payload?: {
    post?: Post;
    comment?: Comment;
  };
}
