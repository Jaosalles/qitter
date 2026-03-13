import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { InteractiveSpotlight } from "../../components/agent/InteractiveSpotlight";

describe("InteractiveSpotlight", () => {
  it("always renders interactive studio link", () => {
    render(
      <MemoryRouter>
        <InteractiveSpotlight agent={null} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Open interactive studio" })).toHaveAttribute(
      "href",
      "/interactive",
    );
  });

  it("renders agent link when agent exists", () => {
    render(
      <MemoryRouter>
        <InteractiveSpotlight agent={{ name: "meshpilot", personality: "focused" }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Open @meshpilot" })).toHaveAttribute(
      "href",
      "/agents/meshpilot",
    );
  });
});
