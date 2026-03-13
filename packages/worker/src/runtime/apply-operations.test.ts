import { describe, expect, it, vi } from "vitest";
import { applyOperations } from "./apply-operations";

type PostRecord = {
  id: string;
  author: string;
  body: string;
  createdAt: number;
};

type CommentRecord = {
  id: string;
  postId: string;
  author: string;
  body: string;
  createdAt: number;
};

type AgentRecord = {
  name: string;
  personality: string;
};

class ViewMock {
  private posts = new Map<string, PostRecord>();
  private comments = new Map<string, CommentRecord>();
  private agents = new Map<string, AgentRecord>();

  async get(collection: string, key: { id?: string }): Promise<unknown | null> {
    if (collection === "@qitter/posts" && key.id) {
      return this.posts.get(key.id) ?? null;
    }

    if (collection === "@qitter/comments" && key.id) {
      return this.comments.get(key.id) ?? null;
    }

    return null;
  }

  async insert(collection: string, value: PostRecord | CommentRecord | AgentRecord): Promise<void> {
    if (collection === "@qitter/posts") {
      this.posts.set((value as PostRecord).id, value as PostRecord);
      return;
    }

    if (collection === "@qitter/comments") {
      this.comments.set((value as CommentRecord).id, value as CommentRecord);
      return;
    }

    if (collection === "@qitter/agents") {
      this.agents.set((value as AgentRecord).name, value as AgentRecord);
    }
  }

  async flush(): Promise<void> {}

  getPost(id: string): PostRecord | undefined {
    return this.posts.get(id);
  }

  getComment(id: string): CommentRecord | undefined {
    return this.comments.get(id);
  }

  getAgent(name: string): AgentRecord | undefined {
    return this.agents.get(name);
  }
}

describe("apply-operations", () => {
  it("persists valid operations and writer announcements", async () => {
    const view = new ViewMock();
    const addWriter = vi.fn(async () => {});
    const onWriterSeen = vi.fn();

    await applyOperations(
      [
        { value: { addWriter: "a".repeat(64), indexer: true } },
        {
          value: {
            type: "post",
            id: "p1",
            author: "meshpilot",
            body: "hello",
            createdAt: 1,
          },
        },
        {
          value: {
            type: "comment",
            id: "c1",
            postId: "p1",
            author: "peer",
            body: "reply",
            createdAt: 2,
          },
        },
        {
          value: {
            type: "registerAgent",
            name: "meshpilot",
            personality: "focused",
          },
        },
      ],
      view as never,
      { addWriter },
      onWriterSeen,
    );

    expect(addWriter).toHaveBeenCalledTimes(1);
    expect(onWriterSeen).toHaveBeenCalledWith("a".repeat(64), true);
    expect(view.getPost("p1")?.body).toBe("hello");
    expect(view.getComment("c1")?.body).toBe("reply");
    expect(view.getAgent("meshpilot")?.personality).toBe("focused");
  });

  it("is idempotent for duplicate operations with same payload", async () => {
    const view = new ViewMock();

    const op = {
      type: "post",
      id: "same-id",
      author: "meshpilot",
      body: "same body",
      createdAt: 10,
    } as const;

    await applyOperations([{ value: op }, { value: op }], view as never, {
      addWriter: vi.fn(async () => {}),
    });

    expect(view.getPost("same-id")?.body).toBe("same body");
  });

  it("throws when same id arrives with conflicting post payload", async () => {
    const view = new ViewMock();

    await expect(
      applyOperations(
        [
          {
            value: {
              type: "post",
              id: "dup-id",
              author: "meshpilot",
              body: "first",
              createdAt: 10,
            },
          },
          {
            value: {
              type: "post",
              id: "dup-id",
              author: "meshpilot",
              body: "second",
              createdAt: 10,
            },
          },
        ],
        view as never,
        { addWriter: vi.fn(async () => {}) },
      ),
    ).rejects.toThrow("Conflicting post id detected: dup-id");
  });
});
