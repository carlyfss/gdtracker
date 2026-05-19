import { useCallback, useState } from 'react'
import { useGameId } from '../context/GameIdContext'
import { GameCategoriesSection } from './configuration/sections/GameCategoriesSection'
import { GameConfigFormSection } from './configuration/sections/GameConfigFormSection'
import { GameEventsSection } from './configuration/sections/GameEventsSection'
import { GameFeaturesSection } from './configuration/sections/GameFeaturesSection'
import { GameExceptionTaskTemplatesSection } from './configuration/sections/GameExceptionTaskTemplatesSection'
import { GameTagsSection } from './configuration/sections/GameTagsSection'

export function ConfigurationPage() {
    const gameId = useGameId()
    const [configRefresh, setConfigRefresh] = useState(0)
    const bumpConfigAndCategories = useCallback(() => setConfigRefresh((t) => t + 1), [])

    return (
        <div className="gamePageStack configurationPage">
            <GameConfigFormSection gameId={gameId} refreshToken={configRefresh} />
            <GameFeaturesSection gameId={gameId} />
            <GameEventsSection gameId={gameId} />
            <GameCategoriesSection gameId={gameId} onCategoriesChanged={bumpConfigAndCategories} />
            <GameTagsSection gameId={gameId} />
            <GameExceptionTaskTemplatesSection gameId={gameId} refreshToken={configRefresh} />
        </div>
    )
}
