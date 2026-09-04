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
 * Emscripten runtime produced by `dist/hunspell.js`.
 * @typedef {object} HunspellModule
 * @property {(bytes: number) => number} _malloc Allocate `bytes` on the WASM heap; returns a pointer.
 * @property {(pointer: number) => void} _free Free a heap pointer from `_malloc`.
 * @property {(affPath: number, dicPath: number) => number} _hs_create Create an engine from MEMFS affix and dictionary paths; returns a handle.
 * @property {(handle: number) => void} _hs_destroy Destroy the engine at `handle`.
 * @property {(handle: number, word: number) => number} _hs_spell Spell-check a heap UTF-8 word; `1` if accepted.
 * @property {(handle: number, word: number) => number} _hs_analyze Analyse a heap UTF-8 word; returns a heap string pointer.
 * @property {(handle: number, word: number) => number} _hs_stem Stem a heap UTF-8 word; returns a heap string pointer.
 * @property {(handle: number, word: number) => number} _hs_suggest Suggest for a heap UTF-8 word; returns a heap string pointer.
 * @property {(handle: number, word: number, example: number) => number} _hs_generate Generate forms of `word` on the pattern of `example`; returns a heap string pointer.
 * @property {(pointer: number) => void} _hs_free Free a heap string returned by a `_hs_*` call.
 * @property {(text: string) => number} lengthBytesUTF8 Byte length of `text` encoded as UTF-8, excluding the NUL.
 * @property {(text: string, pointer: number, maxBytes: number) => number} stringToUTF8 Write `text` as UTF-8 at `pointer`.
 * @property {(pointer: number) => string} UTF8ToString Decode a NUL-terminated UTF-8 string from the heap.
 * @property {{ writeFile: (path: string, data: Uint8Array) => void }} FS MEMFS used to stage the affix and dictionary files.
 */

const wasmRuntime = {
  /**
   * @type {Promise<HunspellModule> | undefined}
   */
  modulePromise: undefined,
}

/**
 * @param {unknown} value Value that must be a string.
 * @param {string} name Argument name used in the TypeError.
 * @returns {asserts value is string} Completes when `value` is a string.
 */
function assertString(value, name) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string`)
  }
}

/**
 * Read a dictionary file, or throw with the path in the message.
 * @param {string} filePath Path to the `.aff` or `.dic` file.
 * @returns {Promise<Buffer>} File contents.
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
 * Instantiate the Emscripten module once and reuse it.
 * @returns {Promise<HunspellModule>} Compiled Hunspell runtime.
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
 * Encode `text` as a WASM heap UTF-8 buffer for the duration of `fn`.
 * @template T
 * @param {HunspellModule} module Emscripten runtime.
 * @param {string} text String to encode.
 * @param {(pointer: number) => T} fn Callback that receives the heap pointer.
 * @returns {T} Value returned by `fn`.
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
 * Read a heap UTF-8 string and free the C buffer.
 * @param {HunspellModule} module Emscripten runtime.
 * @param {number} pointer Heap pointer returned by a `_hs_*` call.
 * @returns {string} Decoded string.
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
 * Call a Hunspell list function and split the newline-joined result.
 * @param {HunspellModule} module Emscripten runtime.
 * @param {string} word Word passed to the engine.
 * @param {(wordPointer: number) => number} call Heap function that returns a string pointer.
 * @returns {string[]} Non-empty result lines.
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
 * @param {string} joined Newline-joined engine output.
 * @returns {string[]} Trimmed non-empty lines.
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
   * @param {HunspellModule} module Instantiated Emscripten runtime.
   * @param {number} handle Opaque Hunspell handle from `_hs_create`.
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
   * Whether `word` is accepted by the loaded dictionary.
   * @param {string} word Word to check.
   * @returns {boolean} `true` when the word is in the dictionary.
   */
  spell(word) {
    this.#ensureOpen()
    assertString(word, 'word')
    return withUtf8(this.#module, word, pointer => this.#module._hs_spell(this.#handle, pointer) === 1)
  }

  /**
   * Morphological readings of `word`, in the engine's order.
   * @param {string} word Word to analyse.
   * @returns {import('./morphology.js').Analysis[]} One entry per reading; `[]` for an unknown word.
   */
  analyze(word) {
    this.#ensureOpen()
    assertString(word, 'word')
    return listCall(this.#module, word, pointer =>
      this.#module._hs_analyze(this.#handle, pointer),
    ).map(line => parseAnalysis(line))
  }

  /**
   * Stems of `word`, in the engine's order.
   * @param {string} word Word to stem.
   * @returns {string[]} Distinct stems; `[]` for an unknown word.
   */
  stem(word) {
    this.#ensureOpen()
    assertString(word, 'word')
    return listCall(this.#module, word, pointer => this.#module._hs_stem(this.#handle, pointer))
  }

  /**
   * Spelling suggestions for `word`.
   * @param {string} word Word to suggest for.
   * @returns {string[]} Suggestions in the engine's order.
   */
  suggest(word) {
    this.#ensureOpen()
    assertString(word, 'word')
    return listCall(this.#module, word, pointer =>
      this.#module._hs_suggest(this.#handle, pointer),
    )
  }

  /**
   * Inflect `word` on the pattern of `example`.
   * @param {string} word Stem or dictionary form to inflect.
   * @param {string} example Inflected form whose affixes are copied.
   * @returns {string[]} Generated forms, or `[]` when none.
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
 * @property {string} aff Path to the `.aff` file.
 * @property {string} dic Path to the `.dic` file.
 */

/**
 * Engine returned by {@link load}.
 * @typedef {HunspellEngine} Hunspell
 */

/**
 * Load Hunspell with a consumer-supplied `.aff` / `.dic` pair.
 * @param {LoadOptions} options Paths to the affix and dictionary files.
 * @returns {Promise<Hunspell>} Open engine; call `dispose` when finished.
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
