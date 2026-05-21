import type { GameException } from '../api/gameExceptions'

export type GameExceptionsCacheEntry = {
    exceptions: GameException[]
    latestMs: number
}

const cache = new Map<string, GameExceptionsCacheEntry>()

export function getGameExceptionsCache(gameId: string): GameExceptionsCacheEntry | undefined {
    return cache.get(gameId)
}

export function setGameExceptionsCache(gameId: string, entry: GameExceptionsCacheEntry): void {
    cache.set(gameId, entry)
}

export function clearGameExceptionsCache(gameId?: string): void {
    if (gameId) {
        cache.delete(gameId)
        return
    }
    cache.clear()
}
