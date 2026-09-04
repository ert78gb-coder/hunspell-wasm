import { after, before, describe, it } from 'node:test'

import { loadHungarian } from './_helper/load-fixture.js'

describe('analyze', () => {
  /**
   * @type {import('../types/index.d.ts').Hunspell}
   */
  let hunspell
  before(async () => {
    hunspell = await loadHungarian()
  })
  after(() => hunspell.dispose())

  // [word, readings in the engine's order]. The order is part of the
  // contract: a consumer may take the first reading as primary.
  const cases = [
    ['verziójában', [
      { stem: 'verzió', pos: 'noun', tags: ['ts:NOM', 'is:POSS_SG_3', 'is:INE'] },
    ]],
    ['százalékkal', [
      { stem: 'százalék', pos: 'noun', tags: ['ts:NOM', 'is:INSTR'] },
    ]],
    ['rajthoz', [
      { stem: 'rajt', pos: 'noun', tags: ['ts:NOM', 'is:ALL'] },
    ]],
    ['szakadék', [
      { stem: 'szakadék', pos: 'noun', tags: ['ts:NOM'] },
    ]],
    ['érkezett', [
      { stem: 'érkezik', pos: 'vrb', tags: ['ts:PRES_INDIC_INDEF_SG_3', 'is:PAST_INDIC_INDEF_SG_3'] },
      { stem: 'érkezik', pos: 'vrb', tags: ['ts:PRES_INDIC_INDEF_SG_3', 'ds:tt_PASTPART_adj', 'ts:NOM'] },
    ]],
    ['értékelték', [
      { stem: 'értékelt', pos: 'adj', tags: ['ts:NOM', 'is:ék_FAMILIAR_noun', 'is:NOM'] },
      { stem: 'értékel', pos: 'vrb', tags: ['ts:PRES_INDIC_INDEF_SG_3', 'is:PAST_INDIC_DEF_PL_3'] },
      { stem: 'értékel', pos: 'vrb', tags: ['ts:PRES_INDIC_INDEF_SG_3', 'ds:tt_PASTPART_adj', 'ts:NOM', 'is:ék_FAMILIAR_noun', 'is:NOM'] },
    ]],
    ['kilohertzes', [
      { stem: 'kilohertz', pos: 'noun', tags: ['ts:NOM', 'hy:4', 'ds:s_ATTRIBUTE_adj', 'ts:NOM'] },
      { stem: 'kilohertz', pos: 'noun', tags: ['ts:NOM', 'hy:4', 'ds:s_OCCUPATION_noun', 'ts:NOM'] },
    ]],
    ['meccsen', [
      { stem: 'meccs', pos: 'noun', tags: ['ts:NOM', 'ph:match', 'is:SUE'] },
    ]],
  ]

  for (const [word, readings] of cases) {
    it(word, ({ assert }) => {
      const analyses = hunspell.analyze(word)
      assert.deepStrictEqual(
        analyses.map(({ stem, pos, tags }) => ({ stem, pos, tags })),
        readings)
      for (const analysis of analyses) {
        assert.ok(analysis.raw.startsWith('st:'), `raw line kept: ${analysis.raw}`)
      }
    })
  }

  it('a word with three parts of speech gives all three readings', ({ assert }) => {
    assert.deepStrictEqual(hunspell.analyze('volt').map(({ pos }) => pos), ['noun', 'vrb', 'adj'])
  })

  it('a derivation tag survives into tags', ({ assert }) => {
    const tags = hunspell.analyze('huszonegyedikén').flatMap(({ tags }) => tags)
    assert.ok(tags.includes('is:dikA_DATE_noun'))
  })

  it('an unknown word has no reading', ({ assert }) => {
    assert.deepStrictEqual(hunspell.analyze('tizedas'), [])
  })

  it('stem gives every stem, in order', ({ assert }) => {
    assert.deepStrictEqual(hunspell.stem('értékelték'), ['értékelt', 'értékel'])
  })

  it('generate inflects on the pattern of an example', ({ assert }) => {
    assert.ok(hunspell.generate('százalék', 'almával').includes('százalékkal'))
  })
})
