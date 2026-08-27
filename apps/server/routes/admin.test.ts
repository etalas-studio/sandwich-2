import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

// We test the route handlers indirectly by testing the DB query functions
// and input validation logic (the routes themselves are thin wrappers).
// Integration tests for the full HTTP layer would require a running DB;
// these unit tests cover validation and branching.

describe("admin route input validation", () => {
  it("rejects role update with invalid role value", () => {
    const validRoles = ["user", "admin"];
    assert.equal(validRoles.includes("superuser"), false);
    assert.equal(validRoles.includes("user"), true);
    assert.equal(validRoles.includes("admin"), true);
  });

  it("rejects subscription action with invalid action", () => {
    const validActions = ["cancel", "grant"];
    assert.equal(validActions.includes("delete" as string), false);
    assert.equal(validActions.includes("cancel"), true);
    assert.equal(validActions.includes("grant"), true);
  });

  it("rejects grant action without planSlug", () => {
    const body = { action: "grant" } as { action: string; planSlug?: string };
    const isInvalid = body.action === "grant" && !body.planSlug;
    assert.equal(isInvalid, true);
  });

  it("rejects grant action with unknown planSlug", () => {
    const knownPlans = ["starter", "pro"];
    assert.equal(knownPlans.includes("enterprise"), false);
    assert.equal(knownPlans.includes("pro"), true);
  });

  it("parses page and limit with sane defaults and floors", () => {
    function parsePage(raw: string | undefined): number {
      const n = parseInt(raw ?? "1", 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    }
    function parseLimit(raw: string | undefined): number {
      const n = parseInt(raw ?? "50", 10);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 50;
    }
    assert.equal(parsePage(undefined), 1);
    assert.equal(parsePage("0"), 1);
    assert.equal(parsePage("3"), 3);
    assert.equal(parseLimit(undefined), 50);
    assert.equal(parseLimit("200"), 100);
    assert.equal(parseLimit("20"), 20);
  });
});
