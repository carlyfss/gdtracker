import { isAxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { listGameExceptions, listGameExceptionsSince, type GameException } from '../api/gameExceptions'
import { nextBackoffMs, parseRetryAfterSeconds } from '../util/apiRateLimit'
import { mergeGameExceptions } from '../util/mergeGameExceptions'

const VISIBLE_POLL_MS = 15_000
const HIDDEN_POLL_MS = 60_000
const MAX_BACKOFF_MS = 120_000

export type GameExceptionsSyncState = {
    exceptions: GameException[]
    loading: boolean
    syncMessage: string | null
    /** Increments when new rows arrive (for search panel refresh). */
    syncGeneration: number
}

export function useGameExceptionsSync(gameId: string): GameExceptionsSyncState {
    const [exceptions, setExceptions] = useState<GameException[]>([])
    const [loading, setLoading] = useState(true)
    const [syncMessage, setSyncMessage] = useState<string | null>(null)
    const [syncGeneration, setSyncGeneration] = useState(0)
    const latestMsRef = useRef(0)
    const backoffMsRef = useRef(0)

    useEffect(() => {
        let cancelled = false
        latestMsRef.current = 0
        backoffMsRef.current = 0
        const resetTimer = window.setTimeout(() => {
            if (!cancelled) {
                setLoading(true)
                setSyncMessage(null)
            }
        }, 0)

        void listGameExceptions(gameId)
            .then((data) => {
                if (cancelled) return
                const { merged, latestMs } = mergeGameExceptions([], data)
                latestMsRef.current = latestMs
                setExceptions(merged)
            })
            .catch(() => {
                if (!cancelled) setExceptions([])
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
            window.clearTimeout(resetTimer)
        }
    }, [gameId])

    const pollOnce = useCallback(async () => {
        const since = latestMsRef.current
        const page = await listGameExceptionsSince(gameId, since)
        if (page.items.length > 0) {
            setExceptions((prev) => {
                const { merged, latestMs } = mergeGameExceptions(prev, page.items)
                latestMsRef.current = Math.max(latestMs, page.latestMs)
                return merged
            })
            setSyncGeneration((g) => g + 1)
        } else {
            latestMsRef.current = Math.max(latestMsRef.current, page.latestMs)
        }
        backoffMsRef.current = 0
        setSyncMessage(null)
    }, [gameId])

    useEffect(() => {
        let cancelled = false
        let timer = 0

        const baseInterval = () => (document.hidden ? HIDDEN_POLL_MS : VISIBLE_POLL_MS)

        const schedule = (delayMs: number) => {
            window.clearTimeout(timer)
            timer = window.setTimeout(() => void tick(), delayMs)
        }

        const tick = async () => {
            if (cancelled) return
            try {
                await pollOnce()
            } catch (err) {
                if (cancelled) return
                const retrySec = parseRetryAfterSeconds(err)
                backoffMsRef.current = nextBackoffMs(backoffMsRef.current, retrySec, MAX_BACKOFF_MS)
                if (isAxiosError(err) && err.response?.status === 429) {
                    const sec = retrySec ?? Math.ceil(backoffMsRef.current / 1000)
                    setSyncMessage(`Updates paused — retrying in ${sec}s`)
                }
            }
            if (cancelled) return
            const wait = Math.max(baseInterval(), backoffMsRef.current)
            schedule(wait)
        }

        schedule(baseInterval())

        const onVisibility = () => {
            if (!cancelled) schedule(0)
        }
        document.addEventListener('visibilitychange', onVisibility)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [gameId, pollOnce])

    return { exceptions, loading, syncMessage, syncGeneration }
}
