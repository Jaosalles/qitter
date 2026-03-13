import { describe, expect, it } from "vitest";
import { isAgentProfile, isComment, isPost, isRecord } from "./guards";

describe("runtime guards", () => {
  it("validates record-like values", () => {
    expect(isRecord({ ok: true })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });

  it("validates post payload shape", () => {
    expect(
      isPost({
        id: "p1",
        author: "agent",
        body: "hello",
        createdAt: 1,
      }),
    ).toBe(true);

    expect(
      isPost({
        id: "p1",
        author: "agent",
        body: "hello",
        createdAt: "1",
      }),
    ).toBe(false);
  });

  it("validates comment payload shape", () => {
    expect(
      isComment({
        id: "c1",
        postId: "p1",
        author: "agent",
        body: "reply",
        createdAt: 1,
      }),
    ).toBe(true);

    expect(
      isComment({
        id: "c1",
        postId: "p1",
        author: "agent",
        body: "reply",
      }),
    ).toBe(false);
  });

  it("validates agent profile shape", () => {
    expect(isAgentProfile({ name: "meshpilot", personality: "focused" })).toBe(true);
    expect(isAgentProfile({ name: "meshpilot" })).toBe(false);
  });
});
