import type { AgentProfile, Comment, Post } from "../types";
import { isAgentProfile, isComment, isPost, isRecord } from "./guards";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function requirePostPayload(payload: unknown): Post {
  if (!isPost(payload)) {
    throw new Error("Invalid createPost payload.");
  }

  return payload;
}

export function requireCommentPayload(payload: unknown): Comment {
  if (!isComment(payload)) {
    throw new Error("Invalid createComment payload.");
  }

  return payload;
}

export function requireAgentPayload(payload: unknown): AgentProfile {
  if (!isAgentProfile(payload)) {
    throw new Error("Invalid registerAgent payload.");
  }

  return payload;
}

export function requirePostIdPayload(payload: unknown): string {
  if (!isRecord(payload) || !isNonEmptyString(payload.postId)) {
    throw new Error("Invalid getPost payload.");
  }

  return payload.postId;
}

export function requireAgentNamePayload(payload: unknown): string {
  if (!isRecord(payload) || !isNonEmptyString(payload.name)) {
    throw new Error("Invalid getAgent payload.");
  }

  return payload.name;
}
