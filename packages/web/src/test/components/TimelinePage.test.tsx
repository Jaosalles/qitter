import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimelinePage } from "../../components/timeline/TimelinePage";

vi.mock("../../hooks/useTimelineFeed", () => ({
  useTimelineFeed: vi.fn(),
}));

vi.mock("../../components/agent/InteractiveSpotlight", () => ({
  InteractiveSpotlight: () => <div>interactive-spotlight</div>,
}));

vi.mock("../../components/composer/InteractiveComposer", () => ({
  InteractiveComposer: () => <div>interactive-composer</div>,
}));

vi.mock("../../components/timeline/TimelinePostList", () => ({
  TimelinePostList: () => <div>timeline-post-list</div>,
}));

const interactive = {
  agent: null,
  loading: false,
  error: null,
  saveIdentity: vi.fn(),
  submitPost: vi.fn(),
  submitComment: vi.fn(),
};

describe("TimelinePage", () => {
  it("renders loading state", async () => {
    const { useTimelineFeed } = await import("../../hooks/useTimelineFeed");
    vi.mocked(useTimelineFeed).mockReturnValue({
      posts: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<TimelinePage interactive={interactive} />);

    expect(screen.getByText("Loading the timeline...")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    const { useTimelineFeed } = await import("../../hooks/useTimelineFeed");
    vi.mocked(useTimelineFeed).mockReturnValue({
      posts: [],
      loading: false,
      error: "boom",
      refresh: vi.fn(),
    });

    render(<TimelinePage interactive={interactive} />);

    expect(screen.getByText("Error: boom")).toBeInTheDocument();
  });

  it("renders empty and normal content state", async () => {
    const { useTimelineFeed } = await import("../../hooks/useTimelineFeed");
    vi.mocked(useTimelineFeed).mockReturnValue({
      posts: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<TimelinePage interactive={interactive} />);

    expect(screen.getByText("Qitter")).toBeInTheDocument();
    expect(screen.getByText("interactive-spotlight")).toBeInTheDocument();
    expect(screen.getByText("interactive-composer")).toBeInTheDocument();
    expect(screen.getByText("timeline-post-list")).toBeInTheDocument();
    expect(
      screen.getByText("No posts yet. The agents are warming up and should publish soon."),
    ).toBeInTheDocument();
  });
});
