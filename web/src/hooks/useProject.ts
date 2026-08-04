import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchCurrentProject,
  connectProject,
  clearProject as apiClearProject,
  syncProject as apiSyncProject,
} from '../api/projects'
import type { Project, ProjectProvider } from '../api/projects'

export function useProject() {
  const queryClient = useQueryClient()

  const { data: project, isLoading, error } = useQuery<Project | null>({
    queryKey: ['project-current'],
    queryFn: fetchCurrentProject,
    // Poll while cloning, same pattern as useScan's "poll while running".
    refetchInterval: (query) => {
      const data = query.state.data as Project | null | undefined
      return data?.cloneStatus === 'cloning' ? 2000 : false
    },
  })

  const connectMutation = useMutation({
    mutationFn: (args: { provider: ProjectProvider; owner: string; repoSlug: string; defaultBranch: string }) =>
      connectProject(args.provider, args.owner, args.repoSlug, args.defaultBranch),
    onSuccess: (result) => {
      if (result.ok && result.project) {
        queryClient.setQueryData(['project-current'], result.project)
      } else {
        toast.error(result.error ?? 'Failed to connect project')
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to connect project')
    },
  })

  const clearMutation = useMutation({
    mutationFn: apiClearProject,
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(['project-current'], null)
      } else {
        toast.error(result.error ?? 'Failed to clear project')
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to clear project')
    },
  })

  const syncMutation = useMutation({
    mutationFn: apiSyncProject,
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
    project: project ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    isConnecting: connectMutation.isPending,
    isClearing: clearMutation.isPending,
    isSyncing: syncMutation.isPending,
    connect: (provider: ProjectProvider, owner: string, repoSlug: string, defaultBranch: string) =>
      connectMutation.mutateAsync({ provider, owner, repoSlug, defaultBranch }),
    clear: () => clearMutation.mutateAsync(),
    sync: () => syncMutation.mutate(),
  }
}
