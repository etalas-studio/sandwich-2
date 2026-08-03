import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchProjectSettings, saveProjectSettings } from '../types'
import type { ProjectSettings } from '../types'

export function useProjectSettings() {
  const queryClient = useQueryClient()

  const query = useQuery<ProjectSettings>({
    queryKey: ['project-settings'],
    queryFn: fetchProjectSettings,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: (repoPath: string) => saveProjectSettings(repoPath),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(['project-settings'], result.settings ?? null)
        toast.success('Project path saved')
      } else {
        toast.error(result.message)
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    },
  })

  return {
    repoPath: query.data?.repoPath ?? null,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    save: (path: string) => mutation.mutate(path),
    error: query.error instanceof Error ? query.error.message : null,
  }
}
