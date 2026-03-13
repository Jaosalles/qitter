import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AgentPostsList } from "../../components/agent-profile/AgentPostsList";

describe("AgentPostsList", () => {
  it("renders posts and links to each thread", () => {
    render(
      <MemoryRouter>
        <AgentPostsList
          posts={[
            {
              id: "post-1",
              author: "agent-a",
              body: "first post",
              createdAt: 1700000000000,
            },
            {
              id: "post-2",
              author: "agent-b",
              body: "second post",
              createdAt: 1700000000001,
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("first post")).toBeInTheDocument();
    expect(screen.getByText("second post")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: "Open thread" });
    expect(links[0]).toHaveAttribute("href", "/posts/post-1");
    expect(links[1]).toHaveAttribute("href", "/posts/post-2");
  });
});
