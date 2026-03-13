import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimelineFeed } from "../../hooks/useTimelineFeed";
import { MockEventSource } from "../mocks/event-source";

vi.mock("../../api", () => ({
  eventsUrl: vi.fn(() => "http://localhost:3000/api/events"),
  getPosts: vi.fn(),
}));

describe("useTimelineFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.reset();
    vi.stubGlobal(
      "EventSource",
      MockEventSource as unknown as typeof EventSource,
    );
  });

  it("loads timeline posts on mount", async () => {
    const api = await import("../../api");
    vi.mocked(api.getPosts).mockResolvedValue({
      posts: [
        {
          id: "p1",
          author: "meshpilot",
          body: "hello timeline",
          createdAt: 1,
        },
      ],
      nextCursor: null,
      hasMore: false,
    });

    const { result } = renderHook(() => useTimelineFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(1);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("refreshes when receiving postAdded event", async () => {
    const api = await import("../../api");
    vi.mocked(api.getPosts)
      .mockResolvedValueOnce({ posts: [], nextCursor: null, hasMore: false })
      .mockResolvedValueOnce({
        posts: [
          {
            id: "p2",
            author: "peer",
            body: "new post",
            createdAt: 2,
          },
        ],
        nextCursor: null,
        hasMore: false,
      });

    const { result } = renderHook(() => useTimelineFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const eventSource = MockEventSource.instances[0];
    eventSource?.emitMessage({ type: "postAdded" });

    await waitFor(() => {
      expect(result.current.posts).toHaveLength(1);
      expect(result.current.posts[0]?.id).toBe("p2");
    });
  });

  it("loads older posts using the next cursor", async () => {
    const api = await import("../../api");
    vi.mocked(api.getPosts)
      .mockResolvedValueOnce({
        posts: [
          {
            id: "p3",
            author: "alpha",
            body: "newest",
            createdAt: 3,
          },
        ],
        nextCursor: "p3",
        hasMore: true,
      })
      .mockResolvedValueOnce({
        posts: [
          {
            id: "p2",
            author: "beta",
            body: "older",
            createdAt: 2,
          },
        ],
        nextCursor: null,
        hasMore: false,
      });

    const { result } = renderHook(() => useTimelineFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.hasMore).toBe(true);
    });

    await result.current.loadMore();

    await waitFor(() => {
      expect(result.current.posts.map((post) => post.id)).toEqual(["p3", "p2"]);
      expect(result.current.hasMore).toBe(false);
    });

    expect(api.getPosts).toHaveBeenNthCalledWith(1, { limit: 20 });
    expect(api.getPosts).toHaveBeenNthCalledWith(2, {
      limit: 20,
      before: "p3",
    });
  });

  it("reconnects SSE after transient errors", async () => {
    const api = await import("../../api");
    vi.mocked(api.getPosts).mockResolvedValue({
      posts: [],
      nextCursor: null,
      hasMore: false,
    });

    renderHook(() => useTimelineFeed());

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const firstSource = MockEventSource.instances[0];
    firstSource?.emitError();

    await waitFor(
      () => {
        expect(MockEventSource.instances).toHaveLength(2);
      },
      {
        timeout: 2500,
      },
    );

    expect(firstSource?.closed).toBe(true);
  });
});
