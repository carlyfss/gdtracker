import { useCallback, useMemo } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { sanitizePlanningExcalidrawAppState } from '../../util/planningExcalidrawScene'

type Props = {
    docKey: string
    scene: Record<string, unknown> | null
    onSceneChange: (scene: Record<string, unknown>) => void
}

/** Embedded editor; remount when `docKey` changes (different document). */
export function PlanningExcalidrawPanel({ docKey, scene, onSceneChange }: Props) {
    const initialData = useMemo(() => {
        const els = scene && Array.isArray(scene.elements) ? scene.elements : []
        const rawApp =
            scene && typeof scene.appState === 'object' && scene.appState != null ? (scene.appState as object) : {}
        const app = sanitizePlanningExcalidrawAppState(rawApp)
        const files = scene && scene.files && typeof scene.files === 'object' ? scene.files : null
        return {
            elements: els as never[],
            appState: app as never,
            files: files as never,
        }
    }, [scene])

    const handleChange = useCallback(
        (elements: readonly unknown[], appState: object, files: unknown) => {
            onSceneChange({
                elements: elements as object[],
                appState: sanitizePlanningExcalidrawAppState(appState),
                files: files == null ? null : files,
            })
        },
        [onSceneChange]
    )

    return (
        <div className="planningExcalidrawHost" key={docKey}>
            <Excalidraw initialData={initialData} onChange={handleChange} />
        </div>
    )
}
