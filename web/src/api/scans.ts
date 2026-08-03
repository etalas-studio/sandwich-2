export interface ScanResult {
  id: string;
  status: "running" | "completed" | "failed" | "aborted";
  projectName: string | null;
  description: string | null;
  techStack: string | null;
  testCommand: string | null;
  areaSignals: AreaSignal[] | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AreaSignal {
  area: string;
  files: number;
  testToCodeRatio: number;
  churnScore: number;
  note: string;
}

export class ScanInProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanInProgressError";
  }
}

export async function triggerScan(): Promise<{ scanId: string }> {
  const res = await fetch("/api/scans/run", { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    const message = body?.error ?? `HTTP ${res.status}`;
    if (res.status === 409) throw new ScanInProgressError(message);
    throw new Error(message);
  }
  return res.json() as Promise<{ scanId: string }>;
}

export async function abortScan(scanId: string): Promise<void> {
  const res = await fetch("/api/scans/abort", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scanId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
}

export async function fetchLatestScan(): Promise<ScanResult | null> {
  const res = await fetch("/api/scans/latest");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ScanResult | null>;
}
