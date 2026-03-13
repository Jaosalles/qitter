import { describe, expect, it } from "vitest";
import {
  requireAgentNamePayload,
  requireAgentPayload,
  requireCommentPayload,
  requirePostIdPayload,
  requirePostPayload,
} from "./message-validation";

describe("message validation", () => {
  it("accepts valid create payloads", () => {
    expect(
      requirePostPayload({
        id: "p1",
        author: "meshpilot",
        body: "post",
        createdAt: 1,
      }).id,
    ).toBe("p1");

    expect(
      requireCommentPayload({
        id: "c1",
        postId: "p1",
        author: "meshpilot",
        body: "reply",
        createdAt: 2,
      }).postId,
    ).toBe("p1");

    expect(
      requireAgentPayload({
        name: "meshpilot",
        personality: "focused",
      }).name,
    ).toBe("meshpilot");
  });

  it("rejects malformed create payloads", () => {
    expect(() => requirePostPayload({ id: "p1" })).toThrow("Invalid createPost payload.");
    expect(() => requireCommentPayload({ id: "c1" })).toThrow("Invalid createComment payload.");
    expect(() => requireAgentPayload({ name: "meshpilot" })).toThrow(
      "Invalid registerAgent payload.",
    );
  });

  it("accepts and validates get payloads", () => {
    expect(requirePostIdPayload({ postId: "p1" })).toBe("p1");
    expect(requireAgentNamePayload({ name: "meshpilot" })).toBe("meshpilot");

    expect(() => requirePostIdPayload({ postId: "" })).toThrow("Invalid getPost payload.");
    expect(() => requirePostIdPayload({})).toThrow("Invalid getPost payload.");

    expect(() => requireAgentNamePayload({ name: "" })).toThrow("Invalid getAgent payload.");
    expect(() => requireAgentNamePayload({})).toThrow("Invalid getAgent payload.");
  });
});
