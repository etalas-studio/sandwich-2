import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

const STORAGE_KEY = 'runchise-selected-model'

function readStoredModel(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredModel(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage may be unavailable
  }
}

interface ModelContextValue {
  selectedModelId: string | null
  setSelectedModelId: (id: string | null) => void
}

const ModelContext = createContext<ModelContextValue | undefined>(undefined)

export function ModelProvider({ children }: { children: ReactNode }) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(readStoredModel)

  const setModel = useCallback((id: string | null) => {
    setSelectedModelId(id)
    writeStoredModel(id)
  }, [])

  // Sync from storage in case another tab changes it
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSelectedModelId(e.newValue)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <ModelContext.Provider value={{ selectedModelId, setSelectedModelId: setModel }}>
      {children}
    </ModelContext.Provider>
  )
}

export function useModelContext(): ModelContextValue {
  const ctx = useContext(ModelContext)
  if (!ctx) {
    throw new Error('useModelContext must be used within a ModelProvider')
  }
  return ctx
}
