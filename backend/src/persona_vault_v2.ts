import type { Env } from "./index";
import {
  buildPersonaVaultPath,
  dropboxListFolder,
  dropboxReadText,
  dropboxWriteText,
  getPersonaDropboxAccessToken,
  type Persona,
} from "./dropbox_vault";

export type VaultV2Persona = "avery" | "riley";

export type VaultV2InventoryItem = {
  path: string;
  name: string;
  tag: string;
  bucket: "canonical" | "legacy" | "duplicate_candidate" | "attachment" | "unknown";
  reason: string;
};

export type VaultV2Inventory = {
  ok: boolean;
  persona: VaultV2Persona;
  pid: string;
  root: string;
  tokenPersona: Persona;
  scannedRoots: string[];
  canonicalMissing: string[];
  counts: Record<VaultV2InventoryItem["bucket"], number>;
  items: VaultV2InventoryItem[];
};

export type VaultV2SeedResult = {
  ok: boolean;
  persona: VaultV2Persona;
  pid: string;
  root: string;
  wrote: string[];
  skippedExisting: string[];
  failed: string[];
};

export type VaultV2Status = {
  ok: boolean;
  persona: VaultV2Persona;
  pid: string;
  root: string;
  activeFiles: Array<{ path: string; kind: string; reason: string; updated_at?: string }>;
  inactiveCount: number;
  evidenceTail: string[];
};

export type VaultV2MigrationPlanItem = {
  action: "keep" | "ignore" | "review";
  from: string;
  to: string;
  bucket: VaultV2InventoryItem["bucket"];
  reason: string;
};

export type VaultV2MigrationPlan = {
  ok: boolean;
  persona: VaultV2Persona;
  pid: string;
  root: string;
  dryRun: true;
  archiveRoot: string;
  counts: Record<VaultV2MigrationPlanItem["action"], number>;
  items: VaultV2MigrationPlanItem[];
};

const CANONICAL_FILES = ["_index.json", "_directive.md", "_state.json", "_evidence.log.jsonl"];
const CANONICAL_FOLDERS = ["worklogs", "logs", "attachments", "archive"];
const ATTACHMENT_EXT = /\.(png|jpe?g|webp|gif|bmp|svg|heic|pdf|zip|mp3|wav|m4a|mp4|mov)$/i;

function pidFor(persona: VaultV2Persona): string {
  return `p_${persona}`;
}

function canonicalRoot(pid: string): string {
  return buildPersonaVaultPath(pid);
}

function nowIso(): string {
  return new Date().toISOString();
}

function legacyRoots(persona: VaultV2Persona, pid: string): string[] {
  return [
    `/${persona}_memory`,
    `/persona_policy/${pid}`,
    `/persona_policy/${persona}`,
    `/persona_promotion/${pid}`,
    `/persona_promotion/${persona}`,
    buildPersonaVaultPath(pid, "_memory"),
    buildPersonaVaultPath(pid, "_policy"),
    buildPersonaVaultPath(pid, "_promotion"),
  ];
}

function normalizeNameForDuplicate(name: string, persona: VaultV2Persona): string {
  return String(name || "")
    .toLowerCase()
    .replace(new RegExp(`^p_${persona}[_-]?`), "")
    .replace(new RegExp(`^${persona}[_-]?`), "")
    .replace(/[-_]/g, "")
    .replace(/\.(md|txt|csv|json|jsonl)$/i, "");
}

function classify(path: string, tag: string, root: string, persona: VaultV2Persona, duplicateKeys: Set<string>): VaultV2InventoryItem {
  const clean = String(path || "").replace(/\\/g, "/");
  const name = clean.split("/").filter(Boolean).pop() || "";
  const inCanonicalRoot = clean.toLowerCase().startsWith(root.toLowerCase() + "/");
  const rel = inCanonicalRoot ? clean.slice(root.length + 1) : clean.replace(/^\/+/, "");
  const first = rel.split("/")[0] || "";
  const dupKey = normalizeNameForDuplicate(name, persona);

  if (clean.toLowerCase() === root.toLowerCase()) {
    return { path: clean, name, tag, bucket: "canonical", reason: "v2_root" };
  }
  if (inCanonicalRoot && CANONICAL_FOLDERS.includes(first)) {
    return { path: clean, name, tag, bucket: "canonical", reason: "under_v2_canonical_path" };
  }
  if (
    clean.includes(`/${persona}_memory/`)
    || clean.includes("/persona_policy/")
    || clean.includes("/persona_promotion/")
    || clean.includes("/_memory/")
    || clean.includes("/_policy/")
    || clean.includes("/_promotion/")
  ) {
    return { path: clean, name, tag, bucket: "legacy", reason: "known_legacy_or_v1_path" };
  }
  if (tag !== "folder" && ATTACHMENT_EXT.test(name)) {
    return { path: clean, name, tag, bucket: "attachment", reason: "attachment_extension" };
  }
  if (tag !== "folder" && inCanonicalRoot && CANONICAL_FILES.includes(rel)) {
    return { path: clean, name, tag, bucket: "canonical", reason: "v2_canonical_file" };
  }
  if (tag !== "folder" && duplicateKeys.has(dupKey)) {
    return { path: clean, name, tag, bucket: "duplicate_candidate", reason: `normalized_name=${dupKey}` };
  }
  return { path: clean, name, tag, bucket: "unknown", reason: "not_indexed_by_v2_rules" };
}

export async function getPersonaVaultV2Inventory(env: Env, persona: VaultV2Persona): Promise<VaultV2Inventory> {
  const pid = pidFor(persona);
  const root = canonicalRoot(pid);
  const token = await getPersonaDropboxAccessToken(env, persona);
  const emptyCounts: Record<VaultV2InventoryItem["bucket"], number> = {
    canonical: 0,
    legacy: 0,
    duplicate_candidate: 0,
    attachment: 0,
    unknown: 0,
  };
  if (!token) {
    return {
      ok: false,
      persona,
      pid,
      root,
      tokenPersona: persona,
      scannedRoots: [],
      canonicalMissing: CANONICAL_FILES,
      counts: emptyCounts,
      items: [],
    };
  }

  const roots = [root, ...legacyRoots(persona, pid)];
  const byPath = new Map<string, VaultV2InventoryItem>();
  const rawItems: Array<{ path: string; tag: string }> = [];
  for (const scanRoot of roots) {
    const entries = await dropboxListFolder(token, scanRoot);
    for (const entry of entries) {
      const path = String(entry.path_display || entry.path_lower || "").trim();
      if (!path) continue;
      rawItems.push({ path, tag: String(entry[".tag"] || "file") });
    }
  }

  const nameCounts = new Map<string, number>();
  for (const { path, tag } of rawItems) {
    if (tag === "folder") continue;
    const name = path.split("/").filter(Boolean).pop() || "";
    const key = normalizeNameForDuplicate(name, persona);
    if (!key) continue;
    nameCounts.set(key, Number(nameCounts.get(key) || 0) + 1);
  }
  const duplicateKeys = new Set([...nameCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key));

  for (const { path, tag } of rawItems) {
    const item = classify(path, tag, root, persona, duplicateKeys);
    byPath.set(item.path.toLowerCase(), item);
  }

  const items = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  const counts = { ...emptyCounts };
  for (const item of items) counts[item.bucket] += 1;
  const lowerPaths = new Set(items.map((x) => x.path.toLowerCase()));
  const canonicalMissing = CANONICAL_FILES.filter((file) => !lowerPaths.has(`${root}/${file}`.toLowerCase()));

  return {
    ok: true,
    persona,
    pid,
    root,
    tokenPersona: persona,
    scannedRoots: roots,
    canonicalMissing,
    counts,
    items,
  };
}

function defaultDirective(persona: VaultV2Persona): string {
  if (persona === "avery") {
    return [
      "# Avery Directive (Priority 1)",
      "",
      "Role: worklog_manager",
      "",
      "- Use the vault index before claiming file knowledge.",
      "- Do not claim file creation, edits, deletion, or reads without operation evidence.",
      "- Keep worklog entries structured and concise.",
      "- Ask at most one short follow-up question when needed.",
    ].join("\n");
  }
  return [
    "# Riley Directive (Priority 1)",
    "",
    "Role: wealth_manager",
    "",
    "- Use the vault index before claiming file knowledge.",
    "- Do not claim file creation, edits, deletion, or reads without operation evidence.",
    "- Keep finance records structured and source-aware.",
    "- When the user asks Riley to create/save a finance file without a path, choose a safe default path yourself: master_wealth_ledger.csv for ledger CSV, logs/wealth_events.jsonl for event logs, or note_YYYY_MM_DD.txt for notes.",
  ].join("\n");
}

async function firstExistingDirective(token: string, pid: string, persona: VaultV2Persona): Promise<string> {
  const candidates = [
    buildPersonaVaultPath(pid, `${pid}_directive.md`),
    buildPersonaVaultPath(pid, `${persona}_directive.md`),
  ];
  for (const path of candidates) {
    const txt = await dropboxReadText(token, path);
    if (txt && txt.trim()) return txt.trim();
  }
  return defaultDirective(persona);
}

async function writeIfMissing(
  token: string,
  path: string,
  content: string,
  result: Pick<VaultV2SeedResult, "wrote" | "skippedExisting" | "failed">,
): Promise<void> {
  const existing = await dropboxReadText(token, path);
  if (existing != null) {
    result.skippedExisting.push(path);
    return;
  }
  const ok = await dropboxWriteText(token, path, content);
  if (ok) result.wrote.push(path);
  else result.failed.push(path);
}

export async function seedPersonaVaultV2(env: Env, persona: VaultV2Persona): Promise<VaultV2SeedResult> {
  const pid = pidFor(persona);
  const root = canonicalRoot(pid);
  const token = await getPersonaDropboxAccessToken(env, persona);
  const result: VaultV2SeedResult = {
    ok: false,
    persona,
    pid,
    root,
    wrote: [],
    skippedExisting: [],
    failed: [],
  };
  if (!token) {
    result.failed.push(`${persona} dropbox token missing`);
    return result;
  }

  const inventory = await getPersonaVaultV2Inventory(env, persona);
  const now = nowIso();
  const index = {
    version: 2,
    persona,
    pid,
    root,
    generated_at: now,
    active_files: inventory.items
      .filter((item) => item.bucket === "canonical" && item.tag !== "folder")
      .map((item) => ({ path: item.path, kind: "canonical", reason: item.reason })),
    inactive_candidates: inventory.items
      .filter((item) => item.bucket !== "canonical" && item.tag !== "folder")
      .map((item) => ({ path: item.path, bucket: item.bucket, reason: item.reason })),
  };
  const state = {
    version: 2,
    persona,
    pid,
    updated_at: now,
    status: "seeded",
    notes: "Initial v2 state seed. Existing legacy files are not moved or deleted.",
  };
  const evidence = JSON.stringify({
    id: `vault_v2_seed_${Date.now()}`,
    timestamp: now,
    persona,
    pid,
    action: "seed_v2_canonical_files",
    mode: "additive_no_migration",
  }) + "\n";

  await writeIfMissing(token, `${root}/_index.json`, `${JSON.stringify(index, null, 2)}\n`, result);
  await writeIfMissing(token, `${root}/_directive.md`, `${await firstExistingDirective(token, pid, persona)}\n`, result);
  await writeIfMissing(token, `${root}/_state.json`, `${JSON.stringify(state, null, 2)}\n`, result);
  await writeIfMissing(token, `${root}/_evidence.log.jsonl`, evidence, result);

  result.ok = result.failed.length === 0;
  return result;
}

export async function buildPersonaVaultV2SystemPrompt(env: Env, persona: VaultV2Persona): Promise<string> {
  const pid = pidFor(persona);
  const root = canonicalRoot(pid);
  const token = await getPersonaDropboxAccessToken(env, persona);
  if (!token) return "";

  const indexText = await dropboxReadText(token, `${root}/_index.json`);
  const stateText = await dropboxReadText(token, `${root}/_state.json`);
  if (!indexText && !stateText) return "";

  let active: string[] = [];
  let inactiveCount = 0;
  if (indexText) {
    try {
      const parsed = JSON.parse(indexText) as {
        active_files?: Array<{ path?: string }>;
        inactive_candidates?: unknown[];
      };
      active = Array.isArray(parsed.active_files)
        ? parsed.active_files.map((x) => String(x?.path || "")).filter(Boolean).slice(0, 20)
        : [];
      inactiveCount = Array.isArray(parsed.inactive_candidates) ? parsed.inactive_candidates.length : 0;
    } catch {
      active = [];
    }
  }

  let stateStatus = "";
  let stateUpdatedAt = "";
  if (stateText) {
    try {
      const parsed = JSON.parse(stateText) as { status?: string; updated_at?: string };
      stateStatus = String(parsed.status || "");
      stateUpdatedAt = String(parsed.updated_at || "");
    } catch {
      stateStatus = "invalid_state_json";
    }
  }

  return [
    `${persona === "avery" ? "Avery" : "Riley"} Vault v2 control block:`,
    `root=${root}`,
    `index_present=${!!indexText}`,
    `state_present=${!!stateText}`,
    `state_status=${stateStatus || "unknown"}`,
    `state_updated_at=${stateUpdatedAt || "unknown"}`,
    `active_index_files=${active.join(" | ") || "none"}`,
    `inactive_candidate_count=${inactiveCount}`,
    "Vault rule: only treat indexed active files as active working context.",
    "Vault rule: do not claim a file operation succeeded unless a tool/action result or evidence id exists.",
    ...(persona === "riley"
      ? ["Riley agent rule: if a create/save finance-file request has no filename, choose a safe default path yourself instead of asking for one."]
      : []),
  ].join("\n");
}

export async function getPersonaVaultV2Status(env: Env, persona: VaultV2Persona, tail = 20): Promise<VaultV2Status> {
  const pid = pidFor(persona);
  const root = canonicalRoot(pid);
  const token = await getPersonaDropboxAccessToken(env, persona);
  if (!token) {
    return { ok: false, persona, pid, root, activeFiles: [], inactiveCount: 0, evidenceTail: [] };
  }
  const indexText = await dropboxReadText(token, `${root}/_index.json`);
  const evidenceText = await dropboxReadText(token, `${root}/_evidence.log.jsonl`);
  let activeFiles: VaultV2Status["activeFiles"] = [];
  let inactiveCount = 0;
  if (indexText) {
    try {
      const parsed = JSON.parse(indexText) as {
        active_files?: VaultV2Status["activeFiles"];
        inactive_candidates?: unknown[];
      };
      activeFiles = Array.isArray(parsed.active_files) ? parsed.active_files : [];
      inactiveCount = Array.isArray(parsed.inactive_candidates) ? parsed.inactive_candidates.length : 0;
    } catch {
      activeFiles = [];
    }
  }
  const evidenceFromLog = String(evidenceText || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  const evidenceFiles = await dropboxListFolder(token, `${root}/logs/evidence`);
  const evidenceFromFiles: string[] = [];
  for (const entry of evidenceFiles.slice(-100)) {
    const path = String(entry.path_display || entry.path_lower || "").trim();
    if (!/\.json$/i.test(path)) continue;
    const txt = await dropboxReadText(token, path);
    if (txt && txt.trim()) evidenceFromFiles.push(txt.trim().replace(/\s+/g, " "));
  }
  const evidenceTail = [...evidenceFromLog, ...evidenceFromFiles]
    .filter(Boolean)
    .slice(-Math.max(1, Math.min(100, tail)));
  return { ok: true, persona, pid, root, activeFiles, inactiveCount, evidenceTail };
}

export async function buildPersonaVaultV2MigrationPlan(env: Env, persona: VaultV2Persona): Promise<VaultV2MigrationPlan> {
  const inventory = await getPersonaVaultV2Inventory(env, persona);
  const archiveRoot = "";
  const counts: Record<VaultV2MigrationPlanItem["action"], number> = { keep: 0, ignore: 0, review: 0 };
  const items: VaultV2MigrationPlanItem[] = [];

  for (const item of inventory.items) {
    if (item.bucket === "canonical") {
      items.push({
        action: "keep",
        from: item.path,
        to: item.path,
        bucket: item.bucket,
        reason: item.reason,
      });
      counts.keep += 1;
      continue;
    }

    const action: VaultV2MigrationPlanItem["action"] =
      item.bucket === "unknown" && item.tag === "folder" ? "review" : "ignore";
    items.push({
      action,
      from: item.path,
      to: "",
      bucket: item.bucket,
      reason: item.reason,
    });
    counts[action] += 1;
  }

  return {
    ok: inventory.ok,
    persona,
    pid: inventory.pid,
    root: inventory.root,
    dryRun: true,
    archiveRoot,
    counts,
    items,
  };
}
