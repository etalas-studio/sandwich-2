import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchMe, postLogin, postRegister, postLogout } from '../api/auth'
import type { AuthState } from '../api/auth'
import { clearConversationsCache } from '../lib/conversations'

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: state, isLoading } = useQuery<AuthState>({
    queryKey: ['auth'],
    queryFn: fetchMe,
    staleTime: Infinity,
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      postLogin(username, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      // Drop any user-scoped subscription cache so the gate waits for a
      // fresh fetch for the newly-authenticated user (never a stale null).
      queryClient.removeQueries({ queryKey: ['subscription'] })
    },
  })

  const registerMutation = useMutation({
    mutationFn: ({
      username,
      email,
      password,
    }: { username: string; email: string; password: string }) =>
      postRegister(username, email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      queryClient.removeQueries({ queryKey: ['subscription'] })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: postLogout,
    onSuccess: () => {
      clearConversationsCache()
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  return {
    state: state ?? { status: 'unauthenticated' as const },
    isLoading,
    login: (username: string, password: string) =>
      loginMutation.mutateAsync({ username, password }),
    loginError:
      loginMutation.error instanceof Error ? loginMutation.error.message : null,
    loginPending: loginMutation.isPending,
    register: (username: string, email: string, password: string) =>
      registerMutation.mutateAsync({ username, email, password }),
    registerError:
      registerMutation.error instanceof Error ? registerMutation.error.message : null,
    registerPending: registerMutation.isPending,
    logout: () => logoutMutation.mutateAsync(),
  }
}
