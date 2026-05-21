import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeGameExceptions } from './mergeGameExceptions.ts'

describe('mergeGameExceptions', () => {
    it('merges by id and tracks latestMs', () => {
        const { merged, latestMs } = mergeGameExceptions(
            [{ id: 'a', timestamp: '2020-01-01T00:00:00.000Z' }],
            [{ id: 'b', timestamp: '2021-06-01T12:00:00.000Z' }]
        )
        assert.equal(merged.length, 2)
        assert.equal(latestMs, new Date('2021-06-01T12:00:00.000Z').getTime())
    })

    it('overwrites existing id', () => {
        const { merged } = mergeGameExceptions([{ id: 'a', errorMessage: 'old' }], [{ id: 'a', errorMessage: 'new' }])
        assert.equal(merged.length, 1)
        assert.equal(merged[0].errorMessage, 'new')
    })
})
