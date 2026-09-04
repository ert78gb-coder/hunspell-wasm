import { describe, it } from 'node:test'

import { load } from '../src/index.js'
import { loadHungarian } from './_helper/load-fixture.js'

describe('lifecycle', () => {
  it('two loads answer the same', async ({ assert }) => {
    const first = await loadHungarian()
    const second = await loadHungarian()
    assert.deepStrictEqual(first.analyze('verziójában'), second.analyze('verziójában'))
    first.dispose()
    second.dispose()
  })

  it('a missing dictionary rejects with the file name, no fallback', async ({ assert }) => {
    await assert.rejects(load({ aff: '/nowhere/xx.aff', dic: '/nowhere/xx.dic' }), /xx\.aff/u)
  })

  it('every call throws after dispose', async ({ assert }) => {
    const hunspell = await loadHungarian()
    hunspell.dispose()
    assert.throws(() => hunspell.spell('alma'), /disposed/u)
    assert.throws(() => hunspell.analyze('alma'), /disposed/u)
  })

  it('a non-string word is rejected before it reaches the engine', async ({ assert }) => {
    const hunspell = await loadHungarian()
    assert.throws(() => hunspell.spell(/** @type {any} */ (5)), TypeError)
    hunspell.dispose()
  })
})
