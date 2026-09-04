/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Parse one Hunspell analysis line into stem, pos, tags, and raw.
 *
 * Fields are space-separated `key:value` tokens. `st:` becomes `stem`,
 * `po:` becomes `pos`, and every other field is kept verbatim in `tags`.
 *
 * @param {string} raw
 * @returns {import('../types/index.d.ts').Analysis}
 */
export function parseAnalysis(raw) {
  /** @type {string | null} */
  let stem = null
  /** @type {string | null} */
  let pos = null
  /** @type {string[]} */
  const tags = []

  for (const field of raw.split(' ')) {
    if (field.length === 0) {
      continue
    }
    if (field.startsWith('st:')) {
      const value = field.slice(3)
      stem = value.length > 0 ? value : null
    } else if (field.startsWith('po:')) {
      const value = field.slice(3)
      pos = value.length > 0 ? value : null
    } else {
      tags.push(field)
    }
  }

  return { stem, pos, tags, raw }
}
