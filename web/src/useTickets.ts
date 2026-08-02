import { useEffect, useState } from "react";
import type { Ticket } from "./apiTypes";

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tickets")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
        return res.json() as Promise<Ticket[]>;
      })
      .then((data) => {
        if (!cancelled) setTickets(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { tickets, error };
}
