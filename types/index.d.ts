export interface LoadOptions {
  /** Path to the .aff file. */
  aff: string
  /** Path to the .dic file. */
  dic: string
}

export interface Analysis {
  /** The st: field, or null when the reading carries none. */
  stem: string | null
  /** The po: field (noun, vrb, adj, adj_num, …), or null. */
  pos: string | null
  /** Every other field as written, e.g. 'is:ACC', 'ds:s_ATTRIBUTE_adj', 'ts:NOM'. */
  tags: string[]
  /** The whole line as the engine returned it. */
  raw: string
}

export interface Hunspell {
  spell(word: string): boolean
  /** One entry per reading, in the engine's order; [] for an unknown word. */
  analyze(word: string): Analysis[]
  stem(word: string): string[]
  suggest(word: string): string[]
  /** Inflected forms of `word` on the pattern of `example`; [] when none. */
  generate(word: string, example: string): string[]
  /** Release the engine; every later call throws. */
  dispose(): void
}

export function load(options: LoadOptions): Promise<Hunspell>
