import { describe, expect, it } from "vitest";
import {
  getAgentProfileFromBase,
  listAllCommentsFromBase,
  listCommentsForPostFromBase,
  listPostsFromBase,
} from "./read-model";

function createBaseMock(input: {
  posts: unknown[];
  comments: unknown[];
  agentByName?: Record<string, unknown>;
}) {
  return {
    view: {
      find: (collection: string, query?: { postId?: string }, options?: { reverse?: boolean }) => ({
        toArray: async () => {
          if (collection === "@qitter/posts") {
            const posts = [...input.posts];
            return options?.reverse ? posts.reverse() : posts;
          }

          if (collection === "@qitter/comments") {
            const comments = [...input.comments];
            if (query?.postId) {
              return comments.filter(
                (comment) =>
                  typeof comment === "object" &&
                  comment !== null &&
                  "postId" in comment &&
                  (comment as { postId?: string }).postId === query.postId,
              );
            }
            return comments;
          }

          return [];
        },
      }),
      get: async (_collection: string, key: { name: string }) =>
        input.agentByName?.[key.name] ?? null,
    },
  };
}

describe("read-model", () => {
  it("filters invalid post and comment records", async () => {
    const base = createBaseMock({
      posts: [{ id: "p1", author: "a", body: "ok", createdAt: 1 }, { id: "bad-post" }],
      comments: [
        { id: "c1", postId: "p1", author: "a", body: "ok", createdAt: 2 },
        { id: "bad-comment" },
      ],
    });

    const posts = await listPostsFromBase(base as never);
    const comments = await listAllCommentsFromBase(base as never);

    expect(posts.posts).toHaveLength(1);
    expect(posts.posts[0]?.id).toBe("p1");
    expect(posts.hasMore).toBe(false);
    expect(posts.nextCursor).toBeNull();
    expect(comments).toHaveLength(1);
    expect(comments[0]?.id).toBe("c1");
  });

  it("returns comments only for requested post", async () => {
    const base = createBaseMock({
      posts: [],
      comments: [
        { id: "c1", postId: "p1", author: "a", body: "one", createdAt: 1 },
        { id: "c2", postId: "p2", author: "b", body: "two", createdAt: 2 },
      ],
    });

    const comments = await listCommentsForPostFromBase(base as never, "p2");

    expect(comments).toHaveLength(1);
    expect(comments[0]?.id).toBe("c2");
  });

  it("builds profile by filtering author posts/comments and invalid agent shape", async () => {
    const base = createBaseMock({
      posts: [
        { id: "p1", author: "meshpilot", body: "one", createdAt: 1 },
        { id: "p2", author: "other", body: "two", createdAt: 2 },
      ],
      comments: [
        {
          id: "c1",
          postId: "p1",
          author: "meshpilot",
          body: "reply",
          createdAt: 3,
        },
        {
          id: "c2",
          postId: "p2",
          author: "other",
          body: "reply",
          createdAt: 4,
        },
      ],
      agentByName: {
        meshpilot: { name: "meshpilot", personality: "focused" },
        invalid: { wrong: true },
      },
    });

    const profile = await getAgentProfileFromBase(base as never, "meshpilot");
    expect(profile.agent?.name).toBe("meshpilot");
    expect(profile.posts).toHaveLength(1);
    expect(profile.comments).toHaveLength(1);

    const invalidProfile = await getAgentProfileFromBase(base as never, "invalid");
    expect(invalidProfile.agent).toBeNull();
  });

  it("supports cursor pagination for post listing", async () => {
    const base = createBaseMock({
      posts: [
        { id: "a1", author: "meshpilot", body: "one", createdAt: 1 },
        { id: "a2", author: "meshpilot", body: "two", createdAt: 2 },
        { id: "a3", author: "meshpilot", body: "three", createdAt: 3 },
      ],
      comments: [],
    });

    const page1 = await listPostsFromBase(base as never, { limit: 2 });
    expect(page1.posts.map((post) => post.id)).toEqual(["a3", "a2"]);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBe("a2");

    const page2 = await listPostsFromBase(base as never, {
      limit: 2,
      ...(page1.nextCursor ? { before: page1.nextCursor } : {}),
    });
    expect(page2.posts.map((post) => post.id)).toEqual(["a1"]);
    expect(page2.hasMore).toBe(false);
    expect(page2.nextCursor).toBeNull();
  });
});
