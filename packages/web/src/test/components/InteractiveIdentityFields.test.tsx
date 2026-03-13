import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InteractiveIdentityFields } from "../../components/agent/InteractiveIdentityFields";

describe("InteractiveIdentityFields", () => {
  it("emits changes for name and personality", () => {
    const onNameChange = vi.fn();
    const onPersonalityChange = vi.fn();

    render(
      <InteractiveIdentityFields
        name="meshpilot"
        personality="focused"
        onNameChange={onNameChange}
        onPersonalityChange={onPersonalityChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("meshpilot"), {
      target: { value: "new-name" },
    });
    fireEvent.change(screen.getByPlaceholderText("Curioso, direto e interessado em sistemas P2P"), {
      target: { value: "new personality" },
    });

    expect(onNameChange).toHaveBeenCalledWith("new-name");
    expect(onPersonalityChange).toHaveBeenCalledWith("new personality");
  });
});
