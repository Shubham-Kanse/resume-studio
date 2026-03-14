import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

type TokenizerLike = {
  tokenize: (text: string) => string[]
}

type WordTokenizerCtor = new () => TokenizerLike
type PorterStemmerLike = {
  stem: (token: string) => string
}
type JaroWinklerDistanceLike = (left: string, right: string) => number
type NgramsLike = {
  ngrams: (sequence: string[], size: number) => string[][]
}
type StopwordsLike = {
  words: string[]
}

const ngramsModule = require("natural/lib/natural/ngrams/ngrams") as NgramsLike
const PorterStemmer =
  require("natural/lib/natural/stemmers/porter_stemmer") as PorterStemmerLike
const tokenizerModule =
  require("natural/lib/natural/tokenizers/regexp_tokenizer") as
    | { WordTokenizer?: WordTokenizerCtor; default?: WordTokenizerCtor }
    | WordTokenizerCtor
const JaroWinklerDistance =
  require("natural/lib/natural/distance/jaro-winkler_distance") as JaroWinklerDistanceLike
const stopwordsModule =
  require("natural/lib/natural/util/stopwords") as StopwordsLike

const WordTokenizerCtorResolved =
  typeof tokenizerModule === "function"
    ? tokenizerModule
    : tokenizerModule.WordTokenizer || tokenizerModule.default

if (!WordTokenizerCtorResolved) {
  throw new Error("Failed to initialize natural NLP utilities")
}

const SafeWordTokenizerCtor = WordTokenizerCtorResolved

const tokenizer = new SafeWordTokenizerCtor()

export const NATURAL_STOPWORDS = new Set(
  (stopwordsModule.words as string[]).map((word) => word.toLowerCase())
)

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildLooseTermPattern(term: string) {
  let pattern = escapeRegExp(term.toLowerCase().trim())
  pattern = pattern.replace(/\\ /g, "[\\s\\u00a0]+")
  pattern = pattern.replace(/\\\//g, "[\\s/-]*")
  pattern = pattern.replace(/\\-/g, "[-\\s]?")
  pattern = pattern.replace(/\\&/g, "(?:&|and)")
  return new RegExp(`(^|[^a-z0-9+#.])${pattern}(?=$|[^a-z0-9+#.])`, "i")
}

export function normalizeNaturalToken(token: string) {
  return token.toLowerCase().replace(/^[^a-z0-9+#./-]+|[^a-z0-9+#./-]+$/g, "")
}

export function getNaturalSimilarity(left: string, right: string) {
  return JaroWinklerDistance(
    tokenizeNaturalText(left, { minLength: 1, excludeStopwords: false }).join(
      " "
    ),
    tokenizeNaturalText(right, { minLength: 1, excludeStopwords: false }).join(
      " "
    )
  )
}

export function tokenizeNaturalText(
  text: string,
  options?: {
    minLength?: number
    stopwords?: Set<string>
    excludeStopwords?: boolean
  }
) {
  const minLength = options?.minLength ?? 2
  const stopwords = options?.stopwords ?? NATURAL_STOPWORDS
  const excludeStopwords = options?.excludeStopwords ?? true

  return tokenizer
    .tokenize(text)
    .map(normalizeNaturalToken)
    .filter((token) => token.length >= minLength)
    .filter((token) => /[a-z0-9]/.test(token))
    .filter((token) => !(excludeStopwords && stopwords.has(token)))
}

export function stemNaturalToken(token: string) {
  return PorterStemmer.stem(normalizeNaturalToken(token))
}

export function getStemmedNaturalTokens(
  text: string,
  options?: {
    minLength?: number
    stopwords?: Set<string>
    excludeStopwords?: boolean
  }
) {
  return tokenizeNaturalText(text, options).map(stemNaturalToken)
}

export function getNaturalNgramPhrases(
  input: string | string[],
  sizes: number[] = [2, 3]
) {
  const tokens = Array.isArray(input) ? input : tokenizeNaturalText(input)

  return unique(
    sizes.flatMap((size) =>
      ngramsModule.ngrams(tokens, size).map((gram) => gram.join(" "))
    )
  )
}

export function rankTermsByTfIdf(
  document: string,
  options?: {
    limit?: number
    minLength?: number
    stopwords?: Set<string>
    corpusDocuments?: string[]
  }
) {
  if (!document.trim()) return []

  const minLength = options?.minLength ?? 3
  const stopwords = options?.stopwords
  const targetTokens = tokenizeNaturalText(document, {
    minLength,
    stopwords,
    excludeStopwords: true,
  })
  if (targetTokens.length === 0) return []

  const corpusTokenDocs = unique([
    targetTokens.join(" "),
    ...(options?.corpusDocuments ?? [])
      .map((entry) =>
        tokenizeNaturalText(entry, {
          minLength,
          stopwords,
          excludeStopwords: true,
        })
      )
      .filter((tokens) => tokens.length > 0)
      .map((tokens) => tokens.join(" ")),
  ]).map((entry) => entry.split(" ").filter(Boolean))

  const documentCount = Math.max(1, corpusTokenDocs.length)
  const avgDocumentLength =
    corpusTokenDocs.reduce((sum, tokens) => sum + tokens.length, 0) /
    documentCount
  const targetLength = targetTokens.length
  const tokenCounts = new Map<string, number>()

  for (const token of targetTokens) {
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1)
  }

  const documentFrequencies = new Map<string, number>()
  for (const tokens of corpusTokenDocs) {
    const seen = new Set(tokens)
    for (const token of seen) {
      documentFrequencies.set(token, (documentFrequencies.get(token) ?? 0) + 1)
    }
  }

  const k1 = 1.2
  const b = 0.75

  return unique(targetTokens)
    .map((token) => {
      const termFrequency = tokenCounts.get(token) ?? 0
      const documentFrequency = documentFrequencies.get(token) ?? 0
      const idf = Math.log(
        1 +
          (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5)
      )
      const normalization =
        termFrequency +
        k1 * (1 - b + (b * targetLength) / Math.max(1, avgDocumentLength || 1))
      const score = idf * ((termFrequency * (k1 + 1)) / normalization)

      return {
        token,
        stem: stemNaturalToken(token),
        score,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.token.localeCompare(right.token)
    )
    .slice(0, options?.limit ?? 20)
}

export function buildNaturalCorpusDocuments(
  text: string,
  options?: {
    minLength?: number
    stopwords?: Set<string>
    maxDocuments?: number
  }
) {
  const minLength = options?.minLength ?? 3
  const stopwords = options?.stopwords

  return unique(
    text
      .split(/\n\s*\n+|\n|[.!?]+/g)
      .map((chunk) =>
        tokenizeNaturalText(chunk, {
          minLength,
          stopwords,
          excludeStopwords: true,
        }).join(" ")
      )
      .map((chunk) => chunk.trim())
      .filter(Boolean)
  ).slice(0, options?.maxDocuments ?? 48)
}

function getMaxWindowSimilarity(lineTokens: string[], termTokens: string[]) {
  if (lineTokens.length === 0 || termTokens.length === 0) return 0

  const target = termTokens.join(" ")
  const windowSize = Math.min(termTokens.length, lineTokens.length)
  let maxSimilarity = JaroWinklerDistance(lineTokens.join(" "), target)

  for (
    let size = Math.max(1, windowSize - 1);
    size <= termTokens.length + 1;
    size++
  ) {
    if (size > lineTokens.length) continue

    for (let index = 0; index <= lineTokens.length - size; index += 1) {
      const candidate = lineTokens.slice(index, index + size).join(" ")
      maxSimilarity = Math.max(
        maxSimilarity,
        JaroWinklerDistance(candidate, target)
      )
    }
  }

  return maxSimilarity
}

export function findNaturalTermEvidence(
  lines: string[],
  term: string,
  options?: {
    variants?: string[]
    stopwords?: Set<string>
    fuzzyThreshold?: number
  }
) {
  const stopwords = options?.stopwords ?? NATURAL_STOPWORDS
  const fuzzyThreshold = options?.fuzzyThreshold ?? 0.93
  const variants = unique([term, ...(options?.variants ?? [])])
  const tokenizedVariants = variants
    .map((variant) => ({
      raw: variant.toLowerCase().trim(),
      tokens: tokenizeNaturalText(variant, {
        minLength: 2,
        stopwords,
        excludeStopwords: true,
      }),
    }))
    .filter((variant) => variant.tokens.length > 0)

  for (const line of lines) {
    const normalizedLine = line.toLowerCase()
    const lineTokens = tokenizeNaturalText(line, {
      minLength: 2,
      stopwords,
      excludeStopwords: true,
    })
    const lineStems = getStemmedNaturalTokens(line, {
      minLength: 2,
      stopwords,
      excludeStopwords: true,
    })
    const lineStemSet = new Set(lineStems)
    const lineNgrams = new Set(getNaturalNgramPhrases(lineStems, [2, 3, 4]))

    for (const variant of tokenizedVariants) {
      if (buildLooseTermPattern(variant.raw).test(normalizedLine)) {
        return {
          exact: true,
          stem: true,
          ngram: true,
          fuzzy: true,
          similarity: 1,
        }
      }

      const variantStems = variant.tokens.map(stemNaturalToken)
      const overlap =
        variantStems.filter((stem) => lineStemSet.has(stem)).length /
        variantStems.length

      if (overlap >= 1) {
        return {
          exact: false,
          stem: true,
          ngram: true,
          fuzzy: false,
          similarity: 1,
        }
      }

      if (variantStems.length >= 2) {
        const phrase = variantStems.join(" ")
        if (lineNgrams.has(phrase) || overlap >= 0.75) {
          return {
            exact: false,
            stem: overlap >= 0.75,
            ngram: true,
            fuzzy: false,
            similarity: overlap,
          }
        }
      }

      const similarity = getMaxWindowSimilarity(lineTokens, variant.tokens)
      if (similarity >= fuzzyThreshold) {
        return {
          exact: false,
          stem: overlap >= 0.5,
          ngram: variantStems.length >= 2 && overlap >= 0.5,
          fuzzy: true,
          similarity,
        }
      }
    }
  }

  return {
    exact: false,
    stem: false,
    ngram: false,
    fuzzy: false,
    similarity: 0,
  }
}
