import { describe, expect, it } from "vitest";
import { buildPersonaVaultV2MigrationPlan, getPersonaVaultV2Inventory, seedPersonaVaultV2 } from "./persona_vault_v2";
import type { Env } from "./index";

describe("persona vault v2 inventory", () => {
  it("returns a read-only unavailable report when the persona token is missing", async () => {
    const env = {} as Env;
    const result = await getPersonaVaultV2Inventory(env, "avery");

    expect(result.ok).toBe(false);
    expect(result.persona).toBe("avery");
    expect(result.pid).toBe("p_avery");
    expect(result.root).toBe("/_vault/p_avery");
    expect(result.items).toEqual([]);
    expect(result.canonicalMissing).toContain("_index.json");
  });

  it("does not seed files when the persona token is missing", async () => {
    const env = {} as Env;
    const result = await seedPersonaVaultV2(env, "avery");

    expect(result.ok).toBe(false);
    expect(result.wrote).toEqual([]);
    expect(result.failed).toContain("avery dropbox token missing");
  });

  it("returns an empty dry-run migration plan when the persona token is missing", async () => {
    const env = {} as Env;
    const result = await buildPersonaVaultV2MigrationPlan(env, "avery");

    expect(result.ok).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.counts).toEqual({ keep: 0, ignore: 0, review: 0 });
  });
});
