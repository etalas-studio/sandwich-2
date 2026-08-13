import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUsage } from '../api/conversations'

export function useUsage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['usage'],
    queryFn: getUsage,
    staleTime: 0,
    retry: false,
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['usage'] }),
  }
}
