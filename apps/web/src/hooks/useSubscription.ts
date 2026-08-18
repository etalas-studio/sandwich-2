import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "../api/base";
import { useAuth } from "./useAuth";

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
  const { state: authState } = useAuth();
  // Only query the user-scoped subscription once we know we're authenticated.
  // Otherwise a logged-out fetch would cache a `{ planSlug: null }` value that
  // survives the next login and bounces a paying user back to checkout.
  const enabled = authState.status === "authenticated";

  return useQuery({
    queryKey: ["subscription"],
    queryFn: fetchSubscription,
    enabled,
    // Expiry is time-sensitive — keep the cache short and refresh on focus.
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}
