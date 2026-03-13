import { describe, expect, it, vi } from "vitest";
import type { InteractiveAgentGateway } from "../interactive-agent";
import type { IpcClient } from "../ipc-client";
import { ApiService } from "./api-service";

describe("ApiService", () => {
  it("delegates list/get queries to worker client", async () => {
    const workerClient = {
      requestByType: vi.fn(async (request, expectedType) => {
        if (request.type === "listPosts" && expectedType === "postList") {
          return {
            type: "postList",
            payload: {
              posts: [{ id: "p1", author: "a", body: "hello", createdAt: 1 }],
              nextCursor: null,
              hasMore: false,
            },
          };
        }

        if (request.type === "getPost" && expectedType === "postDetail") {
          return {
            type: "postDetail",
            payload: {
              post: { id: "p1", author: "a", body: "hello", createdAt: 1 },
              comments: [],
            },
          };
        }

        if (request.type === "getAgent" && expectedType === "agentProfile") {
          return {
            type: "agentProfile",
            payload: {
              agent: { name: "meshpilot", personality: "focused" },
              posts: [],
              comments: [],
            },
          };
        }

        throw new Error("unexpected request");
      }),
    } as unknown as IpcClient;

    const interactiveAgent = {
      getIdentity: vi.fn(() => ({ name: "interactive", personality: "calm" })),
      setIdentity: vi.fn(async (input: { name: string; personality: string }) => input),
      createPost: vi.fn(async (body: string) => ({
        id: "new-post",
        author: "interactive",
        body,
        createdAt: 2,
      })),
      createComment: vi.fn(async (postId: string, body: string) => ({
        id: "new-comment",
        postId,
        author: "interactive",
        body,
        createdAt: 3,
      })),
    } as unknown as InteractiveAgentGateway;

    const service = new ApiService(workerClient, interactiveAgent);

    const posts = await service.listPosts();
    const detail = await service.getPost("p1");
    const profile = await service.getAgent("meshpilot");

    expect(posts.posts).toHaveLength(1);
    expect(detail.post?.id).toBe("p1");
    expect(profile.agent?.name).toBe("meshpilot");
  });

  it("delegates interactive identity and publishing operations", async () => {
    const workerClient = {
      requestByType: vi.fn(),
    } as unknown as IpcClient;

    const interactiveAgent = {
      getIdentity: vi.fn(() => ({ name: "interactive", personality: "calm" })),
      setIdentity: vi.fn(async (input: { name: string; personality: string }) => input),
      createPost: vi.fn(async (body: string) => ({
        id: "new-post",
        author: "interactive",
        body,
        createdAt: 2,
      })),
      createComment: vi.fn(async (postId: string, body: string) => ({
        id: "new-comment",
        postId,
        author: "interactive",
        body,
        createdAt: 3,
      })),
    } as unknown as InteractiveAgentGateway;

    const service = new ApiService(workerClient, interactiveAgent);

    const identity = service.getInteractiveAgent();
    const updated = await service.setInteractiveAgent({
      name: "meshpilot",
      personality: "focused",
    });
    const post = await service.createPost("manual post");
    const comment = await service.createComment("p1", "manual comment");

    expect(identity.agent?.name).toBe("interactive");
    expect(updated.agent.name).toBe("meshpilot");
    expect(post.id).toBe("new-post");
    expect(comment.postId).toBe("p1");
  });

  it("propagates worker and gateway failures", async () => {
    const workerClient = {
      requestByType: vi.fn(async () => {
        throw new Error("worker failed");
      }),
    } as unknown as IpcClient;

    const interactiveAgent = {
      getIdentity: vi.fn(() => null),
      setIdentity: vi.fn(async () => {
        throw new Error("identity failed");
      }),
      createPost: vi.fn(async () => {
        throw new Error("post failed");
      }),
      createComment: vi.fn(async () => {
        throw new Error("comment failed");
      }),
    } as unknown as InteractiveAgentGateway;

    const service = new ApiService(workerClient, interactiveAgent);

    await expect(service.listPosts()).rejects.toThrow("worker failed");
    await expect(service.setInteractiveAgent({ name: "a", personality: "b" })).rejects.toThrow(
      "identity failed",
    );
    await expect(service.createPost("x")).rejects.toThrow("post failed");
    await expect(service.createComment("p", "x")).rejects.toThrow("comment failed");
  });
});
