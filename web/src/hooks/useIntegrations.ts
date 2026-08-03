import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import {
  fetchIntegrations,
  connectIntegration,
  disconnectIntegration,
} from '../api/integrations'
import type { IntegrationItem } from '../api/integrations'

export function useIntegrations() {
  const queryClient = useQueryClient()
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    data: integrations = [],
    isLoading,
    error: queryError,
  } = useQuery<IntegrationItem[]>({
    queryKey: ['integrations'],
    queryFn: fetchIntegrations,
  })

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ['integrations'] })
  }, [queryClient])

  const connect = useCallback(
    async (providerId: string, apiKey: string): Promise<void> => {
      setConnectingId(providerId)
      setError(null)
      const result = await connectIntegration(providerId, apiKey)
      if (!result.ok) {
        setConnectingId(null)
        setError(result.message)
        return
      }
      await refresh()
      setConnectingId(null)
    },
    [refresh],
  )

  const disconnect = useCallback(
    async (providerId: string): Promise<void> => {
      setConnectingId(providerId)
      setError(null)
      const result = await disconnectIntegration(providerId)
      if (!result.ok) {
        setConnectingId(null)
        setError(result.message)
        return
      }
      await refresh()
      setConnectingId(null)
    },
    [refresh],
  )

  return {
    integrations,
    isLoading,
    error: error ?? (queryError instanceof Error ? queryError.message : null),
    connect,
    disconnect,
    connectingId,
  }
}
