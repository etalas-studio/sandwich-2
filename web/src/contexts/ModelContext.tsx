import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ModelContextValue {
  selectedModelId: string | null
  setSelectedModelId: (id: string | null) => void
}

const ModelContext = createContext<ModelContextValue | undefined>(undefined)

export function ModelProvider({ children }: { children: ReactNode }) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)

  const setModel = useCallback((id: string | null) => {
    setSelectedModelId(id)
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
