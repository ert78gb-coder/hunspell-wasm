/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * One morphological reading from Hunspell.
 * @typedef {object} Analysis
 * @property {string | null} stem The `st:` field, or `null` when the reading carries none.
 * @property {string | null} pos The `po:` field (`noun`, `vrb`, `adj`, `adj_num`, …), or `null`.
 * @property {string[]} tags Every other field as written, e.g. `is:ACC`, `ds:s_ATTRIBUTE_adj`, `ts:NOM`.
 * @property {string} raw The whole line as the engine returned it.
 */

/**
 * Hunspell sometimes prefixes a compound-part field before `st:`
 * (`po:adj_num  st:egy …`). The public line starts at `st:`, matching
 * `hunspell -m` after its word column and the tests' `raw.startsWith('st:')`.
 * @param {string} raw Engine analysis line, possibly with a compound prefix.
 * @returns {string} The same line starting at `st:`, or the trimmed original when there is no stem field.
 */
function morphLine(raw) {
  const trimmed = raw.trim()
  const stemAt = trimmed.search(/(?:^|\s)st:/u)
  if (stemAt === -1) {
    return trimmed
  }
  return trimmed.slice(trimmed.indexOf('st:', stemAt))
}

/**
 * Parse one Hunspell analysis line into stem, pos, tags, and raw.
 *
 * Fields are space-separated `key:value` tokens. `st:` becomes `stem`,
 * `po:` becomes `pos`, and every other field is kept verbatim in `tags`.
 * @param {string} raw Engine analysis line.
 * @returns {Analysis} One reading with `stem`, `pos`, `tags`, and `raw`.
 */
export function parseAnalysis(raw) {
  raw = morphLine(raw)
  /**
   * @type {string | null}
   */
  let stem = null
  /**
   * @type {string | null}
   */
  let pos = null
  /**
   * @type {string[]}
   */
  const tags = []

  for (const field of raw.split(' ')) {
    if (field.length === 0) {
      continue
    }
    if (field.startsWith('st:')) {
      const value = field.slice(3)
      stem = value.length > 0 ? value : null
    }
    else if (field.startsWith('po:')) {
      const value = field.slice(3)
      pos = value.length > 0 ? value : null
    }
    else {
      tags.push(field)
    }
  }

  return { stem, pos, tags, raw }
}
