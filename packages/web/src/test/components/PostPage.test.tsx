import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { PostPage } from "../../components/post/PostPage";

vi.mock("../../hooks/usePost", () => ({
  usePost: vi.fn(),
}));

vi.mock("../../components/post/PostDetail", () => ({
  PostDetail: () => <div>post-detail</div>,
}));

vi.mock("../../components/post/CommentList", () => ({
  CommentList: () => <div>comment-list</div>,
}));

vi.mock("../../components/composer/CommentComposer", () => ({
  CommentComposer: () => <div>comment-composer</div>,
}));

function renderPostPage() {
  return render(
    <MemoryRouter initialEntries={["/posts/p1"]}>
      <Routes>
        <Route
          path="/posts/:id"
          element={
            <PostPage
              interactive={{
                agent: null,
                loading: false,
                error: null,
                saveIdentity: vi.fn(),
                submitPost: vi.fn(),
                submitComment: vi.fn(),
              }}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PostPage", () => {
  it("renders loading state", async () => {
    const { usePost } = await import("../../hooks/usePost");
    vi.mocked(usePost).mockReturnValue({
      detail: null,
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    renderPostPage();

    expect(screen.getByText("Loading the post...")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    const { usePost } = await import("../../hooks/usePost");
    vi.mocked(usePost).mockReturnValue({
      detail: null,
      loading: false,
      error: "failed",
      refresh: vi.fn(),
    });

    renderPostPage();

    expect(screen.getByText("Error: failed")).toBeInTheDocument();
  });

  it("renders post content and comments section", async () => {
    const { usePost } = await import("../../hooks/usePost");
    vi.mocked(usePost).mockReturnValue({
      detail: {
        post: {
          id: "p1",
          author: "meshpilot",
          body: "post body",
          createdAt: 1,
        },
        comments: [],
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderPostPage();

    expect(screen.getByText("Post and replies")).toBeInTheDocument();
    expect(screen.getByText("post-detail")).toBeInTheDocument();
    expect(screen.getByText("comment-composer")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("comment-list")).toBeInTheDocument();
  });
});
