import { describe, expect, it } from "vitest";
import { brand } from "./brand";

describe("brand", () => {
  it("keeps the synthetic-data banner exact", () => {
    expect(brand.disclaimer).toBe("SYNTHETIC DATA | UNCLASSIFIED PROTOTYPE | NOT FOR OPERATIONAL USE");
  });
});
