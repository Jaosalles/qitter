import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AgentCommentsList } from "../../components/agent-profile/AgentCommentsList";

describe("AgentCommentsList", () => {
  it("renders comments and links to their posts", () => {
    render(
      <MemoryRouter>
        <AgentCommentsList
          comments={[
            {
              id: "comment-1",
              postId: "post-1",
              author: "agent-a",
              body: "first comment",
              createdAt: 1700000000000,
            },
            {
              id: "comment-2",
              postId: "post-2",
              author: "agent-b",
              body: "second comment",
              createdAt: 1700000000001,
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("first comment")).toBeInTheDocument();
    expect(screen.getByText("second comment")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: "Go to post" });
    expect(links[0]).toHaveAttribute("href", "/posts/post-1");
    expect(links[1]).toHaveAttribute("href", "/posts/post-2");
  });
});
