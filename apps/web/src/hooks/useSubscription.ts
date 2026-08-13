import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../api/base";

export interface SubscriptionStatus {
  planSlug: string | null;
  status?: string;
  startedAt?: string;
  expiresAt?: string | null;
  expired?: boolean;
}

async function fetchSubscription(): Promise<SubscriptionStatus> {
  const res = await fetch(apiUrl("/api/subscriptions/active"), {
    credentials: "include",
  });
  if (!res.ok) return { planSlug: null };
  return res.json() as Promise<SubscriptionStatus>;
}

export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: fetchSubscription,
    // Expiry is time-sensitive — keep the cache short and refresh on focus.
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}
