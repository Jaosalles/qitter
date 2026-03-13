import { describe, expect, it } from "vitest";
import { InteractiveAgentGateway } from "./interactive-agent";
import type { HostRequest, WorkerMessage } from "./types";

type MessageOfType<TType extends WorkerMessage["type"]> = Extract<WorkerMessage, { type: TType }>;

class StatefulWorkerClient {
  posts = new Map<string, { id: string; author: string; body: string; createdAt: number }>();
  comments = new Map<
    string,
    {
      id: string;
      postId: string;
      author: string;
      body: string;
      createdAt: number;
    }
  >();
  agents = new Map<string, { name: string; personality: string }>();

  async requestByType<TType extends WorkerMessage["type"]>(
    request: HostRequest,
    expectedType: TType,
  ): Promise<MessageOfType<TType>> {
    if (request.type === "registerAgent" && expectedType === "ack") {
      this.agents.set(request.payload.name, request.payload);
      return { type: "ack" } as MessageOfType<TType>;
    }

    if (request.type === "createPost" && expectedType === "ack") {
      this.posts.set(request.payload.id, request.payload);
      return { type: "ack" } as MessageOfType<TType>;
    }

    if (request.type === "createComment" && expectedType === "ack") {
      this.comments.set(request.payload.id, request.payload);
      return { type: "ack" } as MessageOfType<TType>;
    }

    if (request.type === "getPost" && expectedType === "postDetail") {
      const post = this.posts.get(request.payload.postId) ?? null;
      const comments = Array.from(this.comments.values()).filter(
        (comment) => comment.postId === request.payload.postId,
      );
      return {
        type: "postDetail",
        payload: {
          post,
          comments,
        },
      } as MessageOfType<TType>;
    }

    throw new Error(`Unhandled request: ${request.type}`);
  }
}

describe("InteractiveAgentGateway", () => {
  it("executes register -> create post -> create comment flow", async () => {
    const writer = new StatefulWorkerClient();
    const query = writer;
    const gateway = new InteractiveAgentGateway(writer as never, query as never);

    await gateway.setIdentity({
      name: "meshpilot",
      personality: "focused and concise",
    });

    const post = await gateway.createPost("hello from human");
    const comment = await gateway.createComment(post.id, "a grounded reply");

    expect(post.author).toBe("meshpilot");
    expect(comment.postId).toBe(post.id);
    expect(writer.agents.get("meshpilot")?.personality).toContain("focused");
    expect(writer.posts.get(post.id)?.body).toBe("hello from human");
    expect(writer.comments.get(comment.id)?.body).toBe("a grounded reply");
  });

  it("rejects comment when target post does not exist", async () => {
    const writer = new StatefulWorkerClient();
    const query = writer;
    const gateway = new InteractiveAgentGateway(writer as never, query as never);

    await gateway.setIdentity({
      name: "meshpilot",
      personality: "focused and concise",
    });

    await expect(gateway.createComment("missing-post", "reply")).rejects.toThrow(
      "Target post not found.",
    );
  });
});
