/**
 * Static security invariants over the SQL migration history.
 *
 * These run with no database credentials, so CI can block a PR that
 * reintroduces a known-bad pattern (table without RLS/GRANTs, roles stored on
 * profiles, self-grantable admin, mutable audit trail, publicly executable
 * internal functions).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sqlByFile = new Map(files.map((f) => [f, readFileSync(path.join(MIGRATIONS_DIR, f), "utf8")]));
const allSql = Array.from(sqlByFile.values()).join("\n");
const lower = allSql.toLowerCase();

function createdTables(sql: string): string[] {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
  return Array.from(sql.matchAll(re)).map((m) => m[1]);
}

const tables = Array.from(new Set(createdTables(allSql)));

describe("migration history is present", () => {
  it("has migrations and tables to check", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(tables.length).toBeGreaterThan(0);
  });
});

describe("every public table is protected", () => {
  it.each(tables)("%s enables row level security", (table) => {
    expect(lower).toContain(`alter table public.${table} enable row level security`);
  });

  it.each(tables)("%s has explicit GRANTs for the Data API", (table) => {
    const grantRe = new RegExp(`grant\\s+[^;]*\\son\\s+(table\\s+)?public\\.${table}\\s+to`, "i");
    expect(grantRe.test(allSql)).toBe(true);
  });

  it.each(tables)("%s has at least one RLS policy", (table) => {
    const policyRe = new RegExp(`create\\s+policy\\s+[^;]*\\son\\s+public\\.${table}\\b`, "i");
    expect(policyRe.test(allSql)).toBe(true);
  });
});

describe("roles are never stored on user-facing tables", () => {
  it("keeps roles in a dedicated user_roles table", () => {
    expect(tables).toContain("user_roles");
  });

  it("never adds a role column to profiles", () => {
    expect(/alter\s+table\s+public\.profiles\s+add\s+column\s+[^;]*\brole\b/i.test(allSql)).toBe(false);
    const profilesCreate = allSql.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.profiles\s*\(([\s\S]*?)\n\);/i);
    if (profilesCreate) {
      expect(/^\s*role\b/im.test(profilesCreate[1])).toBe(false);
      expect(/\bapp_role\b/i.test(profilesCreate[1])).toBe(false);
    }
  });

  it("checks roles through the has_role security definer function", () => {
    expect(lower).toContain("function public.has_role");
    expect(lower).toContain("security definer");
  });
});

describe("self-service role flows cannot escalate to admin", () => {
  const grantSelf = allSql.slice(allSql.toLowerCase().lastIndexOf("function public.grant_self_role"));

  it("grant_self_role refuses the admin role", () => {
    expect(grantSelf.toLowerCase()).toContain("admin role cannot be self-granted");
  });

  it("grant_self_role requires an authenticated caller", () => {
    expect(grantSelf.toLowerCase()).toContain("auth.uid() is null");
  });

  it("claim_first_admin only works when no admin exists", () => {
    const claim = allSql.slice(allSql.toLowerCase().lastIndexOf("function public.claim_first_admin")).toLowerCase();
    expect(claim).toContain("admin already exists");
    expect(claim).toContain("auth.uid() is null");
  });

  it("only admins may manage the user_roles table directly", () => {
    expect(lower).toContain("has_role(auth.uid(), 'admin'::app_role)");
  });
});

describe("internal database functions are not callable from the public API", () => {
  const internal = ["handle_new_user", "set_updated_at", "prevent_audit_mutation", "audit_user_role_change"];

  it.each(internal)("%s is revoked from anon and authenticated", (fn) => {
    const re = new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`, "i");
    expect(re.test(allSql)).toBe(true);
  });

  it("revokes anon execution of the privileged role helpers", () => {
    for (const fn of ["has_role", "claim_first_admin", "grant_self_role"]) {
      const re = new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]{0,80}from\\s+public,\\s*anon`, "i");
      expect(re.test(allSql), `${fn} still executable by anon`).toBe(true);
    }
  });
});

describe("the audit trail is immutable", () => {
  it("blocks UPDATE and DELETE with triggers", () => {
    expect(lower).toContain("before update on public.audit_logs");
    expect(lower).toContain("before delete on public.audit_logs");
    expect(lower).toContain("audit_logs records are immutable");
  });

  it("revokes UPDATE/DELETE privileges from every API role", () => {
    expect(/revoke\s+update,\s*delete,\s*truncate\s+on\s+public\.audit_logs\s+from\s+anon,\s*authenticated,\s*service_role/i.test(allSql)).toBe(true);
  });

  it("logs every privilege change at the database level", () => {
    expect(lower).toContain("after insert on public.user_roles");
    expect(lower).toContain("after delete on public.user_roles");
    expect(lower).toContain("'role.grant'");
    expect(lower).toContain("'role.revoke'");
  });

  it("only admins and placement officers can read audit logs", () => {
    const policies = Array.from(
      allSql.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+public\.audit_logs([\s\S]*?);/gi),
    ).map((m) => m[0].toLowerCase());
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      expect(p).toContain("for select");
      expect(p.includes("'admin'::app_role") || p.includes("'placement_officer'::app_role")).toBe(true);
    }
  });
});
