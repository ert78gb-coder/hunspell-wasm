import path from 'node:path'

import { load } from '../../src/index.js'

const fixtures = path.join(import.meta.dirname, '..', 'fixtures')

/**
 * The Hungarian fixture dictionary, loaded for one test file.
 * @returns {Promise<import('../../types/index.d.ts').Hunspell>}
 */
export function loadHungarian() {
  return load({ aff: path.join(fixtures, 'hu_HU.aff'), dic: path.join(fixtures, 'hu_HU.dic') })
}
