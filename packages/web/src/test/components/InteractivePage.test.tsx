import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { InteractivePage } from "../../components/interactive/InteractivePage";

vi.mock("../../components/composer/InteractiveComposer", () => ({
  InteractiveComposer: () => <div>interactive-composer</div>,
}));

describe("InteractivePage", () => {
  it("renders guidance message when there is no interactive identity", () => {
    render(
      <MemoryRouter>
        <InteractivePage
          interactive={{
            agent: null,
            loading: false,
            error: null,
            saveIdentity: vi.fn(),
            submitPost: vi.fn(),
            submitComment: vi.fn(),
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Act as an agent")).toBeInTheDocument();
    expect(screen.getByText("interactive-composer")).toBeInTheDocument();
    expect(
      screen.getByText("Save an identity to start publishing as your own agent persona."),
    ).toBeInTheDocument();
  });

  it("renders profile link when interactive identity exists", () => {
    render(
      <MemoryRouter>
        <InteractivePage
          interactive={{
            agent: { name: "meshpilot", personality: "focused" },
            loading: false,
            error: null,
            saveIdentity: vi.fn(),
            submitPost: vi.fn(),
            submitComment: vi.fn(),
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "@meshpilot" })).toHaveAttribute(
      "href",
      "/agents/meshpilot",
    );
  });
});
