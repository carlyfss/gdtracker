import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
    readArchiveFilters,
    readDashboardFilters,
    readHeatmapFilters,
    readTasksFilters,
    writeArchiveFilters,
    writeDashboardFilters,
    writeHeatmapFilters,
    writeTasksFilters,
} from './screenFilterPreferences.ts'

const store = new Map<string, string>()

const localStorageMock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
        store.set(k, v)
    },
    removeItem: (k: string) => {
        store.delete(k)
    },
}

beforeEach(() => {
    store.clear()
    Object.defineProperty(globalThis, 'localStorage', {
        value: localStorageMock,
        configurable: true,
        writable: true,
    })
})

describe('readTasksFilters', () => {
    it('returns null when nothing stored', () => {
        assert.equal(readTasksFilters('g1', { featureIds: ['f1'], categoryIds: ['c1'], tagIds: ['t1'] }), null)
    })

    it('strips invalid ids', () => {
        writeTasksFilters('g1', {
            featureId: 'f1',
            categoryId: 'c1',
            status: 'TODO',
            tagIds: ['t1', 'bad'],
            tagMode: 'ANY',
        })
        const got = readTasksFilters('g1', {
            featureIds: ['f1'],
            categoryIds: ['c1'],
            tagIds: ['t1'],
        })
        assert.deepEqual(got, {
            featureId: 'f1',
            categoryId: 'c1',
            status: 'TODO',
            tagIds: ['t1'],
            tagMode: 'ANY',
        })
    })

    it('removes storage when all defaults', () => {
        writeTasksFilters('g1', {
            featureId: 'f1',
            categoryId: '__all__',
            status: '__all__',
            tagIds: [],
            tagMode: 'ANY',
        })
        writeTasksFilters('g1', {
            featureId: '__all__',
            categoryId: '__all__',
            status: '__all__',
            tagIds: [],
            tagMode: 'ANY',
        })
        assert.equal(store.has('gdtracker.filters.tasks:g1'), false)
    })
})

describe('readHeatmapFilters', () => {
    it('round-trips non-default ranges', () => {
        writeHeatmapFilters('g1', {
            selectedMap: 'map_a',
            heatmapEventCodeFilter: 'EVT',
            rangeXMin: -50,
            rangeXMax: 50,
            rangeYMin: 0,
            rangeYMax: 200,
            playerIdInput: 'player-1',
            eventCodeFilter: 'EVT2',
            eventsSize: 25,
        })
        const got = readHeatmapFilters('g1')
        assert.equal(got?.selectedMap, 'map_a')
        assert.equal(got?.eventsSize, 25)
        assert.equal(got?.playerIdInput, 'player-1')
    })
})

describe('readArchiveFilters', () => {
    it('validates feature id', () => {
        writeArchiveFilters('g1', {
            selectedFeatureId: 'f1',
            listShowSubfeatures: false,
            collapsedFeatureIds: ['f2'],
        })
        const got = readArchiveFilters('g1', ['f1'])
        assert.equal(got?.selectedFeatureId, 'f1')
        assert.equal(got?.listShowSubfeatures, false)
        assert.deepEqual(got?.collapsedFeatureIds, [])
    })
})

describe('readDashboardFilters', () => {
    it('reads exception bucket', () => {
        writeDashboardFilters('g1', {
            exceptionBucket: 'hour',
            listShowSubfeatures: true,
            collapsedFeatureIds: [],
        })
        const got = readDashboardFilters('g1', [])
        assert.equal(got?.exceptionBucket, 'hour')
    })
})
