import { describe, expect, it } from "vitest";
import { buildPersonaContext, buildPersonaContextSections } from "./persona_context";
import type { PersonaUserProfile } from "./persona_memory_profile";

function sampleProfile(): PersonaUserProfile {
  return {
    version: 1,
    userId: "user_a",
    personaPid: "p_planner",
    bioSummary: "User prefers execution-focused planning.",
    attitudeA: {
      summary: "Keep response practical.",
      style: "concise and direct",
      avoid: ["too many options"],
      updatedReason: "seed",
      updatedAt: new Date().toISOString(),
    },
    roleMemorySummary: {
      finance_manager: "Focus on cashflow and risk.",
      health_coach: "Focus on routine and recovery.",
    },
    importantEvents: [
      { id: "e1", content: "Chose MVP-first plan.", domain: "product", importance: 0.8, happenedAt: "2026-05-01" },
    ],
    updatedAt: new Date().toISOString(),
  };
}

describe("persona_context", () => {
  it("filters role memory to requested role only", () => {
    const sections = buildPersonaContextSections(sampleProfile(), null, "finance_manager");
    expect(sections.roleMemory).toContain("finance_manager");
    expect(sections.roleMemory).not.toContain("health_coach");
  });

  it("keeps context order: Attitude A before Attitude B and before user messages", () => {
    const sections = buildPersonaContextSections(sampleProfile(), {
      currentUserState: "urgent",
      temporaryTone: "more_concise",
      urgency: 0.9,
      note: "session only",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }, "finance_manager");

    const msgs = buildPersonaContext(
      [{ role: "user", content: "현재 이슈 정리해줘" }],
      {
        globalRules: ["Global policy"],
        personaBaseRules: ["Persona base"],
        sections,
        extraSystemBlocks: ["Extra block"],
      },
    );
    const joined = msgs.map((m) => `${m.role}:${String(m.content)}`).join("\n");
    expect(joined.indexOf("Attitude A (base, stable):")).toBeGreaterThan(-1);
    expect(joined.indexOf("Attitude B (session temporary):")).toBeGreaterThan(-1);
    expect(joined.indexOf("Attitude A (base, stable):")).toBeLessThan(joined.indexOf("Attitude B (session temporary):"));
    expect(joined.lastIndexOf("user:현재 이슈 정리해줘")).toBeGreaterThan(joined.indexOf("Attitude B (session temporary):"));
  });
});
