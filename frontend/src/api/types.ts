// Типы из docs/CONTRACT.md — источник истины. Меняются только вместе с контрактом.

export type Health = { status: string; llm: boolean }

export type ApiErrorCode =
  | 'invalid_export'
  | 'not_found'
  | 'file_too_large'
  | 'validation'

export type ApiErrorBody = { error: { code: ApiErrorCode | string; message: string } }

export type Author = {
  id: string
  name: string
  message_count: number
  enough_data: boolean
}

export type ChatKind = 'personal' | 'group'

export type Chat = {
  id: string
  title: string
  kind: ChatKind
  message_count: number
  period: { from: string; to: string }
  authors: Author[]
}

export type Trait = {
  key: string
  label: string
  value: number
  description: string
}

export type StyleProfile = {
  author_id: string
  name: string
  message_count: number
  enough_data: boolean
  avg_length: number
  traits: Trait[]
  top_words: string[]
  emoji: { char: string; count: number }[]
  /** 24 доли по часам UTC, сумма = 1 */
  active_hours: number[]
}

/** [start, end) в кодовых точках Unicode — резать через sliceSpan */
export type Span = [number, number]

export type Signal = {
  feature: string
  label: string
  expected: string | null
  observed: string
  span: Span | null
  weight: number
}

export type CheckVerdict = 'match' | 'uncertain' | 'mismatch' | 'not_enough_data'

export type CheckRequest = { text: string; sent_at?: string }

export type CheckResult = {
  author_id: string
  /** null при verdict = not_enough_data */
  score: number | null
  verdict: CheckVerdict
  signals: Signal[]
  explanation: string | null
  challenge_question: string | null
}

export type TwinVerdict = 'likely_same' | 'possible' | 'different'

export type TwinPair = {
  a: string
  b: string
  score: number
  verdict: TwinVerdict
  signals: Signal[]
}

export type TwinsResult = {
  chat_id: string
  authors: Author[]
  pairs: TwinPair[]
  validation: { self_match_rate: number; authors_tested: number } | null
}

export type PairMessage = { text: string; sent_at: string }

export type PairDetails = {
  pair: TwinPair
  a: Author
  b: Author
  examples: { feature: string; a: PairMessage; b: PairMessage }[]
  timeline: { overlap_minutes: number; median_switch_seconds: number | null }
  explanation: string | null
}

/** Общий интерфейс реального клиента и моков */
export type Api = {
  getHealth(): Promise<Health>
  uploadChat(file: File): Promise<Chat>
  getChat(chatId: string): Promise<Chat>
  getProfile(chatId: string, authorId: string): Promise<StyleProfile>
  checkMessage(chatId: string, authorId: string, body: CheckRequest): Promise<CheckResult>
  getTwins(chatId: string): Promise<TwinsResult>
  getPair(chatId: string, aId: string, bId: string): Promise<PairDetails>
}
