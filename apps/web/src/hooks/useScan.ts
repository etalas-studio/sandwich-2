import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchLatestScan, triggerScan, abortScan, ScanInProgressError } from "../api/scans";
import type { ScanResult } from "../api/scans";
import { useModelContext } from "../contexts/ModelContext";

export function useScan() {
  const queryClient = useQueryClient();
  const [inFlightId, setInFlightId] = useState<string | null>(null);
  const prevStatusRef = useRef<string | undefined>(undefined);
  const { selectedModelId } = useModelContext('scan');

  const {
    data: latestScan,
    isLoading,
    error,
  } = useQuery<ScanResult | null>({
    queryKey: ["scan-latest"],
    queryFn: fetchLatestScan,
    // Poll every 4s while a scan is running
    refetchInterval: (query) => {
      const data = query.state.data as ScanResult | null | undefined;
      return data?.status === "running" ? 4000 : false;
    },
  });

  const triggerMutation = useMutation({
    mutationFn: () => triggerScan(selectedModelId),
    onSuccess: (result) => {
      setInFlightId(result.scanId);
      // Optimistically set a running scan in cache so polling starts
      queryClient.setQueryData(["scan-latest"], {
        id: result.scanId,
        status: "running" as const,
        projectName: null,
        description: null,
        techStack: null,
        testCommand: null,
        areaSignals: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      });
    },
    onError: (err) => {
      if (err instanceof ScanInProgressError) {
        toast.warning(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to start scan");
      }
    },
  });

  const abortMutation = useMutation({
    mutationFn: abortScan,
    onSuccess: () => {
      setInFlightId(null);
      toast.info("Scan aborted");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to abort scan");
    },
  });

  // Detect scan completion or failure from polled data
  const isRunning = latestScan?.status === "running";

  // Show toast when scan finishes with non-completed status
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = latestScan?.status;
    if (prev === "running" && latestScan && latestScan.status !== "running") {
      if (latestScan.status === "failed") {
        toast.error("Project scan failed. Check server logs for details.");
      } else if (latestScan.status === "aborted") {
        toast.info("Project scan was aborted.");
      }
    }
  }, [latestScan?.status]);

  const trigger = useCallback(() => {
    triggerMutation.mutate();
  }, [triggerMutation]);

  const abort = useCallback(() => {
    const id = inFlightId ?? latestScan?.id;
    if (id) {
      abortMutation.mutate(id);
    }
  }, [abortMutation, inFlightId, latestScan?.id]);

  // Clear in-flight when scan finishes
  if (inFlightId && latestScan && latestScan.status !== "running" && latestScan.id === inFlightId) {
    setInFlightId(null);
  }

  return {
    latestScan: latestScan ?? null,
    isLoading,
    isRunning,
    isTriggering: triggerMutation.isPending,
    isAborting: abortMutation.isPending,
    error: error instanceof Error ? error.message : null,
    trigger,
    abort,
  };
}
