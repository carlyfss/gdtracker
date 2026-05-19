import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    applyExceptionTaskDescriptionTemplate,
    applyExceptionTaskTitleTemplate,
    buildExceptionExamplePayloadForSave,
    extractExceptionPlaceholderTokens,
    previewExceptionTaskTemplates,
} from './exceptionTaskTemplate.ts'

describe('extractExceptionPlaceholderTokens', () => {
    it('returns ordered union of known tokens from both templates', () => {
        const tokens = extractExceptionPlaceholderTokens(
            'Fix #<EXCEPTION_INDEX> <EXCEPTION_ID>',
            '```\n<EXCEPTION_TRACE>\n``` <ERROR_MESSAGE>'
        )
        assert.deepEqual(tokens, ['EXCEPTION_INDEX', 'EXCEPTION_ID', 'EXCEPTION_TRACE', 'ERROR_MESSAGE'])
    })

    it('ignores unknown placeholders', () => {
        const tokens = extractExceptionPlaceholderTokens('<FOO>', '<EXCEPTION_ID>')
        assert.deepEqual(tokens, ['EXCEPTION_ID'])
    })
})

describe('previewExceptionTaskTemplates', () => {
    it('pads exception index in title', () => {
        const r = previewExceptionTaskTemplates('Fix #<EXCEPTION_INDEX>', '', { EXCEPTION_INDEX: '7' })
        assert.equal(r.ok, true)
        if (r.ok) assert.equal(r.title, 'Fix #07')
    })

    it('injects trace and strips index from description', () => {
        const r = previewExceptionTaskTemplates('', 'Index <EXCEPTION_INDEX>\n<EXCEPTION_TRACE>', {
            EXCEPTION_TRACE: 'line 1',
            EXCEPTION_INDEX: '2',
        })
        assert.equal(r.ok, true)
        if (r.ok) {
            assert.ok(r.description.includes('line 1'))
            assert.ok(!r.description.includes('<EXCEPTION_INDEX>'))
            assert.ok(!r.description.includes('Index 2'))
        }
    })

    it('strips ERROR_MESSAGE from title', () => {
        const r = previewExceptionTaskTemplates('<ERROR_MESSAGE> Title', '', {})
        assert.equal(r.ok, true)
        if (r.ok) assert.equal(r.title.trim(), 'Title')
    })
})

describe('buildExceptionExamplePayloadForSave', () => {
    it('keeps only non-empty values for tokens in templates', () => {
        const out = buildExceptionExamplePayloadForSave('<EXCEPTION_ID>', '<EXCEPTION_TRACE>', {
            EXCEPTION_ID: 'abc',
            EXCEPTION_TRACE: '',
            ERROR_MESSAGE: 'ignored',
        })
        assert.deepEqual(out, { EXCEPTION_ID: 'abc' })
    })
})

describe('applyExceptionTaskTitleTemplate', () => {
    it('matches preview padding', () => {
        const title = applyExceptionTaskTitleTemplate('Fix #<EXCEPTION_INDEX>', {
            exceptionIndex: 3,
            exceptionId: 'id',
            errorMessage: 'err',
            shortErrorMessage: 'short',
        })
        assert.equal(title, 'Fix #03')
    })
})

describe('applyExceptionTaskDescriptionTemplate', () => {
    it('appends trace when placeholder missing', () => {
        const desc = applyExceptionTaskDescriptionTemplate('Details', 'trace line', {
            exceptionId: 'id',
            errorMessage: 'err',
            shortErrorMessage: '',
        })
        assert.ok(desc.includes('Details'))
        assert.ok(desc.includes('trace line'))
    })
})
