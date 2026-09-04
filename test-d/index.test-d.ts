import { expectError, expectType } from 'tsd'
import { load } from '@ert78gb/hunspell-wasm'
import type { Analysis, Hunspell, LoadOptions } from '@ert78gb/hunspell-wasm'

const options: LoadOptions = {
  aff: 'xx.aff',
  dic: 'xx.dic',
}

expectType<Promise<Hunspell>>(load(options))

const hunspell = await load(options)

expectType<boolean>(hunspell.spell('word'))
expectType<Analysis[]>(hunspell.analyze('word'))
expectType<string[]>(hunspell.stem('word'))
expectType<string[]>(hunspell.suggest('word'))
expectType<string[]>(hunspell.generate('word', 'example'))
expectType<void>(hunspell.dispose())

expectType<string | null>(hunspell.analyze('word')[0].stem)
expectType<string | null>(hunspell.analyze('word')[0].pos)
expectType<string[]>(hunspell.analyze('word')[0].tags)
expectType<string>(hunspell.analyze('word')[0].raw)

expectError(load())
expectError(load({ aff: 'xx.aff' }))
expectError(load({ dic: 'xx.dic' }))
expectError(hunspell.spell(5))
expectError(hunspell.analyze(5))
expectError(hunspell.generate('word'))
