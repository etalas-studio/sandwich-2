import { apiUrl } from "./base";
import type { CreateTicketData } from "../components/CreateTicketModal";

export interface Ticket {
  key: string;
  summary: string | null;
  description: string;
  url: string | null;
  status: string;
  stage: string | null;
  prDescription: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  priority: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createTicket(data: CreateTicketData): Promise<Ticket> {
  const res = await fetch(apiUrl("/api/tickets"), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: data.id,
      summary: data.summary,
      description: data.description,
      url: data.url || null,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<Ticket>;
}

export async function fetchTicket(key: string): Promise<Ticket> {
  const res = await fetch(apiUrl(`/api/tickets/${encodeURIComponent(key)}`), {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Ticket>;
}

export async function fetchTickets(): Promise<Ticket[]> {
  const res = await fetch(apiUrl("/api/tickets"), { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Ticket[]>;
}

export interface UpdateTicketData {
  summary?: string | null;
  description?: string;
  url?: string | null;
  status?: string;
}

export async function updateTicket(
  key: string,
  data: UpdateTicketData,
): Promise<Ticket> {
  const res = await fetch(apiUrl(`/api/tickets/${encodeURIComponent(key)}`), {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<Ticket>;
}

export async function deleteTicket(key: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/tickets/${encodeURIComponent(key)}`), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
}
