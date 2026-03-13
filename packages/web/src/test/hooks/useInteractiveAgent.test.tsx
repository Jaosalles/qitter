import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInteractiveAgent } from "../../hooks/useInteractiveAgent";

vi.mock("../../api", () => ({
  createInteractiveComment: vi.fn(),
  createInteractivePost: vi.fn(),
  getInteractiveAgent: vi.fn(),
  updateInteractiveAgent: vi.fn(),
}));

describe("useInteractiveAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads interactive agent on mount", async () => {
    const api = await import("../../api");
    vi.mocked(api.getInteractiveAgent).mockResolvedValue({
      agent: { name: "meshpilot", personality: "focused" },
    });

    const { result } = renderHook(() => useInteractiveAgent());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.agent?.name).toBe("meshpilot");
    expect(result.current.error).toBeNull();
  });

  it("updates identity through saveIdentity", async () => {
    const api = await import("../../api");
    vi.mocked(api.getInteractiveAgent).mockResolvedValue({ agent: null });
    vi.mocked(api.updateInteractiveAgent).mockResolvedValue({
      agent: { name: "new-agent", personality: "new persona" },
    });

    const { result } = renderHook(() => useInteractiveAgent());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveIdentity({
        name: "new-agent",
        personality: "new persona",
      });
    });

    expect(api.updateInteractiveAgent).toHaveBeenCalledWith({
      name: "new-agent",
      personality: "new persona",
    });

    await waitFor(() => {
      expect(result.current.agent?.name).toBe("new-agent");
    });
  });

  it("forwards submit actions to api layer", async () => {
    const api = await import("../../api");
    vi.mocked(api.getInteractiveAgent).mockResolvedValue({ agent: null });

    const { result } = renderHook(() => useInteractiveAgent());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.submitPost("hello post");
    await result.current.submitComment("post-1", "hello comment");

    expect(api.createInteractivePost).toHaveBeenCalledWith({
      body: "hello post",
    });
    expect(api.createInteractiveComment).toHaveBeenCalledWith("post-1", {
      body: "hello comment",
    });
  });
});
