import { describe, expect, it } from "vitest";
import {
  buildPersonaProfilePrompt,
  inferAttitudeBFromUserText,
  mergeAttitudeB,
  normalizePersonaPid,
  normalizeSessionId,
  normalizeUserId,
} from "./persona_memory_profile";

describe("persona_memory_profile", () => {
  it("normalizes user_id and session_id safely", () => {
    expect(normalizeUserId(" User-01 ")).toBe("user-01");
    expect(normalizeUserId("")).toBe("user_default");
    expect(normalizeSessionId(" Sess:ABC 123 ")).toBe("sess_abc_123");
    expect(normalizePersonaPid("riley")).toBe("p_riley");
  });

  it("creates temporary attitude B from urgent/frustrated text", () => {
    const urgent = inferAttitudeBFromUserText("지금 급해. 핵심만 짧게.");
    expect(urgent).not.toBeNull();
    expect(urgent?.currentUserState).toBe("urgent");
    expect(urgent?.temporaryTone).toBe("more_concise");

    const merged = mergeAttitudeB(urgent, {
      currentUserState: "frustrated",
      temporaryTone: "calm_and_direct",
      urgency: 0.8,
      note: "updated",
      expiresAt: urgent?.expiresAt || "",
    });
    expect(merged.currentUserState).toBe("frustrated");
    expect(merged.temporaryTone).toBe("calm_and_direct");
  });

  it("keeps attitude A as base and attitude B as session-only in prompt", () => {
    const prompt = buildPersonaProfilePrompt({
      version: 1,
      userId: "u1",
      personaPid: "p_avery",
      bioSummary: "works on Persona app",
      attitudeA: {
        summary: "base attitude",
        style: "concise",
        avoid: ["vague"],
        updatedReason: "seed",
        updatedAt: new Date().toISOString(),
      },
      roleMemorySummary: {},
      importantEvents: [],
      updatedAt: new Date().toISOString(),
    }, {
      currentUserState: "urgent",
      temporaryTone: "more_concise",
      urgency: 0.9,
      note: "session only",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });

    expect(prompt).toContain("Attitude A (base, stable):");
    expect(prompt).toContain("Attitude B (session temporary):");
    expect(prompt).toContain("Session-only override");
  });
});
