import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../api/base";

interface SubscriptionStatus {
  planSlug: string | null;
  status?: string;
  startedAt?: string;
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
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: false,
  });
}
