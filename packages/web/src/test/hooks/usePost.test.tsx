import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePost } from "../../hooks/usePost";
import { MockEventSource } from "../mocks/event-source";

vi.mock("../../api", () => ({
  eventsUrl: vi.fn(() => "http://localhost:3000/api/events"),
  getPost: vi.fn(),
}));

describe("usePost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.reset();
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
  });

  it("loads post detail with comments", async () => {
    const api = await import("../../api");
    vi.mocked(api.getPost).mockResolvedValue({
      post: {
        id: "p1",
        author: "meshpilot",
        body: "body",
        createdAt: 1,
      },
      comments: [],
    });

    const { result } = renderHook(() => usePost("p1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.detail?.post?.id).toBe("p1");
  });

  it("refreshes on commentAdded event", async () => {
    const api = await import("../../api");
    vi.mocked(api.getPost)
      .mockResolvedValueOnce({
        post: {
          id: "p1",
          author: "meshpilot",
          body: "body",
          createdAt: 1,
        },
        comments: [],
      })
      .mockResolvedValueOnce({
        post: {
          id: "p1",
          author: "meshpilot",
          body: "body",
          createdAt: 1,
        },
        comments: [
          {
            id: "c1",
            postId: "p1",
            author: "peer",
            body: "hello",
            createdAt: 2,
          },
        ],
      });

    const { result } = renderHook(() => usePost("p1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const eventSource = MockEventSource.instances[0];
    eventSource?.emitMessage({ type: "commentAdded" });

    await waitFor(() => {
      expect(result.current.detail?.comments).toHaveLength(1);
    });
  });

  it("reconnects SSE after transient errors", async () => {
    const api = await import("../../api");
    vi.mocked(api.getPost).mockResolvedValue({
      post: {
        id: "p1",
        author: "meshpilot",
        body: "body",
        createdAt: 1,
      },
      comments: [],
    });

    renderHook(() => usePost("p1"));

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
