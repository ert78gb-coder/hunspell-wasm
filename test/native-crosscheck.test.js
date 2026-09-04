import { execFileSync } from 'node:child_process'
import { after, before, describe, it } from 'node:test'

import { loadHungarian } from './_helper/load-fixture.js'

const hasNative = (() => {
  try {
    execFileSync('hunspell', ['-v'], { stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
})()

/**
 * `hunspell -m` prints "word  analysis" lines; an unknown word prints the
 * word alone. Run under a UTF-8 locale or accented output is cut short.
 * @param {string} word
 * @returns {string[]}
 */
function nativeAnalyses(word) {
  return execFileSync(
    'hunspell',
    [
      '-m',
      '-d',
      'hu_HU',
      '-i',
      // Hunspell's -i flag names the encoding `utf-8`.
      'utf-8', // eslint-disable-line unicorn/text-encoding-identifier-case -- Hunspell CLI encoding name
    ],
    { input: `${word}\n`, encoding: 'utf8', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } },
  ).split('\n').filter(line => line.includes('  ')).map(line => line.slice(line.indexOf('  ') + 2))
}

describe('against the native engine', { skip: hasNative ? false : 'hunspell binary not installed' }, () => {
  /**
   * @type {import('../types/index.d.ts').Hunspell}
   */
  let hunspell
  before(async () => {
    hunspell = await loadHungarian()
  })
  after(() => hunspell.dispose())

  const words = ['verziójában', 'értékelték', 'érkezett', 'kilohertzes', 'huszonegyedikén', 'volt', 'meccsen', 'százalékkal']
  for (const word of words) {
    it(word, ({ assert }) => {
      assert.deepStrictEqual(hunspell.analyze(word).map(({ raw }) => raw), nativeAnalyses(word))
    })
  }
})
