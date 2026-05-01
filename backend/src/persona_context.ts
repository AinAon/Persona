import type { AttitudeBSession, PersonaUserProfile } from "./persona_memory_profile";

export type PersonaContextSections = {
  attitudeA: string;
  bio: string;
  roleMemory: string;
  episodic: string;
  attitudeB: string;
};

function joinLines(lines: string[]): string {
  return lines.filter((x) => String(x || "").trim()).join("\n");
}

export function buildPersonaContextSections(
  profile: PersonaUserProfile,
  attitudeB: AttitudeBSession | null,
  role: string,
): PersonaContextSections {
  const roleKey = String(role || "").trim().toLowerCase();

  const attitudeA = joinLines([
    "Attitude A (base, stable):",
    `- summary: ${profile.attitudeA.summary || ""}`,
    `- style: ${profile.attitudeA.style || ""}`,
    `- avoid: ${(profile.attitudeA.avoid || []).join(", ") || "none"}`,
    "- policy: Keep stable baseline; do not change from one conversation mood.",
  ]);

  const bio = profile.bioSummary
    ? joinLines(["Bio memory:", `- ${profile.bioSummary}`])
    : "";

  const roleLines: string[] = [];
  if (roleKey && profile.roleMemorySummary?.[roleKey]) {
    roleLines.push(`${roleKey}: ${String(profile.roleMemorySummary[roleKey] || "").trim()}`);
  } else if (profile.roleMemorySummary?.default) {
    roleLines.push(`default: ${String(profile.roleMemorySummary.default || "").trim()}`);
  } else {
    const first = Object.entries(profile.roleMemorySummary || {}).filter(([k, v]) => k && String(v || "").trim())[0];
    if (first) roleLines.push(`${first[0]}: ${String(first[1] || "").trim()}`);
  }
  const roleMemory = roleLines.length
    ? joinLines(["Role memory (filtered):", ...roleLines.map((x) => `- ${x}`)])
    : "";

  const eventLines = (profile.importantEvents || [])
    .slice(0, 10)
    .map((ev) => `- [${ev.happenedAt}] (${ev.domain}, ${ev.importance}) ${ev.content}`);
  const episodic = eventLines.length ? joinLines(["Episodic memory:", ...eventLines]) : "";

  const attitudeBBlock = attitudeB
    ? joinLines([
      "Attitude B (session temporary):",
      `- current_user_state: ${attitudeB.currentUserState}`,
      `- temporary_tone: ${attitudeB.temporaryTone}`,
      `- urgency: ${attitudeB.urgency}`,
      `- note: ${attitudeB.note}`,
      `- expires_at: ${attitudeB.expiresAt}`,
      "- policy: Session-only modulation; never rewrite Attitude A immediately.",
    ])
    : "";

  return {
    attitudeA,
    bio,
    roleMemory,
    episodic,
    attitudeB: attitudeBBlock,
  };
}

export function buildPersonaContext(
  messages: any[],
  options: {
    globalRules?: string[];
    personaBaseRules?: string[];
    sections?: PersonaContextSections | null;
    extraSystemBlocks?: string[];
  },
): any[] {
  const globalRules = Array.isArray(options.globalRules) ? options.globalRules.filter(Boolean) : [];
  const personaBaseRules = Array.isArray(options.personaBaseRules) ? options.personaBaseRules.filter(Boolean) : [];
  const sections = options.sections || null;
  const extra = Array.isArray(options.extraSystemBlocks) ? options.extraSystemBlocks.filter(Boolean) : [];

  const systemBlocks: string[] = [];
  systemBlocks.push(...globalRules);
  systemBlocks.push(...personaBaseRules);

  if (sections) {
    if (sections.attitudeA) systemBlocks.push(sections.attitudeA);
    if (sections.bio) systemBlocks.push(sections.bio);
    if (sections.roleMemory) systemBlocks.push(sections.roleMemory);
    if (sections.episodic) systemBlocks.push(sections.episodic);
    if (sections.attitudeB) systemBlocks.push(sections.attitudeB);
  }

  systemBlocks.push(...extra);

  const systemMessages = systemBlocks.map((content) => ({ role: "system", content }));
  return [...systemMessages, ...(Array.isArray(messages) ? messages : [])];
}
