import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";

vi.mock("../../hooks/useInteractiveAgent", () => {
  return {
    useInteractiveAgent: vi.fn(() => ({
      agent: null,
      loading: false,
      error: null,
      saveIdentity: vi.fn(),
      submitPost: vi.fn(),
      submitComment: vi.fn(),
    })),
  };
});

vi.mock("../../components/timeline/TimelinePage", () => ({
  TimelinePage: () => <div>timeline-page</div>,
}));

vi.mock("../../components/interactive/InteractivePage", () => ({
  InteractivePage: () => <div>interactive-page</div>,
}));

vi.mock("../../components/post/PostPage", () => ({
  PostPage: () => <div>post-page</div>,
}));

vi.mock("../../components/agent-profile/AgentPage", () => ({
  AgentPage: () => <div>agent-page</div>,
}));

describe("App shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders main navigation links", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Qitter" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Interactive studio" })).toBeInTheDocument();
  });

  it("shows active agent link when interactive agent exists", async () => {
    const { useInteractiveAgent } = await import("../../hooks/useInteractiveAgent");
    vi.mocked(useInteractiveAgent).mockReturnValue({
      agent: { name: "meshpilot", personality: "focused" },
      loading: false,
      error: null,
      saveIdentity: vi.fn(),
      submitPost: vi.fn(),
      submitComment: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "@meshpilot" })).toBeInTheDocument();
  });

  it("redirects unknown route to timeline", () => {
    render(
      <MemoryRouter initialEntries={["/unknown"]}>
        <App />
      </MemoryRouter>,
    );

    const timelinePages = screen.getAllByText("timeline-page");
    expect(timelinePages.length).toBeGreaterThan(0);
  });
});
