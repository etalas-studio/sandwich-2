import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

const STORAGE_PREFIX = 'runchise-selected-model'

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}-${scope}`
}

function readAllStored(): Record<string, string | null> {
  try {
    const result: Record<string, string | null> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(STORAGE_PREFIX + '-')) {
        const scope = key.slice(STORAGE_PREFIX.length + 1)
        result[scope] = localStorage.getItem(key)
      }
    }
    return result
  } catch {
    return {}
  }
}

function writeStoredModel(scope: string, id: string | null): void {
  try {
    const key = storageKey(scope)
    if (id) {
      localStorage.setItem(key, id)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // localStorage may be unavailable
  }
}

interface ModelContextValue {
  getModelId: (scope: string) => string | null
  setModelId: (scope: string, id: string | null) => void
}

const ModelContext = createContext<ModelContextValue | undefined>(undefined)

export function ModelProvider({ children }: { children: ReactNode }) {
  const [modelIds, setModelIds] = useState<Record<string, string | null>>(readAllStored)

  const getModelId = useCallback((scope: string) => {
    return modelIds[scope] ?? null
  }, [modelIds])

  const setModelId = useCallback((scope: string, id: string | null) => {
    setModelIds(prev => ({ ...prev, [scope]: id }))
    writeStoredModel(scope, id)
  }, [])

  // Sync from storage in case another tab changes it
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith(STORAGE_PREFIX + '-')) {
        const scope = e.key.slice(STORAGE_PREFIX.length + 1)
        setModelIds(prev => ({ ...prev, [scope]: e.newValue }))
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <ModelContext.Provider value={{ getModelId, setModelId }}>
      {children}
    </ModelContext.Provider>
  )
}

export function useModelContext(scope: string): { selectedModelId: string | null; setSelectedModelId: (id: string | null) => void } {
  const ctx = useContext(ModelContext)
  if (!ctx) {
    throw new Error('useModelContext must be used within a ModelProvider')
  }
  return {
    selectedModelId: ctx.getModelId(scope),
    setSelectedModelId: (id: string | null) => ctx.setModelId(scope, id),
  }
}
