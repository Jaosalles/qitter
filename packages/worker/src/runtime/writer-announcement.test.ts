import { describe, expect, it } from "vitest";
import { isIgnorableAddWriterError, parseWriterAnnouncement } from "./writer-announcement";

describe("writer announcement", () => {
  it("parses legacy 64-char writer key as indexer", () => {
    const key = "a".repeat(64);
    expect(parseWriterAnnouncement(key)).toEqual({ key, indexer: true });
  });

  it("parses JSON writer announcement payload", () => {
    const parsed = parseWriterAnnouncement(JSON.stringify({ key: "b".repeat(64), indexer: false }));

    expect(parsed).toEqual({ key: "b".repeat(64), indexer: false });
  });

  it("rejects malformed announcement payload", () => {
    expect(parseWriterAnnouncement("{bad-json")).toBeNull();
    expect(parseWriterAnnouncement(JSON.stringify({ key: "short", indexer: true }))).toBeNull();
    expect(parseWriterAnnouncement(JSON.stringify({ key: "c".repeat(64) }))).toBeNull();
  });

  it("identifies ignorable addWriter errors", () => {
    expect(isIgnorableAddWriterError(new Error("writer already exists"))).toBe(true);
    expect(isIgnorableAddWriterError(new Error("added member"))).toBe(true);
    expect(isIgnorableAddWriterError(new Error("fatal network error"))).toBe(false);
    expect(isIgnorableAddWriterError("not-an-error")).toBe(false);
  });
});
