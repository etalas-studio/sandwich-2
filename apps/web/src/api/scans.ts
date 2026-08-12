export interface Recommendation {
  title: string;
  description: string;
}

export interface ScanResult {
  id: string;
  status: "running" | "completed" | "failed" | "aborted";
  projectName: string | null;
  description: string | null;
  techStack: string | null;
  testCommand: string | null;
  areaSignals: AreaSignal[] | null;
  recommendations: Recommendation[] | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AreaSignal {
  area: string;
  files: number;
  testFileCount: number;
  testToCodeRatio: number;
  churnScore: number;
  note: string;
}

import { apiUrl } from './base'

export class ScanInProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanInProgressError";
  }
}

export async function triggerScan(modelId?: string | null): Promise<{ scanId: string }> {
  const res = await fetch(apiUrl("/api/scans/run"), {
    method: "POST",
    credentials: "include",
    headers: modelId ? { "content-type": "application/json" } : undefined,
    body: modelId ? JSON.stringify({ modelId }) : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    const message = body?.error ?? `HTTP ${res.status}`;
    if (res.status === 409) throw new ScanInProgressError(message);
    throw new Error(message);
  }
  return res.json() as Promise<{ scanId: string }>;
}

export async function abortScan(scanId: string): Promise<void> {
  const res = await fetch(apiUrl("/api/scans/abort"), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scanId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
}

export async function fetchLatestScan(): Promise<ScanResult | null> {
  const res = await fetch(apiUrl("/api/scans/latest"), { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ScanResult | null>;
}
