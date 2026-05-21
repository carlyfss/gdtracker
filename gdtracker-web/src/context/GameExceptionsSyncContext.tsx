import { createContext, useContext, type ReactNode } from 'react'
import { useGameExceptionsSync, type GameExceptionsSyncState } from '../hooks/useGameExceptionsSync'

const GameExceptionsSyncContext = createContext<GameExceptionsSyncState | null>(null)

type ProviderProps = {
    gameId: string
    pollEnabled: boolean
    children: ReactNode
}

export function GameExceptionsSyncProvider({ gameId, pollEnabled, children }: ProviderProps) {
    const value = useGameExceptionsSync(gameId, pollEnabled)
    return <GameExceptionsSyncContext.Provider value={value}>{children}</GameExceptionsSyncContext.Provider>
}

export function useGameExceptionsSyncContext(): GameExceptionsSyncState {
    const ctx = useContext(GameExceptionsSyncContext)
    if (!ctx) {
        throw new Error('useGameExceptionsSyncContext must be used within GameExceptionsSyncProvider')
    }
    return ctx
}
