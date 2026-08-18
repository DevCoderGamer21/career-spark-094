/**
 * Server-side role gate checks: every privileged server function must assert
 * the caller's role before doing any work, and must be behind auth middleware.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");

const admin = read("src/lib/admin.functions.ts");
const recruiter = read("src/lib/recruiter.functions.ts");
const placement = read("src/lib/placement.functions.ts");

function serverFnBlocks(src: string): { name: string; body: string }[] {
  const re = /export const (\w+) = createServerFn\(([\s\S]*?)\n\s*\}\);/g;
  return Array.from(src.matchAll(re)).map((m) => ({ name: m[1], body: m[0] }));
}

describe("admin server functions are admin-only", () => {
  const fns = serverFnBlocks(admin);

  it("exports server functions", () => {
    expect(fns.length).toBeGreaterThan(0);
  });

  it.each(fns.map((f) => f.name))("%s requires an authenticated session", (name) => {
    const fn = fns.find((f) => f.name === name)!;
    expect(fn.body).toContain("requireSupabaseAuth");
  });

  it.each(fns.map((f) => f.name))("%s asserts the admin role", (name) => {
    const fn = fns.find((f) => f.name === name)!;
    expect(fn.body).toContain("assertAdmin");
  });

  it("assertAdmin checks the role through has_role and throws otherwise", () => {
    expect(admin).toMatch(/rpc\("has_role",\s*\{\s*_user_id:\s*userId,\s*_role:\s*"admin"\s*\}\)/);
    expect(admin).toContain('throw new Error("Admin role required")');
  });

  it("never trusts client-supplied role claims for authorization", () => {
    expect(/data\.(isAdmin|role)\b/.test(admin)).toBe(false);
  });
});

describe("role mutations are audited and validated", () => {
  it("validates the role enum on the server", () => {
    expect(admin).toContain('z.enum(["admin", "candidate", "recruiter", "placement_officer"])');
    expect(admin).toContain("z.string().uuid()");
  });

  it("writes an audit record for grants and revocations", () => {
    expect(admin).toContain('action: data.grant ? "role.grant" : "role.revoke"');
  });

  it("writes an audit record for model configuration changes", () => {
    expect(admin).toContain('action: "model.update"');
  });
});

describe("recruiter and placement functions are role gated", () => {
  it.each(
    serverFnBlocks(recruiter)
      .concat(serverFnBlocks(placement))
      .map((f) => f.name),
  )("%s is behind auth middleware", (name) => {
    const fn = serverFnBlocks(recruiter).concat(serverFnBlocks(placement)).find((f) => f.name === name)!;
    expect(fn.body).toContain("requireSupabaseAuth");
  });

  it("placement functions verify the placement_officer (or admin) role", () => {
    expect(placement).toMatch(/placement_officer/);
  });

  it("recruiter functions never use the admin (RLS-bypassing) client for reads", () => {
    const adminClientUses = recruiter.match(/supabaseAdmin\.from\("(\w+)"\)\s*\.select/g) ?? [];
    expect(adminClientUses).toHaveLength(0);
  });
});
