/**
 * Live RLS checks for the unauthenticated (anon) role.
 *
 * Uses only the publishable key, so it is safe to run in CI. Skipped
 * automatically when the backend env vars are not available.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const suite = URL && KEY ? describe : describe.skip;

const client = () =>
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

const TABLES = [
  "profiles",
  "resumes",
  "user_roles",
  "job_descriptions",
  "shortlists",
  "jd_matches",
  "advisor_messages",
  "builder_resumes",
  "audit_logs",
  "ai_model_settings",
  "model_test_history",
];

suite("anonymous visitors cannot read application data", () => {
  it.each(TABLES)("%s returns no rows to anon", async (table) => {
    const { data, error } = await client().from(table).select("*").limit(1);
    // Either denied outright, or RLS filters everything out.
    if (!error) expect(data ?? []).toHaveLength(0);
    else expect(error.message).toBeTruthy();
  });
});

suite("anonymous visitors cannot write or escalate privileges", () => {
  it("cannot insert a role for themselves or anyone else", async () => {
    const { error } = await client()
      .from("user_roles")
      .insert({ user_id: "00000000-0000-0000-0000-000000000000", role: "admin" });
    expect(error).toBeTruthy();
  });

  it("cannot call has_role", async () => {
    const { error } = await client().rpc("has_role", {
      _user_id: "00000000-0000-0000-0000-000000000000",
      _role: "admin",
    });
    expect(error).toBeTruthy();
  });

  it("cannot call grant_self_role", async () => {
    const { error } = await client().rpc("grant_self_role", { _role: "recruiter" });
    expect(error).toBeTruthy();
  });

  it("cannot call claim_first_admin", async () => {
    const { error } = await client().rpc("claim_first_admin");
    expect(error).toBeTruthy();
  });

  it("cannot call internal trigger functions", async () => {
    for (const fn of ["handle_new_user", "set_updated_at", "audit_user_role_change", "prevent_audit_mutation"]) {
      const { error } = await client().rpc(fn as any);
      expect(error, `${fn} should not be callable`).toBeTruthy();
    }
  });

  it("cannot insert audit log entries", async () => {
    const { error } = await client().from("audit_logs").insert({ action: "fake.event" });
    expect(error).toBeTruthy();
  });
});
