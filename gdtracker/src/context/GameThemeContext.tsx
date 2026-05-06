import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { getConfiguration } from '../api/configuration'
import { parseThemeColorHex } from '../theme/defaults'

const INLINE_THEME_KEYS = ['--accent'] as const

type GameThemeContextValue = {
    refreshTheme: () => void
}

const GameThemeContext = createContext<GameThemeContextValue | null>(null)

function clearInlineTheme() {
    const root = document.documentElement
    for (const k of INLINE_THEME_KEYS) {
        root.style.removeProperty(k)
    }
}

export function GameThemeProvider({ children }: { children: ReactNode }) {
    const { gameId } = useParams<{ gameId: string }>()

    const applyTheme = useCallback(async () => {
        if (!gameId) {
            clearInlineTheme()
            return
        }
        try {
            const cfg = await getConfiguration(gameId)
            const hex = parseThemeColorHex(cfg.settings?.THEME_COLOR)
            const root = document.documentElement
            if (hex) {
                root.style.setProperty('--accent', hex)
            } else {
                clearInlineTheme()
            }
        } catch {
            clearInlineTheme()
        }
    }, [gameId])

    useEffect(() => {
        void applyTheme()
        return () => {
            clearInlineTheme()
        }
    }, [applyTheme])

    const refreshTheme = useCallback(() => {
        void applyTheme()
    }, [applyTheme])

    const value = useMemo(() => ({ refreshTheme }), [refreshTheme])

    return <GameThemeContext.Provider value={value}>{children}</GameThemeContext.Provider>
}

export function useGameTheme(): GameThemeContextValue {
    const ctx = useContext(GameThemeContext)
    if (!ctx) {
        return { refreshTheme: () => {} }
    }
    return ctx
}
