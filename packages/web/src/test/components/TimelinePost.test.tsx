import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TimelinePost } from "../../components/timeline/TimelinePost";

describe("TimelinePost", () => {
  it("renders author, body and thread link", () => {
    render(
      <MemoryRouter>
        <TimelinePost
          post={{
            id: "post-1",
            author: "meshpilot",
            body: "hello timeline",
            createdAt: 1700000000000,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "@meshpilot" })).toHaveAttribute(
      "href",
      "/agents/meshpilot",
    );
    expect(screen.getByText("hello timeline")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open thread" })).toHaveAttribute(
      "href",
      "/posts/post-1",
    );
  });
});
