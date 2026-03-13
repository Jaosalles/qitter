import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "./errors";
import type { InteractiveAgentGateway } from "./interactive-agent";
import type { IpcClient } from "./ipc-client";
import { startApiServer } from "./server";
import type { HostRequest, WorkerMessage } from "./types";

type Listener = (message: WorkerMessage) => void;

class FakeWorkerClient {
  private listeners = new Map<WorkerMessage["type"], Set<Listener>>();

  on(type: WorkerMessage["type"], listener: Listener): () => void {
    const bucket = this.listeners.get(type) ?? new Set<Listener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);

    return () => {
      const current = this.listeners.get(type);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  async requestByType<TType extends WorkerMessage["type"]>(
    request: HostRequest,
    expectedType: TType,
  ): Promise<Extract<WorkerMessage, { type: TType }>> {
    if (request.type === "listPosts" && expectedType === "postList") {
      return {
        type: "postList",
        payload: {
          posts: [
            {
              id: "p1",
              author: "meshpilot",
              body: "hello from tests",
              createdAt: 10,
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
      } as unknown as Extract<WorkerMessage, { type: TType }>;
    }

    if (request.type === "getAgent" && expectedType === "agentProfile") {
      return {
        type: "agentProfile",
        payload: {
          agent: {
            name: request.payload.name,
            personality: "focused",
          },
          posts: [
            {
              id: "p-agent-1",
              author: request.payload.name,
              body: "agent authored post",
              createdAt: 11,
            },
          ],
          comments: [
            {
              id: "c-agent-1",
              postId: "p1",
              author: request.payload.name,
              body: "agent authored comment",
              createdAt: 12,
            },
          ],
        },
      } as unknown as Extract<WorkerMessage, { type: TType }>;
    }

    if (request.type === "getPost" && expectedType === "postDetail") {
      return {
        type: "postDetail",
        payload: {
          post: {
            id: request.payload.postId,
            author: "meshpilot",
            body: "thread body",
            createdAt: 10,
          },
          comments: [
            {
              id: "c1",
              postId: request.payload.postId,
              author: "interactive",
              body: "thread comment",
              createdAt: 13,
            },
          ],
        },
      } as unknown as Extract<WorkerMessage, { type: TType }>;
    }

    throw new Error(`Unhandled request in fake worker: ${request.type}`);
  }

  emit(message: WorkerMessage): void {
    const bucket = this.listeners.get(message.type);
    if (!bucket) {
      return;
    }

    for (const listener of bucket) {
      listener(message);
    }
  }
}

class FakeInteractiveAgentGateway {
  getIdentity() {
    return {
      name: "interactive",
      personality: "calm",
    };
  }

  async setIdentity(input: { name: string; personality: string }) {
    return {
      name: input.name,
      personality: input.personality,
    };
  }

  async createPost(body: string) {
    return {
      id: "new-post",
      author: "interactive",
      body,
      createdAt: 20,
    };
  }

  async createComment(postId: string, body: string) {
    return {
      id: "new-comment",
      postId,
      author: "interactive",
      body,
      createdAt: 30,
    };
  }
}

async function withServer(
  testFn: (baseUrl: string, worker: FakeWorkerClient) => Promise<void>,
): Promise<void> {
  const port = 4100 + Math.floor(Math.random() * 500);
  const worker = new FakeWorkerClient();
  const server = startApiServer(
    worker as unknown as IpcClient,
    new FakeInteractiveAgentGateway() as unknown as InteractiveAgentGateway,
    port,
  );

  try {
    await testFn(`http://localhost:${port}`, worker);
  } finally {
    await server.close();
  }
}

async function withServerDeps(
  worker: FakeWorkerClient,
  interactiveAgent: InteractiveAgentGateway,
  testFn: (baseUrl: string, currentWorker: FakeWorkerClient) => Promise<void>,
): Promise<void> {
  const port = 4100 + Math.floor(Math.random() * 500);
  const server = startApiServer(worker as unknown as IpcClient, interactiveAgent, port);

  try {
    await testFn(`http://localhost:${port}`, worker);
  } finally {
    await server.close();
  }
}

class FailingInteractiveAgentGateway extends FakeInteractiveAgentGateway {
  override async createPost(): Promise<never> {
    throw new Error("publish failed");
  }
}

class AppErrorWorkerClient extends FakeWorkerClient {
  override async requestByType<TType extends WorkerMessage["type"]>(
    request: HostRequest,
    expectedType: TType,
  ): Promise<Extract<WorkerMessage, { type: TType }>> {
    if (request.type === "getPost" && expectedType === "postDetail") {
      throw new AppError("NOT_FOUND", "Post not found.", 404);
    }

    return super.requestByType(request, expectedType);
  }
}

async function readSseEvents(response: Response, expectedCount: number): Promise<string[]> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("SSE response did not include a readable body.");
  }

  const decoder = new TextDecoder();
  const events: string[] = [];
  let buffer = "";

  while (events.length < expectedCount) {
    const chunk = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timed out waiting for SSE data.")), 1500);
      }),
    ]);

    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });

    while (buffer.includes("\n\n")) {
      const splitIndex = buffer.indexOf("\n\n");
      const block = buffer.slice(0, splitIndex);
      buffer = buffer.slice(splitIndex + 2);

      for (const line of block.split("\n")) {
        if (line.startsWith("data: ")) {
          events.push(line.slice(6));
          if (events.length >= expectedCount) {
            break;
          }
        }
      }
    }
  }

  reader.releaseLock();
  return events;
}

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
});

describe("API server", () => {
  it("returns posts from GET /api/posts", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/posts`);
      const json = (await response.json()) as {
        posts: Array<{ body: string }>;
        nextCursor: string | null;
        hasMore: boolean;
      };

      expect(response.status).toBe(200);
      expect(json.posts).toHaveLength(1);
      expect(json.posts[0]?.body).toBe("hello from tests");
      expect(json.nextCursor).toBeNull();
      expect(json.hasMore).toBe(false);
    });
  });

  it("returns validation error for invalid POST /api/posts payload", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wrong: true }),
      });

      const json = (await response.json()) as { error: string; code: string };

      expect(response.status).toBe(400);
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.error).toContain("Invalid post payload");
    });
  });

  it("returns validation error for invalid GET /api/posts limit query", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/posts?limit=0`);
      const json = (await response.json()) as { error: string; code: string };

      expect(response.status).toBe(400);
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.error).toContain("limit");
    });
  });

  it("returns interactive identity on GET /api/interactive-agent", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/interactive-agent`);
      const json = (await response.json()) as {
        agent: { name: string; personality: string };
      };

      expect(response.status).toBe(200);
      expect(json.agent.name).toBe("interactive");
    });
  });

  it("returns thread detail on GET /api/posts/:id", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/posts/post-77`);
      const json = (await response.json()) as {
        post: { id: string; body: string };
        comments: Array<{ postId: string }>;
      };

      expect(response.status).toBe(200);
      expect(json.post.id).toBe("post-77");
      expect(json.comments[0]?.postId).toBe("post-77");
    });
  });

  it("returns agent profile on GET /api/agents/:name", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/agents/meshpilot`);
      const json = (await response.json()) as {
        agent: { name: string };
        posts: Array<{ author: string }>;
        comments: Array<{ author: string }>;
      };

      expect(response.status).toBe(200);
      expect(json.agent.name).toBe("meshpilot");
      expect(json.posts[0]?.author).toBe("meshpilot");
      expect(json.comments[0]?.author).toBe("meshpilot");
    });
  });

  it("creates interactive post on POST /api/posts", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: "manual post" }),
      });

      const json = (await response.json()) as {
        id: string;
        author: string;
        body: string;
      };

      expect(response.status).toBe(201);
      expect(json.id).toBe("new-post");
      expect(json.author).toBe("interactive");
      expect(json.body).toBe("manual post");
    });
  });

  it("creates interactive comment on POST /api/posts/:id/comments", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/posts/post-99/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: "manual comment" }),
      });

      const json = (await response.json()) as {
        id: string;
        postId: string;
        body: string;
      };

      expect(response.status).toBe(201);
      expect(json.id).toBe("new-comment");
      expect(json.postId).toBe("post-99");
      expect(json.body).toBe("manual comment");
    });
  });

  it("returns validation error for invalid comment payload", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/posts/post-9/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invalid: true }),
      });

      const json = (await response.json()) as { error: string; code: string };

      expect(response.status).toBe(400);
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.error).toContain("Invalid comment payload");
    });
  });

  it("streams ready and worker events to all SSE clients", async () => {
    await withServer(async (baseUrl, worker) => {
      const streamA = await fetch(`${baseUrl}/api/events`);
      const streamB = await fetch(`${baseUrl}/api/events`);

      worker.emit({
        type: "postAdded",
        payload: {
          post: {
            id: "p-live",
            author: "meshpilot",
            body: "live post",
            createdAt: 40,
          },
        },
      });

      const [eventsA, eventsB] = await Promise.all([
        readSseEvents(streamA, 2),
        readSseEvents(streamB, 2),
      ]);

      expect(JSON.parse(eventsA[0] ?? "{}")).toEqual({ type: "ready" });
      expect(JSON.parse(eventsB[0] ?? "{}")).toEqual({ type: "ready" });

      const eventA = JSON.parse(eventsA[1] ?? "{}") as {
        type: string;
        payload: { post: { id: string } };
      };
      const eventB = JSON.parse(eventsB[1] ?? "{}") as {
        type: string;
        payload: { post: { id: string } };
      };

      expect(eventA.type).toBe("postAdded");
      expect(eventA.payload.post.id).toBe("p-live");
      expect(eventB.type).toBe("postAdded");
      expect(eventB.payload.post.id).toBe("p-live");
    });
  });

  it("maps unexpected failures to 500 INTERNAL_ERROR shape", async () => {
    await withServerDeps(
      new FakeWorkerClient(),
      new FailingInteractiveAgentGateway() as unknown as InteractiveAgentGateway,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/posts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body: "manual post" }),
        });

        const json = (await response.json()) as { error: string; code: string };

        expect(response.status).toBe(500);
        expect(json.code).toBe("INTERNAL_ERROR");
        expect(json.error).toContain("publish failed");
      },
    );
  });

  it("maps AppError failures to typed status/code shape", async () => {
    await withServerDeps(
      new AppErrorWorkerClient(),
      new FakeInteractiveAgentGateway() as unknown as InteractiveAgentGateway,
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/posts/post-missing`);
        const json = (await response.json()) as { error: string; code: string };

        expect(response.status).toBe(404);
        expect(json.code).toBe("NOT_FOUND");
        expect(json.error).toContain("Post not found");
      },
    );
  });
});
