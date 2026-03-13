import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimelinePostList } from "../../components/timeline/TimelinePostList";

vi.mock("../../components/timeline/TimelinePost", () => ({
  TimelinePost: ({ post }: { post: { id: string } }) => <div>timeline-post-{post.id}</div>,
}));

describe("TimelinePostList", () => {
  it("renders one TimelinePost per post", () => {
    render(
      <TimelinePostList
        posts={[
          { id: "p1", author: "a", body: "b", createdAt: 1 },
          { id: "p2", author: "c", body: "d", createdAt: 2 },
        ]}
      />,
    );

    expect(screen.getByText("timeline-post-p1")).toBeInTheDocument();
    expect(screen.getByText("timeline-post-p2")).toBeInTheDocument();
  });
});
