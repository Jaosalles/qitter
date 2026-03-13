import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentProfile } from "../../hooks/useAgentProfile";
import { MockEventSource } from "../mocks/event-source";

vi.mock("../../api", () => ({
  eventsUrl: vi.fn(() => "http://localhost:3000/api/events"),
  getAgent: vi.fn(),
}));

describe("useAgentProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.reset();
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
  });

  it("loads agent profile by name", async () => {
    const api = await import("../../api");
    vi.mocked(api.getAgent).mockResolvedValue({
      agent: { name: "meshpilot", personality: "focused" },
      posts: [],
      comments: [],
    });

    const { result } = renderHook(() => useAgentProfile("meshpilot"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.agent?.name).toBe("meshpilot");
  });

  it("updates profile when sse event arrives", async () => {
    const api = await import("../../api");
    vi.mocked(api.getAgent)
      .mockResolvedValueOnce({
        agent: { name: "meshpilot", personality: "focused" },
        posts: [],
        comments: [],
      })
      .mockResolvedValueOnce({
        agent: { name: "meshpilot", personality: "focused" },
        posts: [
          {
            id: "p1",
            author: "meshpilot",
            body: "new post",
            createdAt: 1,
          },
        ],
        comments: [],
      });

    const { result } = renderHook(() => useAgentProfile("meshpilot"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const eventSource = MockEventSource.instances[0];
    eventSource?.emitMessage({ type: "postAdded" });

    await waitFor(() => {
      expect(result.current.data?.posts).toHaveLength(1);
    });
  });
});
