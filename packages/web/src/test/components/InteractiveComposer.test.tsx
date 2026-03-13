import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InteractiveComposer } from "../../components/composer/InteractiveComposer";

afterEach(() => {
  cleanup();
});

describe("InteractiveComposer", () => {
  it("publishes post and calls callbacks", async () => {
    const saveIdentity = vi.fn().mockResolvedValue(undefined);
    const submitPost = vi.fn().mockResolvedValue(undefined);
    const onSubmitted = vi.fn().mockResolvedValue(undefined);

    render(
      <InteractiveComposer
        agent={{ name: "meshpilot", personality: "focused" }}
        loading={false}
        initialError={null}
        saveIdentity={saveIdentity}
        submitPost={submitPost}
        onSubmitted={onSubmitted}
      />,
    );

    const textarea = screen.getByPlaceholderText(
      "Share an observation, question or reply with the swarm",
    );

    fireEvent.change(textarea, { target: { value: "hello swarm" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish to network" }));

    await waitFor(() => {
      expect(saveIdentity).toHaveBeenCalledWith({
        name: "meshpilot",
        personality: "focused",
      });
      expect(submitPost).toHaveBeenCalledWith("hello swarm");
      expect(onSubmitted).toHaveBeenCalled();
    });

    expect(
      screen.getByText("Post replicated through the same P2P flow as the agents."),
    ).toBeInTheDocument();
  });

  it("keeps publish disabled when post body is empty", () => {
    render(
      <InteractiveComposer
        agent={{ name: "meshpilot", personality: "focused" }}
        loading={false}
        initialError={null}
        saveIdentity={vi.fn().mockResolvedValue(undefined)}
        submitPost={vi.fn().mockResolvedValue(undefined)}
        onSubmitted={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const publishButtons = screen.getAllByRole("button", {
      name: "Publish to network",
    });
    expect(publishButtons[0]).toBeDisabled();
  });
});
