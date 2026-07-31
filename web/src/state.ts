import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { StateResponse } from "./types";

export function useAppState() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await api<StateResponse>("/api/state");
      setState(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reload();

    const source = new EventSource("/api/events");
    const refresh = () => void reload();
    source.addEventListener("job", refresh);
    source.addEventListener("run", refresh);
    // EventSource reconnects on its own; no error handling needed here.

    return () => source.close();
  }, [reload]);

  return { state, error, reload };
}
