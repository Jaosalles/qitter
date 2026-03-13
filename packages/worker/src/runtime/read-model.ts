import type Autobase from "autobase";
import type { HyperDBInstance } from "hyperdb";
import type { AgentProfile, Comment, Operation, Post } from "../types";
import { isAgentProfile, isComment, isPost } from "./guards";

export interface PostListPage {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ListPostOptions {
  limit?: number;
  before?: string;
}

const DEFAULT_POST_LIMIT = 100;
const MAX_POST_LIMIT = 250;

function normalizeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_POST_LIMIT;
  }

  const parsed = Math.floor(limit as number);
  if (parsed <= 0) {
    return DEFAULT_POST_LIMIT;
  }

  return Math.min(parsed, MAX_POST_LIMIT);
}

export async function listAllPostsFromBase(
  currentBase: Autobase<Operation, HyperDBInstance>,
): Promise<Post[]> {
  const raw = await currentBase.view.find("@qitter/posts", {}, { reverse: true }).toArray();
  return raw.filter(isPost);
}

export async function listPostsFromBase(
  currentBase: Autobase<Operation, HyperDBInstance>,
  options?: ListPostOptions,
): Promise<PostListPage> {
  const allPosts = await listAllPostsFromBase(currentBase);

  const before = options?.before;
  const filtered = before ? allPosts.filter((post) => post.id < before) : allPosts;
  const limit = normalizeLimit(options?.limit);
  const posts = filtered.slice(0, limit);
  const hasMore = filtered.length > posts.length;
  const nextCursor = hasMore ? (posts.at(-1)?.id ?? null) : null;

  return {
    posts,
    nextCursor,
    hasMore,
  };
}

export async function listAllCommentsFromBase(
  currentBase: Autobase<Operation, HyperDBInstance>,
): Promise<Comment[]> {
  const raw = await currentBase.view.find("@qitter/comments", {}).toArray();
  return raw.filter(isComment);
}

export async function listCommentsForPostFromBase(
  currentBase: Autobase<Operation, HyperDBInstance>,
  postId: string,
): Promise<Comment[]> {
  const allComments = await listAllCommentsFromBase(currentBase);
  return allComments.filter((comment) => comment.postId === postId);
}

export async function getAgentProfileFromBase(
  currentBase: Autobase<Operation, HyperDBInstance>,
  name: string,
): Promise<{
  agent: AgentProfile | null;
  posts: Post[];
  comments: Comment[];
}> {
  const agentRaw = await currentBase.view.get("@qitter/agents", { name });

  let agent: AgentProfile | null = null;
  if (agentRaw !== null && isAgentProfile(agentRaw)) {
    agent = agentRaw;
  }

  const posts = (await listAllPostsFromBase(currentBase)).filter((post) => post.author === name);
  const comments = (await listAllCommentsFromBase(currentBase)).filter(
    (comment) => comment.author === name,
  );

  return { agent, posts, comments };
}
