declare module "nspell" {
  type Dictionary = {
    aff: Uint8Array
    dic: Uint8Array
  }

  export interface NSpell {
    correct(word: string): boolean
    suggest(word: string): string[]
    add(word: string): void
  }

  export default function nspell(dictionary: Dictionary): NSpell
}
