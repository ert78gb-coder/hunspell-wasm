/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import createModule from '../dist/hunspell.js'
import { parseAnalysis } from './morphology.js'

const AFF_PATH = '/hunspell.aff'
const DIC_PATH = '/hunspell.dic'

/**
 * @typedef {object} HunspellModule
 * @property {(bytes: number) => number} _malloc
 * @property {(pointer: number) => void} _free
 * @property {(affPath: number, dicPath: number) => number} _hs_create
 * @property {(handle: number) => void} _hs_destroy
 * @property {(handle: number, word: number) => number} _hs_spell
 * @property {(handle: number, word: number) => number} _hs_analyze
 * @property {(handle: number, word: number) => number} _hs_stem
 * @property {(handle: number, word: number) => number} _hs_suggest
 * @property {(handle: number, word: number, example: number) => number} _hs_generate
 * @property {(pointer: number) => void} _hs_free
 * @property {(text: string) => number} lengthBytesUTF8
 * @property {(text: string, pointer: number, maxBytes: number) => number} stringToUTF8
 * @property {(pointer: number) => string} UTF8ToString
 * @property {{ writeFile: (path: string, data: Uint8Array) => void }} FS
 */

const wasmRuntime = {
  /**
   * @type {Promise<HunspellModule> | undefined}
   */
  modulePromise: undefined,
}

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {asserts value is string}
 */
function assertString(value, name) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`)
  }
}

/**
 * @param {string} filePath
 * @returns {Promise<Buffer>}
 */
async function readRequired(filePath) {
  try {
    return await readFile(filePath)
  }
  catch (error_) {
    throw new Error(`Dictionary file not found: ${filePath}`, { cause: error_ })
  }
}

/**
 * @returns {Promise<HunspellModule>}
 */
function loadModule() {
  if (wasmRuntime.modulePromise === undefined) {
    const distribution = path.join(import.meta.dirname, '..', 'dist')
    wasmRuntime.modulePromise = createModule({
      locateFile(file) {
        return path.join(distribution, file)
      },
    })
  }
  return wasmRuntime.modulePromise
}

/**
 * @template T
 * @param {HunspellModule} module
 * @param {string} text
 * @param {(pointer: number) => T} fn
 * @returns {T}
 */
function withUtf8(module, text, fn) {
  const size = module.lengthBytesUTF8(text) + 1
  const pointer = module._malloc(size)
  if (pointer === 0) {
    throw new Error('failed to allocate UTF-8 buffer')
  }
  try {
    module.stringToUTF8(text, pointer, size)
    return fn(pointer)
  }
  finally {
    module._free(pointer)
  }
}

/**
 * @param {HunspellModule} module
 * @param {number} pointer
 * @returns {string}
 */
function takeUtf8(module, pointer) {
  try {
    return module.UTF8ToString(pointer)
  }
  finally {
    module._hs_free(pointer)
  }
}

/**
 * @param {HunspellModule} module
 * @param {string} word
 * @param {(wordPointer: number) => number} call
 * @returns {string[]}
 */
function listCall(module, word, call) {
  const joined = withUtf8(module, word, (wordPointer) => {
    const result = call(wordPointer)
    return takeUtf8(module, result)
  })
  return splitLines(joined)
}

/**
 * Hunspell list items often carry a leading space from the morph formatter.
 * The public API and the native `-m` output expose the line without it.
 * @param {string} joined
 * @returns {string[]}
 */
function splitLines(joined) {
  if (joined.length === 0) {
    return []
  }
  return joined.split('\n').map(line => line.trim()).filter(line => line.length > 0)
}

class HunspellEngine {
  /**
   * @type {HunspellModule}
   */
  #module
  /**
   * @type {number}
   */
  #handle
  /**
   * @type {boolean}
   */
  #disposed = false

  /**
   * @param {HunspellModule} module
   * @param {number} handle
   */
  constructor(module, handle) {
    this.#module = module
    this.#handle = handle
  }

  #ensureOpen() {
    if (this.#disposed) {
      throw new Error('Hunspell instance has been disposed')
    }
  }

  /**
   * @param {string} word
   * @returns {boolean}
   */
  spell(word) {
    this.#ensureOpen()
    assertString(word, 'word')
    return withUtf8(this.#module, word, pointer => this.#module._hs_spell(this.#handle, pointer) === 1)
  }

  /**
   * @param {string} word
   * @returns {import('./morphology.js').Analysis[]}
   */
  analyze(word) {
    this.#ensureOpen()
    assertString(word, 'word')
    return listCall(this.#module, word, pointer =>
      this.#module._hs_analyze(this.#handle, pointer),
    ).map(line => parseAnalysis(line))
  }

  /**
   * @param {string} word
   * @returns {string[]}
   */
  stem(word) {
    this.#ensureOpen()
    assertString(word, 'word')
    return listCall(this.#module, word, pointer => this.#module._hs_stem(this.#handle, pointer))
  }

  /**
   * @param {string} word
   * @returns {string[]}
   */
  suggest(word) {
    this.#ensureOpen()
    assertString(word, 'word')
    return listCall(this.#module, word, pointer =>
      this.#module._hs_suggest(this.#handle, pointer),
    )
  }

  /**
   * @param {string} word
   * @param {string} example
   * @returns {string[]}
   */
  generate(word, example) {
    this.#ensureOpen()
    assertString(word, 'word')
    assertString(example, 'example')
    const joined = withUtf8(this.#module, word, wordPointer =>
      withUtf8(this.#module, example, (examplePointer) => {
        const result = this.#module._hs_generate(this.#handle, wordPointer, examplePointer)
        return takeUtf8(this.#module, result)
      }),
    )
    return splitLines(joined)
  }

  dispose() {
    this.#ensureOpen()
    const handle = this.#handle
    this.#handle = 0
    this.#disposed = true
    this.#module._hs_destroy(handle)
  }
}

/**
 * Options for {@link load}.
 * @typedef {object} LoadOptions
 * @property {string} aff
 * @property {string} dic
 */

/**
 * Engine returned by {@link load}.
 * @typedef {HunspellEngine} Hunspell
 */

/**
 * Load Hunspell with a consumer-supplied `.aff` / `.dic` pair.
 * @param {LoadOptions} options
 * @returns {Promise<Hunspell>}
 */
export async function load(options) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('options must be an object')
  }
  assertString(options.aff, 'aff')
  assertString(options.dic, 'dic')

  const affBytes = await readRequired(options.aff)
  const dicBytes = await readRequired(options.dic)
  const module = await loadModule()

  module.FS.writeFile(AFF_PATH, new Uint8Array(affBytes))
  module.FS.writeFile(DIC_PATH, new Uint8Array(dicBytes))

  const handle = withUtf8(module, AFF_PATH, affPointer =>
    withUtf8(module, DIC_PATH, dicPointer => module._hs_create(affPointer, dicPointer)),
  )
  if (handle === 0) {
    throw new Error(`failed to create Hunspell engine from ${options.aff} and ${options.dic}`)
  }

  return new HunspellEngine(module, handle)
}
