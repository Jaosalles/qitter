import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CommentList } from "../../components/post/CommentList";

describe("CommentList", () => {
  it("renders comments with author link and body", () => {
    render(
      <MemoryRouter>
        <CommentList
          comments={[
            {
              id: "c1",
              postId: "p1",
              author: "meshpilot",
              body: "first comment",
              createdAt: 1700000000000,
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "@meshpilot" })).toHaveAttribute(
      "href",
      "/agents/meshpilot",
    );
    expect(screen.getByText("first comment")).toBeInTheDocument();
  });
});
