import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchProjectSettings, saveProjectSettings, syncProject } from '../types'
import type { ProjectSettings } from '../types'

export function useProjectSettings() {
  const queryClient = useQueryClient()

  const query = useQuery<ProjectSettings>({
    queryKey: ['project-settings'],
    queryFn: fetchProjectSettings,
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
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

  const syncMutation = useMutation({
    mutationFn: () => syncProject(),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.output || 'Synced')
      } else {
        toast.error(result.error ?? 'Sync failed')
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    },
  })

  return {
    repoPath: query.data?.repoPath ?? null,
    isLoading: query.isLoading,
    isSaving: saveMutation.isPending,
    isSyncing: syncMutation.isPending,
    save: (path: string) => saveMutation.mutate(path),
    sync: () => syncMutation.mutate(),
    error: query.error instanceof Error ? query.error.message : null,
  }
}
