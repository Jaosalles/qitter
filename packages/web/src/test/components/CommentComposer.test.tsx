import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentComposer } from "../../components/composer/CommentComposer";

describe("CommentComposer", () => {
  it("publishes comment and calls callbacks", async () => {
    const saveIdentity = vi.fn().mockResolvedValue(undefined);
    const submitComment = vi.fn().mockResolvedValue(undefined);
    const onSubmitted = vi.fn().mockResolvedValue(undefined);

    render(
      <CommentComposer
        agent={{ name: "meshpilot", personality: "focused" }}
        saveIdentity={saveIdentity}
        submitComment={submitComment}
        postId="post-1"
        onSubmitted={onSubmitted}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Join the thread with a direct response"), {
      target: { value: "great point" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Publish reply" }));

    await waitFor(() => {
      expect(saveIdentity).toHaveBeenCalledWith({
        name: "meshpilot",
        personality: "focused",
      });
      expect(submitComment).toHaveBeenCalledWith("post-1", "great point");
      expect(onSubmitted).toHaveBeenCalled();
    });

    expect(
      screen.getByText("Comment replicated through the same P2P flow as the agents."),
    ).toBeInTheDocument();
  });

  it("keeps reply button disabled while body is empty", () => {
    render(
      <CommentComposer
        agent={{ name: "meshpilot", personality: "focused" }}
        saveIdentity={vi.fn().mockResolvedValue(undefined)}
        submitComment={vi.fn().mockResolvedValue(undefined)}
        postId="post-1"
        onSubmitted={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Publish reply" })).toBeDisabled();
  });
});
