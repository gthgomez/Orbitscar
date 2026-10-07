import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createAuthorityClient, deriveAuthorityAttackSeed, type AuthorityAction } from "./api-client.js";

describe("local authority client", () => {
  it("derives the same battle seed as the authority server", () => {
    const seed = deriveAuthorityAttackSeed("request-123", "a".repeat(64), 7);
    const expected = createHash("sha256").update(`request-123:${"a".repeat(64)}:7`).digest().readUInt32BE(0);
    expect(seed).toBe(expected);
  });

  it("posts versioned colony actions with the exact idempotency key", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ profileId: "pilot-one", version: 4, colony: { playerId: "pilot-one" } }), { status: 200 }));
    const client = createAuthorityClient("/api", fetcher);
    const action: AuthorityAction = { type: "TRAIN", unitId: "line_rigger", count: 2 };
    await client.applyAction("pilot-one", 3, "train-request-3", action);
    expect(fetcher).toHaveBeenCalledWith("/api/profiles/pilot-one/actions", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ requestId: "train-request-3", expectedVersion: 3, action }),
    }));
  });

  it("preserves conflict status and authority error details", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: "stale profile version" }), { status: 409 }));
    const client = createAuthorityClient("/api", fetcher);
    await expect(client.loadProfile("pilot-one")).rejects.toMatchObject({ status: 409, message: "stale profile version" });
  });
});
