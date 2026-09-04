# @ert78gb/hunspell-wasm

Hunspell as a WebAssembly module with a JavaScript API for Node. The engine is
the real Hunspell compiled from a pinned commit, not a reimplementation. The
dictionary is not part of the package: the consumer supplies any Hunspell `.aff`
and `.dic` pair at load time.

Spell checking, morphological analysis, stemming, suggestions and word
generation run in-process. `load` is async; every call after that is
synchronous. One artefact runs on every platform Node runs on. There is no
native toolchain on the host, no compilation at install, and no install
scripts.

The public API is the raw ES modules in `src/`. There is no application
bundler. `dist/hunspell.js` is Emscripten's wasm loader (instantiate, MEMFS,
UTF-8 helpers), not a bundle of this package; it is produced by `npm run build`
together with `dist/hunspell.wasm` and shipped on npm so install does not
compile.

## Use

Node 26 or later.

```js
import { load } from '@ert78gb/hunspell-wasm'

const hunspell = await load({ aff: '/path/to/xx_XX.aff', dic: '/path/to/xx_XX.dic' })

hunspell.spell('word')               // boolean
hunspell.analyze('word')             // [{ stem, pos, tags, raw }, …]
hunspell.stem('word')                // string[]
hunspell.suggest('wrod')             // string[]
hunspell.generate('word', 'example') // string[]
hunspell.dispose()
```

`analyze` returns one object per reading, in the engine's order, and never
de-duplicates. Each line's space-separated `key:value` fields are parsed:
`st:` → `stem`, `po:` → `pos`, every other field verbatim into `tags`, the
whole line into `raw`. A missing `st:` or `po:` is `null`. An unknown word
gives `[]`.

Every call type-checks its arguments and throws a `TypeError` before touching
the engine. Every call after `dispose` throws an `Error` whose message
contains `disposed`.

TypeScript declarations ship in `types/index.d.ts`. There is no TypeScript
build step.

## Build

The host needs Docker and Git. The build is one container run of the pinned
Emscripten image:

```
emscripten/emsdk:6.0.9@sha256:96617f27fe16421588241def73908fd348a7f9d260440ed0d00b36dcf7a063cc
```

```sh
git submodule update --init
npm run build
```

That compiles the ten Hunspell engine files plus `build/wrapper.c` to
`dist/hunspell.js` and `dist/hunspell.wasm`. `dist/` is a build artefact, not
committed; a published npm package includes it so `npm install` copies files
and nothing runs.

A release updates the submodule pointer (when the engine moves) and
`build/checksums.txt` together, then rebuilds `dist/`. CI clones with
submodules, runs `build/build.sh`, and fails if the hash of
`dist/hunspell.wasm` differs from the recorded one.

## Pinned inputs

| input | value |
|---|---|
| Hunspell source | [`c5f98152a274e25b5107101104bef632b83a0cc9`](https://github.com/hunspell/hunspell/commit/c5f98152a274e25b5107101104bef632b83a0cc9) (1.7.3) at `vendor/hunspell` |
| Emscripten | `emscripten/emsdk:6.0.9@sha256:96617f27fe16421588241def73908fd348a7f9d260440ed0d00b36dcf7a063cc` |
| Node | ≥ 26 |

The first Hunspell pin is the commit behind the 1.7.3 release, which fixes a
stack overflow in `compound_check` on Hungarian dictionaries and a buffer
overflow in the dictionary loader.

## Test

```sh
git submodule update --init
npm ci --ignore-scripts
npm run build
npm run lint
npm run typecheck
npm test
```

Tests use the Hungarian dictionary (Magyar Ispell 1.8, May 2023) as a fixture
in `test/fixtures/`. It is a test fixture only; the published package does not
ship it. The native cross-check runs where the `hunspell` binary is installed
(CI installs `hunspell` and `hunspell-hu`).

## Performance

Native Hunspell 1.7.2 with this Hungarian dictionary, measured on one Linux
container: loading the dictionary 130–460 ms, ten thousand analyses added
nothing measurable, peak memory 21 MB.

Acceptable for the WebAssembly build: load under 2 s, per word still well
under a millisecond, memory under 100 MB. Numbers for this artefact are
recorded below at each release.

| release | load (Hungarian fixture) | 10 000 analyses | peak RSS |
|---|---|---|---|
| 0.0.1 | 113 ms | 277 ms (28 µs/word) | 92 MB |

## Licences

This package is [MPL-2.0](LICENSE).

Hunspell is LGPL 2.1 / GPL 2 / MPL 1.1 tri-licence; taken under MPL. Its
licence text is reproduced in `LICENSE`. The submodule pointer records the
commit built: `c5f98152a274e25b5107101104bef632b83a0cc9`.

The Hungarian dictionary (magyarispell, László Németh and Ferenc Godó) is a
GPL / LGPL / MPL tri-licence test fixture only. The header of `hu_HU.aff` is
kept with the files.
