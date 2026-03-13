import { notFoundError, validationError } from "./errors";
import { createSortableId } from "./id";
import type { IpcClient } from "./ipc-client";
import type { AgentProfile, Comment, Post } from "./types";

export class InteractiveAgentGateway {
  private identity: AgentProfile | null = null;
  private registeredSnapshot: string | null = null;

  constructor(
    private readonly writerClient: IpcClient,
    private readonly queryClient: IpcClient,
  ) {}

  getIdentity(): AgentProfile | null {
    return this.identity;
  }

  async setIdentity(input: {
    name: string;
    personality: string;
  }): Promise<AgentProfile> {
    const identity = normalizeIdentity(input);

    this.identity = identity;
    await this.ensureRegistered(identity);

    return identity;
  }

  async createPost(body: string): Promise<Post> {
    const identity = await this.requireIdentity();
    const normalizedBody = normalizeBody(body, 220, "Post body");

    const post: Post = {
      id: createSortableId(),
      author: identity.name,
      body: normalizedBody,
      createdAt: Date.now(),
    };

    await this.writerClient.requestByType(
      {
        type: "createPost",
        payload: post,
      },
      "ack",
    );

    return post;
  }

  async createComment(postId: string, body: string): Promise<Comment> {
    const identity = await this.requireIdentity();
    const normalizedPostId = postId.trim();
    if (!normalizedPostId) {
      throw validationError("Post id is required.");
    }

    const postResponse = await this.queryClient.requestByType(
      {
        type: "getPost",
        payload: { postId: normalizedPostId },
      },
      "postDetail",
    );

    if (!postResponse.payload.post) {
      throw notFoundError("Target post not found.");
    }

    const comment: Comment = {
      id: createSortableId(),
      postId: normalizedPostId,
      author: identity.name,
      body: normalizeBody(body, 180, "Comment body"),
      createdAt: Date.now(),
    };

    await this.writerClient.requestByType(
      {
        type: "createComment",
        payload: comment,
      },
      "ack",
    );

    return comment;
  }

  private async requireIdentity(): Promise<AgentProfile> {
    if (!this.identity) {
      throw validationError("Create your interactive agent before publishing.");
    }

    await this.ensureRegistered(this.identity);
    return this.identity;
  }

  private async ensureRegistered(identity: AgentProfile): Promise<void> {
    const snapshot = serializeIdentity(identity);
    if (this.registeredSnapshot === snapshot) {
      return;
    }

    await this.writerClient.requestByType(
      {
        type: "registerAgent",
        payload: identity,
      },
      "ack",
    );

    this.registeredSnapshot = snapshot;
  }
}

function serializeIdentity(identity: AgentProfile): string {
  return `${identity.name}\n${identity.personality}`;
}

function normalizeIdentity(input: {
  name: string;
  personality: string;
}): AgentProfile {
  const normalizedName = input.name.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "guestagent";
  const personality = normalizeBody(input.personality, 240, "Personality");

  return {
    name: normalizedName,
    personality,
  };
}

function normalizeBody(value: string, maxLength: number, label: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw validationError(`${label} cannot be empty.`);
  }

  return normalized.slice(0, maxLength);
}
