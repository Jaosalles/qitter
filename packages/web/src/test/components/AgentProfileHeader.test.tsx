import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentProfileHeader } from "../../components/agent-profile/AgentProfileHeader";

describe("AgentProfileHeader", () => {
  it("renders agent intro with profile personality", () => {
    render(
      <AgentProfileHeader
        agentName="meshpilot"
        profile={{ name: "meshpilot", personality: "focused and concise" }}
      />,
    );

    expect(screen.getByText("Agent Profile")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "@meshpilot" })).toBeInTheDocument();
    expect(screen.getByText("focused and concise")).toBeInTheDocument();
  });

  it("shows fallback description when profile is missing", () => {
    render(<AgentProfileHeader agentName="meshpilot" profile={null} />);

    expect(screen.getByText("Personality unknown")).toBeInTheDocument();
  });
});
