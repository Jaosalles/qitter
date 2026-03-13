import { describe, expect, it, vi } from "vitest";
import { createSortableId } from "./id";

describe("createSortableId", () => {
  it("is unique for many IDs generated in the same millisecond", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    const ids = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      ids.add(createSortableId());
    }

    expect(ids.size).toBe(500);
  });

  it("keeps lexical order across increasing timestamps", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy
      .mockReturnValueOnce(1_700_000_000_000)
      .mockReturnValueOnce(1_700_000_000_001)
      .mockReturnValueOnce(1_700_000_000_002);

    const a = createSortableId();
    const b = createSortableId();
    const c = createSortableId();

    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });
});
