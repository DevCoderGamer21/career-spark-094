/**
 * Explicit privilege-escalation attempts.
 *
 * Static half: proves the migration history cannot express an escalation path.
 * Live half: actually tries to escalate as an anonymous caller (skipped when
 * backend env vars are absent, e.g. on a fork PR).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const allSql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
  .join("\n");
const lower = allSql.toLowerCase();

describe("no SQL path grants admin to a non-admin", () => {
  it("only admins may write to user_roles through the API", () => {
    const policies = Array.from(
      allSql.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+public\.user_roles([\s\S]*?);/gi),
    ).map((m) => m[0].toLowerCase());
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      const isWrite = /for\s+(all|insert|update|delete)/.test(p);
      if (isWrite) expect(p).toContain("has_role(auth.uid(), 'admin'");
    }
  });

  it("no policy or function lets a caller name their own role from client input", () => {
    expect(/with\s+check\s*\(\s*true\s*\)/i.test(allSql)).toBe(false);
    expect(/create\s+policy[^;]*on\s+public\.user_roles[^;]*to\s+anon/i.test(allSql)).toBe(false);
  });

  it("grant_self_role hard-blocks the admin role before inserting", () => {
    const body = Array.from(
      allSql.matchAll(/create\s+or\s+replace\s+function\s+public\.grant_self_role[\s\S]*?\$\$;/gi),
    ).pop()![0].toLowerCase();
    const guardAt = body.indexOf("admin role cannot be self-granted");
    const insertAt = body.indexOf("insert into public.user_roles");
    expect(guardAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(guardAt);
    // The insert must use the caller's own id, never a parameter.
    expect(body).toContain("values (auth.uid(), _role)");
  });

  it("claim_first_admin is a one-shot that also pins the caller as the target", () => {
    const body = Array.from(
      allSql.matchAll(/create\s+or\s+replace\s+function\s+public\.claim_first_admin[\s\S]*?\$\$;/gi),
    ).pop()![0].toLowerCase();
    expect(body).toContain("admin already exists");
    expect(body).toContain("values (auth.uid(), 'admin')");
    expect(body).not.toMatch(/\(_user_id/);
  });

  it("server-side admin gates never read a role from request input", () => {
    const admin = readFileSync(path.resolve(process.cwd(), "src/lib/admin.functions.ts"), "utf8");
    expect(/_role:\s*data\./.test(admin)).toBe(false);
    expect(admin).toMatch(/_user_id:\s*userId/);
  });
});

describe("the audit chain is tamper-evident", () => {
  it("hashes each record together with the previous one", () => {
    expect(lower).toContain("function public.audit_log_chain");
    expect(lower).toContain("before insert on public.audit_logs");
    expect(lower).toContain("prev_hash");
    expect(lower).toContain("record_hash");
    expect(lower).toContain("sha256(");
  });

  it("ships an admin-only chain verifier", () => {
    const body = Array.from(
      allSql.matchAll(/create\s+or\s+replace\s+function\s+public\.verify_audit_chain[\s\S]*?\$\$;/gi),
    ).pop()![0].toLowerCase();
    expect(body).toContain("has_role(auth.uid(), 'admin')");
    expect(body).toContain("admin role required");
  });

  it("keeps hash columns unreachable for rewriting (audit rows stay immutable)", () => {
    expect(lower).toContain("before update on public.audit_logs");
    expect(lower).toContain("before delete on public.audit_logs");
  });
});

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

live("live escalation attempts by an unauthenticated caller all fail", () => {
  const victim = "00000000-0000-0000-0000-000000000000";

  it("cannot grant itself or anyone admin", async () => {
    const { error } = await anonClient().from("user_roles").insert({ user_id: victim, role: "admin" });
    expect(error).toBeTruthy();
  });

  it("cannot upgrade an existing role row", async () => {
    const { error, data } = await anonClient()
      .from("user_roles")
      .update({ role: "admin" })
      .eq("user_id", victim)
      .select();
    expect(error ?? (data ?? []).length === 0).toBeTruthy();
  });

  it("cannot delete a role row to strip an admin", async () => {
    const { error, data } = await anonClient().from("user_roles").delete().eq("role", "admin").select();
    expect(error ?? (data ?? []).length === 0).toBeTruthy();
  });

  it("cannot claim first admin or self-grant", async () => {
    expect((await anonClient().rpc("claim_first_admin")).error).toBeTruthy();
    expect((await anonClient().rpc("grant_self_role", { _role: "admin" as any })).error).toBeTruthy();
  });

  it("cannot verify or read the audit chain", async () => {
    expect((await anonClient().rpc("verify_audit_chain" as any)).error).toBeTruthy();
    const { data, error } = await anonClient().from("audit_logs").select("*").limit(1);
    if (!error) expect(data ?? []).toHaveLength(0);
  });

  it("cannot forge or rewrite an audit record", async () => {
    expect(
      (await anonClient().from("audit_logs").insert({ action: "role.grant", actor_role: "admin" })).error,
    ).toBeTruthy();
    const { error, data } = await anonClient()
      .from("audit_logs")
      .update({ action: "noop" })
      .eq("action", "role.grant")
      .select();
    expect(error ?? (data ?? []).length === 0).toBeTruthy();
  });

  it("cannot read other people's data through admin-only tables", async () => {
    for (const t of ["ai_model_settings", "model_test_history", "profiles", "resumes"]) {
      const { data, error } = await anonClient().from(t).select("*").limit(1);
      if (!error) expect(data ?? [], `${t} leaked rows to anon`).toHaveLength(0);
    }
  });
});
