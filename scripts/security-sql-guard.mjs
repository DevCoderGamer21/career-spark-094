#!/usr/bin/env node
/**
 * Fast, dependency-free guard over supabase/migrations/*.sql.
 *
 * Fails (exit 1) when a migration introduces a known-bad security pattern, so
 * CI can block the PR before it is merged or applied.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
const lower = sql.toLowerCase();

const problems = [];
const fail = (msg) => problems.push(msg);

// 1. Every created public table must have RLS, GRANTs and at least one policy.
const tables = [...new Set(
  Array.from(sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)).map((m) => m[1]),
)];
for (const t of tables) {
  if (!lower.includes(`alter table public.${t} enable row level security`)) fail(`table public.${t} does not enable row level security`);
  if (!new RegExp(`grant\\s+[^;]*\\son\\s+(table\\s+)?public\\.${t}\\s+to`, "i").test(sql)) fail(`table public.${t} has no GRANT statements`);
  if (!new RegExp(`create\\s+policy\\s+[^;]*\\son\\s+public\\.${t}\\b`, "i").test(sql)) fail(`table public.${t} has no RLS policy`);
}

// 2. Roles must never live on a user-editable table.
if (/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.profiles[\s\S]*?\n\);/i.test(sql)) {
  const body = sql.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.profiles[\s\S]*?\n\);/i)[0];
  if (/\brole\b|\bapp_role\b|\bis_admin\b/i.test(body)) fail("profiles table must not contain a role/is_admin column");
}
if (/alter\s+table\s+public\.profiles\s+add\s+column\s+[^;]*\b(role|is_admin)\b/i.test(sql)) {
  fail("a migration adds a role/is_admin column to profiles");
}
if (!tables.includes("user_roles")) fail("no dedicated public.user_roles table");

// 3. Self-service role flows must not be able to hand out admin.
const grantSelf = Array.from(sql.matchAll(/create\s+or\s+replace\s+function\s+public\.grant_self_role[\s\S]*?\$\$;/gi)).pop()?.[0]?.toLowerCase();
if (!grantSelf) fail("grant_self_role definition not found");
else {
  if (!grantSelf.includes("admin role cannot be self-granted")) fail("grant_self_role no longer blocks the admin role");
  if (!grantSelf.includes("auth.uid() is null")) fail("grant_self_role no longer requires an authenticated caller");
}
const claim = Array.from(sql.matchAll(/create\s+or\s+replace\s+function\s+public\.claim_first_admin[\s\S]*?\$\$;/gi)).pop()?.[0]?.toLowerCase();
if (!claim) fail("claim_first_admin definition not found");
else if (!claim.includes("admin already exists")) fail("claim_first_admin no longer guards against an existing admin");

// 4. Internal functions must not be executable through the API.
for (const fn of ["handle_new_user", "set_updated_at", "prevent_audit_mutation", "audit_user_role_change"]) {
  if (!new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`, "i").test(sql)) {
    fail(`internal function ${fn} is not revoked from anon + authenticated`);
  }
}
for (const fn of ["has_role", "claim_first_admin", "grant_self_role"]) {
  if (!new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]{0,80}from\\s+public,\\s*anon`, "i").test(sql)) {
    fail(`privileged function ${fn} is still executable by anon`);
  }
}

// 5. The audit trail must stay append-only and auto-populated.
if (!lower.includes("before update on public.audit_logs") || !lower.includes("before delete on public.audit_logs")) {
  fail("audit_logs is missing its immutability triggers");
}
if (!/revoke\s+update,\s*delete,\s*truncate\s+on\s+public\.audit_logs\s+from\s+anon,\s*authenticated,\s*service_role/i.test(sql)) {
  fail("audit_logs UPDATE/DELETE privileges are not revoked from all API roles");
}
if (!lower.includes("after insert on public.user_roles") || !lower.includes("after delete on public.user_roles")) {
  fail("privilege changes on user_roles are not audited by a database trigger");
}
if (!lower.includes("before insert on public.audit_logs") || !lower.includes("function public.audit_log_chain")) {
  fail("audit_logs is missing its tamper-evident hash chain trigger");
}
if (!lower.includes("sha256(") || !lower.includes("prev_hash") || !lower.includes("record_hash")) {
  fail("audit_logs records are not hash-chained");
}
if (!lower.includes("function public.verify_audit_chain")) fail("no admin-only audit chain verifier");


// 6. No blanket grants.
if (/grant\s+all\s+on\s+all\s+tables/i.test(sql)) fail("blanket GRANT ALL ON ALL TABLES detected");
if (/grant\s+[^;]*\son\s+(table\s+)?public\.\w+\s+to\s+[^;]*\banon\b[^;]*\b(insert|update|delete)\b/i.test(sql)) {
  fail("anon is granted write access to a table");
}

if (problems.length) {
  console.error(`\u2716 ${problems.length} security invariant(s) violated:\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`\u2714 security SQL guard passed (${files.length} migrations, ${tables.length} tables)`);
