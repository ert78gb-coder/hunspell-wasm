import { after, before, describe, it } from 'node:test'

import { loadHungarian } from './_helper/load-fixture.js'

describe('spell', () => {
  /**
   * @type {import('../src/index.js').Hunspell}
   */
  let hunspell
  before(async () => {
    hunspell = await loadHungarian()
  })
  after(() => hunspell.dispose())

  // Compounds and suffixed forms the affix rules have to accept.
  const words = [
    'tizedes', 'milliomodos', 'kilohertzes', 'százalékkal', 'ezerkilencszázkilencvenes',
    'kétezer-huszonhat', 'huszonegyedikén', 'hármas', 'öten', 'húszan',
  ]
  for (const word of words) {
    it(`${word} is a word`, ({ assert }) => {
      assert.strictEqual(hunspell.spell(word), true)
    })
  }

  // Near-misses with a wrong linking vowel or a wrong stem: not words.
  const nonWords = ['tizedas', 'milliomodes', 'kilenchezes', 'huszonnégyheted', 'kettőös', 'huszan']
  for (const word of nonWords) {
    it(`${word} is not a word`, ({ assert }) => {
      assert.strictEqual(hunspell.spell(word), false)
    })
  }

  it('suggests the word behind a wrong suffix', ({ assert }) => {
    assert.ok(hunspell.suggest('tizedas').includes('tizedes'))
  })
})
