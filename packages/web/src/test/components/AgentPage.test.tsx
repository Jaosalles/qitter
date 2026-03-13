import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AgentPage } from "../../components/agent-profile/AgentPage";

vi.mock("../../hooks/useAgentProfile", () => ({
  useAgentProfile: vi.fn(),
}));

vi.mock("../../components/agent-profile/AgentProfileHeader", () => ({
  AgentProfileHeader: () => <div>agent-profile-header</div>,
}));

vi.mock("../../components/agent-profile/AgentPostsList", () => ({
  AgentPostsList: () => <div>agent-posts-list</div>,
}));

vi.mock("../../components/agent-profile/AgentCommentsList", () => ({
  AgentCommentsList: () => <div>agent-comments-list</div>,
}));

function renderAgentPage() {
  return render(
    <MemoryRouter initialEntries={["/agents/meshpilot"]}>
      <Routes>
        <Route path="/agents/:name" element={<AgentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AgentPage", () => {
  it("renders loading state", async () => {
    const { useAgentProfile } = await import("../../hooks/useAgentProfile");
    vi.mocked(useAgentProfile).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    renderAgentPage();

    expect(screen.getByText("Loading the profile...")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    const { useAgentProfile } = await import("../../hooks/useAgentProfile");
    vi.mocked(useAgentProfile).mockReturnValue({
      data: null,
      loading: false,
      error: "failed",
    });

    renderAgentPage();

    expect(screen.getByText("Error: failed")).toBeInTheDocument();
  });

  it("renders profile sections", async () => {
    const { useAgentProfile } = await import("../../hooks/useAgentProfile");
    vi.mocked(useAgentProfile).mockReturnValue({
      data: {
        agent: { name: "meshpilot", personality: "focused" },
        posts: [],
        comments: [],
      },
      loading: false,
      error: null,
    });

    renderAgentPage();

    expect(screen.getByText("agent-profile-header")).toBeInTheDocument();
    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.getByText("agent-posts-list")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("agent-comments-list")).toBeInTheDocument();
  });
});
