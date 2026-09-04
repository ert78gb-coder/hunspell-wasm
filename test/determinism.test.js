import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = path.join(import.meta.dirname, '..')

describe('the built artefact', () => {
  it('matches build/checksums.txt', async ({ assert }) => {
    const wasm = await readFile(path.join(root, 'dist', 'hunspell.wasm'))
    const recorded = await readFile(path.join(root, 'build', 'checksums.txt'), 'utf8')
    const expected = recorded.split('\n').find(line => line.endsWith('dist/hunspell.wasm'))?.split(/\s+/u, 1)[0]
    assert.strictEqual(createHash('sha256').update(wasm).digest('hex'), expected)
  })
})
