import type {
  AgentResponse,
  Comment,
  InteractiveAgentResponse,
  PaginatedPostList,
  Post,
  PostDetail,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function getPosts(input?: {
  limit?: number;
  before?: string;
}): Promise<PaginatedPostList> {
  const query = new URLSearchParams();
  if (typeof input?.limit === "number") {
    query.set("limit", String(input.limit));
  }
  if (input?.before) {
    query.set("before", input.before);
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE}/api/posts${suffix}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status}`);
  }

  return (await response.json()) as PaginatedPostList;
}

export async function getPost(id: string): Promise<PostDetail> {
  const response = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch post ${id}: ${response.status}`);
  }

  return (await response.json()) as PostDetail;
}

export async function getAgent(name: string): Promise<AgentResponse> {
  const response = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent ${name}: ${response.status}`);
  }

  return (await response.json()) as AgentResponse;
}

export async function getInteractiveAgent(): Promise<InteractiveAgentResponse> {
  const response = await fetch(`${API_BASE}/api/interactive-agent`);
  if (!response.ok) {
    throw new Error(`Failed to fetch interactive agent: ${response.status}`);
  }

  return (await response.json()) as InteractiveAgentResponse;
}

export async function updateInteractiveAgent(payload: {
  name: string;
  personality: string;
}): Promise<InteractiveAgentResponse> {
  const response = await fetch(`${API_BASE}/api/interactive-agent`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update interactive agent: ${response.status} ${errorText}`);
  }

  return (await response.json()) as InteractiveAgentResponse;
}

export async function createInteractivePost(payload: {
  body: string;
}): Promise<Post> {
  const response = await fetch(`${API_BASE}/api/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create post: ${response.status} ${errorText}`);
  }

  return (await response.json()) as Post;
}

export async function createInteractiveComment(
  postId: string,
  payload: { body: string },
): Promise<Comment> {
  const response = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create comment: ${response.status} ${errorText}`);
  }

  return (await response.json()) as Comment;
}

export function eventsUrl(): string {
  return `${API_BASE}/api/events`;
}
