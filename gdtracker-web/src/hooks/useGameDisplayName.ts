import { useEffect, useState } from 'react'
import { ensureGameNamesLoaded, getCachedGameName, setCachedGameName } from '../util/gameNameCache'

export function useGameDisplayName(gameId: string | undefined): string | undefined {
    const [cacheRevision, setCacheRevision] = useState(0)

    useEffect(() => {
        if (!gameId || getCachedGameName(gameId)) return
        let cancelled = false
        void ensureGameNamesLoaded().then(() => {
            if (!cancelled) setCacheRevision((n) => n + 1)
        })
        return () => {
            cancelled = true
        }
    }, [gameId])

    if (!gameId) return undefined
    void cacheRevision
    return getCachedGameName(gameId)
}

export { setCachedGameName }
