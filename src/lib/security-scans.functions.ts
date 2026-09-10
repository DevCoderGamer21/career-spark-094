import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ScanFinding = {
  id?: string;
  title: string;
  level: "critical" | "warning" | "info";
  detail?: string;
  source?: string;
};

export type ScanRun = {
  id: string;
  source: string;
  trigger: string;
  branch: string | null;
  commit_sha: string | null;
  run_url: string | null;
  status: string;
  total_findings: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  new_findings: number;
  duration_ms: number | null;
  findings: ScanFinding[];
  logs: string | null;
  created_at: string;
};

export const listSecurityScanRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScanRun[]> => {
    const { data, error } = await context.supabase
      .from("security_scan_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ScanRun[];
  });
