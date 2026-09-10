/**
 * End-to-end validation of the tamper-evident, append-only audit log.
 *
 * Three layers:
 *  1. A TypeScript re-implementation of the SQL hash chain, proving the
 *     documented algorithm detects edits, deletions and re-orderings.
 *  2. Static assertions that the deployed SQL matches that algorithm and
 *     keeps rows immutable.
 *  3. Live attempts against the real backend (skipped without env vars)
 *     that try to insert, rewrite, delete and re-verify audit rows.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------- chain model

type Entry = {
  seq: number;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: string;
  created_at: string;
  prev_hash: string | null;
  record_hash?: string;
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Mirrors public.audit_log_payload(). */
function payloadHash(e: Entry): string {
  const parts = [
    s(e.seq), s(e.actor_id), s(e.actor_role), s(e.action), s(e.target_type),
    s(e.target_id), s(e.created_at), s(e.metadata), e.prev_hash ?? "GENESIS",
  ];
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

function appendEntry(chain: Entry[], partial: Omit<Entry, "seq" | "prev_hash" | "record_hash">): Entry[] {
  const prev = chain.at(-1) ?? null;
  const entry: Entry = { ...partial, seq: chain.length + 1, prev_hash: prev?.record_hash ?? null };
  entry.record_hash = payloadHash(entry);
  return [...chain, entry];
}

/** Mirrors public.verify_audit_chain(). */
function verifyChain(chain: Entry[]): { ok: boolean; firstBadSeq: number | null; checked: number } {
  let prev: string | null = null;
  let checked = 0;
  for (const e of chain) {
    checked++;
    const expected = payloadHash({ ...e, prev_hash: prev });
    if (e.record_hash !== expected || e.prev_hash !== prev) {
      return { ok: false, firstBadSeq: e.seq, checked };
    }
    prev = e.record_hash!;
  }
  return { ok: true, firstBadSeq: null, checked };
}

const entry = (action: string, i: number): Omit<Entry, "seq" | "prev_hash" | "record_hash"> => ({
  actor_id: `00000000-0000-0000-0000-00000000000${i}`,
  actor_role: "admin",
  action,
  target_type: "user",
  target_id: `11111111-1111-1111-1111-11111111111${i}`,
  metadata: JSON.stringify({ role: "recruiter", method: "admin" }),
  created_at: `2026-09-0${i + 1}T10:00:00+00:00`,
});

function buildChain(): Entry[] {
  let chain: Entry[] = [];
  ["role.grant", "role.revoke", "role.grant", "model.update"].forEach((a, i) => {
    chain = appendEntry(chain, entry(a, i));
  });
  return chain;
}

describe("audit chain integrity across entries", () => {
  it("accepts an untouched chain", () => {
    const chain = buildChain();
    const r = verifyChain(chain);
    expect(r.ok).toBe(true);
    expect(r.checked).toBe(chain.length);
  });

  it("links every record to its predecessor", () => {
    const chain = buildChain();
    expect(chain[0].prev_hash).toBeNull();
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].prev_hash).toBe(chain[i - 1].record_hash);
    }
  });

  it("detects an edited field in the middle of the chain", () => {
    const chain = buildChain();
    chain[1] = { ...chain[1], action: "role.grant" };
    const r = verifyChain(chain);
    expect(r.ok).toBe(false);
    expect(r.firstBadSeq).toBe(2);
  });

  it("detects edited metadata even when the hash columns are left alone", () => {
    const chain = buildChain();
    chain[2] = { ...chain[2], metadata: JSON.stringify({ role: "admin", method: "admin" }) };
    expect(verifyChain(chain).firstBadSeq).toBe(3);
  });

  it("detects a re-hashed row because the successor no longer links to it", () => {
    const chain = buildChain();
    const forged = { ...chain[1], actor_role: "service" };
    forged.record_hash = payloadHash(forged);
    chain[1] = forged;
    const r = verifyChain(chain);
    expect(r.ok).toBe(false);
    // Re-hashing survives its own row check but breaks the next link.
    expect(r.firstBadSeq).toBe(3);
  });

  it("detects a deleted entry", () => {
    const chain = buildChain();
    chain.splice(1, 1);
    expect(verifyChain(chain).ok).toBe(false);
  });

  it("detects re-ordered entries", () => {
    const chain = buildChain();
    [chain[1], chain[2]] = [chain[2], chain[1]];
    expect(verifyChain(chain).ok).toBe(false);
  });

  it("detects a back-dated timestamp", () => {
    const chain = buildChain();
    chain[3] = { ...chain[3], created_at: "2020-01-01T00:00:00+00:00" };
    expect(verifyChain(chain).firstBadSeq).toBe(4);
  });

  it("appending keeps the chain valid", () => {
    const chain = appendEntry(buildChain(), entry("role.revoke", 4));
    expect(verifyChain(chain).ok).toBe(true);
  });
});

// ---------------------------------------------------------------- deployed SQL

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const allSql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
  .join("\n");
const lower = allSql.toLowerCase();

describe("deployed SQL implements the same chain", () => {
  it("hashes exactly the fields the model hashes, in order", () => {
    const fn = Array.from(
      allSql.matchAll(/create\s+or\s+replace\s+function\s+public\.audit_log_payload[\s\S]*?\$\$;/gi),
    ).pop()![0].toLowerCase();
    const order = ["_seq", "_actor", "_actor_role", "_action", "_target_type", "_target_id", "_created_at", "_metadata", "_prev_hash"];
    let cursor = -1;
    for (const field of order) {
      const at = fn.indexOf(field, cursor + 1);
      expect(at, `${field} missing or out of order in audit_log_payload`).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(fn).toContain("genesis");
    expect(fn).toContain("sha256(");
  });

  it("assigns seq and prev_hash server-side on insert", () => {
    const fn = Array.from(
      allSql.matchAll(/create\s+or\s+replace\s+function\s+public\.audit_log_chain[\s\S]*?\$\$;/gi),
    ).pop()![0].toLowerCase();
    expect(fn).toContain("nextval");
    expect(fn).toContain("order by seq desc");
    expect(fn).toContain("new.record_hash := public.audit_log_payload");
    expect(lower).toContain("before insert on public.audit_logs");
  });

  it("blocks every update and delete on audit rows", () => {
    expect(lower).toContain("before update on public.audit_logs");
    expect(lower).toContain("before delete on public.audit_logs");
    const guard = Array.from(
      allSql.matchAll(/create\s+or\s+replace\s+function\s+public\.prevent_audit_mutation[\s\S]*?\$\$;/gi),
    ).pop()![0].toLowerCase();
    expect(guard).toContain("raise exception");
  });

  it("never grants insert, update or delete on audit_logs through the API", () => {
    const grants = Array.from(allSql.matchAll(/grant\s+([^;]*?)\son\s+(?:table\s+)?public\.audit_logs\s+to\s+([^;]+);/gi));
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) {
      const privileges = g[1].toLowerCase();
      const roles = g[2].toLowerCase();
      if (roles.includes("service_role")) continue;
      expect(privileges).not.toMatch(/\b(insert|update|delete|all)\b/);
    }
  });

  it("logs role grants and revokes automatically from the database", () => {
    expect(lower).toContain("after insert on public.user_roles");
    expect(lower).toContain("after delete on public.user_roles");
    const trig = Array.from(
      allSql.matchAll(/create\s+or\s+replace\s+function\s+public\.audit_user_role_change[\s\S]*?\$\$;/gi),
    ).pop()![0].toLowerCase();
    for (const method of ["claim_first_admin", "self_service", "admin", "service"]) {
      expect(trig).toContain(method);
    }
    expect(trig).toContain("'role.grant'");
    expect(trig).toContain("'role.revoke'");
  });
});

// ---------------------------------------------------------------------- live

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const live = URL && KEY ? describe : describe.skip;

const anonClient = () =>
  createClient(URL!, KEY!, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.delete("Authorization");
        headers.set("apikey", KEY!);
        return fetch(input as any, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

live("live audit log is append-only and unreadable to guests", () => {
  it("rejects forged inserts", async () => {
    const { error } = await anonClient()
      .from("audit_logs")
      .insert({ action: "role.grant", actor_role: "admin", target_type: "user" });
    expect(error).toBeTruthy();
  });

  it("rejects hash rewrites", async () => {
    const { error, data } = await anonClient()
      .from("audit_logs")
      .update({ record_hash: "0".repeat(64), prev_hash: null })
      .eq("action", "role.grant")
      .select();
    expect(error ?? (data ?? []).length === 0).toBeTruthy();
  });

  it("rejects deletions", async () => {
    const { error, data } = await anonClient().from("audit_logs").delete().neq("action", "").select();
    expect(error ?? (data ?? []).length === 0).toBeTruthy();
  });

  it("keeps the chain verifier admin-only", async () => {
    const { error } = await anonClient().rpc("verify_audit_chain" as any);
    expect(error).toBeTruthy();
  });

  it("returns no audit rows to a guest", async () => {
    const { data, error } = await anonClient().from("audit_logs").select("*").limit(1);
    if (!error) expect(data ?? []).toHaveLength(0);
  });
});
