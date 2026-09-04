import { load } from '@ert78gb/hunspell-wasm'
import type { Analysis, Hunspell, LoadOptions } from '@ert78gb/hunspell-wasm'

const options: LoadOptions = {
  aff: 'xx.aff',
  dic: 'xx.dic',
}

export async function check(word: string): Promise<{
  ok: boolean
  analyses: Analysis[]
  stems: string[]
  suggestions: string[]
  generated: string[]
}> {
  const hunspell: Hunspell = await load(options)
  try {
    return {
      ok: hunspell.spell(word),
      analyses: hunspell.analyze(word),
      stems: hunspell.stem(word),
      suggestions: hunspell.suggest(word),
      generated: hunspell.generate(word, word),
    }
  } finally {
    hunspell.dispose()
  }
}
