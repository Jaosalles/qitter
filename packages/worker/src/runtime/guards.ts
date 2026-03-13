import type { AgentProfile, Comment, Post } from "../types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPost(value: unknown): value is Post {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.author === "string" &&
    typeof value.body === "string" &&
    typeof value.createdAt === "number"
  );
}

export function isComment(value: unknown): value is Comment {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.postId === "string" &&
    typeof value.author === "string" &&
    typeof value.body === "string" &&
    typeof value.createdAt === "number"
  );
}

export function isAgentProfile(value: unknown): value is AgentProfile {
  if (!isRecord(value)) return false;
  return typeof value.name === "string" && typeof value.personality === "string";
}
