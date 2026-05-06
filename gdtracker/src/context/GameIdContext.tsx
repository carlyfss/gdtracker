import { createContext, useContext, type ReactNode } from 'react'

const GameIdContext = createContext<string | null>(null)

export function GameIdProvider({ gameId, children }: { gameId: string; children: ReactNode }) {
    return <GameIdContext.Provider value={gameId}>{children}</GameIdContext.Provider>
}

export function useGameId(): string {
    const v = useContext(GameIdContext)
    if (!v) {
        throw new Error('useGameId must be used within a game dashboard route')
    }
    return v
}
