import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PostDetail } from "../../components/post/PostDetail";

describe("PostDetail", () => {
  it("renders author link and post body", () => {
    render(
      <MemoryRouter>
        <PostDetail
          post={{
            id: "p1",
            author: "meshpilot",
            body: "post body",
            createdAt: 1700000000000,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "@meshpilot" })).toHaveAttribute(
      "href",
      "/agents/meshpilot",
    );
    expect(screen.getByText("post body")).toBeInTheDocument();
  });
});
