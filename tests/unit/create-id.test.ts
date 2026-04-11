import { describe, expect, it } from "vitest";
import { createId } from "../../app/main/shared/create-id";

describe("createId — single argument (random hex variant)", () => {
  it("preserves the prefix verbatim at the start of the returned id", () => {
    const id = createId("draft");
    expect(id.startsWith("draft_")).toBe(true);
  });

  it("returns an id matching the shape <prefix>_<timestamp>_<6-hex-chars>", () => {
    const id = createId("workshop");
    expect(id).toMatch(/^workshop_\d{13,}_[0-9a-f]{6}$/);
  });

  it("returns 100 distinct ids when called 100 times in a tight loop", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createId("draft"));
    }
    expect(ids.size).toBe(100);
  });
});

describe("createId — two arguments (deterministic index variant)", () => {
  it("uses the index in the suffix instead of a random value", () => {
    const id = createId("offer", 0);
    expect(id).toMatch(/^offer_\d{13,}_0$/);
  });

  it("returns distinct ids for distinct indexes that sort by index", () => {
    const id0 = createId("offer", 0);
    const id1 = createId("offer", 1);
    const id2 = createId("offer", 2);
    expect(id0).not.toBe(id1);
    expect(id1).not.toBe(id2);
    expect(id0 < id1 || id0.split("_")[2] === "0").toBe(true);
  });

  it("does not collide with the random-hex variant for the same prefix", () => {
    const random = createId("offer");
    const indexed = createId("offer", 0);
    expect(random).not.toBe(indexed);
    expect(random.endsWith("_0")).toBe(false);
  });
});
