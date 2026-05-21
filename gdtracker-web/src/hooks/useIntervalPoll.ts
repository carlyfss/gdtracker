import { useEffect } from 'react'
import { nextBackoffMs, parseRetryAfterSeconds } from '../util/apiRateLimit'

const MAX_BACKOFF_MS = 120_000

type Options = {
    enabled: boolean
    intervalMs: number
    poll: () => Promise<void>
    onRateLimited?: (retryAfterSec: number | null) => void
    onError?: () => void
}

export function useIntervalPoll({ enabled, intervalMs, poll, onRateLimited, onError }: Options): void {
    useEffect(() => {
        if (!enabled) return

        let cancelled = false
        let timer = 0
        let backoffMs = 0

        const schedule = (delayMs: number) => {
            window.clearTimeout(timer)
            timer = window.setTimeout(() => void tick(), delayMs)
        }

        const tick = async () => {
            if (cancelled) return
            try {
                await poll()
                backoffMs = 0
            } catch (err) {
                if (cancelled) return
                const retrySec = parseRetryAfterSeconds(err)
                backoffMs = nextBackoffMs(backoffMs, retrySec, MAX_BACKOFF_MS)
                if (retrySec != null || (err as { response?: { status?: number } })?.response?.status === 429) {
                    onRateLimited?.(retrySec)
                } else {
                    onError?.()
                }
            }
            if (cancelled) return
            schedule(Math.max(intervalMs, backoffMs))
        }

        void tick()

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [enabled, intervalMs, poll, onRateLimited, onError])
}
